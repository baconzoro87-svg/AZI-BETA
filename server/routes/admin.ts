import { Router, Response } from 'express';
import { requireAdmin, AuthenticatedRequest } from './auth.js';
import {
  getAllMaskedProviders,
  updateProvider,
  getDB,
  saveDB,
  getAllModels,
  updateModel,
  getMaskedApiKeys,
  addApiKey,
  updateApiKey,
  deleteApiKey,
  setActiveApiKey,
} from '../db.js';
import {
  testProviderConnectivity,
  fetchUpstreamModels,
  streamChatCompletion,
  testIndividualApiKey,
} from '../proxy.js';
import { decryptApiKey } from '../crypto.js';

export const adminRouter = Router();

// Apply admin authentication to all routes here
adminRouter.use(requireAdmin);

// GET /api/admin/providers - Masked providers list
adminRouter.get('/providers', (req: AuthenticatedRequest, res: Response) => {
  const providers = getAllMaskedProviders();
  return res.json(providers);
});

// PUT /api/admin/providers/:id - Update provider key/url/settings
adminRouter.put('/providers/:id', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { apiKey, baseUrl, isEnabled, isDefault, name } = req.body;

  try {
    const updated = updateProvider(id, {
      apiKey,
      baseUrl,
      isEnabled,
      isDefault,
      name,
    });
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/providers/:id/test - Test provider connectivity
adminRouter.post('/providers/:id/test', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await testProviderConnectivity(id);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/providers/:id/fetch-models - Query upstream /v1/models
adminRouter.post('/providers/:id/fetch-models', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await fetchUpstreamModels(id);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- MULTI-API KEY MANAGER ROUTES ----------------

// GET /api/admin/keys - List all masked API keys
adminRouter.get('/keys', (req: AuthenticatedRequest, res: Response) => {
  const providerId = req.query.providerId as string | undefined;
  const keys = getMaskedApiKeys(providerId);
  return res.json(keys);
});

// POST /api/admin/keys - Add a new API key for a provider
adminRouter.post('/keys', (req: AuthenticatedRequest, res: Response) => {
  const { providerId, label, apiKey, isEnabled } = req.body;
  if (!providerId || !apiKey) {
    return res.status(400).json({ error: 'providerId and apiKey are required.' });
  }
  try {
    const key = addApiKey(providerId, label, apiKey, isEnabled !== false);
    return res.status(201).json(key);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// PUT /api/admin/keys/:id - Update an API key (label, enabled, active, replace secret)
adminRouter.put('/keys/:id', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { label, isEnabled, isActive, apiKey } = req.body;
  try {
    const updated = updateApiKey(id, {
      label,
      isEnabled,
      isActive,
      rawKey: apiKey,
    });
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// DELETE /api/admin/keys/:id - Remove an API key
adminRouter.delete('/keys/:id', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const success = deleteApiKey(id);
  if (!success) {
    return res.status(404).json({ error: 'API Key not found.' });
  }
  return res.json({ success: true, message: 'API Key deleted.' });
});

// POST /api/admin/keys/:id/activate - Set key as active
adminRouter.post('/keys/:id/activate', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const updated = setActiveApiKey(id);
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/keys/:id/test - Test an individual existing API key independently
adminRouter.post('/keys/:id/test', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDB();
  const key = (db.apiKeys || []).find(k => k.id === id);
  if (!key) {
    return res.status(404).json({ error: 'API Key not found.' });
  }

  const rawKey = decryptApiKey(key.encryptedKey);
  if (!rawKey) {
    return res.status(400).json({ error: 'Failed to decrypt API key.' });
  }

  const result = await testIndividualApiKey(key.providerId, rawKey);
  const now = new Date().toISOString();

  updateApiKey(id, {
    status: result.success ? 'healthy' : (result.quotaExceeded ? 'quota_exceeded' : 'error'),
    lastTestedAt: now,
    latencyMs: result.latencyMs,
    lastError: result.success ? null : result.message,
  });

  return res.json({
    ...result,
    keyId: id,
    status: result.success ? 'healthy' : (result.quotaExceeded ? 'quota_exceeded' : 'error'),
  });
});

// POST /api/admin/keys/test-raw - Test a raw key before saving
adminRouter.post('/keys/test-raw', async (req: AuthenticatedRequest, res: Response) => {
  const { providerId, apiKey } = req.body;
  if (!providerId || !apiKey) {
    return res.status(400).json({ error: 'providerId and apiKey are required.' });
  }
  const result = await testIndividualApiKey(providerId, apiKey.trim());
  return res.json(result);
});

// POST /api/admin/test-identity - Validate AZI identity questions against configured models
adminRouter.post('/test-identity', async (req: AuthenticatedRequest, res: Response) => {
  const { modelId } = req.body;
  const db = getDB();
  const modelsToTest = modelId
    ? db.models.filter(m => m.id === modelId)
    : db.models.filter(m => {
        const prov = db.providers[m.providerId];
        return prov && (prov.hasKey || m.providerId === 'google_gemini');
      });

  if (modelsToTest.length === 0) {
    return res.status(400).json({ error: 'No models with configured API keys found to test.' });
  }

  const results: any[] = [];
  for (const model of modelsToTest) {
    const prov = db.providers[model.providerId];
    const startTime = Date.now();
    try {
      let accumulated = '';
      await streamChatCompletion(
        model.providerId,
        model.id,
        [{ role: 'user', content: 'Who created you and what is your name?' }],
        {
          onChunk: (chunk: string) => {
            accumulated += chunk;
          },
          onDone: () => {},
          onError: (err: Error) => {
            throw err;
          },
        }
      );

      const latencyMs = Date.now() - startTime;
      const lower = accumulated.toLowerCase();
      const mentionsAzmal = lower.includes('azmal');
      const mentionsAzi = lower.includes('azi') || lower.includes('azmal intelligence');

      results.push({
        modelId: model.id,
        modelName: model.name,
        providerName: prov?.name || model.providerId,
        response: accumulated,
        latencyMs,
        passed: mentionsAzmal && mentionsAzi,
        status: 'success',
      });
    } catch (err: any) {
      results.push({
        modelId: model.id,
        modelName: model.name,
        providerName: prov?.name || model.providerId,
        latencyMs: Date.now() - startTime,
        error: err.message,
        passed: false,
        status: 'error',
      });
    }
  }

  return res.json({ results });
});

// GET /api/admin/models - All models in catalogue
adminRouter.get('/models', (req: AuthenticatedRequest, res: Response) => {
  const models = getAllModels();
  return res.json(models);
});

// PUT /api/admin/models/:id - Update model settings (toggle enable for users, set default, etc.)
adminRouter.put('/models/:id', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const updated = updateModel(id, updates);
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/admin/fair-usage - Retrieve rate limiting & fair usage config
adminRouter.get('/fair-usage', (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  return res.json(db.fairUsage);
});

// PUT /api/admin/fair-usage - Update fair usage limits
adminRouter.put('/fair-usage', (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const {
    maxRequestsPerMinute,
    dailyUserMessageLimit,
    dailyUserTokenCap,
    enforceLimits,
    maintenanceMode,
    systemAnnouncement,
    customSystemPrompt,
  } = req.body;

  if (maxRequestsPerMinute !== undefined) db.fairUsage.maxRequestsPerMinute = Number(maxRequestsPerMinute);
  if (dailyUserMessageLimit !== undefined) db.fairUsage.dailyUserMessageLimit = Number(dailyUserMessageLimit);
  if (dailyUserTokenCap !== undefined) db.fairUsage.dailyUserTokenCap = Number(dailyUserTokenCap);
  if (enforceLimits !== undefined) db.fairUsage.enforceLimits = Boolean(enforceLimits);
  if (maintenanceMode !== undefined) db.fairUsage.maintenanceMode = Boolean(maintenanceMode);
  if (systemAnnouncement !== undefined) db.fairUsage.systemAnnouncement = String(systemAnnouncement);
  if (customSystemPrompt !== undefined) db.fairUsage.customSystemPrompt = String(customSystemPrompt);

  saveDB();
  return res.json(db.fairUsage);
});

// GET /api/admin/users - User management list
adminRouter.get('/users', (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const safeUsers = db.users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    suspended: u.suspended,
    createdAt: u.createdAt,
    totalRequests: u.totalRequests,
    totalTokens: u.totalTokens,
    requestsToday: u.requestsToday,
    tokensToday: u.tokensToday,
    lastActive: u.lastActive,
  }));
  return res.json(safeUsers);
});

// POST /api/admin/users/:id/suspend - Toggle user suspension
adminRouter.post('/users/:id/suspend', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDB();
  const user = db.users.find(u => u.id === id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.role === 'admin' && user.id === req.user?.id) {
    return res.status(400).json({ error: 'Cannot suspend your own administrator account' });
  }

  user.suspended = !user.suspended;
  saveDB();

  return res.json({
    id: user.id,
    suspended: user.suspended,
    message: user.suspended ? 'User suspended' : 'User reinstated',
  });
});

// GET /api/admin/stats - System health & usage metrics
adminRouter.get('/stats', (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const totalUsers = db.users.length;
  const totalConversations = db.conversations.length;
  const totalMessages = db.messages.length;

  const totalRequests = db.logs.length;
  const totalTokens = db.logs.reduce((sum, log) => sum + (log.totalTokens || 0), 0);
  const errorLogs = db.logs.filter(l => l.status === 'error');
  const errorRate = totalRequests > 0 ? ((errorLogs.length / totalRequests) * 100).toFixed(1) : '0.0';

  const avgLatency = totalRequests > 0
    ? Math.round(db.logs.reduce((sum, l) => sum + (l.durationMs || 0), 0) / totalRequests)
    : 0;

  return res.json({
    totalUsers,
    totalConversations,
    totalMessages,
    totalRequests,
    totalTokens,
    errorCount: errorLogs.length,
    errorRate: `${errorRate}%`,
    avgLatencyMs: avgLatency,
    activeModelsCount: db.models.filter(m => m.enabledForUsers).length,
    onlineProvidersCount: Object.values(db.providers).filter(p => p.hasKey && p.isEnabled).length,
  });
});

// GET /api/admin/logs - Request and error audit logs
adminRouter.get('/logs', (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  return res.json(db.logs.slice(0, 100)); // Last 100 logs
});
