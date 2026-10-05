// Every candidate screen sits in the same frame: navy rail on desktop, navy
// header and four tabs on a phone, one heading, one measure of copy.
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { CxShell, type CxNavItem } from "@/components/candidate/CxShell";
import { CxButton } from "@/components/candidate/primitives";
import { TRACK_ART_BY_ID } from "@/components/candidate/track-art";
import logo from "@/assets/logo.png";

export const CxPortalPage = ({
  loading,
  person,
  title,
  eyebrow,
  intro,
  back,
  headerAction,
  footer,
  nav,
  children,
}: {
  loading: boolean;
  person: any;
  title: string;
  eyebrow?: string;
  intro?: string;
  back?: string;
  headerAction?: ReactNode;
  footer?: ReactNode;
  nav?: CxNavItem[];
  children: ReactNode;
}) => {
  const navigate = useNavigate();
  const signOut = () => supabase.auth.signOut().then(() => navigate("/portal/login"));

  if (loading) {
    return (
      <div className="cx cx-portal flex min-h-dvh items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-navy" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="cx cx-portal flex min-h-dvh items-center justify-center bg-white px-5">
        <div className="cx-card max-w-md border border-line bg-white p-7">
          <img loading="lazy" decoding="async" src={logo} alt="Medic Connect" className="h-9 w-9" />
          <h1 className="cx-heading mt-4 text-[22px] text-ink">We could not find your profile</h1>
          <p className="mt-2 cx-measure text-[15px] leading-relaxed text-body">
            This account is not linked to a candidate profile yet. Email hello@medicconnect.co and we
            will sort it out.
          </p>
          <CxButton rank="secondary" className="mt-5" onClick={signOut}>Sign out</CxButton>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title={`${title} | Medic Connect`} description="Your Medic Connect candidate profile." path="/portal" noindex />
      <CxShell
        title={title}
        eyebrow={eyebrow}
        back={back}
        nav={nav}
        headerAction={headerAction}
        footer={footer}
        profile={{
          name: person.full_name || "Your profile",
          role: person.profession || undefined,
          art: TRACK_ART_BY_ID[person.track],
          verified: person.verification_state === "verified",
        }}
      >
        {intro && (
          <p className="hidden cx-measure text-[17px] leading-[1.6] text-body md:-mt-2 md:block">{intro}</p>
        )}
        {children}
      </CxShell>
    </>
  );
};

export default CxPortalPage;
