// Holding, closing, archiving and reopening a care record.
//
// Every state change is named, carries a reason where one is owed, and is
// written to the record's activity by the database function that makes it.
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SelectField } from "@/components/field";
import { careErrorMessage } from "@/lib/care-errors";
import { clientLifecycle, type ClientLifecycleAction } from "@/lib/care-records";

interface Prompt {
  action: ClientLifecycleAction;
  title: string;
  description: string;
  confirm: string;
  needsReason: boolean;
  /** The reasons offered, as the leading words of the recorded reason. */
  reasons?: readonly string[];
}

// The reasons follow how home care systems record a break and an ending:
// a short fixed list, with "Other" and a note for anything else.
const HOLD_REASONS = ["In hospital", "Travelling", "Respite", "Other"] as const;
const END_REASONS = [
  "Care finished",
  "Did not go ahead",
  "Left the service: needs went up",
  "Left the service: needs went down",
  "Left the service: price",
  "Left the service: moved away",
  "Left the service: service quality",
  "Deceased",
  "Other",
] as const;

const PROMPTS: Record<ClientLifecycleAction, Prompt> = {
  hold: {
    action: "hold",
    title: "Put this client on hold",
    description: "The client stays on file and leaves the Needs you list until care resumes.",
    confirm: "Put on hold",
    needsReason: true,
    reasons: HOLD_REASONS,
  },
  resume: {
    action: "resume",
    title: "Take this client off hold",
    description: "Work resumes from where it was.",
    confirm: "Take off hold",
    needsReason: false,
  },
  close: {
    action: "close",
    title: "End care for this client",
    description: "The client's status becomes Ended. Everything on file is kept and the file can be reopened.",
    confirm: "End care",
    needsReason: true,
    reasons: END_REASONS,
  },
  reopen: {
    action: "reopen",
    title: "Reopen this client",
    description: "The client returns to the status their records support.",
    confirm: "Reopen",
    needsReason: false,
  },
  archive: {
    action: "archive",
    title: "Archive this file",
    description: "Archived files stay readable and move out of the working list.",
    confirm: "Archive file",
    needsReason: false,
  },
  restore: {
    action: "restore",
    title: "Restore this file",
    description: "The file returns to the working list.",
    confirm: "Restore file",
    needsReason: false,
  },
};

const RecordLifecycle = ({
  clientId, pausedAt, closedAt, archivedAt, onChanged,
}: {
  clientId: string;
  pausedAt: string | null;
  closedAt: string | null;
  archivedAt: string | null;
  onChanged: () => void;
}) => {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [reason, setReason] = useState("");
  const [choice, setChoice] = useState("");
  const [saving, setSaving] = useState(false);

  const open = (action: ClientLifecycleAction) => {
    setReason("");
    setChoice("");
    setPrompt(PROMPTS[action]);
  };

  const run = async () => {
    if (!prompt) return;
    if (prompt.reasons && !choice) {
      toast.error("Choose a reason");
      return;
    }
    if (prompt.needsReason && (prompt.reasons ? choice === "Other" : true) && !reason.trim()) {
      toast.error("Say what the reason is");
      return;
    }
    const recorded = prompt.reasons ? [choice, reason.trim()].filter(Boolean).join(". ") : reason;
    setSaving(true);
    try {
      await clientLifecycle(clientId, prompt.action, recorded);
      toast.success(
        prompt.action === "hold" ? "Client put on hold"
          : prompt.action === "resume" ? "Client taken off hold"
            : prompt.action === "close" ? "Care ended"
              : prompt.action === "reopen" ? "Client reopened"
                : prompt.action === "archive" ? "File archived"
                  : "File restored",
      );
      setPrompt(null);
      onChanged();
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not change the state of this file"));
    } finally {
      setSaving(false);
    }
  };

  const actions: ClientLifecycleAction[] = archivedAt
    ? ["restore"]
    : closedAt
      ? ["reopen", "archive"]
      : pausedAt
        ? ["resume", "close"]
        : ["hold", "close"];

  return (
    <>
      {/* The record header keeps two visible actions; the file's state changes sit under More. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="h-10">
            More <ChevronDown className="ml-1.5 h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {actions.map((action) => (
            <DropdownMenuItem key={action} onSelect={() => open(action)}>
              {PROMPTS[action].confirm}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={Boolean(prompt)} onOpenChange={(next) => { if (!next) setPrompt(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{prompt?.title}</DialogTitle>
            <DialogDescription>{prompt?.description}</DialogDescription>
          </DialogHeader>
          {prompt?.reasons && (
            <SelectField
              label="Reason"
              value={choice}
              placeholder="Choose a reason"
              onChange={(v) => setChoice(v ?? "")}
              options={prompt.reasons.map((r) => ({ value: r, label: r }))}
            />
          )}
          {prompt?.needsReason && (
            <div className="grid gap-2">
              <label htmlFor="lifecycle-reason" className="text-[13.5px] font-semibold text-foreground">
                {prompt.reasons ? (choice === "Other" ? "What is the reason?" : "Note (optional)") : "Reason"}
              </label>
              <Textarea
                id="lifecycle-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setPrompt(null)}>
              Cancel
            </Button>
            <Button type="button" className="h-11" onClick={() => void run()} disabled={saving}>
              {saving ? "Saving" : prompt?.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RecordLifecycle;
