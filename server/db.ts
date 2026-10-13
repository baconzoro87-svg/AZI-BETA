import fs from 'fs';
import path from 'path';
import {
  DatabaseState,
  ProviderConfig,
  ModelConfig,
  User,
  Session,
  Conversation,
  Message,
  FairUsageConfig,
  UsageLog,
  ApiKeyRecord,
  MaskedApiKeyRecord,
} from './types.js';
import { encryptApiKey, decryptApiKey, hashPassword, maskKey } from './crypto.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'azi_store.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db: DatabaseState;

function getInitialState(): DatabaseState {
  const adminHash = hashPassword(process.env.ADMIN_INITIAL_PASSWORD || 'admin12345');
  const userHash = hashPassword('user12345');

  const envTokenHarbourKey = process.env.TOKEN_HARBOUR_API_KEY || '';
  const envCodeCraftKey = process.env.CODECRAFT_API_KEY || '';
  const envGeminiKey = process.env.GEMINI_API_KEY || '';

  const initialProviders: Record<string, ProviderConfig & { encryptedApiKey?: string }> = {
    token_harbour: {
      id: 'token_harbour',
      name: 'Token Harbour',
      baseUrl: process.env.TOKEN_HARBOUR_BASE_URL || 'https://tokenharbor.ai/v1',
      encryptedApiKey: envTokenHarbourKey ? encryptApiKey(envTokenHarbourKey) : '',
      hasKey: !!envTokenHarbourKey,
      maskedKey: envTokenHarbourKey ? maskKey(envTokenHarbourKey) : '',
      isEnabled: true,
      isDefault: true,
      lastTested: null,
      status: envTokenHarbourKey ? 'online' : 'unconfigured',
      lastError: null,
      latencyMs: null,
    },
    codecraft: {
      id: 'codecraft',
      name: 'CodeCraft API',
      baseUrl: process.env.CODECRAFT_BASE_URL || 'https://www.codecraftapi.com/v1',
      encryptedApiKey: envCodeCraftKey ? encryptApiKey(envCodeCraftKey) : '',
      hasKey: !!envCodeCraftKey,
      maskedKey: envCodeCraftKey ? maskKey(envCodeCraftKey) : '',
      isEnabled: true,
      isDefault: false,
      lastTested: null,
      status: envCodeCraftKey ? 'online' : 'unconfigured',
      lastError: null,
      latencyMs: null,
    },
    google_gemini: {
      id: 'google_gemini',
      name: 'Google Gemini (Built-in Server)',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      encryptedApiKey: envGeminiKey ? encryptApiKey(envGeminiKey) : '',
      hasKey: !!envGeminiKey,
      maskedKey: envGeminiKey ? maskKey(envGeminiKey) : '',
      isEnabled: !!envGeminiKey,
      isDefault: false,
      lastTested: null,
      status: envGeminiKey ? 'online' : 'unconfigured',
      lastError: null,
      latencyMs: null,
    }
  };

  const initialModels: ModelConfig[] = [
    {
      id: 'opus-5.5',
      actualModelId: 'claude-opus-5.5',
      providerId: 'codecraft',
      providerLabel: 'Provider C — CodeCraft',
      name: 'Opus 5.5',
      isDefault: false,
      enabledForUsers: true,
      isFree: false,
      contextWindow: 200000,
      verified: true,
      pricingNote: 'Paid Enterprise Tier (CodeCraft)',
      description: 'Flagship deep reasoning architecture on CodeCraft for complex analysis and architecture.',
      sortOrder: 1,
      supportsVision: true,
    },
    {
      id: 'fable-5.1',
      actualModelId: 'fable-5.1',
      providerId: 'codecraft',
      providerLabel: 'Provider C — CodeCraft',
      name: 'Fable 5.1',
      isDefault: false,
      enabledForUsers: true,
      isFree: false,
      contextWindow: 128000,
      verified: true,
      pricingNote: 'Paid Tier (CodeCraft)',
      description: 'High-fidelity synthesis, narrative generation, and nuanced creative reasoning on CodeCraft.',
      sortOrder: 2,
      supportsVision: false,
    },
    {
      id: 'luna-5.6',
      actualModelId: 'luna-5.6',
      providerId: 'codecraft',
      providerLabel: 'Provider C — CodeCraft',
      name: 'Luna 5.6',
      isDefault: false,
      enabledForUsers: true,
      isFree: false,
      contextWindow: 128000,
      verified: true,
      pricingNote: 'Paid Tier (CodeCraft)',
      description: 'Ultra-fast multimodal reasoning and code comprehension on CodeCraft.',
      sortOrder: 3,
      supportsVision: true,
    },
    {
      id: 'deepseek-v4.1-flash:free',
      actualModelId: 'deepseek-v4.1-flash:free',
      providerId: 'token_harbour',
      providerLabel: 'Provider T — Token Harbour',
      name: 'DeepSeek V4.1 Flash',
      isDefault: true,
      enabledForUsers: true,
      isFree: true,
      contextWindow: 64000,
      verified: true,
      pricingNote: 'Verified Free Tier on Token Harbour',
      description: 'High-speed reasoning model with verified free quota on Token Harbour.',
      sortOrder: 4,
      supportsVision: false,
    },
    {
      id: 'mimo-2.6-flash:free',
      actualModelId: 'mimo-2.6-flash:free',
      providerId: 'token_harbour',
      providerLabel: 'Provider T — Token Harbour',
      name: 'MiMo 2.6 Flash',
      isDefault: false,
      enabledForUsers: true,
      isFree: true,
      contextWindow: 64000,
      verified: true,
      pricingNote: 'Verified Free Tier on Token Harbour',
      description: 'Lightweight, ultra-low latency model with verified free quota on Token Harbour.',
      sortOrder: 5,
      supportsVision: false,
    },
    {
      id: 'gemini-2.5-flash',
      actualModelId: 'gemini-2.5-flash',
      providerId: 'google_gemini',
      providerLabel: 'Built-in Server Engine',
      name: 'Gemini 2.5 Flash',
      isDefault: false,
      enabledForUsers: true,
      isFree: true,
      contextWindow: 1000000,
      verified: true,
      pricingNote: 'Built-in Server Engine',
      description: 'Ultra-fast multimodal reasoning with 1M token context window.',
      sortOrder: 6,
      supportsVision: true,
    }
  ];

  const now = new Date().toISOString();

  const initialUsers: User[] = [
    {
      id: 'usr_owner_admin',
      email: process.env.ADMIN_EMAIL || 'admin@azi.internal',
      name: 'Azmal (AZI Owner)',
      role: 'admin',
      passwordHash: adminHash.hash,
      salt: adminHash.salt,
      suspended: false,
      createdAt: now,
      totalRequests: 0,
      totalTokens: 0,
      requestsToday: 0,
      tokensToday: 0,
      lastActive: now,
    },
    {
      id: 'usr_owner_direct',
      email: 'paisehepaisehoyga@gmail.com',
      name: 'Owner Admin',
      role: 'admin',
      passwordHash: adminHash.hash,
      salt: adminHash.salt,
      suspended: false,
      createdAt: now,
      totalRequests: 0,
      totalTokens: 0,
      requestsToday: 0,
      tokensToday: 0,
      lastActive: now,
    },
    {
      id: 'usr_friend_demo',
      email: 'friend@azi.internal',
      name: 'Guest / Friend',
      role: 'user',
      passwordHash: userHash.hash,
      salt: userHash.salt,
      suspended: false,
      createdAt: now,
      totalRequests: 0,
      totalTokens: 0,
      requestsToday: 0,
      tokensToday: 0,
      lastActive: now,
    }
  ];

  const initialFairUsage: FairUsageConfig = {
    maxRequestsPerMinute: 20,
    dailyUserMessageLimit: 120,
    dailyUserTokenCap: 300000,
    enforceLimits: true,
    maintenanceMode: false,
    systemAnnouncement: 'Welcome to AZI Central API. Infrastructure managed by Owner.'
  };

  const initialApiKeys: ApiKeyRecord[] = [];
  if (envTokenHarbourKey) {
    initialApiKeys.push({
      id: `key_th_${Date.now()}_1`,
      providerId: 'token_harbour',
      label: 'Token Harbour Key 1 (Primary)',
      maskedKey: maskKey(envTokenHarbourKey),
      encryptedKey: encryptApiKey(envTokenHarbourKey),
      isEnabled: true,
      isActive: true,
      requestCount: 0,
      lastUsedAt: null,
      lastTestedAt: null,
      status: 'healthy',
      lastError: null,
      latencyMs: null,
      createdAt: now,
    });
  }
  if (envCodeCraftKey) {
    initialApiKeys.push({
      id: `key_cc_${Date.now()}_1`,
      providerId: 'codecraft',
      label: 'CodeCraft Key 1 (Primary)',
      maskedKey: maskKey(envCodeCraftKey),
      encryptedKey: encryptApiKey(envCodeCraftKey),
      isEnabled: true,
      isActive: true,
      requestCount: 0,
      lastUsedAt: null,
      lastTestedAt: null,
      status: 'healthy',
      lastError: null,
      latencyMs: null,
      createdAt: now,
    });
  }

  return {
    providers: initialProviders,
    apiKeys: initialApiKeys,
    models: initialModels,
    users: initialUsers,
    sessions: [],
    conversations: [],
    messages: [],
    fairUsage: initialFairUsage,
    logs: [],
  };
}

// Load DB from disk or initialize
export function initDB(): DatabaseState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(raw);
      // Ensure missing keys or new fields are merged cleanly
      const initial = getInitialState();
      if (!db.providers) db.providers = initial.providers;
      if (!db.apiKeys) db.apiKeys = [];
      // Auto-migrate existing provider keys if apiKeys has none
      for (const p of Object.values(db.providers)) {
        if (p.encryptedApiKey && !db.apiKeys.some(k => k.providerId === p.id)) {
          const rawKey = decryptApiKey(p.encryptedApiKey);
          if (rawKey) {
            db.apiKeys.push({
              id: `key_${p.id}_${Date.now()}_migrated`,
              providerId: p.id,
              label: `${p.name} Key 1 (Primary)`,
              maskedKey: p.maskedKey || maskKey(rawKey),
              encryptedKey: p.encryptedApiKey,
              isEnabled: true,
              isActive: true,
              requestCount: 0,
              lastUsedAt: null,
              lastTestedAt: p.lastTested || null,
              status: p.status === 'online' ? 'healthy' : 'untested',
              lastError: p.lastError || null,
              latencyMs: p.latencyMs || null,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
      if (!db.models) {
        db.models = initial.models;
      } else {
        // Sync preferred models into db.models
        for (const pref of initial.models) {
          const idx = db.models.findIndex(m => m.id === pref.id || (pref.actualModelId && m.id === pref.actualModelId) || m.name === pref.name);
          if (idx >= 0) {
            db.models[idx] = {
              ...db.models[idx],
              ...pref,
              enabledForUsers: db.models[idx].enabledForUsers !== undefined ? db.models[idx].enabledForUsers : true,
            };
          } else {
            db.models.push(pref);
          }
        }
        db.models.sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
      }
      if (!db.users) db.users = initial.users;
      if (!db.fairUsage) db.fairUsage = initial.fairUsage;
      if (!db.logs) db.logs = [];
      if (!db.conversations) db.conversations = [];
      if (!db.messages) db.messages = [];
      if (!db.sessions) db.sessions = [];
      saveDB();
    } else {
      db = getInitialState();
      saveDB();
    }
  } catch (err) {
    console.error('Error loading DB file, reinitializing:', err);
    db = getInitialState();
    saveDB();
  }
  return db;
}

export function saveDB(): void {
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to save DB file atomically:', err);
  }
}

export function getDB(): DatabaseState {
  if (!db) {
    return initDB();
  }
  return db;
}

// ---------------- USER & AUTH HELPERS ----------------

export function findUserByEmail(email: string): User | undefined {
  const current = getDB();
  return current.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): User | undefined {
  const current = getDB();
  return current.users.find(u => u.id === id);
}

export function createUser(email: string, password: string, name: string, role: 'admin' | 'user' = 'user'): User {
  const current = getDB();
  const existing = findUserByEmail(email);
  if (existing) {
    throw new Error('User with this email already exists.');
  }

  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();
  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: email.toLowerCase(),
    name: name || email.split('@')[0],
    role,
    passwordHash: hash,
    salt,
    suspended: false,
    createdAt: now,
    totalRequests: 0,
    totalTokens: 0,
    requestsToday: 0,
    tokensToday: 0,
    lastActive: now,
  };

  current.users.push(newUser);
  saveDB();
  return newUser;
}

export function createSession(userId: string): Session {
  const current = getDB();
  const token = `azi_sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session: Session = {
    token,
    userId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  current.sessions.push(session);
  saveDB();
  return session;
}

export function findSession(token: string): { session: Session; user: User } | null {
  const current = getDB();
  const session = current.sessions.find(s => s.token === token);
  if (!session) return null;

  if (new Date(session.expiresAt) < new Date()) {
    // expired session cleanup
    current.sessions = current.sessions.filter(s => s.token !== token);
    saveDB();
    return null;
  }

  const user = current.users.find(u => u.id === session.userId);
  if (!user || user.suspended) return null;

  return { session, user };
}

export function deleteSession(token: string): void {
  const current = getDB();
  current.sessions = current.sessions.filter(s => s.token !== token);
  saveDB();
}

// ---------------- PROVIDER HELPERS ----------------

export function getProviderRaw(providerId: string): (ProviderConfig & { encryptedApiKey?: string }) | undefined {
  const current = getDB();
  return current.providers[providerId];
}

export function getDecryptedProviderKey(providerId: string): string {
  const provider = getProviderRaw(providerId);
  if (!provider) return '';
  if (providerId === 'google_gemini' && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  if (!provider.encryptedApiKey) return '';
  return decryptApiKey(provider.encryptedApiKey);
}

export function updateProvider(
  providerId: string,
  updates: Partial<ProviderConfig> & { apiKey?: string }
): ProviderConfig {
  const current = getDB();
  const provider = current.providers[providerId];
  if (!provider) {
    throw new Error(`Provider ${providerId} not found`);
  }

  if (updates.name !== undefined) provider.name = updates.name;
  if (updates.baseUrl !== undefined) provider.baseUrl = updates.baseUrl.trim().replace(/\/+$/, '');
  if (updates.isEnabled !== undefined) provider.isEnabled = updates.isEnabled;
  if (updates.isDefault !== undefined) {
    if (updates.isDefault) {
      // Unset default from others
      Object.values(current.providers).forEach(p => (p.isDefault = false));
      provider.isDefault = true;
    } else {
      provider.isDefault = false;
    }
  }

  if (updates.apiKey !== undefined) {
    const key = updates.apiKey.trim();
    if (key) {
      provider.encryptedApiKey = encryptApiKey(key);
      provider.hasKey = true;
      provider.maskedKey = maskKey(key);
      provider.status = 'online';
      provider.lastError = null;
    } else {
      provider.encryptedApiKey = '';
      provider.hasKey = false;
      provider.maskedKey = '';
      provider.status = 'unconfigured';
    }
  }

  if (updates.status !== undefined) provider.status = updates.status;
  if (updates.lastError !== undefined) provider.lastError = updates.lastError;
  if (updates.lastTested !== undefined) provider.lastTested = updates.lastTested;
  if (updates.latencyMs !== undefined) provider.latencyMs = updates.latencyMs;

  saveDB();
  return getMaskedProvider(provider);
}

export function getMaskedProvider(p: ProviderConfig & { encryptedApiKey?: string }): ProviderConfig {
  const hasMultiKey = (db?.apiKeys || []).some(k => k.providerId === p.id && k.isEnabled);
  return {
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    hasKey: !!p.encryptedApiKey || hasMultiKey || (p.id === 'google_gemini' && !!process.env.GEMINI_API_KEY),
    maskedKey: p.maskedKey || (p.encryptedApiKey ? '••••••••' : ''),
    isEnabled: p.isEnabled,
    isDefault: p.isDefault,
    lastTested: p.lastTested,
    status: p.status,
    lastError: p.lastError,
    latencyMs: p.latencyMs,
  };
}

export function getAllMaskedProviders(): ProviderConfig[] {
  const current = getDB();
  return Object.values(current.providers).map(getMaskedProvider);
}

// ---------------- MULTI-API KEY & FAILOVER HELPERS ----------------

export function getMaskedApiKeys(providerId?: string): MaskedApiKeyRecord[] {
  const current = getDB();
  const list = providerId ? (current.apiKeys || []).filter(k => k.providerId === providerId) : (current.apiKeys || []);
  return list.map(({ encryptedKey, ...rest }) => rest);
}

export function addApiKey(
  providerId: string,
  label: string,
  rawKey: string,
  isEnabled: boolean = true
): MaskedApiKeyRecord {
  const current = getDB();
  const trimmed = rawKey.trim();
  if (!trimmed) throw new Error('API Key cannot be empty.');

  const provider = current.providers[providerId];
  if (!provider) throw new Error(`Provider "${providerId}" not found.`);

  if (!current.apiKeys) current.apiKeys = [];
  const existingForProvider = current.apiKeys.filter(k => k.providerId === providerId);
  const isActive = existingForProvider.length === 0;

  const newKey: ApiKeyRecord = {
    id: `key_${providerId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    providerId,
    label: label.trim() || `${provider.name} Key ${existingForProvider.length + 1}`,
    maskedKey: maskKey(trimmed),
    encryptedKey: encryptApiKey(trimmed),
    isEnabled,
    isActive,
    requestCount: 0,
    lastUsedAt: null,
    lastTestedAt: null,
    status: 'untested',
    lastError: null,
    latencyMs: null,
    createdAt: new Date().toISOString(),
  };

  current.apiKeys.push(newKey);
  provider.hasKey = true;
  if (isActive) {
    provider.encryptedApiKey = newKey.encryptedKey;
    provider.maskedKey = newKey.maskedKey;
    provider.status = 'online';
  }

  saveDB();
  const { encryptedKey, ...masked } = newKey;
  return masked;
}

export function updateApiKey(
  keyId: string,
  updates: {
    label?: string;
    isEnabled?: boolean;
    isActive?: boolean;
    rawKey?: string;
    status?: 'active' | 'quota_exceeded' | 'rate_limited' | 'error' | 'untested' | 'healthy';
    lastError?: string | null;
    latencyMs?: number | null;
    lastTestedAt?: string | null;
  }
): MaskedApiKeyRecord {
  const current = getDB();
  if (!current.apiKeys) current.apiKeys = [];
  const key = current.apiKeys.find(k => k.id === keyId);
  if (!key) throw new Error(`API Key "${keyId}" not found.`);

  if (updates.label !== undefined && updates.label.trim()) {
    key.label = updates.label.trim();
  }
  if (updates.isEnabled !== undefined) {
    key.isEnabled = updates.isEnabled;
  }
  if (updates.status !== undefined) {
    key.status = updates.status;
  }
  if (updates.lastError !== undefined) {
    key.lastError = updates.lastError;
  }
  if (updates.latencyMs !== undefined) {
    key.latencyMs = updates.latencyMs;
  }
  if (updates.lastTestedAt !== undefined) {
    key.lastTestedAt = updates.lastTestedAt;
  }

  if (updates.rawKey !== undefined && updates.rawKey.trim()) {
    const trimmed = updates.rawKey.trim();
    key.encryptedKey = encryptApiKey(trimmed);
    key.maskedKey = maskKey(trimmed);
    key.status = 'untested';
    key.lastError = null;
  }

  if (updates.isActive) {
    current.apiKeys.forEach(k => {
      if (k.providerId === key.providerId) {
        k.isActive = (k.id === key.id);
      }
    });
    const provider = current.providers[key.providerId];
    if (provider) {
      provider.encryptedApiKey = key.encryptedKey;
      provider.maskedKey = key.maskedKey;
      provider.hasKey = true;
      provider.status = 'online';
    }
  }

  saveDB();
  const { encryptedKey, ...masked } = key;
  return masked;
}

export function deleteApiKey(keyId: string): boolean {
  const current = getDB();
  if (!current.apiKeys) return false;
  const idx = current.apiKeys.findIndex(k => k.id === keyId);
  if (idx === -1) return false;

  const deleted = current.apiKeys[idx];
  current.apiKeys.splice(idx, 1);

  if (deleted.isActive) {
    const nextKey = current.apiKeys.find(k => k.providerId === deleted.providerId && k.isEnabled);
    const provider = current.providers[deleted.providerId];
    if (nextKey) {
      nextKey.isActive = true;
      if (provider) {
        provider.encryptedApiKey = nextKey.encryptedKey;
        provider.maskedKey = nextKey.maskedKey;
      }
    } else if (provider) {
      provider.encryptedApiKey = '';
      provider.maskedKey = '';
      provider.hasKey = false;
      provider.status = 'unconfigured';
    }
  }

  saveDB();
  return true;
}

export function setActiveApiKey(keyId: string): MaskedApiKeyRecord {
  return updateApiKey(keyId, { isActive: true, isEnabled: true });
}

export function getEligibleApiKeys(providerId: string): { key: ApiKeyRecord; rawKey: string }[] {
  const current = getDB();
  const keys = (current.apiKeys || []).filter(k => k.providerId === providerId && k.isEnabled);

  keys.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    const score = (s: string) => {
      if (s === 'healthy' || s === 'active') return 0;
      if (s === 'untested') return 1;
      if (s === 'rate_limited') return 2;
      if (s === 'quota_exceeded') return 3;
      return 4;
    };
    return score(a.status) - score(b.status);
  });

  const list: { key: ApiKeyRecord; rawKey: string }[] = [];
  for (const k of keys) {
    const raw = decryptApiKey(k.encryptedKey);
    if (raw) {
      list.push({ key: k, rawKey: raw });
    }
  }

  // Fallback to legacy single key if none found
  if (list.length === 0) {
    const provider = current.providers[providerId];
    if (provider?.encryptedApiKey) {
      const raw = decryptApiKey(provider.encryptedApiKey);
      if (raw) {
        list.push({
          key: {
            id: `legacy_${providerId}`,
            providerId,
            label: `${provider.name} Key 1 (Primary)`,
            maskedKey: provider.maskedKey || maskKey(raw),
            encryptedKey: provider.encryptedApiKey,
            isEnabled: true,
            isActive: true,
            requestCount: 0,
            status: 'healthy',
            createdAt: new Date().toISOString(),
          },
          rawKey: raw,
        });
      }
    }
  }

  return list;
}

export function recordKeySuccess(keyId: string, latencyMs?: number): void {
  const current = getDB();
  if (!current.apiKeys) return;
  const key = current.apiKeys.find(k => k.id === keyId);
  if (key) {
    key.requestCount = (key.requestCount || 0) + 1;
    key.lastUsedAt = new Date().toISOString();
    key.status = 'healthy';
    key.lastError = null;
    if (latencyMs !== undefined) key.latencyMs = latencyMs;
    // Ensure this successful key is marked as active
    if (!key.isActive) {
      current.apiKeys.forEach(k => {
        if (k.providerId === key.providerId) k.isActive = (k.id === key.id);
      });
      const provider = current.providers[key.providerId];
      if (provider) {
        provider.encryptedApiKey = key.encryptedKey;
        provider.maskedKey = key.maskedKey;
        provider.status = 'online';
      }
    }
    saveDB();
  }
}

export function recordKeyFailure(
  keyId: string,
  status: 'quota_exceeded' | 'rate_limited' | 'error',
  errorMsg: string
): void {
  const current = getDB();
  if (!current.apiKeys) return;
  const key = current.apiKeys.find(k => k.id === keyId);
  if (key) {
    key.status = status;
    key.lastError = errorMsg;
    key.lastTestedAt = new Date().toISOString();
    saveDB();
  }
}


// ---------------- MODEL HELPERS ----------------

export function getAllModels(): ModelConfig[] {
  const current = getDB();
  return current.models;
}

export function getEnabledModelsForUsers(): ModelConfig[] {
  const current = getDB();
  return current.models.filter(m => {
    const provider = current.providers[m.providerId];
    return m.enabledForUsers && provider && provider.isEnabled;
  });
}

export function getDefaultModel(): ModelConfig {
  const current = getDB();
  const defaultModel = current.models.find(m => m.isDefault && m.enabledForUsers);
  if (defaultModel) return defaultModel;
  const anyEnabled = current.models.find(m => m.enabledForUsers);
  if (anyEnabled) return anyEnabled;
  return current.models[0];
}

export function updateModel(modelId: string, updates: Partial<ModelConfig>): ModelConfig {
  const current = getDB();
  const modelIndex = current.models.findIndex(m => m.id === modelId);
  if (modelIndex === -1) {
    throw new Error(`Model ${modelId} not found`);
  }

  if (updates.isDefault) {
    // Unset previous defaults
    current.models.forEach(m => (m.isDefault = false));
  }

  current.models[modelIndex] = {
    ...current.models[modelIndex],
    ...updates,
  };

  saveDB();
  return current.models[modelIndex];
}

export function addOrSyncModels(newModels: ModelConfig[]): void {
  const current = getDB();
  newModels.forEach(newModel => {
    const index = current.models.findIndex(m => m.id === newModel.id);
    if (index >= 0) {
      current.models[index] = {
        ...current.models[index],
        verified: newModel.verified,
        contextWindow: newModel.contextWindow || current.models[index].contextWindow,
        pricingNote: newModel.pricingNote || current.models[index].pricingNote,
        description: newModel.description || current.models[index].description,
      };
    } else {
      current.models.push(newModel);
    }
  });
  saveDB();
}

// ---------------- FAIR USAGE & RATE LIMITING ----------------

// In-memory sliding window for requests per minute: userId -> timestamps[]
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimits(user: User): { allowed: boolean; reason?: string } {
  const current = getDB();
  const fair = current.fairUsage;

  if (user.role === 'admin') {
    return { allowed: true };
  }

  if (fair.maintenanceMode) {
    return { allowed: false, reason: 'System is currently undergoing owner maintenance. Please try again shortly.' };
  }

  if (user.suspended) {
    return { allowed: false, reason: 'Your access to AZI has been suspended by the administrator.' };
  }

  if (!fair.enforceLimits) {
    return { allowed: true };
  }

  // Check requests per minute
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  const userTimestamps = (rateLimitMap.get(user.id) || []).filter(t => t > windowStart);
  
  if (userTimestamps.length >= fair.maxRequestsPerMinute) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: Max ${fair.maxRequestsPerMinute} requests per minute. Please pause for a few seconds.`
    };
  }

  // Check daily message limit
  if (user.requestsToday >= fair.dailyUserMessageLimit) {
    return {
      allowed: false,
      reason: `Daily quota reached: You have utilized your daily limit of ${fair.dailyUserMessageLimit} requests. Quota resets at midnight.`
    };
  }

  // Check daily token limit
  if (user.tokensToday >= fair.dailyUserTokenCap) {
    return {
      allowed: false,
      reason: `Daily token limit reached (${fair.dailyUserTokenCap.toLocaleString()} tokens). Please contact the administrator.`
    };
  }

  // Record this hit in window
  userTimestamps.push(now);
  rateLimitMap.set(user.id, userTimestamps);

  return { allowed: true };
}

export function logUsage(log: Omit<UsageLog, 'id' | 'timestamp'>): void {
  const current = getDB();
  const fullLog: UsageLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...log,
  };

  current.logs.unshift(fullLog);
  // Keep last 500 logs to preserve storage
  if (current.logs.length > 500) {
    current.logs = current.logs.slice(0, 500);
  }

  // Update user stats
  const user = current.users.find(u => u.id === log.userId);
  if (user) {
    user.totalRequests += 1;
    user.requestsToday += 1;
    user.totalTokens += log.totalTokens;
    user.tokensToday += log.totalTokens;
    user.lastActive = fullLog.timestamp;
  }

  saveDB();
}
