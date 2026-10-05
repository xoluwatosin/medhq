// One way to decide a document, wherever staff decide it: the Document
// review queue and the person's Checks tab. The same reasons, the same
// "accept for now", the same rule for when the candidate is emailed.
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { adminDb } from "@/lib/admin-utils";

/** The reasons we send something back, in the words the candidate reads. */
export const REJECT_REASONS = [
  "We cannot read this copy clearly enough to accept it.",
  "This is not the document we asked for.",
  "This document has already expired.",
  "The name on this document does not match the name on your profile.",
  "Part of the document is missing or cut off.",
];

/** Why we would accept an out of date copy for the time being. */
export const CONDITIONAL_REASONS = [
  "The copy we hold has expired, so we are accepting it while you send a current one.",
  "Renewal is already under way with the licensing body.",
  "Accepted for this placement only, pending an in date copy.",
];

const toISO = (d: Date) => d.toISOString().slice(0, 10);
/** A sensible chase date: about three months out. */
export const defaultReviewDate = () => { const d = new Date(); d.setDate(d.getDate() + 90); return toISO(d); };
export const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return toISO(d); };

export type DocumentOutcome = "accepted" | "rejected" | "conditional";

/**
 * Records the decision, then writes to the candidate only when something is
 * needed of them: a return, or an acceptance for now (which asks for an in
 * date copy). A plain acceptance asks nothing, so it sends nothing.
 */
export async function decideDocument(o: {
  documentId: string;
  outcome: DocumentOutcome;
  reason?: string;
  until?: string | null;
  expiresAt?: string | null;
  notify?: boolean;
  /** False when we hold no email address for them. */
  canEmail?: boolean;
}): Promise<{ error?: string; emailed: boolean; mailError?: string }> {
  const { error } = await (adminDb() as any).rpc("mu_review_document", {
    _document_id: o.documentId,
    _outcome: o.outcome,
    _reason: o.reason?.trim() || null,
    _expires_at: o.expiresAt || null,
    _conditional_until: o.outcome === "conditional" ? o.until ?? null : null,
  });
  if (error) return { error: error.message, emailed: false };
  const emailed = o.outcome !== "accepted" && (o.notify ?? true) && o.canEmail !== false;
  if (emailed) {
    const { error: mailErr } = await supabase.functions.invoke("notify-candidate-document", {
      body: { document_id: o.documentId },
    });
    if (mailErr) return { emailed: false, mailError: mailErr.message };
  }
  return { emailed };
}

const Presets = ({ items, value, onPick }: { items: string[]; value: string; onPick: (v: string) => void }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((preset) => (
      <Button
        key={preset}
        type="button"
        size="sm"
        variant={value === preset ? "default" : "outline"}
        className="h-auto whitespace-normal py-1.5 text-left text-xs"
        onClick={() => onPick(preset)}
      >
        {preset.replace(/\.$/, "")}
      </Button>
    ))}
  </div>
);

export const ReturnDocumentDialog = ({
  open, name, busy, onCancel, onConfirm,
}: {
  open: boolean;
  name: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, notify: boolean) => void;
}) => {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  useEffect(() => { if (open) { setReason(""); setNotify(true); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return document</DialogTitle>
          <DialogDescription>{name} will see this reason on their account, so write it as you would say it to them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Presets items={REJECT_REASONS} value={reason} onPick={setReason} />
          <Label htmlFor="return-reason">Reason for return</Label>
          <Textarea id="return-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="The copy is cut off at the bottom, so the expiry date is not readable." />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notify} onCheckedChange={(v) => setNotify(!!v)} />
            Email them the reason
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" disabled={!reason.trim() || busy} onClick={() => onConfirm(reason.trim(), notify)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Return document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const AcceptForNowDialog = ({
  open, name, expired, busy, onCancel, onConfirm,
}: {
  open: boolean;
  name: string;
  /** The copy we hold is out of date, so the usual reason is pre-filled. */
  expired?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (why: string, until: string, notify: boolean) => void;
}) => {
  const [why, setWhy] = useState("");
  const [until, setUntil] = useState(defaultReviewDate());
  const [notify, setNotify] = useState(true);
  useEffect(() => {
    if (open) { setWhy(expired ? CONDITIONAL_REASONS[0] : ""); setUntil(defaultReviewDate()); setNotify(true); }
  }, [open, expired]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept for now</DialogTitle>
          <DialogDescription>
            The document counts as in place until the review date. After that it comes back for review as expired,
            and {name} is asked for a current copy.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Presets items={CONDITIONAL_REASONS} value={why} onPick={setWhy} />
          <div className="space-y-1.5">
            <Label htmlFor="cond-until">Review date</Label>
            <Input id="cond-until" type="date" min={tomorrow()} value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
          <Label htmlFor="cond-why">Why we are accepting it for now</Label>
          <Textarea id="cond-why" rows={3} value={why} onChange={(e) => setWhy(e.target.value)}
            placeholder="Renewal is under way, so we will work with this copy until the new one arrives." />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notify} onCheckedChange={(v) => setNotify(!!v)} />
            Email them what is still needed
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={!why.trim() || !until || busy} onClick={() => onConfirm(why.trim(), until, notify)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Accept until this date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
