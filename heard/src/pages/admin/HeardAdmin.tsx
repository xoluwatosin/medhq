import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SEO from "@/components/SEO";
import HeardVolunteers from "./HeardVolunteers";

/**
 * Heard admin. Signing in here uses the same accounts as volunteers; only
 * people with a row in heard_admins see anything, and the database enforces
 * that independently of this page.
 */
const AdminSignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError("That email and password did not match.");
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-24 w-full max-w-sm space-y-4 px-4">
      <h1 className="text-2xl font-semibold">Heard admin</h1>
      <Input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in
      </Button>
    </form>
  );
};

const HeardAdmin = () => {
  const { user, isAdmin, loading, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Admin — Heard" description="Heard administration." path="/admin" breadcrumbs={[]} noindex />
      {loading ? (
        <div className="flex justify-center pt-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !user ? (
        <AdminSignIn />
      ) : !isAdmin ? (
        <div className="mx-auto mt-24 max-w-sm space-y-4 px-4 text-center">
          <p>This account does not have Heard admin access.</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={signOut}>Sign out</Button>
            <Button asChild variant="ghost"><Link to="/">Go to Heard</Link></Button>
          </div>
        </div>
      ) : (
        <>
          <header className="flex items-center justify-between border-b px-4 py-3 sm:px-8">
            <span className="font-semibold">Heard admin</span>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
              <Button size="sm" variant="outline" onClick={signOut}>Sign out</Button>
            </div>
          </header>
          <main className="px-4 py-6 sm:px-8">
            <HeardVolunteers />
          </main>
        </>
      )}
    </div>
  );
};

export default HeardAdmin;
