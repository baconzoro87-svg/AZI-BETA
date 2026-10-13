import React from 'react';
import { ModelItem } from '../../types';
import { ShieldCheck, Sparkles, X, Bot, ArrowRight, Check, AlertCircle, AlertTriangle } from 'lucide-react';

interface ModelsDirectoryProps {
  models: ModelItem[];
  defaultModelId: string;
  onSelectModel: (id: string) => void;
  onClose: () => void;
}

export const ModelsDirectory: React.FC<ModelsDirectoryProps> = ({
  models,
  defaultModelId,
  onSelectModel,
  onClose,
}) => {
  const codeCraftModels = models.filter(m => m.providerId === 'codecraft');
  const tokenHarbourModels = models.filter(m => m.providerId === 'token_harbour');
  const otherModels = models.filter(m => m.providerId !== 'codecraft' && m.providerId !== 'token_harbour');

  const groups = [
    {
      id: 'codecraft',
      title: 'Provider C — CodeCraft',
      description: 'Opus 5.5 · Fable 5.1 · Luna 5.6 (Paid Tier)',
      baseUrl: 'https://www.codecraftapi.com/v1',
      models: codeCraftModels,
    },
    {
      id: 'token_harbour',
      title: 'Provider T — Token Harbour',
      description: 'DeepSeek V4.1 Flash · MiMo 2.6 Flash (Free Tier)',
      baseUrl: 'https://tokenharbor.ai/v1',
      models: tokenHarbourModels,
    },
    ...(otherModels.length > 0
      ? [
          {
            id: 'other',
            title: 'Server Built-in Engine',
            description: 'Optional server-side engines',
            baseUrl: 'Server Internal Proxy',
            models: otherModels,
          },
        ]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <header className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/40 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              AZI Model Catalogue & Preferred Models
            </h2>
            <p className="text-xs text-neutral-400">
              Five preferred models grouped by provider. All routed through owner-configured credentials.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {groups.map(group => (
            <div key={group.id} className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wide">
                    {group.title}
                  </h3>
                  <p className="text-xs text-neutral-400">{group.description}</p>
                </div>
                <span className="text-[11px] font-mono text-neutral-500">{group.baseUrl}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {group.models.map(model => {
                  const isDefault = model.id === defaultModelId;
                  const isAvail = model.isAvailable;

                  return (
                    <div
                      key={model.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                        isDefault
                          ? 'border-indigo-500/50 bg-neutral-950/90 shadow-md'
                          : isAvail
                          ? 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700'
                          : 'border-neutral-800/60 bg-neutral-950/20 opacity-80'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-white">{model.name}</h4>
                              {isDefault && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-medium">
                                  Default
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-neutral-500">
                              ID: {model.actualModelId || model.id}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {model.isFree ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 font-mono font-semibold">
                                FREE TIER
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-violet-950/80 text-violet-400 border border-violet-800/40 font-mono font-semibold">
                                {model.pricingNote || 'PAID TIER'}
                              </span>
                            )}

                            {!isAvail && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/40 font-mono font-semibold">
                                UNAVAILABLE
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-neutral-400 leading-relaxed">
                          {model.description}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-neutral-500 pt-1">
                          <span>{model.providerLabel || model.providerName}</span>
                          <span>·</span>
                          <span>Context: {(model.contextWindow / 1000).toFixed(0)}k</span>
                          {model.verified && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-400 flex items-center gap-0.5">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Verified</span>
                              </span>
                            </>
                          )}
                        </div>

                        {!isAvail && (
                          <div className="text-[11px] text-amber-300/80 pt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>{model.availabilityReason || 'Requires API key in Owner Panel'}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between">
                        <span className="text-[11px] text-neutral-500">
                          {model.isFree ? 'Verified Free Tier' : 'Owner-subsidized Paid Tier'}
                        </span>
                        <button
                          onClick={() => {
                            onSelectModel(model.id);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 font-medium flex items-center gap-1 transition-colors"
                        >
                          <span>Select Model</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
