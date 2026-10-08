// The care offer, in parts. The family's page shows one part at a time; the
// PDF and the admin preview show them all, in order. Every part draws the same
// words wherever it appears. Nothing here asks a question: choosing and
// accepting happen on the page.
import { useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { feeRows, naira, optionTotals, scheduleRows, type FeeRow, type OfferContent, type OfferOption, type PaymentPlan } from "@/lib/care-offer";
import type { TermsClause } from "@/content/care/newborn-terms";
import { cn } from "@/lib/utils";

export const OfferLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-label">{children}</p>
);

export const Ticks = ({ items, tone = "yes" }: { items: string[]; tone?: "yes" | "no" }) => (
  <ul className="flex flex-col gap-3">
    {items.map((item) => (
      <li key={item} className="flex gap-3 text-[15px] leading-[1.55] text-ink">
        <span className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center",
          tone === "yes" ? "bg-brand text-white" : "border-2 border-line text-label",
        )}>
          {tone === "yes" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Minus className="h-3 w-3" aria-hidden="true" />}
        </span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

/** Who it is for, where, when, and how long the offer stands. */
export const OfferSummary = ({ reference, content, expiresAt }: { reference: string; content: OfferContent; expiresAt: string | null }) => (
  <dl className="grid grid-cols-2 border-2 border-navy bg-card">
    {[
      { label: "Care for", value: content.careFor },
      { label: "Care", value: `${content.serviceTitle}, ${content.months} months` },
      { label: "Where", value: content.location },
      { label: "Starts", value: content.start },
      { label: "Reference", value: reference },
      { label: "Valid until", value: expiresAt ? formatDate(expiresAt) : "Ask us" },
    ].map((row, i) => (
      <div key={row.label} className={cn("px-4 py-3.5 sm:px-5", i % 2 === 0 && "border-r border-line", i > 1 && "border-t border-line")}>
        <dt className="text-[12.5px] font-bold text-label">{row.label}</dt>
        <dd className="mt-1 text-[15px] font-extrabold leading-[1.3] text-navy">{row.value}</dd>
      </div>
    ))}
  </dl>
);

/** An option's name, with any plus sign set large in brand blue. */
export const OptionTitle = ({ title, onDark = false }: { title: string; onDark?: boolean }) => (
  <>
    {title.split(" + ").map((part, i) => (
      <span key={part}>
        {i > 0 && <span className={cn("mx-1 font-black", onDark ? "text-white" : "text-brand")} aria-label="plus">+</span>}
        {part}
      </span>
    ))}
  </>
);

/** Fees as a two-column table: what it is, and how much. */
export const OfferFeeTable = ({ rows, caption = "Fees" }: { rows: FeeRow[]; caption?: string }) => (
  <table className="mc-keep w-full border-2 border-navy bg-card text-left text-[14px]">
    <caption className="sr-only">{caption}</caption>
    <tbody>
      {rows.map((r, i) => (
        <tr key={r.label} className={cn(i > 0 && "border-t border-line", r.strong && "bg-tint")}>
          <th scope="row" className={cn("px-3 py-2.5 align-middle text-[13.5px] leading-[1.35]", r.strong ? "font-extrabold text-navy" : "font-bold text-label")}>{r.label}</th>
          <td className={cn("whitespace-nowrap px-3 py-2.5 text-right align-middle tabular-nums", r.strong ? "text-[20px] font-extrabold tracking-[-0.03em] text-navy" : "font-extrabold text-ink")}>{r.value}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

/** One option, priced. */
export const OfferOptionCard = ({
  option, content, chosen = false, action,
}: { option: OfferOption; content: OfferContent; chosen?: boolean; action?: React.ReactNode }) => {
  return (
    <article className={cn("mc-keep flex flex-col border-2 border-navy bg-card p-5 sm:p-6", chosen ? "shadow-offset-blue" : "shadow-offset-sm")}>
      {chosen && <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand">Your choice</p>}
      <h3 className="text-[21px] font-extrabold leading-[1.15] tracking-[-0.03em] text-navy"><OptionTitle title={option.title} /></h3>
      <p className="mt-2 text-[14.5px] font-bold leading-[1.5] text-ink">{option.staffing}</p>
      <p className="mt-2 text-[14.5px] leading-[1.55] text-body">{option.summary}</p>
      <div className="mt-5"><OfferFeeTable rows={feeRows(option, content.months, content.upfrontDiscountPercent)} caption={`Fees for ${option.title}`} /></div>
      <div className="mt-5"><OfferLabel>Good for</OfferLabel></div>
      <div className="mt-3"><Ticks items={option.goodFor} /></div>
      <div className="mt-5"><OfferLabel>Worth knowing</OfferLabel></div>
      <div className="mt-3"><Ticks items={option.consider} tone="no" /></div>
      {action && <div className="mt-6">{action}</div>}
    </article>
  );
};

/** The options side by side, in numbers. */
export const OfferCompareTable = ({ content }: { content: OfferContent }) => {
  const { months, upfrontDiscountPercent: pct, options } = content;
  const rows = [
    { label: "A month", value: (o: OfferOption) => naira(o.monthly) },
    { label: `${months} months, monthly`, value: (o: OfferOption) => naira(optionTotals(o, months, pct).total) },
    ...(pct > 0 ? [
      { label: `${months} months upfront (${pct}% discount)`, value: (o: OfferOption) => naira(optionTotals(o, months, pct).upfront) },
      { label: "You save upfront", value: (o: OfferOption) => naira(optionTotals(o, months, pct).saving) },
    ] : []),
  ];
  return (
    <table className="mc-keep w-full border-2 border-navy text-left text-[14px]">
      <thead className="bg-navy text-white">
        <tr>
          <th className="w-[34%] px-3 py-2.5 text-[12.5px] font-bold"><span className="sr-only">Cost</span></th>
          {options.map((o) => <th key={o.id} className="px-3 py-2.5 text-[13px] font-extrabold leading-tight"><OptionTitle title={o.title} onDark /></th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-line align-top">
            <th scope="row" className="px-3 py-2.5 text-[13px] font-bold text-label">{row.label}</th>
            {options.map((o) => <td key={o.id} className="px-3 py-2.5 font-extrabold tabular-nums text-ink">{row.value(o)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const OfferPriceNote = () => (
  <p className="text-[14px] leading-[1.6] text-body">
    These are the full prices. Nothing is added for nights, public holidays, travel to and from your home, or administration. No VAT is charged.
  </p>
);

export const OfferIncluded = ({ content }: { content: OfferContent }) => (
  <div className="flex flex-col gap-7">
    <Ticks items={content.included} />
    <div className="border-t-2 border-navy pt-5">
      <OfferLabel>Not included</OfferLabel>
      <div className="mt-3"><Ticks items={content.notIncluded} tone="no" /></div>
    </div>
  </div>
);

export const OfferHowItWorks = ({ content }: { content: OfferContent }) => (
  <div className="flex flex-col gap-7">
    <ol className="flex flex-col gap-4">
      {content.howItWorks.map((item, i) => (
        <li key={item} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-navy text-[13px] font-extrabold text-white">{i + 1}</span>
          <span className="pt-0.5 text-[15px] leading-[1.55] text-ink">{item}</span>
        </li>
      ))}
    </ol>
    <div className="border-t-2 border-navy pt-5">
      <OfferLabel>Your home provides</OfferLabel>
      <div className="mt-3"><Ticks items={content.familyProvides} /></div>
    </div>
    <p className="border-l-4 border-brand bg-tint px-4 py-3 text-[14.5px] leading-[1.6] text-body">{content.assessment}</p>
  </div>
);

export const OfferBankDetails = ({ reference, content, amount }: { reference: string; content: OfferContent; amount?: number }) => (
  <dl className="mc-keep grid grid-cols-1 border-2 border-navy bg-card sm:grid-cols-2">
    {[
      ...(amount ? [{ label: "Amount", value: naira(amount) }] : []),
      { label: "Payment reference", value: reference },
      { label: "Bank", value: content.payment.bankName || "To follow" },
      { label: "Account number", value: content.payment.accountNumber || "To follow" },
      { label: "Account name", value: content.payment.accountName },
    ].map((row, i) => (
      <div key={row.label} className={cn("px-4 py-3.5 sm:px-5", i > 0 && "border-t border-line sm:[&:nth-child(2)]:border-t-0", i % 2 === 1 && "sm:border-l")}>
        <dt className="text-[12.5px] font-bold text-label">{row.label}</dt>
        <dd className="mt-1 text-[16px] font-extrabold tracking-[0.01em] text-navy">{row.value}</dd>
      </div>
    ))}
  </dl>
);

export const OfferSchedule = ({
  content, reference, option, plan,
}: { content: OfferContent; reference: string; option: OfferOption | null; plan: PaymentPlan | null }) => {
  const rows = scheduleRows(content, reference, option, plan);
  const group = (title: string, note: string, list: typeof rows) => (
    <div>
      <p className="text-[15px] font-extrabold text-navy">{title}</p>
      <p className="mt-1 text-[14px] leading-[1.5] text-body">{note}</p>
      <dl className="mt-3 border-2 border-navy bg-card">
        {list.map((row, i) => (
          <div key={row.label} className={cn("grid gap-1 px-4 py-3 sm:grid-cols-[170px_1fr] sm:gap-4 sm:px-5", i > 0 && "border-t border-line")}>
            <dt className="text-[13px] font-bold text-label">{row.label}</dt>
            <dd className="flex flex-col gap-1.5 text-[14.5px] leading-[1.55] text-ink">
              {row.lines.map((l) => <span key={l}>{l}</span>)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      {group("What you agree to now", "By accepting, you agree to these.", rows.filter((r) => !r.later))}
      {group("What we agree with you before care starts", "These are part of your care plan. We go through them with you at the introduction, and nothing here is charged without your agreement.", rows.filter((r) => r.later))}
    </div>
  );
};

export const OfferTerms = ({ terms, version, expanded = false }: { terms: TermsClause[]; version: string; expanded?: boolean }) => {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      <p className="text-[13.5px] font-bold text-label">{version}</p>
      <div className="mt-3 border-y-2 border-navy">
        {terms.map((clause) => {
          const shown = expanded || open === clause.number;
          return (
            <div key={clause.number} className="border-b border-line last:border-b-0">
              {clause.group && (
                <p className="pt-4 text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-brand">{clause.group}</p>
              )}
              {expanded ? (
                <h3 className="pt-3 text-[16px] font-extrabold text-navy">{clause.number}. {clause.title}</h3>
              ) : (
                <button
                  type="button"
                  aria-expanded={shown}
                  onClick={() => setOpen(shown ? null : clause.number)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left text-[15.5px] font-extrabold text-navy"
                >
                  <span>{clause.number}. {clause.title}</span>
                  <ChevronDown className={cn("h-5 w-5 shrink-0 text-brand transition-transform", shown && "rotate-180")} aria-hidden="true" />
                </button>
              )}
              {shown && (
                <div className="flex flex-col gap-3 pb-4 pt-1">
                  {clause.paragraphs.map((p) => (
                    <p key={p.slice(0, 40)} className="text-[14.5px] leading-[1.6] text-body">{p}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Part = ({ label, title, children }: { label: string; title: string; children: React.ReactNode }) => (
  <section className="mc-keep border-t-4 border-navy pt-5">
    <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand">{label}</p>
    <h2 className="mt-2 text-[22px] font-extrabold leading-[1.15] tracking-[-0.03em] text-navy sm:text-[26px]">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

/** Every part, in order: the PDF and the admin preview. */
const OfferDocument = ({
  reference, content, terms, termsVersion, expiresAt, print = false, chosenOption,
}: {
  reference: string;
  content: OfferContent;
  terms: TermsClause[];
  termsVersion: string;
  expiresAt: string | null;
  /** The PDF: every clause open, nothing to press. */
  print?: boolean;
  chosenOption?: string | null;
}) => (
  <div className="flex flex-col gap-10">
    <section className="mc-keep flex flex-col gap-6">
      <p className="text-[15px] font-bold text-label">Prepared for {content.preparedFor}</p>
      <p className="max-w-[62ch] text-[16px] leading-[1.65] text-ink">{content.intro}</p>
      <OfferSummary reference={reference} content={content} expiresAt={expiresAt} />
    </section>

    <Part label="Your options" title={content.options.length > 1 ? "Compare the options" : "The care we are offering"}>
      <div className={cn("grid gap-5", content.options.length > 1 && "md:grid-cols-2")}>
        {content.options.map((option) => (
          <OfferOptionCard key={option.id} option={option} content={content} chosen={chosenOption === option.id} />
        ))}
      </div>
      {content.options.length > 1 && <div className="mt-6"><OfferCompareTable content={content} /></div>}
      <div className="mt-4"><OfferPriceNote /></div>
    </Part>

    <Part label="What is included" title="Your nurse's responsibilities"><OfferIncluded content={content} /></Part>
    <Part label="Your care schedule" title="Care schedule">
      <OfferSchedule content={content} reference={reference} option={content.options.find((o) => o.id === chosenOption) ?? null} plan={null} />
    </Part>
    <Part label="Paying" title="How to pay">
      <p className="mb-4 text-[15px] leading-[1.6] text-body">
        Pay by bank transfer, using <span className="font-extrabold text-navy">{reference}</span> as the payment reference. We confirm every payment in writing.
      </p>
      <OfferBankDetails reference={reference} content={content} />
    </Part>
    <Part label="The agreement" title="Terms of care">
      <OfferTerms terms={terms} version={termsVersion} expanded={print} />
    </Part>
  </div>
);

export default OfferDocument;
