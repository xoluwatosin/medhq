// The landing for a personal claim link. One button in the email, one question
// here: which of the four routes is you. We already know the email address, so
// nothing has to be typed twice.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { CxJoinShell, CxJoinAside } from "@/components/candidate/CxJoinShell";
import { CxCard, CxButton } from "@/components/candidate/primitives";
import { supabase } from "@/integrations/supabase/client";
import { JOIN_TRACKS } from "@/lib/join-tracks";

type State = "checking" | "ready" | "claimed" | "unknown";

const ClaimStart = () => {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [state, setState] = useState<State>(token ? "checking" : "unknown");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) return;
    let live = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke("claim-token", { body: { token } });
      if (!live) return;
      const payload = data as { ok?: boolean; email?: string; claimed?: boolean } | null;
      if (error || !payload?.ok || !payload.email) {
        setState("unknown");
        return;
      }
      setEmail(payload.email);
      setState(payload.claimed ? "claimed" : "ready");
    })();
    return () => {
      live = false;
    };
  }, [token]);

  const seo = (
    <SEO
      title="Claim your Medic Connect profile"
      description="Create your Medic Connect candidate profile and let the right work find you."
      path="/claim"
      noindex
    />
  );

  const aside = (
    <CxJoinAside
      eyebrow="Your invitation"
      heading="You are on our list. Make it a profile."
      lede="We already have your email. Choose the route that describes your work and the rest takes a couple of minutes."
    />
  );

  if (state === "checking") {
    return (
      <>
        {seo}
        <div className="cx flex min-h-dvh items-center justify-center bg-desk">
          <Loader2 className="h-6 w-6 animate-spin text-brand" aria-label="Checking your link" />
        </div>
      </>
    );
  }

  return (
    <>
      {seo}
      <CxJoinShell
        title={state === "ready" ? "Which of these is you?" : "Let us get you to the right place"}
        eyebrow={state === "ready" ? "Claim your profile" : "Start here"}
        aside={aside}
        headerAction={
          <Link
            to="/portal/login"
            className="text-[14px] font-bold text-white underline-offset-4 hover:underline md:text-brand"
          >
            Sign in
          </Link>
        }
      >
        {state === "ready" && (
          <p className="max-w-[60ch] text-[16px] leading-[1.75] text-body">
            This link belongs to <span className="font-bold text-ink">{email}</span>. Pick the route that fits
            your work and we will ask only the questions that apply to you.
          </p>
        )}

        {state === "claimed" && (
          <CxCard kind="quiet" className="p-5 md:p-7">
            <h2 className="text-[19px] font-bold text-ink">You have already started</h2>
            <p className="mt-2 text-[15.5px] leading-[1.7] text-body">
              There is a profile here under {email}. Sign in to open it, and everything we already hold is
              waiting for you.
            </p>
            <div className="mt-5">
              <CxButton asChild>
                <Link to="/portal/login">Sign in to your profile</Link>
              </CxButton>
            </div>
          </CxCard>
        )}

        {state === "unknown" && (
          <p className="max-w-[60ch] text-[16px] leading-[1.75] text-body">
            We could not read that link, which usually means it was cut short by an email app. Pick your route
            below and create your profile in the normal way.
          </p>
        )}

        {state !== "claimed" && (
          <div className="grid gap-3 md:grid-cols-2">
            {JOIN_TRACKS.map((track) => (
              <Link
                key={track.slug}
                to={`/join/${track.slug}/account${token ? `?t=${encodeURIComponent(token)}` : ""}`}
                className="cx-card group flex flex-col justify-between gap-4 border border-line bg-white p-5 transition-colors hover:border-navy md:p-6"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[18px] font-bold text-ink">{track.label}</h2>
                    <span className="cx-pill inline-flex shrink-0 items-center gap-1 bg-tint px-2.5 py-1 text-[12px] font-extrabold text-navy">
                      <Clock className="h-3 w-3" />
                      {track.minutes} min
                    </span>
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed text-body">{track.blurb}</p>
                  <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{track.examples}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-[15px] font-bold text-brand">
                  This is me
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </CxJoinShell>
    </>
  );
};

export default ClaimStart;
