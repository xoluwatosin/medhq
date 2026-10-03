import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { CxAuthShell, CxAuthAside, CxAuthField, CxAuthOr, CxAuthPassword } from "@/components/candidate/CxAuthShell";
import { CxButton, cxInputClass } from "@/components/candidate/primitives";

/** Sign in for candidates. Admins use /auth. */
const PortalLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  // Credential problems stay on this screen. A toast would follow them into
  // the portal after they finally get in.
  const [signInError, setSignInError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Where they were heading before we asked them to sign in.
  const rawNext = params.get("next") || "/portal";
  const next = /^\/(portal|hm)(\/|$)/.test(rawNext) && !rawNext.startsWith("//") ? rawNext : "/portal";

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (error) {
      setSignInError("We could not sign you in. Check your email and password and try again.");
      return;
    }
    setSignInError(null);
    navigate(next);
  };

  // No password yet, or forgotten it. Same button either way: if we hold the
  // email, a personal link opens the profile we already have on file.
  const emailMeALink = async () => {
    setSignInError(null);
    if (!email.trim()) {
      setSignInError("Enter your email first.");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("candidate-claim", {
      body: { email: email.trim().toLowerCase(), next },
    });
    setSending(false);
    const failure = error?.message || (data as any)?.error;
    if (failure) {
      setSignInError("We could not send the link. Try again in a moment.");
      return;
    }
    toast({
      title: "Check your inbox",
      description: "If we hold that email on file, a link to open your profile is on its way.",
    });
  };


  return (
    <>
      <SEO title="Candidate sign in | Medic Connect" description="Sign in to your Medic Connect candidate profile." path="/portal/login" noindex />
      <CxAuthShell
        aside={
          <CxAuthAside
            eyebrow="Candidate portal"
            heading="One profile, every role you apply for."
            lede="Your profile stays with you. Update it once and every application we put you forward for uses the same record."
            variant="points"
            items={[
              { title: "Applied to us before?", body: "Your profile is already on file. Sign in with the email you used and it opens." },
              { title: "Documents in one place", body: "Upload a licence or certificate once. We check it and it stays checked." },
              { title: "Say when you are free", body: "Set your availability and preferences so we only bring you work that fits." },
            ]}
            note={<>Trouble signing in? Email <span className="font-bold text-ink2">hello@medicconnect.co</span></>}
          />
        }
        title="Sign in"
        intro="Use the email on your application. If you have applied to us before, your profile is already here."
        footer={
          <>
            New to Medic Connect?{" "}
            <Link to="/join" className="font-bold text-white underline underline-offset-4">
              Start your profile
            </Link>
          </>
        }
      >
        <form onSubmit={signIn} className="flex flex-col gap-4">
          <CxAuthField id="email" label="Email">
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setSignInError(null); }}
              className={cxInputClass(true)}
            />
          </CxAuthField>
          <CxAuthField id="password" label="Password">
            <CxAuthPassword
              id="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(v) => { setPassword(v); setSignInError(null); }}
            />
          </CxAuthField>
          {signInError && (
            <p role="alert" aria-live="polite" className="cx-control bg-price/15 px-3 py-2.5 text-[14px] leading-relaxed text-white">
              {signInError}
            </p>
          )}
          <CxButton type="submit" onNavy full disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in</> : "Sign in"}
          </CxButton>
        </form>

        <CxAuthOr />

        <div className="flex flex-col gap-2">
          <CxButton type="button" rank="secondary" onNavy full onClick={emailMeALink} disabled={sending}>
            {sending ? "Sending" : "Email me a sign in link"}
          </CxButton>
          <p className="text-[13.5px] leading-relaxed text-muted-navy">
            If you never set a password, the link opens your profile without one.
          </p>
        </div>
      </CxAuthShell>
    </>
  );
};

export default PortalLogin;
