import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import { CxAuthShell, CxAuthAside, CxAuthField, CxAuthPassword } from "@/components/candidate/CxAuthShell";
import { CxButton, cxInputClass } from "@/components/candidate/primitives";

type Step = "email" | "password" | "code";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const processingRef = useRef(false);
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Consume ?next=... so OAuth consent (and other guarded routes) can bounce
  // users through login and land back where they started, not on /admin/posts.
  const getNext = () => {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (!raw) return null;
    return raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
  };

  useEffect(() => {
    if (!loading && user && isAdmin && !processingRef.current) {
      navigate(getNext() ?? "/admin/posts", { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const callOtpFunction = async (action: string, extra: Record<string, string> = {}) => {
    const res = await fetch(`${FUNCTIONS_URL}/admin-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, email: email.trim().toLowerCase(), ...extra }),
    });
    return res.json();
  };

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStep("password");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setSubmitting(true);
    processingRef.current = true;
    const trimmedEmail = email.trim().toLowerCase();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (signInError) {
      processingRef.current = false;
      setSubmitting(false);
      const lowered = signInError.message.toLowerCase();
      const isLeaked = lowered.includes("leaked") || lowered.includes("breach") || lowered.includes("compromised");
      toast({
        title: isLeaked ? "Password compromised" : "Sign in failed",
        description: isLeaked
          ? "This password has appeared in a known data breach. Please reset your password with a unique one."
          : signInError.message,
        variant: "destructive",
      });
      return;
    }

    // Sign out immediately to prevent a premature session before the code step.
    await supabase.auth.signOut();
    processingRef.current = false;

    const result = await callOtpFunction("send");
    setSubmitting(false);

    if (result.error) {
      toast({ title: "Could not send code", description: result.error, variant: "destructive" });
    } else {
      setStep("code");
      setCountdown(60);
      toast({ title: "Code sent", description: `Check ${trimmedEmail} for your six digit security code.` });
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedOtp = otp.trim();
    if (!trimmedOtp) return;

    setSubmitting(true);
    const result = await callOtpFunction("verify", { code: trimmedOtp });

    if (result.error) {
      setSubmitting(false);
      toast({ title: "Verification failed", description: result.error, variant: "destructive" });
      return;
    }

    if (result.token_hash) {
      const { data: verifyData, error } = await supabase.auth.verifyOtp({
        token_hash: result.token_hash,
        type: "magiclink",
      });

      if (error) {
        setSubmitting(false);
        toast({ title: "Session failed", description: error.message, variant: "destructive" });
      } else {
        // Login history is recorded by ProtectedRoute once per session, whichever door was used.
        setSubmitting(false);
        navigate(getNext() ?? "/admin/posts", { replace: true });
      }
    } else {
      setSubmitting(false);
      toast({ title: "Verification failed", description: "Unexpected response from server.", variant: "destructive" });
    }
  };

  const handleResend = async () => {
    setCountdown(60);
    const result = await callOtpFunction("send");
    if (result.error) {
      toast({ title: "Resend failed", description: result.error, variant: "destructive" });
      setCountdown(0);
    } else {
      toast({ title: "New code sent", description: "Check your inbox." });
    }
  };

  if (loading) {
    return (
      <div className="cx min-h-dvh flex items-center justify-center bg-navy">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  const title = step === "code" ? "Security code" : "Staff sign in";
  const intro =
    step === "email"
      ? "This door is for the Medic Connect team. Candidates sign in at the candidate portal."
      : step === "password"
        ? `Signing in as ${email.trim().toLowerCase()}.`
        : `We sent a six digit code to ${email.trim().toLowerCase()}. It is good for ten minutes.`;

  const quietLink =
    "text-[13.5px] font-bold text-body-navy underline underline-offset-4 hover:text-white disabled:no-underline disabled:text-muted-navy";

  const aside = <CxAuthAside variant="statement" />;


  return (
    <>
      <SEO title="Staff sign in | Medic Connect" description="Secure staff sign in for the Medic Connect care platform." path="/auth" noindex />
      <CxAuthShell
        aside={aside}
        title={title}
        intro={intro}
        footer={
          <>
            Looking for your candidate profile?{" "}
            <a href="/portal/login" className="font-bold text-white underline underline-offset-4">
              Sign in there instead
            </a>
          </>
        }
      >
        {step === "email" && (
          <form onSubmit={handleEmailContinue} className="flex flex-col gap-4">
            <CxAuthField id="email" label="Work email">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cxInputClass(true)}
              />
            </CxAuthField>
            <CxButton type="submit" onNavy full>
              Continue
            </CxButton>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <CxAuthField id="password" label="Password" hint="After this we email you a one time code.">
              <CxAuthPassword
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={setPassword}
              />
            </CxAuthField>
            <CxButton type="submit" onNavy full disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking
                </>
              ) : (
                "Continue"
              )}
            </CxButton>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setPassword("");
              }}
              className={`${quietLink} inline-flex items-center gap-1.5 self-start`}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
            <CxAuthField id="otp" label="Six digit code">
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className={`${cxInputClass(true)} text-center text-[26px] font-bold tracking-[0.35em]`}
              />
            </CxAuthField>
            <CxButton type="submit" onNavy full disabled={submitting || otp.length < 6}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying
                </>
              ) : (
                "Verify and sign in"
              )}
            </CxButton>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep("password");
                  setOtp("");
                }}
                className={`${quietLink} inline-flex items-center gap-1.5`}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button type="button" onClick={handleResend} disabled={countdown > 0} className={quietLink}>
                {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </CxAuthShell>
    </>
  );
};

export default Auth;
