import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { Loader2 } from "lucide-react";
import { CxAuthShell, CxAuthAside, CxAuthField, CxAuthPassword } from "@/components/candidate/CxAuthShell";
import { PasswordRequirements } from "@/components/candidate/PasswordRequirements";
import { CxButton } from "@/components/candidate/primitives";

type LinkStatus = "checking" | "valid" | "invalid";

const SetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
  const [passwordError, setPasswordError] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasToken = hashParams.get("access_token") || hashParams.get("type");
    if (hashParams.get("type") === "recovery") {
      setIsRecovery(true);
    }

    if (!hasToken) {
      setLinkStatus("invalid");
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setLinkStatus("valid");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") setLinkStatus("valid");
    });

    const timeout = setTimeout(() => {
      setLinkStatus((prev) => (prev === "checking" ? "invalid" : prev));
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(false);
    if (password.length < 8) {
      setPasswordError(true);
      toast({ title: "Password too short", description: "Use at least eight characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Those two passwords do not match", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      setPasswordError(true);
      const breached = /weak|easy to guess|pwned|compromis/i.test(error.message);
      toast({
        title: breached ? "Please choose a different password" : "Could not set your password",
        description: breached
          ? "This password has appeared in a known data breach. Pick one you have not used elsewhere."
          : "Please check the requirements below and try again.",
        variant: "destructive",
      });
    } else {
      await supabase.auth.signOut();
      toast({ title: "Password set. Sign in to continue." });
      navigate("/auth");
    }
  };

  const seo = (
    <SEO
      title="Set your password | Medic Connect"
      description="Set your Medic Connect staff password."
      path="/set-password"
      noindex
    />
  );

  if (linkStatus === "checking") {
    return (
      <>
        {seo}
        <CxAuthShell title="Checking your link" intro="One moment while we confirm this invite is still good.">
          <div className="flex items-center gap-3 text-[15px] text-body-navy">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying
          </div>
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
            <CxAuthAside variant="statement" />

          }
          title="This link has expired"
          intro="Invite and reset links can only be used once, and they run out after a short while. Ask your administrator to send a fresh one."
          footer={
            <>
              Need help? Email{" "}
              <a href="mailto:hello@medicconnect.co" className="font-bold text-white underline underline-offset-4">
                hello@medicconnect.co
              </a>
            </>
          }
        >
          <CxButton onNavy full onClick={() => navigate("/auth")}>
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
        aside={
          <CxAuthAside variant="statement" />

        }
        title={isRecovery ? "Choose a new password" : "Set your password"}
        intro={
          isRecovery
            ? "Pick something you have not used elsewhere. You will sign in again straight after."
            : "This is the password you will use with your staff email from now on."
        }
        footer={
          <>
            Already sorted?{" "}
            <a href="/auth" className="font-bold text-white underline underline-offset-4">
              Go to sign in
            </a>
          </>
        }
      >
        <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
          <CxAuthField id="password" label="New password" hint="At least eight characters.">
            <CxAuthPassword
              id="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={setPassword}
            />
          </CxAuthField>
          <CxAuthField id="confirmPassword" label="Confirm password">
            <CxAuthPassword
              id="confirmPassword"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
          </CxAuthField>
          {passwordError && <PasswordRequirements />}
          <CxButton type="submit" onNavy full disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              "Save password"
            )}
          </CxButton>
        </form>
      </CxAuthShell>
    </>
  );
};

export default SetPassword;
