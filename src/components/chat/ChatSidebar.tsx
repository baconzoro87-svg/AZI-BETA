import React, { useState } from 'react';
import { Conversation } from '../../types';
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  Shield,
  User,
  Zap,
  Activity,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenAdmin: () => void;
  onOpenUsage: () => void;
  onOpenModels: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  isOpen,
  onClose,
  onOpenAdmin,
  onOpenUsage,
  onOpenModels,
}) => {
  const { user, logout, quickSwitch, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startEditing = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveEditing = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header / New Chat */}
        <div className="p-3 border-b border-neutral-800 space-y-2">
          <div className="flex items-center justify-between lg:hidden mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Conversations</span>
            <button onClick={onClose} className="p-1 rounded text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              onNewConversation();
              onClose();
            }}
            className="w-full py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-950/60 border border-neutral-800/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/70"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 px-4 text-neutral-500 text-xs">
              {searchQuery ? 'No conversations match search' : 'No chats yet. Start a new conversation!'}
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isActive = conv.id === activeConversationId;
              const isEditing = conv.id === editingId;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    onClose();
                  }}
                  className={`group relative flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all ${
                    isActive
                      ? 'bg-neutral-800/90 text-white font-medium border border-neutral-700/50'
                      : 'text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-1">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-neutral-500'}`} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="bg-neutral-950 px-1.5 py-0.5 rounded text-xs text-white border border-indigo-500 focus:outline-none flex-1 min-w-0"
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEditing(conv.id, e as any);
                          if (e.key === 'Escape') cancelEditing(e as any);
                        }}
                      />
                    ) : (
                      <span className="truncate">{conv.title}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <>
                        <button
                          onClick={e => saveEditing(conv.id, e)}
                          className="p-1 hover:text-emerald-400 text-neutral-400"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-1 hover:text-red-400 text-neutral-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={e => startEditing(conv, e)}
                          className="p-1 hover:text-neutral-200 text-neutral-500"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (confirm('Delete this conversation?')) {
                              onDeleteConversation(conv.id);
                            }
                          }}
                          className="p-1 hover:text-red-400 text-neutral-500"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer / User Profile & Controls */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950/40 space-y-2">
          {/* Persona Switch (Testing helper) */}
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px]">
            <span className="text-neutral-400">Demo Persona:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => quickSwitch('admin')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  isAdmin ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Owner Admin
              </button>
              <button
                onClick={() => quickSwitch('user')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  !isAdmin ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Friend User
              </button>
            </div>
          </div>

          {/* User Status Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-neutral-200 truncate flex items-center gap-1">
                  <span>{user?.name || 'Guest User'}</span>
                  {isAdmin && (
                    <span title="Administrator">
                      <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-neutral-500 truncate">{user?.email}</div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-red-400 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
