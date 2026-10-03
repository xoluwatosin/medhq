// Your details. What we hold about you, the way to correct it, and the way out.
// Every correction goes through one function, so it lands on the record and on
// the trail our team reads.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, LogOut, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CxPortalPage from "@/components/candidate/CxPortalPage";
import {
  CxButton, CxCard, CxField, CxPill, CxRow, CxRows, CxSection, cxInputClass,
} from "@/components/candidate/primitives";
import LanguagePicker from "@/components/portal/LanguagePicker";
import { SEX_OPTIONS, LOOKING_OPTIONS } from "@/lib/work-preferences";
import { NIGERIA_STATES, getLGAsForState } from "@/lib/nigeria-locations";
import { professionsForTrack } from "@/lib/professions";
import { JOIN_TRACKS, YEAR_OF_STUDY, trackLabel } from "@/lib/join-tracks";
import { COURSES, STUDY_LEVELS, OTHER } from "@/lib/study";
import { trackRules } from "@/lib/tracks";
import { updateOwnProfile } from "@/lib/portal-actions";
import AddressAutocomplete from "@/components/portal/AddressAutocomplete";
import { usePortal } from "./usePortal";

const languageList = (value: any): string =>
  Array.isArray(value)
    ? value.map((l: any) => (typeof l === "string" ? l : l?.language)).filter(Boolean).join(", ")
    : typeof value === "string" ? value : "";

const PortalDetails = () => {
  const navigate = useNavigate();
  const p = usePortal();
  const person = p.person ?? {};

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    state: "", lga: "", profession: "", sex: "", languages: "",
    address_line: "", address_landmark: "", address_area: "",
    track: "", institution: "", course_of_study: "", study_level: "",
    year_of_study: "", expected_graduation: "",
  });

  useEffect(() => {
    if (!p.person) return;
    setForm({
      state: p.person.state ?? "",
      lga: p.person.lga ?? "",
      profession: p.person.profession ?? "",
      sex: p.person.sex ?? "",
      languages: languageList(p.person.languages),
      address_line: p.person.address_line ?? "",
      address_landmark: p.person.address_landmark ?? "",
      address_area: p.person.address_area ?? "",
      track: p.person.track ?? "",
      institution: p.person.institution ?? "",
      course_of_study: p.person.course_of_study ?? "",
      study_level: p.person.study_level ?? "",
      year_of_study: p.person.year_of_study ?? "",
      expected_graduation: p.person.expected_graduation ?? "",
    });
  }, [p.person]);

  const lgas = useMemo(() => getLGAsForState(form.state), [form.state]);
  const rules = trackRules(form.track || person.track);
  const courseKnown = (COURSES as readonly string[]).includes(form.course_of_study);
  const set = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v, ...(k === "state" ? { lga: "" } : null) }));

  const signOut = () => supabase.auth.signOut().then(() => navigate("/portal/login"));
  const value = (v: any) => (v === null || v === undefined || v === "" ? "Not on file yet" : String(v));

  const save = async () => {
    setSaving(true);
    const { error } = await updateOwnProfile(form);
    setSaving(false);
    if (error) {
      toast.error("We could not save that. Please try again.");
      return;
    }
    toast.success("Saved. Your record is updated.");
    setEditing(false);
    p.reload();
  };

  const addressSentence = person.address_line
    ? [person.address_line, person.address_landmark, person.address_area].filter(Boolean).join(", ")
    : "Not on file yet. Giving it to us means we only send you work you can reach.";

  return (
    <CxPortalPage
      loading={p.authLoading || p.loading}
      person={p.person}
      nav={p.nav}
      title="Your details"
      back="/portal"
      intro="What we hold about you. Correct anything here yourself, and we keep a record of the change."
      footer={<CxButton rank="secondary" full onClick={signOut}><LogOut className="h-4 w-4" />Sign out</CxButton>}
    >
      {!editing ? (
        <CxCard>
          <CxRows>
            <CxRow title="Name" sentence={value(person.full_name)} />
            <CxRow title="Email" sentence={value(person.email)} />
            <CxRow title="Phone" sentence={value(person.phone)} />
            <CxRow title="Your route" sentence={person.track ? trackLabel(person.track) : "Not on file yet"} />
            <CxRow title="Profession" sentence={value(person.profession)} />
            {rules.needsStudy && (
              <>
                <CxRow title="Where you study" sentence={value(person.institution)} />
                <CxRow
                  title="Course"
                  sentence={[person.course_of_study, person.study_level].filter(Boolean).join(", ") || "Not on file yet"}
                />
                <CxRow
                  title="When you finish"
                  sentence={[person.year_of_study, person.expected_graduation].filter(Boolean).join(", ") || "Not on file yet"}
                />
              </>
            )}
            <CxRow title="Where you are" sentence={[person.lga, person.state].filter(Boolean).join(", ") || "Not on file yet"} />
            <CxRow title="Home address" sentence={addressSentence} />
            <CxRow title="Languages" sentence={languageList(person.languages) || "Not on file yet"} />
            <CxRow title="Sex" sentence={SEX_OPTIONS.find((o) => o.code === person.sex)?.label ?? "Not on file yet"} />
            <CxRow
              title="Looking for work"
              sentence={LOOKING_OPTIONS.find((o) => o.code === person.looking_status)?.label ?? "Not on file yet"}
              right={<CxPill tone="quiet">Set on preferences</CxPill>}
            />
            <CxRow
              title="Something wrong?"
              sentence="Change your route, area, profession, languages, sex or address yourself."
              right={
                <CxButton rank="secondary" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" />Change
                </CxButton>
              }
            />
          </CxRows>
        </CxCard>
      ) : (
        <CxCard className="p-5 sm:p-[22px]">
          <div className="grid gap-5 sm:grid-cols-2">
            <CxField
              label="Which of these describes you?"
              helper="It decides which questions we ask you."
            >
              <select value={form.track} onChange={(e) => set("track", e.target.value)} className={cxInputClass()}>
                <option value="">Choose your route</option>
                {JOIN_TRACKS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </CxField>
            <CxField label="Which state do you live in?">
              <select value={form.state} onChange={(e) => set("state", e.target.value)} className={cxInputClass()}>
                <option value="">Choose a state</option>
                {NIGERIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </CxField>
            <CxField label="Which local government area?" helper={form.state ? undefined : "Choose your state first."}>
              <select value={form.lga} onChange={(e) => set("lga", e.target.value)} disabled={!form.state} className={cxInputClass()}>
                <option value="">{form.state ? "Choose an area" : "Waiting on your state"}</option>
                {lgas.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </CxField>
            {!rules.needsStudy && (
              <CxField label="What do you do?">
                <select value={form.profession} onChange={(e) => set("profession", e.target.value)} className={cxInputClass()}>
                  <option value="">Choose your profession</option>
                  {professionsForTrack(form.track).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </CxField>
            )}
            <CxField label="Your sex" helper="Some households ask for a female or male carer.">
              <select value={form.sex} onChange={(e) => set("sex", e.target.value)} className={cxInputClass()}>
                <option value="">Choose</option>
                {SEX_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
              </select>
            </CxField>
            {rules.needsStudy && (
              <>
                <CxField label="Where do you study?">
                  <input
                    value={form.institution}
                    onChange={(e) => set("institution", e.target.value)}
                    className={cxInputClass()}
                    placeholder="University of Lagos"
                  />
                </CxField>
                <CxField label="What are you studying towards?">
                  <select value={form.study_level} onChange={(e) => set("study_level", e.target.value)} className={cxInputClass()}>
                    <option value="">Choose a level</option>
                    {STUDY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </CxField>
                <CxField label="Your course" helper={courseKnown ? undefined : "Not on the list? Choose Other and type it in."}>
                  <select
                    value={courseKnown ? form.course_of_study : form.course_of_study ? OTHER : ""}
                    onChange={(e) => set("course_of_study", e.target.value === OTHER ? "" : e.target.value)}
                    className={cxInputClass()}
                  >
                    <option value="">Choose your course</option>
                    {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {!courseKnown && (
                    <input
                      value={form.course_of_study}
                      onChange={(e) => set("course_of_study", e.target.value)}
                      className={`${cxInputClass()} mt-2`}
                      placeholder="Type your course"
                    />
                  )}
                </CxField>
                <CxField label="Which year are you in?">
                  <select value={form.year_of_study} onChange={(e) => set("year_of_study", e.target.value)} className={cxInputClass()}>
                    <option value="">Choose a year</option>
                    {YEAR_OF_STUDY.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </CxField>
                <CxField label="When do you finish?" helper="Month and year is enough.">
                  <input
                    value={form.expected_graduation}
                    onChange={(e) => set("expected_graduation", e.target.value)}
                    className={cxInputClass()}
                    placeholder="July 2027"
                  />
                </CxField>
              </>
            )}
            <div className="sm:col-span-2">
              <CxField label="Languages you speak">
                <LanguagePicker value={form.languages} onChange={(v) => set("languages", v)} />
              </CxField>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <CxField label="Your home address" helper="House number and street. It stays with our team.">
                <AddressAutocomplete
                  value={form.address_line}
                  onChange={(v) => set("address_line", v)}
                  placeholder="12 Awolowo Road"
                />
              </CxField>
            </div>
            <CxField label="Nearest landmark">
              <input
                value={form.address_landmark}
                onChange={(e) => set("address_landmark", e.target.value)}
                className={cxInputClass()}
                placeholder="Beside the primary health centre"
              />
            </CxField>
            <CxField label="Your area" helper="Only if it differs from your local government area.">
              <input
                value={form.address_area}
                onChange={(e) => set("address_area", e.target.value)}
                className={cxInputClass()}
                placeholder="Ikoyi"
              />
            </CxField>
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <CxButton onClick={save} disabled={saving} className="sm:w-40">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving</> : "Save changes"}
            </CxButton>
            <CxButton rank="secondary" onClick={() => setEditing(false)} className="sm:w-40">Cancel</CxButton>
          </div>
        </CxCard>
      )}

      <CxSection title="Signing out">
        <CxCard className="p-5 sm:p-[22px]">
          <p className="cx-measure text-[15px] leading-relaxed text-body">
            Your profile stays exactly as it is. Sign back in with the same email whenever you like.
          </p>
          <CxButton rank="secondary" className="mt-4 hidden md:inline-flex" onClick={signOut}>
            <LogOut className="h-4 w-4" />Sign out
          </CxButton>
        </CxCard>
      </CxSection>
    </CxPortalPage>
  );
};

export default PortalDetails;
