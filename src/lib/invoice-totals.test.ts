import { describe, expect, it } from "vitest";
import { invoiceTotals, kobo, lineTotal, mapStatus, paystackLineItems } from "./invoice-totals";

describe("invoice totals", () => {
  it("totals a staffing invoice with VAT", () => {
    const lines = [{ quantity: 2, unitPrice: 100000 }];
    expect(invoiceTotals(lines, 7.5)).toEqual({ subtotal: 200000, vatAmount: 15000, total: 215000 });
  });

  it("handles no VAT", () => {
    expect(invoiceTotals([{ quantity: 1, unitPrice: 35000 }], 0)).toEqual({
      subtotal: 35000,
      vatAmount: 0,
      total: 35000,
    });
  });

  it("rounds a single line to the kobo", () => {
    expect(lineTotal({ quantity: 3, unitPrice: 33333.333 })).toBe(100000);
  });
});

describe("paystack payload", () => {
  it("sends one line item per priced line, in kobo", () => {
    expect(
      paystackLineItems([
        { id: "1", description: "Care staffing, three staff, nine hours per day", quantity: 2, unitPrice: 100000 },
      ])
    ).toEqual([
      { name: "Care staffing, three staff, nine hours per day", amount: 20000000, quantity: 1 },
    ]);
  });

  it("collapses to a net line when a discount is present", () => {
    const items = paystackLineItems([
      { id: "1", description: "Care staffing", quantity: 2, unitPrice: 100000 },
      { id: "2", description: "Goodwill discount", quantity: 1, unitPrice: -20000 },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(kobo(180000));
  });
});

describe("status mapping", () => {
  it("maps Paystack statuses onto ours", () => {
    expect(mapStatus("success")).toBe("paid");
    expect(mapStatus("pending")).toBe("sent");
    expect(mapStatus("draft")).toBe("draft");
    expect(mapStatus("expired")).toBe("expired");
    expect(mapStatus("archived")).toBe("cancelled");
  });
});
