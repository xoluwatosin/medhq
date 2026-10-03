import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import SEO from "@/components/SEO";

type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

const oauth = (): OAuthNs => (supabase.auth as any).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message);
          return;
        }
        // Only auto-redirect when the server has nothing for the user to decide
        // on: no client identity of any shape means it already granted/denied.
        const hasClientInfo = Boolean(
          data?.client ?? data?.client_name ?? data?.client_id ?? data?.scope ?? data?.scopes,
        );
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !hasClientInfo) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        if (active) setError(e?.message ?? "Failed to load authorization details");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = approve
        ? await oauth().approveAuthorization(authorizationId)
        : await oauth().denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("No redirect returned by the authorization server.");
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Failed to complete authorization");
    }
  }

  if (error) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-serif font-bold">Authorization error</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  const clientName = details.client?.name ?? details.client_name ?? "an external app";
  const redirectUri = details.client?.redirect_uri ?? details.redirect_uri;

  return (
    <main className="min-h-dvh flex items-center justify-center bg-background px-4">
      <SEO title="Authorize | Medic Connect" description="Authorize access to your Medic Connect account." path="/.lovable/oauth/consent" noindex />
      <div className="w-full max-w-md space-y-6 rounded-3xl border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-serif font-bold">Connect {clientName} to Medic Connect</h1>
          <p className="text-sm text-muted-foreground">
            {clientName} will be able to use the Medic Connect tools while you are signed in.
          </p>
        </div>
        <div className="rounded-2xl bg-muted/50 p-4 text-sm space-y-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Client</div>
            <div className="font-medium">{clientName}</div>
          </div>
          {redirectUri && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Redirect</div>
              <div className="font-mono text-xs break-all">{redirectUri}</div>
            </div>
          )}
          <p className="text-xs text-muted-foreground pt-2">
            This does not bypass Medic Connect's permissions or backend policies. Tools run under your own admin access.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Approve
          </Button>
        </div>
      </div>
    </main>
  );
};

export default OAuthConsent;
