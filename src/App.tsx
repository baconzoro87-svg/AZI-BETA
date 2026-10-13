/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { ChatSidebar } from './components/chat/ChatSidebar';
import { ChatArea, PendingAttachment } from './components/chat/ChatArea';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ModelsDirectory } from './components/models/ModelsDirectory';
import { FairUsageView } from './components/usage/FairUsageView';
import { DeploymentGuideModal } from './components/deployment/DeploymentGuideModal';
import { AuthModal } from './components/auth/AuthModal';
import { ModelItem, Conversation, Message } from './types';
import { api } from './services/api';

function MainApp() {
  const { user, isAdmin, refreshUser } = useAuth();

  // State
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('deepseek-v4.1-flash:free');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingChunk, setStreamingChunk] = useState('');
  const [error, setError] = useState<string | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  // Modal / Drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // 1. Fetch public models & system defaults
  const loadModels = async () => {
    try {
      const data = await api.getPublicModels();
      setModels(data.models);
      if (data.defaultModelId) {
        setSelectedModelId(prev => (prev ? prev : data.defaultModelId));
      } else if (data.models.length > 0) {
        setSelectedModelId(data.models[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load models:', err);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  // 2. Fetch conversations when user changes
  const loadConversations = async () => {
    if (!user) {
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      return;
    }
    try {
      const list = await api.getConversations();
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        setActiveConversationId(list[0].id);
        loadMessages(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [user]);

  // 3. Load messages for active conversation
  const loadMessages = async (convId: string) => {
    setError(null);
    try {
      const data = await api.getConversationMessages(convId);
      setMessages(data.messages);
      if (data.conversation.modelId) {
        setSelectedModelId(data.conversation.modelId);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    loadMessages(id);
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setStreamingChunk('');
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        handleNewConversation();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const updated = await api.renameConversation(id, newTitle);
      setConversations(prev => prev.map(c => (c.id === id ? updated : c)));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSwitchModel = async (newModelId: string) => {
    setSelectedModelId(newModelId);
    if (activeConversationId) {
      try {
        await api.updateConversationModel(activeConversationId, newModelId);
        setConversations(prev =>
          prev.map(c => (c.id === activeConversationId ? { ...c, modelId: newModelId } : c))
        );
      } catch (err: any) {
        console.error('Failed to update conversation model:', err);
      }
    }
  };

  // 4. Send Message & SSE Stream
  const handleSendMessage = async (text: string, attachmentsToSend?: PendingAttachment[]) => {
    const hasAttachments = Array.isArray(attachmentsToSend) && attachmentsToSend.length > 0;
    if ((!text.trim() && !hasAttachments) || isStreaming) return;

    setError(null);
    setIsStreaming(true);
    setStreamingChunk('');

    const optimisticAttachments = attachmentsToSend?.map(a => ({
      id: a.id,
      name: a.name,
      size: a.size,
      type: a.type,
      category: a.category,
      dataUrl: a.category === 'image' ? (a.dataUrl || a.base64Data) : undefined,
    }));

    // Optimistically append user message to UI
    const tempUserMsg: Message = {
      id: `temp_u_${Date.now()}`,
      conversationId: activeConversationId || '',
      role: 'user',
      content: text || (hasAttachments ? `Attached: ${attachmentsToSend!.map(a => a.name).join(', ')}` : ''),
      modelId: selectedModelId,
      createdAt: new Date().toISOString(),
      attachments: optimisticAttachments,
    };
    setMessages(prev => [...prev, tempUserMsg]);

    const historyForAPI = messages.map(m => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments,
    }));

    let currentConvId = activeConversationId;
    let accumulatedText = '';

    stopStreamRef.current = api.streamChat({
      conversationId: currentConvId || undefined,
      modelId: selectedModelId,
      content: text,
      attachments: attachmentsToSend?.map(a => ({
        name: a.name,
        size: a.size,
        type: a.type,
        base64Data: a.base64Data,
      })),
      messagesHistory: historyForAPI,
      onInit: data => {
        if (!currentConvId) {
          currentConvId = data.conversationId;
          setActiveConversationId(data.conversationId);
          loadConversations();
        }
      },
      onChunk: chunk => {
        accumulatedText += chunk;
        setStreamingChunk(accumulatedText);
      },
      onDone: data => {
        setIsStreaming(false);
        setStreamingChunk('');
        const assistantMsg: Message = {
          id: data.messageId,
          conversationId: data.conversationId,
          role: 'assistant',
          content: accumulatedText,
          modelId: selectedModelId,
          tokensEstimated: data.tokens,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMsg]);
        loadConversations();
        refreshUser();
      },
      onError: errMsg => {
        setIsStreaming(false);
        setStreamingChunk('');
        setError(errMsg);
      },
    });
  };

  const handleStopStreaming = () => {
    if (stopStreamRef.current) {
      stopStreamRef.current();
      stopStreamRef.current = null;
    }
    setIsStreaming(false);
    if (streamingChunk) {
      const partialMsg: Message = {
        id: `partial_${Date.now()}`,
        conversationId: activeConversationId || '',
        role: 'assistant',
        content: streamingChunk + ' [Generation stopped]',
        modelId: selectedModelId,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, partialMsg]);
      setStreamingChunk('');
    }
  };

  const handleRegenerate = () => {
    if (messages.length === 0 || isStreaming) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      // Remove last assistant message if present
      if (messages[messages.length - 1].role === 'assistant') {
        setMessages(prev => prev.slice(0, prev.length - 1));
      }
      handleSendMessage(lastUserMsg.content);
    }
  };

  const activeConv = conversations.find(c => c.id === activeConversationId) || null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      {/* Top Bar */}
      <Navbar
        onOpenModels={() => setShowModels(true)}
        onOpenUsage={() => setShowUsage(true)}
        onOpenAdmin={() => setShowAdmin(true)}
        onOpenGuide={() => setShowGuide(true)}
        onOpenAuth={() => setShowAuth(true)}
      />

      {/* Main App Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpenAdmin={() => setShowAdmin(true)}
          onOpenUsage={() => setShowUsage(true)}
          onOpenModels={() => setShowModels(true)}
        />

        <ChatArea
          models={models}
          selectedModelId={selectedModelId}
          onSelectModel={handleSwitchModel}
          messages={messages}
          activeConversation={activeConv}
          onSendMessage={handleSendMessage}
          onRegenerateMessage={handleRegenerate}
          isStreaming={isStreaming}
          onStopStreaming={handleStopStreaming}
          streamingChunk={streamingChunk}
          error={error}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
          onOpenAdmin={() => setShowAdmin(true)}
        />
      </div>

      {/* Modals */}
      {showAdmin && (
        <AdminDashboard
          onClose={() => setShowAdmin(false)}
          onRefreshPublicModels={loadModels}
        />
      )}

      {showModels && (
        <ModelsDirectory
          models={models}
          defaultModelId={selectedModelId}
          onSelectModel={handleSwitchModel}
          onClose={() => setShowModels(false)}
        />
      )}

      {showUsage && (
        <FairUsageView onClose={() => setShowUsage(false)} />
      )}

      {showGuide && (
        <DeploymentGuideModal onClose={() => setShowGuide(false)} />
      )}

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
