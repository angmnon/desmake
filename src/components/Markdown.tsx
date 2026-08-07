import { type ReactNode } from "react";

type Props = { source: string; className?: string };

const INLINE = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[2] !== undefined) {
      nodes.push(<strong key={key}>{m[2]}</strong>);
    } else if (m[4] !== undefined) {
      nodes.push(<em key={key}>{m[4]}</em>);
    } else if (m[6] !== undefined) {
      nodes.push(
        <code key={key} className="inline-code">
          {m[6]}
        </code>,
      );
    } else if (m[8] !== undefined) {
      const url = m[9];
      const external = /^https?:\/\//.test(url);
      nodes.push(
        <a
          key={key}
          href={url}
          className="link-u"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {m[8]}
        </a>,
      );
    }
    last = INLINE.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const isTableRow = (l: string) => l.trim().startsWith("|") && l.trim().endsWith("|");
const isSeparator = (l: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l.trim());
const splitCells = (l: string) =>
  l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ source, className }: Props) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let bi = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      i++;
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      i++;
      continue;
    }
    if (/^##\s+/.test(trimmed)) {
      const txt = trimmed.replace(/^##\s+/, "");
      blocks.push(
        <h2 key={`h2-${bi++}`} className="blog-h2">
          {renderInline(txt, `h2-${bi}`)}
        </h2>,
      );
      i++;
      continue;
    }
    if (/^###\s+/.test(trimmed)) {
      const txt = trimmed.replace(/^###\s+/, "");
      blocks.push(
        <h3 key={`h3-${bi++}`} className="blog-h3">
          {renderInline(txt, `h3-${bi}`)}
        </h3>,
      );
      i++;
      continue;
    }

    // Table: header row + separator + body rows
    if (
      isTableRow(trimmed) &&
      i + 1 < lines.length &&
      isTableRow(lines[i + 1].trim()) &&
      isSeparator(lines[i + 1].trim())
    ) {
      const header = splitCells(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i].trim()) && !isSeparator(lines[i].trim())) {
        rows.push(splitCells(lines[i].trim()));
        i++;
      }
      blocks.push(
        <div key={`tbl-${bi++}`} className="blog-table-wrap">
          <table className="blog-table">
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th key={hi}>{renderInline(h, `th-${bi}-${hi}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{renderInline(c, `td-${bi}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${bi++}`} className="blog-ul">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ul-${bi}-${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${bi++}`} className="blog-ol">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ol-${bi}-${ii}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph: gather consecutive plain lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3}\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !(
        isTableRow(lines[i].trim()) &&
        i + 1 < lines.length &&
        isTableRow(lines[i + 1].trim()) &&
        isSeparator(lines[i + 1].trim())
      )
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) {
      blocks.push(
        <p key={`p-${bi++}`} className="blog-p">
          {renderInline(para.join(" "), `p-${bi}`)}
        </p>,
      );
    }
  }

  return <div className={className ?? "blog-prose"}>{blocks}</div>;
}
