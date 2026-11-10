/**
 * Renders Commission content authored as lightweight markdown-style text.
 * Content is escaped first, so authored copy can never inject markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-ink-100 px-1 py-0.5 text-xs">$1</code>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
      '<a href="$2" rel="noopener">$1</a>',
    );
}

export function renderContent(body: string): string {
  const blocks = body.replace(/\r\n/g, '\n').split(/\n{2,}/);
  const html: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const heading = trimmed.match(/^(#{2,4})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 4);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const lines = trimmed.split('\n');
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
      html.push(
        `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('')}</ul>`,
      );
      continue;
    }
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      html.push(
        `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`,
      );
      continue;
    }
    html.push(`<p>${lines.map(inline).join('<br/>')}</p>`);
  }
  return html.join('');
}

export function RichText({ body, className = '' }: { body: string; className?: string }) {
  return (
    <div
      className={`prose-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderContent(body) }}
    />
  );
}
