// Applications. Where each role stands, the interview times waiting to be
// accepted, and a way to step back from anything still live.
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CxPortalPage from "@/components/candidate/CxPortalPage";
import { CxButton, CxCard, CxEmpty, CxPill, CxRow, CxRows } from "@/components/candidate/primitives";
import { STAGE_LABEL_CANDIDATE, slotSentence } from "@/lib/applications";
import { usePortal } from "./usePortal";

const PortalApplications = () => {
  const { toast } = useToast();
  const p = usePortal();
  const [busy, setBusy] = useState<string | null>(null);

  const withdraw = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("mu_withdraw_application" as any, { _id: id });
    setBusy(null);
    if (error) {
      toast({ title: "Could not withdraw", description: "Please try again.", variant: "destructive" });
      return;
    }
    toast({ title: "Withdrawn", description: "We have taken you out of the running for that role." });
    p.reload();
  };

  const book = async (slotId: string) => {
    setBusy(slotId);
    const { error } = await supabase.rpc("mu_book_interview_slot" as any, { _slot_id: slotId });
    setBusy(null);
    if (error) {
      toast({ title: "Could not book that time", description: "It may no longer be available. Refresh the page and choose another time.", variant: "destructive" });
      return;
    }
    toast({ title: "Interview booked", description: "The other times have been released." });
    p.reload();
  };

  const intro =
    p.interviewsToBook === 1
      ? "One role has interview times waiting for you to choose."
      : p.interviewsToBook > 1
        ? `${p.interviewsToBook} roles have interview times waiting for you to choose.`
        : "Every role you have applied for and where it stands. You can step back from anything still live.";

  return (
    <CxPortalPage
      loading={p.authLoading || p.loading}
      person={p.person}
      nav={p.nav}
      title="Applications"
      eyebrow="Candidate portal"
      back="/portal"
      intro={intro}
    >
      <CxCard>
        {p.apps.length === 0 ? (
          <CxEmpty>
            No applications yet. Keep your details and availability current and we will come to you when
            something fits.
          </CxEmpty>
        ) : (
          <CxRows>
            {p.apps.map((a) => {
              const slots = a.slots || [];
              const booked = slots.find((s) => s.status === "booked");
              const offered = slots.filter((s) => s.status === "offered");
              const applied = new Date(a.applied_at).toLocaleDateString("en-GB", {
                day: "numeric", month: "long", year: "numeric",
              });

              return (
                <div key={a.id}>
                  <CxRow
                    title={a.title}
                    sentence={
                      <>
                        {[a.location, `Applied ${applied}`].filter(Boolean).join(" · ")}
                        {booked && <><br />Interview booked. {slotSentence(booked)}</>}
                        {!booked && offered.length > 0 && (
                          <><br />{offered.length === 1
                            ? "One interview time is offered below. Accept it to confirm."
                            : `${offered.length} interview times are offered below. Accept the one that suits you.`}</>
                        )}
                      </>
                    }
                    right={
                      <>
                        <CxPill>{STAGE_LABEL_CANDIDATE[a.stage] ?? "Being reviewed"}</CxPill>
                        {a.can_withdraw && (
                          <CxButton rank="tertiary" disabled={busy === a.id} onClick={() => withdraw(a.id)}>
                            {busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Withdraw"}
                          </CxButton>
                        )}
                      </>
                    }
                  />
                  {!booked && offered.length > 0 && (
                    <div className="mt-2 space-y-2 border-t border-line-soft pt-3">
                      {offered.map((s) => (
                        <div
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3"
                        >
                          <p className="text-[14px] leading-snug">{slotSentence(s)}</p>
                          <CxButton
                            rank="secondary"
                            disabled={busy === s.id}
                            onClick={() => book(s.id)}
                          >
                            {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept this time"}
                          </CxButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CxRows>
        )}
      </CxCard>
    </CxPortalPage>
  );
};

export default PortalApplications;
