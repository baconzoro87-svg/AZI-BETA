import React, { useState } from 'react';
import { marked } from 'marked';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  // Configure marked options
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  // Extract code blocks to render customized code containers with copy buttons
  const renderFormatted = () => {
    try {
      const rawHtml = marked.parse(content) as string;
      return { __html: rawHtml };
    } catch {
      return { __html: content };
    }
  };

  return (
    <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed space-y-2 select-text break-words
      [&_pre]:bg-neutral-900/90 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-neutral-800 [&_pre]:overflow-x-auto [&_pre]:my-3
      [&_code]:font-mono [&_code]:text-xs [&_code]:text-indigo-300 dark:[&_code]:text-indigo-200 [&_code]:bg-neutral-800/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
      [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-neutral-100
      [&_p]:my-1.5
      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2
      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2
      [&_li]:my-0.5
      [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-xs
      [&_th]:border [&_th]:border-neutral-700 [&_th]:bg-neutral-800/70 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold
      [&_td]:border [&_td]:border-neutral-800 [&_td]:px-3 [&_td]:py-2
      [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-neutral-400 [&_blockquote]:my-2
      [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
      [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5
      [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
      [&_hr]:border-neutral-800 [&_hr]:my-3
    ">
      <div dangerouslySetInnerHTML={renderFormatted()} />
    </div>
  );
};
