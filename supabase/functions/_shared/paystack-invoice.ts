// Shared helpers for Paystack payment requests (invoices).

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTotals {
  subtotal: number;
  vatAmount: number;
  total: number;
}

export function lineTotal(line: InvoiceLineInput): number {
  return round2(Number(line.quantity || 0) * Number(line.unitPrice || 0));
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function invoiceTotals(lines: InvoiceLineInput[], vatRate: number): InvoiceTotals {
  const subtotal = round2(lines.reduce((sum, l) => sum + lineTotal(l), 0));
  const vatAmount = round2((subtotal * (Number(vatRate) || 0)) / 100);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

export function kobo(amount: number): number {
  return Math.round(round2(amount) * 100);
}

/**
 * Paystack rejects negative line amounts, so when a discount line is present we
 * collapse the priced lines into one net line rather than sending a negative.
 */
export function paystackLineItems(lines: InvoiceLineInput[]): { name: string; amount: number; quantity: number }[] {
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

/** Map a Paystack payment request status onto the statuses we display. */
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

export function hostedLink(requestCode: string): string {
  return `https://paystack.com/pay/${requestCode}`;
}
