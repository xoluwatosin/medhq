import { useCallback, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { invoiceTotals, PAYMENT_TERMS, type InvoiceLine, type InvoiceType } from "@/lib/invoice-totals";

export type { InvoiceLine, InvoiceType };

export interface InvoiceDraft {
  type: InvoiceType;
  clientId: string | null;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhone: string;
  lines: InvoiceLine[];
  vatRate: number;
  notes: string;
  dueDate: string;
}

const emptyDraft = (): InvoiceDraft => ({
  type: "standard",
  clientId: null,
  clientFirstName: "",
  clientLastName: "",
  clientEmail: "",
  clientPhone: "",
  lines: [],
  vatRate: 7.5,
  notes: "",
  dueDate: format(addDays(new Date(), PAYMENT_TERMS.standard), "yyyy-MM-dd"),
});

export function useInvoice() {
  const [data, setData] = useState<InvoiceDraft>(emptyDraft);

  const update = useCallback(<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) => {
    setData((prev) => {
      if (key === "type") {
        const type = value as InvoiceType;
        return {
          ...prev,
          type,
          dueDate: format(addDays(new Date(), PAYMENT_TERMS[type]), "yyyy-MM-dd"),
        };
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const addLine = useCallback((description = "", unitPrice: string | number = "") => {
    setData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        { id: crypto.randomUUID(), description, quantity: "1", unitPrice: unitPrice === 0 ? "" : String(unitPrice) },
      ],
    }));
  }, []);

  const updateLine = useCallback((id: string, field: keyof InvoiceLine, value: string | number) => {
    setData((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    }));
  }, []);

  const removeLine = useCallback((id: string) => {
    setData((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.id !== id) }));
  }, []);

  const reset = useCallback(() => setData(emptyDraft()), []);

  const { subtotal, vatAmount, total } = useMemo(
    () => invoiceTotals(data.lines, data.vatRate),
    [data.lines, data.vatRate]
  );

  return { data, setData, update, addLine, updateLine, removeLine, reset, subtotal, vatAmount, total };
}
