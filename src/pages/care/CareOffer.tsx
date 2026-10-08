// The family's care offer: read it, compare the options, read the terms,
// download it, and accept. No account is needed; the link is the key.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, MessageCircle } from "lucide-react";
import {
  FamilyCard, FamilyHeading, FamilyLoading, FamilyNote, FamilyShell, FamilyText,
  familyInput, familyPrimary, familySecondary,
} from "@/components/care/FamilyShell";
import OfferDocument from "@/components/care/OfferDocument";
import { supabase } from "@/integrations/supabase/client";
import { contractToPdfBlob } from "@/lib/contract-pdf";
import { formatDate } from "@/lib/format";
import { firstPayment, naira, offerOpen, optionTotals, type OfferView, type PaymentPlan } from "@/lib/care-offer";
import { cn } from "@/lib/utils";

const WHATSAPP = "https://wa.me/2348126988237";

const choiceCard = (on: boolean) => cn(
  "flex w-full cursor-pointer items-start gap-3 border-2 p-4 text-left transition-colors",
  on ? "border-navy bg-tint shadow-offset-sm" : "border-line bg-card hover:border-navy",
);

const Radio = ({ on }: { on: boolean }) => (
  <span aria-hidden="true" className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-brand" : "border-label")}>
    {on && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
  </span>
);

const CareOffer = () => {
  const { token = "" } = useParams();
  const [offer, setOffer] = useState<OfferView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [option, setOption] = useState<string | null>(null);
  const [plan, setPlan] = useState<PaymentPlan>("monthly");
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.functions.invoke("care-offer", { body: { token, action: "load" } });
    if (e || !data?.ok) {
      const ctx = (e as { context?: Response } | null)?.context;
      const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
      setError(data?.error ?? body?.error ?? "We could not open this offer.");
      return;
    }
    const o = data.offer as OfferView;
    setOffer(o);
    setOption((current) => current ?? o.accepted_option ?? (o.content.options.length === 1 ? o.content.options[0].id : null));
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const downloadPdf = async () => {
    if (!printRef.current || !offer) return;
    setMaking(true);
    try {
      const blob = await contractToPdfBlob(printRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Medic Connect care offer ${offer.reference}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setMaking(false);
    }
  };

  const accept = async () => {
    if (!offer || !option) return;
    setBusy(true);
    setProblem(null);
    const { data, error: e } = await supabase.functions.invoke("care-offer", {
      body: { token, action: "accept", option, payment: plan, agree, name },
    });
    setBusy(false);
    if (e || !data?.ok) {
      const ctx = (e as { context?: Response } | null)?.context;
      const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
      setProblem(data?.error ?? body?.error ?? "That did not go through. Please try again.");
      return;
    }
    setOffer(data.offer as OfferView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (error) {
    return (
      <FamilyShell eyebrow="Care offer" title="Your care offer" path="/care/offer">
        <FamilyCard>
          <FamilyHeading>We could not open this offer</FamilyHeading>
          <FamilyText className="mt-3">{error}</FamilyText>
          <a href={WHATSAPP} className={cn(familySecondary, "mt-5")}><MessageCircle className="h-4 w-4" /> Message us on WhatsApp</a>
        </FamilyCard>
      </FamilyShell>
    );
  }
  if (!offer) {
    return (
      <FamilyShell eyebrow="Care offer" title="Your care offer" path="/care/offer">
        <FamilyLoading label="Opening your offer" />
      </FamilyShell>
    );
  }

  const c = offer.content;
  const accepted = offer.status === "accepted";
  const open = offerOpen(offer);
  const chosen = c.options.find((o) => o.id === (accepted ? offer.accepted_option : option)) ?? null;
  const acceptedPlan = (offer.accepted_payment ?? plan) as PaymentPlan;
  const due = chosen ? firstPayment(chosen, c.months, c.upfrontDiscountPercent, acceptedPlan) : 0;
  const ready = !!option && agree && name.trim().includes(" ") && name.trim().length >= 3;

  const paymentDetails = (
    <dl className="mt-4 grid gap-3 border-2 border-navy bg-card p-5 sm:grid-cols-2">
      <div><dt className="text-[13px] font-bold text-label">Amount</dt><dd className="mt-1 text-[18px] font-extrabold text-navy">{naira(due)}</dd></div>
      <div><dt className="text-[13px] font-bold text-label">Reference</dt><dd className="mt-1 text-[16px] font-extrabold text-navy">{offer.reference}</dd></div>
      <div><dt className="text-[13px] font-bold text-label">Bank</dt><dd className="mt-1 text-[16px] font-extrabold text-navy">{c.payment.bankName}</dd></div>
      <div><dt className="text-[13px] font-bold text-label">Account number</dt><dd className="mt-1 text-[16px] font-extrabold tracking-[0.04em] text-navy">{c.payment.accountNumber}</dd></div>
      <div className="sm:col-span-2"><dt className="text-[13px] font-bold text-label">Account name</dt><dd className="mt-1 text-[16px] font-extrabold text-navy">{c.payment.accountName}</dd></div>
    </dl>
  );

  return (
    <FamilyShell
      eyebrow="Care offer"
      title={`Your care offer for ${c.careFor}`}
      accent={c.careFor.split(" ").map((_, i) => 4 + i)}
      lead={accepted ? "Thank you. Your choice is recorded." : `Prepared for ${c.preparedFor}. Read it through, compare the options and accept at the end.`}
      path="/care/offer"
      action={
        <button type="button" onClick={() => void downloadPdf()} disabled={making} className="inline-flex min-h-11 items-center gap-2 border-2 border-outline-navy px-3 text-[14px] font-extrabold text-white transition-colors hover:bg-white hover:text-navy disabled:opacity-60">
          <Download className="h-4 w-4" aria-hidden="true" /> {making ? "Making PDF" : "PDF"}
        </button>
      }
    >
      {accepted && chosen && (
        <FamilyCard>
          <FamilyHeading>You chose {chosen.title.toLowerCase()}</FamilyHeading>
          <FamilyText className="mt-3">
            Accepted by {offer.accepted_name}{offer.accepted_at ? ` on ${formatDate(offer.accepted_at)}` : ""}, paying {acceptedPlan === "upfront" ? `all ${c.months} months upfront` : "monthly"}. We have emailed you a copy.
          </FamilyText>
          <p className="mt-6 text-[13px] font-extrabold uppercase tracking-[0.12em] text-label">Your first payment</p>
          {paymentDetails}
          {c.payment.payOnlineUrl && (
            <a href={c.payment.payOnlineUrl} className={cn(familyPrimary, "mt-5")}>Pay online</a>
          )}
          <FamilyText className="mt-5">
            Next, we confirm your booking in writing and arrange a meeting and introduction with your nurse before the first shift. Care starts once the first payment is received.
          </FamilyText>
        </FamilyCard>
      )}

      {!accepted && !open && (
        <FamilyNote title="This offer can no longer be accepted">
          {offer.status === "withdrawn" ? "It has been withdrawn." : "It has expired."} Message us and we will send you an up-to-date offer.
        </FamilyNote>
      )}

      <OfferDocument
        reference={offer.reference}
        content={c}
        terms={offer.terms}
        termsVersion={offer.terms_version}
        expiresAt={offer.expires_at}
        chosenOption={accepted ? offer.accepted_option : null}
      />

      {!accepted && open && (
        <FamilyCard>
          <FamilyHeading>Accept your offer</FamilyHeading>
          <FamilyText className="mt-2">Accepting books your care. It does not take any money: you pay by bank transfer once you have accepted.</FamilyText>

          {c.options.length > 1 && (
            <fieldset className="mt-6">
              <legend className="text-[15.5px] font-extrabold text-navy">1. Which option?</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {c.options.map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={option === o.id} onClick={() => setOption(o.id)} className={choiceCard(option === o.id)}>
                    <Radio on={option === o.id} />
                    <span>
                      <span className="block text-[16px] font-extrabold text-navy">{o.title}</span>
                      <span className="mt-1 block text-[14px] text-body">{naira(o.monthly)} a month</span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="mt-6">
            <legend className="text-[15.5px] font-extrabold text-navy">{c.options.length > 1 ? "2. " : "1. "}How would you like to pay?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["monthly", "upfront"] as const).filter((p) => p === "monthly" || c.upfrontDiscountPercent > 0).map((p) => {
                const t = chosen ? optionTotals(chosen, c.months, c.upfrontDiscountPercent) : null;
                return (
                  <button key={p} type="button" role="radio" aria-checked={plan === p} onClick={() => setPlan(p)} className={choiceCard(plan === p)}>
                    <Radio on={plan === p} />
                    <span>
                      <span className="block text-[16px] font-extrabold text-navy">{p === "monthly" ? "Monthly" : `All ${c.months} months upfront`}</span>
                      <span className="mt-1 block text-[14px] text-body">
                        {t
                          ? p === "monthly" ? `${naira(t.monthly)} a month, the first before care starts` : `${naira(t.upfront)} once, saving ${naira(t.saving)}`
                          : p === "monthly" ? "Each month in advance" : `${c.upfrontDiscountPercent}% off the total`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-6 flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[hsl(var(--brand))]" />
            <span className="text-[15px] leading-[1.55] text-ink">I have read the offer and the terms of care ({offer.terms_version}) and I accept them.</span>
          </label>

          <label className="mt-5 block">
            <span className="text-[15px] font-extrabold text-navy">Your full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={cn(familyInput, "mt-2 min-h-12")} placeholder="First and last name" />
          </label>

          {problem && <p className="mt-4 text-[14.5px] font-bold text-destructive" role="alert">{problem}</p>}

          <button type="button" disabled={!ready || busy} onClick={() => void accept()} className={cn(familyPrimary, "mt-6 w-full sm:w-auto")}>
            {busy ? "Accepting" : chosen ? `Accept ${chosen.title.toLowerCase()}` : "Accept"}
          </button>
          {!option && c.options.length > 1 && <p className="mt-3 text-[14px] text-body">Choose an option first.</p>}
        </FamilyCard>
      )}

      <FamilyNote title="Questions?">
        Call or WhatsApp us on +234 812 698 8237, or email hello@medicconnect.co. We are here every day from 7am to 10pm.
        <span className="mt-3 flex flex-wrap gap-2">
          <a href={WHATSAPP} className={familySecondary}><MessageCircle className="h-4 w-4" /> WhatsApp us</a>
          <button type="button" onClick={() => void downloadPdf()} disabled={making} className={familySecondary}>
            <Download className="h-4 w-4" /> {making ? "Making PDF" : "Download PDF"}
          </button>
        </span>
      </FamilyNote>

      {/* The PDF is made from this copy: every clause open, at A4 width. */}
      <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0">
        <div ref={printRef} className="w-[794px] bg-white p-10">
          <OfferPrintHeader reference={offer.reference} />
          <OfferDocument
            reference={offer.reference}
            content={c}
            terms={offer.terms}
            termsVersion={offer.terms_version}
            expiresAt={offer.expires_at}
            print
            chosenOption={accepted ? offer.accepted_option : null}
          />
          {accepted && (
            <div className="mc-accept-inner mt-8 border-2 border-navy p-5">
              <p className="text-[16px] font-extrabold text-navy">Accepted</p>
              <p className="mt-2 text-[14px] text-ink">
                {chosen?.title}, paying {acceptedPlan === "upfront" ? "upfront" : "monthly"}. Accepted online by {offer.accepted_name}{offer.accepted_at ? ` on ${formatDate(offer.accepted_at)}` : ""}, under {offer.terms_version}.
              </p>
            </div>
          )}
        </div>
      </div>
    </FamilyShell>
  );
};

export const OfferPrintHeader = ({ reference }: { reference: string }) => (
  <div className="mb-8 flex items-end justify-between border-b-4 border-navy pb-4">
    <div>
      <p className="text-[24px] font-extrabold tracking-[-0.04em] text-navy">Medic Connect</p>
      <p className="text-[12px] text-body">Medic Connect Limited, RC 8026476, 145 Igbosere Road, Lagos Island, Lagos</p>
    </div>
    <div className="text-right">
      <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand">Care offer</p>
      <p className="text-[14px] font-bold text-navy">{reference}</p>
    </div>
  </div>
);

export default CareOffer;
