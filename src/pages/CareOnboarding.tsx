import { useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import CareIntakeFlow from "@/components/care/CareIntakeSteps";
import { FormPage } from "@/components/request/FormSurface";
import { CareIntake, emptyIntake, mergeIntakeSeed } from "@/lib/care-intake";
import { supabase } from "@/integrations/supabase/client";

const CareOnboarding = () => {
  const { token = "" } = useParams();
  const [intake, setIntake] = useState<CareIntake>(emptyIntake());
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A link that cannot be opened is final. A failed submission is not: the
  // answers stay on screen so nothing has to be typed again.
  const [linkBlocked, setLinkBlocked] = useState(false);
  const [preAssessmentToken, setPreAssessmentToken] = useState<string | null>(null);
  // The stage last reached, so reopening the link resumes there rather than
  // returning to the first screen.
  const [startStage, setStartStage] = useState(1);
  const stage = useRef(1);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.functions.invoke("care-onboarding-form", { body: { action: "load", token } }).then(({ data, error: invokeError }) => {
      if (cancelled) return;
      if (invokeError || !data?.ok) {
        setError(data?.error ?? "This link is not valid. Ask Medic Connect for a new one.");
        setLinkBlocked(true);
      } else if (data.pre_assessment_token) {
        // The details stage is already done: carry straight on.
        setPreAssessmentToken(data.pre_assessment_token as string);
      } else if (data.completed) {
        setError("This link has already been completed. Ask Medic Connect if you need another link.");
        setLinkBlocked(true);
      }
      else {
        setIntake(mergeIntakeSeed(data.intake, undefined));
        const saved = Number(data.position);
        if (Number.isInteger(saved) && saved >= 1) { setStartStage(saved); stage.current = saved; }
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [token]);

  const save = (next: CareIntake) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void supabase.functions.invoke("care-onboarding-form", {
        body: { action: "save", token, intake: next, position: stage.current },
      });
    }, 500);
  };

  const update = (next: CareIntake) => {
    setIntake(next);
    save(next);
  };

  const onStage = (next: number) => {
    if (next === stage.current) return;
    stage.current = next;
    save(intake);
  };

  const complete = async () => {
    setFinishing(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke("care-onboarding-form", {
      body: { action: "complete", token, intake: { ...intake, confirmed: true } },
    });
    if (invokeError || !data?.ok || !data.pre_assessment_token) {
      setError(data?.error ?? "These details could not be saved. Please try again.");
      setFinishing(false);
      return;
    }
    setPreAssessmentToken(data.pre_assessment_token);
  };

  if (preAssessmentToken) return <Navigate to={`/pre-assessment/${preAssessmentToken}`} replace />;
  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-card"><Loader2 className="h-6 w-6 animate-spin text-navy" aria-label="Loading" /></div>;
  if (linkBlocked) return (
    <FormPage eyebrow="Care details" title="This link cannot be opened">
      <div className="mx-auto w-full max-w-xl py-10">
        <h1 className="text-xl font-bold text-ink">This link cannot be opened</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-body">{error}</p>
      </div>
    </FormPage>
  );

  return <>
    <SEO title="Care details | Medic Connect" description="Provide care recipient details before the pre-assessment." path={`/care/start/${token}`} noindex />
    {error && <p role="alert" className="fixed inset-x-4 top-[max(76px,env(safe-area-inset-top))] z-50 mx-auto max-w-xl rounded-lg border border-warn-line bg-warn-wash px-4 py-3 text-sm text-warn-ink">{error}</p>}
    <CareIntakeFlow
      intake={intake}
      onChange={update}
      startStage={startStage}
      onStage={onStage}
      onComplete={() => { if (!finishing) void complete(); }}
    />
  </>;
};

export default CareOnboarding;
