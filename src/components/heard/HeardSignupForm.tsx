import { useState } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { STATES_AND_LGAS } from "@/lib/nigeria-locations";
import { useHeardPath } from "@/components/heard/HeardBase";

const NIGERIAN_STATES = Object.keys(STATES_AND_LGAS).sort();

const schema = z.object({
  firstName: z.string().trim().min(1, "First name required").max(100),
  lastName: z.string().trim().min(1, "Last name required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  state: z.string().min(1, "Choose your state"),
  role: z.enum(["peer_listener", "social_media", "professional"], {
    errorMap: () => ({ message: "Pick a role" }),
  }),
  motivation: z.string().trim().min(1, "Tell us in one line").max(500),
  timeCommitment: z.string().min(1, "How much time can you give?"),
});

type FormState = z.infer<typeof schema>;

const ROLES: { value: FormState["role"]; label: string }[] = [
  { value: "peer_listener", label: "Peer Listener" },
  { value: "social_media", label: "Social Media Volunteer" },
  { value: "professional", label: "I'm a mental health professional" },
];

const TIMES = [
  "2 – 4 hours a week",
  "5 – 8 hours a week",
  "More than 8 hours a week",
];

const inputBase =
  "w-full rounded-xl border border-[color:var(--heard-line)] bg-white px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[color:var(--heard-accent)]/40 focus:border-[color:var(--heard-accent)]";

export const HeardSignupForm = () => {
  const [form, setForm] = useState<Partial<FormState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const heardPath = useHeardPath();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const iss of parsed.error.issues) {
        if (iss.path[0]) fieldErrors[iss.path[0].toString()] = iss.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("heard-submit", {
        body: {
          kind: "volunteer_interest",
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          email: parsed.data.email,
          state: parsed.data.state,
          role: parsed.data.role,
          motivation: parsed.data.motivation,
          timeCommitment: parsed.data.timeCommitment,
        },
      });
      if (error || (result && (result as { error?: string }).error)) {
        throw error ?? new Error((result as { error?: string }).error);
      }


      supabase.functions
        .invoke("send-heard-signup", {
          body: {
            kind: "volunteer",
            data: {
              firstName: parsed.data.firstName,
              lastName: parsed.data.lastName,
              email: parsed.data.email,
              state: parsed.data.state,
              role: ROLES.find((r) => r.value === parsed.data.role)?.label ?? parsed.data.role,
              motivation: parsed.data.motivation,
              timeCommitment: parsed.data.timeCommitment,
            },
          },
        })
        .catch((e) => console.error("heard email:", e));

      navigate(heardPath("/thanks"));
    } catch (err) {
      console.error(err);
      toast({
        title: "Something went wrong",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="First name" error={errors.firstName}>
          <input className={inputBase} value={form.firstName ?? ""} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <input className={inputBase} value={form.lastName ?? ""} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
      </div>

      <Field label="Email" error={errors.email}>
        <input type="email" className={inputBase} value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
      </Field>

      <Field label="Which state are you in?" error={errors.state} hint="Based abroad? Select 'Outside Nigeria', some roles work from anywhere.">
        <select className={inputBase} value={form.state ?? ""} onChange={(e) => set("state", e.target.value)}>
          <option value="">Select your state</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          <option value="Outside Nigeria">Outside Nigeria</option>
        </select>
      </Field>

      <Field label="Which role are you drawn to?" error={errors.role}>
        <div className="grid gap-2">
          {ROLES.map((r) => (
            <label
              key={r.value}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                form.role === r.value
                  ? "border-[color:var(--heard-accent)] bg-[color:var(--heard-accent)]/5"
                  : "border-[color:var(--heard-line)] bg-white hover:border-[color:var(--heard-ink-soft)]"
              }`}
            >
              <input
                type="radio"
                name="role"
                className="accent-[color:var(--heard-accent)]"
                checked={form.role === r.value}
                onChange={() => set("role", r.value)}
              />
              <span className="text-[15px]">{r.label}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="One line on why you want to do this" error={errors.motivation}>
        <textarea rows={3} className={inputBase} value={form.motivation ?? ""} onChange={(e) => set("motivation", e.target.value)} />
      </Field>

      <Field label="Roughly how much time can you give?" error={errors.timeCommitment}>
        <select className={inputBase} value={form.timeCommitment ?? ""} onChange={(e) => set("timeCommitment", e.target.value)}>
          <option value="">Select an option</option>
          {TIMES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 inline-flex items-center justify-center rounded-full bg-[color:var(--heard-ink)] px-8 py-4 text-[15px] font-semibold text-white hover:bg-[color:var(--heard-accent-ink)] transition-colors disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Sign up to volunteer"}
      </button>

      <p className="text-xs text-[color:var(--heard-muted)] mt-1">
        We'll only use your details to talk to you about volunteering with Heard. We won't share them with anyone.{" "}
        <a href="/privacy" className="heard-plain underline">Privacy</a>
      </p>
    </form>
  );
};

const Field = ({
  label, error, hint, children,
}: { label: string; error?: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-sm font-semibold text-[color:var(--heard-ink)] mb-2">{label}</label>
    {children}
    {hint && !error && <p className="text-xs text-[color:var(--heard-muted)] mt-1.5">{hint}</p>}
    {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
  </div>
);
