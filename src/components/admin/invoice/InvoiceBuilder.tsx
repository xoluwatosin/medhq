import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useInvoice } from "@/hooks/useInvoice";
import { lineTotal, naira } from "@/lib/invoice-totals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MuEmpty, MuSection } from "@/components/admin/mu/MuShell";
import { SearchableSelect, SelectField } from "@/components/field";
import { art } from "@/components/mc/art";
import { ServicePickerModal } from "./ServicePickerModal";
import { BookOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { selectAll } from "@/lib/select-all";

interface Props {
  onCreated: () => void;
}

export function InvoiceBuilder({ onCreated }: Props) {
  const invoice = useInvoice();
  const { data, update, addLine, updateLine, removeLine, reset, subtotal, vatAmount, total } = invoice;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["invoice-clients"],
    queryFn: async () => {
      // Every client, not only the first 300.
      return selectAll<any>((a, z) =>
        adminDb()
          .from("clients")
          .select("id, full_name, first_name, last_name, client_contacts(first_name, last_name, full_name, email, phone, is_primary)")
          .order("full_name")
          .order("id")
          .range(a, z));
    },
  });

  const applyClient = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    const contact =
      (client.client_contacts ?? []).find((c: any) => c.is_primary) ?? (client.client_contacts ?? [])[0];
    const parts = String(client.full_name ?? "").trim().split(/\s+/);
    update("clientId", id);
    update("clientFirstName", contact?.first_name || client.first_name || parts[0] || "");
    update("clientLastName", contact?.last_name || client.last_name || parts.slice(1).join(" ") || "");
    update("clientEmail", contact?.email || "");
    update("clientPhone", contact?.phone || "");
  };

  const validLines = data.lines.filter((l) => l.description.trim().length > 0);
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.clientEmail.trim());
  const blocker =
    !data.clientFirstName.trim() || !data.clientLastName.trim()
      ? "Add the client first name and last name."
      : !emailValid
        ? "Add a valid client email."
        : validLines.length === 0
          ? "Add at least one line with a description."
          : total <= 0
            ? "The total must be greater than zero."
            : null;

  const createInvoice = async () => {
    if (blocker) {
      toast({ title: "Could not create invoice", description: blocker, variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: result, error } = await supabase.functions.invoke("paystack-invoice", {
      body: {
        action: "create",
        clientId: data.clientId,
        clientFirstName: data.clientFirstName,
        clientLastName: data.clientLastName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        type: data.type,
        vatRate: data.vatRate,
        notes: data.notes,
        dueDate: data.dueDate,
        lines: validLines.map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
        })),
      },
    });

    let message = (result as any)?.error as string | undefined;
    if (!message && error) {
      const body = await (error as any)?.context?.json?.().catch(() => null);
      message = body?.error || (error as any).message || "The invoice service could not be reached.";
    }
    setSaving(false);

    if (message) {
      toast({ title: "Could not create invoice", description: message, variant: "destructive" });
      return;
    }
    toast({ title: "Invoice created", description: "It is on Paystack and ready to send." });
    queryClient.invalidateQueries({ queryKey: ["paystack-invoices"] });
    reset();
    onCreated();
  };

  return (
    <div className="space-y-6">
      <MuSection title="Who is being billed">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SearchableSelect
              label="Existing client"
              value={data.clientId ?? ""}
              onChange={applyClient}
              placeholder="Optional, fills the details below"
              searchPlaceholder="Search clients"
              options={clients.map((c) => ({ value: c.id, label: c.full_name ?? "Unnamed client" }))}
            />
          </div>
          <div>
            <Label htmlFor="inv-first">First name</Label>
            <Input id="inv-first" value={data.clientFirstName} onChange={(e) => update("clientFirstName", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inv-last">Last name</Label>
            <Input id="inv-last" value={data.clientLastName} onChange={(e) => update("clientLastName", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" value={data.clientEmail} onChange={(e) => update("clientEmail", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inv-phone">Phone</Label>
            <Input id="inv-phone" value={data.clientPhone} onChange={(e) => update("clientPhone", e.target.value)} />
          </div>
        </div>
      </MuSection>

      <MuSection
        title="What is being charged"
        actions={
          <>
            <Button size="sm" onClick={() => addLine()} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add line
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="gap-1.5">
              <BookOpen className="h-4 w-4" /> Catalogue
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {data.lines.length === 0 && (
            <MuEmpty
              art={art.objPriceTagNaira}
              title="No lines yet"
              description="Add a line or pick a service from the catalogue."
            />
          )}
          {data.lines.map((line, index) => (
            <div
              key={line.id}
              className="space-y-3 border border-line p-3 sm:space-y-0 sm:border-0 sm:p-0"
            >
              <div className="flex items-center justify-between sm:hidden">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">
                  Line {index + 1}
                </span>
                <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)} aria-label="Remove line">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_5rem_8rem_auto] sm:items-end sm:gap-2">
                <div>
                  <Label htmlFor={`desc-${line.id}`} className="sm:sr-only">Description</Label>
                  <Input
                    id={`desc-${line.id}`}
                    value={line.description}
                    placeholder="Care staffing, three staff, nine hours per day"
                    onChange={(e) => updateLine(line.id, "description", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`qty-${line.id}`} className="sm:sr-only">Quantity</Label>
                  <Input
                    id={`qty-${line.id}`}
                    inputMode="decimal"
                    value={String(line.quantity)}
                    onChange={(e) => updateLine(line.id, "quantity", e.target.value.replace(/[^0-9.]/g, ""))}
                  />
                </div>
                <div>
                  <Label htmlFor={`price-${line.id}`} className="sm:sr-only">Unit price</Label>
                  <Input
                    id={`price-${line.id}`}
                    inputMode="decimal"
                    placeholder="0"
                    value={String(line.unitPrice)}
                    onChange={(e) => updateLine(line.id, "unitPrice", e.target.value.replace(/[^0-9.-]/g, ""))}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="text-xs text-muted-foreground sm:hidden">Line total</span>
                  <span className="text-sm font-medium tabular-nums">{naira(lineTotal(line))}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden sm:inline-flex"
                    onClick={() => removeLine(line.id)}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </MuSection>

      <MuSection title="Terms and notes">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Invoice type"
            value={data.type}
            onChange={(v) => { if (v) update("type", v as any); }}
            options={[
              { value: "assessment", label: "Assessment" },
              { value: "standard", label: "Standard" },
              { value: "care_package", label: "Care package" },
            ]}
          />
          <div>
            <Label htmlFor="inv-vat">VAT rate (%)</Label>
            <Input id="inv-vat" type="number" step="0.5" value={data.vatRate} onChange={(e) => update("vatRate", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="inv-due">Due date</Label>
            <Input id="inv-due" type="date" value={data.dueDate} onChange={(e) => update("dueDate", e.target.value)} />
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="inv-notes">Notes shown to the client</Label>
            <Textarea
              id="inv-notes"
              rows={4}
              value={data.notes}
              placeholder="Three healthcare trained staff, at least one registered nurse. A first aid box is included in the fee."
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </div>
      </MuSection>

      <MuSection title="Total">
        <div className="space-y-2">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span className="tabular-nums">{naira(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span>VAT {data.vatRate}%</span><span className="tabular-nums">{naira(vatAmount)}</span></div>
          <div className="flex justify-between text-base font-semibold"><span>Total due</span><span className="tabular-nums">{naira(total)}</span></div>
          {blocker && <p className="mt-4 text-sm text-muted-foreground">{blocker}</p>}
          <Button className="mt-2 w-full" disabled={saving || Boolean(blocker)} onClick={createInvoice}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create invoice on Paystack
          </Button>
        </div>
      </MuSection>

      <ServicePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(description, price) => addLine(description, price)}
      />
    </div>
  );
}
