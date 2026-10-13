import { Router, Response } from 'express';
import {
  authenticateUser,
  AuthenticatedRequest
} from './auth.js';
import {
  getDB,
  saveDB,
  checkRateLimits,
  logUsage,
  getProviderRaw
} from '../db.js';
import { streamChatCompletion } from '../proxy.js';
import { Conversation, Message } from '../types.js';

export const chatRouter = Router();

// GET /api/chat/conversations - List conversations for authenticated user
chatRouter.get('/conversations', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDB();
  const userConversations = db.conversations
    .filter(c => c.userId === user.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return res.json(userConversations);
});

// POST /api/chat/conversations - Create new conversation
chatRouter.post('/conversations', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { title, modelId } = req.body;
  const db = getDB();

  const now = new Date().toISOString();
  const newConversation: Conversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: user.id,
    title: title || 'New Conversation',
    modelId: modelId || 'deepseek-v4.1-flash:free',
    createdAt: now,
    updatedAt: now,
  };

  db.conversations.unshift(newConversation);
  saveDB();

  return res.json(newConversation);
});

// GET /api/chat/conversations/:id - Retrieve messages for conversation
chatRouter.get('/conversations/:id', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const convId = req.params.id;
  const db = getDB();

  const conversation = db.conversations.find(c => c.id === convId && c.userId === user.id);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found or access denied.' });
  }

  const messages = db.messages
    .filter(m => m.conversationId === convId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return res.json({
    conversation,
    messages,
  });
});

// PATCH /api/chat/conversations/:id - Rename conversation title
chatRouter.patch('/conversations/:id', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const convId = req.params.id;
  const { title, modelId } = req.body;
  const db = getDB();

  const conversation = db.conversations.find(c => c.id === convId && c.userId === user.id);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  let updated = false;
  if (title) {
    conversation.title = title.trim();
    updated = true;
  }
  if (modelId) {
    conversation.modelId = modelId;
    updated = true;
  }

  if (updated) {
    conversation.updatedAt = new Date().toISOString();
    saveDB();
  }

  return res.json(conversation);
});

// DELETE /api/chat/conversations/:id - Delete conversation and its messages
chatRouter.delete('/conversations/:id', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const convId = req.params.id;
  const db = getDB();

  const index = db.conversations.findIndex(c => c.id === convId && c.userId === user.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  db.conversations.splice(index, 1);
  db.messages = db.messages.filter(m => m.conversationId !== convId);
  saveDB();

  return res.json({ success: true, message: 'Conversation deleted.' });
});

// POST /api/chat/stream - SSE Stream chat message
chatRouter.post('/stream', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { conversationId, modelId, content, messagesHistory, attachments: rawAttachments } = req.body;

  const hasAttachments = Array.isArray(rawAttachments) && rawAttachments.length > 0;
  if (!content && !hasAttachments && (!messagesHistory || messagesHistory.length === 0)) {
    return res.status(400).json({ error: 'Message content or attachment is required.' });
  }

  // 1. Check rate limits & fair usage
  const rateLimitCheck = checkRateLimits(user);
  if (!rateLimitCheck.allowed) {
    return res.status(429).json({ error: rateLimitCheck.reason });
  }

  // 2. Validate model availability strictly (no silent substitutions)
  const db = getDB();
  const selectedModel = db.models.find(m => m.id === modelId || m.actualModelId === modelId);
  if (!selectedModel) {
    return res.status(400).json({ error: `Selected model '${modelId}' is not recognized in the system catalogue.` });
  }

  if (!selectedModel.enabledForUsers && user.role !== 'admin') {
    return res.status(403).json({ error: `Model '${selectedModel.name}' is currently disabled for users by the administrator.` });
  }

  const provider = db.providers[selectedModel.providerId];
  if (!provider) {
    return res.status(503).json({ error: `Provider for '${selectedModel.name}' is not configured.` });
  }

  if (!provider.isEnabled) {
    return res.status(503).json({ error: `Provider '${provider.name}' is currently disabled by the owner.` });
  }

  if (!provider.hasKey && selectedModel.providerId !== 'google_gemini') {
    return res.status(503).json({
      error: `Model '${selectedModel.name}' on ${provider.name} is currently unavailable: Provider API key has not been configured in the Owner Dashboard.`
    });
  }

  // 3. Process attachments (Images, PDFs, Documents, Code)
  const { processAttachment } = await import('../extractor.js');
  const processedAttachments = [];
  if (hasAttachments) {
    for (const raw of rawAttachments) {
      const proc = await processAttachment(raw);
      if (proc.error) {
        return res.status(400).json({ error: proc.error });
      }
      processedAttachments.push(proc.attachment);
    }
  }

  // Verify vision compatibility if images attached
  const hasImages = processedAttachments.some(a => a.category === 'image');
  const supportsVision = selectedModel.supportsVision ?? (
    ['opus-5.5', 'luna-5.6', 'gemini-2.5-flash'].includes(selectedModel.id) ||
    ['claude-opus-5.5', 'luna-5.6', 'gemini-2.5-flash'].includes(selectedModel.actualModelId || '')
  );

  if (hasImages && !supportsVision) {
    return res.status(400).json({
      error: `Model "${selectedModel.name}" on ${provider.name} does not support image analysis. Please select a vision-capable model such as Opus 5.5, Luna 5.6, or Gemini 2.5 Flash.`
    });
  }

  // 4. Extract document context
  let finalUserPrompt = (content || '').trim();
  const docContexts: string[] = [];
  for (const att of processedAttachments) {
    if (att.extractedText) {
      docContexts.push(
        `[Attached Document: ${att.name} (${att.type}, ${(att.size / 1024).toFixed(1)} KB)]\n` +
        `\`\`\`\n${att.extractedText}\n\`\`\``
      );
    }
  }

  if (docContexts.length > 0) {
    finalUserPrompt = `${docContexts.join('\n\n')}\n\n${finalUserPrompt || 'Please inspect and analyze the attached document(s) above.'}`;
  } else if (!finalUserPrompt && hasImages) {
    finalUserPrompt = 'Please analyze the attached image.';
  }

  // 5. Prepare or create conversation
  let currentConvId = conversationId;
  const now = new Date().toISOString();

  if (!currentConvId) {
    const rawSnippet = (content || (processedAttachments[0]?.name ? `File: ${processedAttachments[0].name}` : 'New Chat')).trim();
    const titleSnippet = rawSnippet.slice(0, 36) + (rawSnippet.length > 36 ? '...' : '');
    const newConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: user.id,
      title: titleSnippet,
      modelId: selectedModel.id,
      createdAt: now,
      updatedAt: now,
    };
    db.conversations.unshift(newConv);
    currentConvId = newConv.id;
  } else {
    const existing = db.conversations.find(c => c.id === currentConvId && c.userId === user.id);
    if (existing) {
      existing.updatedAt = now;
      existing.modelId = selectedModel.id;
    }
  }

  // Store user message with attachments metadata
  const userMsg: Message = {
    id: `msg_u_${Date.now()}`,
    conversationId: currentConvId,
    role: 'user',
    content: (content || '').trim() || (processedAttachments.length > 0 ? `Attached: ${processedAttachments.map(a => a.name).join(', ')}` : ''),
    modelId: selectedModel.id,
    createdAt: now,
    attachments: processedAttachments.map(a => ({
      id: a.id,
      name: a.name,
      size: a.size,
      type: a.type,
      category: a.category,
      dataUrl: a.category === 'image' ? a.dataUrl : undefined,
    })),
  };
  db.messages.push(userMsg);
  saveDB();

  // Prepare full message sequence
  const chatSequence: any[] = (messagesHistory || []).map((m: any) => ({
    role: m.role,
    content: m.content,
    attachments: m.attachments,
  }));

  chatSequence.push({
    role: 'user',
    content: finalUserPrompt,
    attachments: processedAttachments,
  });

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Notify client of conversationId
  res.write(`data: ${JSON.stringify({ type: 'init', conversationId: currentConvId, modelId: selectedModel.id })}\n\n`);

  const startTime = Date.now();
  let accumulatedAssistantContent = '';

  await streamChatCompletion(
    selectedModel.providerId,
    selectedModel.id,
    chatSequence,
    {
      onChunk: (textChunk: string) => {
        accumulatedAssistantContent += textChunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: textChunk })}\n\n`);
      },
      onDone: (totalTokensEstimated: number) => {
        const durationMs = Date.now() - startTime;
        const assistantMsgId = `msg_a_${Date.now()}`;
        
        // Save assistant response message to DB
        const assistantMsg: Message = {
          id: assistantMsgId,
          conversationId: currentConvId,
          role: 'assistant',
          content: accumulatedAssistantContent,
          modelId: selectedModel.id,
          tokensEstimated: totalTokensEstimated,
          createdAt: new Date().toISOString(),
        };
        db.messages.push(assistantMsg);
        saveDB();

        // Log request usage
        logUsage({
          userId: user.id,
          userEmail: user.email,
          providerId: selectedModel.providerId,
          modelId: selectedModel.id,
          promptTokens: Math.ceil(JSON.stringify(chatSequence).length / 4),
          completionTokens: Math.ceil(accumulatedAssistantContent.length / 4),
          totalTokens: totalTokensEstimated,
          durationMs,
          status: 'success',
          ip: req.ip,
        });

        res.write(`data: ${JSON.stringify({
          type: 'done',
          messageId: assistantMsgId,
          conversationId: currentConvId,
          tokens: totalTokensEstimated,
          durationMs,
        })}\n\n`);
        res.end();
      },
      onError: (err: Error) => {
        const durationMs = Date.now() - startTime;
        logUsage({
          userId: user.id,
          userEmail: user.email,
          providerId: selectedModel.providerId,
          modelId: selectedModel.id,
          promptTokens: Math.ceil(JSON.stringify(chatSequence).length / 4),
          completionTokens: 0,
          totalTokens: 0,
          durationMs,
          status: 'error',
          errorMessage: err.message,
          ip: req.ip,
        });

        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: err.message,
        })}\n\n`);
        res.end();
      },
    }
  );
});
