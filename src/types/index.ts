export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  requestsToday: number;
  tokensToday: number;
  totalRequests: number;
  totalTokens: number;
  suspended?: boolean;
  createdAt?: string;
  lastActive?: string;
}

export interface ProviderItem {
  id: string;
  name: string;
  baseUrl: string;
  hasKey: boolean;
  maskedKey?: string;
  isEnabled: boolean;
  isDefault: boolean;
  lastTested?: string | null;
  status: 'online' | 'unconfigured' | 'error' | 'testing';
  lastError?: string | null;
  latencyMs?: number | null;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  category: 'image' | 'document' | 'code';
  dataUrl?: string;
  extractedText?: string;
}

export interface ModelItem {
  id: string;
  providerId: string;
  name: string;
  providerName?: string;
  providerLabel?: string;
  actualModelId?: string;
  isDefault: boolean;
  enabledForUsers: boolean;
  isFree: boolean;
  contextWindow: number;
  verified: boolean;
  pricingNote?: string;
  description: string;
  isAvailable?: boolean;
  availabilityReason?: string;
  sortOrder?: number;
  supportsVision?: boolean;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId?: string;
  tokensEstimated?: number;
  createdAt: string;
  attachments?: Attachment[];
}

export interface FairUsageSettings {
  maxRequestsPerMinute: number;
  dailyUserMessageLimit: number;
  dailyUserTokenCap: number;
  enforceLimits: boolean;
  maintenanceMode: boolean;
  systemAnnouncement?: string;
  customSystemPrompt?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalRequests: number;
  totalTokens: number;
  errorCount: number;
  errorRate: string;
  avgLatencyMs: number;
  activeModelsCount: number;
  onlineProvidersCount: number;
}

export interface UsageLogItem {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  providerId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
}

export interface ApiKeyItem {
  id: string;
  providerId: string;
  label: string;
  maskedKey: string;
  isEnabled: boolean;
  isActive: boolean;
  requestCount: number;
  lastUsedAt?: string | null;
  lastTestedAt?: string | null;
  status: 'active' | 'quota_exceeded' | 'rate_limited' | 'error' | 'untested' | 'healthy';
  lastError?: string | null;
  latencyMs?: number | null;
  createdAt: string;
}

