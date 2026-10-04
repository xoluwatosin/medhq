import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import SEO from "@/components/SEO";
import { CxJoinShell, CxJoinAside } from "@/components/candidate/CxJoinShell";
import { TRACK_ART } from "@/components/candidate/track-art";
import { CxCard, CxButton, CxField, cxInputClass } from "@/components/candidate/primitives";
import { CxAuthPassword } from "@/components/candidate/CxAuthShell";
import { PasswordRequirements } from "@/components/candidate/PasswordRequirements";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { trackJoinApplication } from "@/lib/measurement";
import { trackBySlug, YEAR_OF_STUDY, JOIN_PENDING_KEY } from "@/lib/join-tracks";


const baseSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(50),
  lastName: z.string().trim().min(1, "Required").max(50),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(10, "Enter a valid WhatsApp number").max(15).regex(/^[0-9]+$/, "Numbers only"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

const studentSchema = z.object({
  institution: z.string().trim().min(2, "Required").max(120),
  courseOfStudy: z.string().trim().min(2, "Required").max(120),
  yearOfStudy: z.string().min(1, "Required"),
  expectedGraduation: z.string().trim().min(4, "Required").max(20),
});

const strengthOf = (pwd: string) => {
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;
  return score;
};

const CxPasswordStrength = ({ password }: { password: string }) => {
  const score = strengthOf(password);
  const labels = ["Too short", "Could be stronger", "Good", "Strong"];
  const tone = score === 0 ? "bg-line" : score === 1 ? "bg-warn-line" : score === 2 ? "bg-brand-soft" : "bg-navy";
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn("h-1.5 flex-1 rounded-full", i < score ? tone : "bg-line")}
          />
        ))}
      </div>
      <span className="text-[12px] font-bold text-muted-foreground">{labels[score]}</span>
    </div>
  );
};

const JoinAccount = () => {
  const { route: slug } = useParams();
  const track = trackBySlug(slug);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const claimToken = params.get("t") ?? "";

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "",
    institution: "", courseOfStudy: "", yearOfStudy: "", expectedGraduation: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [onFile, setOnFile] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [invited, setInvited] = useState(false);

  // A personal claim link already tells us the address, so it is filled in and
  // held: typing a different one would quietly split the person into two.
  useEffect(() => {
    if (!claimToken || !track) return;
    let live = true;
    (async () => {
      const { data } = await supabase.functions.invoke("claim-token", {
        body: { token: claimToken, track: track.id },
      });
      const payload = data as { ok?: boolean; email?: string } | null;
      if (!live || !payload?.ok || !payload.email) return;
      setForm((p) => ({ ...p, email: payload.email as string }));
      setInvited(true);
    })();
    return () => { live = false; };
  }, [claimToken, track]);

  if (!track) return <Navigate to="/join" replace />;
  const isStudent = track.id === "student";

  const set = (k: string, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: "" }));
  };


  const emailMeALink = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("candidate-claim", {
      body: { email: form.email.trim().toLowerCase(), next: "/portal", reason: "complete your profile" },
    });
    setSubmitting(false);
    const failure = error?.message || (data as any)?.error;
    if (failure) { toast.error(failure); return; }
    setLinkSent(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors: Record<string, string> = {};
    const base = baseSchema.safeParse(form);
    if (!base.success) base.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] ||= i.message; });
    if (isStudent) {
      const st = studentSchema.safeParse(form);
      if (!st.success) st.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] ||= i.message; });
    }
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return; }

    setSubmitting(true);
    const email = form.email.trim().toLowerCase();
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const phone = `+234${form.phone.trim()}`;

    const payload = {
      p_full_name: fullName,
      p_phone: phone,
      p_track: track.id,
      p_institution: isStudent ? form.institution.trim() : null,
      p_course_of_study: isStudent ? form.courseOfStudy.trim() : null,
      p_year_of_study: isStudent ? form.yearOfStudy : null,
      p_expected_graduation: isStudent ? form.expectedGraduation.trim() : null,
    };

    const { data, error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/portal`,
        data: { display_name: fullName },
      },
    });

    if (error) {
      setSubmitting(false);
      const msg = error.message || "";
      const code = (error as any).code || "";
      const already = /already|registered|exists/i.test(msg) || code === "user_already_exists";
      // Passwords are checked against known breached-password lists. A password
      // can look strong here and still be rejected, so say exactly that.
      const breached = /pwned|compromis|breach|data leak/i.test(msg);
      const tooWeak = code === "weak_password" || /weak|at least .* characters|should contain/i.test(msg);
      const rateLimited = code === "over_email_send_rate_limit" || error.status === 429 || /rate limit|for security purposes/i.test(msg);
      const badEmail = code === "email_address_invalid" || /invalid.*email|email.*invalid/i.test(msg);

      let reason = "unknown";
      if (already) { reason = "already_registered"; setOnFile(true); }
      else if (breached) {
        reason = "breached_password";
        setErrors((p) => ({ ...p, password: "This password has appeared in a known data breach. Please choose a different one." }));
        toast.error("Please choose a different password. This one has appeared in a known data breach.");
      } else if (tooWeak) {
        reason = "weak_password";
        setErrors((p) => ({ ...p, password: "This password does not meet the requirements below. Please lengthen it or add a capital letter, a number or a symbol." }));
        toast.error("Please strengthen your password.");
      } else if (rateLimited) {
        reason = "rate_limited";
        setErrors((p) => ({ ...p, email: "Too many attempts from this address. Please wait a minute and try once more." }));
        toast.error("Too many attempts. Please wait a minute and try once more.");
      } else if (badEmail) {
        reason = "invalid_email";
        setErrors((p) => ({ ...p, email: "This email address was not accepted. Please check it and try again." }));
        toast.error("Please check your email address.");
      } else {
        setErrors((p) => ({ ...p, password: "We could not create your account. Please check your password meets the requirements below." }));
        toast.error("We could not create your account. Please check your details and try again.");
      }

      // Record the real cause so anyone stuck at this step can be found and
      // helped, rather than being lost behind a general message.
      if (reason !== "already_registered") {
        void (supabase as any).from("signup_failures").insert({
          email,
          reason,
          detail: msg.slice(0, 300),
          track: track.id,
        });
      }
      return;
    }

    try { localStorage.setItem(JOIN_PENDING_KEY, JSON.stringify(payload)); } catch { /* private mode */ }

    if (claimToken) {
      await supabase.functions.invoke("claim-token", {
        body: { token: claimToken, action: "claim", track: track.id },
      });
    }


    if (!data.session) {
      setSubmitting(false);
      navigate("/portal/verify", { replace: true });
      return;
    }

    const { error: rpcError } = await supabase.rpc("mu_self_register" as any, payload as any);
    setSubmitting(false);
    if (rpcError) {
      toast.error("Your account was created but we could not start your profile. Please sign in and try again.");
      navigate("/portal");
      return;
    }
    try { localStorage.removeItem(JOIN_PENDING_KEY); } catch { /* ignore */ }
    trackJoinApplication(track.id);
    navigate("/portal/verify", { replace: true });
  };

  const seo = (
    <SEO
      title={`Create your ${track.label.toLowerCase()} profile | Medic Connect`}
      description={`Create a Medic Connect candidate profile as a ${track.label.toLowerCase()} and join our pool of vetted talent.`}
      path={`/join/${track.slug}/account`}
      noindex
    />
  );

  const aside = (
    <CxJoinAside
      eyebrow={track.label}
      heading={invited ? "You are on our list. Make it a profile." : "One profile, and the work comes to you."}
      lede={`Typical for ${track.examples.toLowerCase()}. About ${track.minutes} minutes.`}
      items={track.steps.map((s) => ({ title: s }))}
      art={TRACK_ART[track.slug]}
    />
  );

  const mobileLead = (
    <section className="relative overflow-hidden bg-navy px-[18px] pb-7 pt-3 text-body-navy">
      <div className="relative z-10">
        <p className="cx-eyebrow text-muted-navy">{track.label}</p>
        <h1 className="cx-heading mt-3 max-w-[16ch] text-[27px] text-white">Create your account</h1>
        <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-body-navy">
          Start with your details. You can add documents and work preferences after you sign in.
        </p>
        <div className="mt-5 flex items-center gap-3 border-t border-hairline-navy pt-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-white text-[13px] font-extrabold text-navy shadow-[3px_3px_0_hsl(var(--brand))]">1</span>
          <div>
            <p className="text-[14.5px] font-bold text-white">Account details</p>
            <p className="text-[13px] text-muted-navy">Documents and availability come next.</p>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <>
      {seo}
      <CxJoinShell
        title="Create your account"
        eyebrow={track.label}
        back="/join"
        step={0}
        aside={aside}
        mobileLead={mobileLead}
        className="pb-28 pt-6 md:pb-[34px] md:pt-[34px]"
        headerAction={
          <Link
            to="/portal/login"
            className="text-[14px] font-bold text-white underline-offset-4 hover:underline md:text-brand"
          >
            Sign in
          </Link>
        }
      >
        <div className="flex items-center justify-between gap-3 border-b border-line pb-4 md:flex-wrap md:justify-start md:border-0 md:pb-0">
          <span className="cx-pill bg-tint px-3 py-1.5 text-[12.5px] font-extrabold text-navy">
            {track.label}
          </span>
          <Link
            to={claimToken ? `/claim?t=${encodeURIComponent(claimToken)}` : "/join"}
            className="text-[14px] font-bold text-brand underline-offset-4 hover:underline"
          >
            Change route
          </Link>
        </div>

        <div className="grid gap-6">
          <CxCard kind="quiet" className="cx-flat-sm border-0 bg-transparent p-0 md:border md:bg-white md:p-8">

            {onFile ? (
              <div className="space-y-4">
                <CheckCircle2 className="h-8 w-8 text-brand" aria-hidden="true" />
                <h3 className="text-[20px] font-bold text-ink">We already have you on file</h3>
                <p className="text-[16px] leading-[1.7] text-body">
                  {linkSent
                    ? `A link is on its way to ${form.email.trim().toLowerCase()}. Open it and your profile is there, with everything we already hold.`
                    : "There is a profile here under this email, so there is nothing to fill in twice. Sign in to open it, or we can email you a link to set a password."}
                </p>
                {!linkSent && (
                  <div className="flex flex-wrap gap-3">
                    <CxButton asChild>
                      <Link to="/portal/login">Sign in</Link>
                    </CxButton>
                    <button
                      type="button"
                      onClick={emailMeALink}
                      disabled={submitting}
                      className="text-[15px] font-bold text-brand underline underline-offset-4 disabled:opacity-60"
                    >
                      {submitting ? "Sending…" : "Email me a link instead"}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setOnFile(false); setLinkSent(false); }}
                  className="block text-[14px] text-body underline underline-offset-4"
                >
                  That is not my email, take me back
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-6">
                <div className="hidden md:block">
                  <h2 className="cx-heading text-[20px] text-ink">Your account details</h2>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-body">Use an email and WhatsApp number you can open now.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <CxField label="First name" helper={errors.firstName}>
                    <Input
                      value={form.firstName}
                      maxLength={50}
                      onChange={(e) => set("firstName", e.target.value)}
                      className={cxInputClass()}
                    />
                  </CxField>
                  <CxField label="Last name" helper={errors.lastName}>
                    <Input
                      value={form.lastName}
                      maxLength={50}
                      onChange={(e) => set("lastName", e.target.value)}
                      className={cxInputClass()}
                    />
                  </CxField>
                </div>

                <CxField
                  label="Email"
                  helper={invited ? "This is the address we invited. Sign in instead if it is wrong." : errors.email}
                >
                  <Input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    maxLength={255}
                    readOnly={invited}
                    onChange={(e) => set("email", e.target.value)}
                    className={cn(cxInputClass(), invited && "bg-desk text-ink2")}
                  />

                </CxField>

                <CxField label="WhatsApp number" helper={errors.phone}>
                  <div className="flex gap-2">
                    <span className="cx-chip inline-flex items-center border border-line bg-desk px-3 text-[15px] font-bold text-ink2">
                      +234
                    </span>
                    <Input
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      maxLength={15}
                      placeholder="812 698 8237"
                      onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
                      className={cn(cxInputClass(), "flex-1")}
                    />
                  </div>
                </CxField>

                <CxField label="Create a password" helper={errors.password}>
                  <CxAuthPassword
                    id="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(v) => set("password", v)}
                    minLength={8}
                    onNavy={false}
                  />
                  <CxPasswordStrength password={form.password} />
                  {errors.password && <PasswordRequirements className="mt-3" />}
                </CxField>

                {isStudent && (
                  <div className="space-y-5 border-t border-line-soft pt-5">
                    <h3 className="text-[17px] font-bold text-ink">Your studies</h3>
                    <CxField label="Institution" helper={errors.institution}>
                      <Input
                        value={form.institution}
                        maxLength={120}
                        placeholder="e.g. University of Lagos"
                        onChange={(e) => set("institution", e.target.value)}
                        className={cxInputClass()}
                      />
                    </CxField>
                    <CxField label="Course" helper={errors.courseOfStudy}>
                      <Input
                        value={form.courseOfStudy}
                        maxLength={120}
                        placeholder="e.g. BNSc Nursing"
                        onChange={(e) => set("courseOfStudy", e.target.value)}
                        className={cxInputClass()}
                      />
                    </CxField>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CxField label="Year of study" helper={errors.yearOfStudy}>
                        <Select value={form.yearOfStudy} onValueChange={(v) => set("yearOfStudy", v)}>
                          <SelectTrigger className={cxInputClass()}><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {YEAR_OF_STUDY.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </CxField>
                      <CxField label="Expected graduation" helper={errors.expectedGraduation}>
                        <Input
                          type="month"
                          value={form.expectedGraduation}
                          onChange={(e) => set("expectedGraduation", e.target.value)}
                          className={cxInputClass()}
                        />
                      </CxField>
                    </div>
                  </div>
                )}

                <div className="hidden md:block lg:hidden">
                  <CxCard kind="quiet" className="border border-line-tint bg-tint p-4">
                    <div className="flex items-start gap-3">
                      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                      <p className="text-[14px] leading-relaxed text-ink2">
                        This takes about {track.minutes} minutes. A person on our team reads every profile.
                        We only put you forward once your documents are accepted.
                      </p>
                    </div>
                  </CxCard>
                </div>

                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-[18px] pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:static md:border-0 md:bg-transparent md:p-0">
                  <CxButton type="submit" full disabled={submitting}>
                    {submitting ? "Creating your account" : "Create my account"}
                  </CxButton>
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground md:hidden">
                    <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
                    Your details are kept private.
                  </p>
                </div>

                <p className="text-[14px] leading-[1.6] text-body">
                  Already started?{" "}
                  <Link to="/portal/login" className="font-bold text-brand underline-offset-4 hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            )}
          </CxCard>

          
        </div>
      </CxJoinShell>
    </>
  );
};

export default JoinAccount;
