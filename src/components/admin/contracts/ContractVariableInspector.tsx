// The right rail of the contract editor: the facts behind the placeholders,
// the pre-issue checks, and the audit trail.
//
// A placeholder button drops its token into whichever editor last had focus,
// so an admin can write wording and fill gaps without leaving the canvas.
// The rail collapses to a strip and remembers the choice.
import { format } from "date-fns";
import {
  AlertTriangle, ChevronLeft, ChevronRight, CircleAlert, History, Loader2, TextCursorInput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CONTRACT_FIELDS, ContractEvent, ContractFields, EVENT_LABELS } from "@/lib/contracts";
import type { ContractCheck } from "@/lib/contract-checks";

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  editable: boolean;
  fields: ContractFields;
  onFieldChange: (key: string, value: string) => void;
  checks: ContractCheck[];
  onJumpTo: (area: ContractCheck["area"]) => void;
  onInsertToken: (token: string) => void;
  /** Home-address helpers, wired to the person's account. */
  onPullAddress: () => void;
  onAskForAddress: () => void;
  addressBusy: boolean;
  events: ContractEvent[];
  issuedHash?: string | null;
}

const ContractVariableInspector = ({
  collapsed,
  onToggleCollapsed,
  editable,
  fields,
  onFieldChange,
  checks,
  onJumpTo,
  onInsertToken,
  onPullAddress,
  onAskForAddress,
  addressBusy,
  events,
  issuedHash,
}: Props) => {
  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 rounded-2xl border border-border/60 bg-background py-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Show details and checks"
          title="Show details and checks"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {checks.length > 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 text-xs font-semibold",
              checks.some((c) => c.severity === "error") ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800",
            )}
            title={`${checks.length} open ${checks.length === 1 ? "check" : "checks"}`}
          >
            {checks.length}
          </span>
        )}
      </div>
    );
  }

  const errors = checks.filter((c) => c.severity === "error");
  const warnings = checks.filter((c) => c.severity === "warning");

  return (
    <aside className="w-80 shrink-0 space-y-4 rounded-2xl border border-border/60 bg-background p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details and checks</p>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          aria-label="Hide details and checks"
          title="Hide details and checks"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Pre-issue checks: what still stands between this draft and sending. */}
      <section className="space-y-2">
        <p className="text-sm font-semibold">Before this can be issued</p>
        {checks.length === 0 ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Nothing stands in the way. The wording is ready to freeze and send.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {[...errors, ...warnings].map((check) => (
              <li key={`${check.id}-${check.area}`}>
                <button
                  type="button"
                  onClick={() => onJumpTo(check.area)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs transition",
                    check.severity === "error"
                      ? "border-red-200 bg-red-50 text-red-900 hover:bg-red-100"
                      : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
                  )}
                >
                  {check.severity === "error" ? (
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>
                    <span className="font-medium">{check.label}. </span>
                    {check.message}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The facts the placeholders resolve against. */}
      <section className="space-y-3 border-t border-border/60 pt-3">
        <p className="text-sm font-semibold">Contract details</p>
        {CONTRACT_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            {f.type === "textarea" ? (
              <Textarea
                rows={2}
                value={fields[f.key] || ""}
                disabled={!editable}
                onChange={(e) => onFieldChange(f.key, e.target.value)}
              />
            ) : (
              <Input
                type={f.type === "date" ? "date" : "text"}
                value={fields[f.key] || ""}
                disabled={!editable}
                onChange={(e) => onFieldChange(f.key, e.target.value)}
              />
            )}
            {f.key === "employee_address" && editable && (
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onPullAddress} disabled={addressBusy}>
                  {addressBusy ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
                  Take the address from the account
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onAskForAddress} disabled={addressBusy}>
                  Ask them to add it
                </Button>
              </div>
            )}
            {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
          </div>
        ))}
      </section>

      {/* Placeholder buttons: one tap drops the token into the focused editor. */}
      {editable && (
        <section className="space-y-2 border-t border-border/60 pt-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <TextCursorInput className="h-4 w-4" />Insert a placeholder
          </p>
          <p className="text-[11px] text-muted-foreground">
            Dropped into whichever document you were last editing.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CONTRACT_FIELDS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onInsertToken(`{{${f.key}}}`)}
                className={cn(
                  "rounded-full border px-2 py-1 text-[11px] transition",
                  (fields[f.key] || "").trim()
                    ? "border-border/70 bg-muted/40 hover:bg-muted"
                    : "border-dashed border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100",
                )}
                title={(fields[f.key] || "").trim() ? String(fields[f.key]) : "No value yet"}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* The trail, so who did what never leaves the room. */}
      <section className="space-y-2 border-t border-border/60 pt-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <History className="h-4 w-4" />Audit trail
        </p>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ol className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {events.map((e) => (
              <li key={e.id} className="rounded-xl border border-border/60 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{EVENT_LABELS[e.event_type] || e.event_type}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(e.created_at), "d MMM, HH:mm")}
                  </span>
                </div>
                {e.detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{e.detail}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {[e.actor_name, e.actor_role].filter(Boolean).join(" · ") || "System"}
                </p>
              </li>
            ))}
          </ol>
        )}
        {issuedHash && (
          <p className="break-all text-[11px] text-muted-foreground">
            Fingerprint of the signed wording: {issuedHash}
          </p>
        )}
      </section>
    </aside>
  );
};

export default ContractVariableInspector;
