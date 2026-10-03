// What the assessor is expected at, and when.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { Status } from "@/components/field";
import { AssessorShell } from "@/components/assessor/AssessorRoute";
import { Button } from "@/components/ui/button";
import {
  assessmentStatusLabel, assessmentStatusTone, locationLabel, myAssessments,
  type AssessmentWork,
} from "@/lib/care-assessment";

const AssessorHome = () => {
  const [rows, setRows] = useState<AssessmentWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) { setSignedIn(false); setLoading(false); return; }
      try { setRows(await myAssessments()); } catch { /* nothing to show */ }
      setLoading(false);
    })();
  }, []);

  return (
    <AssessorShell className="px-4 pb-10 pt-10">
      <Helmet>
        <title>Your assessment visits | Medic Connect</title>
        <meta name="description" content="The assessment visits assigned to you, with the record for each one." />
      </Helmet>
      <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Your assessment visits</h1>

      {!signedIn ? (
        <p className="mt-6 text-[15px] text-muted-foreground">
          Sign in to see the visits assigned to you.{" "}
          <Link className="underline" to="/portal/login">Sign in</Link>
        </p>
      ) : loading ? (
        <p className="mt-6 text-[15px] text-muted-foreground">Loading your visits</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-[15px] text-muted-foreground">No visits assigned to you.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line-soft border border-line">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">
                  {row.appointment_at ? formatDateTime(row.appointment_at) : "No time set"}
                </p>
                <p className="text-[13.5px] text-muted-foreground">{locationLabel(row.location_kind)}</p>
              </div>
              <Status label={assessmentStatusLabel(row.status)} tone={assessmentStatusTone(row.status)} />
              <Button asChild size="sm" className="h-9">
                <Link to={`/assessor/${row.id}`}>Open</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </AssessorShell>
  );
};

export default AssessorHome;
