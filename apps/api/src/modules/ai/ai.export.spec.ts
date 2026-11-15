import { describe, expect, it } from 'vitest';
import {
  type ExportableChatData,
  parseMarkdownBlocks,
  redactMonetaryAmounts,
  renderChatDocxBuffer,
  renderChatMarkdown,
  renderChatPdfBuffer,
  sanitizeExportFilename,
} from './ai.export.js';

const sampleChat: ExportableChatData = {
  id: 'chat-export-1',
  title: 'Q4 Net Worth & Budget Review!',
  tokenCount: 412,
  createdAt: '2026-11-15T10:00:00.000Z',
  updatedAt: '2026-11-15T10:05:00.000Z',
  familyName: 'Nusantara Household',
  baseCurrency: 'IDR',
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Summarize my Rp 18,500,000 savings and $1,250.00 brokerage holdings.',
      toolCalls: null,
      createdAt: '2026-11-15T10:00:00.000Z',
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: [
        '## Portfolio Summary',
        '- Cash reserve is Rp 18,500,000 in BCA.',
        '- Equities stand at $1,250.00.',
        '',
        '| Account | Balance |',
        '| --- | --- |',
        '| BCA Savings | Rp 18,500,000 |',
        '| Brokerage | $1,250.00 |',
      ].join('\n'),
      toolCalls: [
        { toolName: 'get_net_worth', resultSummary: 'Net worth Rp 38,500,000' },
      ],
      createdAt: '2026-11-15T10:00:05.000Z',
    },
  ],
};

describe('AI Chat Export Engine Unit Tests', () => {
  it('sanitizes filenames across extensions and empty fallback', () => {
    expect(sanitizeExportFilename('Q4 Net Worth & Budget Review!', 'pdf')).toBe(
      'sure-ai-q4-net-worth-budget-review.pdf'
    );
    expect(sanitizeExportFilename('***', 'docx')).toBe('sure-ai-chat.docx');
    expect(sanitizeExportFilename('Monthly Plan', 'md')).toBe('sure-ai-monthly-plan.md');
  });

  it('redacts prefixed currencies and grouped numbers when Privacy Mode redaction is active', () => {
    const input = 'Checking has Rp 18,500,000 and USD 1,250.50 plus $950 in brokerage (total 19,750).';
    const redacted = redactMonetaryAmounts(input);
    expect(redacted).not.toContain('18,500,000');
    expect(redacted).not.toContain('1,250.50');
    expect(redacted).not.toContain('950');
    expect(redacted).not.toContain('19,750');
    expect(redacted).toContain('[REDACTED]');
  });

  it('parses markdown headings, bullet lists, tables, and paragraphs accurately', () => {
    const blocks = parseMarkdownBlocks(sampleChat.messages[1]!.content);
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toEqual({ kind: 'heading', level: 2, text: 'Portfolio Summary' });
    expect(blocks[1]).toEqual({
      kind: 'list',
      bullet: '•',
      text: 'Cash reserve is Rp 18,500,000 in BCA.',
    });
    expect(blocks[2]).toEqual({ kind: 'list', bullet: '•', text: 'Equities stand at $1,250.00.' });
    expect(blocks[3]).toEqual({
      kind: 'table',
      headers: ['Account', 'Balance'],
      rows: [
        ['BCA Savings', 'Rp 18,500,000'],
        ['Brokerage', '$1,250.00'],
      ],
    });
  });

  it('renders Markdown export with and without monetary redaction', () => {
    const plainMd = renderChatMarkdown(sampleChat);
    expect(plainMd).toContain('# Q4 Net Worth & Budget Review!');
    expect(plainMd).toContain('**Workspace:** Nusantara Household (IDR)');
    expect(plainMd).toContain('## User (2026-11-15 10:00:00 UTC)');
    expect(plainMd).toContain('Rp 18,500,000');
    expect(plainMd).toContain('_Ledger/Model Audit: get_net_worth: Net worth Rp 38,500,000_');

    const redactedMd = renderChatMarkdown(sampleChat, { redactAmounts: true });
    expect(redactedMd).not.toContain('18,500,000');
    expect(redactedMd).not.toContain('1,250.00');
    expect(redactedMd).not.toContain('38,500,000');
    expect(redactedMd).toContain('[REDACTED]');
  });

  it('generates a valid OOXML (.docx) ZIP archive buffer', async () => {
    const buffer = await renderChatDocxBuffer(sampleChat);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // DOCX files are ZIP containers starting with PK magic bytes
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it('generates a valid PDF document buffer and omits dollar/Rp figures when redacted', async () => {
    const plainPdf = await renderChatPdfBuffer(sampleChat);
    expect(Buffer.isBuffer(plainPdf)).toBe(true);
    expect(plainPdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(plainPdf.length).toBeGreaterThan(1000);

    const redactedPdf = await renderChatPdfBuffer(sampleChat, { redactAmounts: true });
    expect(redactedPdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(redactedPdf.length).toBeGreaterThan(1000);
  });
});
