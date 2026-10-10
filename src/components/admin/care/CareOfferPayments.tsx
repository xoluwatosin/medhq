// Payments for an accepted care offer: the day care starts, and each month's
// payment with its Paystack link and whether it has been paid. The daily job
// sends each month's link five days before it is due; staff can send one now.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MuStatus } from "@/components/admin/mu/MuShell";
import { cxInputClass } from "@/components/candidate/primitives";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { careErrorMessage } from "@/lib/care-errors";
import { formatDate } from "@/lib/format";
import { naira } from "@/lib/care-offer";

interface Instalment {
  id: string;
  number: number;
  due_on: string;
  amount: number;
  invoice_id: string | null;
  pay_url: string | null;
  issued_at: string | null;
  emailed_at: string | null;
}

const paidLike = (status: string | undefined) => status === "paid" || status === "success";

export default function CareOfferPayments({
  offerId, payment, months, startsOn, firstPayUrl, firstInvoiceId, onChanged,
}: {
  offerId: string;
  payment: "monthly" | "upfront";
  months: number;
  startsOn: string | null;
  firstPayUrl: string | null;
  firstInvoiceId: string | null;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Instalment[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<Record<string, string>>({});
  const [date, setDate] = useState(startsOn ?? "");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await adminDb().from("care_offer_instalments").select("*").eq("offer_id", offerId).order("number");
    const list = (data ?? []) as unknown as Instalment[];
    setRows(list);
    const ids = [...new Set([...list.map((r) => r.invoice_id), firstInvoiceId].filter((v): v is string => !!v))];
    if (ids.length) {
      const { data: inv } = await adminDb().from("paystack_invoices").select("id, status").in("id", ids);
      setInvoiceStatus(Object.fromEntries(((inv ?? []) as { id: string; status: string }[]).map((i) => [i.id, i.status])));
    }
  }, [offerId, firstInvoiceId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setDate(startsOn ?? ""); }, [startsOn]);

  const saveStart = async () => {
    if (!date) return;
    setBusy(true);
    const { error } = await adminDb().rpc("care_offer_set_start", { _offer_id: offerId, _starts_on: date });
    setBusy(false);
    if (error) return toast.error(careErrorMessage(error, "Could not set the start date"));
    toast.success(payment === "monthly" ? `Start date saved. ${months} monthly payments are scheduled.` : "Start date saved");
    onChanged();
    void load();
  };

  const sendNow = async (row: Instalment) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("care-offer-billing", { body: { instalment_id: row.id } });
    setBusy(false);
    if (error || !data?.ok || (data.billed ?? []).length === 0) {
      return toast.error(data?.error ?? "The payment link could not be made. Try again shortly.");
    }
    toast.success(`Month ${row.number} sent to the family`);
    void load();
  };

  const copy = async (link: string) => {
    await navigator.clipboard.writeText(link).catch(() => undefined);
    toast.success("Payment link copied");
  };

  const statusOf = (invoiceId: string | null, issued: string | null) => {
    if (invoiceId && paidLike(invoiceStatus[invoiceId])) return <MuStatus label="Paid" tone="good" />;
    if (invoiceId) return <MuStatus label="Waiting for payment" tone="warning" />;
    if (issued) return <MuStatus label="Being made" tone="info" />;
    return <MuStatus label="Scheduled" tone="neutral" />;
  };

  return (
    <div className="mx-5 mb-4 flex flex-col gap-4 border border-line bg-desk/40 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-ink2">Care starts on</span>
          <input type="date" className={cxInputClass()} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <Button type="button" className="h-10" disabled={busy || !date || date === startsOn} onClick={() => void saveStart()}>
          {startsOn ? "Change start date" : "Set start date"}
        </Button>
        <p className="min-w-[200px] flex-1 text-[13px] text-body">
          {payment === "monthly"
            ? startsOn
              ? "Each month's payment link is emailed to the family five days before it is due."
              : "Set the day care starts. The monthly payments are scheduled from it."
            : "Paid upfront for every month."}
        </p>
      </div>

      {payment === "upfront" && firstPayUrl && (
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <span className="font-bold text-ink">Upfront payment</span>
          {statusOf(firstInvoiceId, null)}
          <Button type="button" variant="outline" className="h-8" onClick={() => void copy(firstPayUrl)}><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link</Button>
        </div>
      )}

      {payment === "monthly" && rows.length > 0 && (
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="text-[12px] text-label">
              <th className="py-1.5 pr-3 font-bold">Month</th>
              <th className="py-1.5 pr-3 font-bold">Due</th>
              <th className="py-1.5 pr-3 font-bold">Amount</th>
              <th className="py-1.5 pr-3 font-bold">Status</th>
              <th className="py-1.5 font-bold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line-soft align-middle">
                <td className="py-2 pr-3 font-bold text-ink">{r.number} of {months}</td>
                <td className="py-2 pr-3">{formatDate(r.due_on)}</td>
                <td className="py-2 pr-3 tabular-nums">{naira(Number(r.amount))}</td>
                <td className="py-2 pr-3">
                  {statusOf(r.invoice_id, r.issued_at)}
                  {r.emailed_at && <span className="ml-2 text-[12px] text-label">Emailed {formatDate(r.emailed_at)}</span>}
                </td>
                <td className="py-2 text-right">
                  {r.pay_url ? (
                    <span className="inline-flex gap-1.5">
                      <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => void copy(r.pay_url!)} aria-label="Copy payment link"><Copy className="h-3.5 w-3.5" /></Button>
                      <a href={r.pay_url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center px-2 text-navy" aria-label="Open payment link"><ExternalLink className="h-3.5 w-3.5" /></a>
                    </span>
                  ) : (
                    <Button type="button" variant="outline" className="h-8" disabled={busy} onClick={() => void sendNow(r)}><Send className="mr-1.5 h-3.5 w-3.5" /> Send now</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
