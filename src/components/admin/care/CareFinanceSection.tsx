import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Send, Check, ExternalLink, RefreshCw, Ban, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CareField as CareFormRow, CareSheet } from "@/components/admin/care/CareSurface";
import { MuEmpty, MuRow, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { cxInputClass } from "@/components/candidate/primitives";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { careErrorMessage } from "@/lib/care-errors";
import { INVOICE_STATUS_LABELS, naira } from "@/lib/invoice-totals";
import { formatDate } from "@/lib/format";

type Contact = { id: string; full_name: string; email: string | null };
type Quote = { id: string; quote_number: string; status: string; current_version: number; recipient_contact_id: string; created_at: string };
type Version = { id: string; quote_id: string; version: number; total: number; valid_until: string | null };
type Invoice = { id: string; invoice_number: string; status: string; total: number; hosted_link: string | null; quote_version_id: string | null };
type Adjustment = { id: string; invoice_id: string; kind: string; reference: string; amount: number; reason: string; status: string; created_at: string };

const sentenceCase = (value: string) => {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const blankLine = () => ({ description: "", quantity: "1", unit_price: "" });

export default function CareFinanceSection({ clientId, contacts }: { clientId: string; contacts: Contact[] }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([blankLine()]);
  const [busy, setBusy] = useState(false);
  const [adjusting, setAdjusting] = useState<Invoice | null>(null);
  const [adjustmentKind, setAdjustmentKind] = useState("credit_note");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const load = useCallback(async () => {
    const [q, i, a] = await Promise.all([
      adminDb().from("care_quotes").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      adminDb().from("paystack_invoices").select("id,invoice_number,status,total,hosted_link,quote_version_id").eq("client_id", clientId).order("created_at", { ascending: false }),
      adminDb().from("care_finance_adjustments").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    if (q.error || i.error || a.error) throw q.error ?? i.error ?? a.error;
    const quoteRows = (q.data ?? []) as Quote[];
    setQuotes(quoteRows);
    setInvoices((i.data ?? []) as Invoice[]);
    setAdjustments((a.data ?? []) as Adjustment[]);
    if (quoteRows.length) {
      const v = await adminDb().from("care_quote_versions").select("id,quote_id,version,total,valid_until").in("quote_id", quoteRows.map((row) => row.id));
      if (v.error) throw v.error;
      setVersions((v.data ?? []) as Version[]);
    } else setVersions([]);
  }, [clientId]);

  useEffect(() => { void load().catch(() => toast.error("Could not load finance")); }, [load]);
  const versionFor = (quote: Quote) => versions.find((version) => version.quote_id === quote.id && version.version === quote.current_version);

  const save = async () => {
    const prepared = lines.map((line) => ({ description: line.description.trim(), quantity: Number(line.quantity), unit_price: Number(line.unit_price) })).filter((line) => line.description);
    if (!contactId || !prepared.length) return;
    setBusy(true);
    const { error } = await adminDb().rpc("care_quote_save", { _quote_id: null, _client_id: clientId, _recipient_contact_id: contactId, _lines: prepared, _vat_rate: 7.5, _valid_until: validUntil || null, _notes: notes || null });
    setBusy(false);
    if (error) return toast.error(careErrorMessage(error, "Could not save the quote"));
    toast.success("Quote saved"); setOpen(false); setLines([blankLine()]); setNotes(""); setValidUntil(""); await load();
  };

  const act = async (quote: Quote, action: "issue" | "accept") => {
    setBusy(true);
    const { data, error } = await adminDb().rpc(action === "issue" ? "care_quote_issue" : "care_quote_accept", { _quote_id: quote.id });
    setBusy(false);
    if (error) return toast.error(careErrorMessage(error, `Could not ${action} the quote`));
    toast.success(action === "issue" ? "Quote issued" : "Quote accepted and draft invoice created");
    await load();
  };

  const issueInvoice = async (invoice: Invoice) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("paystack-invoice", { body: { action: "issue", id: invoice.id } });
    setBusy(false);
    const message = (data as { error?: string } | null)?.error ?? error?.message;
    if (message) return toast.error(message);
    toast.success("Invoice issued"); await load();
  };

  const invoiceAction = async (invoice: Invoice, action: "verify" | "archive") => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("paystack-invoice", { body: { action, id: invoice.id } });
    setBusy(false);
    const message = (data as { error?: string } | null)?.error ?? error?.message;
    if (message) return toast.error(message);
    toast.success(action === "verify" ? "Payment status updated" : "Invoice cancelled");
    await load();
  };

  const saveAdjustment = async () => {
    if (!adjusting || !Number(adjustmentAmount) || !adjustmentReason.trim()) return;
    setBusy(true);
    const { error } = await adminDb().rpc("care_finance_adjust", { _invoice_id: adjusting.id, _kind: adjustmentKind, _amount: Number(adjustmentAmount), _reason: adjustmentReason.trim() });
    setBusy(false);
    if (error) return toast.error(careErrorMessage(error, "Could not record the adjustment"));
    toast.success(adjustmentKind === "credit_note" ? "Credit note recorded" : adjustmentKind === "refund" ? "Refund request recorded" : "Payment adjustment recorded");
    setAdjusting(null); setAdjustmentAmount(""); setAdjustmentReason(""); await load();
  };

  return <div className="flex flex-col gap-4">
    <MuSection title="Quotes" actions={<Button type="button" variant="outline" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Create quote</Button>} padded={false}>
      {!quotes.length ? <MuEmpty art={art.objSignedContract} title="No quotes yet" description="Create a quote for a recorded contact with an email address." /> : <div className="divide-y divide-line-soft">{quotes.map((quote) => {
        const version = versionFor(quote); const contact = contacts.find((row) => row.id === quote.recipient_contact_id);
        return <MuRow key={quote.id} title={version ? `${quote.quote_number}, ${naira(version.total)}` : quote.quote_number} state={`${contact?.full_name ?? "Contact"}${version?.valid_until ? `, valid until ${formatDate(version.valid_until)}` : ""}`} status={<MuStatus label={sentenceCase(quote.status)} />} action={<div className="flex gap-2">{quote.status === "draft" && <Button size="sm" onClick={() => void act(quote, "issue")} disabled={busy}><Send className="mr-1.5 h-4 w-4" />Issue</Button>}{quote.status === "issued" && <Button size="sm" onClick={() => void act(quote, "accept")} disabled={busy}><Check className="mr-1.5 h-4 w-4" />Record acceptance</Button>}</div>} />;
      })}</div>}
    </MuSection>
    <MuSection title="Invoices" padded={false}>
      {!invoices.length ? <MuEmpty art={art.objPriceTagNaira} title="No invoices yet" description="Invoices raised for this client appear here." /> : <div className="divide-y divide-line-soft">{invoices.map((invoice) => <MuRow key={invoice.id} title={`${invoice.invoice_number}, ${naira(invoice.total)}`} status={<MuStatus label={INVOICE_STATUS_LABELS[invoice.status] ?? sentenceCase(invoice.status)} />} action={<div className="flex flex-wrap gap-2">{invoice.status === "draft" && <Button size="sm" onClick={() => void issueInvoice(invoice)} disabled={busy}>Issue invoice</Button>}{invoice.status !== "draft" && invoice.status !== "paid" && invoice.status !== "cancelled" && <Button size="sm" variant="outline" onClick={() => void invoiceAction(invoice, "verify")} disabled={busy}><RefreshCw className="mr-1.5 h-4 w-4" />Verify</Button>}{invoice.status !== "draft" && invoice.status !== "paid" && invoice.status !== "cancelled" && <Button size="sm" variant="outline" onClick={() => void invoiceAction(invoice, "archive")} disabled={busy}><Ban className="mr-1.5 h-4 w-4" />Cancel</Button>}{invoice.hosted_link && <Button size="sm" variant="outline" asChild><a href={invoice.hosted_link} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Payment page</a></Button>}<Button size="sm" variant="outline" onClick={() => setAdjusting(invoice)}><ReceiptText className="mr-1.5 h-4 w-4" />Adjustment</Button></div>} />)}</div>}
    </MuSection>
    <MuSection title="Adjustments" padded={false}>
      {!adjustments.length ? <MuEmpty title="No adjustments" description="Credit notes, refunds and payment adjustments appear here." /> : <div className="divide-y divide-line-soft">{adjustments.map((adjustment) => <MuRow key={adjustment.id} title={`${adjustment.reference}, ${naira(adjustment.amount)}`} state={`${sentenceCase(adjustment.kind)}: ${adjustment.reason}`} status={<MuStatus label={sentenceCase(adjustment.status)} />} />)}</div>}
    </MuSection>
    <CareSheet open={open} onOpenChange={setOpen} title="Create quote" onSave={save} saving={busy} saveDisabled={!contactId || !lines.some((line) => line.description.trim())}>
      <CareFormRow label="Billing contact"><select className={cxInputClass()} value={contactId} onChange={(event) => setContactId(event.target.value)}><option value="">Select contact</option>{contacts.filter((contact) => contact.email).map((contact) => <option key={contact.id} value={contact.id}>{`${contact.full_name}, ${contact.email}`}</option>)}</select></CareFormRow>
      {lines.map((line, index) => <div key={index} className="grid gap-3 border-b border-line-soft pb-4 sm:grid-cols-[1fr_6rem_9rem]"><CareFormRow label="Description"><input className={cxInputClass()} value={line.description} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} /></CareFormRow><CareFormRow label="Quantity"><input type="number" min="0.01" step="0.01" className={cxInputClass()} value={line.quantity} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row))} /></CareFormRow><CareFormRow label="Unit price"><input type="number" min="0" step="0.01" className={cxInputClass()} value={line.unit_price} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, unit_price: event.target.value } : row))} /></CareFormRow></div>)}
      <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, blankLine()])}>Add line</Button>
      <CareFormRow label="Valid until"><input type="date" className={cxInputClass()} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></CareFormRow>
      <CareFormRow label="Notes"><textarea className={`${cxInputClass()} min-h-24`} value={notes} onChange={(event) => setNotes(event.target.value)} /></CareFormRow>
    </CareSheet>
    <CareSheet open={!!adjusting} onOpenChange={(next) => !next && setAdjusting(null)} title="Record financial adjustment" description={adjusting ? `For ${adjusting.invoice_number}` : undefined} onSave={saveAdjustment} saving={busy} saveLabel="Record adjustment" saveDisabled={!Number(adjustmentAmount) || !adjustmentReason.trim()}>
      <CareFormRow label="Adjustment"><select className={cxInputClass()} value={adjustmentKind} onChange={(event) => setAdjustmentKind(event.target.value)}><option value="credit_note">Credit note</option><option value="refund">Refund</option><option value="payment_adjustment">Payment adjustment</option></select></CareFormRow>
      <CareFormRow label="Amount"><input type="number" min="0.01" step="0.01" className={cxInputClass()} value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} /></CareFormRow>
      <CareFormRow label="Reason"><textarea className={`${cxInputClass()} min-h-24`} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} /></CareFormRow>
    </CareSheet>
  </div>;
}