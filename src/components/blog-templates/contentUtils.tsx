import React from "react";

// Re-export PolaroidFrame for backward compatibility
export { PolaroidFrame } from "./PolaroidFrame";

export interface ContentSection {
  heading?: string;
  body: string;
}

export const splitContentAtH2 = (markdown: string): ContentSection[] => {
  const lines = markdown.split("\n");
  const sections: ContentSection[] = [];
  let current: ContentSection = { body: "" };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current.body.trim() || current.heading) {
        sections.push(current);
      }
      current = { heading: line.replace("## ", "").trim(), body: "" };
    } else {
      current.body += line + "\n";
    }
  }
  if (current.body.trim() || current.heading) {
    sections.push(current);
  }
  return sections;
};

const renderInline = (text: string, keyPrefix: string = "i"): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]*)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) parts.push(<strong key={`${keyPrefix}-${key++}`} className="italic font-bold">{match[2]}</strong>);
    else if (match[3]) parts.push(<strong key={`${keyPrefix}-${key++}`} className="font-bold">{match[3]}</strong>);
    else if (match[4]) parts.push(<em key={`${keyPrefix}-${key++}`} className="italic">{match[4]}</em>);
    else if (match[6]) parts.push(<img loading="lazy" decoding="async" key={`${keyPrefix}-${key++}`} src={match[6]} alt={match[5]} className="my-4 max-w-full border-2 border-navy" />);
    else if (match[8]) parts.push(<a key={`${keyPrefix}-${key++}`} href={match[8]} className="font-bold text-brand underline decoration-brand/40 underline-offset-2 transition-colors hover:decoration-brand">{match[7]}</a>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
};

/**
 * Render the first paragraph with an explicit drop-cap letter.
 * Only applies when the line starts with a plain alphabetic character —
 * otherwise renders the paragraph normally (no broken drop cap).
 */
const renderDropCapParagraph = (line: string, key: string): React.ReactNode => {
  // Strip leading whitespace, then strip leading markdown markers (**, *, _, ~)
  // and opening quote/punctuation so the drop cap always lands on the first real letter.
  let trimmed = line.replace(/^\s+/, "");
  trimmed = trimmed.replace(/^(\*\*|\*|__|_|~~|~)+/, "");
  const match = trimmed.match(/^(["'“”‘’«»\(\[]*)([A-Za-z0-9])(.*)$/s);
  if (!match) {
    return <p key={key} className="my-6">{renderInline(line, `p-${key}`)}</p>;
  }
  const [, prefix, letter, rest] = match;
  return (
    <p key={key} className="my-6">
      {prefix}
      <span className="drop-cap-letter">{letter}</span>
      {renderInline(rest, `p-${key}-rest`)}
    </p>
  );
};

export const renderSection = (section: ContentSection, index: number, isFirstSection?: boolean, dropCapEnabled: boolean = true): React.ReactNode => {
  const lines = section.body.trim().split("\n");
  const elements: React.ReactNode[] = [];
  let isFirstParagraph = isFirstSection && index === 0;

  if (section.heading) {
    elements.push(
      <h2
        key={`h-${index}`}
        className="mt-14 mb-4 text-[26px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy before:mb-4 before:block before:h-1 before:w-10 before:bg-brand sm:text-[32px]"
      >
        {renderInline(section.heading, `h2-${index}`)}
      </h2>
    );
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Horizontal rule
    if (line.trim() === "---" || line.trim() === "***" || line.trim() === "___") {
      elements.push(
        <hr key={`${index}-hr-${i}`} className="my-12 border-t-4 border-navy" />
      );
      i++;
      continue;
    }

    if (line.startsWith("# ") && !line.startsWith("## ")) {
      // Stray H1 in body → render as H2 (page already has a single <h1> in the hero)
      elements.push(
        <h2
          key={`${index}-${i}`}
          className="mt-14 mb-4 text-[26px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy before:mb-4 before:block before:h-1 before:w-10 before:bg-brand sm:text-[32px]"
        >
          {renderInline(line.replace(/^# /, ""), `h1-${index}-${i}`)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={`${index}-${i}`}
          className="mt-10 mb-3 text-[20px] font-extrabold leading-snug tracking-[-0.03em] text-navy sm:text-[22px]"
        >
          {renderInline(line.replace("### ", ""), `h3-${index}-${i}`)}
        </h3>
      );
    } else if (line.startsWith("#### ")) {
      elements.push(
        <h4
          key={`${index}-${i}`}
          className="mt-8 mb-2 text-[18px] font-extrabold text-navy"
        >
          {renderInline(line.replace("#### ", ""), `h4-${index}-${i}`)}
        </h4>
      );
    } else if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].replace(/^> ?/, ""));
        i++;
      }
      elements.push(
        <blockquote
          key={`${index}-bq-${i}`}
          className="my-10 bg-tint px-6 py-6 text-[20px] font-extrabold leading-[1.4] tracking-[-0.02em] text-navy sm:px-8 sm:text-[22px]"
        >
          {quoteLines.map((ql, qi) => (
            <span key={qi}>
              {qi > 0 && <br />}
              {renderInline(ql, `bq-${index}-${i}-${qi}`)}
            </span>
          ))}
        </blockquote>
      );
      continue;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].replace(/^[-*] /, ""));
        i++;
      }
      elements.push(
        <ul key={`${index}-ul-${i}`} className="my-6 list-disc space-y-2.5 pl-6 marker:text-brand">
          {items.map((item, j) => <li key={j}>{renderInline(item, `ul-${index}-${i}-${j}`)}</li>)}
        </ul>
      );
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={`${index}-ol-${i}`} className="my-6 list-decimal space-y-2.5 pl-6 marker:font-extrabold marker:text-brand">
          {items.map((item, j) => <li key={j}>{renderInline(item, `ol-${index}-${i}-${j}`)}</li>)}
        </ol>
      );
      continue;
    } else if (line.startsWith("![")) {
      const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        elements.push(<img loading="lazy" decoding="async" key={`${index}-${i}`} src={imgMatch[2]} alt={imgMatch[1]} className="my-8 max-w-full border-2 border-navy" />);
      }
    } else {
      if (isFirstParagraph && dropCapEnabled) {
        elements.push(renderDropCapParagraph(line, `${index}-${i}`));
        isFirstParagraph = false;
      } else {
        if (isFirstParagraph) isFirstParagraph = false;
        elements.push(
          <p key={`${index}-${i}`} className="my-6">{renderInline(line, `p-${index}-${i}`)}</p>
        );
      }
    }
    i++;
  }

  return <div key={`section-${index}`}>{elements}</div>;
};
