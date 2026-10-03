import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { CxAuthShell, CxAuthAside, CxAuthField, CxAuthPassword } from "@/components/candidate/CxAuthShell";
import { PasswordRequirements } from "@/components/candidate/PasswordRequirements";
import { CxButton } from "@/components/candidate/primitives";

type LinkStatus = "checking" | "confirm" | "valid" | "invalid";

/**
 * Candidates land here from the personalised link in their invite email.
 *
 * The email carries a token hash rather than Supabase's own /verify URL, and we
 * only redeem it when the candidate presses the button. Mail security scanners
 * prefetch links without running JavaScript, so the token survives the scan
 * instead of being burnt before the candidate ever clicks.
 */
const PortalSetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
  const [passwordError, setPasswordError] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const tokenHash = searchParams.get("token_hash");
  const tokenType = (searchParams.get("type") || "recovery") as "recovery" | "invite" | "email";
  // Where they were heading when they clicked. Only our own pages are allowed.
  const rawNext = searchParams.get("next") || "/portal";
  const next = /^\/(portal|hm)(\/|$)/.test(rawNext) && !rawNext.startsWith("//") ? rawNext : "/portal";

  useEffect(() => {
    // Legacy links still arrive with the session already in the URL hash.
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasHashToken = hashParams.get("access_token") || hashParams.get("type");

    if (tokenHash) {
      setLinkStatus("confirm");
      return;
    }

    if (!hasHashToken) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setLinkStatus(session ? "valid" : "invalid");
      });
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setLinkStatus("valid");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") setLinkStatus("valid");
    });

    const timeout = setTimeout(() => {
      setLinkStatus((prev) => (prev === "checking" ? "invalid" : prev));
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [tokenHash]);

  const redeemToken = async () => {
    if (!tokenHash) return;
    setIsLoading(true);
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tokenType });
    setIsLoading(false);
    if (error) {
      setErrorText(error.message);
      setLinkStatus("invalid");
      return;
    }
    setLinkStatus("valid");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(false);
    if (password.length < 8) {
      setPasswordError(true);
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      const breached = /weak|easy to guess|pwned|compromis/i.test(error.message);
      setPasswordError(true);
      toast({
        title: breached ? "Please choose a different password" : "Could not set your password",
        description: breached
          ? "This password has appeared in a known data breach. Pick one you have not used elsewhere."
          : "Please check the requirements below and try again.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Password set" });
    navigate(next);
  };

  const seo = (
    <SEO
      title="Set your password | Medic Connect"
      description="Set a password for your Medic Connect candidate account."
      path="/portal/set-password"
      noindex
    />
  );

  if (linkStatus === "checking") {
    return (
      <>
        {seo}
        <CxAuthShell title="Checking your link" intro="This takes a moment.">
          <Loader2 className="h-5 w-5 animate-spin text-body-navy" />
        </CxAuthShell>
      </>
    );
  }

  if (linkStatus === "confirm") {
    return (
      <>
        {seo}
        <CxAuthShell
          aside={
            <CxAuthAside
              eyebrow="Candidate portal"
              heading="Two taps and your profile is open."
              variant="steps"
              items={[
                { title: "Confirm it is you", body: "Press continue to open the link we emailed." },
                { title: "Set a password", body: "So you can come back without waiting for an email." },
                { title: "Pick up where you left off", body: "Documents, availability and applications, all in one place." },
              ]}
            />
          }
          title="Confirm it is you"
          intro="Press continue to open your account and set a password."
        >
          <CxButton onNavy full onClick={redeemToken} disabled={isLoading}>
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Opening</> : "Continue"}
          </CxButton>
        </CxAuthShell>
      </>
    );
  }

  if (linkStatus === "invalid") {
    return (
      <>
        {seo}
        <CxAuthShell
          aside={
            <CxAuthAside
              eyebrow="Sign in link"
              heading="That link has already done its job."
              lede="Invite links work once and last a day, so a forwarded email can never open your profile."
              variant="quote"
              quote="Your profile is still here. It just needs a fresh key."
              attribution="Medic Connect candidate care"
              note={<>Email <span className="font-bold text-ink2">hello@medicconnect.co</span> for a new link</>}
            />
          }
          title="This link has expired"
          intro={
            errorText ||
            "Invite links can only be used once and last 24 hours. Email hello@medicconnect.co and we will send you a fresh one."
          }
          footer={
            <>
              Already set a password?{" "}
              <Link to="/portal/login" className="font-bold text-white underline underline-offset-4">
                Go to sign in
              </Link>
            </>
          }
        >
          <CxButton rank="secondary" onNavy full onClick={() => navigate("/portal/login")}>
            Go to sign in
          </CxButton>
        </CxAuthShell>
      </>
    );
  }

  return (
    <>
      {seo}
      <CxAuthShell
        title="Set your password"
        intro="This unlocks your candidate profile."
        aside={
          <CxAuthAside
            eyebrow="Candidate portal"
            heading="Choose a password and the door stays yours."
            variant="points"
            items={[
              { title: "At least eight characters", body: "A short phrase is easier to remember and harder to guess." },
              { title: "No more waiting on email", body: "Sign in straight away next time at the portal." },
              { title: "Your profile follows you", body: "Every role you apply for uses the same record." },
            ]}
          />
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CxAuthField id="password" label="Password" hint="At least 8 characters.">
            <CxAuthPassword
              id="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={setPassword}
            />
          </CxAuthField>
          <CxAuthField id="confirm" label="Confirm password">
            <CxAuthPassword
              id="confirm"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
          </CxAuthField>
          {passwordError && <PasswordRequirements />}
          <CxButton type="submit" onNavy full disabled={isLoading}>
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving</> : "Save and continue"}
          </CxButton>
        </form>
      </CxAuthShell>
    </>
  );
};

export default PortalSetPassword;
