import PDFDocument from 'pdfkit';
import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

export interface ExportableChatMessage {
  id: string;
  role: string;
  content: string;
  toolCalls: unknown;
  createdAt: Date | string;
}

export interface ExportableChatData {
  id: string;
  title: string;
  tokenCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  familyName: string;
  baseCurrency: string;
  messages: ExportableChatMessage[];
}

export interface ChatExportOptions {
  redactAmounts?: boolean;
}

type ParsedBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'list'; bullet: string; text: string }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'paragraph'; text: string };

export function sanitizeExportFilename(title: string, ext: 'pdf' | 'docx' | 'md'): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `sure-ai-${slug || 'chat'}.${ext}`;
}

export function redactMonetaryAmounts(text: string): string {
  return text
    .replace(/(?:Rp|USD|IDR|EUR|GBP|SGD|JPY|AUD|MYR|\$|€|£|¥)\s*-?[\d.,]+(?:\.\d+)?/gi, '[REDACTED]')
    .replace(/\b\d{1,3}(?:[.,]\d{3})+(?:\.\d{2,4})?\b/g, '[REDACTED]')
    .replace(/(?<![.\w])-?\d+\.\d{2,4}(?![.\w])/g, '[REDACTED]');
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .trim();
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => stripInlineMarkdown(cell));
}

function isMarkdownDividerRow(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());
}

export function parseMarkdownBlocks(rawText: string): ParsedBlock[] {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Markdown Table block
    if (trimmed.includes('|') && i + 1 < lines.length && isMarkdownDividerRow(lines[i + 1] ?? '')) {
      const headers = parseTableRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length) {
        const rowLine = (lines[i] ?? '').trim();
        if (!rowLine || !rowLine.includes('|')) break;
        rows.push(parseTableRow(rowLine));
        i += 1;
      }
      blocks.push({ kind: 'table', headers, rows });
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(3, headingMatch[1]!.length) as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, text: stripInlineMarkdown(headingMatch[2]!) });
      i += 1;
      continue;
    }

    // Bullet / numbered list
    const bulletMatch = trimmed.match(/^([•*-]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const marker = bulletMatch[1] === '*' || bulletMatch[1] === '-' ? '•' : bulletMatch[1]!;
      blocks.push({ kind: 'list', bullet: marker, text: stripInlineMarkdown(bulletMatch[2]!) });
      i += 1;
      continue;
    }

    // Regular paragraph (merge consecutive plain lines)
    const paraLines: string[] = [stripInlineMarkdown(trimmed)];
    i += 1;
    while (i < lines.length) {
      const next = (lines[i] ?? '').trim();
      if (
        !next ||
        /^(#{1,3})\s+/.test(next) ||
        /^([•*-]|\d+\.)\s+/.test(next) ||
        (next.includes('|') && i + 1 < lines.length && isMarkdownDividerRow(lines[i + 1] ?? ''))
      ) {
        break;
      }
      paraLines.push(stripInlineMarkdown(next));
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: paraLines.join(' ') });
  }

  return blocks;
}

function formatIsoTimestamp(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function summarizeToolCalls(toolCalls: unknown): string {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return '';
  const items = toolCalls
    .map((tc) => {
      if (!tc || typeof tc !== 'object') return '';
      const entry = tc as { toolName?: string; resultSummary?: string };
      return entry.resultSummary ? `${entry.toolName ?? 'tool'}: ${entry.resultSummary}` : entry.toolName ?? '';
    })
    .filter(Boolean);
  return items.join(' · ');
}

export function renderChatMarkdown(
  chat: ExportableChatData,
  options: ChatExportOptions = {}
): string {
  const redact = Boolean(options.redactAmounts);
  const displayTitle = redact ? redactMonetaryAmounts(chat.title) : chat.title;
  const lines: string[] = [
    `# ${displayTitle}`,
    '',
    `- **Workspace:** ${chat.familyName} (${chat.baseCurrency})`,
    `- **Conversation ID:** \`${chat.id}\``,
    `- **Updated:** ${formatIsoTimestamp(chat.updatedAt)}`,
    `- **Total Tokens:** ${chat.tokenCount}`,
    `- **Monetary Values:** ${redact ? 'Redacted (Privacy Mode)' : 'Full Precision'}`,
    '',
    '---',
    '',
  ];

  for (const msg of chat.messages) {
    const speaker = msg.role.toUpperCase() === 'USER' ? 'User' : 'Sure AI Financial Assistant';
    const content = redact ? redactMonetaryAmounts(msg.content) : msg.content;
    const toolsText = summarizeToolCalls(msg.toolCalls);

    lines.push(`## ${speaker} (${formatIsoTimestamp(msg.createdAt)})`);
    lines.push('');
    lines.push(content);
    if (toolsText) {
      lines.push('');
      lines.push(`> _Ledger/Model Audit: ${redact ? redactMonetaryAmounts(toolsText) : toolsText}_`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('_Generated by Sure AI Financial Assistant._');
  return lines.join('\n');
}

export async function renderChatDocxBuffer(
  chat: ExportableChatData,
  options: ChatExportOptions = {}
): Promise<Buffer> {
  const redact = Boolean(options.redactAmounts);
  const displayTitle = redact ? redactMonetaryAmounts(chat.title) : chat.title;
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      text: displayTitle,
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Workspace: ', bold: true }),
        new TextRun(`${chat.familyName} (${chat.baseCurrency})    `),
        new TextRun({ text: 'Updated: ', bold: true }),
        new TextRun(`${formatIsoTimestamp(chat.updatedAt)}    `),
        new TextRun({ text: 'Tokens: ', bold: true }),
        new TextRun(`${chat.tokenCount}`),
      ],
      spacing: { after: redact ? 80 : 240 },
    }),
  ];

  if (redact) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Privacy Mode Enabled — monetary amounts redacted in this export.',
            italics: true,
            color: '6B7280',
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  for (const msg of chat.messages) {
    const isUser = msg.role.toUpperCase() === 'USER';
    const speaker = isUser ? 'User' : 'Sure AI Financial Assistant';
    const content = redact ? redactMonetaryAmounts(msg.content) : msg.content;

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${speaker}`,
            bold: true,
            color: isUser ? '1D4ED8' : '047857',
            size: 24,
          }),
          new TextRun({
            text: `  •  ${formatIsoTimestamp(msg.createdAt)}`,
            color: '6B7280',
            size: 18,
          }),
        ],
        spacing: { before: 200, after: 80 },
      })
    );

    const blocks = parseMarkdownBlocks(content);
    for (const block of blocks) {
      if (block.kind === 'heading') {
        children.push(
          new Paragraph({
            text: block.text,
            heading:
              block.level === 1
                ? HeadingLevel.HEADING_1
                : block.level === 2
                  ? HeadingLevel.HEADING_2
                  : HeadingLevel.HEADING_3,
            spacing: { before: 120, after: 60 },
          })
        );
      } else if (block.kind === 'list') {
        children.push(
          new Paragraph({
            children: [new TextRun(`${block.bullet} ${block.text}`)],
            indent: { left: 320 },
            spacing: { after: 60 },
          })
        );
      } else if (block.kind === 'table' && block.headers.length > 0) {
        const colCount = block.headers.length;
        const headerRow = new TableRow({
          children: block.headers.map(
            (h) =>
              new TableCell({
                shading: { type: ShadingType.SOLID, color: 'F3F4F6', fill: 'F3F4F6' },
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })],
              })
          ),
        });
        const bodyRows = block.rows.map(
          (row) =>
            new TableRow({
              children: Array.from({ length: colCount }, (_, idx) => {
                const cellVal = row[idx] ?? '';
                return new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: cellVal, size: 18 })] })],
                });
              }),
            })
        );
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
              left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
              insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
            },
            rows: [headerRow, ...bodyRows],
          })
        );
        children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      } else if (block.kind === 'paragraph') {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: block.text, size: 21 })],
            spacing: { after: 90 },
          })
        );
      }
    }

    const toolsText = summarizeToolCalls(msg.toolCalls);
    if (toolsText) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Audit: ${redact ? redactMonetaryAmounts(toolsText) : toolsText}`,
              italics: true,
              color: '6B7280',
              size: 17,
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

export async function renderChatPdfBuffer(
  chat: ExportableChatData,
  options: ChatExportOptions = {}
): Promise<Buffer> {
  const redact = Boolean(options.redactAmounts);
  const displayTitle = redact ? redactMonetaryAmounts(chat.title) : chat.title;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: {
        Title: displayTitle,
        Author: 'Sure Financial Assistant',
        Subject: `${chat.familyName} (${chat.baseCurrency}) AI Conversation Export`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const ensureSpace = (neededHeight: number) => {
      const bottomLimit = doc.page.height - doc.page.margins.bottom;
      if (doc.y + neededHeight > bottomLimit) {
        doc.addPage();
      }
    };

    // Document Header
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#111827').text(displayTitle);
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6B7280')
      .text(
        `Workspace: ${chat.familyName} (${chat.baseCurrency})  •  Updated: ${formatIsoTimestamp(chat.updatedAt)}  •  Tokens: ${chat.tokenCount}${redact ? '  •  Privacy Redacted' : ''}`
      );
    doc.moveDown(0.5);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor('#E5E7EB')
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.8);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    for (const msg of chat.messages) {
      ensureSpace(44);
      const isUser = msg.role.toUpperCase() === 'USER';
      const speaker = isUser ? 'User' : 'Sure AI Financial Assistant';
      const content = redact ? redactMonetaryAmounts(msg.content) : msg.content;

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(isUser ? '#1D4ED8' : '#047857')
        .text(`${speaker}`, { continued: true });
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#6B7280')
        .text(`   (${formatIsoTimestamp(msg.createdAt)})`);
      doc.moveDown(0.3);

      const blocks = parseMarkdownBlocks(content);
      for (const block of blocks) {
        if (block.kind === 'heading') {
          ensureSpace(24);
          const fontSize = block.level === 1 ? 13 : block.level === 2 ? 11.5 : 10.5;
          doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#111827').text(block.text);
          doc.moveDown(0.25);
        } else if (block.kind === 'list') {
          ensureSpace(18);
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#1F2937')
            .text(`${block.bullet} ${block.text}`, doc.page.margins.left + 12, doc.y, {
              width: contentWidth - 12,
            });
          doc.moveDown(0.2);
        } else if (block.kind === 'table' && block.headers.length > 0) {
          const allRows = [block.headers, ...block.rows];
          const colCount = block.headers.length;
          const colWidth = contentWidth / colCount;
          for (let rIdx = 0; rIdx < allRows.length; rIdx += 1) {
            ensureSpace(20);
            const row = allRows[rIdx] ?? [];
            const rowY = doc.y;
            const isHeader = rIdx === 0;
            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor('#111827');
            let maxRowY = rowY + 14;
            for (let cIdx = 0; cIdx < colCount; cIdx += 1) {
              const cellText = row[cIdx] ?? '';
              const cellX = doc.page.margins.left + cIdx * colWidth;
              doc.text(cellText, cellX + 4, rowY + 3, {
                width: colWidth - 8,
                lineBreak: true,
              });
              if (doc.y > maxRowY) maxRowY = doc.y;
            }
            doc
              .moveTo(doc.page.margins.left, maxRowY + 2)
              .lineTo(doc.page.width - doc.page.margins.right, maxRowY + 2)
              .strokeColor(isHeader ? '#9CA3AF' : '#E5E7EB')
              .lineWidth(0.5)
              .stroke();
            doc.y = maxRowY + 5;
          }
          doc.moveDown(0.35);
        } else if (block.kind === 'paragraph') {
          ensureSpace(20);
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#1F2937')
            .text(block.text, doc.page.margins.left, doc.y, { width: contentWidth });
          doc.moveDown(0.35);
        }
      }

      const toolsText = summarizeToolCalls(msg.toolCalls);
      if (toolsText) {
        ensureSpace(16);
        doc
          .font('Helvetica-Oblique')
          .fontSize(8)
          .fillColor('#6B7280')
          .text(
            `Audit: ${redact ? redactMonetaryAmounts(toolsText) : toolsText}`,
            doc.page.margins.left,
            doc.y,
            { width: contentWidth }
          );
      }

      doc.moveDown(0.7);
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor('#F3F4F6')
        .lineWidth(0.75)
        .stroke();
      doc.moveDown(0.7);
    }

    doc.end();
  });
}
