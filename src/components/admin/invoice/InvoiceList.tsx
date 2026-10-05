import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { INVOICE_STATUS_LABELS, naira } from "@/lib/invoice-totals";
import { Button } from "@/components/ui/button";
import { MuEmpty, MuStatus, type MuTone } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { Copy, Loader2, Mail, MessageCircle, RefreshCw, XCircle } from "lucide-react";
import { selectAll } from "@/lib/select-all";

const STATUS_TONE: Record<string, MuTone> = {
  draft: "neutral",
  sent: "info",
  paid: "good",
  part_paid: "warning",
  expired: "warning",
  cancelled: "neutral",
};

export function InvoiceList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: invoices = [], isLoading, isError } = useQuery({
    queryKey: ["paystack-invoices"],
    queryFn: async () => {
      // Every invoice, not only the latest 200.
      return selectAll<any>((a, z) =>
        adminDb().from("paystack_invoices").select("*").order("created_at", { ascending: false }).order("id").range(a, z));
    },
  });

  const run = async (id: string, fn: () => Promise<{ error?: string } | void>, success: string) => {
    setBusy(id);
    try {
      const result = await fn();
      if (result && "error" in result && result.error) {
        toast({ title: "That did not work", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: success });
      queryClient.invalidateQueries({ queryKey: ["paystack-invoices"] });
    } finally {
      setBusy(null);
    }
  };

  const sendEmail = (invoice: any) =>
    run(invoice.id, async () => {
      const { data, error } = await supabase.functions.invoke("send-invoice-email", {
        body: { invoiceId: invoice.id },
      });
      return { error: (data as any)?.error || (error as any)?.message };
    }, "Invoice emailed");

  const verify = (invoice: any) =>
    run(invoice.id, async () => {
      const { data, error } = await supabase.functions.invoke("paystack-invoice", {
        body: { action: "verify", id: invoice.id },
      });
      return { error: (data as any)?.error || (error as any)?.message };
    }, "Payment status updated");

  const cancel = (invoice: any) =>
    run(invoice.id, async () => {
      const { data, error } = await supabase.functions.invoke("paystack-invoice", {
        body: { action: "archive", id: invoice.id },
      });
      return { error: (data as any)?.error || (error as any)?.message };
    }, "Invoice cancelled");

  const whatsappHref = (invoice: any) => {
    const phone = String(invoice.client_phone || "").replace(/\D/g, "");
    const message = [
      `Hello ${invoice.client_first_name || invoice.client_name},`,
      "",
      `Your invoice ${invoice.invoice_number} from Medic Connect is ready.`,
      `Amount due: ${naira(invoice.total)}`,
      invoice.hosted_link ? `Pay online: ${invoice.hosted_link}` : "",
      invoice.offline_reference ? `Transfer reference: ${invoice.offline_reference}` : "",
      "",
      "Thank you for choosing Medic Connect Healthcare.",
    ].filter(Boolean).join("\n");
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading invoices.</p>;
  if (isError) return <p className="text-sm text-muted-foreground">Invoices could not be loaded. Refresh to try again.</p>;
  if (invoices.length === 0) {
    return (
      <div className="border border-line bg-card">
        <MuEmpty art={art.objPriceTagNaira} title="No invoices yet" description="Invoices you create appear here with their payment status." />
      </div>
    );
  }

  return (
    <div className="divide-y divide-line-soft border border-line bg-card">
      {invoices.map((invoice) => (
        <div key={invoice.id}>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-navy">{invoice.invoice_number}</span>
                <MuStatus label={INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status} tone={STATUS_TONE[invoice.status] ?? "neutral"} />
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {[invoice.client_name, invoice.client_email].filter(Boolean).join(", ")}
              </p>
              <p className="text-sm font-medium tabular-nums">{naira(invoice.total)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {busy === invoice.id && <Loader2 className="h-4 w-4 animate-spin self-center" />}
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => sendEmail(invoice)} disabled={busy === invoice.id}>
                <Mail className="h-4 w-4" /> Email
              </Button>
              {invoice.client_phone && (
                <Button size="sm" variant="outline" className="gap-1.5" asChild>
                  <a href={whatsappHref(invoice)} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              )}
              {invoice.hosted_link && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    navigator.clipboard.writeText(invoice.hosted_link);
                    toast({ title: "Payment link copied" });
                  }}
                >
                  <Copy className="h-4 w-4" /> Link
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => verify(invoice)} disabled={busy === invoice.id}>
                <RefreshCw className="h-4 w-4" /> Check payment
              </Button>
              {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                <ConfirmAction
                  title="Cancel this invoice?"
                  description={<p>The payment link stops working and the invoice is marked cancelled. This cannot be undone.</p>}
                  confirmLabel="Cancel invoice"
                  destructive
                  onConfirm={() => cancel(invoice)}
                  trigger={
                <Button size="sm" variant="ghost" className="gap-1.5" disabled={busy === invoice.id}>
                  <XCircle className="h-4 w-4" /> Cancel
                </Button>
                  }
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
