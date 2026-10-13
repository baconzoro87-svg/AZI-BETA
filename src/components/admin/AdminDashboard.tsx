import React, { useState, useEffect } from 'react';
import {
  ProviderItem,
  ModelItem,
  FairUsageSettings,
  AdminStats,
  UsageLogItem,
  User,
  ApiKeyItem,
} from '../../types';
import { api } from '../../services/api';
import {
  Shield,
  Key,
  Database,
  Cpu,
  Sliders,
  Users,
  FileText,
  Activity,
  Check,
  AlertTriangle,
  RefreshCw,
  Power,
  Zap,
  Clock,
  Server,
  Lock,
  Eye,
  EyeOff,
  Radio,
  ToggleLeft,
  ToggleRight,
  X,
  ExternalLink,
  Search,
  CheckCircle2,
  XCircle,
  BarChart3,
  Sparkles,
  Plus,
  Trash2,
  RotateCw,
} from 'lucide-react';

interface AdminDashboardProps {
  onClose: () => void;
  onRefreshPublicModels: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onClose,
  onRefreshPublicModels,
}) => {
  const [activeTab, setActiveTab] = useState<'api-keys' | 'providers' | 'models' | 'fair-usage' | 'users' | 'logs'>('api-keys');
  
  // Data states
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [fairUsage, setFairUsage] = useState<FairUsageSettings | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<UsageLogItem[]>([]);

  // Key Manager states
  const [keyProviderFilter, setKeyProviderFilter] = useState<'all' | 'token_harbour' | 'codecraft'>('all');
  const [showAddKeyModal, setShowAddKeyModal] = useState(false);
  const [editingKeyItem, setEditingKeyItem] = useState<ApiKeyItem | null>(null);
  const [keyFormProviderId, setKeyFormProviderId] = useState<'token_harbour' | 'codecraft'>('token_harbour');
  const [keyFormLabel, setKeyFormLabel] = useState('');
  const [keyFormSecret, setKeyFormSecret] = useState('');
  const [keyFormShowSecret, setKeyFormShowSecret] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [testingRawKey, setTestingRawKey] = useState(false);
  const [rawKeyTestResult, setRawKeyTestResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [fetchingModelsProviderId, setFetchingModelsProviderId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit provider modal/state
  const [editingProvider, setEditingProvider] = useState<ProviderItem | null>(null);
  const [inputApiKey, setInputApiKey] = useState('');
  const [inputBaseUrl, setInputBaseUrl] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [testingIdentity, setTestingIdentity] = useState(false);
  const [identityTestResults, setIdentityTestResults] = useState<{
    modelId: string;
    modelName: string;
    providerName: string;
    response?: string;
    latencyMs: number;
    passed: boolean;
    status: 'success' | 'error';
    error?: string;
  }[] | null>(null);

  // Search filter for logs
  const [logFilter, setLogFilter] = useState('');

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [provList, keyList, modList, fairConfig, statData, userList, logList] = await Promise.all([
        api.getAdminProviders(),
        api.getAdminKeys(),
        api.getAdminModels(),
        api.getFairUsage(),
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminLogs(),
      ]);

      setProviders(provList);
      setApiKeys(keyList);
      setModels(modList);
      setFairUsage(fairConfig);
      setStats(statData);
      setUsers(userList);
      setLogs(logList);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load admin data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const handleTestProvider = async (id: string) => {
    setTestingProviderId(id);
    setFeedback(null);
    try {
      const res = await api.testAdminProvider(id);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `${res.message} (Latency: ${res.latencyMs}ms)`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: `Test Failed: ${res.message}`,
        });
      }
      // Reload providers
      const updated = await api.getAdminProviders();
      setProviders(updated);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleFetchModels = async (id: string) => {
    setFetchingModelsProviderId(id);
    setFeedback(null);
    try {
      const res = await api.fetchProviderModels(id);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        const [updatedModels, updatedProviders] = await Promise.all([
          api.getAdminModels(),
          api.getAdminProviders(),
        ]);
        setModels(updatedModels);
        setProviders(updatedProviders);
        onRefreshPublicModels();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setFetchingModelsProviderId(null);
    }
  };

  const handleOpenEditProvider = (p: ProviderItem) => {
    setEditingProvider(p);
    setInputBaseUrl(p.baseUrl);
    setInputApiKey('');
    setShowKeyText(false);
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;
    setSavingProvider(true);
    setFeedback(null);

    try {
      await api.updateAdminProvider(editingProvider.id, {
        baseUrl: inputBaseUrl,
        ...(inputApiKey.trim() ? { apiKey: inputApiKey.trim() } : {}),
      });

      setFeedback({
        type: 'success',
        message: `Updated configuration for ${editingProvider.name}. Key encrypted and stored on server.`,
      });

      setEditingProvider(null);
      const updated = await api.getAdminProviders();
      setProviders(updated);
      onRefreshPublicModels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingProvider(false);
    }
  };

  const handleToggleProviderEnabled = async (p: ProviderItem) => {
    try {
      await api.updateAdminProvider(p.id, { isEnabled: !p.isEnabled });
      const updated = await api.getAdminProviders();
      setProviders(updated);
      onRefreshPublicModels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleToggleModelEnabled = async (m: ModelItem) => {
    try {
      await api.updateAdminModel(m.id, { enabledForUsers: !m.enabledForUsers });
      const updated = await api.getAdminModels();
      setModels(updated);
      onRefreshPublicModels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleSetDefaultModel = async (modelId: string) => {
    try {
      await api.updateAdminModel(modelId, { isDefault: true });
      const updated = await api.getAdminModels();
      setModels(updated);
      onRefreshPublicModels();
      setFeedback({ type: 'success', message: `Model ${modelId} is now the default for all chats.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleSaveFairUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fairUsage) return;
    try {
      const updated = await api.updateFairUsage(fairUsage);
      setFairUsage(updated);
      setFeedback({ type: 'success', message: 'Fair usage limits updated successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleTestIdentity = async () => {
    setTestingIdentity(true);
    setFeedback(null);
    try {
      const data = await api.testIdentity();
      setIdentityTestResults(data.results);
      setFeedback({ type: 'success', message: 'AZI Identity validation completed across configured models.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Identity validation test failed' });
    } finally {
      setTestingIdentity(false);
    }
  };

  const handleToggleSuspendUser = async (userId: string) => {
    try {
      const res = await api.toggleSuspendUser(userId);
      setFeedback({ type: 'success', message: res.message });
      const userList = await api.getAdminUsers();
      setUsers(userList);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleOpenAddKey = (preselectedProvider?: 'token_harbour' | 'codecraft') => {
    setEditingKeyItem(null);
    setKeyFormProviderId(preselectedProvider || 'token_harbour');
    setKeyFormLabel('');
    setKeyFormSecret('');
    setKeyFormShowSecret(false);
    setRawKeyTestResult(null);
    setShowAddKeyModal(true);
  };

  const handleOpenEditKey = (keyItem: ApiKeyItem) => {
    setEditingKeyItem(keyItem);
    setKeyFormProviderId(keyItem.providerId as any);
    setKeyFormLabel(keyItem.label);
    setKeyFormSecret('');
    setKeyFormShowSecret(false);
    setRawKeyTestResult(null);
    setShowAddKeyModal(true);
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyFormLabel.trim()) return;
    if (!editingKeyItem && !keyFormSecret.trim()) return;

    setSavingKey(true);
    setFeedback(null);
    try {
      if (editingKeyItem) {
        await api.updateAdminKey(editingKeyItem.id, {
          label: keyFormLabel.trim(),
          ...(keyFormSecret.trim() ? { apiKey: keyFormSecret.trim() } : {}),
        });
        setFeedback({ type: 'success', message: `Updated API key "${keyFormLabel}".` });
      } else {
        await api.addAdminKey({
          providerId: keyFormProviderId,
          label: keyFormLabel.trim(),
          apiKey: keyFormSecret.trim(),
        });
        setFeedback({
          type: 'success',
          message: `Added new API key for ${keyFormProviderId === 'token_harbour' ? 'Token Harbour' : 'CodeCraft'}. Encrypted on server.`,
        });
      }
      setShowAddKeyModal(false);
      const [updatedKeys, updatedProv] = await Promise.all([api.getAdminKeys(), api.getAdminProviders()]);
      setApiKeys(updatedKeys);
      setProviders(updatedProv);
      onRefreshPublicModels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async (keyItem: ApiKeyItem) => {
    if (!confirm(`Are you sure you want to remove "${keyItem.label}"?`)) return;
    try {
      await api.deleteAdminKey(keyItem.id);
      setFeedback({ type: 'success', message: `Key "${keyItem.label}" was removed.` });
      const [updatedKeys, updatedProv] = await Promise.all([api.getAdminKeys(), api.getAdminProviders()]);
      setApiKeys(updatedKeys);
      setProviders(updatedProv);
      onRefreshPublicModels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleToggleKeyEnabled = async (keyItem: ApiKeyItem) => {
    try {
      await api.updateAdminKey(keyItem.id, { isEnabled: !keyItem.isEnabled });
      const [updatedKeys, updatedProv] = await Promise.all([api.getAdminKeys(), api.getAdminProviders()]);
      setApiKeys(updatedKeys);
      setProviders(updatedProv);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleActivateKey = async (keyItem: ApiKeyItem) => {
    try {
      await api.activateAdminKey(keyItem.id);
      setFeedback({
        type: 'success',
        message: `"${keyItem.label}" is now the primary active key for ${keyItem.providerId === 'token_harbour' ? 'Token Harbour' : 'CodeCraft'}.`,
      });
      const [updatedKeys, updatedProv] = await Promise.all([api.getAdminKeys(), api.getAdminProviders()]);
      setApiKeys(updatedKeys);
      setProviders(updatedProv);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleTestKey = async (keyId: string) => {
    setTestingKeyId(keyId);
    setFeedback(null);
    try {
      const res = await api.testAdminKey(keyId);
      if (res.success) {
        setFeedback({ type: 'success', message: `${res.message} (Latency: ${res.latencyMs}ms)` });
      } else {
        setFeedback({ type: 'error', message: `Key Test: ${res.message}` });
      }
      const updatedKeys = await api.getAdminKeys();
      setApiKeys(updatedKeys);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleTestRawKey = async () => {
    if (!keyFormSecret.trim()) return;
    setTestingRawKey(true);
    setRawKeyTestResult(null);
    try {
      const res = await api.testRawAdminKey(keyFormProviderId, keyFormSecret.trim());
      setRawKeyTestResult(res);
    } catch (err: any) {
      setRawKeyTestResult({ success: false, latencyMs: 0, message: err.message });
    } finally {
      setTestingRawKey(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Header */}
        <header className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  AZI Central Owner Console
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-semibold uppercase">
                  Administrator
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Single owner infrastructure. Users chat without personal keys.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAllAdminData}
              disabled={loading}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
              title="Close Console"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Global Stats Overview Strip */}
        {stats && (
          <div className="px-6 py-3 border-b border-neutral-800 bg-neutral-950/20 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs shrink-0">
            <div>
              <span className="text-neutral-500 block text-[11px]">Total Routed Requests</span>
              <span className="text-base font-semibold font-mono text-neutral-100 tabular-nums">
                {stats.totalRequests.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">Total Token Volume</span>
              <span className="text-base font-semibold font-mono text-neutral-100 tabular-nums">
                {stats.totalTokens.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">Error Rate</span>
              <span className={`text-base font-semibold font-mono tabular-nums ${
                parseFloat(stats.errorRate) > 5 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {stats.errorRate}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">Avg Upstream Latency</span>
              <span className="text-base font-semibold font-mono text-neutral-100 tabular-nums">
                {stats.avgLatencyMs} ms
              </span>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60'
                : 'bg-red-950/40 text-red-300 border-red-900/60'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 border-b border-neutral-800 bg-neutral-900/80 gap-1 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'api-keys'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span>Multi-Key Manager & Failover</span>
          </button>

          <button
            onClick={() => setActiveTab('providers')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'providers'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Provider Endpoints</span>
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'models'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Model Catalogue & Access</span>
          </button>

          <button
            onClick={() => setActiveTab('fair-usage')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'fair-usage'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Fair Usage & Limits</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users & Access Control</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Request & Error Logs</span>
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 0: MULTI-API KEY MANAGER & FAILOVER */}
          {activeTab === 'api-keys' && (
            <div className="space-y-6">
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-400" />
                    <span>Multi-API Key Redundancy & Automatic Failover</span>
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Register multiple API keys for Token Harbour (T) and CodeCraft (C). When an active key hits rate limits or exhausts its quota, AZI automatically fails over to the next eligible key.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAddKey()}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add API Key</span>
                  </button>
                </div>
              </div>

              {/* Failover Status Card */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/60 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white tabular-nums">{apiKeys.length}</div>
                    <div className="text-[11px] text-neutral-400">Total Configured Keys</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/60 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white tabular-nums">
                      {apiKeys.filter(k => k.isActive && k.isEnabled).length}
                    </div>
                    <div className="text-[11px] text-neutral-400">Active Primary Keys</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/60 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-950/60 border border-sky-800/40 flex items-center justify-center text-sky-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white tabular-nums">
                      {apiKeys.filter(k => k.isEnabled && (k.status === 'healthy' || k.status === 'active' || k.status === 'untested')).length}
                    </div>
                    <div className="text-[11px] text-neutral-400">Standby / Ready Keys</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/60 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-400">
                    <RotateCw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Instant Automatic</span>
                    </div>
                    <div className="text-[11px] text-neutral-400">Failover Engine Active</div>
                  </div>
                </div>
              </div>

              {/* Provider Filter Tabs */}
              <div className="flex items-center gap-1.5 border-b border-neutral-800 pb-2">
                <button
                  type="button"
                  onClick={() => setKeyProviderFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    keyProviderFilter === 'all'
                      ? 'bg-neutral-800 text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  All Providers ({apiKeys.length})
                </button>
                <button
                  type="button"
                  onClick={() => setKeyProviderFilter('token_harbour')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    keyProviderFilter === 'token_harbour'
                      ? 'bg-neutral-800 text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span className="w-4 h-4 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40 text-[10px] flex items-center justify-center font-bold">T</span>
                  <span>Token Harbour ({apiKeys.filter(k => k.providerId === 'token_harbour').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setKeyProviderFilter('codecraft')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    keyProviderFilter === 'codecraft'
                      ? 'bg-neutral-800 text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span className="w-4 h-4 rounded bg-violet-950 text-violet-300 border border-violet-800/40 text-[10px] flex items-center justify-center font-bold">C</span>
                  <span>CodeCraft ({apiKeys.filter(k => k.providerId === 'codecraft').length})</span>
                </button>
              </div>

              {/* Keys List */}
              <div className="space-y-3">
                {apiKeys
                  .filter(k => keyProviderFilter === 'all' || k.providerId === keyProviderFilter)
                  .map(keyItem => {
                    const isTH = keyItem.providerId === 'token_harbour';
                    const isTesting = testingKeyId === keyItem.id;

                    return (
                      <div
                        key={keyItem.id}
                        className={`p-4 rounded-xl border transition-all ${
                          keyItem.isActive
                            ? 'bg-neutral-950 border-indigo-500/50 shadow-sm shadow-indigo-950/20'
                            : 'bg-neutral-950/60 border-neutral-800/80 hover:border-neutral-700/80'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left: Info */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="w-5 h-5 rounded bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-indigo-400 flex items-center justify-center shrink-0">
                                {isTH ? 'T' : 'C'}
                              </span>
                              <span className="font-semibold text-white text-xs sm:text-sm">
                                {keyItem.label}
                              </span>

                              {/* Active Status Badge */}
                              {keyItem.isActive ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>Active (Primary)</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                                  Standby Backup
                                </span>
                              )}

                              {/* Health / Quota status badge */}
                              {keyItem.status === 'healthy' || keyItem.status === 'active' ? (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Healthy</span>
                                </span>
                              ) : keyItem.status === 'quota_exceeded' ? (
                                <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Quota Exceeded (Backed off)</span>
                                </span>
                              ) : keyItem.status === 'rate_limited' ? (
                                <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>Rate Limited (Cooling off)</span>
                                </span>
                              ) : keyItem.status === 'error' ? (
                                <span className="text-[10px] text-red-400 flex items-center gap-1">
                                  <XCircle className="w-3 h-3" />
                                  <span>Error</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-neutral-400">Untested</span>
                              )}
                            </div>

                            {/* Masked Secret & Meta info */}
                            <div className="flex items-center gap-3 text-xs text-neutral-400 flex-wrap">
                              <span className="font-mono text-neutral-300 bg-neutral-900/80 px-2 py-0.5 rounded border border-neutral-800/80 text-[11px]">
                                {keyItem.maskedKey}
                              </span>
                              <span>·</span>
                              <span className="text-neutral-400 text-[11px]">
                                Provider: {isTH ? 'Token Harbour' : 'CodeCraft'}
                              </span>
                              <span>·</span>
                              <span className="text-neutral-400 text-[11px] tabular-nums">
                                {keyItem.requestCount || 0} requests served
                              </span>
                              {keyItem.latencyMs ? (
                                <>
                                  <span>·</span>
                                  <span className="text-neutral-300 text-[11px] tabular-nums font-mono">
                                    {keyItem.latencyMs} ms
                                  </span>
                                </>
                              ) : null}
                              {keyItem.lastUsedAt ? (
                                <>
                                  <span>·</span>
                                  <span className="text-neutral-500 text-[11px]">
                                    Last used: {new Date(keyItem.lastUsedAt).toLocaleTimeString()}
                                  </span>
                                </>
                              ) : null}
                            </div>

                            {/* Last error text if any */}
                            {keyItem.lastError && (
                              <div className="text-[11px] text-red-300 bg-red-950/40 p-2 rounded-lg border border-red-900/40">
                                {keyItem.lastError}
                              </div>
                            )}
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Make Active button */}
                            {!keyItem.isActive && keyItem.isEnabled && (
                              <button
                                type="button"
                                onClick={() => handleActivateKey(keyItem)}
                                className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-800 hover:border-neutral-700 transition-colors"
                                title="Promote to primary active key"
                              >
                                Set as Active
                              </button>
                            )}

                            {/* Test key */}
                            <button
                              type="button"
                              disabled={isTesting}
                              onClick={() => handleTestKey(keyItem.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1 transition-colors"
                            >
                              <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-indigo-400' : ''}`} />
                              <span>{isTesting ? 'Testing...' : 'Test Key'}</span>
                            </button>

                            {/* Enable/Disable toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleKeyEnabled(keyItem)}
                              className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                keyItem.isEnabled
                                  ? 'bg-neutral-800 border-neutral-700 text-emerald-400 hover:text-red-400'
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-emerald-400'
                              }`}
                              title={keyItem.isEnabled ? 'Disable key from failover pool' : 'Enable key in failover pool'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditKey(keyItem)}
                              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors"
                              title="Edit key label or replace secret"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteKey(keyItem)}
                              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-red-950/60 text-neutral-500 hover:text-red-400 border border-neutral-800 transition-colors"
                              title="Delete key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {apiKeys.filter(k => keyProviderFilter === 'all' || k.providerId === keyProviderFilter).length === 0 && (
                  <div className="p-8 text-center rounded-xl border border-neutral-800 bg-neutral-950/40 space-y-3">
                    <Key className="w-8 h-8 text-neutral-600 mx-auto" />
                    <div>
                      <h4 className="text-sm font-semibold text-white">No API keys registered</h4>
                      <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                        Add redundant keys for Token Harbour or CodeCraft so the system can automatically rotate and fail over when limits are reached.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddKey(keyProviderFilter === 'all' ? 'token_harbour' : keyProviderFilter as any)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Configure First Key</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Zero Exposure Note */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Secure Backend Vault Architecture</span>
                </div>
                <p>
                  All provider keys are encrypted with AES-256-GCM. Unmasked secrets are never returned to the frontend or exposed to users. Failover logic runs entirely server-side.
                </p>
              </div>
            </div>
          )}

          {/* TAB 1: PROVIDERS */}
          {activeTab === 'providers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Central Upstream Providers</h3>
                  <p className="text-xs text-neutral-400">
                    Configure your Token Harbour and CodeCraft API accounts. Regular users use these credentials seamlessly.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map(provider => {
                  const isTokenHarbour = provider.id === 'token_harbour';
                  const isCodeCraft = provider.id === 'codecraft';
                  const isGemini = provider.id === 'google_gemini';

                  return (
                    <div
                      key={provider.id}
                      className="p-5 rounded-xl border border-neutral-800 bg-neutral-950/60 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-xs text-indigo-400">
                              {isTokenHarbour ? 'T' : (isCodeCraft ? 'C' : 'G')}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                <span>{provider.name}</span>
                                {provider.isDefault && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                                    Default Provider
                                  </span>
                                )}
                              </h4>
                              <p className="text-[11px] font-mono text-neutral-400 truncate max-w-[220px]">
                                {provider.baseUrl}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {provider.status === 'online' ? (
                              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Online</span>
                              </span>
                            ) : provider.status === 'unconfigured' ? (
                              <span className="text-[11px] text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Key Required</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-red-400 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Connection Error</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Specs Details */}
                        <div className="text-xs space-y-1.5 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800/60">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-500">API Key Status:</span>
                            <span className="font-mono text-neutral-300">
                              {provider.hasKey ? (
                                <span className="text-emerald-400 font-medium">Encrypted on Server ({provider.maskedKey})</span>
                              ) : (
                                <span className="text-neutral-500">Not configured yet</span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-500">Models Hosted:</span>
                            <span className="font-mono text-neutral-300">
                              {isTokenHarbour ? 'DeepSeek V4.1 Flash · MiMo 2.6 Flash' : (isCodeCraft ? 'Opus 5.5 · Fable 5.1 · Luna 5.6' : 'Gemini 2.5 Flash')}
                            </span>
                          </div>

                          {provider.latencyMs !== null && provider.latencyMs !== undefined && (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-neutral-500">Ping Latency:</span>
                              <span className="font-mono text-neutral-300 tabular-nums">
                                {provider.latencyMs} ms
                              </span>
                            </div>
                          )}

                          {provider.lastError && (
                            <div className="p-2 rounded bg-red-950/40 border border-red-900/40 text-[10px] text-red-300 break-words mt-1">
                              {provider.lastError}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditProvider(provider)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>{provider.hasKey ? 'Update Key' : 'Configure Key'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleProviderEnabled(provider)}
                            className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              provider.isEnabled
                                ? 'bg-neutral-800 border-neutral-700 text-neutral-200 hover:text-red-400'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-emerald-400'
                            }`}
                            title={provider.isEnabled ? 'Disable Provider' : 'Enable Provider'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={testingProviderId === provider.id || !provider.hasKey}
                            onClick={() => handleTestProvider(provider.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 text-xs font-medium flex items-center gap-1 transition-colors"
                          >
                            <Activity className={`w-3.5 h-3.5 ${testingProviderId === provider.id ? 'animate-spin' : ''}`} />
                            <span>Test</span>
                          </button>

                          {!isGemini && (
                            <button
                              type="button"
                              disabled={fetchingModelsProviderId === provider.id || !provider.hasKey}
                              onClick={() => handleFetchModels(provider.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 text-xs font-medium flex items-center gap-1 transition-colors"
                              title="Fetch /v1/models catalogue"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${fetchingModelsProviderId === provider.id ? 'animate-spin' : ''}`} />
                              <span>Fetch Models</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Security Advisory note */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Zero Key Exposure Architecture</span>
                </div>
                <p>
                  Keys entered above are encrypted using AES-256-GCM and stored only in server-side storage. Client-side JavaScript never receives decrypted keys, URLs, or upstream tokens.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: MODELS */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Model Catalogue & User Access</h3>
                  <p className="text-xs text-neutral-400">
                    Control which models regular users can see and use. Designate default model.
                  </p>
                </div>
              </div>

              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400">
                        <th className="p-3">Default</th>
                        <th className="p-3">Model Name & ID</th>
                        <th className="p-3">Provider</th>
                        <th className="p-3">Pricing Tier</th>
                        <th className="p-3">Context Window</th>
                        <th className="p-3">User Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {models.map(model => (
                        <tr key={model.id} className="hover:bg-neutral-900/40 transition-colors">
                          <td className="p-3">
                            <input
                              type="radio"
                              name="defaultModel"
                              checked={model.isDefault}
                              onChange={() => handleSetDefaultModel(model.id)}
                              className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              title="Set as default model"
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-white">{model.name}</div>
                            <div className="font-mono text-[11px] text-neutral-500">{model.id}</div>
                          </td>
                          <td className="p-3">
                            <span className="font-mono text-neutral-300">
                              {providers.find(p => p.id === model.providerId)?.name || model.providerId}
                            </span>
                          </td>
                          <td className="p-3">
                            {model.isFree ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 font-mono font-semibold">
                                FREE TIER
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-violet-950/80 text-violet-400 border border-violet-800/40 font-mono font-semibold">
                                {model.pricingNote || 'PAID TIER'}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-neutral-300 tabular-nums">
                            {(model.contextWindow / 1000).toFixed(0)}k tokens
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleToggleModelEnabled(model)}
                              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                                model.enabledForUsers
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/60'
                                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white'
                              }`}
                            >
                              {model.enabledForUsers ? 'Enabled' : 'Disabled'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FAIR USAGE */}
          {activeTab === 'fair-usage' && fairUsage && (
            <form onSubmit={handleSaveFairUsage} className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-sm font-bold text-white">Fair Usage & Abuse Protection</h3>
                <p className="text-xs text-neutral-400">
                  Because friends share your central API account, configure fair sharing limits to prevent runaway costs or accidental exhaustion.
                </p>
              </div>

              <div className="space-y-4 bg-neutral-950/60 p-5 rounded-xl border border-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-white block">
                      Enforce Usage Limits
                    </label>
                    <span className="text-[11px] text-neutral-500">
                      Apply per-user rate limits and daily message caps
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={fairUsage.enforceLimits}
                    onChange={e => setFairUsage({ ...fairUsage, enforceLimits: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-white block">
                      Maintenance Mode
                    </label>
                    <span className="text-[11px] text-neutral-500">
                      Temporarily pause non-admin chat requests for maintenance
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={fairUsage.maintenanceMode}
                    onChange={e => setFairUsage({ ...fairUsage, maintenanceMode: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                </div>

                <div className="border-t border-neutral-800/80 pt-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">
                      Max Requests Per Minute (Per User)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={fairUsage.maxRequestsPerMinute}
                      onChange={e =>
                        setFairUsage({ ...fairUsage, maxRequestsPerMinute: parseInt(e.target.value, 10) || 15 })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">
                      Daily Message Limit (Per User)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={1000}
                      value={fairUsage.dailyUserMessageLimit}
                      onChange={e =>
                        setFairUsage({ ...fairUsage, dailyUserMessageLimit: parseInt(e.target.value, 10) || 100 })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">
                      Daily Token Cap (Per User)
                    </label>
                    <input
                      type="number"
                      min={10000}
                      max={2000000}
                      step={10000}
                      value={fairUsage.dailyUserTokenCap}
                      onChange={e =>
                        setFairUsage({ ...fairUsage, dailyUserTokenCap: parseInt(e.target.value, 10) || 250000 })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">
                      Global System Announcement Banner
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Welcome friends to AZI. Enjoy the DeepSeek v4.1 model!"
                      value={fairUsage.systemAnnouncement || ''}
                      onChange={e =>
                        setFairUsage({ ...fairUsage, systemAnnouncement: e.target.value })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                {/* AZI Identity & Custom System Prompt Controls */}
                <div className="border-t border-neutral-800/80 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-white block">
                        AZI Permanent System Identity & Directives
                      </label>
                      <span className="text-[11px] text-neutral-500">
                        AZI's core identity is permanently bound to Azmal and enforced server-side on every request.
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                      Enforced Server-Side
                    </span>
                  </div>

                  {/* Core identity preview badge */}
                  <div className="p-3 rounded-lg bg-neutral-900/90 border border-neutral-800 text-[11px] text-neutral-300 font-mono space-y-1">
                    <div className="text-xs font-bold text-indigo-400 font-sans flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-indigo-400" />
                      AZI Permanent Core Rules (Immutable):
                    </div>
                    <div className="text-neutral-400 pl-4 space-y-0.5 text-[10.5px]">
                      <div>• Name: AZI (AZMAL INTELLIGENCE)</div>
                      <div>• Creator &amp; Owner: Azmal</div>
                      <div>• Creator Answer: "I was created by Azmal, and I am AZI — AZMAL INTELLIGENCE."</div>
                      <div>• Consistent server-side enforcement across all models (Token Harbour, CodeCraft, Gemini)</div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">
                      Administrator Custom System Directives (Optional)
                    </label>
                    <p className="text-[11px] text-neutral-500 mb-2">
                      Add custom instructions, behavioral rules, or domain context. These directives will be appended under the permanent AZI identity rules.
                    </p>
                    <textarea
                      rows={4}
                      placeholder="e.g. You are also specialized in full-stack coding, concise technical explanations, and friendly banter with friends."
                      value={fairUsage.customSystemPrompt || ''}
                      onChange={e =>
                        setFairUsage({ ...fairUsage, customSystemPrompt: e.target.value })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono resize-y"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
                >
                  Save Fair Usage &amp; System Directives
                </button>

                <button
                  type="button"
                  disabled={testingIdentity}
                  onClick={handleTestIdentity}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs font-semibold border border-neutral-700 flex items-center gap-2 transition-colors"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-indigo-400 ${testingIdentity ? 'animate-spin' : ''}`} />
                  <span>{testingIdentity ? 'Testing Models for Identity...' : 'Test Identity Compliance'}</span>
                </button>
              </div>

              {/* Identity Test Results Display */}
              {identityTestResults && (
                <div className="mt-4 p-4 rounded-xl border border-neutral-800 bg-neutral-950/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>AZI Identity Verification Results</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIdentityTestResults(null)}
                      className="text-neutral-500 hover:text-neutral-300 text-xs"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Question tested: <code className="text-neutral-300 bg-neutral-900 px-1 py-0.5 rounded">"Who created you and what is your name?"</code>
                  </p>

                  <div className="space-y-2">
                    {identityTestResults.map((r, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs ${
                          r.passed
                            ? 'bg-emerald-950/20 border-emerald-800/40'
                            : 'bg-red-950/20 border-red-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{r.modelName}</span>
                            <span className="text-[10px] text-neutral-400">({r.providerName})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-neutral-400">{r.latencyMs}ms</span>
                            {r.passed ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-bold border border-emerald-700/50 flex items-center gap-1">
                                <Check className="w-3 h-3" /> PASSED (Azmal & AZI identified)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-red-900/60 text-red-300 text-[10px] font-bold border border-red-700/50">
                                {r.status === 'error' ? 'ERROR' : 'FAILED'}
                              </span>
                            )}
                          </div>
                        </div>

                        {r.response && (
                          <div className="text-[11px] text-neutral-300 font-mono bg-neutral-900/70 p-2 rounded border border-neutral-800/60 whitespace-pre-wrap">
                            {r.response}
                          </div>
                        )}
                        {r.error && (
                          <div className="text-[11px] text-red-300 mt-1 font-mono">
                            {r.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}

          {/* TAB 4: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Registered Users & Quotas</h3>
                  <p className="text-xs text-neutral-400">
                    Monitor usage and suspend malicious or abusive users.
                  </p>
                </div>
              </div>

              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400">
                        <th className="p-3">User</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Requests Today</th>
                        <th className="p-3">Total Tokens</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-neutral-900/40 transition-colors">
                          <td className="p-3">
                            <div className="font-semibold text-white">{u.name}</div>
                            <div className="font-mono text-[11px] text-neutral-500">{u.email}</div>
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                              u.role === 'admin'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/40'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-neutral-300 tabular-nums">
                            {u.requestsToday}
                          </td>
                          <td className="p-3 font-mono text-neutral-300 tabular-nums">
                            {(u.totalTokens || 0).toLocaleString()}
                          </td>
                          <td className="p-3">
                            {u.suspended ? (
                              <span className="text-[11px] text-red-400 font-semibold">Suspended</span>
                            ) : (
                              <span className="text-[11px] text-emerald-400 font-semibold">Active</span>
                            )}
                          </td>
                          <td className="p-3">
                            {u.role !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleToggleSuspendUser(u.id)}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                  u.suspended
                                    ? 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900'
                                    : 'bg-red-950 text-red-300 hover:bg-red-900'
                                }`}
                              >
                                {u.suspended ? 'Reinstate' : 'Suspend'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Central Request & Error Logs</h3>
                  <p className="text-xs text-neutral-400">
                    Live operational audit trail. Secrets are never stored or displayed here.
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter by user or model..."
                    value={logFilter}
                    onChange={e => setLogFilter(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/60 max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-neutral-900 border-b border-neutral-800 text-neutral-400">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Model</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Latency</th>
                      <th className="p-3">Tokens</th>
                      <th className="p-3">Error / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                    {logs
                      .filter(l =>
                        l.userEmail.toLowerCase().includes(logFilter.toLowerCase()) ||
                        l.modelId.toLowerCase().includes(logFilter.toLowerCase())
                      )
                      .map(log => (
                        <tr key={log.id} className="hover:bg-neutral-900/30">
                          <td className="p-3 text-neutral-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-neutral-300 truncate max-w-[140px]">
                            {log.userEmail}
                          </td>
                          <td className="p-3 text-neutral-300 truncate max-w-[140px]">
                            {log.modelId}
                          </td>
                          <td className="p-3">
                            {log.status === 'success' ? (
                              <span className="text-emerald-400 font-semibold">200 OK</span>
                            ) : (
                              <span className="text-red-400 font-semibold">ERROR</span>
                            )}
                          </td>
                          <td className="p-3 text-neutral-400 tabular-nums">
                            {log.durationMs}ms
                          </td>
                          <td className="p-3 text-neutral-400 tabular-nums">
                            {log.totalTokens}
                          </td>
                          <td className="p-3 text-neutral-500 max-w-[200px] truncate text-[10px]">
                            {log.errorMessage || '—'}
                          </td>
                        </tr>
                      ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-neutral-500 font-sans">
                          No logged requests yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Edit Provider API Key & Base URL */}
        {editingProvider && (
          <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-400" />
                  <span>Configure {editingProvider.name}</span>
                </h4>
                <button
                  onClick={() => setEditingProvider(null)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProvider} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Base URL
                  </label>
                  <input
                    type="url"
                    required
                    value={inputBaseUrl}
                    onChange={e => setInputBaseUrl(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-neutral-500 block mt-1">
                    Standard OpenAI-compatible endpoint base
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Provider API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKeyText ? 'text' : 'password'}
                      placeholder={editingProvider.hasKey ? 'Leave blank to keep existing key' : 'Enter secret key...'}
                      value={inputApiKey}
                      onChange={e => setInputApiKey(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-3 pr-9 py-2 text-xs text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeyText(!showKeyText)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    >
                      {showKeyText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-neutral-500 block mt-1">
                    Saved encrypted with AES-256-GCM. Never shared with frontend.
                  </span>
                </div>

                <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProvider(null)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs hover:bg-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProvider}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                  >
                    {savingProvider ? 'Encrypting & Saving...' : 'Save & Encrypt'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ADD / EDIT API KEY MODAL */}
        {showAddKeyModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">
                    {editingKeyItem ? 'Edit API Key' : 'Add New Provider API Key'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddKeyModal(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveKey} className="space-y-4 text-xs">
                {/* Provider selection (only when adding) */}
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Provider
                  </label>
                  <select
                    disabled={!!editingKeyItem}
                    value={keyFormProviderId}
                    onChange={e => setKeyFormProviderId(e.target.value as any)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white disabled:opacity-50"
                  >
                    <option value="token_harbour">Provider T — Token Harbour</option>
                    <option value="codecraft">Provider C — CodeCraft API</option>
                  </select>
                </div>

                {/* Custom Label */}
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Custom Label
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Token Harbour Key 1 (Primary)"
                    value={keyFormLabel}
                    onChange={e => setKeyFormLabel(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <span className="text-[10px] text-neutral-500 block mt-1">
                    Friendly label to identify this key in the automatic rotation & failover pool
                  </span>
                </div>

                {/* Key Secret */}
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    API Key Secret
                  </label>
                  <div className="relative">
                    <input
                      type={keyFormShowSecret ? 'text' : 'password'}
                      required={!editingKeyItem}
                      placeholder={editingKeyItem ? 'Leave empty to preserve existing secret' : 'sk-... or th-...'}
                      value={keyFormSecret}
                      onChange={e => {
                        setKeyFormSecret(e.target.value);
                        setRawKeyTestResult(null);
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-3 pr-9 py-2 text-xs text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setKeyFormShowSecret(!keyFormShowSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    >
                      {keyFormShowSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-neutral-500 block mt-1">
                    Encrypted with AES-256-GCM. Unmasked secrets are never returned to frontend.
                  </span>
                </div>

                {/* Raw test button */}
                {keyFormSecret.trim() && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={testingRawKey}
                      onClick={handleTestRawKey}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Activity className={`w-3.5 h-3.5 ${testingRawKey ? 'animate-spin text-indigo-400' : ''}`} />
                      <span>{testingRawKey ? 'Testing Key Against Provider...' : 'Test Key Independently Before Saving'}</span>
                    </button>

                    {rawKeyTestResult && (
                      <div
                        className={`p-2.5 rounded-lg text-xs border ${
                          rawKeyTestResult.success
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60'
                            : 'bg-red-950/40 text-red-300 border-red-900/60'
                        }`}
                      >
                        {rawKeyTestResult.message}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddKeyModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs hover:bg-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingKey}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                  >
                    {savingKey ? 'Encrypting & Saving...' : 'Save & Enable Key'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
