// The family's care offer, one part at a time: a welcome, the options to
// compare, what is included, how it works, the terms, and accepting. Drawn
// like the site's request journey: a navy cap, a progress bar with every part
// reachable, one part on screen, and Back and Next at the foot. No account is
// needed; the link is the key.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Download, MessageCircle } from "lucide-react";
import SEO from "@/components/SEO";
import { NotchTag, Watermark } from "@/components/mc/brand";
import { art } from "@/components/mc/art";
import { Choice, requestPrimary, requestSecondary } from "@/components/request/RequestShell";
import { FamilyLoading } from "@/components/care/FamilyShell";
import {
  OfferBankDetails, OfferCompareTable, OfferFeeTable, OfferSchedule, OfferIncluded, OfferLabel,
  OfferOptionCard, OfferPriceNote, OfferSummary, OfferTerms,
} from "@/components/care/OfferDocument";
import { supabase } from "@/integrations/supabase/client";
import { downloadOfferPdf, offerPdfBase64 } from "@/lib/offer-pdf";
import SignaturePad from "@/components/contracts/SignaturePad";
import { formatDate } from "@/lib/format";
import { chosenFeeRows, firstPayment, naira, offerOpen, offerWords, optionTotals, type OfferView, type PaymentPlan } from "@/lib/care-offer";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";

const WHATSAPP = "https://wa.me/2348126988237";

type StepId = "welcome" | "options" | "schedule" | "terms" | "accept";

const STEPS: { id: StepId; short: string; label: string; art: string }[] = [
  { id: "welcome", short: "Welcome", label: "Your offer", art: art.postnatalSpecialist },
  { id: "options", short: "Options", label: "Your options", art: art.nightNurseCot },
  { id: "schedule", short: "Care schedule", label: "Your care schedule", art: art.objBottleMuslin },
  { id: "terms", short: "Terms", label: "The agreement", art: art.objSignedContract },
  { id: "accept", short: "Accept", label: "Accept", art: art.objHandshake },
];

// Eldercare offers swap the baby pictures for ones of older people and their care.
const ELDER_ART: Partial<Record<StepId, string>> = {
  welcome: art.charCaregiver,
  options: art.elderWomanAdire,
  schedule: art.objPillOrganiser,
};
const stepArt = (s: (typeof STEPS)[number], kind?: string) => (kind === "eldercare" ? ELDER_ART[s.id] ?? s.art : s.art);

const errorFrom = async (data: { error?: string } | null, e: unknown, fallback: string) => {
  const ctx = (e as { context?: Response } | null)?.context;
  const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
  return data?.error ?? body?.error ?? fallback;
};

/** The first screen: a thank you, on the site's navy with its watermark. */
const Splash = ({ first, careFor, artSrc, onOpen }: { first: string; careFor: string; artSrc: string; onOpen: () => void }) => (
  <div className="relative flex min-h-dvh flex-col overflow-hidden bg-navy pt-[max(16px,env(safe-area-inset-top))]">
    <Watermark glyph="o" size={620} opacity={0.12} className="-right-[260px] -top-[120px]" />
    <Watermark glyph="o" size={360} opacity={0.08} className="-bottom-[140px] -left-[160px]" />
    <div className="relative mx-auto w-full max-w-3xl px-5 sm:px-8">
      <img src={logoWhite} alt="Medic Connect" className="h-8 w-auto sm:h-9" />
    </div>
    <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 pb-6 pt-10 sm:px-8">
      <span className="inline-flex animate-in fade-in duration-500"><NotchTag tone="white" size="sm">Care offer</NotchTag></span>
      {/* A heading by role, not an h1, so the admin preview's heading styles never recolour it. */}
      <p role="heading" aria-level={1} className="mt-5 animate-in fade-in slide-in-from-bottom-3 text-[36px] font-extrabold leading-[1.04] tracking-[-0.045em] text-white duration-700 sm:text-[52px]">
        Thank you, {first},<br />for choosing Medic Connect
      </p>
      <p className="mt-5 animate-in fade-in text-[18px] font-bold leading-[1.4] text-body-navy delay-200 duration-700 sm:text-[21px]">
        Your care offer for {careFor}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="group mt-9 inline-flex items-center gap-4 self-start animate-in fade-in delay-300 duration-700"
        aria-label="Open your care offer"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-navy shadow-[0_0_0_8px_rgba(255,255,255,0.12)] transition-transform group-hover:translate-x-1 group-active:scale-95">
          <ArrowRight className="h-7 w-7" aria-hidden="true" />
        </span>
        <span className="text-[16px] font-extrabold text-white">Open your offer</span>
      </button>
    </div>
    <img
      src={artSrc}
      alt=""
      aria-hidden="true"
      className="pointer-events-none relative ml-auto mr-4 h-[210px] w-auto object-contain object-bottom sm:mr-[10%] sm:h-[280px]"
    />
  </div>
);

/** Once the offer is open: one slim bar with the logo, the heading, a small picture and the PDF. */
const Cap = ({ title, onPdf, making, artSrc }: { title: string; onPdf?: () => void; making?: boolean; artSrc?: string }) => (
  <header className="relative overflow-hidden bg-navy pt-[env(safe-area-inset-top)]">
    <Watermark glyph="o" size={160} opacity={0.12} className="-right-[50px] -top-[50px]" />
    <div className="relative mx-auto flex h-[60px] max-w-3xl items-center gap-3 px-4 sm:h-[68px] sm:px-8">
      <img src={logoWhite} alt="Medic Connect" className="h-[22px] w-auto shrink-0 sm:h-7" />
      <span aria-hidden="true" className="h-7 w-px shrink-0 bg-white/25" />
      <p role="heading" aria-level={1} className="line-clamp-2 min-w-0 flex-1 text-[14px] font-extrabold leading-[1.2] tracking-[-0.02em] text-white sm:text-[17px]">{title}</p>
      {artSrc && <img src={artSrc} alt="" aria-hidden="true" className="h-[50px] w-auto shrink-0 self-end object-contain object-bottom sm:h-[60px]" />}
      {onPdf && (
        <button type="button" onClick={onPdf} disabled={making} aria-label="Download as PDF" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 border-2 border-outline-navy px-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-white hover:text-navy disabled:opacity-60">
          <Download className="h-4 w-4" aria-hidden="true" /> <span className="hidden min-[420px]:inline">{making ? "…" : "PDF"}</span>
        </button>
      )}
    </div>
  </header>
);

const CareOffer = ({ preview }: { preview?: OfferView } = {}) => {
  const { token = "" } = useParams();
  const [search] = useSearchParams();
  // Back from Paystack: ?paid=1 (or M2 and on) with Paystack's own reference.
  // From an email's Pay button: ?pay=1 (or M2 and on) opens the checkout.
  const [payParam] = useState(() => (preview ? null : search.get("pay")));
  const [paidParam] = useState(() => (preview ? null : search.get("paid")));
  const [returnRef] = useState(() => search.get("reference") ?? search.get("trxref"));
  const [offer, setOffer] = useState<OfferView | null>(preview ?? null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [opened, setOpened] = useState(false);
  const [viewing, setViewing] = useState(0);
  const [option, setOption] = useState<string | null>(null);
  const [plan, setPlan] = useState<PaymentPlan>("monthly");
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [payWay, setPayWay] = useState<"paystack" | "bank">("paystack");
  const [seen, setSeen] = useState<number[]>([0]);
  const [paying, setPaying] = useState(false);
  const [payProblem, setPayProblem] = useState<string | null>(null);
  /** The payment just made, once Paystack has sent the family back. */
  const [returned, setReturned] = useState<{ paid: boolean; month: number | null } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLOListElement>(null);

  const load = useCallback(async () => {
    if (preview) {
      setOption(preview.accepted_option ?? (preview.content.options.length === 1 ? preview.content.options[0].id : null));
      return;
    }
    const returning = !!paidParam;
    const { data, error: e } = await supabase.functions.invoke("care-offer", {
      body: returning
        ? { token, action: "confirm", payment: paidParam, reference: returnRef }
        : { token, action: "load" },
    });
    if (e || !data?.ok) {
      setError(await errorFrom(data, e, "We could not open this offer."));
      return;
    }
    const o = data.offer as OfferView;
    if (returning || payParam) {
      // Straight to the booking, without the welcome screen.
      setOpened(true);
      setStep(STEPS.length - 1);
      setSeen(STEPS.map((_, i) => i));
      if (returning) setReturned({ paid: !!data.paid, month: data.month ?? null });
      window.history.replaceState(null, "", window.location.pathname);
    }
    setOffer(o);
    setOption((current) => current ?? o.accepted_option ?? (o.content.options.length === 1 ? o.content.options[0].id : null));
  }, [token, preview, paidParam, payParam, returnRef]);

  useEffect(() => { void load(); }, [load]);

  // The signed copy of the agreement, made here from the accepted offer and
  // kept by us; it is emailed to the family once their payment is in. Made
  // again on a later visit if it did not get through the first time.
  const keeping = useRef(false);
  const keepSignedCopy = useCallback(async (o: OfferView) => {
    if (preview || keeping.current || o.status !== "accepted" || !o.accepted_signature || o.signed_copy) return;
    keeping.current = true;
    try {
      const pdf = await offerPdfBase64(o);
      const { data } = await supabase.functions.invoke("care-offer", { body: { token, action: "signed_copy", pdf_base64: pdf } });
      if (data?.ok) setOffer((cur) => (cur ? { ...cur, signed_copy: true } : cur));
    } catch {
      // Tried again the next time the page opens.
    } finally {
      keeping.current = false;
    }
  }, [preview, token]);
  useEffect(() => { if (offer) void keepSignedCopy(offer); }, [offer, keepSignedCopy]);

  /** Off to a Paystack checkout made just now; Paystack brings them back here. */
  const startPay = useCallback(async (which: string) => {
    if (preview) {
      setPayProblem("This is a preview. Paying only works from the family's link.");
      return;
    }
    setPaying(true);
    setPayProblem(null);
    const { data, error: e } = await supabase.functions.invoke("care-offer", { body: { token, action: "pay", payment: which } });
    if (data?.ok && data.url) {
      window.location.assign(data.url as string);
      return;
    }
    setPaying(false);
    if (data?.ok && data.paid) {
      void load();
      return;
    }
    setPayProblem(await errorFrom(data, e, "Paystack could not be opened. Please try again, or pay by bank transfer."));
  }, [preview, token, load]);

  // An email's Pay button: once the offer is open, go straight to Paystack.
  const autoPaid = useRef(false);
  useEffect(() => {
    if (!payParam || autoPaid.current || !offer || offer.status !== "accepted") return;
    if (payParam === "1" && offer.first_paid) return;
    autoPaid.current = true;
    void startPay(payParam);
  }, [payParam, offer, startPay]);

  // The accessibility button keeps clear of the Back and Next bar, measured
  // once the bar is on screen (it is not there on the welcome screen).
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
  }, [loaded, opened]);

  // The part showing stays in view in the row of parts.
  useEffect(() => {
    const chip = railRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    const rail = railRef.current;
    // Sideways only, so the page itself stays where it is.
    if (chip && rail) rail.scrollTo({ left: chip.offsetLeft - (rail.clientWidth - chip.clientWidth) / 2, behavior: "smooth" });
  }, [step]);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, n));
    const picked = offer?.accepted_option ?? option;
    if (STEPS[next]?.id === "schedule" && picked && offer) {
      setViewing(Math.max(0, offer.content.options.findIndex((o) => o.id === picked)));
    }
    setStep(next);
    setSeen((s) => (s.includes(next) ? s : [...s, next]));
  };

  // Every new part starts at the top: of the window on the family's page,
  // and of the preview panel when staff look at it from the record.
  const topRef = useRef<HTMLDivElement>(null);
  const toTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    let el = topRef.current?.parentElement ?? null;
    while (el) {
      if (el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) el.scrollTop = 0;
      el = el.parentElement;
    }
  }, []);
  useEffect(() => { toTop(); }, [step, opened, toTop]);

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
      body: { token, action: "accept", option, payment: plan, agree, name, signature },
    });
    setBusy(false);
    if (e || !data?.ok) {
      setProblem(await errorFrom(data, e, "That did not go through. Please try again."));
      return;
    }
    setOffer(data.offer as OfferView);
    toTop();
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
  const firstPaid = !!offer.first_paid;
  const due = chosen ? firstPayment(chosen, c.months, c.upfrontDiscountPercent, acceptedPlan) : 0;
  const ready = !!option && agree && name.trim().includes(" ") && name.trim().length >= 3 && !!signature;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const viewingOption = c.options[Math.min(viewing, c.options.length - 1)];

  // The option the schedule is showing: the one chosen, or the one switched to.
  const scheduleOption = c.options[Math.min(viewing, c.options.length - 1)] ?? null;
  const optionTabs = c.options.length > 1 ? (
    <div role="tablist" aria-label="Options" className="grid grid-cols-2 border-2 border-navy">
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
  ) : null;

  const chooseButton = (id: string) => (
    <button
      type="button"
      onClick={() => { setOption(id); setViewing(Math.max(0, c.options.findIndex((o) => o.id === id))); }}
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
          <h2 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[28px]">Your offer at a glance</h2>
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
    schedule: (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[28px]">Your care schedule</h2>
          <p className="mt-2 text-[15px] leading-[1.55] text-body">
            {c.options.length > 1
              ? option || accepted
                ? "The details of your care. It opens on the option you chose; switch to see the other."
                : "The details of your care for each option. Switch between them, and choose one when you are ready."
              : "The details of your care."}
          </p>
        </div>
        {optionTabs}
        {scheduleOption && !accepted && open && c.options.length > 1 && (
          option === scheduleOption.id
            ? <p className="flex items-center gap-2 text-[15px] font-extrabold text-brand"><Check className="h-5 w-5" aria-hidden="true" /> This is the option you have chosen</p>
            : <div>{chooseButton(scheduleOption.id)}</div>
        )}
        <div>
          <OfferLabel>{offerWords(c).duties}</OfferLabel>
          <div className="mt-3"><OfferIncluded content={c} /></div>
        </div>
        <div>
          <OfferLabel>The details</OfferLabel>
          <div className="mt-3"><OfferSchedule content={c} reference={offer.reference} option={scheduleOption} plan={accepted ? acceptedPlan : null} /></div>
        </div>
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
            Signed by {offer.accepted_name}{offer.accepted_at ? ` on ${formatDate(offer.accepted_at)}` : ""}.
          </p>
        </div>
        {returned && returned.month && returned.month > 1 && (
          <p role="status" className="border-l-4 border-brand bg-tint px-4 py-3 text-[15px] font-bold leading-[1.55] text-navy">
            {returned.paid
              ? `Thank you. Your payment for month ${returned.month} has been received, and we have emailed you a receipt.`
              : `We have not had confirmation of your payment for month ${returned.month} from Paystack yet. If you paid, it can take a few minutes: open this page again shortly.`}
          </p>
        )}
        {firstPaid ? (
          <div className="border-2 border-navy bg-card">
            <div className="flex items-start gap-3 bg-navy px-4 py-4 text-white sm:px-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-white text-navy"><Check className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <p className="text-[18px] font-extrabold leading-tight">Payment received, thank you</p>
                <p className="mt-1 text-[14.5px] leading-[1.5] text-body-navy">Your care is booked. We have emailed you your signed agreement to confirm it.</p>
              </div>
            </div>
            <div className="p-4 sm:p-5"><OfferFeeTable rows={chosenFeeRows(chosen, c.months, c.upfrontDiscountPercent, acceptedPlan)} caption="Your fees" /></div>
          </div>
        ) : (
        <div>
          <OfferLabel>{acceptedPlan === "upfront" ? "Your payment" : "Your first payment"}</OfferLabel>
          {returned && !returned.paid && returned.month === null && (
            <p role="status" className="mt-3 border-l-4 border-brand bg-tint px-4 py-3 text-[14.5px] leading-[1.55] text-ink">
              We have not had confirmation of your payment from Paystack yet. If you paid, it can take a few minutes: open this page again shortly. If you did not finish paying, you can try again below.
            </p>
          )}
          <div className="mt-3"><OfferFeeTable rows={chosenFeeRows(chosen, c.months, c.upfrontDiscountPercent, acceptedPlan)} caption="Your fees" /></div>
          <p className="mt-3 text-[14.5px] text-body">Choose how you would like to pay {naira(due)}.</p>
          <div className="mt-4 flex flex-col gap-2.5">
            <Choice label="Pay online with Paystack" blurb="Card, bank transfer or USSD. Paid instantly and confirmed automatically, then you come straight back here." selected={payWay === "paystack"} onClick={() => setPayWay("paystack")} />
            <Choice label="Pay by bank transfer" blurb="Send it from your bank to ours, using your reference." selected={payWay === "bank"} onClick={() => setPayWay("bank")} />
          </div>
          {payWay === "paystack" && (
            <div className="mt-4">
              <button type="button" disabled={paying} onClick={() => void startPay("1")} className={cn(requestPrimary, "w-full sm:w-auto")}>
                {paying ? "Opening Paystack" : <>Pay {naira(due)} with Paystack <ArrowRight className="h-4 w-4" /></>}
              </button>
              {payProblem && <p className="mt-3 text-[14.5px] font-bold text-destructive" role="alert">{payProblem}</p>}
            </div>
          )}
          {payWay === "bank" && (
            <div className="mt-4"><OfferBankDetails reference={offer.reference} content={c} amount={due} /></div>
          )}
          <a
            href={`${WHATSAPP}?text=${encodeURIComponent(`Hello Medic Connect, I have accepted care offer ${offer.reference} for ${c.careFor}. I would like to pay another way.`)}`}
            target="_blank"
            rel="noreferrer"
            className={cn(requestSecondary, "mt-5 w-full sm:w-auto")}
          >
            <MessageCircle className="h-4 w-4" /> Need another way to pay? Message us
          </a>
        </div>
        )}
        <details className="border-2 border-navy bg-card">
          <summary className="cursor-pointer px-4 py-3 text-[15px] font-extrabold text-navy">Your care schedule</summary>
          <div className="border-t-2 border-navy bg-desk/40 p-4 sm:p-5"><OfferSchedule content={c} reference={offer.reference} option={chosen} plan={acceptedPlan} /></div>
        </details>
        <div>
          <OfferLabel>What happens next</OfferLabel>
          <ol className="mt-3 flex flex-col gap-3">
            {[
              ...(firstPaid
                ? ["We have emailed you your signed agreement, confirming your booking."]
                : ["Once your payment is received, we email you your signed agreement to confirm your booking."]),
              "We get in touch within one working day to plan day 0 with you.",
              `You meet your ${offerWords(c).carer}, and we agree your care plan together before care starts.`,
              ...(acceptedPlan === "monthly" ? [`For each month after, we email you a payment link five days before it is due, with the bank details too.`] : []),
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
          <p className="mt-2 text-[15px] leading-[1.55] text-body">Accepting books your care. Nothing is taken from you here: you pay afterwards, online with Paystack or by bank transfer.</p>
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

        {chosen && (
          <div className="border-l-4 border-brand bg-tint px-4 py-3">
            <p className="text-[15px] font-extrabold text-navy">Your care schedule</p>
            <p className="mt-1 text-[14.5px] leading-[1.55] text-ink">
              {chosen.title}, starting {c.start.charAt(0).toLowerCase() + c.start.slice(1)}, for {c.months} months.
            </p>
            <div className="mt-3"><OfferFeeTable rows={chosenFeeRows(chosen, c.months, c.upfrontDiscountPercent, plan)} caption="Your fees" /></div>
            <button type="button" onClick={() => { setViewing(Math.max(0, c.options.findIndex((o) => o.id === chosen.id))); go(2); }} className="mt-1 text-[14.5px] font-extrabold text-brand underline underline-offset-2">
              Read your full care schedule
            </button>
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 border-2 border-navy bg-tint p-4">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--brand))]" />
          <span className="text-[15px] leading-[1.55] text-ink">
            I accept this offer, its fees and the <button type="button" onClick={() => go(3)} className="font-extrabold text-brand underline underline-offset-2">terms of care</button>. I understand the details of my care plan, such as the daily routine, supplies and emergency plan, will be agreed with me before care starts.
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

        <div>
          <p className="text-[16px] font-extrabold text-navy">Your signature</p>
          <p className="mb-3 mt-1 text-[14.5px] leading-[1.55] text-body">Signing here is the same as signing on paper. Your signed copy is emailed to you once your payment is in.</p>
          <SignaturePad onChange={setSignature} />
        </div>

        {chosen && (
          <p className="text-[14.5px] leading-[1.55] text-body">
            As soon as you accept, you can pay your {plan === "upfront" ? "payment" : "first payment"} of <b className="text-navy">{naira(firstPayment(chosen, c.months, c.upfrontDiscountPercent, plan))}</b> online with Paystack or by bank transfer.
          </p>
        )}
        {problem && <p className="text-[14.5px] font-bold text-destructive" role="alert">{problem}</p>}
      </div>
    ),
  };

  const primary = isLast
    ? (accepted && !firstPaid && payWay === "paystack"
        ? <button type="button" disabled={paying} onClick={() => void startPay("1")} className={cn(requestPrimary, "flex-1 sm:flex-none md:min-h-10 md:px-4 md:text-[14px]")}>{paying ? "Opening Paystack" : <>Pay {naira(due)} with Paystack <ArrowRight className="h-4 w-4" /></>}</button>
        : accepted || !open
        ? <a href={WHATSAPP} className={cn(requestPrimary, "flex-1 sm:flex-none md:min-h-10 md:px-4 md:text-[14px]")}><MessageCircle className="h-4 w-4" /> Questions? WhatsApp us</a>
        : (
          <button type="button" disabled={!ready || busy} onClick={() => void accept()} className={cn(requestPrimary, "flex-1 sm:flex-none md:min-h-10 md:px-4 md:text-[14px]")}>
            {busy ? "Accepting" : !option ? "Choose an option first" : !signature ? "Sign to accept" : `Sign and accept ${chosen?.title.toLowerCase() ?? ""}`}
          </button>
        ))
    : (
      <button type="button" onClick={() => go(step + 1)} className={cn(requestPrimary, "flex-1 sm:flex-none md:min-h-10 md:px-4 md:text-[14px]")}>
        {step === 0 ? "See the options" : `Next: ${STEPS[step + 1].short.toLowerCase()}`} <ArrowRight className="h-4 w-4" />
      </button>
    );

  if (!opened) {
    return (
      <>
        {seo}
        <Splash
          first={first}
          careFor={c.careFor}
          artSrc={c.kind === "eldercare" ? art.charCaregiver : art.postnatalSpecialist}
          onOpen={() => { setOpened(true); if (accepted) setStep(STEPS.length - 1); }}
        />
      </>
    );
  }

  return (
    <div ref={topRef} className="flex min-h-dvh flex-col bg-card">
      {seo}
      <Cap title={`Your care offer for ${c.careFor}`} onPdf={() => void downloadPdf()} making={making} artSrc={stepArt(current, c.kind)} />

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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+112px)] pt-6 sm:px-8 sm:pt-8 md:pb-24">
        {pdfError && <p role="alert" className="mb-4 border-l-4 border-destructive bg-tint px-4 py-3 text-[14.5px] font-bold text-ink">{pdfError}</p>}
        <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand">{current.label}</p>
        <div key={current.id} className="animate-in fade-in slide-in-from-right-4 duration-300">{body[current.id]}</div>
        <p className="mt-10 border-t border-line pt-5 text-[14px] leading-[1.6] text-body">
          Questions? Call or WhatsApp us on <a href={WHATSAPP} className="font-extrabold text-brand">+234 812 698 8237</a>, or email hello@medicconnect.co. We are here every day from 7am to 10pm.
        </p>
      </main>

      {/* Back and Next, always within reach of a thumb. */}
      <div ref={barRef} className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-navy bg-card pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:py-2">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 sm:justify-between sm:px-8">
          {step > 0 ? (
            <button type="button" onClick={() => go(step - 1)} className={cn(requestSecondary, "px-4 md:min-h-10 md:px-3 md:text-[14px]")} aria-label="Back">
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
