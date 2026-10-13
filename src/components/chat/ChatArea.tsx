import React, { useState, useRef, useEffect } from 'react';
import { ModelItem, Message, Conversation, Attachment } from '../../types';
import { ModelSelector } from './ModelSelector';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  Send,
  Square,
  RotateCw,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  Bot,
  User,
  Menu,
  KeyRound,
  Paperclip,
  Image as ImageIcon,
  FileText,
  FileCode,
  X,
  Upload,
  Eye,
  Download,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface PendingAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  category: 'image' | 'document' | 'code';
  base64Data: string;
  dataUrl?: string;
}

interface ChatAreaProps {
  models: ModelItem[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  messages: Message[];
  activeConversation: Conversation | null;
  onSendMessage: (content: string, attachments?: PendingAttachment[]) => void;
  onRegenerateMessage: () => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  streamingChunk: string;
  error: string | null;
  onToggleSidebar: () => void;
  onOpenAdmin: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  messages,
  activeConversation,
  onSendMessage,
  onRegenerateMessage,
  isStreaming,
  onStopStreaming,
  streamingChunk,
  error,
  onToggleSidebar,
  onOpenAdmin,
}) => {
  const { user, isAdmin } = useAuth();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedModel = models.find(m => m.id === selectedModelId || m.actualModelId === selectedModelId) || models[0];

  const hasImageAttachment = attachments.some(a => a.category === 'image');
  const supportsVision = selectedModel?.supportsVision ?? (
    ['opus-5.5', 'luna-5.6', 'gemini-2.5-flash'].includes(selectedModel?.id || '') ||
    ['claude-opus-5.5', 'luna-5.6', 'gemini-2.5-flash'].includes(selectedModel?.actualModelId || '')
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingChunk]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachmentError(null);

    const fileArray = Array.from(files);
    fileArray.forEach(file => {
      if (file.size > 12 * 1024 * 1024) {
        setAttachmentError(`"${file.name}" exceeds the maximum 12 MB file limit.`);
        return;
      }

      const reader = new FileReader();
      const isImg = file.type.startsWith('image/');
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const isCode = ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'sql', 'html', 'css', 'json'].includes(ext);

      reader.onload = () => {
        const resultStr = reader.result as string;
        const newAtt: PendingAttachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          category: isImg ? 'image' : (isCode ? 'code' : 'document'),
          base64Data: resultStr,
          dataUrl: isImg ? resultStr : undefined,
        };

        setAttachments(prev => [...prev, newAtt]);
      };

      reader.onerror = () => {
        setAttachmentError(`Failed to read "${file.name}".`);
      };

      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleClearAttachments = () => {
    setAttachments([]);
    setAttachmentError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStreaming) return;
    if (!input.trim() && attachments.length === 0) return;

    if (hasImageAttachment && !supportsVision) {
      setAttachmentError(
        `Model "${selectedModel?.name}" does not support image analysis. Please select a vision model (Opus 5.5, Luna 5.6, or Gemini 2.5 Flash) before sending.`
      );
      return;
    }

    const textToSend = input.trim();
    const attachmentsToSend = [...attachments];

    setInput('');
    setAttachments([]);
    setAttachmentError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    onSendMessage(textToSend, attachmentsToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const examplePrompts = [
    {
      title: 'Who created you?',
      prompt: 'Who created you and who owns AZI?',
    },
    {
      title: 'Analyze Code or Architecture',
      prompt: 'What are the architectural differences between Token Harbour models and CodeCraft models?',
    },
    {
      title: 'Explain Quantum Decoherence',
      prompt: 'Explain quantum decoherence simply for an engineering student.',
    },
    {
      title: 'Document & Image Reasoning',
      prompt: 'Attach a PDF document, code file, or image to ask questions about its structure and logic.',
    },
  ];

  return (
    <div
      className="flex-1 flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-950/80 backdrop-blur-xs border-2 border-dashed border-indigo-400 flex flex-col items-center justify-center pointer-events-none p-6 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 flex items-center justify-center text-indigo-300">
            <Upload className="w-8 h-8 animate-bounce" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Drop files to attach to AZI</h3>
            <p className="text-xs text-indigo-200">Supports Images (JPEG, PNG, WebP), PDFs, Code, Markdown, CSV, and Text</p>
          </div>
        </div>
      )}

      {/* Top Bar for Chat Header */}
      <header className="h-14 border-b border-neutral-800/80 px-4 flex items-center justify-between bg-neutral-900/60 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <ModelSelector
            models={models}
            selectedModelId={selectedModelId}
            onSelectModel={onSelectModel}
            disabled={isStreaming}
          />
        </div>

        {/* Status indicator on top */}
        <div className="flex items-center gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-2 text-neutral-400">
            <span className="text-[11px] text-neutral-500">Model Modality:</span>
            {supportsVision ? (
              <span className="text-[10px] text-emerald-400 font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
                Text + Vision
              </span>
            ) : (
              <span className="text-[10px] text-neutral-400 font-mono font-medium px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                Text Reasoning
              </span>
            )}
          </div>

          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 hover:bg-indigo-900/50 text-xs font-medium transition-colors"
            >
              <KeyRound className="w-3 h-3" />
              <span>Owner Panel</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Message Stream Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 && !streamingChunk ? (
          // Empty State / Welcome
          <div className="max-w-2xl mx-auto py-10 px-4 text-center space-y-6">
            <div className="inline-flex p-3 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-inner">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                AZI — AZMAL INTELLIGENCE
              </h1>
              <p className="text-xs sm:text-sm text-neutral-300 max-w-lg mx-auto font-medium">
                Created by Azmal. One central infrastructure, intelligent for everyone.
              </p>
              <p className="text-xs text-neutral-400">
                Ask questions, attach images, or upload PDFs, code, and documents for instant analysis.
              </p>
            </div>

            {/* Current Active Provider Specs Banner */}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/70 text-left text-xs max-w-md mx-auto space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  <span>Active: {selectedModel?.name}</span>
                </span>
                {selectedModel?.isFree ? (
                  <span className="text-[10px] text-emerald-400 font-mono font-semibold">FREE TIER</span>
                ) : (
                  <span className="text-[10px] text-violet-400 font-mono font-semibold">PAID TIER</span>
                )}
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                {selectedModel?.description}
              </p>

              <div className="text-[10px] text-neutral-500 flex items-center gap-2 pt-1 border-t border-neutral-800/60">
                <span>Routing: {selectedModel?.providerLabel || selectedModel?.providerName}</span>
                <span>·</span>
                <span>Context: {selectedModel ? Math.round(selectedModel.contextWindow / 1000) : 64}k</span>
                <span>·</span>
                <span>Vision: {supportsVision ? 'Supported' : 'Text only'}</span>
              </div>
            </div>

            {/* Example Prompt Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl mx-auto text-left pt-2">
              {examplePrompts.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(example.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="p-3.5 rounded-xl border border-neutral-800/80 bg-neutral-900/40 hover:bg-neutral-800/60 hover:border-neutral-700 text-left transition-all group"
                >
                  <div className="text-xs font-semibold text-neutral-200 group-hover:text-indigo-300">
                    {example.title}
                  </div>
                  <div className="text-[11px] text-neutral-500 line-clamp-2 mt-1">
                    {example.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Message History
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map(msg => {
              const isUser = msg.role === 'user';
              const isCopied = copiedId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`relative group max-w-[92%] sm:max-w-[82%] rounded-2xl px-4 py-3.5 text-sm ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-neutral-900 border border-neutral-800/80 text-neutral-100 rounded-tl-none shadow-sm'
                    }`}
                  >
                    {/* Render attached files or images if present */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-3 space-y-2">
                        {/* Image Attachments */}
                        {msg.attachments.some(a => a.category === 'image' && a.dataUrl) && (
                          <div className="flex flex-wrap gap-2">
                            {msg.attachments
                              .filter(a => a.category === 'image' && a.dataUrl)
                              .map(img => (
                                <div
                                  key={img.id}
                                  onClick={() => setActivePreviewImage(img.dataUrl || null)}
                                  className="relative group/img cursor-pointer rounded-lg overflow-hidden border border-white/20 max-w-[180px] max-h-[140px]"
                                >
                                  <img
                                    src={img.dataUrl}
                                    alt={img.name}
                                    className="w-full h-full object-cover transition-transform group-hover/img:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity text-white text-xs">
                                    <Eye className="w-4 h-4 mr-1" />
                                    <span>Zoom</span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}

                        {/* Document & Code Attachments */}
                        {msg.attachments.some(a => a.category !== 'image') && (
                          <div className="flex flex-wrap gap-1.5">
                            {msg.attachments
                              .filter(a => a.category !== 'image')
                              .map(file => (
                                <div
                                  key={file.id}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                                    isUser
                                      ? 'bg-indigo-700/60 border-indigo-400/40 text-white'
                                      : 'bg-neutral-800 border-neutral-700 text-neutral-200'
                                  }`}
                                >
                                  {file.category === 'code' ? (
                                    <FileCode className="w-3.5 h-3.5 text-indigo-300" />
                                  ) : file.type.includes('pdf') ? (
                                    <FileText className="w-3.5 h-3.5 text-red-400" />
                                  ) : (
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                                  )}
                                  <span className="truncate max-w-[140px] font-mono text-[11px]">{file.name}</span>
                                  <span className="text-[10px] opacity-75 tabular-nums">
                                    ({formatFileSize(file.size)})
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    {isUser ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}

                    {/* Metadata / Action Bar */}
                    <div
                      className={`flex items-center gap-2 mt-2 pt-1 border-t text-[10px] ${
                        isUser
                          ? 'border-indigo-500/40 text-indigo-200 justify-end'
                          : 'border-neutral-800/80 text-neutral-500 justify-between'
                      }`}
                    >
                      {!isUser && (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-neutral-400">
                            {msg.modelId ? msg.modelId.replace(/:free$/, '') : selectedModel?.name}
                          </span>
                          {msg.tokensEstimated && (
                            <>
                              <span>·</span>
                              <span className="tabular-nums">~{msg.tokensEstimated} tokens</span>
                            </>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-neutral-800/50 flex items-center gap-1 text-[10px]"
                        title="Copy message"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-neutral-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-700/80 flex items-center justify-center text-white shrink-0 mt-0.5 text-xs font-semibold">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Currently Streaming Assistant Chunk */}
            {isStreaming && (
              <div className="flex gap-3 sm:gap-4 justify-start">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="max-w-[92%] sm:max-w-[82%] rounded-2xl rounded-tl-none px-4 py-3.5 bg-neutral-900 border border-neutral-800/80 text-neutral-100 shadow-sm">
                  {streamingChunk ? (
                    <MarkdownRenderer content={streamingChunk} />
                  ) : (
                    <div className="flex items-center gap-2 py-1 text-xs text-neutral-400">
                      <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                      <span>AZI is generating streaming response...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Notification Banner */}
            {error && (
              <div className="p-3.5 rounded-xl border border-red-900/60 bg-red-950/40 text-red-300 text-xs flex items-start gap-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div className="flex-1 space-y-2">
                  <div className="font-semibold text-red-200">Request Error</div>
                  <p className="text-red-300/90 leading-relaxed">{error}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={onRegenerateMessage}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Retry Request</span>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={onOpenAdmin}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition-colors"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Manage API Keys</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer Area */}
      <div className="p-3 sm:p-4 border-t border-neutral-800/80 bg-neutral-900/70 backdrop-blur-md shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Action Row: Stop or Regenerate */}
          <div className="flex items-center justify-between text-xs px-1 text-neutral-500">
            <div className="flex items-center gap-3">
              {isStreaming ? (
                <button
                  onClick={onStopStreaming}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors shadow-sm"
                >
                  <Square className="w-3 h-3 text-red-400 fill-red-400" />
                  <span>Stop generating</span>
                </button>
              ) : messages.length > 0 ? (
                <button
                  onClick={onRegenerateMessage}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Regenerate answer</span>
                </button>
              ) : null}
            </div>

            <div className="text-[11px] text-neutral-500 hidden sm:block">
              Shift + Enter for new line · Drag & drop files
            </div>
          </div>

          {/* Attachment Error Notice */}
          {attachmentError && (
            <div className="p-2.5 px-3 rounded-lg bg-red-950/60 border border-red-900/60 text-red-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{attachmentError}</span>
              </div>
              <button onClick={() => setAttachmentError(null)} className="text-red-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Model Unavailable Banner */}
          {!selectedModel?.isAvailable && (
            <div className="p-2.5 px-3 rounded-lg bg-amber-950/40 border border-amber-900/50 text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>{selectedModel?.name}</strong> is currently unavailable ({selectedModel?.availabilityReason || 'API key required'}).
                </span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="text-[11px] underline font-semibold text-amber-200 hover:text-white shrink-0 ml-2"
                >
                  Configure Key
                </button>
              )}
            </div>
          )}

          {/* Vision Capability Warning if images are attached to non-vision model */}
          {hasImageAttachment && !supportsVision && (
            <div className="p-2.5 px-3 rounded-lg bg-amber-950/50 border border-amber-800/60 text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>{selectedModel?.name}</strong> does not support image input. Switch to Opus 5.5, Luna 5.6, or Gemini 2.5 Flash to send images.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const visionModel = models.find(m => m.supportsVision || m.id === 'opus-5.5' || m.id === 'gemini-2.5-flash');
                  if (visionModel) onSelectModel(visionModel.id);
                }}
                className="text-[11px] font-bold text-amber-200 underline hover:text-white shrink-0 ml-2"
              >
                Switch Model
              </button>
            </div>
          )}

          {/* Attachment Previews Bar */}
          {attachments.length > 0 && (
            <div className="p-2.5 rounded-xl border border-neutral-800 bg-neutral-950/80 flex items-center gap-2 overflow-x-auto">
              {attachments.map(att => (
                <div
                  key={att.id}
                  className="relative group/att flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border border-neutral-700/80 bg-neutral-900 shrink-0 text-xs max-w-[200px]"
                >
                  {att.category === 'image' && att.dataUrl ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="w-8 h-8 rounded object-cover ring-1 ring-neutral-700"
                    />
                  ) : att.category === 'code' ? (
                    <FileCode className="w-5 h-5 text-indigo-400 shrink-0 ml-1" />
                  ) : att.type.includes('pdf') ? (
                    <FileText className="w-5 h-5 text-red-400 shrink-0 ml-1" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0 ml-1" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] text-neutral-200">{att.name}</p>
                    <p className="text-[10px] text-neutral-500 tabular-nums">{formatFileSize(att.size)}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="p-1 rounded-full text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                    title="Remove attachment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {attachments.length > 1 && (
                <button
                  type="button"
                  onClick={handleClearAttachments}
                  className="text-[11px] text-neutral-400 hover:text-red-400 font-medium whitespace-nowrap px-2"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Hidden File Picker Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.md,.markdown,.csv,.json,.ts,.tsx,.js,.jsx,.py,.java,.cpp,.c,.cs,.sql,.html,.css"
            className="hidden"
            onChange={e => handleFileSelect(e.target.files)}
          />

          {/* Form Textarea & Controls */}
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end rounded-2xl border border-neutral-700/80 bg-neutral-950 focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all shadow-lg"
          >
            {/* Attachment Button */}
            <div className="p-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                title="Attach image or document (PDF, Code, Text)"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            </div>

            {/* Input Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedModel?.isAvailable
                  ? `Message AZI with ${selectedModel?.name} (${selectedModel?.providerLabel || selectedModel?.providerName})...`
                  : `${selectedModel?.name} is unavailable. Select another model or configure credentials.`
              }
              className="w-full bg-transparent px-2 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none resize-none max-h-40 leading-relaxed"
            />

            {/* Send Button */}
            <div className="p-2 shrink-0">
              <button
                type="submit"
                disabled={
                  (!input.trim() && attachments.length === 0) ||
                  isStreaming ||
                  !selectedModel?.isAvailable ||
                  (hasImageAttachment && !supportsVision)
                }
                className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-35 disabled:hover:bg-indigo-600 text-white flex items-center justify-center transition-all shadow-md active:scale-95"
                title={
                  !selectedModel?.isAvailable
                    ? 'Model is unavailable'
                    : hasImageAttachment && !supportsVision
                    ? 'Selected model does not support images'
                    : 'Send message'
                }
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Lightbox Image Preview Modal */}
      {activePreviewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActivePreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={activePreviewImage}
              alt="Enlarged attachment"
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl ring-1 ring-white/20"
            />
            <button
              onClick={() => setActivePreviewImage(null)}
              className="absolute -top-3 -right-3 p-1.5 rounded-full bg-neutral-900 border border-neutral-700 text-white hover:bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
