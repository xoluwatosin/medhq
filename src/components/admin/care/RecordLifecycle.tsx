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
import { careErrorMessage } from "@/lib/care-errors";
import { clientLifecycle, type ClientLifecycleAction } from "@/lib/care-records";

interface Prompt {
  action: ClientLifecycleAction;
  title: string;
  description: string;
  confirm: string;
  needsReason: boolean;
}

const PROMPTS: Record<ClientLifecycleAction, Prompt> = {
  hold: {
    action: "hold",
    title: "Put this file on hold",
    description: "The file stays open and stops appearing as outstanding work.",
    confirm: "Put on hold",
    needsReason: true,
  },
  resume: {
    action: "resume",
    title: "Take this file off hold",
    description: "Work on this file resumes from its current stage.",
    confirm: "Take off hold",
    needsReason: false,
  },
  close: {
    action: "close",
    title: "Close this file",
    description: "Closing records that care is not continuing. Everything on the file is kept.",
    confirm: "Close file",
    needsReason: true,
  },
  reopen: {
    action: "reopen",
    title: "Reopen this file",
    description: "The file returns to the stage its records support.",
    confirm: "Reopen file",
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
  const [saving, setSaving] = useState(false);

  const open = (action: ClientLifecycleAction) => {
    setReason("");
    setPrompt(PROMPTS[action]);
  };

  const run = async () => {
    if (!prompt) return;
    if (prompt.needsReason && !reason.trim()) {
      toast.error("Record a reason");
      return;
    }
    setSaving(true);
    try {
      await clientLifecycle(clientId, prompt.action, reason);
      toast.success(
        prompt.action === "hold" ? "File put on hold"
          : prompt.action === "resume" ? "File taken off hold"
            : prompt.action === "close" ? "File closed"
              : prompt.action === "reopen" ? "File reopened"
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
          {prompt?.needsReason && (
            <div className="grid gap-2">
              <label htmlFor="lifecycle-reason" className="text-[13.5px] font-semibold text-foreground">
                Reason
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
