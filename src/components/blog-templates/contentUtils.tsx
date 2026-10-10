import React from "react";
import { Chevrons } from "@/components/mc/brand";

// Re-export PolaroidFrame for backward compatibility
export { PolaroidFrame } from "./PolaroidFrame";

export interface ContentSection {
  heading?: string;
  /** The heading's place among the article's headings, from 1. */
  number?: number;
  body: string;
}

export const splitContentAtH2 = (markdown: string): ContentSection[] => {
  const lines = markdown.split("\n");
  const sections: ContentSection[] = [];
  let current: ContentSection = { body: "" };
  let headings = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current.body.trim() || current.heading) {
        sections.push(current);
      }
      current = { heading: line.replace("## ", "").trim(), number: ++headings, body: "" };
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

  const isSources = !!section.heading && /^(sources|references|further reading)$/i.test(section.heading.trim());

  if (section.heading) {
    elements.push(
      isSources ? (
        <h2 key={`h-${index}`} className="mb-2">
          <span
            className="inline-block -rotate-2 bg-navy px-[18px] py-[7px] text-[13px] font-extrabold uppercase tracking-[0.16em] text-white"
          >
            {renderInline(section.heading, `h2-${index}`)}
          </span>
        </h2>
      ) : (
        <h2 key={`h-${index}`} className="mt-16 mb-4 text-[26px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[32px]">
          {section.number !== undefined && (
            <span
              aria-hidden="true"
              className={`mb-3 block w-fit px-3 py-1 text-[13px] font-extrabold tracking-[0.16em] tabular-nums ${section.number % 2 ? "-rotate-2 bg-brand text-white" : "rotate-2 bg-tint-deep text-navy"}`}
            >
              {String(section.number).padStart(2, "0")}
            </span>
          )}
          {renderInline(section.heading, `h2-${index}`)}
        </h2>
      )
    );
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Horizontal rule
    if (line.trim() === "---" || line.trim() === "***" || line.trim() === "___") {
      elements.push(
        <div key={`${index}-hr-${i}`} role="separator" className="my-12 flex items-center justify-center gap-4">
          <span className="h-1 flex-1 bg-navy" />
          <Chevrons size={16} colors={["hsl(var(--brand))", "hsl(var(--brand-soft))", "hsl(var(--navy))"]} />
          <span className="h-1 flex-1 bg-navy" />
        </div>
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
          className="mc-bubble-left my-12 bg-brand px-6 pb-10 pt-6 text-[20px] font-extrabold leading-[1.35] tracking-[-0.02em] text-white sm:-mx-6 sm:px-8 sm:text-[23px]"
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
        <ul key={`${index}-ul-${i}`} className="my-6 space-y-3">
          {items.map((item, j) => (
            <li key={j} className="flex gap-3.5">
              <span aria-hidden="true" className="mt-[5px] grid h-6 w-6 shrink-0 place-items-center bg-brand text-[13px] font-black text-white">
                ✓
              </span>
              <span>{renderInline(item, `ul-${index}-${i}-${j}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (/^\d+\. /.test(line)) {
      // Items may be separated by blank lines; keep each item's own number.
      const items: { n: number; text: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\d+)\. (.*)$/);
        if (m) {
          items.push({ n: Number(m[1]), text: m[2] });
          i++;
        } else if (!lines[i].trim() && /^\d+\. /.test(lines.slice(i).find((l) => l.trim()) ?? "")) {
          i++;
        } else break;
      }
      elements.push(
        <ol key={`${index}-ol-${i}`} className={isSources ? "my-4 space-y-3 text-[15px] leading-[1.55]" : "my-6 space-y-3"}>
          {items.map((item, j) => (
            <li key={j} className="flex gap-3.5">
              <span aria-hidden="true" className={`grid shrink-0 place-items-center bg-navy font-black text-white tabular-nums ${isSources ? "mt-0.5 h-6 w-6 text-[12px]" : "mt-[3px] h-7 w-7 text-[14px]"}`}>
                {item.n}
              </span>
              <span>{renderInline(item.text, `ol-${index}-${i}-${j}`)}</span>
            </li>
          ))}
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

  if (isSources) {
    return (
      <div key={`section-${index}`} className="relative mt-16 rotate-[-0.6deg] border-2 border-navy bg-white p-6 text-[15px] leading-[1.6] shadow-offset sm:p-8">
        <span aria-hidden="true" className="absolute -top-2 left-1/2 -ml-2 h-4 w-4 bg-brand shadow-[2px_2px_0_hsl(var(--navy))]" />
        {elements}
      </div>
    );
  }

  return <div key={`section-${index}`}>{elements}</div>;
};
