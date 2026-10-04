import { CSSProperties, ReactNode, Fragment as F } from "react";
import { cn } from "@/lib/utils";
import { art } from "./art";
import oSoft from "@/assets/brand/m-o-soft.svg";
import oTint from "@/assets/brand/m-o-tint.svg";

/**
 * Medic Connect brand devices, ported from the design system's component
 * library (window.MC). Playful in layout, never in words: tilts stay between
 * -2.5 and 2.5 degrees for cards and up to 9 for stickers, body copy never
 * rotates, one sticker per section, solid lines only.
 */

type Tone = "blue" | "navy" | "tint" | "white";

const fill: Record<Tone, string> = {
  blue: "bg-brand text-white",
  navy: "bg-navy text-white",
  tint: "bg-tint text-navy",
  white: "bg-white text-navy",
};

const rot = (deg?: number): CSSProperties | undefined => (deg ? { transform: `rotate(${deg}deg)` } : undefined);

/** One word or number per headline sits on a blue highlighter swipe. */
export const Highlight = ({ tone = "blue", children }: { tone?: "blue" | "white" | "tint"; children: ReactNode }) => (
  <span
    className={cn(
      "px-[0.18em] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
      tone === "blue" ? "bg-brand text-white" : tone === "white" ? "bg-white text-navy" : "bg-tint text-navy",
    )}
  >
    {children}
  </span>
);

/** A 2px blue outline that follows a clip-path shape (a border would be clipped off the cut edges). */
const OUTLINE = ["2px 0", "-2px 0", "0 2px", "0 -2px"].map((o) => `drop-shadow(${o} 0 hsl(var(--brand)))`).join(" ");

/**
 * Flag with a cut in the right end, for categories and service lines.
 * `outlined` adds a blue edge, for light tags that sit across both a navy
 * band and a white card and would otherwise blend into one of them.
 */
export const NotchTag = ({
  tone = "blue",
  size = "md",
  tilt = 0,
  outlined = false,
  children,
  className,
}: {
  tone?: Tone;
  size?: "sm" | "md";
  tilt?: number;
  outlined?: boolean;
  children: ReactNode;
  className?: string;
}) => {
  const tag = (extra?: string, style?: CSSProperties) => (
    <span
      style={style}
      className={cn(
        "inline-block self-start whitespace-nowrap font-extrabold uppercase",
        fill[tone],
        size === "sm"
          ? "mc-notch-sm py-[5px] pl-[9px] pr-[14px] text-[10.5px] tracking-[0.16em]"
          : "mc-notch py-2 pl-[13px] pr-5 text-[12px] tracking-[0.16em]",
        extra,
      )}
    >
      {children}
    </span>
  );
  if (!outlined) return tag(className, rot(tilt));
  // The filter sits on a wrapper so the outline is drawn around the clipped shape.
  return (
    <span style={{ ...rot(tilt), filter: OUTLINE }} className={cn("inline-block self-start", className)}>
      {tag()}
    </span>
  );
};

/** A strip of tape, absolutely positioned over a photo, card or note. */
export const Tape = ({
  width = 90,
  tilt = -3,
  tone = "tint",
  className,
  style,
}: {
  width?: number;
  tilt?: number;
  tone?: "tint" | "blue";
  className?: string;
  style?: CSSProperties;
}) => (
  <span
    aria-hidden="true"
    className={cn("pointer-events-none absolute h-[22px] opacity-[0.92]", tone === "blue" ? "bg-brand" : "bg-tint-deep", className)}
    style={{ width, transform: `rotate(${tilt}deg)`, ...style }}
  />
);

/** A label on tape: times on visit notes, small headings on paper. */
export const TapeLabel = ({
  tone = "blue",
  tilt = -1.5,
  children,
  className,
}: {
  tone?: "blue" | "navy" | "tint";
  tilt?: number;
  children: ReactNode;
  className?: string;
}) => (
  <span
    style={rot(tilt)}
    className={cn(
      "inline-block self-start px-[18px] py-[7px] text-[13px] font-extrabold tracking-[0.16em] tabular-nums",
      fill[tone],
      className,
    )}
  >
    {children}
  </span>
);

/** The tilted pill sticker, the one approved round shape. */
export const PillSticker = ({
  tone = "navy",
  tilt = -4,
  children,
  className,
}: {
  tone?: "navy" | "blue" | "tint";
  tilt?: number;
  children: ReactNode;
  className?: string;
}) => (
  <span
    style={rot(tilt)}
    className={cn(
      "inline-block whitespace-nowrap rounded-full text-[15px] font-extrabold",
      tone === "tint" ? "border-2 border-brand bg-tint px-[19px] py-[10px] text-navy" : "px-5 py-[11px] text-white",
      tone === "navy" && "bg-navy",
      tone === "blue" && "bg-brand",
      className,
    )}
  >
    {children}
  </span>
);

/** A rubber stamp: VERIFIED, ACCEPTED, HEFAMAA ACCREDITED. */
export const Stamp = ({
  title,
  sub,
  tone = "blue",
  tilt = -6,
  onNavy = false,
  className,
}: {
  title: string;
  sub?: string;
  tone?: "blue" | "navy";
  tilt?: number;
  onNavy?: boolean;
  className?: string;
}) => {
  const c = onNavy ? "border-white text-white" : tone === "navy" ? "border-navy text-navy" : "border-brand text-brand";
  return (
    <div style={rot(tilt)} className={cn("inline-block border-[3px] px-3.5 py-2 text-center leading-[1.15]", c, className)}>
      <div className="text-[18px] font-black tracking-[0.12em]">{title}</div>
      {sub && (
        <div className={cn("mt-1 border-t-2 pt-1 text-[10.5px] font-extrabold tracking-[0.14em]", onNavy ? "border-white" : tone === "navy" ? "border-navy" : "border-brand")}>
          {sub}
        </div>
      )}
    </div>
  );
};

/** Price in price red with tabular numerals, or the white luggage tag on navy. */
export const PriceTag = ({
  amount,
  from = false,
  unit,
  variant = "inline",
  tilt = -6,
  className,
}: {
  amount: string;
  from?: boolean;
  unit?: string;
  variant?: "inline" | "tag";
  tilt?: number;
  className?: string;
}) =>
  variant === "tag" ? (
    <span
      style={rot(tilt)}
      className={cn(
        "mc-tag-left inline-block whitespace-nowrap bg-white py-2.5 pl-6 pr-[18px] text-[24px] font-black tracking-[-0.03em] text-price tabular-nums",
        className,
      )}
    >
      {amount}
    </span>
  ) : (
    <span className={cn("text-ink", className)}>
      {from && "from "}
      <b className="text-[1.3em] font-extrabold tracking-[-0.02em] text-price tabular-nums">{amount}</b>
      {unit && ` ${unit}`}
    </span>
  );

/** Notched admission ticket. The stub holds a price tag or a short note. */
export const Ticket = ({
  label,
  title,
  stub,
  stubLabel,
  tilt = 0,
  tone = "navy",
  children,
  className,
}: {
  label?: string;
  title?: ReactNode;
  stub?: ReactNode;
  stubLabel?: string;
  tilt?: number;
  tone?: "navy" | "white";
  children?: ReactNode;
  className?: string;
}) => {
  const navy = tone === "navy";
  return (
    <div style={rot(tilt)} className={cn("mc-ticket flex flex-wrap", navy ? "bg-navy" : "border-2 border-navy bg-white", className)}>
      <div className={cn("min-w-0 flex-[1_1_240px] p-6 sm:p-8", "border-b-[3px] sm:border-b-0 sm:border-r-[3px]", navy ? "border-brand-soft" : "border-navy")}>
        {label && <div className={cn("text-[11px] font-extrabold tracking-[0.18em]", navy ? "text-body-navy" : "text-muted-foreground")}>{label}</div>}
        {title && (
          <div className={cn("mt-1.5 text-[26px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[34px]", navy ? "text-white" : "text-navy")}>
            {title}
          </div>
        )}
        {children && <div className="mt-5">{children}</div>}
      </div>
      <div className={cn("flex flex-[0_0_180px] flex-col justify-center gap-2 p-6", navy ? "" : "bg-tint")}>
        {stubLabel && <div className={cn("text-[10.5px] font-extrabold tracking-[0.14em]", navy ? "text-body-navy" : "text-navy")}>{stubLabel}</div>}
        {stub}
      </div>
    </div>
  );
};

/** Square speech bubble for chat style FAQs. */
export const SpeechBubble = ({
  side = "left",
  tone = "blue",
  children,
  className,
}: {
  side?: "left" | "right";
  tone?: "blue" | "navy" | "tint";
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "max-w-[86%] px-4 pb-[22px] pt-3 text-[15.5px] leading-[1.5]",
      side === "left" ? "mc-bubble-left self-start" : "mc-bubble-right self-end",
      tone === "blue" && "bg-brand font-extrabold text-white",
      tone === "navy" && "bg-navy font-extrabold text-white",
      tone === "tint" && "bg-tint text-ink",
      className,
    )}
  >
    {children}
  </div>
);

/** A run of chevrons, pointing on. */
export const Chevrons = ({
  count = 3,
  colors = ["hsl(var(--brand-soft))", "hsl(var(--brand-soft))", "#FFFFFF"],
  size = 16,
  className,
}: {
  count?: number;
  colors?: string[];
  size?: number;
  className?: string;
}) => (
  <span aria-hidden="true" className={cn("inline-flex gap-1", className)}>
    {Array.from({ length: count }).map((_, i) => (
      <span key={i} className="mc-chevron" style={{ width: size * 0.75, height: size, background: colors[i % colors.length] }} />
    ))}
  </span>
);

/** Arrow steps, three at most, darkest first. */
export const ChevronSteps = ({ steps, current = 0 }: { steps: string[]; current?: number }) => (
  <ol className="flex items-stretch">
    {steps.slice(0, 3).map((s, i) => {
      const done = i < current;
      const on = i === current;
      return (
        <li
          key={s}
          className={cn(
            "min-w-0 flex-1 whitespace-nowrap py-2.5 pr-4 text-[12px] font-extrabold sm:text-[13px]",
            i ? "mc-step -ml-1.5 pl-[22px]" : "mc-step-first pl-3.5",
            on ? "bg-brand text-white" : done ? "bg-navy text-white" : "bg-tint text-navy",
          )}
        >
          {s}
        </li>
      );
    })}
  </ol>
);

/** A marquee ticker band. Decorative: pass the same words that appear elsewhere. */
export const TickerStrip = ({
  items,
  tone = "navy",
  className,
}: {
  items: string[];
  tone?: "navy" | "blue";
  className?: string;
}) => {
  const seq = [...items, ...items, ...items, ...items];
  const run = (key: string) => (
    <span key={key} className="inline-flex shrink-0 items-center gap-[18px] pr-[18px]">
      {seq.map((t, i) => (
        <F key={i}>
          {t}
          <span className={cn("inline-block h-[9px] w-[9px]", i % 2 ? "bg-white" : "bg-brand-soft")} />
        </F>
      ))}
    </span>
  );
  return (
    <div aria-hidden="true" className={cn("overflow-hidden whitespace-nowrap py-2.5", tone === "blue" ? "bg-brand" : "bg-navy", className)}>
      <div className="mc-ticker-track inline-flex text-[15px] font-black uppercase tracking-[0.12em] text-white">
        {run("a")}
        {run("b")}
      </div>
    </div>
  );
};

/** A crop of the mark glyph running off the corner of a panel. */
export const Watermark = ({
  glyph = "o",
  size = 500,
  opacity = 0.12,
  className,
  style,
}: {
  glyph?: "o" | "oTint" | "infTint";
  size?: number;
  opacity?: number;
  className?: string;
  style?: CSSProperties;
}) => (
  <img
    aria-hidden="true"
    alt=""
    src={glyph === "o" ? oSoft : glyph === "oTint" ? oTint : art.infTint}
    className={cn("pointer-events-none absolute select-none", className)}
    style={{ width: size, opacity, ...style }}
  />
);

/** Section opener: a huge ghost number with a two line heading. */
export const SectionOpener = ({
  number = "01",
  eyebrow,
  lines,
  onNavy = true,
  className,
}: {
  number?: string;
  eyebrow?: string;
  lines: string[];
  onNavy?: boolean;
  className?: string;
}) => (
  <div
    className={cn(
      "relative flex items-end justify-between gap-5 overflow-hidden px-6 py-9 sm:px-10 sm:py-11",
      onNavy ? "bg-navy" : "bg-white",
      className,
    )}
  >
    <img
      aria-hidden="true"
      alt=""
      src={onNavy ? oSoft : oTint}
      className="pointer-events-none absolute -right-[120px] -top-[140px] w-[420px]"
      style={{ opacity: onNavy ? 0.16 : 1 }}
    />
    <div className="relative flex flex-col gap-1.5">
      {eyebrow && (
        <span className={cn("mb-2 text-[13px] font-extrabold uppercase tracking-[0.2em]", onNavy ? "text-muted-navy" : "text-brand")}>
          {eyebrow}
        </span>
      )}
      {lines.map((l, i) => (
        <span
          key={l}
          className={cn(
            "text-[30px] font-extrabold leading-none tracking-[-0.05em] sm:text-[40px]",
            onNavy ? (i === lines.length - 1 ? "text-white" : "text-body-navy") : i === lines.length - 1 ? "text-navy" : "text-muted-foreground",
          )}
        >
          {l}
        </span>
      ))}
    </div>
    <span
      aria-hidden="true"
      className={cn(
        "relative text-[84px] font-black leading-[0.8] tracking-[-0.07em] sm:text-[120px]",
        onNavy ? "text-brand" : "text-tint",
      )}
    >
      {number}
    </span>
  </div>
);

/** Letter blocks: four letters at most, darkest first. */
export const LetterBlocks = ({ word = "CARE", size = 64, className }: { word?: string; size?: number; className?: string }) => {
  const bg = ["bg-navy text-white", "bg-brand text-white", "bg-brand-soft text-white", "bg-tint text-navy"];
  return (
    <div className={cn("flex gap-1.5", className)} aria-label={word} role="img">
      {word
        .slice(0, 4)
        .split("")
        .map((l, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn("grid place-items-center font-extrabold tracking-[-0.03em]", bg[i])}
            style={{ width: size, height: size, fontSize: size * 0.62 }}
          >
            {l}
          </span>
        ))}
    </div>
  );
};

/** A taped snapshot print with a white border and an optional caption. */
export const Snapshot = ({
  src,
  alt = "",
  caption,
  tilt = -2,
  className,
}: {
  src: string;
  alt?: string;
  caption?: string;
  tilt?: number;
  className?: string;
}) => (
  <figure style={rot(tilt)} className={cn("relative m-0 bg-white px-2.5 pb-11 pt-2.5 shadow-float", className)}>
    <Tape width={80} tilt={3} className="-top-[11px] left-1/2 -ml-10" />
    <img src={src} alt={alt} loading="lazy" className="block aspect-[4/3] w-full object-cover" />
    {caption && <figcaption className="absolute bottom-3 left-3.5 text-[14px] font-extrabold text-navy">{caption}</figcaption>}
  </figure>
);

/** A family worry in grey, our answer in navy. */
export const Fragment = ({ fragment, answer, className }: { fragment: string; answer: string; className?: string }) => (
  <div className={cn("relative flex flex-col gap-3.5 overflow-hidden bg-tint px-7 py-8", className)}>
    <img aria-hidden="true" alt="" src={art.infTint} className="pointer-events-none absolute -bottom-[50px] -right-10 w-[260px]" />
    <span className="relative text-[24px] font-medium leading-[1.2] tracking-[-0.04em] text-muted-foreground sm:text-[30px]">
      &#8220;{fragment}&#8221;
    </span>
    <span className="relative text-[22px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[26px]">{answer}</span>
  </div>
);

/** A pinned note with a square pin. */
export const PinNote = ({
  tone = "tint",
  tilt = 2,
  children,
  className,
}: {
  tone?: "tint" | "blue" | "white";
  tilt?: number;
  children: ReactNode;
  className?: string;
}) => (
  <div
    style={rot(tilt)}
    className={cn(
      "relative px-[18px] pb-[18px] pt-[26px] text-[15.5px] font-medium leading-[1.5] shadow-offset-sm",
      tone === "blue" && "bg-brand text-white",
      tone === "white" && "border-2 border-navy bg-white text-ink",
      tone === "tint" && "bg-tint text-ink",
      className,
    )}
  >
    <span
      aria-hidden="true"
      className={cn("absolute left-1/2 top-2 -ml-[7px] h-3.5 w-3.5 shadow-[2px_2px_0_rgba(26,31,46,0.25)]", tone === "blue" ? "bg-white" : "bg-navy")}
    />
    {children}
  </div>
);

/** Clip art object on a tint backing square. */
export const ClipArt = ({
  src,
  size = 130,
  backing = "tint",
  corner = "br",
  className,
}: {
  src: string;
  size?: number;
  backing?: "tint" | "navy" | "blue" | "none";
  corner?: "br" | "bl" | "tr" | "tl";
  className?: string;
}) => {
  const pos = { br: "right-0 bottom-0", bl: "left-0 bottom-0", tr: "right-0 top-0", tl: "left-0 top-0" }[corner];
  return (
    <div className={cn("relative aspect-square flex-none", className)} style={{ width: size }}>
      {backing !== "none" && (
        <div
          aria-hidden="true"
          className={cn("absolute h-[76%] w-[76%]", pos, backing === "navy" ? "bg-navy" : backing === "blue" ? "bg-brand" : "bg-tint")}
        />
      )}
      <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
    </div>
  );
};

/** Mark divider: the mark between two navy rules, or a coloured stripe. */
export const MarkDivider = ({ variant = "mark", className }: { variant?: "mark" | "stripe"; className?: string }) =>
  variant === "stripe" ? (
    <div aria-hidden="true" className={cn("flex h-2.5", className)}>
      <span className="flex-[5] bg-navy" />
      <span className="flex-[2] bg-brand" />
      <span className="flex-[1] bg-brand-soft" />
      <span className="flex-[3] bg-tint" />
    </div>
  ) : (
    <div aria-hidden="true" className={cn("flex items-center gap-3.5", className)}>
      <span className="flex-1 border-t border-navy" />
      <img src={art.markGlyph} alt="" className="block w-[30px]" />
      <span className="flex-1 border-t border-navy" />
    </div>
  );

/** The one deliberately plain element: double rule, no art, no tilt. */
export const EmergencyBox = ({ className }: { className?: string }) => (
  <div className={cn("border-[3px] border-navy p-1", className)}>
    <div className="flex flex-col gap-2.5 border border-navy px-5 py-[18px]">
      <b className="text-[18px] tracking-[-0.02em] text-navy">If it is an emergency, do not message us first.</b>
      <span className="text-[15px] leading-[1.6] text-ink">
        Call <b>112</b> or Lagos State emergency <b>767</b>. Then tell your Medic Connect coordinator.
      </span>
    </div>
  </div>
);

/** Week strip of visit days. */
export const WeekStrip = ({ visits = [1, 0, 1, 0, 1, 0, 0], today = 2 }: { visits?: number[]; today?: number }) => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d, i) => {
        const on = !!visits[i];
        const now = i === today;
        return (
          <div key={d} className={cn("flex flex-col items-center gap-1.5 py-2.5", now && "bg-navy")}>
            <span className={cn("text-[11px] font-extrabold uppercase tracking-[0.12em]", now ? "text-muted-navy" : "text-muted-foreground")}>{d}</span>
            <span
              className={cn(
                "h-[26px] w-[26px]",
                on ? (now ? "bg-white" : "bg-brand") : cn("border-2", now ? "border-outline-navy" : "border-tint-deep"),
              )}
            />
          </div>
        );
      })}
    </div>
  );
};

/** Carer ID badge on a lanyard clip with a VERIFIED stamp. */
export const CarerID = ({
  name,
  role,
  src,
  id,
  tilt = 0,
  className,
}: {
  name: string;
  role: string;
  src?: string;
  id?: string;
  tilt?: number;
  className?: string;
}) => (
  <div style={rot(tilt)} className={cn("relative w-[240px] border-2 border-navy bg-white shadow-offset-blue", className)}>
    <span aria-hidden="true" className="absolute -top-[18px] left-1/2 -ml-[9px] h-[26px] w-[18px] border-[3px] border-b-0 border-navy" />
    <div className="flex items-center justify-between bg-navy px-3.5 py-2.5">
      <span className="text-[11px] font-extrabold tracking-[0.16em] text-white">MEDIC CONNECT</span>
      {id && <span className="text-[11px] tabular-nums text-muted-navy">{id}</span>}
    </div>
    <div className="flex items-end gap-3 p-3.5">
      <div className="flex h-[92px] w-[76px] flex-none items-end justify-center overflow-hidden bg-tint">
        {src && <img src={src} alt="" className="h-full w-full object-cover object-top" />}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <b className="text-[17px] leading-[1.15] text-ink">{name}</b>
        <span className="text-[13px] text-muted-foreground">{role}</span>
        <span className="mt-1.5 -rotate-[5deg] self-start border-[3px] border-brand px-[7px] py-[3px] text-[11px] font-black tracking-[0.12em] text-brand">
          VERIFIED
        </span>
      </div>
    </div>
  </div>
);

/** Tilted card in one of four tones with a hard offset shadow. Straightens on hover. */
export const TiltCard = ({
  tone = "blue",
  tilt = -2,
  tape = false,
  children,
  className,
}: {
  tone?: Tone;
  tilt?: number;
  tape?: boolean;
  children: ReactNode;
  className?: string;
}) => {
  const shadow = { blue: "shadow-offset", tint: "shadow-offset-blue", white: "shadow-offset", navy: "shadow-offset-blue" }[tone];
  return (
    <div
      style={{ ["--mc-tilt" as string]: `${tilt}deg` }}
      className={cn("mc-tilt relative flex flex-col", fill[tone], tone === "white" && "border-2 border-navy", shadow, tape ? "pt-6" : "", className)}
    >
      {tape && <Tape width={60} tilt={-3} className="-top-2.5 left-1/2 -ml-[30px]" />}
      {children}
    </div>
  );
};
