import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const schema = z.string().trim().email("Please enter a valid email").max(255);

export const HeardWaitlistForm = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(email);
    if (!parsed.success) {
      toast({ title: "Check your email", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("heard-submit", {
        body: { kind: "phone_waitlist", email: parsed.data, source: "heard_landing" },
      });
      if (error || (data && (data as { error?: string }).error)) {
        throw error ?? new Error((data as { error?: string }).error);
      }

      supabase.functions.invoke("send-heard-signup", {
        body: { kind: "waitlist", data: { email: parsed.data } },
      }).catch((e) => console.error("heard waitlist email:", e));


      setDone(true);
    } catch (err) {
      console.error(err);
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <p className="text-[color:var(--heard-ink)] text-[15px]">
        Thanks, we'll keep you posted.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="flex-1 rounded-full border border-[color:var(--heard-line)] bg-white px-5 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[color:var(--heard-accent)]/40 focus:border-[color:var(--heard-accent)]"
      />
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-full bg-[color:var(--heard-ink)] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[color:var(--heard-accent-ink)] transition-colors disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Keep me posted"}
      </button>
    </form>
  );
};
