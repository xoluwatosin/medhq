import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useHeardPath } from "@/components/heard/HeardBase";
import HeardPage from "@/components/heard/v2/HeardLayout";
import { HeardButton, HeardCheckbox, HeardNotice, HeardSplitPanel, HeardTextField } from "@/components/heard/v2/HeardKit";
import { supabase } from "@/integrations/supabase/client";
import { setPendingVolunteer, takePendingVolunteer } from "@/lib/heard-portal";

const ROLE_LABELS = {
  peer_listener: "Peer Listener",
  social_media_volunteer: "Social Media Volunteer",
  professional: "Counsellor, psychologist or clinician",
} as const;

type VolunteerRole = keyof typeof ROLE_LABELS;
type Errors = Record<string, string>;

const isRole = (value: string | null): value is VolunteerRole => Boolean(value && value in ROLE_LABELS);
const emailIsValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const AuthIntro = ({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) => (
  <header className="flex flex-col gap-4">
    <span className="hv-index">{eyebrow}</span>
    <h1>{title}</h1>
    {children}
  </header>
);

const authError = (message: string, status?: number) => {
  if (/already|registered|exists/i.test(message)) return "An account already exists for this email. Sign in instead.";
  if (/pwned|compromis|breach|data leak/i.test(message)) return "This password has appeared in a known data breach. Choose a different one.";
  if (/weak|at least .*characters|should contain/i.test(message)) return "Choose a stronger password with at least 8 characters.";
  if (status === 429 || /rate limit|security purposes/i.test(message)) return "Too many attempts. Wait a minute, then try again.";
  return "We could not complete that request. Check your details and try again.";
};

export const HeardCreateAccount = () => {
  const heardPath = useHeardPath();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialRole = isRole(params.get("role")) ? params.get("role") as VolunteerRole : null;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [problem, setProblem] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!initialRole) return <Navigate to={heardPath("/get-involved/choose-role")} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    if (!firstName.trim()) next.firstName = "Enter your first name.";
    if (!lastName.trim()) next.lastName = "Enter your last name.";
    if (!emailIsValid(email)) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Use at least 8 characters.";
    if (password !== confirmPassword) next.confirmPassword = "Passwords do not match.";
    if (!accepted) next.accepted = "Agree to the Terms and Privacy Notice to continue.";
    setErrors(next);
    setProblem("");
    if (Object.keys(next).length) return;

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${heardPath("/volunteer/portal")}`,
        data: {
          heard_first_name: firstName.trim(),
          heard_last_name: lastName.trim(),
          heard_role_interest: initialRole,
        },
      },
    });
    setSubmitting(false);
    const existing = (error && /already|registered|exists/i.test(error.message)) || (!error && data.user && (data.user.identities?.length ?? 0) === 0);
    if (existing) {
      setPendingVolunteer({ role: initialRole, firstName: firstName.trim(), lastName: lastName.trim() });
      navigate(`${heardPath("/volunteer/sign-in")}?email=${encodeURIComponent(email.trim().toLowerCase())}&existing=1`, { replace: true });
      return;
    }
    if (error) {
      setProblem(authError(error.message, error.status));
      return;
    }
    if (data.session) navigate(heardPath("/volunteer/portal"), { replace: true });
    else navigate(`${heardPath("/volunteer/verify-email")}?email=${encodeURIComponent(email.trim().toLowerCase())}`, { replace: true });
  };

  return (
    <HeardPage path="/volunteer/create-account" title="Create your volunteer account — Heard" description="Create your Heard volunteer account." width="wide">
      <div className="mx-auto w-full max-w-[980px]">
        <HeardSplitPanel
          eyebrow="Create account"
          title="Create your Heard volunteer account"
          aside={
            <>
              <p>Your account keeps your application in one place and gives you somewhere to come back to as you move through the process.</p>
              <p>You’ll use it to complete your questionnaire, save your progress, provide anything we need for your role and keep track of what happens next.</p>
              <p>You only need one account, even if you’re interested in more than one role.</p>
            </>
          }
        >
          <p className="hv-role-summary"><span>Selected role</span><strong>{ROLE_LABELS[initialRole]}</strong></p>
          {problem && <HeardNotice tone="problem" title={problem} />}
          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <HeardTextField label="First name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={errors.firstName} maxLength={100} />
              <HeardTextField label="Last name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} error={errors.lastName} maxLength={100} />
            </div>
            <HeardTextField label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} maxLength={255} />
            <HeardTextField label="Create password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} help="Use at least 8 characters and a password you have not used elsewhere." error={errors.password} />
            <HeardTextField label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={errors.confirmPassword} />
            <HeardCheckbox checked={accepted} onChange={setAccepted} error={errors.accepted}>
              I agree to the <Link to={heardPath("/privacy")} className="underline underline-offset-4">Terms and Privacy Notice</Link>.
            </HeardCheckbox>
            <div className="hv-form-actions"><HeardButton type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</HeardButton></div>
          </form>
          <p className="m-0">Already have an account? <Link className="hv-textlink" to={heardPath("/volunteer/sign-in")}>Sign in</Link></p>
        </HeardSplitPanel>
      </div>
    </HeardPage>
  );
};

export const HeardVerifyEmail = () => {
  const heardPath = useHeardPath();
  const [params] = useSearchParams();
  const email = params.get("email") ?? "your email address";
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const resend = async () => {
    if (!emailIsValid(email)) return;
    setSending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}${heardPath("/volunteer/portal")}` } });
    setSending(false);
    setMessage(error ? authError(error.message, error.status) : "Verification email sent.");
  };
  return (
    <HeardPage path="/volunteer/verify-email" title="Check your email — Heard" description="Verify your email to continue your Heard volunteer application.">
      <div className="hv-auth-flow">
        <AuthIntro eyebrow="Verify email" title="Check your email.">
          <p>We’ve sent a verification link to:</p><p className="font-extrabold text-[color:var(--hv-late)] break-all">{email}</p><p>Verify your email to continue your application.</p>
        </AuthIntro>
        {message && <HeardNotice tone={message.includes("sent") ? "confirmed" : "problem"} title={message} />}
        <div className="hv-form-actions"><HeardButton type="button" onClick={resend} disabled={sending}>{sending ? "Sending…" : "Resend email"}</HeardButton><Link className="hv-textlink" to={heardPath("/volunteer/create-account")}>Use a different email</Link></div>
      </div>
    </HeardPage>
  );
};

export const HeardSignIn = () => {
  const heardPath = useHeardPath();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pending = params.get("existing") ? takePendingVolunteer() : null;
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setProblem("");
    if (!emailIsValid(email) || !password) { setProblem("Enter your email and password."); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setSubmitting(false);
    if (error) { setProblem("Email or password not recognised."); return; }
    navigate(heardPath("/volunteer/portal"), { replace: true });
  };
  return (
    <HeardPage path="/volunteer/sign-in" title="Sign in — Heard" description="Sign in to your Heard volunteer account." width="wide">
      <div className="mx-auto w-full max-w-[980px]">
        <HeardSplitPanel
          eyebrow="Sign in"
          title={pending ? "Continue your application." : "Welcome back."}
          aside={<p>Sign in to pick your application up where you left it.</p>}
        >
          {pending && <HeardNotice tone="confirmed" title={`You already have an account. Enter your password to continue your ${ROLE_LABELS[pending.role as VolunteerRole] ?? "volunteer"} application.`} />}
          {problem && <HeardNotice tone="problem" title={problem} />}
          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <HeardTextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <HeardTextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="hv-form-actions"><HeardButton type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</HeardButton><Link className="hv-textlink" to={heardPath("/volunteer/forgot-password")}>Forgot password?</Link></div>
          </form>
          <p className="m-0">New here? <Link className="hv-textlink" to={heardPath("/get-involved/choose-role")}>Start an application</Link></p>
        </HeardSplitPanel>
      </div>
    </HeardPage>
  );
};

export const HeardForgotPassword = () => {
  const heardPath = useHeardPath();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setProblem("");
    if (!emailIsValid(email)) { setProblem("Enter a valid email address."); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}${heardPath("/volunteer/reset-password")}` });
    setSubmitting(false);
    if (error) { setProblem(authError(error.message, error.status)); return; }
    setSent(true);
  };
  return (
    <HeardPage path="/volunteer/forgot-password" title="Reset your password — Heard" description="Reset your Heard volunteer account password.">
      <div className="hv-auth-flow">
        <AuthIntro eyebrow="Reset password" title={sent ? "Check your email." : "Reset your password."}>
          <p>{sent ? "We’ve sent you a password reset link." : "Enter the email you used for your account."}</p>
        </AuthIntro>
        {problem && <HeardNotice tone="problem" title={problem} />}
        {!sent && <form onSubmit={submit} noValidate className="flex flex-col gap-6"><HeardTextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /><div className="hv-form-actions"><HeardButton type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send reset link"}</HeardButton></div></form>}
      </div>
    </HeardPage>
  );
};

export const HeardResetPassword = () => {
  const heardPath = useHeardPath();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recoveryLink = hash.get("type") === "recovery" || new URLSearchParams(window.location.search).get("type") === "recovery";
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session && recoveryLink)));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setReady(true); });
    return () => subscription.unsubscribe();
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setProblem("");
    if (password.length < 8) { setProblem("Use at least 8 characters."); return; }
    if (password !== confirmPassword) { setProblem("Passwords do not match."); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) { setProblem(authError(error.message, error.status)); return; }
    navigate(heardPath("/volunteer/sign-in"), { replace: true });
  };
  return (
    <HeardPage path="/volunteer/reset-password" title="Choose a new password — Heard" description="Choose a new password for your Heard volunteer account.">
      <div className="hv-auth-flow"><AuthIntro eyebrow="Reset password" title="Choose a new password." />{problem && <HeardNotice tone="problem" title={problem} />}{ready ? <form onSubmit={submit} noValidate className="flex flex-col gap-6"><HeardTextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} help="Use at least 8 characters and a password you have not used elsewhere." /><HeardTextField label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /><div className="hv-form-actions"><HeardButton type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save password"}</HeardButton></div></form> : <HeardNotice tone="problem" title="This reset link is not valid."><Link className="hv-textlink" to={heardPath("/volunteer/forgot-password")}>Request another link</Link></HeardNotice>}</div>
    </HeardPage>
  );
};

/** Former verification landing page. Kept as a redirect for older email links. */
export const HeardVerified = () => {
  const heardPath = useHeardPath();
  return <Navigate to={heardPath("/volunteer/portal")} replace />;
};
