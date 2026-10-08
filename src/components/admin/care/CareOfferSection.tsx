// Care offers on the client record: build one, preview it as the family will
// see it, send it by email (with the PDF), WhatsApp or a copied link, and see
// when it was opened and what was accepted. A sent offer is fixed; to change
// it, withdraw it and make a new one.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, FileDown, Mail, MessageCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CareField, CareSheet } from "@/components/admin/care/CareSurface";
import { MuEmpty, MuRow, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { cxInputClass } from "@/components/candidate/primitives";
import CareOffer from "@/pages/care/CareOffer";
import CareOfferPayments from "@/components/admin/care/CareOfferPayments";
import { NEWBORN_TERMS, NEWBORN_TERMS_VERSION, type TermsClause } from "@/content/care/newborn-terms";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { careErrorMessage } from "@/lib/care-errors";
import { buildOfferPdf, downloadOfferPdf } from "@/lib/offer-pdf";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  naira, newbornLiveInTemplate, offerGaps, optionTotals,
  type OfferContent, type OfferOption,
} from "@/lib/care-offer";

interface OfferRow {
  id: string;
  reference: string;
  status: "draft" | "sent" | "accepted" | "withdrawn";
  content: OfferContent;
  terms_version: string;
  terms: TermsClause[];
  expires_at: string | null;
  sent_at: string | null;
  first_opened_at: string | null;
  accepted_option: string | null;
  accepted_payment: string | null;
  accepted_name: string | null;
  accepted_at: string | null;
  withdrawn_reason: string | null;
  created_at: string;
  invoice_id: string | null;
  pay_url: string | null;
  care_starts_on: string | null;
}

const STATUS: Record<OfferRow["status"], { label: string; tone: "neutral" | "good" | "warning" | "bad" | "info" }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  accepted: { label: "Accepted", tone: "good" },
  withdrawn: { label: "Withdrawn", tone: "bad" },
};

const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

const whatsappHref = (number: string, text: string) =>
  `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

const Area = ({ value, onChange, rows = 4 }: { value: string; onChange: (v: string) => void; rows?: number }) => (
  <textarea rows={rows} className={`${cxInputClass()} min-h-0 py-2 text-[14px]`} value={value} onChange={(e) => onChange(e.target.value)} />
);

export default function CareOfferSection({
  clientId, careFor, preparedFor, location, start,
}: {
  clientId: string;
  careFor: string;
  preparedFor: string;
  location: string;
  start: string;
}) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; content: OfferContent; validUntil: string } | null>(null);
  const [previewing, setPreviewing] = useState<OfferRow | null>(null);
  const [withdrawing, setWithdrawing] = useState<OfferRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await adminDb().from("care_offers").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    setOffers((data ?? []) as unknown as OfferRow[]);
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const startNew = () => setEditing({
    id: null,
    content: newbornLiveInTemplate({ preparedFor, careFor, location, start, months: 4 }),
    validUntil: inDays(14),
  });

  const set = (patch: Partial<OfferContent>) => setEditing((e) => (e ? { ...e, content: { ...e.content, ...patch } } : e));
  const setOption = (index: number, patch: Partial<OfferOption>) => setEditing((e) => {
    if (!e) return e;
    const options = e.content.options.map((o, i) => (i === index ? { ...o, ...patch } : o));
    return { ...e, content: { ...e.content, options } };
  });

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    const expires = editing.validUntil ? new Date(`${editing.validUntil}T23:59:00`).toISOString() : null;
    const { error } = editing.id
      ? await adminDb().from("care_offers").update({ content: editing.content, expires_at: expires }).eq("id", editing.id)
      : await adminDb().rpc("care_offer_create", {
          _client_id: clientId, _content: editing.content, _terms_version: NEWBORN_TERMS_VERSION,
          _terms: NEWBORN_TERMS, _expires_at: expires,
        });
    setBusy(false);
    if (error) return toast.error(careErrorMessage(error, "Could not save the offer"));
    toast.success("Offer saved");
    setEditing(null);
    void load();
  };

  // The same PDF the family downloads from their page.
  const asView = (o: OfferRow) => ({
    reference: o.reference,
    status: o.status,
    content: o.content,
    terms_version: o.terms_version,
    terms: o.terms,
    expires_at: o.expires_at,
    accepted_option: o.accepted_option,
    accepted_payment: o.accepted_payment as "monthly" | "upfront" | null,
    accepted_name: o.accepted_name,
    accepted_at: o.accepted_at,
    pay_url: o.pay_url,
  });
  const makePdf = async (offer: OfferRow): Promise<string | null> => {
    try {
      return await blobToBase64(await buildOfferPdf(asView(offer)));
    } catch {
      return null;
    }
  };

  const send = async (offer: OfferRow, channel: "email" | "whatsapp" | "copied") => {
    const gaps = offerGaps(offer.content);
    if (gaps.length) return toast.error(`Still to fill in: ${gaps.join(", ")}`);
    const tab = channel === "whatsapp" ? window.open("about:blank", "_blank") : null;
    setBusy(true);
    const pdf = channel === "email" ? await makePdf(offer) : null;
    if (channel === "email" && !pdf) toast.message("The PDF could not be made, so the email goes without it");
    const { data, error } = await supabase.functions.invoke("care-offer-send", {
      body: { offer_id: offer.id, channel, pdf_base64: pdf },
    });
    setBusy(false);
    if (error || !data?.ok) {
      tab?.close();
      const ctx = (error as { context?: Response } | null)?.context;
      const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
      return toast.error(data?.error ?? body?.error ?? "Could not send the offer");
    }
    if (channel === "email") toast.success(`Emailed to ${data.to}`);
    if (channel === "copied") {
      await navigator.clipboard.writeText(data.link).catch(() => undefined);
      toast.success("Link copied");
    }
    if (channel === "whatsapp") {
      const url = data.whatsapp_number
        ? whatsappHref(data.whatsapp_number, data.whatsapp_text)
        : `https://wa.me/?text=${encodeURIComponent(data.whatsapp_text)}`;
      if (tab) tab.location.href = url; else window.open(url, "_blank");
    }
    void load();
  };

  const withdraw = async () => {
    if (!withdrawing || !reason.trim()) return;
    setBusy(true);
    const { error } = await adminDb().from("care_offers")
      .update({ status: "withdrawn", withdrawn_at: new Date().toISOString(), withdrawn_reason: reason.trim() })
      .eq("id", withdrawing.id);
    setBusy(false);
    if (error) return toast.error(careErrorMessage(error, "Could not withdraw the offer"));
    toast.success("Offer withdrawn. Its links no longer work.");
    setWithdrawing(null);
    setReason("");
    void load();
  };

  const e = editing?.content;

  return (
    <MuSection
      title="Care offers"
      description="The offer the family reads, compares and accepts online. Sent offers cannot be changed."
      padded={false}
      actions={<Button type="button" className="h-10" onClick={startNew}><Plus className="mr-1.5 h-4 w-4" /> New offer</Button>}
    >
      {offers.length === 0 ? (
        <MuEmpty art={art.objClipboard} title="No offers yet" description="Make one from the newborn template, check every line, then preview and send." />
      ) : (
        <div className="divide-y divide-line-soft">
          {offers.map((o) => {
            const chosen = o.content.options.find((x) => x.id === o.accepted_option);
            const state = o.status === "accepted"
              ? `${chosen?.title ?? "Option"}, paying ${o.accepted_payment}. Accepted by ${o.accepted_name} on ${formatDateTime(o.accepted_at ?? "")}.`
              : o.status === "withdrawn"
                ? `Withdrawn. ${o.withdrawn_reason ?? ""}`
                : [
                    o.content.options.map((x) => `${x.title} ${naira(x.monthly)}`).join(", "),
                    o.sent_at ? `Sent ${formatDate(o.sent_at)}` : null,
                    o.sent_at ? (o.first_opened_at ? `opened ${formatDateTime(o.first_opened_at)}` : "not opened yet") : null,
                    o.expires_at ? `valid until ${formatDate(o.expires_at)}` : null,
                  ].filter(Boolean).join(". ");
            return (
              <div key={o.id}>
              <MuRow
                title={o.reference}
                state={state}
                status={<MuStatus label={STATUS[o.status].label} tone={STATUS[o.status].tone} />}
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="h-9" onClick={() => setPreviewing(o)}><Eye className="mr-1.5 h-4 w-4" /> Preview</Button>
                    <Button type="button" variant="outline" className="h-9" onClick={() => void downloadOfferPdf(asView(o)).catch(() => toast.error("The PDF could not be made"))}><FileDown className="mr-1.5 h-4 w-4" /> PDF</Button>
                    {o.status === "draft" && (
                      <Button type="button" variant="outline" className="h-9" onClick={() => setEditing({ id: o.id, content: o.content, validUntil: o.expires_at?.slice(0, 10) ?? inDays(14) })}>Edit</Button>
                    )}
                    {(o.status === "draft" || o.status === "sent") && (
                      <>
                        <Button type="button" className="h-9" disabled={busy} onClick={() => void send(o, "email")}><Mail className="mr-1.5 h-4 w-4" /> {o.status === "sent" ? "Email again" : "Email"}</Button>
                        <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => void send(o, "whatsapp")}><MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp</Button>
                        <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => void send(o, "copied")}><Copy className="mr-1.5 h-4 w-4" /> Copy link</Button>
                      </>
                    )}
                    {o.status === "sent" && (
                      <Button type="button" variant="ghost" className="h-9" onClick={() => setWithdrawing(o)}>Withdraw</Button>
                    )}
                  </div>
                }
              />
              {o.status === "accepted" && (o.accepted_payment === "monthly" || o.accepted_payment === "upfront") && (
                <CareOfferPayments
                  offerId={o.id}
                  payment={o.accepted_payment}
                  months={o.content.months}
                  startsOn={o.care_starts_on}
                  firstPayUrl={o.pay_url}
                  firstInvoiceId={o.invoice_id}
                  onChanged={() => void load()}
                />
              )}
              </div>
            );
          })}
        </div>
      )}

      <CareSheet
        open={!!editing}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
        title={editing?.id ? "Edit offer" : "New care offer"}
        description="Live-in newborn care, one nurse or two. Check every line: this is exactly what the family will read."
        onSave={() => void save()}
        saveLabel="Save draft"
        saving={busy}
      >
        {e && editing && (
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <CareField label="Prepared for"><input className={cxInputClass()} value={e.preparedFor} onChange={(v) => set({ preparedFor: v.target.value })} /></CareField>
              <CareField label="Care for"><input className={cxInputClass()} value={e.careFor} onChange={(v) => set({ careFor: v.target.value })} /></CareField>
              <CareField label="Where"><input className={cxInputClass()} value={e.location} onChange={(v) => set({ location: v.target.value })} /></CareField>
              <CareField label="Valid until"><input type="date" className={cxInputClass()} value={editing.validUntil} onChange={(v) => setEditing({ ...editing, validUntil: v.target.value })} /></CareField>
              <CareField label="Months"><input type="number" min={1} className={cxInputClass()} value={e.months} onChange={(v) => set({ months: Number(v.target.value) })} /></CareField>
              <CareField label="Upfront discount (%)"><input type="number" min={0} max={20} className={cxInputClass()} value={e.upfrontDiscountPercent} onChange={(v) => set({ upfrontDiscountPercent: Number(v.target.value) })} /></CareField>
            </div>
            <CareField label="Starts"><Area rows={2} value={e.start} onChange={(v) => set({ start: v })} /></CareField>
            <CareField label="Opening words"><Area rows={4} value={e.intro} onChange={(v) => set({ intro: v })} /></CareField>

            {e.options.map((o, i) => {
              const t = optionTotals(o, e.months, e.upfrontDiscountPercent);
              return (
                <div key={o.id} className="flex flex-col gap-3 border border-line p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CareField label={`Option ${i + 1}`}><input className={cxInputClass()} value={o.title} onChange={(v) => setOption(i, { title: v.target.value })} /></CareField>
                    <CareField label="A month (₦)" help={`${naira(t.total)} in total, ${naira(t.upfront)} upfront`}>
                      <input type="number" min={0} step={5000} className={cxInputClass()} value={o.monthly} onChange={(v) => setOption(i, { monthly: Number(v.target.value) })} />
                    </CareField>
                  </div>
                  <CareField label="Who is in the home"><Area rows={2} value={o.staffing} onChange={(v) => setOption(i, { staffing: v })} /></CareField>
                  <CareField label="In a sentence"><Area rows={2} value={o.summary} onChange={(v) => setOption(i, { summary: v })} /></CareField>
                  <CareField label="Good for" help="One per line"><Area value={o.goodFor.join("\n")} onChange={(v) => setOption(i, { goodFor: lines(v) })} /></CareField>
                  <CareField label="Worth knowing" help="One per line"><Area value={o.consider.join("\n")} onChange={(v) => setOption(i, { consider: lines(v) })} /></CareField>
                  <CareField label="Rota and rest" help="One per line, for the care schedule"><Area value={(o.rota ?? []).join("\n")} onChange={(v) => setOption(i, { rota: lines(v) })} /></CareField>
                  {e.options.length > 1 && (
                    <Button type="button" variant="ghost" className="h-9 self-start" onClick={() => set({ options: e.options.filter((_, j) => j !== i) })}>Remove this option</Button>
                  )}
                </div>
              );
            })}

            <CareField label="Included" help="One per line"><Area rows={6} value={e.included.join("\n")} onChange={(v) => set({ included: lines(v) })} /></CareField>
            <CareField label="Not included" help="One per line"><Area value={e.notIncluded.join("\n")} onChange={(v) => set({ notIncluded: lines(v) })} /></CareField>
            <CareField label="Your home provides" help="One per line"><Area value={e.familyProvides.join("\n")} onChange={(v) => set({ familyProvides: lines(v) })} /></CareField>
            <CareField label="Supplies" help="Who supplies what, one per line, for the care schedule"><Area value={(e.supplies ?? []).join("\n")} onChange={(v) => set({ supplies: lines(v) })} /></CareField>
            <CareField label="Assessment"><Area rows={3} value={e.assessment} onChange={(v) => set({ assessment: v })} /></CareField>

            <div className="grid gap-4 sm:grid-cols-2">
              <CareField label="Bank"><input className={cxInputClass()} value={e.payment.bankName} onChange={(v) => set({ payment: { ...e.payment, bankName: v.target.value } })} /></CareField>
              <CareField label="Account number"><input inputMode="numeric" className={cxInputClass()} value={e.payment.accountNumber} onChange={(v) => set({ payment: { ...e.payment, accountNumber: v.target.value.replace(/\D/g, "").slice(0, 10) } })} /></CareField>
              <CareField label="Account name"><input className={cxInputClass()} value={e.payment.accountName} onChange={(v) => set({ payment: { ...e.payment, accountName: v.target.value } })} /></CareField>
              <CareField label="Pay online link (optional)" help="A Paystack invoice link, once issued"><input className={cxInputClass()} value={e.payment.payOnlineUrl ?? ""} onChange={(v) => set({ payment: { ...e.payment, payOnlineUrl: v.target.value.trim() || undefined } })} /></CareField>
            </div>
            <p className="text-[13px] text-body">Terms attached: {NEWBORN_TERMS_VERSION}. No VAT is charged.</p>
            {offerGaps(e).length > 0 && <p className="text-[13px] font-bold text-destructive">Before sending: {offerGaps(e).join(", ")}</p>}
          </div>
        )}
      </CareSheet>

      <CareSheet
        open={!!withdrawing}
        onOpenChange={(v) => { if (!v) setWithdrawing(null); }}
        title="Withdraw this offer"
        description="Every link to it stops working. The family sees that it was withdrawn."
        onSave={() => void withdraw()}
        saveLabel="Withdraw offer"
        saving={busy}
        saveDisabled={!reason.trim()}
      >
        <CareField label="Reason"><Area rows={3} value={reason} onChange={setReason} /></CareField>
      </CareSheet>

      {previewing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-ink px-4 py-2 text-white">
            <p className="text-[13px] font-bold">Preview of {previewing.reference}: what the family sees</p>
            <button type="button" onClick={() => setPreviewing(null)} className="inline-flex min-h-9 items-center gap-1.5 border border-white/40 px-3 text-[13px] font-bold"><X className="h-4 w-4" /> Close</button>
          </div>
          <CareOffer
            preview={{
              reference: previewing.reference,
              status: previewing.status === "draft" ? "sent" : previewing.status,
              content: previewing.content,
              terms_version: previewing.terms_version,
              terms: previewing.terms,
              expires_at: previewing.expires_at,
              accepted_option: previewing.accepted_option,
              accepted_payment: previewing.accepted_payment as "monthly" | "upfront" | null,
              accepted_name: previewing.accepted_name,
              accepted_at: previewing.accepted_at,
            }}
          />
        </div>
      )}

    </MuSection>
  );
}
