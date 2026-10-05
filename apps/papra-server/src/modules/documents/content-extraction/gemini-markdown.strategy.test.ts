import { describe, expect, it, vi } from 'vitest';
import { extractGeminiMarkdown } from './gemini-markdown.strategy';
import { readFile, writeFile } from 'node:fs/promises';

const file = new File(['PDF-source-bytes'], 'test.pdf', { type: 'application/pdf' });
const args = { file, apiKey: 'test-key', model: 'test-model', timeoutMs: 1000 };
describe('Gemini Markdown OCR', () => {
  it.skipIf(!process.env.GEMINI_OCR_TEST_API_KEY || !process.env.GEMINI_OCR_TEST_PDF)(
    'transcribes a real PDF into headings and a table',
    async () => {
      const bytes = await readFile(process.env.GEMINI_OCR_TEST_PDF!);
      const { text } = await extractGeminiMarkdown({
        file: new File([bytes], 'test.pdf', { type: 'application/pdf' }),
        apiKey: process.env.GEMINI_OCR_TEST_API_KEY!,
        model: 'gemini-3.5-flash-lite',
        timeoutMs: 120000,
      });
      expect(text).toMatch(/^# /m);
      expect(text).toContain('|');
      expect(text).toContain('20000');
      if (process.env.GEMINI_OCR_TEST_OUTPUT)
        await writeFile(process.env.GEMINI_OCR_TEST_OUTPUT, text);
    },
    120000,
  );
  it('sends the original document and preserves structured Markdown', async () => {
    const markdown = '# Invoice\n\n| Item | Price |\n| --- | --- |\n| Pen | 12 |';
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: `\x60\x60\x60markdown\n${markdown}\n\x60\x60\x60` }] },
            },
          ],
        }),
      ),
    );
    expect(await extractGeminiMarkdown({ ...args, request })).toEqual({ text: markdown });
    const body = JSON.parse(request.mock.calls[0]?.[1]?.body as string) as {
      contents: { parts: { inlineData: { mimeType: string; data: string } }[] }[];
      systemInstruction: { parts: { text: string }[] };
    };
    expect(body.contents[0]?.parts[0]?.inlineData).toEqual({
      mimeType: 'application/pdf',
      data: Buffer.from('PDF-source-bytes').toString('base64'),
    });
    expect(body.systemInstruction.parts[0]?.text).toContain('not a summary');
  });
  it('rejects truncated OCR instead of saving incomplete content', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '# Partial' }] } }],
        }),
      ),
    );
    await expect(extractGeminiMarkdown({ ...args, request })).rejects.toThrow(
      'complete transcription',
    );
  });
  it('reports API errors without including credentials or document contents', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('test-key private document', { status: 429 }));
    await expect(extractGeminiMarkdown({ ...args, request })).rejects.toThrow('HTTP 429');
  });
  it('rejects an empty successful response', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [] } }] }),
        ),
      );
    await expect(extractGeminiMarkdown({ ...args, request })).rejects.toThrow('empty content');
  });
});
