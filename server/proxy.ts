import { GoogleGenAI } from '@google/genai';
import {
  getProviderRaw,
  getDecryptedProviderKey,
  getAllModels,
  updateProvider,
  addOrSyncModels,
  getEligibleApiKeys,
  recordKeySuccess,
  recordKeyFailure,
} from './db.js';
import { ModelConfig, Attachment } from './types.js';
import { buildSystemPrompt } from './identity.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
}

interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (totalTokensEstimated: number) => void;
  onError: (error: Error) => void;
}

/**
 * Perform a chat completion stream to the selected provider.
 */
export async function streamChatCompletion(
  providerId: string,
  modelId: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks
): Promise<void> {
  const provider = getProviderRaw(providerId);
  if (!provider) {
    callbacks.onError(new Error(`Provider ${providerId} not found`));
    return;
  }

  if (!provider.isEnabled) {
    callbacks.onError(new Error(`Provider ${provider.name} is currently disabled by administrator.`));
    return;
  }

  const { getDB } = await import('./db.js');
  const db = getDB();
  const modelObj = db.models.find(m => m.id === modelId || m.actualModelId === modelId);
  const targetModelId = modelObj?.actualModelId || modelId;

  // Check for image attachments and verify model vision capability
  const allImageAttachments: Attachment[] = [];
  for (const m of messages) {
    if (m.attachments) {
      for (const a of m.attachments) {
        if (a.category === 'image' && a.dataUrl) {
          allImageAttachments.push(a);
        }
      }
    }
  }

  const hasImages = allImageAttachments.length > 0;
  const supportsVision = modelObj?.supportsVision ?? (
    ['opus-5.5', 'luna-5.6', 'gemini-2.5-flash'].includes(modelId) ||
    ['claude-opus-5.5', 'luna-5.6', 'gemini-2.5-flash'].includes(targetModelId)
  );

  if (hasImages && !supportsVision) {
    callbacks.onError(
      new Error(
        `The selected model "${modelObj?.name || modelId}" on ${provider.name} does not support image analysis. Please select a vision-capable model such as Opus 5.5, Luna 5.6, or Gemini 2.5 Flash.`
      )
    );
    return;
  }

  // Construct permanent system prompt (AZI identity + admin custom directives)
  const systemPromptText = buildSystemPrompt(db.fairUsage.customSystemPrompt);
  const apiKey = getDecryptedProviderKey(providerId);

  // 1. Google Gemini Built-in Engine
  if (providerId === 'google_gemini') {
    const geminiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      callbacks.onError(new Error('Built-in Gemini API key is not configured on the server.'));
      return;
    }
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      // Build multimodal contents for Gemini
      const geminiContents: any[] = [];
      for (const msg of messages) {
        if (msg.role === 'system') continue;
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const parts: any[] = [];
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        if (msg.attachments) {
          for (const att of msg.attachments) {
            if (att.category === 'image' && att.dataUrl) {
              const commaIdx = att.dataUrl.indexOf(',');
              if (commaIdx !== -1) {
                const header = att.dataUrl.slice(0, commaIdx);
                const base64 = att.dataUrl.slice(commaIdx + 1);
                const mimeType = header.match(/data:(.*?);/)?.[1] || 'image/jpeg';
                parts.push({
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                });
              }
            }
          }
        }
        if (parts.length > 0) {
          geminiContents.push({ role, parts });
        }
      }

      const geminiModelId = targetModelId && targetModelId.startsWith('gemini') ? targetModelId : 'gemini-2.5-flash';
      const responseStream = await ai.models.generateContentStream({
        model: geminiModelId,
        config: {
          systemInstruction: systemPromptText,
        },
        contents: geminiContents,
      });

      let accumulated = '';
      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        if (text) {
          accumulated += text;
          callbacks.onChunk(text);
        }
      }

      const totalTokens = Math.ceil((JSON.stringify(geminiContents).length + accumulated.length) / 4);
      callbacks.onDone(totalTokens);
      return;
    } catch (err: any) {
      callbacks.onError(new Error(`Gemini Provider error: ${err.message || 'Stream generation failed'}`));
      return;
    }
  }

  // 2. Token Harbour or CodeCraft API (with Multi-Key Failover)
  const eligibleKeys = getEligibleApiKeys(providerId);
  if (eligibleKeys.length === 0) {
    callbacks.onError(
      new Error(
        `Provider "${provider.name}" has no enabled API keys configured. As the administrator, please go to the Admin Dashboard (API Key Manager) to add and enable a key for ${provider.name}.`
      )
    );
    return;
  }

  const cleanBaseUrl = provider.baseUrl.replace(/\/+$/, '');
  const url = `${cleanBaseUrl}/chat/completions`;

  // Format OpenAI-compatible messages with authoritative system prompt
  const formattedMessages: any[] = [
    { role: 'system', content: systemPromptText }
  ];

  for (const msg of messages) {
    if (msg.role === 'system') continue;
    const images = (msg.attachments || []).filter(a => a.category === 'image' && a.dataUrl);

    if (images.length > 0 && supportsVision) {
      formattedMessages.push({
        role: msg.role,
        content: [
          { type: 'text', text: msg.content || 'Please analyze the attached image.' },
          ...images.map(img => ({
            type: 'image_url',
            image_url: { url: img.dataUrl },
          })),
        ],
      });
    } else {
      formattedMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  const requestBody = {
    model: targetModelId,
    messages: formattedMessages,
    stream: true,
  };

  let lastError: Error | null = null;
  let streamCompletedSuccessfully = false;

  for (let keyIdx = 0; keyIdx < eligibleKeys.length; keyIdx++) {
    const { key: keyRecord, rawKey } = eligibleKeys[keyIdx];
    const attemptStartTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${rawKey}`,
          'User-Agent': 'AZI-Central-API-System/1.0',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let parsedMessage = errorText;
        let errorCode = '';
        try {
          const json = JSON.parse(errorText);
          parsedMessage = json.error?.message || json.message || errorText;
          errorCode = json.error?.code || json.code || '';
        } catch {
          // use raw text
        }

        const isQuotaOrRateLimit =
          response.status === 429 ||
          response.status === 402 ||
          /quota|rate limit|credit balance|exceeded your current quota|insufficient_quota|tokens per minute/i.test(parsedMessage) ||
          errorCode === 'insufficient_quota' ||
          errorCode === 'rate_limit_exceeded';

        if (isQuotaOrRateLimit) {
          recordKeyFailure(keyRecord.id, response.status === 429 ? 'rate_limited' : 'quota_exceeded', parsedMessage);
          console.warn(`[AZI Failover] Key "${keyRecord.label}" exhausted quota or hit rate limit (${response.status}: ${parsedMessage}). Auto-failing over to next available key...`);
          lastError = new Error(`[${provider.name}] Key "${keyRecord.label}": Quota exhausted (${parsedMessage})`);
          continue; // Try next eligible key!
        } else if (response.status === 401 || response.status === 403) {
          recordKeyFailure(keyRecord.id, 'error', `Unauthorized/Invalid Key: ${parsedMessage}`);
          console.warn(`[AZI Failover] Key "${keyRecord.label}" unauthorized (HTTP ${response.status}). Auto-failing over...`);
          lastError = new Error(`[${provider.name}] Key "${keyRecord.label}": HTTP ${response.status} (${parsedMessage})`);
          continue; // Try next eligible key!
        } else {
          // Other HTTP error (e.g. 500, 502, 503)
          recordKeyFailure(keyRecord.id, 'error', parsedMessage);
          lastError = new Error(`[${provider.name}] HTTP ${response.status}: ${parsedMessage || response.statusText}`);
          if (keyIdx < eligibleKeys.length - 1) {
            continue; // Try next key
          }
          break;
        }
      }

      if (!response.body) {
        throw new Error('Received empty response body from upstream provider');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed === 'data: [DONE]') {
            break;
          }

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              const deltaContent = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
              if (deltaContent) {
                accumulatedContent += deltaContent;
                callbacks.onChunk(deltaContent);
              }
            } catch {
              if (jsonStr && jsonStr !== '[DONE]') {
                accumulatedContent += jsonStr;
                callbacks.onChunk(jsonStr);
              }
            }
          }
        }
      }

      // Mark success for this key!
      const latency = Date.now() - attemptStartTime;
      recordKeySuccess(keyRecord.id, latency);
      streamCompletedSuccessfully = true;

      const estimatedTokens = Math.ceil((JSON.stringify(messages).length + accumulatedContent.length) / 4);
      callbacks.onDone(estimatedTokens);
      return;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError';
      const errMsg = isAbort ? `Request timed out after 60s connecting to ${provider.name}` : err.message;
      console.warn(`[AZI Failover] Key "${keyRecord.label}" attempt failed: ${errMsg}`);
      recordKeyFailure(keyRecord.id, 'error', errMsg);
      lastError = new Error(`[${provider.name}] Key "${keyRecord.label}": ${errMsg}`);

      if (keyIdx < eligibleKeys.length - 1) {
        continue; // Try next eligible key!
      }
    }
  }

  if (!streamCompletedSuccessfully) {
    callbacks.onError(
      new Error(
        `All configured API keys for ${provider.name} failed (${eligibleKeys.length} key(s) tried). ${lastError ? `Last error: ${lastError.message}. ` : ''}Please retry or add/refresh API keys in the Owner Admin Dashboard.`
      )
    );
  }
}

/**
 * Test connectivity to a provider.
 */
export async function testProviderConnectivity(providerId: string): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
}> {
  const provider = getProviderRaw(providerId);
  if (!provider) {
    return { success: false, latencyMs: 0, message: 'Provider not found' };
  }

  const apiKey = getDecryptedProviderKey(providerId);
  const startTime = Date.now();

  if (providerId === 'google_gemini') {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return { success: false, latencyMs: 0, message: 'Gemini API key is not configured' };
    }
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Ping',
      });
      const latencyMs = Date.now() - startTime;
      updateProvider(providerId, {
        status: 'online',
        lastTested: new Date().toISOString(),
        latencyMs,
        lastError: null,
      });
      return { success: true, latencyMs, message: 'Successfully connected to Google Gemini Engine.' };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      updateProvider(providerId, {
        status: 'error',
        lastTested: new Date().toISOString(),
        latencyMs,
        lastError: err.message,
      });
      return { success: false, latencyMs, message: err.message };
    }
  }

  if (!apiKey) {
    return {
      success: false,
      latencyMs: 0,
      message: `API Key for ${provider.name} has not been entered. Please save an API key first.`,
    };
  }

  const cleanBaseUrl = provider.baseUrl.replace(/\/+$/, '');
  const modelsUrl = `${cleanBaseUrl}/models`;

  try {
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'AZI-Central-API-System/1.0',
      },
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      updateProvider(providerId, {
        status: 'online',
        lastTested: new Date().toISOString(),
        latencyMs,
        lastError: null,
      });
      return {
        success: true,
        latencyMs,
        message: `Successfully connected to ${provider.name} (${response.status} OK in ${latencyMs}ms).`,
      };
    } else {
      const text = await response.text();
      let errDetails = text;
      try {
        const j = JSON.parse(text);
        errDetails = j.error?.message || j.message || text;
      } catch {}

      const msg = `HTTP ${response.status}: ${errDetails || response.statusText}`;
      updateProvider(providerId, {
        status: 'error',
        lastTested: new Date().toISOString(),
        latencyMs,
        lastError: msg,
      });
      return { success: false, latencyMs, message: msg };
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const msg = err.message || 'Connection failed or timed out';
    updateProvider(providerId, {
      status: 'error',
      lastTested: new Date().toISOString(),
      latencyMs,
      lastError: msg,
    });
    return { success: false, latencyMs, message: msg };
  }
}

/**
 * Test an individual API Key against its upstream provider.
 */
export async function testIndividualApiKey(
  providerId: string,
  rawApiKey: string
): Promise<{ success: boolean; latencyMs: number; message: string; quotaExceeded?: boolean }> {
  const provider = getProviderRaw(providerId);
  if (!provider) {
    return { success: false, latencyMs: 0, message: `Provider "${providerId}" not found.` };
  }

  const cleanBaseUrl = provider.baseUrl.replace(/\/+$/, '');
  const startTime = Date.now();

  try {
    const response = await fetch(`${cleanBaseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${rawApiKey}`,
        'User-Agent': 'AZI-Central-API-System/1.0',
      },
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        latencyMs,
        message: `Successfully authenticated with ${provider.name} (${response.status} OK in ${latencyMs}ms). Key is verified and ready.`,
      };
    }

    const text = await response.text();
    let errDetails = text;
    try {
      const j = JSON.parse(text);
      errDetails = j.error?.message || j.message || text;
    } catch {}

    const isQuota = response.status === 429 || response.status === 402 || /quota|rate limit|credit balance/i.test(errDetails);
    return {
      success: false,
      latencyMs,
      quotaExceeded: isQuota,
      message: `[${provider.name}] HTTP ${response.status}: ${errDetails || response.statusText}`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      latencyMs,
      message: err.message || 'Key verification timed out or failed to connect',
    };
  }
}


/**
 * Fetch dynamic model catalogue from upstream provider.
 */
export async function fetchUpstreamModels(providerId: string): Promise<{
  success: boolean;
  models: ModelConfig[];
  message: string;
}> {
  const provider = getProviderRaw(providerId);
  if (!provider) {
    return { success: false, models: [], message: 'Provider not found' };
  }

  const apiKey = getDecryptedProviderKey(providerId);
  if (!apiKey) {
    return {
      success: false,
      models: [],
      message: `Cannot fetch models: No API key configured for ${provider.name}`,
    };
  }

  const cleanBaseUrl = provider.baseUrl.replace(/\/+$/, '');
  const modelsUrl = `${cleanBaseUrl}/models`;

  try {
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'AZI-Central-API-System/1.0',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        models: [],
        message: `Upstream error fetching models (${response.status}): ${errText}`,
      };
    }

    const data = await response.json();
    const rawList = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);

    const { getDB, saveDB } = await import('./db.js');
    const db = getDB();

    // Map exact models for provider
    if (providerId === 'codecraft') {
      const opusItem = rawList.find((item: any) => {
        const id = (item.id || item.name || '').toLowerCase();
        return id.includes('opus-5.5') || id === 'opus-5.5' || id.includes('opus');
      });
      const fableItem = rawList.find((item: any) => {
        const id = (item.id || item.name || '').toLowerCase();
        return id.includes('fable-5.1') || id === 'fable-5.1' || id.includes('fable');
      });
      const lunaItem = rawList.find((item: any) => {
        const id = (item.id || item.name || '').toLowerCase();
        return id.includes('luna-5.6') || id === 'luna-5.6' || id.includes('luna');
      });

      // Update Opus 5.5
      const opusModel = db.models.find(m => m.id === 'opus-5.5');
      if (opusModel) {
        if (opusItem) {
          opusModel.actualModelId = opusItem.id || 'claude-opus-5.5';
          opusModel.verified = true;
          opusModel.isFree = false; // Never label paid as free
          opusModel.pricingNote = 'Paid Enterprise Tier (CodeCraft)';
          opusModel.contextWindow = opusItem.context_length || opusItem.context_window || 200000;
        } else {
          opusModel.verified = false;
          opusModel.availabilityReason = 'Not found in CodeCraft catalogue';
        }
      }

      // Update Fable 5.1
      const fableModel = db.models.find(m => m.id === 'fable-5.1');
      if (fableModel) {
        if (fableItem) {
          fableModel.actualModelId = fableItem.id || 'fable-5.1';
          fableModel.verified = true;
          fableModel.isFree = false; // Paid tier
          fableModel.pricingNote = 'Paid Tier (CodeCraft)';
          fableModel.contextWindow = fableItem.context_length || fableItem.context_window || 128000;
        } else {
          fableModel.verified = false;
          fableModel.availabilityReason = 'Not found in CodeCraft catalogue';
        }
      }

      // Update Luna 5.6
      const lunaModel = db.models.find(m => m.id === 'luna-5.6');
      if (lunaModel) {
        if (lunaItem) {
          lunaModel.actualModelId = lunaItem.id || 'luna-5.6';
          lunaModel.verified = true;
          lunaModel.isFree = false; // Paid tier
          lunaModel.pricingNote = 'Paid Tier (CodeCraft)';
          lunaModel.contextWindow = lunaItem.context_length || lunaItem.context_window || 128000;
        } else {
          lunaModel.verified = false;
          lunaModel.availabilityReason = 'Not found in CodeCraft catalogue';
        }
      }
    } else if (providerId === 'token_harbour') {
      const deepseekItem = rawList.find((item: any) => {
        const id = (item.id || item.name || '').toLowerCase();
        return id.includes('deepseek-v4.1-flash') || id.includes('deepseek-v4.1') || id.includes('deepseek');
      });
      const mimoItem = rawList.find((item: any) => {
        const id = (item.id || item.name || '').toLowerCase();
        return id.includes('mimo-2.6-flash') || id.includes('mimo-2.6') || id.includes('mimo');
      });

      // Update DeepSeek V4.1 Flash
      const dsModel = db.models.find(m => m.id === 'deepseek-v4.1-flash:free');
      if (dsModel) {
        if (deepseekItem) {
          dsModel.actualModelId = deepseekItem.id || 'deepseek-v4.1-flash:free';
          dsModel.verified = true;
          dsModel.isFree = true;
          dsModel.pricingNote = 'Verified Free Tier on Token Harbour';
          dsModel.contextWindow = deepseekItem.context_length || deepseekItem.context_window || 64000;
        } else {
          dsModel.verified = false;
          dsModel.availabilityReason = 'Not found in Token Harbour catalogue';
        }
      }

      // Update MiMo 2.6 Flash
      const mimoModel = db.models.find(m => m.id === 'mimo-2.6-flash:free');
      if (mimoModel) {
        if (mimoItem) {
          mimoModel.actualModelId = mimoItem.id || 'mimo-2.6-flash:free';
          mimoModel.verified = true;
          mimoModel.isFree = true;
          mimoModel.pricingNote = 'Verified Free Tier on Token Harbour';
          mimoModel.contextWindow = mimoItem.context_length || mimoItem.context_window || 64000;
        } else {
          mimoModel.verified = false;
          mimoModel.availabilityReason = 'Not found in Token Harbour catalogue';
        }
      }
    }

    saveDB();

    return {
      success: true,
      models: db.models.filter(m => m.providerId === providerId),
      message: `Queried ${rawList.length} models from ${provider.name}. Preferred models mapped and verified.`,
    };
  } catch (err: any) {
    return {
      success: false,
      models: [],
      message: `Failed to query model catalogue: ${err.message}`,
    };
  }
}
