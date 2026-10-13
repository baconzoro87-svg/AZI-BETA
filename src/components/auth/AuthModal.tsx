import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, LogIn, UserPlus, Shield, User, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { login, register, quickSwitch, user } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = async (role: 'admin' | 'user') => {
    setError(null);
    setLoading(true);
    try {
      await quickSwitch(role);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white">
              {mode === 'login' ? 'Sign In to AZI' : 'Create Account'}
            </span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-900/60 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {mode === 'register' && (
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Your Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Alex Smith"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          )}

          <div>
            <label className="text-neutral-300 block mb-1 font-medium">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-neutral-300 block mb-1 font-medium">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors mt-2"
          >
            {loading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="text-center text-[11px] text-neutral-400">
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button onClick={() => setMode('register')} className="text-indigo-400 hover:underline font-medium">
                Register
              </button>
            </span>
          ) : (
            <span>
              Already registered?{' '}
              <button onClick={() => setMode('login')} className="text-indigo-400 hover:underline font-medium">
                Sign In
              </button>
            </span>
          )}
        </div>

        {/* Instant Demo Switching */}
        <div className="pt-3 border-t border-neutral-800 space-y-2">
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-semibold">
            One-Click Demo Personas
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuick('admin')}
              className="p-2 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-indigo-500 text-neutral-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Owner Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuick('user')}
              className="p-2 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-indigo-500 text-neutral-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>Friend User</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
