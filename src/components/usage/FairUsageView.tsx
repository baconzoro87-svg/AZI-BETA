import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Shield, Activity, Clock, Zap, CheckCircle2, Lock } from 'lucide-react';

interface FairUsageViewProps {
  onClose: () => void;
}

export const FairUsageView: React.FC<FairUsageViewProps> = ({ onClose }) => {
  const { user } = useAuth();

  const requestsToday = user?.requestsToday || 0;
  const tokensToday = user?.tokensToday || 0;
  const maxDailyRequests = 120;
  const maxDailyTokens = 300000;

  const requestPercent = Math.min(100, Math.round((requestsToday / maxDailyRequests) * 100));
  const tokenPercent = Math.min(100, Math.round((tokensToday / maxDailyTokens) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Fair Usage & Quota</h2>
              <p className="text-xs text-neutral-400">Transparent resource allocation for shared infrastructure</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-6 text-xs">
          {/* Guiding Principle */}
          <div className="p-4 rounded-xl border border-indigo-900/40 bg-indigo-950/20 space-y-2">
            <div className="font-bold text-indigo-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>How AZI Sharing Works</span>
            </div>
            <p className="text-neutral-300 leading-relaxed">
              AZI is owned and operated by Azmal. All external provider bills (Token Harbour & CodeCraft API) are funded centrally. To ensure continuous uptime and prevent accidental API drainage, every user enjoys an allotment of daily messages and tokens.
            </p>
          </div>

          {/* Current User Meters */}
          <div className="space-y-4 bg-neutral-950/60 p-5 rounded-xl border border-neutral-800">
            <h3 className="font-bold text-white text-xs">Your Current Utilization Today</h3>

            {/* Daily Requests */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-neutral-400">Daily Requests Completed:</span>
                <span className="text-neutral-200 tabular-nums">
                  {requestsToday} / {maxDailyRequests} ({requestPercent}%)
                </span>
              </div>
              <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${requestPercent}%` }}
                />
              </div>
            </div>

            {/* Daily Token Consumption */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-neutral-400">Estimated Tokens Streamed:</span>
                <span className="text-neutral-200 tabular-nums">
                  {tokensToday.toLocaleString()} / {maxDailyTokens.toLocaleString()} ({tokenPercent}%)
                </span>
              </div>
              <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-500"
                  style={{ width: `${tokenPercent}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-800 flex items-center justify-between">
              <span>Quota resets automatically at 00:00 UTC</span>
              <span className="text-emerald-400 font-medium">Status: Active & Nominal</span>
            </div>
          </div>

          {/* Protection Rules Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-900/50 space-y-1">
              <span className="font-semibold text-neutral-200">Rate Limiting</span>
              <p className="text-[11px] text-neutral-400">
                Max 20 requests per minute per user to guarantee smooth concurrent streaming for all active chats.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-900/50 space-y-1">
              <span className="font-semibold text-neutral-200">Isolation & Privacy</span>
              <p className="text-[11px] text-neutral-400">
                Users cannot view or query each other's chat histories. Conversations are cryptographically scoped to individual accounts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
