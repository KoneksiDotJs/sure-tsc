import React, { useMemo } from 'react';

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[var(--text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[11px] font-mono-tabular"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-[var(--text-secondary)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(trimmed);
}

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

export const MarkdownMessageBody: React.FC<{ content: string }> = ({ content }) => {
  const blocks = useMemo(() => {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const out: Array<
      | { type: 'heading'; level: number; text: string }
      | { type: 'list'; ordered: boolean; items: string[] }
      | { type: 'table'; headers: string[]; rows: string[][] }
      | { type: 'paragraph'; text: string }
    > = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();

      if (!trimmed) {
        i += 1;
        continue;
      }

      // Markdown Pipe Table
      if (
        trimmed.includes('|') &&
        i + 1 < lines.length &&
        isTableSeparatorLine(lines[i + 1] ?? '')
      ) {
        const headers = splitTableCells(trimmed);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && (lines[i] ?? '').trim().includes('|')) {
          rows.push(splitTableCells(lines[i]!));
          i += 1;
        }
        out.push({ type: 'table', headers, rows });
        continue;
      }

      // Heading (#, ##, ###)
      const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        out.push({
          type: 'heading',
          level: headingMatch[1]!.length,
          text: headingMatch[2]!,
        });
        i += 1;
        continue;
      }

      // Bullet or Numbered List
      if (/^([â€¢\-*]|\d+\.)\s+/.test(trimmed)) {
        const ordered = /^\d+\.\s+/.test(trimmed);
        const items: string[] = [];
        while (i < lines.length) {
          const cur = (lines[i] ?? '').trim();
          const m = cur.match(/^(?:[â€¢\-*]|\d+\.)\s+(.+)$/);
          if (!m) break;
          items.push(m[1]!);
          i += 1;
        }
        out.push({ type: 'list', ordered, items });
        continue;
      }

      // Paragraph lines grouped until blank line or next structural block
      const paraLines: string[] = [trimmed];
      i += 1;
      while (i < lines.length) {
        const nextLine = (lines[i] ?? '').trim();
        if (
          !nextLine ||
          /^(#{1,4})\s+/.test(nextLine) ||
          /^([â€¢\-*]|\d+\.)\s+/.test(nextLine) ||
          (nextLine.includes('|') &&
            i + 1 < lines.length &&
            isTableSeparatorLine(lines[i + 1] ?? ''))
        ) {
          break;
        }
        paraLines.push(nextLine);
        i += 1;
      }
      out.push({ type: 'paragraph', text: paraLines.join('\n') });
    }
    return out;
  }, [content]);

  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed break-words [overflow-wrap:anywhere]">
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          return (
            <div
              key={idx}
              className="font-semibold text-[var(--text-primary)] text-[13.5px] pt-0.5"
            >
              {renderInlineMarkdown(block.text)}
            </div>
          );
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={idx}
              className={`space-y-1 pl-4 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
            >
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="leading-relaxed">
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'table') {
          return (
            <div
              key={idx}
              className="w-full overflow-x-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)]"
            >
              <table className="w-full border-collapse text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                    {block.headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className="px-2.5 py-1.5 font-semibold text-[var(--text-primary)] whitespace-nowrap"
                      >
                        {renderInlineMarkdown(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-b last:border-b-0 border-[var(--border-primary)]"
                    >
                      {block.headers.map((_, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-2.5 py-1.5 align-top text-[var(--text-secondary)]"
                        >
                          {renderInlineMarkdown(row[cIdx] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p key={idx} className="whitespace-pre-line leading-relaxed">
            {renderInlineMarkdown(block.text)}
          </p>
        );
      })}
    </div>
  );
};
