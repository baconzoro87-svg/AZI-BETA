import React, { useState, useRef, useEffect } from 'react';
import { ModelItem } from '../../types';
import { ChevronDown, Check, ShieldCheck, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react';

interface ModelSelectorProps {
  models: ModelItem[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = models.find(m => m.id === selectedModelId || m.actualModelId === selectedModelId) || models[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group models by provider
  // Target order:
  // 1. Provider C — CodeCraft: Opus 5.5, Fable 5.1, Luna 5.6
  // 2. Provider T — Token Harbour: DeepSeek V4.1 Flash, MiMo 2.6 Flash
  // 3. Other / Built-in
  const codeCraftModels = models.filter(m => m.providerId === 'codecraft');
  const tokenHarbourModels = models.filter(m => m.providerId === 'token_harbour');
  const otherModels = models.filter(m => m.providerId !== 'codecraft' && m.providerId !== 'token_harbour');

  const groups = [
    {
      id: 'codecraft',
      title: 'Provider C — CodeCraft',
      description: 'Opus 5.5 · Fable 5.1 · Luna 5.6 (Paid Tier)',
      models: codeCraftModels,
    },
    {
      id: 'token_harbour',
      title: 'Provider T — Token Harbour',
      description: 'DeepSeek V4.1 Flash · MiMo 2.6 Flash (Free Tier)',
      models: tokenHarbourModels,
    },
    ...(otherModels.length > 0
      ? [
          {
            id: 'other',
            title: 'Server Built-in Engine',
            description: 'Optional server-side engines',
            models: otherModels,
          },
        ]
      : []),
  ];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-neutral-700/70 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
      >
        <div className="flex items-center gap-1.5 truncate max-w-[210px] sm:max-w-[320px]">
          <span className="font-bold text-neutral-100">{currentModel ? currentModel.name : 'Select Model'}</span>
          <span className="text-neutral-400 font-normal hidden sm:inline">
            · {currentModel?.providerLabel || currentModel?.providerName || 'AZI'}
          </span>
        </div>

        {/* Pricing badge */}
        {currentModel?.isFree ? (
          <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-950/70 border border-emerald-800/40 font-mono">
            FREE
          </span>
        ) : (
          <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-violet-950/70 border border-violet-800/40 font-mono">
            PAID
          </span>
        )}

        {/* Availability status badge */}
        {!currentModel?.isAvailable && (
          <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-950/70 border border-amber-800/40 font-mono flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>UNAVAILABLE</span>
          </span>
        )}

        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-84 sm:w-[420px] rounded-xl border border-neutral-800 bg-neutral-900/95 backdrop-blur-md shadow-2xl py-2 z-50 focus:outline-none max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 shrink-0">
            <div>
              <span className="font-bold text-neutral-200">Central API Preferred Models</span>
              <span className="block text-[10px] text-neutral-400">Switch models at any point in your chat</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-300 font-mono border border-indigo-800/40">
              Owner Hosted
            </span>
          </div>

          {/* Grouped Model List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {groups.map(group => {
              if (group.models.length === 0) return null;

              return (
                <div key={group.id} className="space-y-1">
                  {/* Group Provider Header */}
                  <div className="px-2 pt-1 pb-1 flex items-center justify-between text-[11px] font-bold text-neutral-300 border-b border-neutral-800/50">
                    <span className="tracking-wide uppercase text-indigo-300">{group.title}</span>
                    <span className="text-[10px] font-normal text-neutral-400">{group.description}</span>
                  </div>

                  {/* Models in Group */}
                  <div className="space-y-1 pt-1">
                    {group.models.map(model => {
                      const isSelected = model.id === selectedModelId || model.actualModelId === selectedModelId;
                      const isAvail = model.isAvailable;

                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            onSelectModel(model.id);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start justify-between gap-3 ${
                            isSelected
                              ? 'bg-indigo-600/15 border border-indigo-500/40 text-white shadow-xs'
                              : isAvail
                              ? 'hover:bg-neutral-800/70 text-neutral-300 border border-transparent'
                              : 'bg-neutral-950/40 hover:bg-neutral-900/60 text-neutral-400 border border-neutral-800/60'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-bold text-neutral-100 text-[13px]">{model.name}</span>

                              {/* Provider tag */}
                              <span className="text-[10px] font-mono text-neutral-400">
                                ({model.providerLabel || model.providerName})
                              </span>

                              {/* Pricing classification */}
                              {model.isFree ? (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 font-mono font-semibold">
                                  FREE
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-950/80 text-violet-400 border border-violet-800/40 font-mono font-semibold">
                                  PAID
                                </span>
                              )}

                              {/* Availability Pill */}
                              {isAvail ? (
                                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>Online</span>
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800/40 font-mono font-semibold flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  <span>Unavailable</span>
                                </span>
                              )}

                              {model.isDefault && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono">
                                  Default
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-neutral-400 line-clamp-1">{model.description}</p>

                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-400 flex-wrap">
                              <span className="font-mono text-neutral-400">ID: {model.actualModelId || model.id}</span>
                              <span>·</span>
                              <span>Context: {(model.contextWindow / 1000).toFixed(0)}k</span>
                              {model.pricingNote && (
                                <>
                                  <span>·</span>
                                  <span className="truncate">{model.pricingNote}</span>
                                </>
                              )}
                            </div>

                            {/* Detailed unavailability reason if offline */}
                            {!isAvail && (
                              <div className="mt-1 text-[10px] text-amber-300/90 flex items-center gap-1 font-sans">
                                <span>Status: {model.availabilityReason || 'Provider key required in Owner Panel'}</span>
                              </div>
                            )}
                          </div>

                          {isSelected && (
                            <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="px-4 py-2 border-t border-neutral-800/80 bg-neutral-950/40 text-[11px] text-neutral-400 flex items-center justify-between shrink-0">
            <span>No personal keys required</span>
            <span className="text-indigo-400 font-medium">Single Owner Infrastructure</span>
          </div>
        </div>
      )}
    </div>
  );
};
