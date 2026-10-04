import { FormEvent, ReactNode, SelectHTMLAttributes, useEffect, useId, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useHeardPath } from "@/components/heard/HeardBase";
import HeardPage from "@/components/heard/v2/HeardLayout";
import { HeardButton, HeardCheckbox, HeardNotice, HeardTextArea, HeardTextField } from "@/components/heard/v2/HeardKit";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ALL_LANGUAGES } from "@/lib/languages";
import {
  countriesSorted, IsoCountry, IsoSubdivision, loadGeo, nationalFromE164, nigerianLgas,
  subdivisionsOf, suggestTimezone, timezoneLabel, toE164,
} from "@/lib/geo-iso";
import {
  bootstrapVolunteer, HEARD_APPLICATION_STATUS, HEARD_ROLE_LABELS, Proficiency, PROFICIENCY_LABELS,
  takePendingVolunteer, type PendingVolunteer,
  saveVolunteerProfile, SpokenLanguage, VolunteerApplication, VolunteerProfile,
} from "@/lib/heard-portal";

const SECTIONS = [
  { id: "details", label: "My details" },
  { id: "application", label: "Application" },
  { id: "interview", label: "Interview" },
  { id: "documents", label: "Documents" },
  { id: "training", label: "Training" },
  { id: "account", label: "Account settings" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const ROLE_OPTIONS = [
  { value: "peer_listener", label: "Peer Listener", text: "Listen to people who call Heard." },
  { value: "social_media_volunteer", label: "Social Media Volunteer", text: "Help us find us and build the community around Heard." },
  { value: "professional", label: "Counsellor, psychologist or clinician", text: "Listen, supervise, support or help with referrals." },
] as const;

const HeardSelect = ({ label, help, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; help?: string; error?: string; children: ReactNode }) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="hv-label">{label}</label>
      <select {...props} id={id} className="hv-input" aria-invalid={error ? true : undefined} aria-describedby={[help && `${id}-h`, error && `${id}-e`].filter(Boolean).join(" ") || undefined}>{children}</select>
      {help && <span id={`${id}-h`} className="hv-help">{help}</span>}
      {error && <span id={`${id}-e`} className="hv-error" role="alert">{error}</span>}
    </div>
  );
};

const Placeholder = ({ title, text }: { title: string; text: string }) => (
  <section aria-labelledby="hv-section-title" className="flex flex-col gap-3">
    <h2 id="hv-section-title" className="text-[clamp(24px,4vw,30px)]">{title}</h2>
    <p className="m-0 text-[color:var(--hv-violet)]">{text}</p>
  </section>
);

type Errors = Record<string, string>;

const DetailsForm = ({ profile, onSaved }: { profile: VolunteerProfile; onSaved: (p: VolunteerProfile) => void }) => {
  const [geo, setGeo] = useState<Awaited<ReturnType<typeof loadGeo>> | null>(null);
  const [f, setF] = useState(() => ({
    first_name: profile.first_name, last_name: profile.last_name, preferred_name: profile.preferred_name ?? "",
    country_code: profile.country_code ?? "NG", subdivision_code: profile.subdivision_code ?? "",
    lga: profile.lga ?? "", city: profile.city ?? "", timezone: profile.timezone ?? "",
    national: "", adjustments: profile.adjustments ?? "", privately: profile.adjustments_discuss_privately,
  }));
  const [languages, setLanguages] = useState<SpokenLanguage[]>(Array.isArray(profile.languages) ? profile.languages : []);
  const [adding, setAdding] = useState("");
  const [other, setOther] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"" | "saving" | "saved" | "failed">("");
  const set = (patch: Partial<typeof f>) => { setF((p) => ({ ...p, ...patch })); setStatus(""); };

  useEffect(() => { loadGeo().then(setGeo); }, []);
  const countries = useMemo<IsoCountry[]>(() => (geo ? countriesSorted(geo) : []), [geo]);
  const country = countries.find((c) => c.code === f.country_code);
  const subdivisions = useMemo<IsoSubdivision[]>(() => (geo ? subdivisionsOf(geo, f.country_code) : []), [geo, f.country_code]);
  const subdivision = subdivisions.find((s) => s.code === f.subdivision_code);
  const lgas = f.country_code === "NG" && subdivision ? nigerianLgas(subdivision.name, subdivision.code) : [];

  // Hydrate the national number and time zone once the dataset is ready.
  useEffect(() => {
    if (!country) return;
    setF((p) => ({
      ...p,
      national: p.national || nationalFromE164(profile.phone, country.dial),
      timezone: p.timezone || suggestTimezone(country),
    }));
  }, [country, profile.phone]);

  const changeCountry = (code: string) => {
    const next = countries.find((c) => c.code === code);
    set({ country_code: code, subdivision_code: "", lga: "", timezone: suggestTimezone(next) });
  };

  const zones = country?.timezones.length ? country.timezones : [Intl.DateTimeFormat().resolvedOptions().timeZone];
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const addLanguage = (name: string) => {
    const clean = name.trim().slice(0, 80);
    if (!clean || languages.some((l) => l.language.toLowerCase() === clean.toLowerCase())) return;
    setLanguages((p) => [...p, { language: clean, proficiency: "fluent" }]);
    setAdding(""); setOther(""); setStatus("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!f.first_name.trim()) next.first_name = "Enter your first name.";
    if (!f.last_name.trim()) next.last_name = "Enter your last name.";
    if (!country) next.country = "Select your country of residence.";
    if (!subdivision) next.subdivision = "Select your state or region.";
    const phone = country ? toE164(country.dial, f.national, country.code) : null;
    if (!phone) next.phone = "Enter a valid phone number for the selected country.";
    if (!f.timezone) next.timezone = "Select your time zone.";
    if (!languages.length) next.languages = "Add at least one language.";
    setErrors(next);
    if (Object.keys(next).length) { setStatus(""); return; }
    setStatus("saving");
    try {
      const saved = await saveVolunteerProfile({
        first_name: f.first_name, last_name: f.last_name, preferred_name: f.preferred_name,
        phone, country_code: f.country_code, subdivision_code: subdivision!.code, subdivision_name: subdivision!.name,
        lga: f.lga, city: f.city, timezone: f.timezone, languages,
        adjustments: f.adjustments, adjustments_discuss_privately: f.privately,
      });
      onSaved(saved);
      setStatus("saved");
    } catch { setStatus("failed"); }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" aria-labelledby="hv-section-title">
      <h2 id="hv-section-title" className="text-[clamp(24px,4vw,30px)]">My details</h2>
      <p className="hv-role-summary"><span>Selected role</span><strong>{HEARD_ROLE_LABELS[profile.role_interest] ?? profile.role_interest}</strong></p>
      <p className="hv-help -mt-3">Changing role affects your questions and review. Contact us if you need to change it.</p>

      <div className="grid gap-6 sm:grid-cols-2">
        <HeardTextField label="First name" autoComplete="given-name" maxLength={100} value={f.first_name} onChange={(e) => set({ first_name: e.target.value })} error={errors.first_name} />
        <HeardTextField label="Last name" autoComplete="family-name" maxLength={100} value={f.last_name} onChange={(e) => set({ last_name: e.target.value })} error={errors.last_name} />
      </div>
      <HeardTextField label="Preferred name (optional)" maxLength={100} value={f.preferred_name} onChange={(e) => set({ preferred_name: e.target.value })} />
      <HeardTextField label="Email" type="email" value={profile.email ?? ""} readOnly help="To change your email, go to Account settings." />

      {!geo ? <p className="hv-help" role="status">Loading locations…</p> : (
        <>
          <HeardSelect label="Country of residence" value={f.country_code} onChange={(e) => changeCountry(e.target.value)} error={errors.country} autoComplete="country">
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </HeardSelect>
          <HeardSelect label="State or region" value={f.subdivision_code} onChange={(e) => set({ subdivision_code: e.target.value, lga: "" })} error={errors.subdivision}>
            <option value="">Select</option>
            {subdivisions.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </HeardSelect>
          {f.country_code === "NG" && (
            <HeardSelect label="LGA (optional)" value={f.lga} disabled={!lgas.length} onChange={(e) => set({ lga: e.target.value })}>
              <option value="">{lgas.length ? "Select" : "Select a state first"}</option>
              {lgas.map((l) => <option key={l} value={l}>{l}</option>)}
            </HeardSelect>
          )}
          <HeardTextField label="City or town (optional)" autoComplete="address-level2" maxLength={120} value={f.city} onChange={(e) => set({ city: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hv-phone" className="hv-label">Phone number</label>
            <div className="flex items-stretch">
              <span className="hv-input !w-auto shrink-0 border-r-0 font-bold" aria-hidden="true">+{country?.dial}</span>
              <input id="hv-phone" className="hv-input min-w-0 flex-1" type="tel" inputMode="tel" autoComplete="tel-national"
                value={f.national} onChange={(e) => set({ national: e.target.value })}
                aria-invalid={errors.phone ? true : undefined} aria-describedby="hv-phone-help hv-phone-error" />
            </div>
            <span id="hv-phone-help" className="hv-help">Dial code +{country?.dial} is set by your country.</span>
            {errors.phone && <span id="hv-phone-error" className="hv-error" role="alert">{errors.phone}</span>}
          </div>
          <HeardSelect label="Time zone" value={f.timezone} onChange={(e) => set({ timezone: e.target.value })} error={errors.timezone}
            help={zones.includes(deviceZone) || f.timezone === deviceZone ? undefined : `Your device reports ${timezoneLabel(deviceZone)}.`}>
            {[...new Set([...zones, f.timezone].filter(Boolean))].map((z) => <option key={z} value={z}>{timezoneLabel(z)}</option>)}
            {!zones.includes(deviceZone) && <option value={deviceZone}>{timezoneLabel(deviceZone)} (device)</option>}
          </HeardSelect>
        </>
      )}

      <fieldset className="flex flex-col gap-3 border-0 p-0 m-0">
        <legend className="hv-label mb-1.5">Languages spoken</legend>
        {languages.map((l, i) => (
          <div key={l.language} className="flex flex-wrap items-center gap-3">
            <span className="min-w-[8rem] font-bold text-[color:var(--hv-late)]">{l.language}</span>
            <select aria-label={`Proficiency in ${l.language}`} className="hv-input !w-auto" value={l.proficiency}
              onChange={(e) => { const v = e.target.value as Proficiency; setLanguages((p) => p.map((x, j) => (j === i ? { ...x, proficiency: v } : x))); setStatus(""); }}>
              {Object.entries(PROFICIENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="button" className="hv-textlink" onClick={() => { setLanguages((p) => p.filter((_, j) => j !== i)); setStatus(""); }}>Remove<span className="sr-only"> {l.language}</span></button>
          </div>
        ))}
        <select aria-label="Add a language" className="hv-input" value={adding}
          onChange={(e) => { const v = e.target.value; if (v === "__other") setAdding(v); else addLanguage(v); }}>
          <option value="">Add a language</option>
          {ALL_LANGUAGES.filter((n) => !languages.some((l) => l.language === n)).map((n) => <option key={n} value={n}>{n}</option>)}
          <option value="__other">Other</option>
        </select>
        {adding === "__other" && (
          <div className="flex flex-wrap items-end gap-3">
            <HeardTextField label="Language name" maxLength={80} value={other} onChange={(e) => setOther(e.target.value)} className="flex-1" />
            <HeardButton type="button" tone="alt" onClick={() => addLanguage(other)}>Add language</HeardButton>
          </div>
        )}
        {errors.languages && <span className="hv-error" role="alert">{errors.languages}</span>}
      </fieldset>

      <HeardTextArea label="Accessibility or participation adjustments (optional)" rows={4} maxLength={2000} value={f.adjustments} onChange={(e) => set({ adjustments: e.target.value })} />
      <HeardCheckbox checked={f.privately} onChange={(v) => set({ privately: v })}>I'd prefer to discuss this privately</HeardCheckbox>

      <div aria-live="polite">
        {status === "saved" && <HeardNotice title="Changes saved." />}
        {status === "failed" && <HeardNotice tone="problem" title="Could not save changes. Check your details and try again." />}
        {Object.keys(errors).length > 0 && <HeardNotice tone="problem" title="Check the highlighted details." />}
      </div>
      <div className="hv-form-actions"><HeardButton type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save changes"}</HeardButton></div>
    </form>
  );
};

const AccountSettings = ({ email, onSignOut }: { email: string; onSignOut: () => void }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[\d\W]/.test(password)) { setPwMsg({ ok: false, text: "Use at least 8 characters with upper and lower case letters and a number or symbol." }); return; }
    if (password !== confirm) { setPwMsg({ ok: false, text: "Passwords do not match." }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    setPwMsg(error ? { ok: false, text: /pwned|breach|compromis/i.test(error.message) ? "This password has appeared in a known data breach. Choose a different one." : "Could not change password." } : { ok: true, text: "Password changed." });
    if (!error) { setPassword(""); setConfirm(""); }
  };

  const changeEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) { setEmailMsg({ ok: false, text: "Enter a valid email address." }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim().toLowerCase() }, { emailRedirectTo: window.location.href });
    setBusy(false);
    setEmailMsg(error ? { ok: false, text: "Could not start the email change." } : { ok: true, text: "Check your new email to confirm the change." });
  };

  return (
    <section aria-labelledby="hv-section-title" className="flex flex-col gap-8">
      <h2 id="hv-section-title" className="text-[clamp(24px,4vw,30px)]">Account settings</h2>
      <form onSubmit={changeEmail} noValidate className="flex flex-col gap-4">
        <h3 className="text-[20px]">Email</h3>
        <p className="m-0">Current email: <strong className="break-all">{email}</strong></p>
        <HeardTextField label="New email" type="email" autoComplete="email" maxLength={255} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        {emailMsg && <HeardNotice tone={emailMsg.ok ? "confirmed" : "problem"} title={emailMsg.text} />}
        <div className="hv-form-actions"><HeardButton type="submit" tone="alt" disabled={busy}>Change email</HeardButton></div>
      </form>
      <form onSubmit={changePassword} noValidate className="flex flex-col gap-4">
        <h3 className="text-[20px]">Password</h3>
        <HeardTextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <HeardTextField label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {pwMsg && <HeardNotice tone={pwMsg.ok ? "confirmed" : "problem"} title={pwMsg.text} />}
        <div className="hv-form-actions"><HeardButton type="submit" tone="alt" disabled={busy}>Change password</HeardButton></div>
      </form>
      <div className="hv-form-actions"><HeardButton type="button" tone="pill" onClick={onSignOut}>Sign out</HeardButton></div>
    </section>
  );
};

const HeardVolunteerPortal = () => {
  const heardPath = useHeardPath();
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [application, setApplication] = useState<VolunteerApplication | null>(null);
  const [problem, setProblem] = useState("");
  const [section, setSection] = useState<SectionId>("details");
  const [needsRole, setNeedsRole] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = (pending?: PendingVolunteer | null) => {
    setProblem("");
    return bootstrapVolunteer(pending)
      .then((r) => { setNeedsRole(false); setProfile(r.profile); setApplication(r.application); })
      .catch((e: { message?: string }) => {
        const m = e.message ?? "";
        if (/role_selection_required/.test(m)) { setNeedsRole(true); return; }
        setProblem(/email_not_verified/.test(m) ? "Verify your email to continue." : "Could not load your volunteer profile.");
      });
  };

  useEffect(() => {
    if (loading || !user) return;
    load(takePendingVolunteer());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  const chooseRole = async (role: string) => { setStarting(true); await load({ role }); setStarting(false); };

  if (!loading && !user) return <Navigate to={heardPath("/volunteer/sign-in")} replace />;
  const out = async () => { await signOut(); navigate(heardPath("/"), { replace: true }); };
  const name = profile?.preferred_name || profile?.first_name;

  return (
    <HeardPage path="/volunteer/portal" title="Your volunteer profile — Heard" description="Your Heard volunteer profile." width="wide">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8">
        {problem && <HeardNotice tone="problem" title={problem} />}
        {needsRole && !profile && (
          <section className="flex flex-col gap-8" aria-labelledby="hv-role-pick">
            <header className="flex flex-col gap-4">
              <span className="hv-index">Choose a role</span>
              <h1 id="hv-role-pick">Which role are you drawn to?</h1>
            </header>
            <div className="grid gap-px border border-[color:var(--hv-late)] bg-[color:var(--hv-late)]" role="radiogroup" aria-label="Volunteer role">
              {ROLE_OPTIONS.map((option) => (
                <button key={option.value} type="button" role="radio" aria-checked={false} disabled={starting}
                  className="hv-role-option text-left" onClick={() => chooseRole(option.value)}>
                  <span className="hv-role-dot" aria-hidden="true" />
                  <span><strong>{option.label}</strong><small>{option.text}</small></span>
                </button>
              ))}
            </div>
          </section>
        )}
        {!profile && !problem && !needsRole && <p role="status" className="hv-help">Loading your profile…</p>}
        {profile && (
          <>
            <header className="flex flex-col gap-4">
              <span className="hv-index">Apply to volunteer</span>
              <h1>Welcome, {name}.</h1>
              <div className="flex flex-wrap gap-3">
                <p className="hv-role-summary m-0"><span>Role</span><strong>{HEARD_ROLE_LABELS[profile.role_interest] ?? profile.role_interest}</strong></p>
                <p className="hv-role-summary m-0"><span>Status</span><strong>{HEARD_APPLICATION_STATUS[application?.status ?? "application_started"]}</strong></p>
              </div>
              <p className="m-0 max-w-[60ch]">Welcome to HEARD. Your interest in volunteering is registered. You can update your details below. We'll let you know when the next step is ready.</p>
            </header>

            <nav aria-label="Volunteer profile sections">
              <label htmlFor="hv-section" className="sr-only">Section</label>
              <select id="hv-section" className="hv-input sm:hidden" value={section} onChange={(e) => setSection(e.target.value as SectionId)}>
                {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <ul className="m-0 hidden list-none flex-wrap gap-2 p-0 sm:flex">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <button type="button" aria-current={section === s.id ? "page" : undefined} onClick={() => setSection(s.id)}
                      className={`hv-btn ${section === s.id ? "hv-btn-primary" : "hv-btn-pill"}`}>{s.label}</button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t border-[color:var(--hv-late)] pt-8">
              {section === "details" && <DetailsForm profile={profile} onSaved={setProfile} />}
              {section === "application" && <Placeholder title="Application" text="The next part of your application will be available here. We'll let you know when it's ready." />}
              {section === "interview" && <Placeholder title="Interview" text="No interview scheduled." />}
              {section === "documents" && <Placeholder title="Documents" text="There are no document requests at the moment." />}
              {section === "training" && <Placeholder title="Training" text="If you're selected, your training will appear here." />}
              {section === "account" && <AccountSettings email={user?.email ?? profile.email ?? ""} onSignOut={out} />}
            </div>
          </>
        )}
      </div>
    </HeardPage>
  );
};

export default HeardVolunteerPortal;
