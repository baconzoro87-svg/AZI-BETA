import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Server, Shield, Database, ExternalLink } from 'lucide-react';

interface DeploymentGuideModalProps {
  onClose: () => void;
}

export const DeploymentGuideModal: React.FC<DeploymentGuideModalProps> = ({ onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const envSample = `# AZI Central Environment Configuration
PORT=3000
TOKEN_HARBOUR_API_KEY=your_token_harbour_key_here
CODECRAFT_API_KEY=your_codecraft_key_here
TOKEN_HARBOUR_BASE_URL=https://tokenharbor.ai/v1
CODECRAFT_BASE_URL=https://www.codecraftapi.com/v1
ADMIN_EMAIL=admin@azi.internal
ADMIN_INITIAL_PASSWORD=your_secure_admin_password
SESSION_SECRET=super_secret_session_key_32_chars_min
ENCRYPTION_SECRET=vault_aes_256_gcm_secret_key_32_chars`;

  const runCommandSample = `# 1. Clone repository & install dependencies
git clone <repo-url> azi-central
cd azi-central
npm install

# 2. Configure environment file
cp .env.example .env
# Edit .env with your credentials

# 3. Start development server
npm run dev

# 4. Or build & launch production server
npm run build
npm start`;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <header className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                AZI Deployment & Admin Guide
              </h2>
              <p className="text-xs text-neutral-400">Self-hosting, environment setup, and security architecture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-neutral-300">
          {/* Architecture Overview */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              1. Architecture & Proxy Routing Flow
            </h3>
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-[11px] leading-relaxed text-indigo-300">
              User Browser ⇄ AZI React Frontend ⇄ AZI Express Backend (/api/chat/stream)
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓ (Server AES-256 decrypted Authorization header)
              <br />
              Upstream Provider (Token Harbour https://tokenharbor.ai/v1 or CodeCraft https://www.codecraftapi.com/v1)
            </div>
            <p className="text-[11px] text-neutral-400">
              Regular users make zero outbound requests to external AI vendors. All billing and tokens originate from the owner's server.
            </p>
          </div>

          {/* Environment Variables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                2. .env Configuration Template
              </h3>
              <button
                onClick={() => copyToClipboard('env', envSample)}
                className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
              >
                {copiedKey === 'env' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'env' ? 'Copied' : 'Copy Template'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-[11px] overflow-x-auto text-neutral-200">
              {envSample}
            </pre>
          </div>

          {/* Quickstart commands */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                3. CLI Setup & Launch Commands
              </h3>
              <button
                onClick={() => copyToClipboard('cli', runCommandSample)}
                className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
              >
                {copiedKey === 'cli' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'cli' ? 'Copied' : 'Copy Commands'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-[11px] overflow-x-auto text-neutral-200">
              {runCommandSample}
            </pre>
          </div>

          {/* Owner Initial Setup Checklist */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              4. Administrator Setup Checklist
            </h3>
            <ul className="space-y-2 text-[11px] text-neutral-400 list-disc pl-5">
              <li>
                <strong className="text-neutral-200">Admin Account:</strong> Log in with email <code className="text-indigo-300 bg-neutral-900 px-1 py-0.5 rounded">admin@azi.internal</code> or your owner email and initial password.
              </li>
              <li>
                <strong className="text-neutral-200">Configure Token Harbour:</strong> Open Owner Panel → API Providers → Enter your Token Harbour API key. Test connection.
              </li>
              <li>
                <strong className="text-neutral-200">Configure CodeCraft:</strong> Enter your CodeCraft API key. Check catalogue verification for Claude Opus 5.5 and mark availability.
              </li>
              <li>
                <strong className="text-neutral-200">Set Fair Usage:</strong> Adjust per-user daily message limits and rate limits to safeguard your account against unexpected usage spikes.
              </li>
              <li>
                <strong className="text-neutral-200">Invite Friends:</strong> Friends simply sign up with their email or log in without needing any API keys.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
