// Account management for one candidate profile.
//
// Candidates sign in with the email we hold on file, so the two things that
// actually go wrong are a wrong email and a lost password. Both are handled
// here, plus a manual link for when email is not reaching them at all. Every
// action leaves a trail on the person's activity.
import { useState } from "react";
import { format } from "date-fns";
import { Copy, KeyRound, Loader2, Send, ShieldOff } from "lucide-react";
import { MuStatus } from "@/components/admin/mu/MuShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  personId: string;
  personName: string;
  email: string | null;
  invitedAt: string | null;
  claimedAt: string | null;
  hasAccount: boolean;
  onChanged?: () => void;
}

const CandidateAccountPanel = ({
  personId, personName, email, invitedAt, claimedAt, hasAccount, onChanged,
}: Props) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [nextEmail, setNextEmail] = useState(email ?? "");
  const [link, setLink] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    const { data, error } = await supabase.functions.invoke("candidate-account-admin", {
      body: { person_id: personId, action, ...extra },
    });
    setBusy(null);
    const failure = error?.message || (data as any)?.error;
    if (failure) {
      toast({ title: "That did not go through", description: failure, variant: "destructive" });
      return null;
    }
    onChanged?.();
    return data as any;
  };

  const sendInvite = async () => {
    setBusy("invite");
    const { data, error } = await supabase.functions.invoke("invite-candidate", { body: { person_id: personId } });
    setBusy(null);
    const failure = error?.message || (data as any)?.error;
    if (failure) {
      toast({ title: "Could not send it", description: failure, variant: "destructive" });
      return;
    }
    toast({ title: "Sent", description: `A password link is on its way to ${email}.` });
    onChanged?.();
  };

  const makeLink = async () => {
    const res = await call("reset_link");
    if (res?.link) {
      setLink(res.link);
      toast({ title: "One-time link ready", description: "It expires once used or after 24 hours." });
    }
  };

  const saveEmail = async () => {
    const res = await call("update_email", { email: nextEmail.trim() });
    if (res?.success) toast({ title: "Email updated", description: `${personName} now signs in with ${res.email}.` });
  };

  const revoke = async () => {
    const res = await call("revoke_access");
    setConfirmRevoke(false);
    if (res?.success) toast({ title: "Access revoked", description: "The profile and its history are untouched." });
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Their account</p>
            <p className="text-xs text-muted-foreground">
              {claimedAt
                ? `Password set ${format(new Date(claimedAt), "d MMM yyyy")}`
                : invitedAt
                  ? `Invited ${format(new Date(invitedAt), "d MMM yyyy")}, not signed in yet`
                  : "Never invited"}
            </p>
          </div>
          <MuStatus
            tone={claimedAt ? "good" : hasAccount ? "info" : "neutral"}
            label={claimedAt ? "Active" : hasAccount ? "Invited" : "No account"}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Label className="text-xs">Email on file (this is their username)</Label>
            <Input value={nextEmail} onChange={(e) => setNextEmail(e.target.value)} type="email"
                   placeholder="name@example.com" />
          </div>
          <Button variant="outline" size="sm" disabled={busy === "update_email" || !nextEmail.trim() || nextEmail.trim() === (email ?? "")}
                  onClick={saveEmail}>
            {busy === "update_email" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Update email
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={sendInvite} disabled={!email || busy === "invite"}>
            {busy === "invite" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {invitedAt ? "Email a password reset" : "Invite to their profile"}
          </Button>
          <Button size="sm" variant="ghost" onClick={makeLink} disabled={!email || busy === "reset_link"}>
            {busy === "reset_link" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Generate a link to send myself
          </Button>
          {hasAccount && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmRevoke(true)}>
              <ShieldOff className="mr-2 h-4 w-4" />Revoke access
            </Button>
          )}
        </div>

        {link && (
          <div className="flex items-center gap-2 bg-muted p-2">
            <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast({ title: "Copied" }); }}>
              <Copy className="mr-2 h-4 w-4" />Copy
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access for {personName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their sign-in is removed and they can no longer open their account. The profile, documents and history
              all stay exactly as they are, and you can invite them again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={revoke}>Revoke access</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default CandidateAccountPanel;
