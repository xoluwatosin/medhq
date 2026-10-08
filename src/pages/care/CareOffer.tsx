// The family's care offer, one part at a time: a welcome, the options to
// compare, what is included, how it works, the terms, and accepting. Drawn
// like the site's request journey: a navy cap, a progress bar with every part
// reachable, one part on screen, and Back and Next at the foot. No account is
// needed; the link is the key.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Download, MessageCircle } from "lucide-react";
import SEO from "@/components/SEO";
import { NotchTag, Watermark } from "@/components/mc/brand";
import { art } from "@/components/mc/art";
import { Choice, requestPrimary, requestSecondary } from "@/components/request/RequestShell";
import { FamilyLoading } from "@/components/care/FamilyShell";
import {
  OfferBankDetails, OfferCompareTable, OfferHowItWorks, OfferIncluded, OfferLabel,
  OfferOptionCard, OfferPriceNote, OfferSummary, OfferTerms,
} from "@/components/care/OfferDocument";
import { supabase } from "@/integrations/supabase/client";
import { downloadOfferPdf } from "@/lib/offer-pdf";
import { formatDate } from "@/lib/format";
import { firstPayment, naira, offerOpen, optionTotals, type OfferView, type PaymentPlan } from "@/lib/care-offer";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";

const WHATSAPP = "https://wa.me/2348126988237";

type StepId = "welcome" | "options" | "included" | "how" | "terms" | "accept";

const STEPS: { id: StepId; short: string; label: string; art: string }[] = [
  { id: "welcome", short: "Welcome", label: "Your offer", art: art.postnatalSpecialist },
  { id: "options", short: "Options", label: "Your options", art: art.nightNurseCot },
  { id: "included", short: "Included", label: "What is included", art: art.objBottleMuslin },
  { id: "how", short: "How it works", label: "How it works", art: art.objCalendar },
  { id: "terms", short: "Terms", label: "The agreement", art: art.objSignedContract },
  { id: "accept", short: "Accept", label: "Accept", art: art.objHandshake },
];

const errorFrom = async (data: { error?: string } | null, e: unknown, fallback: string) => {
  const ctx = (e as { context?: Response } | null)?.context;
  const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
  return data?.error ?? body?.error ?? fallback;
};

/** The navy cap: the site's hero in small. */
const Cap = ({ title, onPdf, making, artSrc }: { title: string; onPdf?: () => void; making?: boolean; artSrc?: string }) => (
  <header className="relative overflow-hidden bg-navy pt-[max(12px,env(safe-area-inset-top))]">
    <Watermark glyph="o" size={300} opacity={0.12} className="-right-[110px] -top-[60px]" />
    <div className="relative mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 sm:px-8">
      <img src={logoWhite} alt="Medic Connect" className="h-7 w-auto sm:h-8" />
      {onPdf && (
        <button type="button" onClick={onPdf} disabled={making} className="inline-flex min-h-10 items-center gap-1.5 border-2 border-outline-navy px-3 text-[13.5px] font-extrabold text-white transition-colors hover:bg-white hover:text-navy disabled:opacity-60">
          <Download className="h-4 w-4" aria-hidden="true" /> {making ? "Making PDF" : "PDF"}
        </button>
      )}
    </div>
    <div className="relative mx-auto flex max-w-3xl items-end px-4 sm:px-8">
      <div className="min-w-0 flex-1 pb-6 pt-5 pr-[86px] sm:pb-8 sm:pr-0">
        <span className="inline-flex"><NotchTag tone="white" size="sm">Care offer</NotchTag></span>
        <h1 className="mt-3 text-[25px] font-extrabold leading-[1.08] tracking-[-0.04em] text-white sm:text-[34px]">{title}</h1>
      </div>
      {artSrc && (
        <img src={artSrc} alt="" aria-hidden="true" className="pointer-events-none absolute bottom-0 right-3 h-[92px] w-auto object-contain object-bottom sm:static sm:h-[130px]" />
      )}
    </div>
  </header>
);

/** With `preview`, staff see exactly what the family will see; nothing is loaded or accepted. */
const CareOffer = ({ preview }: { preview?: OfferView } = {}) => {
  const { token = "" } = useParams();
  const [offer, setOffer] = useState<OfferView | null>(preview ?? null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [viewing, setViewing] = useState(0);
  const [option, setOption] = useState<string | null>(null);
  const [plan, setPlan] = useState<PaymentPlan>("monthly");
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [seen, setSeen] = useState<number[]>([0]);
  const barRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLOListElement>(null);

  const load = useCallback(async () => {
    if (preview) {
      setOption(preview.accepted_option ?? (preview.content.options.length === 1 ? preview.content.options[0].id : null));
      return;
    }
    const { data, error: e } = await supabase.functions.invoke("care-offer", { body: { token, action: "load" } });
    if (e || !data?.ok) {
      setError(await errorFrom(data, e, "We could not open this offer."));
      return;
    }
    const o = data.offer as OfferView;
    setOffer(o);
    setOption((current) => current ?? o.accepted_option ?? (o.content.options.length === 1 ? o.content.options[0].id : null));
  }, [token, preview]);

  useEffect(() => { void load(); }, [load]);

  // The accessibility button keeps clear of the Back and Next bar.
  const loaded = !!offer;
  useEffect(() => {
    const root = document.documentElement;
    const publish = () => {
      root.style.setProperty("--mc-bottom-reserve", `${barRef.current?.offsetHeight ?? 0}px`);
      window.dispatchEvent(new Event("resize"));
    };
    const t = window.setTimeout(publish, 50);
    return () => {
      window.clearTimeout(t);
      root.style.removeProperty("--mc-bottom-reserve");
      window.dispatchEvent(new Event("resize"));
    };
  }, [loaded]);

  // The part showing stays in view in the row of parts.
  useEffect(() => {
    const chip = railRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    chip?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [step]);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, n));
    setStep(next);
    setSeen((s) => (s.includes(next) ? s : [...s, next]));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const downloadPdf = async () => {
    if (!offer) return;
    setMaking(true);
    setPdfError(null);
    try {
      await downloadOfferPdf(offer);
    } catch {
      setPdfError("The PDF could not be made. Please try again, or ask us to email it to you.");
    } finally {
      setMaking(false);
    }
  };

  const accept = async () => {
    if (!offer || !option) return;
    if (preview) {
      setProblem("This is a preview. Accepting only works from the family's link.");
      return;
    }
    setBusy(true);
    setProblem(null);
    const { data, error: e } = await supabase.functions.invoke("care-offer", {
      body: { token, action: "accept", option, payment: plan, agree, name },
    });
    setBusy(false);
    if (e || !data?.ok) {
      setProblem(await errorFrom(data, e, "That did not go through. Please try again."));
      return;
    }
    setOffer(data.offer as OfferView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const seo = <SEO title="Your care offer | Medic Connect" description="Your care offer from Medic Connect" path="/care/offer" noindex />;

  if (error || !offer) {
    return (
      <div className="flex min-h-dvh flex-col bg-card">
        {seo}
        <Cap title="Your care offer" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-8">
          {error ? (
            <>
              <h2 className="text-[22px] font-extrabold tracking-[-0.03em] text-navy">We could not open this offer</h2>
              <p className="mt-3 text-[15.5px] leading-[1.6] text-body">{error}</p>
              <a href={WHATSAPP} className={cn(requestSecondary, "mt-6")}><MessageCircle className="h-4 w-4" /> Message us on WhatsApp</a>
            </>
          ) : <FamilyLoading label="Opening your offer" />}
        </main>
      </div>
    );
  }

  const c = offer.content;
  const first = c.preparedFor.split(" ")[0] || "Hello";
  const accepted = offer.status === "accepted";
  const open = offerOpen(offer);
  const chosen = c.options.find((o) => o.id === (accepted ? offer.accepted_option : option)) ?? null;
  const acceptedPlan = (offer.accepted_payment ?? plan) as PaymentPlan;
  const due = chosen ? firstPayment(chosen, c.months, c.upfrontDiscountPercent, acceptedPlan) : 0;
  const ready = !!option && agree && name.trim().includes(" ") && name.trim().length >= 3;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const viewingOption = c.options[Math.min(viewing, c.options.length - 1)];

  const chooseButton = (id: string) => (
    <button
      type="button"
      onClick={() => setOption(id)}
      aria-pressed={option === id}
      className={cn(option === id ? requestPrimary : requestSecondary, "w-full")}
    >
      {option === id ? "Chosen" : "Choose this option"}
    </button>
  );

  const body: Record<StepId, React.ReactNode> = {
    welcome: (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[28px]">Hello {first}</h2>
          <p className="mt-3 text-[16px] leading-[1.65] text-ink">{c.intro}</p>
        </div>
        {!accepted && !open && (
          <p className="border-l-4 border-destructive bg-tint px-4 py-3 text-[14.5px] leading-[1.6] text-ink">
            This offer {offer.status === "withdrawn" ? "has been withdrawn" : "has expired"}. Message us and we will send you an up-to-date one.
          </p>
        )}
        <OfferSummary reference={offer.reference} content={c} expiresAt={offer.expires_at} />
        <div>
          <OfferLabel>In this offer</OfferLabel>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {STEPS.slice(1).map((s, i) => (
              <li key={s.id}>
                <button type="button" onClick={() => go(i + 1)} className="flex w-full items-center gap-3 border-2 border-navy bg-card px-3 py-2.5 text-left shadow-offset-sm transition-colors hover:bg-tint">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-brand text-[13px] font-extrabold text-white">{i + 1}</span>
                  <span className="text-[15px] font-extrabold text-navy">{s.label}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-brand" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    ),
    options: (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[28px]">
            {c.options.length > 1 ? `${c.options.length === 2 ? "Two" : c.options.length} ways to care for ${c.careFor}` : "The care we are offering"}
          </h2>
          {c.options.length > 1 && <p className="mt-2 text-[15px] leading-[1.55] text-body">Look at each, then choose the one that suits your family. You can change your mind before you accept.</p>}
        </div>

        {c.options.length > 1 && (
          <div role="tablist" aria-label="Options" className="grid grid-cols-2 border-2 border-navy md:hidden">
            {c.options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="tab"
                aria-selected={viewing === i}
                onClick={() => setViewing(i)}
                className={cn("min-h-12 px-2 text-[14px] font-extrabold leading-tight", viewing === i ? "bg-navy text-white" : "bg-card text-navy", i > 0 && "border-l-2 border-navy")}
              >
                {o.title}
              </button>
            ))}
          </div>
        )}
        <div className="md:hidden">
          {viewingOption && (
            <OfferOptionCard
              key={viewingOption.id}
              option={viewingOption}
              content={c}
              chosen={accepted ? offer.accepted_option === viewingOption.id : option === viewingOption.id}
              action={accepted || !open ? undefined : chooseButton(viewingOption.id)}
            />
          )}
        </div>
        <div className={cn("hidden gap-5 md:grid", c.options.length > 1 && "md:grid-cols-2")}>
          {c.options.map((o) => (
            <OfferOptionCard
              key={o.id}
              option={o}
              content={c}
              chosen={accepted ? offer.accepted_option === o.id : option === o.id}
              action={accepted || !open ? undefined : chooseButton(o.id)}
            />
          ))}
        </div>

        {c.options.length > 1 && (
          <div>
            <OfferLabel>Side by side</OfferLabel>
            <div className="mt-3"><OfferCompareTable content={c} /></div>
          </div>
        )}
        <OfferPriceNote />
      </div>
    ),
    included: (
      <div className="flex flex-col gap-6">
        <h2 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[28px]">Your nurse's responsibilities</h2>
        <OfferIncluded content={c} />
      </div>
    ),
    how: (
      <div className="flex flex-col gap-6">
        <h2 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[28px]">Before and during care</h2>
        <OfferHowItWorks content={c} />
      </div>
    ),
    terms: (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[28px]">Terms of care</h2>
          <p className="mt-2 text-[15px] leading-[1.55] text-body">The agreement between us. Tap any part to read it, and ask us about anything that is not clear.</p>
        </div>
        <OfferTerms terms={offer.terms} version={offer.terms_version} />
        <button type="button" onClick={() => void downloadPdf()} disabled={making} className={cn(requestSecondary, "self-start")}>
          <Download className="h-4 w-4" /> {making ? "Making PDF" : "Download the offer and terms"}
        </button>
      </div>
    ),
    accept: accepted && chosen ? (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[28px]">Thank you, {first}</h2>
          <p className="mt-3 text-[15.5px] leading-[1.6] text-ink">
            You chose <b>{chosen.title.toLowerCase()}</b>, paying {acceptedPlan === "upfront" ? `all ${c.months} months upfront` : "monthly"}.
            Accepted by {offer.accepted_name}{offer.accepted_at ? ` on ${formatDate(offer.accepted_at)}` : ""}. We have emailed you a copy.
          </p>
        </div>
        <div>
          <OfferLabel>Your first payment</OfferLabel>
          <div className="mt-3"><OfferBankDetails reference={offer.reference} content={c} amount={due} /></div>
          {c.payment.payOnlineUrl && <a href={c.payment.payOnlineUrl} className={cn(requestPrimary, "mt-4 w-full sm:w-auto")}>Pay online</a>}
        </div>
        <div>
          <OfferLabel>What happens next</OfferLabel>
          <ol className="mt-3 flex flex-col gap-3">
            {[
              "We confirm your booking in writing.",
              "We arrange a meeting and introduction with your nurse.",
              "Care starts once your first payment is received.",
            ].map((t, i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-navy text-[13px] font-extrabold text-white">{i + 1}</span>
                <span className="pt-0.5 text-[15px] text-ink">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    ) : !open ? (
      <div className="flex flex-col gap-4">
        <h2 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy">This offer can no longer be accepted</h2>
        <p className="text-[15.5px] leading-[1.6] text-body">{offer.status === "withdrawn" ? "It has been withdrawn." : "It has expired."} Message us and we will send you an up-to-date offer.</p>
        <a href={WHATSAPP} className={cn(requestSecondary, "self-start")}><MessageCircle className="h-4 w-4" /> WhatsApp us</a>
      </div>
    ) : (
      <div className="flex flex-col gap-7">
        <div>
          <h2 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[28px]">Accept your offer</h2>
          <p className="mt-2 text-[15px] leading-[1.55] text-body">Accepting books your care. Nothing is taken from you here: you pay by bank transfer afterwards.</p>
        </div>

        {c.options.length > 1 && (
          <fieldset>
            <legend className="text-[16px] font-extrabold text-navy">Which option?</legend>
            <div className="mt-3 flex flex-col gap-2.5">
              {c.options.map((o) => (
                <Choice key={o.id} label={o.title} blurb={`${naira(o.monthly)} a month. ${o.staffing}`} selected={option === o.id} onClick={() => setOption(o.id)} />
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className="text-[16px] font-extrabold text-navy">How would you like to pay?</legend>
          <div className="mt-3 flex flex-col gap-2.5">
            {(["monthly", "upfront"] as const).filter((p) => p === "monthly" || c.upfrontDiscountPercent > 0).map((p) => {
              const t = chosen ? optionTotals(chosen, c.months, c.upfrontDiscountPercent) : null;
              const blurb = t
                ? p === "monthly" ? `${naira(t.monthly)} a month, the first before care starts` : `${naira(t.upfront)} once. A ${c.upfrontDiscountPercent}% discount, saving you ${naira(t.saving)}`
                : p === "monthly" ? "Each month in advance" : `${c.upfrontDiscountPercent}% off the total`;
              return <Choice key={p} label={p === "monthly" ? "Monthly" : `All ${c.months} months upfront (${c.upfrontDiscountPercent}% discount)`} blurb={blurb} selected={plan === p} onClick={() => setPlan(p)} />;
            })}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 border-2 border-navy bg-tint p-4">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--brand))]" />
          <span className="text-[15px] leading-[1.55] text-ink">
            I have read the offer and the <button type="button" onClick={() => go(4)} className="font-extrabold text-brand underline underline-offset-2">terms of care</button>, and I accept them.
          </span>
        </label>

        <label className="block">
          <span className="text-[16px] font-extrabold text-navy">Your full name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="First and last name"
            className="mt-2 min-h-12 w-full border-2 border-navy bg-card px-4 text-[16px] text-ink placeholder:text-label focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>

        {chosen && (
          <p className="text-[14.5px] leading-[1.55] text-body">
            Your first payment will be <b className="text-navy">{naira(firstPayment(chosen, c.months, c.upfrontDiscountPercent, plan))}</b>. We show you the bank details as soon as you accept.
          </p>
        )}
        {problem && <p className="text-[14.5px] font-bold text-destructive" role="alert">{problem}</p>}
      </div>
    ),
  };

  const primary = isLast
    ? (accepted || !open
        ? <a href={WHATSAPP} className={cn(requestPrimary, "flex-1 sm:flex-none")}><MessageCircle className="h-4 w-4" /> Questions? WhatsApp us</a>
        : (
          <button type="button" disabled={!ready || busy} onClick={() => void accept()} className={cn(requestPrimary, "flex-1 sm:flex-none")}>
            {busy ? "Accepting" : !option ? "Choose an option first" : `Accept ${chosen?.title.toLowerCase() ?? ""}`}
          </button>
        ))
    : (
      <button type="button" onClick={() => go(step + 1)} className={cn(requestPrimary, "flex-1 sm:flex-none")}>
        {step === 0 ? "See the options" : `Next: ${STEPS[step + 1].short.toLowerCase()}`} <ArrowRight className="h-4 w-4" />
      </button>
    );

  return (
    <div className="flex min-h-dvh flex-col bg-card">
      {seo}
      <Cap title={`Your care offer for ${c.careFor}`} onPdf={() => void downloadPdf()} making={making} artSrc={current.art} />

      {/* Where they are, and every part one tap away. */}
      <nav aria-label="Parts of the offer" className="sticky top-0 z-20 border-b-2 border-navy bg-card">
        <ol ref={railRef} className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-8">
          {STEPS.map((s, i) => {
            const isCurrent = i === step;
            const label = s.id === "accept" && accepted ? "Your booking" : s.short;
            return (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 border-2 px-2.5 text-[13px] font-extrabold transition-colors",
                    isCurrent ? "border-navy bg-navy text-white" : seen.includes(i) ? "border-navy bg-tint text-navy" : "border-line bg-card text-label",
                  )}
                >
                  <span className="tabular-nums">{i + 1}</span> {label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+112px)] pt-6 sm:px-8 sm:pt-8">
        {pdfError && <p role="alert" className="mb-4 border-l-4 border-destructive bg-tint px-4 py-3 text-[14.5px] font-bold text-ink">{pdfError}</p>}
        <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand">{current.label}</p>
        <div key={current.id} className="animate-in fade-in slide-in-from-right-4 duration-300">{body[current.id]}</div>
        <p className="mt-10 border-t border-line pt-5 text-[14px] leading-[1.6] text-body">
          Questions? Call or WhatsApp us on <a href={WHATSAPP} className="font-extrabold text-brand">+234 812 698 8237</a>, or email hello@medicconnect.co. We are here every day from 7am to 10pm.
        </p>
      </main>

      {/* Back and Next, always within reach of a thumb. */}
      <div ref={barRef} className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-navy bg-card pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 sm:justify-between sm:px-8">
          {step > 0 ? (
            <button type="button" onClick={() => go(step - 1)} className={cn(requestSecondary, "px-4")} aria-label="Back">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
            </button>
          ) : <span className="hidden sm:block" />}
          {primary}
        </div>
      </div>

    </div>
  );
};

export default CareOffer;
