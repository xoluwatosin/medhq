import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import KitPageHero from "@/components/kit/KitPageHero";
import { Stamp } from "@/components/mc/brand";
import { art } from "@/components/mc/art";
import { KitMain, KitPanel, kitInput, kitPrimaryButton } from "@/components/kit/KitLayout";
import SEO from "@/components/SEO";
import { toast } from "sonner";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (value: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("unsubscribe-email", { body: { email: value } });
      if (error) throw error;
      setDone(true);
      toast.success("You've been unsubscribed");
    } catch (err: any) {
      toast.error(err.message || "Could not unsubscribe. Please email hello@medicconnect.co");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) { toast.error("Please enter your email"); return; }
    submit(value);
  };

  // Auto-submit if email comes from link
  useEffect(() => {
    const auto = params.get("email");
    if (auto) submit(auto.toLowerCase().trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SEO title="Unsubscribe | Medic Connect" description="Manage your email preferences with Medic Connect." path="/unsubscribe" />
      <MedicHeader />
      <KitPageHero
        eyebrow="Email preferences"
        title={done ? "You are unsubscribed" : "Unsubscribe"}
        art={done ? art.objEnvelope : art.objEnvelopeHeart}
        artClassName="bottom-8 h-[100px] md:mb-16 md:h-[170px] lg:h-[200px]"
        lead={done
          ? `${email || "Your email"} will no longer get marketing emails from Medic Connect.`
          : "Stop marketing emails from Medic Connect. Messages about your own care, application or bookings still arrive."}
      />
      <KitMain className="flex-1">
        <div className="mx-auto max-w-[560px]">
          <KitPanel>
            {done ? (
              <div className="space-y-3">
                <Stamp title="UNSUBSCRIBED" sub="MARKETING EMAILS" className="mb-3" />
                <p className="text-[16px] leading-[1.7] text-body">
                  Messages about your own care, application or bookings, and replies to you, still arrive.
                </p>
                <p className="text-[16px] leading-[1.7] text-body">
                  Changed your mind? Email <a className="font-bold text-brand underline" href="mailto:hello@medicconnect.co">hello@medicconnect.co</a>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleUnsubscribe} className="space-y-5">
                <label htmlFor="email" className="block text-[15px] font-bold text-ink">
                  Your email address
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className={kitInput}
                  />
                </label>
                <button type="submit" className={`${kitPrimaryButton} w-full`} disabled={loading}>
                  {loading ? "Unsubscribing" : "Unsubscribe"}
                </button>
              </form>
            )}
          </KitPanel>
        </div>
      </KitMain>
      <Footer />
    </div>
  );
}
