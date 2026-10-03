// Finish your profile. Asked once, straight after verification, so a new
// account never has to be told a CV it has not uploaded is missing something.
// What is answered here is the source of truth: it outranks anything a parser
// later guesses.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CxJoinShell, CxJoinAside } from "@/components/candidate/CxJoinShell";
import { CxCard, CxButton, CxField, cxInputClass } from "@/components/candidate/primitives";
import { NIGERIA_STATES, getLGAsForState } from "@/lib/nigeria-locations";
import { professionsForTrack } from "@/lib/professions";
import { JOIN_TRACKS } from "@/lib/join-tracks";
import { trackKnown } from "@/lib/tracks";
import { COURSES, STUDY_LEVELS, OTHER } from "@/lib/study";
import { settlePortalFields } from "@/lib/portal-actions";

const PortalStart = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [profession, setProfession] = useState("");
  const [track, setTrack] = useState("");
  const [problem, setProblem] = useState("");
  const [study, setStudy] = useState({
    institution: "",
    course_of_study: "",
    study_level: "",
    expected_graduation: "",
  });

  const isStudent = track === "student";
  const courseKnown = (COURSES as readonly string[]).includes(study.course_of_study);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/portal/login", { replace: true }); return; }
    let cancelled = false;
    (async () => {
      const fetchPerson = async () => {
        const { data } = await supabase
          .from("mu_people")
          .select("id, full_name, state, lga, profession, track, track_source, location_source, contact_verified_at, institution, course_of_study, study_level, expected_graduation")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        return data;
      };
      let data = await fetchPerson();
      // Someone already on our books arrives with a brand new account and no
      // link to the record we hold. Attach them here rather than telling them
      // their profile cannot be found.
      if (!data) {
        const { data: claimed } = await supabase.rpc("mu_claim_my_person" as any);
        if (claimed) data = await fetchPerson();
      }
      if (cancelled) return;

      if (data) {
        const metadataVerified = (user.user_metadata as Record<string, unknown> | undefined)?.contact_verified_at;
        if (!data.contact_verified_at && typeof metadataVerified !== "string") {
          navigate("/portal/verify", { replace: true });
          return;
        }
        setPerson(data);
        setState(data.state ?? "");
        setLga(data.lga ?? "");
        setProfession(data.profession ?? "");
        setStudy({
          institution: data.institution ?? "",
          course_of_study: data.course_of_study ?? "",
          study_level: data.study_level ?? "",
          expected_graduation: data.expected_graduation ?? "",
        });
        // A route we worked out from a job title is a guess until they say so.
        setTrack(trackKnown(data.track) ? data.track! : "");
        if (data.state && data.lga
            && (data as any).location_source === "candidate_stated"
            && trackKnown(data.track) && data.track_source !== "inferred"
            && profileCompleteEnough(data, data.track)) {
          navigate("/portal", { replace: true });
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, navigate]);

  const lgas = useMemo(() => getLGAsForState(state), [state]);
  const professionOptions = useMemo(() => professionsForTrack(track), [track]);
  const ready = isStudent
    ? Boolean(state && lga && track && study.institution && study.course_of_study && study.study_level && study.expected_graduation)
    : Boolean(state && lga && profession && track);

  const profileCompleteEnough = (data: any, t: string) => {
    if (t !== "student") return Boolean(data.profession);
    return Boolean(data.institution && data.course_of_study && data.study_level && data.expected_graduation);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    if (!person?.id) { setProblem("We could not find your profile. Please sign out and back in."); return; }
    setSaving(true);
    setProblem("");

    const patch: Record<string, any> = {
      state, lga, track,
      location_source: "candidate_stated",
      track_source: "candidate_confirmed",
      track_confirmed_at: new Date().toISOString(),
    };
    if (isStudent) {
      patch.profession = null;
      patch.institution = study.institution;
      patch.course_of_study = study.course_of_study;
      patch.study_level = study.study_level;
      patch.expected_graduation = study.expected_graduation;
    } else {
      patch.profession = profession;
    }

    const settled = async () => {
      const { data, error } = await supabase
        .from("mu_people")
        .select("state, lga, profession, institution, course_of_study, study_level, expected_graduation, track, track_source, location_source")
        .eq("auth_user_id", user?.id ?? "")
        .maybeSingle();
      if (error) console.error("Profile confirmation failed", error);
      return Boolean(
        data?.state && data?.lga
        && (data as any)?.location_source === "candidate_stated"
        && trackKnown(data?.track) && (data as any)?.track_source !== "inferred"
        && profileCompleteEnough(data, data.track!),
      );
    };

    // Use the account-scoped update exclusively. It resolves the current
    // profile from the signed-in user, so a merge or relink cannot leave this
    // page writing to and checking a stale cached profile id.
    const { error: rpcError } = await supabase.rpc("mu_candidate_update_profile" as any, {
      _patch: patch,
    });
    if (rpcError) console.error("Profile save failed", rpcError);
    const settlementError = rpcError ? null : await settlePortalFields(patch);
    if (settlementError) console.error("Profile confirmation settlement failed", settlementError);
    const ok = !rpcError && !settlementError && await settled();

    setSaving(false);
    if (!ok) {
      setProblem("We could not save those answers. Please try once more, and tell us at hello@medicconnect.co if it happens again.");
      return;
    }
    toast.success("Thank you. Your profile is open.");
    navigate("/portal", { replace: true });
  };

  const signOut = () => supabase.auth.signOut().then(() => navigate("/portal/login", { replace: true }));

  if (loading) {
    return (
      <div className="cx flex min-h-dvh items-center justify-center bg-desk">
        <Loader2 className="h-6 w-6 animate-spin text-navy" />
      </div>
    );
  }

  const firstName = (person?.full_name ?? "").split(" ")[0];

  return (
    <>
      <SEO
        title="Finish your profile | Medic Connect"
        description="Tell us where you are based and what you do, so we only send you work you can reach."
        path="/portal/start"
        noindex
      />
      <CxJoinShell
        title={firstName ? `${firstName}, four quick answers` : "Four quick answers"}
        eyebrow="Finish your profile"
        aside={
          <CxJoinAside
            eyebrow="Finish your profile"
            heading="Four answers, and the work can find you."
            lede="These four decide which roles you are put forward for, and which questions we ask you afterwards. You tell us directly, so we never have to guess them from a document."
            items={[
              { title: "Your route", body: "Clinical, support, non-clinical or student. It sets what we ask of you." },
              { title: "Where you live", body: "Your state and area. We only send work you can reach." },
              { title: "What you do", body: "Your profession sets which roles you are matched to." },
              { title: "Then the rest", body: "Documents, availability and preferences, in your own time." },
            ]}
          />
        }
      >
        <CxCard kind="quiet" className="p-5 md:p-8">
          <p className="cx-measure text-[16px] leading-relaxed text-body">
            You told us these yourself, so they count as the record. You can change them any time from
            your details.
          </p>

          <form onSubmit={save} className="mt-6 space-y-5">
            <CxField
              label="Which of these describes you?"
              helper="It decides what we ask for. You can change it later if your situation changes."
            >
              <select
                value={track}
                onChange={(e) => {
                  const t = e.target.value;
                  setTrack(t);
                  setProfession("");
                  if (t !== "student") setStudy({ institution: "", course_of_study: "", study_level: "", expected_graduation: "" });
                }}
                className={cxInputClass()}
              >
                <option value="">Choose your route</option>
                {JOIN_TRACKS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </CxField>

            <CxField label="Which state do you live in?">
              <select
                value={state}
                onChange={(e) => { setState(e.target.value); setLga(""); }}
                className={cxInputClass()}
              >
                <option value="">Choose a state</option>
                {NIGERIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </CxField>

            <CxField
              label="Which local government area?"
              helper={state ? undefined : "Choose your state first."}
            >
              <select
                value={lga}
                onChange={(e) => setLga(e.target.value)}
                disabled={!state}
                className={cxInputClass()}
              >
                <option value="">{state ? "Choose an area" : "Waiting on your state"}</option>
                {lgas.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </CxField>

            {!isStudent && (
              <CxField label="What do you do?">
                <select
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  disabled={!track}
                  className={cxInputClass()}
                >
                  <option value="">{track ? "Choose your profession" : "Choose your route first"}</option>
                  {professionOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </CxField>
            )}

            {isStudent && (
              <div className="space-y-5 rounded-xl border border-line bg-desk/40 p-4">
                <p className="text-[14.5px] font-bold text-ink">Your studies</p>
                <CxField label="Where do you study?">
                  <input
                    value={study.institution}
                    onChange={(e) => setStudy((s) => ({ ...s, institution: e.target.value }))}
                    placeholder="e.g. University of Lagos"
                    className={cxInputClass()}
                  />
                </CxField>
                <CxField label="What level are you studying towards?">
                  <select
                    value={study.study_level}
                    onChange={(e) => setStudy((s) => ({ ...s, study_level: e.target.value }))}
                    className={cxInputClass()}
                  >
                    <option value="">Choose a level</option>
                    {STUDY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </CxField>
                <CxField label="Your course" helper={courseKnown ? undefined : "Not on the list? Choose Other and type it in."}>
                  <select
                    value={courseKnown ? study.course_of_study : study.course_of_study ? OTHER : ""}
                    onChange={(e) => setStudy((s) => ({ ...s, course_of_study: e.target.value === OTHER ? "" : e.target.value }))}
                    className={cxInputClass()}
                  >
                    <option value="">Choose your course</option>
                    {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {!courseKnown && (
                    <input
                      value={study.course_of_study}
                      onChange={(e) => setStudy((s) => ({ ...s, course_of_study: e.target.value }))}
                      className={`${cxInputClass()} mt-2`}
                      placeholder="Type your course"
                    />
                  )}
                </CxField>
                <CxField label="When do you finish?" helper="Month and year is enough.">
                  <input
                    value={study.expected_graduation}
                    onChange={(e) => setStudy((s) => ({ ...s, expected_graduation: e.target.value }))}
                    className={cxInputClass()}
                    placeholder="July 2027"
                  />
                </CxField>
              </div>
            )}

            {problem && (
              <p className="border border-warn-line bg-warn-bg px-4 py-3 text-[14.5px] font-semibold text-ink">
                {problem}
              </p>
            )}

            <CxButton type="submit" full disabled={!ready || saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving</> : "Open my profile"}
            </CxButton>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[14px]">
              <button type="button" onClick={signOut} className="font-bold text-body hover:text-ink">
                Not you? Sign out
              </button>
              <Link to="/portal/login" className="font-bold text-brand hover:text-navy">
                Back to sign in
              </Link>
            </div>
          </form>
        </CxCard>
      </CxJoinShell>
    </>
  );
};

export default PortalStart;