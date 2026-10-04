import { ButtonHTMLAttributes, ReactNode, TextareaHTMLAttributes, InputHTMLAttributes, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useHeardPath } from "@/components/heard/HeardBase";
import HeardMark from "./HeardMark";

/**
 * Heard element library v2, built from the Heard elements reference.
 * Five colours, Figtree, square corners, one accent, no gradients.
 * Every element here is scoped by .heard-v2 on the Heard layout.
 */

/* Surfaces ---------------------------------------------------------------- */

export const HeardStackFrame = ({
  children,
  nested = false,
  className = "",
}: {
  children: ReactNode;
  nested?: boolean;
  className?: string;
}) => {
  if (nested) {
    return (
      <div className={`border border-[color:var(--hv-mute)] p-[5px] ${className}`}>
        <div className="border border-[color:var(--hv-mute)] p-[5px]">
          <div className="border border-[color:var(--hv-late)] bg-[color:var(--hv-white)] p-6 sm:p-7">
            {children}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`hv-frame-outer ${className}`}>
      <span className="hv-frame-shadow" aria-hidden="true" />
      <div className="hv-frame">{children}</div>
    </div>
  );
};

export const HeardSectionOpener = ({
  eyebrow,
  lines,
  index,
  asPageHeading = false,
}: {
  eyebrow: string;
  lines: string[];
  index?: string;
  /** Renders the opener lines as the page's single h1. */
  asPageHeading?: boolean;
}) => {
  const Lines = asPageHeading ? "h1" : "p";
  return (
  <div className="relative overflow-hidden bg-[color:var(--hv-sky)] px-6 py-9 sm:px-8 sm:py-10 flex flex-wrap items-center justify-between gap-6">
    <HeardMark
      className="hv-breathe pointer-events-none absolute -right-10 -bottom-16 w-72 opacity-[0.16]"
      fill="#16132F"
    />
    <div className="relative flex flex-col gap-3">
      <p className="hv-eyebrow">{eyebrow}</p>
      <Lines className="flex flex-col gap-3 m-0">
        {lines.map((line, i) => (
          <span
            key={line}
            className={`${i === 0 ? "hv-line-1" : "hv-line-2"} block font-extrabold text-[clamp(30px,6vw,46px)] leading-none tracking-[-0.05em] text-[color:var(--hv-late)]`}
          >
            {line}
          </span>
        ))}
      </Lines>
    </div>
    {index && (
      <span className="relative font-extrabold text-[clamp(40px,8vw,70px)] leading-none tracking-[-0.05em] text-[color:var(--hv-late)] opacity-35">
        {index}
      </span>
    )}
  </div>
  );
};


export const HeardDivider = ({ variant = "hair" }: { variant?: "hair" | "bar" | "dotted" | "mark" }) => {
  if (variant === "bar") return <div className="h-[6px] bg-[color:var(--hv-sky)]" />;
  if (variant === "dotted")
    return (
      <div
        className="h-[10px]"
        style={{
          backgroundImage: "radial-gradient(#BFDBF7 3px, transparent 3.2px)",
          backgroundSize: "18px 10px",
        }}
      />
    );
  if (variant === "mark")
    return (
      <div className="flex items-center gap-4">
        <span className="flex-1 border-t border-[color:var(--hv-mute)]" />
        <HeardMark className="w-11" fill="#BFDBF7" />
        <span className="flex-1 border-t border-[color:var(--hv-mute)]" />
      </div>
    );
  return <div className="border-t border-[color:var(--hv-late)]" />;
};

/* Actions ----------------------------------------------------------------- */

type ButtonTone = "primary" | "alt" | "pill";

export const HeardButton = ({
  tone = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) => (
  <button {...props} className={`hv-btn hv-btn-${tone} ${className}`} />
);

export const HeardLinkButton = ({
  to,
  tone = "primary",
  children,
  className = "",
}: {
  to: string;
  tone?: ButtonTone;
  children: ReactNode;
  className?: string;
}) => (
  <Link to={to} className={`hv-btn hv-btn-${tone} ${className}`}>
    {children}
  </Link>
);

export const HeardTextLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="hv-textlink inline-block">
    {children}
  </Link>
);

/* Writing ----------------------------------------------------------------- */

export const HeardTextField = ({
  label,
  help,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string; error?: string }) => {
  const autoId = useId();
  const id = props.id ?? autoId;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="hv-label">
        {label}
      </label>
      <input
        {...props}
        id={id}
        className="hv-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={[help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
      />
      {help && (
        <span id={helpId} className="hv-help">
          {help}
        </span>
      )}
      {error && (
        <span id={errorId} className="hv-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export const HeardTextArea = ({
  label,
  help,
  error,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; help?: string; error?: string }) => {
  const autoId = useId();
  const id = props.id ?? autoId;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="hv-label">
        {label}
      </label>
      <textarea
        {...props}
        id={id}
        className="hv-textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={[help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
      />
      {help && (
        <span id={helpId} className="hv-help">
          {help}
        </span>
      )}
      {error && (
        <span id={errorId} className="hv-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

/** Square consent box. Never pre-selected, and each consent stands alone. */
export const HeardCheckbox = ({
  checked,
  onChange,
  children,
  help,
  error,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
  help?: string;
  error?: string;
}) => {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          aria-invalid={error ? true : undefined}
          aria-describedby={[help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
        />
        <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
          <span className="hv-box" data-on={checked} aria-hidden="true" />
          <span className="text-[14.5px] leading-relaxed text-[color:var(--hv-violet)]">{children}</span>
        </label>
      </div>
      {help && (
        <span id={helpId} className="hv-help pl-[30px]">
          {help}
        </span>
      )}
      {error && (
        <span id={errorId} className="hv-error pl-[30px]" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

/* States ------------------------------------------------------------------ */

export const HeardNotice = ({
  tone = "confirmed",
  title,
  children,
}: {
  tone?: "confirmed" | "problem";
  title: string;
  children?: ReactNode;
}) => (
  <div className={tone === "confirmed" ? "hv-notice-ok" : "hv-notice-problem"} role={tone === "problem" ? "alert" : undefined}>
    <p className="font-extrabold text-[17px] tracking-[-0.035em] text-[color:var(--hv-late)]">{title}</p>
    {children && <div className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--hv-violet)]">{children}</div>}
  </div>
);

export const HeardEmptyState = ({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
}) => (
  <div className="hv-empty">
    <HeardMark className="hv-breathe pointer-events-none absolute -right-6 -bottom-9 w-40 opacity-55" fill="#BFDBF7" />
    <h2 className="relative text-[clamp(24px,4vw,32px)]">{title}</h2>
    {note && <p className="relative mt-3 text-[14.5px] text-[color:var(--hv-violet)]">{note}</p>}
    {action && <div className="relative mt-6">{action}</div>}
  </div>
);

export const HeardSkeleton = ({ label }: { label: string }) => (
  <div className="bg-[color:var(--hv-violet)] px-6 py-5 flex flex-col gap-2.5" role="status" aria-live="polite">
    <span className="hv-skeleton-bar w-[45%]" />
    <span className="hv-skeleton-bar" />
    <span className="hv-skeleton-bar w-[72%]" />
    <span className="pt-1 text-[12.5px] text-[color:var(--hv-on-dark)]">{label}</span>
  </div>
);

export const HeardSafetyBox = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="hv-safety">
    <h3 className="mb-3">{title}</h3>
    <div className="text-[14.5px] leading-relaxed text-[color:var(--hv-violet)] space-y-2">{children}</div>
  </div>
);

export const HeardHoursPanel = ({ hours, note }: { hours: string; note: string }) => (
  <div className="hv-hours">
    <p className="hv-eyebrow text-[color:var(--hv-sky)]">Listening hours</p>
    <p className="mt-2 font-extrabold text-[clamp(28px,5vw,40px)] leading-none tracking-[-0.05em]">{hours}</p>
    <p className="mt-3 text-[14px] text-[color:var(--hv-on-dark)]">{note}</p>
  </div>
);

/* Letters ----------------------------------------------------------------- */

export const HeardLetterCard = ({
  date,
  heading,
  body,
  signature,
}: {
  date?: string;
  heading?: string | null;
  body: string;
  signature?: string | null;
}) => (
  <HeardStackFrame>
    <div className="flex flex-col gap-3">
      {date && <p className="text-[11px] tracking-[0.16em] uppercase font-extrabold text-[color:var(--hv-mute)]">{date}</p>}
      {heading && (
        <p className="font-extrabold text-[21px] tracking-[-0.035em] text-[color:var(--hv-late)]">{heading}</p>
      )}
      <div className="text-[15px] leading-[1.8] text-[color:var(--hv-violet)] whitespace-pre-wrap">{body}</div>
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-[color:var(--hv-hair)]">
        <span className="text-[12px] text-[color:var(--hv-mute)]">
          {signature ? `Left by ${signature}` : "Left by somebody"}
        </span>
        <HeardMark className="w-7" fill="#BFDBF7" />
      </div>
    </div>
  </HeardStackFrame>
);

export const HeardStoryCard = ({
  label,
  body,
  signature,
}: {
  label: string;
  body: string;
  signature?: string | null;
}) => (
  <div className="border border-[color:var(--hv-late)] bg-[color:var(--hv-white)] overflow-hidden">
    <div className="bg-[color:var(--hv-sky)] px-5 py-4 flex items-center justify-between gap-3">
      <span className="text-[11px] tracking-[0.16em] uppercase font-extrabold text-[color:var(--hv-late)]">{label}</span>
      <HeardMark className="w-8" fill="#16132F" />
    </div>
    <div className="p-5 flex flex-col gap-2.5">
      <div className="text-[15px] leading-[1.8] text-[color:var(--hv-violet)] whitespace-pre-wrap">{body}</div>
      {signature && <p className="text-[12px] text-[color:var(--hv-mute)]">{signature}</p>}
    </div>
  </div>
);

/* Watermark ---------------------------------------------------------------- */

/**
 * The infinity as a watermark. It sits in its own clipping layer and is
 * scaled against the viewport so the whole shape reads at every width.
 */
export const HeardWatermark = ({
  position = "right",
  fill = "#BFDBF7",
}: {
  position?: "right" | "left";
  fill?: string;
}) => (
  <span className="hv-watermark-layer" aria-hidden="true">
    <HeardMark
      className={`hv-watermark hv-breathe w-[min(340px,62vw)] top-1 ${
        position === "right" ? "right-0" : "left-0"
      }`}
      fill={fill}
    />
  </span>
);

/* Reveal ------------------------------------------------------------------- */

/** Settles content into place on first scroll into view. */
export const HeardReveal = ({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`hv-reveal ${className}`}
      data-shown={shown}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
};

/** A short thought revealed one line at a time, once. */
export const HeardRevealStatement = ({
  lines,
  className = "",
  asPageHeading = false,
}: {
  lines: string[];
  className?: string;
  asPageHeading?: boolean;
}) => {
  const content = lines.map((line, index) => (
    <span
      key={`${line}-${index}`}
      className="hv-reveal-statement-line"
      data-last={index === lines.length - 1}
      style={{ animationDelay: `${index * 200}ms` }}
    >
      {line}
    </span>
  ));
  return (
    <HeardReveal className={`hv-reveal-statement ${className}`}>
      {asPageHeading ? <h1 className="m-0 contents">{content}</h1> : content}
    </HeardReveal>
  );
};

/** One deliberately emphasised line within existing editorial copy. */
export const HeardPullLine = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span className={`hv-pull-line ${className}`}>{children}</span>
);

/** Compact route context for Heard's inner pages. */
export const HeardBreadcrumb = ({ current, parent }: { current: string; parent?: { label: string; to: string } }) => {
  const heardPath = useHeardPath();
  return (
    <nav aria-label="Breadcrumb" className="hv-breadcrumb">
      <Link to={heardPath("/")}>Heard</Link>
      {parent && (
        <>
          <span aria-hidden="true">/</span>
          <Link to={heardPath(parent.to)}>{parent.label}</Link>
        </>
      )}
      <span aria-hidden="true">/</span>
      <span aria-current="page">{current}</span>
    </nav>
  );
};

/* Progress ----------------------------------------------------------------- */

export const HeardSteps = ({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) => (
  <ol className="flex flex-wrap items-center gap-x-6 gap-y-3 m-0 p-0 list-none">
    {steps.map((step, i) => (
      <li key={step}>
        <span className="hv-step" data-state={i === current ? "current" : i < current ? "done" : "ahead"}>
          <span className="hv-step-dot" aria-hidden="true" />
          {step}
          {i === current && <span className="sr-only"> (current step)</span>}
        </span>
      </li>
    ))}
  </ol>
);

export const HeardIndexMarker = ({ label, numeral }: { label: string; numeral?: string }) => (
  <div className="flex items-baseline justify-between gap-5">
    <span className="hv-index">{label}</span>
    {numeral && <span className="hv-numeral text-[clamp(38px,8vw,64px)]">{numeral}</span>}
  </div>
);

export const HeardQuote = ({ children, attribution }: { children: ReactNode; attribution?: string }) => (
  <figure className="m-0 flex flex-col gap-3">
    <blockquote className="hv-quote m-0">{children}</blockquote>
    {attribution && <figcaption className="hv-index">{attribution}</figcaption>}
  </figure>
);

/* Letter paper ------------------------------------------------------------- */

export const HeardTapeLabel = ({
  children,
  placement = "edge",
  tone = "sky",
}: {
  children: ReactNode;
  placement?: "corner" | "edge";
  tone?: "sky" | "late";
}) => (
  <span className={`hv-tape hv-tape-${placement} hv-tape-${tone}`}>
    {children}
  </span>
);

export const HeardLetterStack = ({ children, stacked = true }: { children: ReactNode; stacked?: boolean }) => (
  <div className="hv-letter-stack">
    {stacked && (
      <>
        <span className="hv-letter-sheet hv-letter-sheet-back" aria-hidden="true" />
        <span className="hv-letter-sheet hv-letter-sheet-middle" aria-hidden="true" />
      </>
    )}
    {children}
  </div>
);

export const HeardPostmark = ({ date, place = "Heard" }: { date?: string; place?: string }) => (
  <span className="hv-postmark" aria-label={[place, date].filter(Boolean).join(", ")}>
    <span>{place}</span>
    {date && <span>{date}</span>}
  </span>
);

export const HeardPinnedNote = ({ children }: { children: ReactNode }) => (
  <aside className="hv-pinned-note">
    <HeardTapeLabel placement="edge">Note</HeardTapeLabel>
    {children}
  </aside>
);

export const HeardPigeonhole = ({
  current,
  remaining,
}: {
  current: string;
  remaining?: string;
}) => (
  <div className="hv-pigeonhole" aria-label="Letter Room position">
    <span className="hv-pigeonhole-row" data-current="true">{current}</span>
    {remaining && <span className="hv-pigeonhole-row">{remaining}</span>}
  </div>
);

export const HeardClosing = ({
  lines,
  action,
}: {
  lines: [string, string];
  action: ReactNode;
}) => (
  <section className="hv-closing">
    <p>{lines[0]}</p>
    <p>{lines[1]}</p>
    <div>{action}</div>
  </section>
);

export const HeardSegmentRule = () => (
  <div className="hv-segment-rule" aria-hidden="true">
    <span /><span /><span /><span /><span />
  </div>
);

export const HeardLetterOpened = ({ children }: { children: ReactNode }) => (
  <div className="hv-letter-opened">{children}</div>
);

/** A letter presented as paper, with the remaining letters showing as edges. */
export const HeardLetterPaper = ({
  marker,
  date,
  heading,
  body,
  signature,
  stacked = true,
  opened = false,
  edgeLabel,
  showState = false,
}: {
  marker?: string;
  date?: string;
  heading?: string | null;
  body: string;
  signature?: string | null;
  stacked?: boolean;
  opened?: boolean;
  edgeLabel?: string;
  showState?: boolean;
}) => (
  <HeardLetterStack stacked={stacked}>
    <article className={`hv-paper flex flex-col gap-5 ${opened ? "hv-paper-opened" : ""}`}>
      {showState && (
        <HeardTapeLabel placement="corner" tone={opened ? "late" : "sky"}>
          {opened ? "Opened · yours" : "Sealed"}
        </HeardTapeLabel>
      )}
      {edgeLabel && <HeardTapeLabel placement="edge">{edgeLabel}</HeardTapeLabel>}
      {(marker || date) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {marker && <span className="hv-index">{marker}</span>}
          {date && <HeardPostmark date={date} />}
        </div>
      )}
      {heading && (
        <p className="m-0 font-extrabold text-[clamp(21px,3vw,27px)] tracking-[-0.04em] text-[color:var(--hv-late)]">
          {heading}
        </p>
      )}
      <hr className="hv-paper-rule" />
      <div className="text-[16px] leading-[1.9] text-[color:var(--hv-violet)] whitespace-pre-wrap">{body}</div>
      <hr className="hv-paper-rule" />
      <div className="flex items-end justify-between gap-4">
        <span className="text-[13px] text-[color:var(--hv-mute)]">
          {signature ? `Left by ${signature}` : "Left by somebody"}
        </span>
        <HeardMark className="w-8" fill="#BFDBF7" />
      </div>
    </article>
  </HeardLetterStack>
);

/** A loading state shaped like a letter rather than a grey block. */
export const HeardLetterSkeleton = ({ label }: { label: string }) => (
  <HeardLetterStack>
    <div role="status" aria-live="polite">
      <div className="hv-paper flex flex-col gap-4">
        <span className="hv-index">{label}</span>
        <hr className="hv-paper-rule" />
        <div className="flex flex-col gap-3 py-1">
          {["92%", "97%", "88%", "95%", "61%"].map((w, i) => (
            <span key={w + i} className="hv-skeleton-bar h-[11px]" style={{ width: w }} />
          ))}
        </div>
        <hr className="hv-paper-rule" />
        <span className="hv-skeleton-bar h-[11px] w-[34%]" />
      </div>
    </div>
  </HeardLetterStack>
);

/** Half Late, half white. For a page that has two answers. */
export const HeardSplitPanel = ({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow?: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) => (
  <section className="hv-split">
    <div className="hv-split-side">
      {eyebrow && <span className="hv-split-eyebrow">{eyebrow}</span>}
      <h1 className="hv-split-title">{title}</h1>
      {aside && <div className="hv-split-aside">{aside}</div>}
    </div>
    <div className="hv-split-main">{children}</div>
  </section>
);
