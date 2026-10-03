import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/brand/medicconnect-logo.svg";

type InvitationState = "loading" | "open" | "accepted" | "used" | "invalid" | "expired" | "withdrawn" | "unavailable" | "error";
type Scope = { journey: boolean; clinical: boolean; finance: boolean };

const TEXT: Partial<Record<InvitationState, { title: string; body: string }>> = {
  invalid: { title: "Invitation not found", body: "This invitation link is not valid. Ask Medic Connect to send a new invitation." },
  expired: { title: "Invitation expired", body: "This invitation has expired. Ask Medic Connect to send it again." },
  withdrawn: { title: "Invitation withdrawn", body: "This invitation is no longer available. Contact Medic Connect if you need access." },
  unavailable: { title: "Access unavailable", body: "Access to this care record is not currently open. Contact Medic Connect for support." },
  used: { title: "Invitation already accepted", body: "Sign in through your original verification email to open your Care account." },
  error: { title: "Could not open invitation", body: "Please try again. Contact Medic Connect if the problem continues." },
};

const CareInvitation = () => {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<InvitationState>("loading");
  const [destinationHint, setDestinationHint] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [personName, setPersonName] = useState("");
  const [scopes, setScopes] = useState<Scope | null>(null);

  const invoke = useCallback(async (action: "inspect" | "accept") => {
    const { data, error: invokeError } = await supabase.functions.invoke("care-portal-accept", {
      body: { action, token },
    });
    return { data: data as Record<string, unknown> | null, error: invokeError };
  }, [token]);

  const accept = useCallback(async () => {
    setBusy(true);
    setError("");
    const result = await invoke("accept");
    setBusy(false);
    if (result.error || result.data?.error) {
      setError(String(result.data?.error ?? "Could not accept this invitation"));
      return;
    }
    setPersonName(String(result.data?.person_name ?? ""));
    setScopes((result.data?.scopes as Scope | undefined) ?? null);
    setState("accepted");
    navigate("/care", { replace: true });
  }, [invoke, navigate]);

  useEffect(() => {
    let live = true;
    void invoke("inspect").then(async ({ data, error: invokeError }) => {
      if (!live) return;
      if (invokeError && !data?.state) { setState("error"); return; }
      const next = String(data?.state ?? "error") as InvitationState;
      setDestinationHint(String(data?.destination_hint ?? ""));
      if (next === "accepted") {
        const { data: session } = await supabase.auth.getSession();
        if (session.session) { await accept(); return; }
        setState("used");
        return;
      }
      setState(next);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void accept();
    });
    return () => { live = false; listener.subscription.unsubscribe(); };
  }, [accept, invoke]);

  const sendLink = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const redirectTo = `${window.location.origin}/care/invitation/${encodeURIComponent(token)}`;
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setBusy(false);
    if (authError) { setError("Could not send the verification email"); return; }
    setSent(true);
  };

  const scopeNames = scopes
    ? [scopes.journey && "care journey", scopes.clinical && "care plan", scopes.finance && "invoices and payments"].filter(Boolean)
    : [];

  return (
    <main className="min-h-dvh bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-xl">
        <Link to="/" aria-label="Medic Connect home" className="mb-6 inline-flex">
          <img src={logo} alt="Medic Connect" className="h-9 w-auto" />
        </Link>
        <Card className="overflow-hidden">
          <div className="h-2 bg-primary" />
          {state === "loading" ? (
            <CardContent className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Opening invitation" />
            </CardContent>
          ) : state === "open" ? (
            <>
              <CardHeader>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-semibold leading-none">Open your care record</h1>
                <CardDescription>Verify the email address this invitation was sent to: {destinationHint}.</CardDescription>
              </CardHeader>
              <CardContent>
                {sent ? (
                  <div className="rounded-xl border border-border bg-accent p-4">
                    <p className="font-semibold text-foreground">Verification email sent</p>
                    <p className="mt-1 text-sm text-muted-foreground">Open the secure link in that email to continue.</p>
                  </div>
                ) : (
                  <form className="space-y-4" onSubmit={sendLink}>
                    <div className="space-y-2">
                      <Label htmlFor="care-invite-email">Email</Label>
                      <Input id="care-invite-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                    </div>
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send verification email
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          ) : state === "accepted" ? (
            <>
              <CardHeader>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-semibold leading-none">Access confirmed</h1>
                <CardDescription>{personName ? `${personName}, your` : "Your"} account is securely linked to this care record.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border bg-accent p-4">
                  <p className="font-semibold text-foreground">Your current access</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scopeNames.length ? `You can view the ${scopeNames.join(", ")}.` : "No record sections are currently available."}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">Medic Connect controls access to each section. Contact the care team if you need support.</p>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <h1 className="text-2xl font-semibold leading-none">{TEXT[state]?.title}</h1>
                <CardDescription>{TEXT[state]?.body}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full"><Link to="/contact">Contact Medic Connect</Link></Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </main>
  );
};

export default CareInvitation;