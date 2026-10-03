// One loader for every candidate page. Each screen asks for the whole picture
// because the navigation counts have to be honest wherever you land.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { loadRequirements, type DocumentRequirement } from "@/lib/documents";
import { loadDocumentRequests, type DocumentRequest } from "@/components/DocumentRequestList";
import { loadPreferences, preferencesComplete } from "@/lib/work-preferences";
import { isOfferOpen, type Offer } from "@/lib/offers";
import { JOIN_PENDING_KEY } from "@/lib/join-tracks";
import { cxNav, type CxNavItem } from "@/components/candidate/CxShell";
import { trackRules, trackKnown } from "@/lib/tracks";

export interface PortalRow {
  id: string;
  field: string;
  value: string | null;
  status: string;
  note: string | null;
  /** Where this is answered when it is not a typed answer. */
  route?: string;
  action?: string;
}

/**
 * Some things we need are not a line of text. References, preferences,
 * availability and documents each live on their own screen, so the home page
 * sends the candidate there rather than offering a box to type in.
 */
export const ROUTED_GAPS: Record<string, { route: string; action: string; sentence: string }> = {
  references: {
    route: "/portal/documents#references",
    action: "Add a reference",
    sentence: "We hold no referees for you. Add the people who can speak for your work.",
  },
  work_preferences: {
    route: "/portal/preferences",
    action: "Set your preferences",
    sentence: "Tell us the work you want, so we only put you forward for roles that suit you.",
  },
  joining_statement: {
    route: "/portal/preferences#joining-statement",
    action: "Write your statement",
    sentence: "Tell us what you hope to get from joining us. A short paragraph is plenty.",
  },
  availability: {
    route: "/portal/availability",
    action: "Set your availability",
    sentence: "Tell us the dates you can work. Without them we cannot put you forward.",
  },
  cv: {
    route: "/portal/documents",
    action: "Upload your CV",
    sentence: "We hold no CV for you. Upload one and we read it for you.",
  },
  documents: {
    route: "/portal/documents",
    action: "Open your documents",
    sentence: "Some of the documents we asked for are not on file yet.",
  },
  nysc_certificate: {
    route: "/portal/documents",
    action: "Upload your NYSC certificate",
    sentence: "You told us your NYSC is settled. Upload the certificate so we can check it.",
  },
};

/** Questions we work out ourselves rather than asking the candidate. Years of
 *  experience is read from their history, never typed in. */
const NEVER_ASK = new Set(["years_experience"]);

/**
 * The questions that stand between a candidate and being put forward. Nothing
 * outside this list ever blocks anyone or carries a count.
 */
export const MUST_ANSWER = new Set([
  "state", "lga", "profession", "sex", "right_to_work",
  "nysc_status", "nysc_certificate",
  "licensing_body", "license_number", "license_expiry",
  "work_preferences", "availability", "references",
  "institution", "course_of_study", "study_level", "year_of_study",
  "expected_graduation", "joining_statement",
]);

/**
 * Questions only a CV can answer sensibly. With no CV on file we do not ask
 * them at all: we ask for the CV instead and read them from it.
 */
export const CV_ANSWERED = new Set([
  "current_employer", "current_position", "employer", "position",
  "education", "qualifications", "certifications",
  "clinical_skills", "specialisms",
]);


/** Where a question's answer already lives on the profile. Once the profile
 *  holds it, the question is settled and is never asked again: it becomes an
 *  editable fact on "Your details" instead. */
const HELD_ON_PROFILE: Record<string, (p: any) => boolean> = {
  state: (p) => Boolean(p?.state),
  lga: (p) => Boolean(p?.lga),
  profession: (p) => Boolean(p?.profession),
  sex: (p) => Boolean(p?.sex),
  licensing_body: (p) => Boolean(p?.licensing_body),
  license_number: (p) => Boolean(p?.license_number),
  license_expiry: (p) => Boolean(p?.license_expiry),
  nysc_status: (p) => Boolean(p?.nysc_status),
  right_to_work: (p) => p?.right_to_work !== null && p?.right_to_work !== undefined,
  languages: (p) => Array.isArray(p?.languages) && p.languages.length > 0,
  institution: (p) => Boolean(p?.institution),
  course_of_study: (p) => Boolean(p?.course_of_study),
  expected_graduation: (p) => Boolean(p?.expected_graduation),
};

const alreadyHeld = (field: string, person: any) =>
  Boolean(HELD_ON_PROFILE[field]?.(person));




export interface PortalDoc {
  id: string;
  label: string;
  url: string;
  verified: boolean;
  created_at: string;
}

export interface PortalApplication {
  id: string;
  kind: string;
  title: string;
  location: string | null;
  applied_at: string;
  stage: string;
  stage_at: string;
  stage_note: string | null;
  opportunity_id: string | null;
  can_withdraw: boolean;
  slots: {
    id: string;
    starts_at: string;
    duration_minutes: number;
    mode: string;
    location: string | null;
    status: string;
  }[];
}

// State has to come before LGA, otherwise the area picker has no list.
const ORDER = [
  "state", "lga", "profession", "licensing_body", "license_number", "license_expiry",
  "sex", "languages", "right_to_work", "nysc_status", "nysc_certificate",
  "institution", "course_of_study", "study_level", "expected_graduation", "joining_statement",
];

export const usePortal = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState<any>(null);
  const [rows, setRows] = useState<PortalRow[]>([]);
  const [docs, setDocs] = useState<PortalDoc[]>([]);
  const [reqs, setReqs] = useState<DocumentRequirement[]>([]);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [apps, setApps] = useState<PortalApplication[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [prefsDone, setPrefsDone] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    let { data: p } = await supabase
      .from("mu_people" as any).select("*").eq("auth_user_id", user.id).maybeSingle();

    // Someone already on our books who has just claimed their account arrives
    // with no link between the two. Attach them to the record we hold.
    if (!p) {
      const { data: claimed } = await supabase.rpc("mu_claim_my_person" as any);
      if (claimed) {
        const retry = await supabase
          .from("mu_people" as any).select("*").eq("auth_user_id", user.id).maybeSingle();
        p = retry.data;
      }
    }

    // Someone who signed up on /join and confirmed by email arrives here before
    // their profile exists. Finish the registration they started.
    if (!p) {
      let pending: any = null;
      try { pending = JSON.parse(localStorage.getItem(JOIN_PENDING_KEY) || "null"); } catch { /* ignore */ }
      if (pending?.p_track) {
        const { error } = await supabase.rpc("mu_self_register" as any, pending);
        if (!error) {
          try { localStorage.removeItem(JOIN_PENDING_KEY); } catch { /* ignore */ }
          const retry = await supabase
            .from("mu_people" as any).select("*").eq("auth_user_id", user.id).maybeSingle();
          p = retry.data;
        }
      }
    }

    if (!p) {
      setPerson(null);
      setLoading(false);
      return;
    }
    setPerson(p);

    // Two gates, in order. Nobody sees the portal until we know we can reach
    // them, and nobody is asked about a missing CV before they have told us
    // where they are and what they do.
    const metaVerified = (user.user_metadata as any)?.contact_verified_at as string | undefined;
    if (!(p as any).contact_verified_at && metaVerified) {
      await supabase.from("mu_people" as any)
        .update({ contact_verified_at: metaVerified }).eq("id", (p as any).id);
      (p as any).contact_verified_at = metaVerified;
    }
    if (!(p as any).contact_verified_at) {
      setLoading(false);
      navigate("/portal/verify", { replace: true });
      return;
    }
    // State and LGA travel together, and everyone confirms them in their own
    // words. Anything a parser guessed is treated as unconfirmed.
    if (!(p as any).state || !(p as any).lga || !(p as any).profession
        || (p as any).location_source !== "candidate_stated"
        || !trackKnown((p as any).track) || (p as any).track_source === "inferred") {
      setLoading(false);
      navigate("/portal/start", { replace: true });
      return;
    }


    const id = (p as any).id;
    const [{ data: f }, { data: d }] = await Promise.all([
      supabase.from("mu_parsed_fields" as any).select("id, field, value, status, note").eq("person_id", id),
      supabase.from("mu_documents" as any)
        .select("id, label, url, verified, created_at").eq("person_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setRows(((f as any) || []) as PortalRow[]);
    setDocs(((d as any) || []) as PortalDoc[]);
    setReqs(await loadRequirements(id));
    setRequests(await loadDocumentRequests(id));
    setPrefsDone(preferencesComplete(await loadPreferences(id), (p as any).track));
    const { data: a } = await supabase.rpc("mu_my_applications" as any);
    setApps(((a as any) || []) as PortalApplication[]);
    const { data: off } = await supabase.rpc("mu_my_offers" as any);
    setOffers(((off as any) || []) as Offer[]);
    setLoading(false);

    if (!(p as any).claimed_at) {
      await supabase.from("mu_people" as any)
        .update({ claimed_at: new Date().toISOString() }).eq("id", id);
    }
  }, [user, navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Keep hold of where they were going. Somebody opening a contract link
      // from their inbox should land on that contract once they are in.
      const here = `${window.location.pathname}${window.location.search}`;
      navigate(`/portal/login?next=${encodeURIComponent(here)}`, { replace: true });
      return;
    }
    load();
  }, [authLoading, user, load, navigate]);

  const gaps: string[] = useMemo(
    () => (Array.isArray(person?.candidate_gaps) ? person.candidate_gaps : []),
    [person],
  );

  // Everything on file is a CV until a document says otherwise. With no CV we
  // never ask the questions only a CV can answer.
  const hasCv = useMemo(
    () => docs.some((d) => /\bcv\b|resume|curriculum/i.test(d.label)),
    [docs],
  );

  // Every imported fact stays visible until the candidate confirms or corrects
  // it. A parser or admin may propose a value, but only candidate_updated means
  // it came directly from the person. Anything answered on another screen
  // carries the route to it instead of an answer box.
  const queue = useMemo(() => {
    const unresolved = rows
      .filter((r) => r.status !== "candidate_updated")
      .filter((r) => !ROUTED_GAPS[r.field])
      .filter((r) => !NEVER_ASK.has(r.field))
      .map((r) => ({ ...r }));
    // A CV may mention the same fact more than once. Ask one clear question per
    // field; saving it settles every extraction of that field together.
    const queried = [...new Map(unresolved.map((r) => [r.field, r])).values()];
    const covered = new Set(queried.map((r) => r.field));
    const missing: PortalRow[] = gaps
      .filter((g) => !covered.has(g) && !NEVER_ASK.has(g) && !alreadyHeld(g, person))

      .map((g) => {
        const routed = ROUTED_GAPS[g];
        return {
          id: `gap:${g}`,
          field: g,
          value: "",
          status: "missing",
          note: routed ? routed.sentence : null,
          route: routed?.route,
          action: routed?.action,
        };
      });

    const rank = (f: string) => { const i = ORDER.indexOf(f); return i === -1 ? ORDER.length : i; };
    return [...queried, ...missing].sort((a, b) => rank(a.field) - rank(b.field));
  }, [rows, gaps, person]);

  // Only a student is asked about their studies. For everyone else the same
  // questions are read from a CV rather than typed out.
  const studying = person?.track === "student";
  const blocking = (f: string) =>
    MUST_ANSWER.has(f) && (studying || !["institution", "course_of_study", "study_level",
      "year_of_study", "expected_graduation", "joining_statement"].includes(f));

  const attention = useMemo(
    () => queue.filter((r) => blocking(r.field)),
    [queue, studying],
  );

  // Never blocks, never counted. Anything a CV would answer waits for the CV.
  const later = useMemo(
    () => queue
      .filter((r) => !blocking(r.field))
      .filter((r) => hasCv || !CV_ANSWERED.has(r.field)),
    [queue, studying, hasCv],
  );




  const answered = rows.filter((r) => r.status === "candidate_updated");
  const required = reqs.filter((r) => r.required);
  const acceptedRequired = required.filter((r) => r.status === "accepted").length;
  const openRequests = requests.filter((r) => r.status === "open").length;
  const openOffers = offers.filter(isOfferOpen).length;
  const rules = trackRules(person?.track);
  // Non-clinical people are hired into posts, not rostered onto visits, so we
  // never ask them for dates and never count it against them.
  const availabilitySet = !rules.needsAvailability || Boolean(person?.last_availability_update);
  // An interview time waiting to be accepted is work only the candidate can do.
  const interviewsToBook = apps.filter(
    (a) => (a.slots || []).some((s) => s.status === "offered"),
  ).length;

  const outstanding =
    attention.length + openRequests + (required.length - acceptedRequired) +
    (availabilitySet ? 0 : 1) + (prefsDone ? 0 : 1) + interviewsToBook;

  // Zero is never shown, so a count only exists when there is work to do.
  const nav: CxNavItem[] = cxNav
    .filter((item) => item.url !== "/portal/availability" || rules.needsAvailability)
    
    .map((item) => {
    const needs =
      item.url === "/portal" ? attention.length
      : item.url === "/portal/documents" ? openRequests + (required.length - acceptedRequired)
      : item.url === "/portal/availability" ? (availabilitySet ? 0 : 1)
      : item.url === "/portal/preferences" ? (prefsDone ? 0 : 1)
      : item.url === "/portal/offers" ? openOffers
      : item.url === "/portal/applications" ? interviewsToBook
      : 0;
    return needs > 0 ? { ...item, needs } : item;
    });

  return {
    user, authLoading, loading, person, setPerson, reload: load,
    rows, docs, reqs, requests, apps, offers, prefsDone, hasCv,
    attention, later, answered, required, acceptedRequired, openRequests, openOffers,
    availabilitySet, interviewsToBook, outstanding, nav, rules,
  };
};
