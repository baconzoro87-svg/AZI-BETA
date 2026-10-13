import {
  User,
  ProviderItem,
  ModelItem,
  Conversation,
  Message,
  FairUsageSettings,
  AdminStats,
  UsageLogItem,
  ApiKeyItem,
} from '../types';

const TOKEN_KEY = 'azi_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const json = await response.json();
      if (json.error) errorMsg = json.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // --- Auth ---
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const data = await request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.token);
    return data;
  },

  async register(email: string, password: string, name: string): Promise<{ token: string; user: User }> {
    const data = await request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    setStoredToken(data.token);
    return data;
  },

  async me(): Promise<User> {
    return request<User>('/api/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  async quickSwitch(role: 'admin' | 'user'): Promise<{ token: string; user: User }> {
    const data = await request<{ token: string; user: User }>('/api/auth/quick-switch', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    setStoredToken(data.token);
    return data;
  },

  // --- Models ---
  async getPublicModels(): Promise<{
    models: ModelItem[];
    defaultModelId: string;
    systemStatus: { maintenanceMode: boolean; announcement?: string };
  }> {
    return request('/api/models');
  },

  // --- Chat ---
  async getConversations(): Promise<Conversation[]> {
    return request<Conversation[]>('/api/chat/conversations');
  },

  async createConversation(title?: string, modelId?: string): Promise<Conversation> {
    return request<Conversation>('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ title, modelId }),
    });
  },

  async getConversationMessages(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    return request(`/api/chat/conversations/${id}`);
  },

  async renameConversation(id: string, title: string): Promise<Conversation> {
    return request(`/api/chat/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  },

  async updateConversationModel(id: string, modelId: string): Promise<Conversation> {
    return request(`/api/chat/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ modelId }),
    });
  },

  async deleteConversation(id: string): Promise<void> {
    await request(`/api/chat/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  // --- Chat Stream (SSE) ---
  streamChat(params: {
    conversationId?: string;
    modelId: string;
    content: string;
    attachments?: { name: string; size: number; type: string; base64Data: string }[];
    messagesHistory: { role: string; content: string; attachments?: any[] }[];
    signal?: AbortSignal;
    onInit?: (data: { conversationId: string; modelId: string }) => void;
    onChunk: (chunk: string) => void;
    onDone: (data: { messageId: string; conversationId: string; tokens: number; durationMs: number }) => void;
    onError: (error: string) => void;
  }): () => void {
    const token = getStoredToken();
    const controller = new AbortController();

    const fetchStream = async () => {
      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            conversationId: params.conversationId,
            modelId: params.modelId,
            content: params.content,
            attachments: params.attachments,
            messagesHistory: params.messagesHistory,
          }),
          signal: params.signal || controller.signal,
        });

        if (!response.ok) {
          let errorMsg = `Server error ${response.status}`;
          try {
            const json = await response.json();
            if (json.error) errorMsg = json.error;
          } catch {}
          params.onError(errorMsg);
          return;
        }

        if (!response.body) {
          params.onError('No response body received');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              if (data.type === 'init' && params.onInit) {
                params.onInit(data);
              } else if (data.type === 'chunk') {
                params.onChunk(data.text);
              } else if (data.type === 'done') {
                params.onDone(data);
              } else if (data.type === 'error') {
                params.onError(data.error);
              }
            } catch {
              // ignore json parse error on single line
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // user cancelled stream gracefully
          return;
        }
        params.onError(err.message || 'Stream connection interrupted');
      }
    };

    fetchStream();

    return () => {
      controller.abort();
    };
  },

  // --- Admin Endpoints ---
  async getAdminProviders(): Promise<ProviderItem[]> {
    return request<ProviderItem[]>('/api/admin/providers');
  },

  async updateAdminProvider(id: string, updates: Partial<ProviderItem> & { apiKey?: string }): Promise<ProviderItem> {
    return request<ProviderItem>(`/api/admin/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async testAdminProvider(id: string): Promise<{ success: boolean; latencyMs: number; message: string }> {
    return request(`/api/admin/providers/${id}/test`, {
      method: 'POST',
    });
  },

  async fetchProviderModels(id: string): Promise<{ success: boolean; models: ModelItem[]; message: string }> {
    return request(`/api/admin/providers/${id}/fetch-models`, {
      method: 'POST',
    });
  },

  async getAdminModels(): Promise<ModelItem[]> {
    return request<ModelItem[]>('/api/admin/models');
  },

  async updateAdminModel(id: string, updates: Partial<ModelItem>): Promise<ModelItem> {
    return request<ModelItem>(`/api/admin/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async getFairUsage(): Promise<FairUsageSettings> {
    return request<FairUsageSettings>('/api/admin/fair-usage');
  },

  async updateFairUsage(settings: Partial<FairUsageSettings>): Promise<FairUsageSettings> {
    return request<FairUsageSettings>('/api/admin/fair-usage', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  async getAdminUsers(): Promise<User[]> {
    return request<User[]>('/api/admin/users');
  },

  async toggleSuspendUser(id: string): Promise<{ id: string; suspended: boolean; message: string }> {
    return request(`/api/admin/users/${id}/suspend`, {
      method: 'POST',
    });
  },

  async getAdminStats(): Promise<AdminStats> {
    return request<AdminStats>('/api/admin/stats');
  },

  async getAdminLogs(): Promise<UsageLogItem[]> {
    return request<UsageLogItem[]>('/api/admin/logs');
  },

  async testIdentity(modelId?: string): Promise<{
    results: {
      modelId: string;
      modelName: string;
      providerName: string;
      response?: string;
      latencyMs: number;
      passed: boolean;
      status: 'success' | 'error';
      error?: string;
    }[];
  }> {
    return request('/api/admin/test-identity', {
      method: 'POST',
      body: JSON.stringify({ modelId }),
    });
  },

  async getAdminKeys(providerId?: string): Promise<ApiKeyItem[]> {
    const query = providerId ? `?providerId=${encodeURIComponent(providerId)}` : '';
    return request<ApiKeyItem[]>(`/api/admin/keys${query}`);
  },

  async addAdminKey(data: {
    providerId: string;
    label: string;
    apiKey: string;
    isEnabled?: boolean;
  }): Promise<ApiKeyItem> {
    return request<ApiKeyItem>('/api/admin/keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAdminKey(
    keyId: string,
    data: { label?: string; isEnabled?: boolean; isActive?: boolean; apiKey?: string }
  ): Promise<ApiKeyItem> {
    return request<ApiKeyItem>(`/api/admin/keys/${keyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAdminKey(keyId: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/admin/keys/${keyId}`, {
      method: 'DELETE',
    });
  },

  async activateAdminKey(keyId: string): Promise<ApiKeyItem> {
    return request<ApiKeyItem>(`/api/admin/keys/${keyId}/activate`, {
      method: 'POST',
    });
  },

  async testAdminKey(keyId: string): Promise<{
    success: boolean;
    latencyMs: number;
    message: string;
    quotaExceeded?: boolean;
    status: 'healthy' | 'quota_exceeded' | 'error';
  }> {
    return request(`/api/admin/keys/${keyId}/test`, {
      method: 'POST',
    });
  },

  async testRawAdminKey(providerId: string, apiKey: string): Promise<{
    success: boolean;
    latencyMs: number;
    message: string;
    quotaExceeded?: boolean;
  }> {
    return request('/api/admin/keys/test-raw', {
      method: 'POST',
      body: JSON.stringify({ providerId, apiKey }),
    });
  },
};

