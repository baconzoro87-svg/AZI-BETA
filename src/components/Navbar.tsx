import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Shield, Moon, Sun, Terminal, User, BookOpen } from 'lucide-react';

interface NavbarProps {
  onOpenModels: () => void;
  onOpenUsage: () => void;
  onOpenAdmin: () => void;
  onOpenGuide: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenModels,
  onOpenUsage,
  onOpenAdmin,
  onOpenGuide,
  onOpenAuth,
}) => {
  const { user, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 bg-neutral-900 border-b border-neutral-800 px-4 sm:px-6 flex items-center justify-between gap-8 shrink-0 z-30 select-none">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
        <img
          src="/src/assets/images/azi_intelligence_emblem_1791833035326.jpg"
          alt="AZI Emblem"
          className="w-7 h-7 rounded-lg object-cover ring-1 ring-indigo-500/30"
          referrerPolicy="no-referrer"
        />
        <span className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
          <span>AZI</span>
          <span className="text-neutral-500 font-normal">|</span>
          <span className="text-neutral-300 font-medium hidden sm:inline text-xs">AZMAL INTELLIGENCE</span>
        </span>
      </div>

      {/* Zone 2: 4-5 concise single-line nav links */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
        <button
          onClick={onOpenModels}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0 hover:underline"
        >
          Model Catalogue
        </button>

        <button
          onClick={onOpenUsage}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0 hover:underline"
        >
          Fair Usage
        </button>

        <button
          onClick={onOpenGuide}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0 hover:underline"
        >
          Deployment Guide
        </button>

        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Owner Panel</span>
          </button>
        )}
      </nav>

      {/* Zone 3: Primary Action / Account Trigger */}
      <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenAuth}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-700/80 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
        >
          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <span className="hidden sm:inline truncate max-w-[100px]">{user?.name || 'Account'}</span>
          {isAdmin && (
            <span className="text-[10px] text-amber-400 font-semibold hidden md:inline">Admin</span>
          )}
        </button>
      </div>
    </header>
  );
};
