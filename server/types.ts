export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  encryptedApiKey?: string;
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

export interface ModelConfig {
  id: string;
  providerId: string;
  name: string;
  providerLabel?: string;
  actualModelId?: string;
  isDefault: boolean;
  enabledForUsers: boolean;
  isFree: boolean;
  contextWindow: number;
  verified: boolean;
  pricingNote?: string;
  description: string;
  availabilityReason?: string;
  sortOrder?: number;
  supportsVision?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  passwordHash: string;
  salt: string;
  suspended: boolean;
  createdAt: string;
  totalRequests: number;
  totalTokens: number;
  requestsToday: number;
  tokensToday: number;
  lastActive: string;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
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

export interface FairUsageConfig {
  maxRequestsPerMinute: number;
  dailyUserMessageLimit: number;
  dailyUserTokenCap: number;
  enforceLimits: boolean;
  maintenanceMode: boolean;
  systemAnnouncement?: string;
  customSystemPrompt?: string;
}

export interface UsageLog {
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
  ip?: string;
}

export interface ApiKeyRecord {
  id: string;
  providerId: string;
  label: string;
  maskedKey: string;
  encryptedKey: string;
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

export type MaskedApiKeyRecord = Omit<ApiKeyRecord, 'encryptedKey'>;

export interface DatabaseState {
  providers: Record<string, ProviderConfig & { encryptedApiKey?: string }>;
  apiKeys: ApiKeyRecord[];
  models: ModelConfig[];
  users: User[];
  sessions: Session[];
  conversations: Conversation[];
  messages: Message[];
  fairUsage: FairUsageConfig;
  logs: UsageLog[];
}

