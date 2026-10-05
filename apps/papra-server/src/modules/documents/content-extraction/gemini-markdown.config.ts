import type { AppConfigDefinition } from '../../config/config.types';
import * as v from 'valibot';

export const geminiMarkdownConfig = {
  apiKey: {
    doc: 'Gemini API key for structured document OCR.',
    schema: v.optional(v.string()),
    env: 'GEMINI_API_KEY',
    default: undefined,
  },
  model: {
    doc: 'Gemini vision model for Markdown OCR.',
    schema: v.string(),
    env: 'CONTENT_EXTRACTION_GEMINI_MODEL',
    default: 'gemini-3.5-flash-lite',
  },
  timeoutMs: {
    doc: 'Gemini OCR request timeout in milliseconds.',
    schema: v.pipe(v.number(), v.minValue(1000)),
    env: 'CONTENT_EXTRACTION_GEMINI_TIMEOUT_MS',
    default: 120000,
  },
} as const satisfies AppConfigDefinition;
