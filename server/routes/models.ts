import { Router, Request, Response } from 'express';
import { getEnabledModelsForUsers, getAllModels, getDB, getDefaultModel } from '../db.js';

export const modelsRouter = Router();

// GET /api/models - Returns models enabled for general users
modelsRouter.get('/', (req: Request, res: Response) => {
  const models = getEnabledModelsForUsers();
  const db = getDB();
  const defaultModel = getDefaultModel();

  // Attach safe provider metadata and availability state
  const modelsWithProviderInfo = models.map(m => {
    const provider = db.providers[m.providerId];
    const hasKey = !!provider?.hasKey || (m.providerId === 'google_gemini' && !!process.env.GEMINI_API_KEY);
    const isEnabled = !!provider?.isEnabled;

    let isAvailable = hasKey && isEnabled;
    let availabilityReason = 'Online & ready';

    if (!hasKey) {
      isAvailable = false;
      availabilityReason = `Owner API key required for ${provider?.name || m.providerId}`;
    } else if (!isEnabled) {
      isAvailable = false;
      availabilityReason = `Provider ${provider?.name || m.providerId} is currently disabled`;
    } else if (provider?.status === 'error') {
      isAvailable = false;
      availabilityReason = provider?.lastError || 'Upstream provider connection error';
    }

    const providerLabel =
      m.providerLabel ||
      (m.providerId === 'codecraft'
        ? 'Provider C — CodeCraft'
        : m.providerId === 'token_harbour'
        ? 'Provider T — Token Harbour'
        : provider?.name || m.providerId);

    return {
      id: m.id,
      actualModelId: m.actualModelId || m.id,
      name: m.name,
      providerId: m.providerId,
      providerName: provider?.name || m.providerId,
      providerLabel,
      isDefault: m.id === (defaultModel?.id || 'deepseek-v4.1-flash:free') || m.id === 'deepseek-v4.1-flash:free',
      isFree: m.isFree,
      contextWindow: m.contextWindow,
      verified: m.verified,
      pricingNote: m.pricingNote || (m.isFree ? 'Verified Free Tier' : 'Paid Tier'),
      description: m.description,
      isAvailable,
      availabilityReason,
      sortOrder: m.sortOrder || 99,
      supportsVision: m.supportsVision ?? (m.id.includes('opus') || m.id.includes('luna') || m.id.includes('gemini')),
    };
  });

  // Sort strictly by sortOrder
  modelsWithProviderInfo.sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));

  return res.json({
    models: modelsWithProviderInfo,
    defaultModelId: 'deepseek-v4.1-flash:free',
    systemStatus: {
      maintenanceMode: db.fairUsage.maintenanceMode,
      announcement: db.fairUsage.systemAnnouncement,
    }
  });
});
