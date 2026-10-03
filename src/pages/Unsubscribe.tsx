import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="min-h-dvh bg-background flex flex-col">
      <SEO title="Unsubscribe | Medic Connect" description="Manage your email preferences with Medic Connect." path="/unsubscribe" />
      <MedicHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-md w-full bg-card border rounded-3xl p-8 shadow-sm">
          {done ? (
            <div className="text-center space-y-3">
              <h1 className="font-serif text-2xl">You're unsubscribed</h1>
              <p className="text-muted-foreground text-sm">
                {email || "Your email"} will no longer receive campaigns from Medic Connect.
                Transactional messages (booking confirmations, replies) may still be sent.
              </p>
              <p className="text-xs text-muted-foreground pt-4">
                Changed your mind? Email <a className="underline" href="mailto:hello@medicconnect.co">hello@medicconnect.co</a>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleUnsubscribe} className="space-y-5">
              <div className="text-center space-y-2">
                <h1 className="font-serif text-2xl">Unsubscribe</h1>
                <p className="text-sm text-muted-foreground">
                  Enter your email to stop receiving marketing emails from Medic Connect.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Unsubscribing..." : "Unsubscribe"}
              </Button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
