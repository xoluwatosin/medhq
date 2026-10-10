// The welcome pop-up.
//
// It used to ask for name, email and phone before a visitor knew whether we
// were right for them. Now it asks one thing: what brought you here. That
// answer is remembered, and it hands straight over to the Request care
// journey with the service already filled in.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { art } from "@/components/mc/art";

import {
  PriceLine, Question, RequestShell, ServiceTile, requestPrimary, requestQuiet, requestSecondary,
} from "@/components/request/RequestShell";
import CareRequestDialog from "@/components/CareRequestDialog";
import { CARE_KINDS, CareKind } from "@/components/request/care-kinds";
import { rememberInterest, readVisitor, visitorFirstName } from "@/lib/visitor";
import { trackServiceInterest } from "@/lib/measurement";

const STORAGE_SEEN = "mc_intake_seen_v1";

/** Where each line lives, for people who would rather read first. */
const LINE_ROUTES: Record<string, string> = {
  eldercare: "/eldercare",
  postnatal: "/postnatal-care",
  antenatal: "/antenatal-care",
  post_surgical: "/post-surgical-care",
  clinical_home_care: "/clinical-home-care",
  paediatric: "/pediatric-care",
  nanny_childcare: "/nanny-childcare",
  care_from_abroad: "/care-from-abroad",
};

/** The lines we lead with in the pop-up, in the order families ask for them. */
const FEATURED = ["eldercare", "postnatal", "post_surgical", "clinical_home_care", "nanny_childcare", "care_from_abroad"];

interface WelcomeIntakeProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const WelcomeIntake = ({ forceOpen = false, onClose }: WelcomeIntakeProps) => {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<CareKind | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const navigate = useNavigate();
  const visitor = readVisitor();
  const firstName = visitorFirstName(visitor);

  useEffect(() => {
    if (forceOpen) { setOpen(true); return; }
    if (localStorage.getItem(STORAGE_SEEN)) return;
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [forceOpen]);

  const close = () => {
    try { localStorage.setItem(STORAGE_SEEN, "1"); } catch { /* ignore */ }
    setOpen(false);
    onClose?.();
  };

  const choose = (kind: CareKind) => {
    setChosen(kind);
    rememberInterest(kind.line);
    trackServiceInterest(kind.line, "welcome_intake");
  };

  const featured = FEATURED.map((l) => CARE_KINDS.find((k) => k.line === l)!).filter(Boolean);

  return (
    <>
      <RequestShell
        open={open}
        onOpenChange={(next) => { if (!next) close(); }}
        eyebrow="Welcome to Medic Connect"
        title="What kind of care are you looking for?"
        art={art.coordinatorPhone}
      >
        {chosen ? (
          <Question heading={`${chosen.label}.`} help={chosen.blurb} stepKey="picked">
            <div className="flex items-center gap-4 border-2 border-navy bg-tint p-3 shadow-offset-sm">
              <span className="relative h-[92px] w-[96px] shrink-0 bg-card">
                <img src={chosen.art} alt="" className="absolute inset-x-0 bottom-0 mx-auto h-[86px] object-contain" />
              </span>
              <div className="min-w-0">
                <PriceLine price={chosen.price} />
                <p className="mt-1.5 text-[14px] leading-[1.5] text-body">
                  Before care begins, we may visit for a care needs assessment, so the plan is right from the first day. It costs <b className="text-ink">₦35,000</b>.
                </p>
              </div>
            </div>
            <p className="mt-4 text-[15px] leading-[1.55] text-body">
              Start your request now, it takes under a minute. Or read about it first and come back when you are ready.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className={`${requestPrimary} flex-1`}
                onClick={() => { setOpen(false); setRequestOpen(true); try { localStorage.setItem(STORAGE_SEEN, "1"); } catch { /* ignore */ } }}
              >
                Request care <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              {LINE_ROUTES[chosen.line] && (
                <button type="button" className={`${requestSecondary} flex-1`} onClick={() => { close(); navigate(LINE_ROUTES[chosen.line]); }}>
                  Read about it first
                </button>
              )}
            </div>
            <button type="button" className={`${requestQuiet} mt-2 w-full`} onClick={() => setChosen(null)}>
              Choose something else
            </button>
          </Question>
        ) : (
          <Question
            heading={firstName ? `Welcome back, ${firstName}. What are you looking for?` : "What kind of care are you looking for?"}
            help="Pick one and we will take you straight to it. No details needed yet."
            stepKey="pick"
          >
            <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
              {featured.map((k) => (
                <ServiceTile key={k.line} label={k.label} art={k.art} price={k.price} onClick={() => choose(k)} />
              ))}
            </div>
            <button type="button" className={`${requestQuiet} mt-3 w-full`} onClick={close}>
              I'm just exploring
            </button>
          </Question>
        )}
      </RequestShell>

      <CareRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        serviceLineKey={chosen?.line}
        source="welcome_intake"
        preconfirmed={!!chosen}
      />
    </>
  );
};

export default WelcomeIntake;
