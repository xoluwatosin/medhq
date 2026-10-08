// The care offer as a document: the same words on the family's page, in the
// admin preview and in the PDF. It shows; it does not ask anything. The
// family's choices and acceptance sit outside it, on the page.
import { useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { naira, optionTotals, type OfferContent } from "@/lib/care-offer";
import type { TermsClause } from "@/content/care/newborn-terms";
import { cn } from "@/lib/utils";

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand">{children}</p>
);

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[22px] font-extrabold leading-[1.15] tracking-[-0.03em] text-navy sm:text-[26px]">{children}</h2>
);

const Ticks = ({ items, tone = "yes" }: { items: string[]; tone?: "yes" | "no" }) => (
  <ul className="flex flex-col gap-2.5">
    {items.map((item) => (
      <li key={item} className="flex gap-2.5 text-[15px] leading-[1.55] text-ink">
        {tone === "yes"
          ? <Check className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          : <Minus className="mt-1 h-4 w-4 shrink-0 text-label" aria-hidden="true" />}
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const Part = ({ label, title, children }: { label: string; title: string; children: React.ReactNode }) => (
  <section className="mc-keep border-t-4 border-navy pt-5">
    <Label>{label}</Label>
    <div className="mt-2"><Heading>{title}</Heading></div>
    <div className="mt-4">{children}</div>
  </section>
);

export const OfferTerms = ({ terms, version, expanded = false }: { terms: TermsClause[]; version: string; expanded?: boolean }) => {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      <p className="text-[14px] text-body">{version}</p>
      <div className="mt-3 border-y-2 border-navy">
        {terms.map((clause) => {
          const shown = expanded || open === clause.number;
          return (
            <div key={clause.number} className="border-b border-line last:border-b-0">
              {clause.group && (
                <p className="pt-4 text-[12px] font-extrabold uppercase tracking-[0.14em] text-label">{clause.group}</p>
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
                  <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform", shown && "rotate-180")} aria-hidden="true" />
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
}) => {
  const months = content.months;
  const pct = content.upfrontDiscountPercent;
  return (
    <div className="flex flex-col gap-10">
      <section className="mc-keep">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-2 border-navy bg-card p-5 sm:grid-cols-4 sm:p-6">
          <div><dt className="text-[13px] font-bold text-label">Prepared for</dt><dd className="mt-1 text-[15.5px] font-extrabold text-navy">{content.preparedFor}</dd></div>
          <div><dt className="text-[13px] font-bold text-label">Care for</dt><dd className="mt-1 text-[15.5px] font-extrabold text-navy">{content.careFor}</dd></div>
          <div><dt className="text-[13px] font-bold text-label">Reference</dt><dd className="mt-1 text-[15.5px] font-extrabold text-navy">{reference}</dd></div>
          <div><dt className="text-[13px] font-bold text-label">Offer valid until</dt><dd className="mt-1 text-[15.5px] font-extrabold text-navy">{expiresAt ? formatDate(expiresAt) : "Ask us"}</dd></div>
        </dl>
        <p className="mt-6 max-w-[62ch] text-[16px] leading-[1.65] text-ink">{content.intro}</p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="border-l-4 border-brand bg-tint px-4 py-3"><dt className="text-[13px] font-bold text-label">Care</dt><dd className="mt-1 text-[15px] font-bold text-ink">{content.serviceTitle}, {months} months</dd></div>
          <div className="border-l-4 border-brand bg-tint px-4 py-3"><dt className="text-[13px] font-bold text-label">Where</dt><dd className="mt-1 text-[15px] font-bold text-ink">{content.location}</dd></div>
          <div className="border-l-4 border-brand bg-tint px-4 py-3"><dt className="text-[13px] font-bold text-label">Starts</dt><dd className="mt-1 text-[15px] font-bold text-ink">{content.start}</dd></div>
        </dl>
      </section>

      <Part label="Your options" title={content.options.length > 1 ? "Compare the options" : "The care we are offering"}>
        <div className={cn("grid gap-5", content.options.length > 1 && "md:grid-cols-2")}>
          {content.options.map((option) => {
            const t = optionTotals(option, months, pct);
            const chosen = chosenOption === option.id;
            return (
              <article key={option.id} className={cn("mc-keep flex flex-col border-2 border-navy bg-card p-5 sm:p-6", chosen ? "shadow-offset ring-4 ring-brand/30" : "shadow-offset-sm")}>
                {chosen && <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand">Your choice</p>}
                <h3 className="text-[20px] font-extrabold tracking-[-0.03em] text-navy">{option.title}</h3>
                <p className="mt-2 text-[14.5px] font-bold leading-[1.5] text-ink">{option.staffing}</p>
                <p className="mt-2 text-[14.5px] leading-[1.55] text-body">{option.summary}</p>
                <div className="mt-5 border-y-2 border-navy py-4">
                  <p className="text-[30px] font-extrabold leading-none tracking-[-0.04em] text-navy">{naira(t.monthly)}<span className="text-[15px] font-bold tracking-normal text-body"> a month</span></p>
                  <p className="mt-2 text-[14px] text-body">{naira(t.total)} for {months} months, paid monthly</p>
                  {pct > 0 && (
                    <p className="mt-1 text-[14px] font-bold text-brand">{naira(t.upfront)} if paid upfront, saving {naira(t.saving)}</p>
                  )}
                </div>
                <p className="mt-5 text-[13px] font-extrabold uppercase tracking-[0.12em] text-label">Good for</p>
                <div className="mt-2"><Ticks items={option.goodFor} /></div>
                <p className="mt-5 text-[13px] font-extrabold uppercase tracking-[0.12em] text-label">Worth knowing</p>
                <div className="mt-2"><Ticks items={option.consider} tone="no" /></div>
              </article>
            );
          })}
        </div>
        {content.options.length > 1 && (
          <div className="mc-keep mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px] border-2 border-navy text-left text-[14px]">
              <thead className="bg-navy text-white">
                <tr>
                  <th className="px-3 py-2.5 font-extrabold"> </th>
                  {content.options.map((o) => <th key={o.id} className="px-3 py-2.5 font-extrabold">{o.title}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Who is in the home", value: (o: typeof content.options[number]) => o.staffing },
                  { label: "A month", value: (o: typeof content.options[number]) => naira(o.monthly) },
                  { label: `${months} months, paid monthly`, value: (o: typeof content.options[number]) => naira(optionTotals(o, months, pct).total) },
                  ...(pct > 0 ? [{ label: `${months} months, paid upfront (${pct}% off)`, value: (o: typeof content.options[number]) => naira(optionTotals(o, months, pct).upfront) }] : []),
                ].map((row) => (
                  <tr key={row.label} className="border-t border-line align-top">
                    <th scope="row" className="px-3 py-2.5 font-bold text-label">{row.label}</th>
                    {content.options.map((o) => <td key={o.id} className="px-3 py-2.5 font-bold text-ink">{row.value(o)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[14px] leading-[1.6] text-body">Prices are the full price of the care. Nothing is added for nights, public holidays, travel to and from your home, or administration.</p>
      </Part>

      <Part label="What is included" title="What your nurse does">
        <div className="grid gap-8 md:grid-cols-2">
          <div><Ticks items={content.included} /></div>
          <div>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-label">Not included</p>
            <div className="mt-3"><Ticks items={content.notIncluded} tone="no" /></div>
          </div>
        </div>
      </Part>

      <Part label="How it works" title="Before and during care">
        <Ticks items={content.howItWorks} />
        <p className="mt-6 text-[13px] font-extrabold uppercase tracking-[0.12em] text-label">Your home provides</p>
        <div className="mt-3"><Ticks items={content.familyProvides} /></div>
        <p className="mt-6 border-l-4 border-brand bg-tint px-4 py-3 text-[14.5px] leading-[1.6] text-body">{content.assessment}</p>
      </Part>

      <Part label="Paying" title="How to pay">
        <p className="text-[15px] leading-[1.6] text-body">
          Pay by bank transfer to the account below. Please use <span className="font-extrabold text-navy">{reference}</span> as the payment reference. We confirm every payment in writing.
        </p>
        <dl className="mc-keep mt-4 grid gap-3 border-2 border-navy bg-card p-5 sm:grid-cols-3">
          <div><dt className="text-[13px] font-bold text-label">Bank</dt><dd className="mt-1 text-[16px] font-extrabold text-navy">{content.payment.bankName || "To follow"}</dd></div>
          <div><dt className="text-[13px] font-bold text-label">Account name</dt><dd className="mt-1 text-[16px] font-extrabold text-navy">{content.payment.accountName}</dd></div>
          <div><dt className="text-[13px] font-bold text-label">Account number</dt><dd className="mt-1 text-[16px] font-extrabold tracking-[0.04em] text-navy">{content.payment.accountNumber || "To follow"}</dd></div>
        </dl>
      </Part>

      <Part label="The agreement" title="Terms of care">
        <p className="mb-4 text-[15px] leading-[1.6] text-body">
          {print ? "The terms that apply to this care." : "Open any part to read it. Ask us about anything that is not clear."}
        </p>
        <OfferTerms terms={terms} version={termsVersion} expanded={print} />
      </Part>
    </div>
  );
};

export default OfferDocument;
