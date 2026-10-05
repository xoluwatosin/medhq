import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  FamilyCard, FamilyHeading, FamilyLoading, FamilyNote, FamilyShell, FamilyText,
  familyPrimary, familySecondary,
} from "@/components/care/FamilyShell";

type InvitationState = "loading" | "open" | "accepted" | "used" | "invalid" | "expired" | "withdrawn" | "unavailable" | "error";
type Scope = { journey: boolean; clinical: boolean; finance: boolean };

const TEXT: Partial<Record<InvitationState, { title: string; body: string }>> = {
  invalid: { title: "Invitation not found", body: "This invitation link is not valid. Ask Medic Connect to send a new invitation." },
  expired: { title: "Invitation expired", body: "This invitation has expired. Ask Medic Connect to send it again." },
  withdrawn: { title: "Invitation withdrawn", body: "This invitation is no longer available. Contact Medic Connect if you need access." },
  unavailable: { title: "Access unavailable", body: "Access to this care record is not currently open. Contact Medic Connect for support." },
  used: { title: "You have already accepted this invitation", body: "Open the secure link from your last sign-in email, or ask Medic Connect to send you a new one." },
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

  const body = (() => {
    if (state === "loading") return <FamilyCard><FamilyLoading label="Opening your invitation" /></FamilyCard>;
    if (state === "open") return (
      <FamilyCard>
        <FamilyHeading>Confirm it is you</FamilyHeading>
        <FamilyText className="mt-1">
          We sent this invitation to {destinationHint || "your email"}. Type that address and we will email you a
          secure link. Opening it signs you in, with no password to remember.
        </FamilyText>
        {sent ? (
          <div className="mt-4">
            <FamilyNote title="Check your email">
              We have sent a secure link to {email.trim()}. Open it on this device to continue. It can take a minute
              to arrive; check your spam folder if you cannot see it.
            </FamilyNote>
          </div>
        ) : (
          <form className="mt-5 flex flex-col gap-3" onSubmit={sendLink}>
            <label htmlFor="care-invite-email" className="text-[14.5px] font-semibold text-ink">Your email address</label>
            <input
              id="care-invite-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-12 rounded-[10px] border border-[#C9C5BC] bg-card px-4 text-[16px] text-ink placeholder:text-label focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {error && <p role="alert" className="text-[14px] text-destructive">{error}</p>}
            <button type="submit" className={familyPrimary} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Email me a secure link
            </button>
          </form>
        )}
      </FamilyCard>
    );
    if (state === "accepted") return (
      <FamilyCard>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <FamilyHeading>{personName ? `You are in, ${personName}` : "You are in"}</FamilyHeading>
            <FamilyText className="mt-1">
              {scopeNames.length ? `You can follow the ${scopeNames.join(", ")}.` : "Nothing is shared with you yet."}
            </FamilyText>
          </div>
        </div>
      </FamilyCard>
    );
    return (
      <FamilyCard>
        <FamilyHeading>{TEXT[state]?.title}</FamilyHeading>
        <FamilyText className="mt-1">{TEXT[state]?.body}</FamilyText>
        <Link to="/contact" className={`${familySecondary} mt-4`}>Contact Medic Connect</Link>
      </FamilyCard>
    );
  })();

  return (
    <FamilyShell
      eyebrow="Invitation"
      title="Follow your family's care"
      lead="Medic Connect has invited you to see how a care request is going. You only see what the care team chooses to share."
      path={`/care/invitation/${token}`}
    >
      {body}
      <FamilyNote>
        <span className="flex gap-2">
          <LockKeyhole className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-ink">Your care record is private.</strong> Only people the care team
            has invited can open it, and each person sees only what they need.
          </span>
        </span>
      </FamilyNote>
    </FamilyShell>
  );
};

export default CareInvitation;