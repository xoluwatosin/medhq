import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileCheck2, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/brand/medicconnect-logo.svg";

type CareRecord = {
  grant_id: string;
  reference: string;
  scopes: { journey: boolean; clinical: boolean; finance: boolean };
};

const scopeSentence = (record: CareRecord) => {
  const names = [
    record.scopes.journey && "care journey",
    record.scopes.clinical && "care plan",
    record.scopes.finance && "invoices and payments",
  ].filter(Boolean);
  return names.length ? `Access to ${names.join(", ")}` : "No sections are currently available";
};

const CareHome = () => {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void supabase.functions.invoke("care-portal-accept", { body: { action: "home" } }).then(({ data, error: invokeError }) => {
      if (!live) return;
      setLoading(false);
      if (invokeError || data?.error) { setError(String(data?.error ?? "Could not open Care")); return; }
      setName(String(data?.person_name ?? ""));
      setRecords((data?.records ?? []) as CareRecord[]);
    });
    return () => { live = false; };
  }, []);

  return (
    <main className="min-h-dvh bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link to="/" aria-label="Medic Connect home"><img src={logo} alt="Medic Connect" className="h-9 w-auto" /></Link>
          <Button variant="ghost" size="sm" onClick={() => void supabase.auth.signOut()}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-semibold leading-none">{name ? `${name}'s care` : "Your care"}</h1>
            <CardDescription>Information available under your current Medic Connect access.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading Care" /></div>
            ) : error ? (
              <div className="rounded-xl border border-border bg-accent p-4">
                <p className="font-semibold text-foreground">Access unavailable</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            ) : records.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active care records are available.</p>
            ) : (
              <div className="space-y-3">
                {records.map((record) => (
                  <div key={record.grant_id} className="flex gap-3 rounded-xl border border-border bg-accent p-4">
                    <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">{record.reference}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{scopeSentence(record)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default CareHome;