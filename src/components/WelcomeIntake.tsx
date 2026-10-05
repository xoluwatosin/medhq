// The welcome pop-up.
//
// It used to ask for name, email and phone before a visitor knew whether we
// were right for them. Now it asks one thing: what brought you here. That
// answer is remembered, and it hands straight over to the Request care
// journey with the service already filled in.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

import { Choice, Question, RequestShell } from "@/components/request/RequestShell";
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
        chip={chosen?.label ?? null}
      >
        {chosen ? (
          <Question heading={`${chosen.label}.`} help={chosen.blurb} stepKey="picked">
            <div className="space-y-2.5">
              <p className="text-[14px] leading-[1.55] text-body">
                We can start your request now, and it takes under a minute. Or read the page first
                and come back whenever you are ready.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1 rounded-xl"
                  onClick={() => { setOpen(false); setRequestOpen(true); try { localStorage.setItem(STORAGE_SEEN, "1"); } catch { /* ignore */ } }}
                >
                  Request care
                </Button>
                {LINE_ROUTES[chosen.line] && (
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl border-hairline-warm"
                    onClick={() => { close(); navigate(LINE_ROUTES[chosen.line]); }}
                  >
                    Read about it first
                  </Button>
                )}
              </div>
              <Button variant="ghost" className="w-full rounded-xl text-body" onClick={() => setChosen(null)}>
                Choose something else
              </Button>
            </div>
          </Question>
        ) : (
          <Question
            heading={firstName ? `Welcome back, ${firstName}. What are you looking for?` : "What kind of care are you looking for?"}
            help="Pick one and we will take you straight to it. No details needed yet."
            stepKey="pick"
          >
            <div className="grid gap-2">
              {featured.map((k) => (
                <Choice key={k.line} label={k.label} blurb={k.blurb} selected={false} onClick={() => choose(k)} />
              ))}
              <Button variant="ghost" className="mt-1 w-full rounded-xl text-body" onClick={close}>
                I'm just exploring
              </Button>
            </div>
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
