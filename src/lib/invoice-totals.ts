// Invoice arithmetic used by the builder. The same rules run server side in
// supabase/functions/_shared/paystack-invoice.ts, so what is shown on screen is
// what Paystack is asked to charge.

export interface InvoiceLine {
  id: string;
  description: string;
  /** Kept as typed text so the field can be cleared; coerced with Number() for arithmetic. */
  quantity: string | number;
  unitPrice: string | number;
}

export type InvoiceType = "assessment" | "standard" | "care_package";

export const PAYMENT_TERMS: Record<InvoiceType, number> = {
  assessment: 0,
  standard: 14,
  care_package: 7,
};

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

type Amounts = { quantity: string | number; unitPrice: string | number };

export const lineTotal = (line: Amounts) =>
  round2((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));

export function invoiceTotals(lines: Amounts[], vatRate: number) {
  const subtotal = round2(lines.reduce((sum, l) => sum + lineTotal(l), 0));
  const vatAmount = round2((subtotal * (Number(vatRate) || 0)) / 100);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

export const kobo = (amount: number) => Math.round(round2(amount) * 100);

/** Paystack rejects negative amounts, so a discount collapses the lines into one net line. */
export function paystackLineItems(lines: InvoiceLine[]) {
  const hasNegative = lines.some((l) => lineTotal(l) < 0);
  if (hasNegative) {
    const net = lines.reduce((sum, l) => sum + lineTotal(l), 0);
    return [{ name: "Agreed fee after discount", amount: kobo(net), quantity: 1 }];
  }
  return lines.map((l) => ({
    name: String(l.description || "Service").slice(0, 200),
    amount: kobo(lineTotal(l)),
    quantity: 1,
  }));
}

export function mapStatus(paystackStatus: string | null | undefined): string {
  switch (String(paystackStatus || "").toLowerCase()) {
    case "success":
    case "paid":
      return "paid";
    case "pending":
      return "sent";
    case "draft":
      return "draft";
    case "expired":
      return "expired";
    case "archived":
      return "cancelled";
    default:
      return "sent";
  }
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting payment",
  paid: "Paid",
  part_paid: "Part paid",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const naira = (n: unknown) => `₦${Number(n || 0).toLocaleString()}`;
