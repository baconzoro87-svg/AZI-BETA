import { PDFParse } from 'pdf-parse';
import { Attachment } from './types.js';

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024; // 12 MB max per file
const MAX_TEXT_EXTRACT_CHARS = 120000; // ~30,000 tokens of text context

// Allowed image MIME types
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// Allowed text-based / document extensions
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'json', 'xml', 'yaml', 'yml', 'html', 'css',
  'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'php',
  'rb', 'sql', 'sh', 'bash', 'zsh', 'env', 'log', 'ini', 'toml', 'tex', 'rst'
]);

/**
 * Validate and process an incoming raw attachment payload.
 */
export async function processAttachment(raw: {
  name: string;
  size: number;
  type: string;
  base64Data: string; // base64 string without data prefix or with data prefix
}): Promise<{
  attachment: Attachment;
  error?: string;
}> {
  const { name, size, type, base64Data } = raw;

  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      attachment: {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        size,
        type,
        category: 'document',
      },
      error: `File "${name}" exceeds the maximum 12 MB upload limit.`,
    };
  }

  // Clean base64 string
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const mimeType = type || 'application/octet-stream';
  const extension = (name.split('.').pop() || '').toLowerCase();

  // 1. Image Processing
  if (SUPPORTED_IMAGE_TYPES.has(mimeType) || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
    const validMime = SUPPORTED_IMAGE_TYPES.has(mimeType) ? mimeType : (extension === 'png' ? 'image/png' : 'image/jpeg');
    const dataUrl = `data:${validMime};base64,${cleanBase64}`;
    return {
      attachment: {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        size,
        type: validMime,
        category: 'image',
        dataUrl,
      },
    };
  }

  // 2. PDF Processing
  if (mimeType === 'application/pdf' || extension === 'pdf') {
    try {
      const buffer = Buffer.from(cleanBase64, 'base64');
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      const text = (textResult.text || '').trim();
      try {
        await parser.destroy();
      } catch {}

      if (!text) {
        return {
          attachment: {
            id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name,
            size,
            type: 'application/pdf',
            category: 'document',
            extractedText: '[PDF contains no extractable text or consists exclusively of scanned raster images.]',
          },
        };
      }

      const truncated = text.length > MAX_TEXT_EXTRACT_CHARS
        ? text.slice(0, MAX_TEXT_EXTRACT_CHARS) + `\n\n[... Truncated: File exceeded ${MAX_TEXT_EXTRACT_CHARS} characters limit ...]`
        : text;

      return {
        attachment: {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name,
          size,
          type: 'application/pdf',
          category: 'document',
          extractedText: truncated,
        },
      };
    } catch (err: any) {
      return {
        attachment: {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name,
          size,
          type: 'application/pdf',
          category: 'document',
        },
        error: `Failed to extract text from PDF "${name}": ${err.message || 'Corrupted or encrypted PDF'}`,
      };
    }
  }

  // 3. Text & Source Code Processing
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/csv' ||
    TEXT_EXTENSIONS.has(extension)
  ) {
    try {
      const buffer = Buffer.from(cleanBase64, 'base64');
      const text = buffer.toString('utf-8');

      const truncated = text.length > MAX_TEXT_EXTRACT_CHARS
        ? text.slice(0, MAX_TEXT_EXTRACT_CHARS) + `\n\n[... Truncated: File exceeded ${MAX_TEXT_EXTRACT_CHARS} characters limit ...]`
        : text;

      const isCode = ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'sql', 'html', 'css'].includes(extension);

      return {
        attachment: {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name,
          size,
          type: mimeType || 'text/plain',
          category: isCode ? 'code' : 'document',
          extractedText: truncated,
        },
      };
    } catch (err: any) {
      return {
        attachment: {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name,
          size,
          type: mimeType,
          category: 'document',
        },
        error: `Could not parse text document "${name}": ${err.message}`,
      };
    }
  }

  // 4. Unsupported Binary Format
  return {
    attachment: {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      size,
      type: mimeType,
      category: 'document',
    },
    error: `Unsupported binary format for "${name}". Please upload text, code, PDF, or image files (JPEG, PNG, WebP).`,
  };
}
