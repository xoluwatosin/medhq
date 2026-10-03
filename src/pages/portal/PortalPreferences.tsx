// Work preferences. Required, because matching honestly depends on them.
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WorkPreferencesPanel from "@/components/WorkPreferencesPanel";
import CxPortalPage from "@/components/candidate/CxPortalPage";
import { CxCard, CxField, CxFixBlock, CxSection } from "@/components/candidate/primitives";
import { LOOKING_OPTIONS, SEX_OPTIONS } from "@/lib/work-preferences";
import { Textarea } from "@/components/ui/textarea";
import { CxButton } from "@/components/candidate/primitives";
import { updateOwnProfile } from "@/lib/portal-actions";
import { usePortal } from "./usePortal";

const PortalPreferences = () => {
  const { toast } = useToast();
  const p = usePortal();
  const [saving, setSaving] = useState(false);
  const [statement, setStatement] = useState<string | null>(null);
  const [savingStatement, setSavingStatement] = useState(false);
  const rules = p.rules;
  const held = statement ?? p.person?.joining_statement ?? "";

  const saveStatement = async () => {
    setSavingStatement(true);
    const { error } = await updateOwnProfile({ joining_statement: held });
    setSavingStatement(false);
    if (error) {
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: "Thank you. Our team reads this." });
    p.reload();
  };

  const setField = async (col: "sex" | "looking_status", value: string) => {
    setSaving(true);
    await supabase.from("mu_people" as any).update({ [col]: value }).eq("id", p.person.id);
    setSaving(false);
    p.setPerson((prev: any) => ({ ...prev, [col]: value }));
    if (col === "looking_status") {
      toast({ title: "Updated", description: "We will only put you forward in line with this." });
    }
  };

  if (!p.person) {
    return (
      <CxPortalPage loading={p.authLoading || p.loading} person={p.person} nav={p.nav} title="Work preferences">
        {null}
      </CxPortalPage>
    );
  }

  return (
    <CxPortalPage
      loading={p.authLoading || p.loading}
      person={p.person}
      nav={p.nav}
      title="Work preferences"
      eyebrow="Candidate portal"
      back="/portal"
      intro="We match on these answers. Change them whenever your situation changes."
    >
      {!p.prefsDone && (
        <CxCard kind="needs-you" className="p-5 sm:p-[22px]">
          <CxFixBlock title="These answers are required">
            {rules.needsFunctionAreas
              ? "Until you tell us the areas you work in and the kind of contract you want, we cannot honestly put you forward for anything."
              : rules.needsPlacement
                ? "Until you tell us what kind of placement you are looking for, we cannot honestly put you forward for anything."
                : "Until you tell us the kind of care you take, live-in or live-out, and the shifts that suit you, we cannot honestly put you forward for anything."}
          </CxFixBlock>
        </CxCard>
      )}

      <CxSection
        title="About you"
        intro={rules.needsCarePreferences
          ? "Two facts that shape which households we suggest. You control both."
          : "Two facts we hold on your record. You control both."}
      >
        <CxCard className="p-5 sm:p-[22px]">
          <div className="grid gap-5 sm:grid-cols-2">
            <CxField
              label="Your sex"
              helper={rules.needsCarePreferences
                ? "Some households ask for a female or male carer."
                : "Held for our records and equal opportunities reporting."}
            >
              <Select value={p.person?.sex ?? ""} onValueChange={(v) => setField("sex", v)} disabled={saving}>
                <SelectTrigger className="cx-chip h-11 border-line text-[15px]"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {SEX_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </CxField>
            <CxField
              label="Are you looking right now?"
              helper={LOOKING_OPTIONS.find((o) => o.code === p.person?.looking_status)?.help ??
                "Change this any time. It never removes your profile."}
            >
              <Select
                value={p.person?.looking_status && p.person.looking_status !== "unknown" ? p.person.looking_status : ""}
                onValueChange={(v) => setField("looking_status", v)}
                disabled={saving}
              >
                <SelectTrigger className="cx-chip h-11 border-line text-[15px]"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {LOOKING_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </CxField>
          </div>
        </CxCard>
      </CxSection>

      <CxSection
        title="The work you want"
        intro={rules.needsFunctionAreas
          ? "The areas you work in, the organisations you would join, and the shape of the contract you want."
          : rules.needsPlacement
            ? "What you are hoping to get from us while you study, and what should follow when you finish."
            : "Who you are happy to care for, whether you want live-in or live-out work, and the shifts that suit you."}
      >
        <CxCard className="p-5 sm:p-[22px]">
          <WorkPreferencesPanel
            personId={p.person.id}
            actorName={p.person.full_name}
            track={p.person.track}
            onSaved={p.reload}
          />
        </CxCard>
      </CxSection>

      {rules.needsJoiningStatement && (
        <CxSection
          title="Why you are joining us"
          intro="A short paragraph in your own words. It stands in place of a second referee, so write it as you would speak."
        >
          <CxCard className="p-5 sm:p-[22px]" id="joining-statement">
            <CxField
              label="What do you hope to achieve with Medic Connect?"
              helper="What you want to learn, the kind of work you are drawn to, and where you would like your career to go."
            >
              <Textarea
                rows={7}
                value={held}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="I am in my third year of nursing at..."
              />
            </CxField>
            <div className="mt-4 flex justify-end">
              <CxButton onClick={saveStatement} disabled={savingStatement || !held.trim()}>
                {savingStatement ? "Saving" : "Save my statement"}
              </CxButton>
            </div>
          </CxCard>
        </CxSection>
      )}
    </CxPortalPage>
  );
};

export default PortalPreferences;
