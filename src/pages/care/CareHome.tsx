// The family's home in Care. It leads with the journey: where the care has
// got to, what is done and what comes next. Under it, the parts the care
// team has shared, and how to reach a coordinator. Access is decided by the
// care team, section by section, so the page says plainly what is shared.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, LockKeyhole, LogOut, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { art } from "@/components/mc/art";
import { ClipArt, EmergencyBox, NotchTag } from "@/components/mc/brand";
import { WHATSAPP_NUMBER } from "@/components/request/care-kinds";
import {
  FamilyCard, FamilyHeading, FamilyLoading, FamilyNote, FamilySection, FamilyShell, FamilyText,
  familyOnNavy, familyPrimary, familySecondary,
} from "@/components/care/FamilyShell";
import { cn } from "@/lib/utils";

type CareRecord = {
  grant_id: string;
  client_id?: string;
  reference: string;
  display_name?: string | null;
  stage?: string | null;
  scopes: { journey: boolean; clinical: boolean; finance: boolean };
};

// The family's five steps. Each holds the care team's working stages, so the
// family sees one plain step while the team moves through its own detail.
const JOURNEY: { title: string; now: string; stages: string[] }[] = [
  {
    title: "Request received",
    now: "A care coordinator has your request and will be in touch, usually the same working day.",
    stages: ["enquiry", "callback_due"],
  },
  {
    title: "A few questions",
    now: "Some questions about the person and their day, so we arrive knowing them.",
    stages: ["awaiting_pre_assessment", "pre_assessment_sent", "pre_assessment_received", "responses_returned"],
  },
  {
    title: "Care needs",
    now: "We visit to understand the care needed. A paid assessment may be required.",
    stages: ["assessment_booked", "assessment_in_progress", "assessment_complete", "clinical_review"],
  },
  {
    title: "Your plan",
    now: "We write a proposal for you to read and agree, and choose a carer for the plan and the person.",
    stages: ["care_plan_preparation", "plan_preparation", "care_setup", "plan_issued"],
  },
  {
    title: "Care begins",
    now: "Care runs on the days you agreed. Your coordinator stays with you throughout.",
    stages: ["care_running"],
  },
];

const stepOf = (stage: string) => JOURNEY.findIndex((step) => step.stages.includes(stage));

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

const Journey = ({ stage }: { stage: string }) => {
  if (stage === "paused" || stage === "closed") {
    return (
      <FamilyNote title={stage === "paused" ? "Care is paused" : "This care has ended"}>
        {stage === "paused"
          ? "Your coordinator will talk to you before anything starts again."
          : "If you need care again, message us and we will pick it up from here."}
      </FamilyNote>
    );
  }
  const at = Math.max(0, stepOf(stage));
  return (
    <div>
      <ol className="flex flex-col gap-1.5 sm:flex-row sm:gap-0" aria-label="Where the care has got to">
        {/* On a phone, two or more finished steps fold into one, so the
            current step stays near the top. */}
        {at > 1 && (
          <li className="mc-step-first flex min-h-[48px] items-center gap-2 bg-navy py-2 pl-4 pr-6 text-[14px] font-extrabold text-white sm:hidden">
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> {at} steps done
          </li>
        )}
        {JOURNEY.map((step, i) => {
          const done = i < at;
          const now = i === at;
          return (
            <li
              key={step.title}
              aria-current={now ? "step" : undefined}
              className={cn(
                "min-h-[54px] flex-col justify-center py-2 pr-6 sm:flex sm:min-w-0 sm:flex-1",
                done && at > 1 ? "hidden" : "flex",
                i === 0 ? "mc-step-first pl-4" : "mc-step pl-4 sm:-ml-1.5 sm:pl-6",
                done ? "bg-navy text-white" : now ? "bg-brand text-white" : "bg-tint text-navy",
              )}
            >
              <span className="flex items-center gap-2 text-[14px] font-extrabold leading-tight sm:text-[13px] lg:text-[14px]">
                {done && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                <span>{step.title}</span>
              </span>
              <span className="sr-only">{done ? ", done" : now ? ", now" : ", to come"}</span>
              {now && <span className="mt-1 text-[13px] leading-snug text-white/90 sm:hidden">{step.now}</span>}
            </li>
          );
        })}
      </ol>
      <div className="mt-4 hidden items-start gap-3 sm:flex">
        <NotchTag tone="blue" size="sm">Now</NotchTag>
        <p className="text-[15.5px] leading-[1.55] text-body">{JOURNEY[at].now}</p>
      </div>
    </div>
  );
};

/** One part of the record: open, shared elsewhere, or not shared. */
const Part = ({
  src, title, open, to, sharedNote,
}: { src: string; title: string; open: boolean; to?: string; sharedNote?: string }) => {
  const inner = (
    <>
      <ClipArt src={src} size={84} className={open ? undefined : "opacity-45 grayscale"} />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[17px] font-extrabold leading-tight tracking-[-0.02em]", open ? "text-navy" : "text-label")}>
          {title}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[14px] text-body">
          {!open ? (
            <><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Not shared with you</>
          ) : to ? (
            <span className="inline-flex items-center gap-1.5 font-extrabold text-brand">Open <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
          ) : (
            sharedNote
          )}
        </span>
      </span>
    </>
  );
  const box = "flex items-center gap-4 p-4";
  if (open && to) {
    return (
      <Link
        to={to}
        className={cn(box, "border-2 border-navy bg-card shadow-offset-sm transition-all duration-150 hover:bg-tint active:translate-x-[2px] active:translate-y-[2px] active:shadow-none")}
      >
        {inner}
      </Link>
    );
  }
  return <div className={cn(box, open ? "border-2 border-navy bg-card" : "border-2 border-dashed border-tint-deep")}>{inner}</div>;
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
      if (invokeError || data?.error) { setError(String(data?.error ?? "We could not open your care record.")); return; }
      setName(String(data?.person_name ?? ""));
      setRecords((data?.records ?? []) as CareRecord[]);
    });
    return () => { live = false; };
  }, []);

  const first = firstName(name);

  const help = !loading && !error ? (
    <FamilySection label="Need something?">
      <FamilyNote title="Your coordinator is a message away" art={art.coordinatorPhone}>
        Message us on WhatsApp or call, and we will answer as soon as we can.
        <span className="mt-4 flex flex-col gap-2.5 sm:flex-row lg:flex-col">
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className={familyPrimary}>
            Message on WhatsApp
          </a>
          <a href={`tel:+${WHATSAPP_NUMBER}`} className={familySecondary}>
            <Phone className="h-4 w-4" aria-hidden="true" /> Call us
          </a>
        </span>
      </FamilyNote>
      <EmergencyBox className="mt-5" />
    </FamilySection>
  ) : undefined;

  return (
    <FamilyShell
      eyebrow="Your care"
      title={first ? `Welcome, ${first}` : "Your care"}
      accent={[1]}
      lead="Where the care has got to, and what comes next. The care team will tell you when something new is ready."
      art={art.charCaregiver}
      path="/care"
      aside={help}
      action={
        <button type="button" className={familyOnNavy} onClick={() => void supabase.auth.signOut()}>
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
        </button>
      }
    >
      {loading ? (
        <FamilyCard><FamilyLoading label="Opening your care record" /></FamilyCard>
      ) : error ? (
        <FamilyCard>
          <FamilyHeading>We could not open your care record</FamilyHeading>
          <FamilyText className="mt-2">{error}</FamilyText>
          <Link to="/contact" className={`${familySecondary} mt-5`}>Contact Medic Connect</Link>
        </FamilyCard>
      ) : records.length === 0 ? (
        <FamilyCard>
          <FamilyHeading>Nothing to show yet</FamilyHeading>
          <FamilyText className="mt-2">
            Your account is set up, but no care record is open to you at the moment. The care team will let you know
            when it is.
          </FamilyText>
        </FamilyCard>
      ) : (
        records.map((record) => (
          <FamilyCard key={record.grant_id}>
            <span className="inline-flex"><NotchTag tone="tint" size="sm">{record.reference}</NotchTag></span>
            <FamilyHeading className="mt-3">
              {record.display_name ? `Care for ${record.display_name}` : "Your care record"}
            </FamilyHeading>
            <div className="mt-5">
              {record.scopes.journey && record.stage ? (
                <Journey stage={record.stage} />
              ) : (
                <FamilyText>The care team has not shared progress with you. Ask your coordinator if you need it.</FamilyText>
              )}
            </div>
            <p className="eyebrow mt-7">What is shared with you</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Part
                src={art.objCarePlan}
                title="Proposed care plan"
                open={record.scopes.clinical}
                to={record.client_id ? `/care/proposal?client=${record.client_id}` : "/care/proposal"}
              />
              <Part
                src={art.objPriceTagNaira}
                title="Quotes and invoices"
                open={record.scopes.finance}
                sharedNote="Shared with you, sent by email"
              />
            </div>
          </FamilyCard>
        ))
      )}
    </FamilyShell>
  );
};

export default CareHome;
