// The boundary between Talent and Workforce for the same sign-in. The
// Workforce workspace itself is the next build; this states honestly where
// somebody stands rather than showing them candidate screens.
import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CxAuthShell } from "@/components/candidate/CxAuthShell";
import { usePortalMode } from "@/hooks/usePortalMode";

const WorkforceMode = () => {
  const { mode, loading } = usePortalMode();

  if (loading) {
    return (
      <CxAuthShell title="Workforce">
        <p className="text-[15px] text-white/80">Loading</p>
      </CxAuthShell>
    );
  }
  if (!mode || mode.mode === "none") return <Navigate to="/portal/login" replace />;
  if (mode.mode !== "workforce") return <Navigate to="/portal" replace />;

  return (
    <CxAuthShell
      title="You are on the Medic Connect Workforce"
      intro="Your sign-in and your record are the same as before. The Workforce workspace is being built next."
    >
      <Helmet>
        <title>Workforce | Medic Connect</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      {mode.assessor ? (
        <p className="text-[15px] text-white/90">
          You hold the Clinical Assessor capability.{" "}
          <Link className="font-bold text-white underline" to="/assessor">Open your assessment visits</Link>
        </p>
      ) : (
        <p className="text-[15px] text-white/90">
          Nothing is needed from you here today.
        </p>
      )}
    </CxAuthShell>
  );
};

export default WorkforceMode;
