// The boundary between Talent and Workforce for the same sign-in. Field carers
// with the care_worker capability see their visits and the care they are
// assigned to; earnings are a later build. Everyone else in the Workforce sees
// where they stand rather than candidate screens.
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CxAuthShell } from "@/components/candidate/CxAuthShell";
import { usePortalMode } from "@/hooks/usePortalMode";
import { myCareAssignments, type CareWorkerAssignment } from "@/lib/lifecycle";
import { MyVisits } from "@/components/workforce/MyVisits";

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const serviceLabel = (code: string | null) =>
  code ? code.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Care";

const CareAssignments = () => {
  const [items, setItems] = useState<CareWorkerAssignment[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    myCareAssignments()
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  if (failed) return <p className="text-[15px] text-white/90">Your care could not be loaded. Try again shortly.</p>;
  if (!items) return <p className="text-[15px] text-white/80">Loading your care</p>;
  if (items.length === 0) {
    return <p className="text-[15px] text-white/90">You are not assigned to any care yet. Your coordinator will be in touch.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[15px] font-bold text-white">Care you are assigned to</p>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="bg-white/10 px-4 py-3 text-[15px] text-white">
            <p className="font-bold">{serviceLabel(a.service_code)}</p>
            <p className="text-white/80">
              {a.status === "active" ? "Started" : "Starts"} {dateLabel(a.effective_from)}
              {a.effective_to ? `, until ${dateLabel(a.effective_to)}` : ""}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-[14px] text-white/80">Your earnings will appear here later.</p>
    </div>
  );
};

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
      intro={mode.care_worker
        ? "Your sign-in and your record are the same as before."
        : "Your sign-in and your record are the same as before. The Workforce workspace is being built next."}
    >
      <Helmet>
        <title>Workforce | Medic Connect</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="space-y-5">
        {mode.care_worker && <MyVisits />}
        {mode.care_worker && <CareAssignments />}
        {mode.assessor && (
          <p className="text-[15px] text-white/90">
            You hold the Clinical Assessor capability.{" "}
            <Link className="font-bold text-white underline" to="/assessor">Open your assessment visits</Link>
          </p>
        )}
        {!mode.care_worker && !mode.assessor && (
          <p className="text-[15px] text-white/90">
            Nothing is needed from you here today.
          </p>
        )}
      </div>
    </CxAuthShell>
  );
};

export default WorkforceMode;
