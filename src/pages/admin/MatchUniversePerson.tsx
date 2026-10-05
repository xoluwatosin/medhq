import { ReactNode, useEffect, useMemo, useState } from "react";
import { humaniseTerm } from "@/lib/readable";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, ArrowLeft, Mail, Phone, MapPin, Briefcase, FileText, ExternalLink, CalendarDays,
  Compass, ShieldCheck, ShieldAlert, Check, X, MessageCircle, Save, Send, MoreHorizontal, RefreshCw, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import CvDataTab from "@/components/admin/CvDataTab";
import CredentialsPanel from "@/components/admin/CredentialsPanel";
import DocumentsPanel from "@/components/admin/DocumentsPanel";
import CandidateAccountPanel from "@/components/admin/CandidateAccountPanel";
import ReferencesTable from "@/components/admin/ReferencesTable";


import AvailabilityCalendar from "@/components/portal/AvailabilityCalendar";
import WorkPanel from "@/components/admin/mu/WorkPanel";
import HirePanel from "@/components/admin/mu/HirePanel";

import WorkPreferencesPanel from "@/components/WorkPreferencesPanel";
import PersonOpportunitiesTab from "@/components/admin/PersonOpportunitiesTab";
import ApplicationStages from "@/components/admin/mu/ApplicationStages";
import ReadinessPanel, { useReadiness } from "@/components/admin/mu/ReadinessPanel";
import { openDocumentTab, loadRequirements, type DocumentRequirement } from "@/lib/documents";
import VerifiedBadge, { nyscOutstanding } from "@/components/VerifiedBadge";
import { becomeWorkforce, returnToTalent } from "@/lib/lifecycle";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { IdCard } from "lucide-react";
import {
  Person, PersonDocument, VERIFICATION_LABELS,
  initialsOf, logActivity, sourceOf,
} from "@/lib/match-universe";
import {
  MuEmpty, MuField, MuFieldGrid, MuHero, MuPage, MuRow, MuSection, MuSectionOpener,
  MuStatus, MuTable, MuTabRail,
} from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import MuHeroWatermark from "@/components/admin/mu/heroWatermark";

import { trackLabel } from "@/lib/join-tracks";
import { SEX_OPTIONS } from "@/lib/work-preferences";
import { emailHistoryFor, type EmailEvent } from "@/lib/email-analytics";
import AvailabilityDetail from "@/components/admin/mu/AvailabilityDetail";




interface Submission {
  id: string;
  kind: "matchmaker" | "join";
  appliedFor: string | null;
  outcome: string | null;
  created_at: string;
  answers: Record<string, any>;
  cover_note: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_path: string | null;
  opportunityId?: string | null;
}

interface EmailLogRow {
  id: string;
  application_id: string;
  email_type: string;
  subject: string | null;
  status: string;
  created_at: string;
}

interface ActivityRow {
  id: string;
  action: string;
  actor_name: string | null;
  detail: any;
  created_at: string;
}

/**
 * The provenance footnote shown under a value the person told us themselves.
 * It sits beneath the value rather than beside it, because the value is the
 * point and the provenance is the footnote.
 */
const CLAIM_NOTE = "Self declared, not evidenced";

/**
 * Application answers arrive keyed however the form stored them: a question
 * label, a bare field name, or an underscored internal key. Nothing raw is ever
 * shown; every key is turned into a sentence and every value into words.
 */
const answerLabel = (key: string) => humaniseTerm(key.replace(/^_+/, ""));

const answerValue = (value: unknown): ReactNode => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((v) => answerValue(v)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, any>;
    if (obj.type === "file" || obj.path) return "A file was uploaded with this answer";
    return Object.entries(obj)
      .map(([k, v]) => `${answerLabel(k)}: ${answerValue(v) ?? "Not provided"}`)
      .join(", ");
  }
  return String(value);
};


const MatchUniversePerson = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState<Person | null>(null);

  // Five tabs now. The old nine live on as aliases so existing links and
  // bookmarks still land on the section that absorbed them.
  const [params, setParams] = useSearchParams();
  const TAB_ALIASES: Record<string, string> = {
    documents: "verification", credentials: "verification",
    cv: "profile", profile: "profile",
    opportunities: "matching", availability: "matching",
    history: "applications", applications: "applications",
    comms: "activity", notes: "activity", activity: "activity",
    verification: "verification", matching: "matching",
    work: "work", leave: "work",
    hiring: "hiring", offers: "hiring", contracts: "hiring", contract: "hiring",

  };
  const tab = TAB_ALIASES[params.get("tab") ?? ""] ?? "verification";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });
  const [subs, setSubs] = useState<Submission[]>([]);
  const [docs, setDocs] = useState<PersonDocument[]>([]);
  const [emails, setEmails] = useState<EmailLogRow[]>([]);
  const [emailEvents, setEmailEvents] = useState<EmailEvent[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [confirmMove, setConfirmMove] = useState<"staff" | "talent" | null>(null);
  const navigate = useNavigate();

  // Move a hired candidate into the staff register. One person record, one
  // identity: nothing is copied, the same row simply gains an employment side.
  const moveToStaff = async () => {
    if (!id) return;
    setConverting(true);
    try {
      await becomeWorkforce(id, {});
      toast({ title: "Moved to Workforce", description: "Same person, same sign-in. Their employment record is open." });
      navigate(`/admin/workforce/${id}`);
    } catch (err: any) {
      toast({ title: "Could not move", description: err.message, variant: "destructive" });
    }
    setConverting(false);
  };

  // The way back. Nothing is cancelled here: live commitments block the move
  // and have to be resolved first. History stays exactly where it is.
  const moveToTalent = async () => {
    if (!id) return;
    setConverting(true);
    try {
      await returnToTalent(id);
      toast({ title: "Returned to Talent", description: "Employment closed. Their full history is unchanged." });
      load();
    } catch (err: any) {
      toast({ title: "Could not return them to Talent", description: err.message, variant: "destructive" });
    }
    setConverting(false);
  };

  // Any CV on file is parsed automatically. No admin ever has to ask for it.
  const autoParse = async () => {
    if (!id || parsing) return;
    setParsing(true);
    await supabase.functions.invoke("parse-cv", { body: { person_id: id } }).catch(() => null);
    setParsing(false);
    load();
  };

  // A read that failed, or one worth running again after a better copy of the
  // CV arrived. The proposals it makes still have to be accepted by a person.
  const rereadCv = async () => {
    if (!id || parsing) return;
    setParsing(true);
    await (adminDb() as any).rpc("mu_requeue_parse", { _person_id: id });
    await supabase.functions.invoke("parse-cv", { body: { person_id: id } }).catch(() => null);
    setParsing(false);
    toast({ title: "CV read again", description: "Anything new is waiting under Profile." });
    load();
  };

  // Sends the candidate a personalised link to set a password against the
  // email we already hold on file.
  const invitePortal = async () => {
    if (!id) return;
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-candidate", { body: { person_id: id } });
    setInviting(false);
    const failure = error?.message || (data as any)?.error;
    if (failure) {
      toast({ title: "Could not send the invite", description: failure, variant: "destructive" });
      return;
    }
    toast({ title: "Invite sent", description: `A profile link is on its way to ${person?.email}.` });
    load();
  };


  const openDoc = async (doc: PersonDocument) => {
    const ok = await openDocumentTab(doc.url || "");
    if (!ok) toast({ title: "Could not open the file", variant: "destructive" });
  };



  const [ownRoleFallback, setOwnRoleFallback] = useState<string | null>(null);

  const load = async () => {
    const [{ data: p }, { data: mm }, { data: jn }, { data: d }, { data: act }] = await Promise.all([
      adminDb().from("mu_people").select("*").eq("id", id).maybeSingle(),
      adminDb()
        .from("matchmaker_applications")
        .select("*, matchmaker_opportunities(id, title)")
        .eq("person_id", id)
        .order("created_at", { ascending: false }),
      adminDb().from("join_applications").select("*").eq("person_id", id).order("created_at", { ascending: false }),
      adminDb().from("mu_documents").select("*").eq("person_id", id).order("created_at", { ascending: false }),
      adminDb().from("mu_activity").select("*").eq("person_id", id).order("created_at", { ascending: false }).limit(100),
    ]);

    setPerson((p as Person) || null);
    setNotes((p as Person)?.admin_notes || "");

    const mmSubs: Submission[] = ((mm || []) as any[]).map((a) => ({
      id: a.id,
      kind: "matchmaker",
      appliedFor: a.matchmaker_opportunities?.title ?? null,
      outcome: a.status ?? null,
      created_at: a.created_at,
      answers: { ...(a.question_answers || {}), ...(a.requirement_answers || {}) },
      cover_note: a.cover_note,
      utm_source: a.utm_source, utm_medium: a.utm_medium, utm_campaign: a.utm_campaign,
      utm_content: a.utm_content, referrer: a.referrer, landing_path: a.landing_path,
      opportunityId: a.opportunity_id,
    }));
    const jnSubs: Submission[] = ((jn || []) as any[]).map((a) => ({
      id: a.id,
      kind: "join",
      appliedFor: "Join the network",
      outcome: a.status ?? null,
      created_at: a.created_at,
      answers: {
        Qualification: a.qualification,
        "Licensing body": a.licensing_body,
        "Licence number": a.license_number,
        "Years of experience": a.years_experience,
        State: a.state,
        "Primary LGA": a.lga_primary,
        Availability: Array.isArray(a.availability) ? a.availability.join(", ") : a.availability,
        "Right to work": a.right_to_work,
      },
      cover_note: a.message,
      utm_source: a.utm_source, utm_medium: a.utm_medium, utm_campaign: a.utm_campaign,
      utm_content: a.utm_content, referrer: a.referrer, landing_path: a.landing_path,
    }));

    // Their own stated profession, never the job they applied to.
    const jnRow = ((jn || []) as any[])[0];
    const mmRow = ((mm || []) as any[])[0];
    setOwnRoleFallback(
      mmRow?.current_position ||
      (jnRow ? (jnRow.role === "other" ? jnRow.role_other : jnRow.role) || jnRow.qualification : null) ||
      null,
    );

    const all = [...mmSubs, ...jnSubs].sort((x, y) => y.created_at.localeCompare(x.created_at));
    setSubs(all);
    setDocs((d as PersonDocument[]) || []);
    setActivity((act as ActivityRow[]) || []);

    const mmIds = mmSubs.map((s) => s.id);
    if (mmIds.length) {
      const { data: logs } = await adminDb()
        .from("matchmaker_email_log")
        .select("id, application_id, email_type, subject, status, created_at")
        .in("application_id", mmIds)
        .order("created_at", { ascending: false });
      setEmails((logs as EmailLogRow[]) || []);
    } else {
      setEmails([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  // Every campaign and transactional email event for this person.
  useEffect(() => {
    const email = (person as any)?.email as string | undefined;
    if (!email) { setEmailEvents([]); return; }
    emailHistoryFor(email).then(setEmailEvents);
  }, [(person as any)?.email]);

  // Settle what the CV read on its own: values that agree close, blanks fill,
  // and anything genuinely unclear becomes a question in the candidate's own
  // account. Nobody here is asked to arbitrate a document they cannot see.
  useEffect(() => {
    if (!id) return;
    (adminDb() as any).rpc("mu_settle_parsed_fields", { _person_id: id }).then(({ data }: any) => {
      if (data && (data.agreed || data.filled || data.asked)) load();
    });
  }, [id]);

  // Live sync. Anything the candidate changes in their portal (profile fields,
  // uploads, answers to questions, references, preferences, availability)
  // lands on this page within a second, without a refresh.
  useEffect(() => {
    if (!id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => load(), 400);
    };
    const tables = [
      "mu_people", "mu_documents", "mu_parsed_fields", "mu_document_requests",
      "mu_work_preferences", "mu_references", "mu_availability_days",
      "mu_availability_recurrence", "mu_activity",
    ];
    const channel = supabase.channel(`mu-person-${id}`);
    tables.forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter: table === "mu_people" ? `id=eq.${id}` : `person_id=eq.${id}` },
        refresh,
      );
    });
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [id]);


  // Auto-parse: a profile with a CV that has not been read yet gets read now.
  useEffect(() => {
    if (!person || parsing) return;
    const hasCv = docs.some((d) => /\bcv\b|resume|curriculum/i.test(`${d.label} ${d.url}`));
    if (hasCv && ((person as any).parse_status === "not_parsed" || !(person as any).parse_status)) {
      autoParse();
    }
  }, [person, docs]);

  const actor = { id: user?.id ?? null, name: (user as any)?.email ?? null };

  const updatePerson = async (patch: Partial<Person>, action: string) => {
    if (!person) return;
    const { error } = await adminDb().from("mu_people").update(patch).eq("id", person.id);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    setPerson({ ...person, ...patch } as Person);
    await logActivity(person.id, action, patch as any, actor);
    load();
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    await updatePerson({ admin_notes: notes }, "notes_updated");
    setSavingNotes(false);
    toast({ title: "Notes saved" });
  };



  // No percentages and no rings. Readiness is computed in the database from
  // the documents, the record, the questions and the references, so this page
  // and the candidate's own account can never describe it differently.
  const readiness = useReadiness(id, `${docs.length}:${person?.last_activity_at ?? ""}`);

  // The badge needs to know whether the NYSC certificate is still owed, since
  // somebody can be verified with it outstanding.
  const [docReqs, setDocReqs] = useState<DocumentRequirement[]>([]);
  useEffect(() => {
    if (!id) return;
    loadRequirements(id).then(setDocReqs);
  }, [id, docs.length, person?.last_activity_at]);




  // Emails sent and the audit trail are the same story, so they read as one
  // stream rather than two tabs a reader has to interleave in their head.
  // Campaign and transactional events (opens, clicks, bounces) join the same
  // stream so engagement is visible next to the record it belongs to.
  const timeline = useMemo(() => {
    const fromEmails = emails.map((e) => ({
      id: `email-${e.id}`,
      at: e.created_at,
      title: e.email_type === "interview_invite" ? "Interview invitation sent" : "Email sent",
      detail: e.subject,
      status: e.status,
    }));
    const fromEvents = emailEvents.map((e) => {
      const label = (e.template || "Campaign email").replace(/-/g, " ");
      const titles: Record<string, string> = {
        sent: `${label} sent`,
        delivered: `${label} delivered`,
        opened: `${label} opened`,
        clicked: `${label}: link clicked`,
        bounced: `${label} bounced`,
        complained: `${label} marked as spam`,
        failed: `${label} failed to send`,
      };
      return {
        id: `ev-${e.id}`,
        at: e.created_at,
        title: titles[e.event_type] ?? `${label}: ${e.event_type}`,
        detail: e.link_url ?? null,
        status: e.event_type,
      };
    });
    const fromActivity = activity.map((a) => ({
      id: `act-${a.id}`,
      at: a.created_at,
      title: a.action.replace(/_/g, " "),
      detail: a.actor_name ? `by ${a.actor_name}` : null,
      status: null as string | null,
    }));
    return [...fromEmails, ...fromEvents, ...fromActivity].sort((x, y) => y.at.localeCompare(x.at));
  }, [emails, emailEvents, activity]);

  if (loading)
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!person)
    return (
      <div className="border border-line bg-card">
        <MuEmpty
          art={art.objMagnifier}
          title="Profile not found"
          description="This profile no longer exists. It may have been merged into another."
          action={<Button variant="outline" asChild><Link to="/admin/match-universe">Back to talent pool</Link></Button>}
        />
      </div>
    );

  const whatsapp = person.phone ? `https://wa.me/${person.phone.replace(/[^0-9]/g, "")}` : null;
  const profession = person.current_position?.trim() || ownRoleFallback;
  const isStaff = !!(person as any).is_staff;
  // Home address is three separate lines on the record; read as one sentence.
  const addressLine = [
    (person as any).address_line,
    (person as any).address_landmark,
    (person as any).address_area,
  ].filter(Boolean).join(", ") || null;
  // Experience is never asked of the candidate any more, so say where the
  // number on file came from rather than calling it a claim by default.
  const experienceNote =
    (person as any).parse_status === "parsed"
      ? "Read from a document we hold"
      : "Declared on an earlier application, not evidenced";


  return (
    <MuPage className="max-w-6xl">

      {/* One navy surface. The name is the identity, the facts we hold sit
          under it as a labelled grid, and a single action moves the record on.
          The white strip below reads the state of the record in sentences. */}
      <MuHero
        eyebrow="Candidate"
        title={person.full_name || "Unnamed person"}
        watermark={<MuHeroWatermark seed={person.id} />}
        subtitle={
          <>
            {profession || "Profession not recorded yet"}
            {(person as any).track ? `, joined as ${trackLabel((person as any).track).toLowerCase()}` : ""}
          </>
        }
        facts={[
          {
            label: "Email",
            icon: Mail,
            value: person.email ? (
              <a href={`mailto:${person.email}`} className="text-white hover:underline">{person.email}</a>
            ) : null,
          },
          { label: "Phone", icon: Phone, value: person.phone },
          {
            label: "Location",
            icon: MapPin,
            value: [person.lga, person.state].filter(Boolean).join(", ") || null,
          },
          {
            label: "Experience",
            icon: Briefcase,
            value: person.years_experience != null
              ? `${person.years_experience} ${Number(person.years_experience) === 1 ? "year" : "years"}`
              : null,
          },
        ]}
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <VerifiedBadge state={person.verification_state} reqs={docReqs} size="lg" onNavy />
            {parsing && (
              <span className="inline-flex items-center text-[13.5px] text-body-navy">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading the CV
              </span>
            )}
          </div>
        }
        primary={
          isStaff ? (
            <Button size="sm" asChild className="bg-white font-semibold text-navy hover:bg-white/90">
              <Link to={`/admin/workforce/${person.id}`}>
                <IdCard className="mr-2 h-4 w-4" />Open staff record
              </Link>
            </Button>
          ) : person.email ? (
            <Button
              size="sm"
              onClick={invitePortal}
              disabled={inviting}
              className="bg-white font-semibold text-navy hover:bg-white/90"
            >
              {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {person.invited_at ? "Send the invite again" : "Invite to their profile"}
            </Button>
          ) : null
        }
        secondary={
          <>
            {whatsapp && (
              <Button
                variant="outline"
                size="icon"
                asChild
                aria-label="Message on WhatsApp"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /></a>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="More actions"
                  className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={rereadCv} disabled={parsing}>
                  <RefreshCw className="mr-2 h-4 w-4" />Read the CV again
                </DropdownMenuItem>
                {isStaff && person.email && (
                  <DropdownMenuItem onClick={invitePortal} disabled={inviting}>
                    <Send className="mr-2 h-4 w-4" />
                    {person.invited_at ? "Send the invite again" : "Invite to their profile"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setTab("verification")}>
                  <FileText className="mr-2 h-4 w-4" />Open their documents
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTab("profile")}>
                  <Check className="mr-2 h-4 w-4" />Open profile details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTab("activity")}>
                  <MessageCircle className="mr-2 h-4 w-4" />Notes and trail
                </DropdownMenuItem>
                {/* Hiring pathway: moving someone into the staff register only
                    opens the contract. The invitation to sign in stays locked
                    inside the staff record until that contract is signed. */}
                {!isStaff ? (
                  <DropdownMenuItem onSelect={() => setConfirmMove("staff")} disabled={converting}>
                    <IdCard className="mr-2 h-4 w-4" />Move to staff register
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => setConfirmMove("talent")} disabled={converting}>
                    <IdCard className="mr-2 h-4 w-4" />Return to Talent
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <ConfirmAction
              open={confirmMove === "staff"}
              onOpenChange={(o) => !o && setConfirmMove(null)}
              title={`Move ${person.full_name} to the staff register?`}
              description={
                <>
                  <p>They leave the Talent Pool and gain an employment record. Their sign-in, documents and history stay as they are.</p>
                  <p>A signed contract must already be on file.</p>
                </>
              }
              confirmLabel="Move to staff register"
              onConfirm={moveToStaff}
            />
            <ConfirmAction
              open={confirmMove === "talent"}
              onOpenChange={(o) => !o && setConfirmMove(null)}
              title={`Return ${person.full_name} to Talent?`}
              description={<p>Their employment closes. Live assignments or contracts block this until they are resolved. History is kept.</p>}
              confirmLabel="Return to Talent"
              destructive
              onConfirm={moveToTalent}
            />
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <MuTabRail
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "verification", label: "Checks", count: readiness.office.length },
            { value: "profile", label: "Profile" },
            { value: "matching", label: "Matching" },
            { value: "hiring", label: "Offers and contracts" },
            { value: "work", label: "Work" },

            { value: "applications", label: "Applications" },
            { value: "activity", label: "Activity" },
          ]}
        />



        {/* Verification: the required documents and the credentials they earn.
            One tab, because a credential is only ever as good as the document
            behind it. Nothing here is a manual switch. */}
        <TabsContent value="verification" className="space-y-6 mt-4">
          {/* Every required document is in and some wait on us: a nudge to
              review them, shown only until the decisions are made. */}
          {!readiness.loading &&
            readiness.items.some((i) => i.code.startsWith("document_pending:")) &&
            !readiness.items.some((i) => i.code.startsWith("document_missing:") || i.code.startsWith("document_rejected:")) && (
              <div className="flex flex-col gap-3 border-2 border-navy bg-brand p-4 text-white shadow-offset sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[15px] font-extrabold">Every required document is in</p>
                  <p className="mt-1 text-[13.5px] text-white/85">
                    {readiness.office.length === 1 ? "One waits" : `${readiness.office.length} wait`} for a decision. Accepting them verifies {person.full_name?.split(" ")[0] || "this person"}.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-white bg-white text-navy hover:bg-tint"
                  onClick={() => document.getElementById("person-documents")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  Review them
                </Button>
              </div>
            )}
          <ReadinessPanel
            items={readiness.items}
            loading={readiness.loading}
            sentence={readiness.sentence}
          />
          {/* One place to decide: the documents. Accepting one settles the
              credential it proves, so the proofs below are read only. */}
          {/* The documents carry their own ledgers, so they open with the site's
              section rule rather than a second box around boxes. */}
          <div id="person-documents" className="scroll-mt-24">
            <MuSectionOpener label="Documents" title="What is on file, and a decision on each" />
          </div>
          <DocumentsPanel personId={person.id} personName={person.full_name} onChanged={load} />

          <MuSection title="What their documents prove" padded={false}>
            <CredentialsPanel personId={person.id} documents={docs} actor={actor} onChanged={load} />
          </MuSection>


          <MuSection title="References" description="Taken up at shortlist stage.">
            <ReferencesTable personId={person.id} />
          </MuSection>

        </TabsContent>

        {/* Profile: the canonical record, with what we parsed from the CV read
            against it rather than filed somewhere else. */}
        <TabsContent value="profile" className="mt-4 space-y-6">
          <CandidateAccountPanel
            personId={person.id}
            personName={person.full_name}
            email={person.email}
            invitedAt={person.invited_at ?? null}
            claimedAt={person.claimed_at ?? null}
            hasAccount={!!person.auth_user_id}
            onChanged={load}
          />
          {/* One record, said once. Contact details live in the band above;
              the licence has its own place; what the CV says is folded away
              for the moments it is needed. */}
          <MuSection title="About them" padded={false}>
            <MuTable
              className="border-0"
              rows={[
                { label: "Home address", value: addressLine },
                {
                  label: "Sex",
                  value: SEX_OPTIONS.find((o) => o.code === String((person as any).sex ?? "").toLowerCase())?.label ?? null,
                  note: CLAIM_NOTE,
                },
                {
                  label: "Languages",
                  value: Array.isArray(person.languages) ? person.languages.join(", ") : (person.languages as any) ?? null,
                },
              ]}
            />
          </MuSection>

          <MuSection title="Work" padded={false}>
            <MuTable
              className="border-0"
              rows={[
                {
                  label: "Joined as",
                  value: (person as any).track ? trackLabel((person as any).track) : null,
                  note: (person as any).track_source === "candidate_confirmed"
                    ? "Confirmed by the candidate"
                    : (person as any).track_source === "inferred"
                      ? "Worked out from their job title; they confirm it at next sign-in"
                      : undefined,
                },
                { label: "Profession", value: profession, note: CLAIM_NOTE },
                {
                  label: "Years of experience",
                  value: person.years_experience != null ? String(person.years_experience) : null,
                  note: experienceNote,
                },
                // Students only: shown when there is something to show.
                ...[
                  { label: "Institution", value: (person as any).institution ?? null },
                  { label: "Course", value: (person as any).course_of_study ?? null },
                  { label: "Level of study", value: (person as any).study_level ?? null },
                  { label: "Year of study", value: (person as any).year_of_study ?? null },
                  { label: "Expected graduation", value: (person as any).expected_graduation ?? null },
                  { label: "Why they are joining us", value: (person as any).joining_statement ?? null, note: "In place of a second referee" },
                ].filter((row) => row.value),
              ]}
            />
          </MuSection>

          <MuSection title="Licence" padded={false}>
            <MuTable
              className="border-0"
              rows={[
                { label: "Licensing body", value: person.licensing_body, note: CLAIM_NOTE },
                { label: "Licence number", value: person.license_number, note: CLAIM_NOTE },
                {
                  label: "Expiry",
                  value: person.license_expiry ? (
                    <span className="flex flex-wrap items-center gap-2">
                      {format(new Date(String(person.license_expiry)), "d MMM yyyy")}
                      {(() => {
                        const days = Math.ceil((new Date(String(person.license_expiry)).getTime() - Date.now()) / 86400000);
                        return days < 0
                          ? <MuStatus tone="bad" label="Expired" />
                          : days <= 60
                            ? <MuStatus tone="warning" label={`Expires in ${days} days`} />
                            : <MuStatus tone="good" label="In date" />;
                      })()}
                    </span>
                  ) : null,
                  note: CLAIM_NOTE,
                },
              ]}
            />
          </MuSection>

          <Collapsible>
            <MuSection padded={false}>
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-tint/40">
                <span className="text-[17px] font-extrabold tracking-[-0.02em] text-navy">What their CV says</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-navy" aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t-2 border-navy p-5">
                <CvDataTab
                  personId={person.id}
                  parseStatus={(person as any).parse_status ?? "not_parsed"}
                  gaps={Array.isArray((person as any).candidate_gaps) ? (person as any).candidate_gaps : []}
                  actor={actor}
                  onProfileChanged={load}
                />
              </CollapsibleContent>
            </MuSection>
          </Collapsible>
        </TabsContent>


        {/* Matching: fit and availability, the two inputs the matcher reads. */}
        <TabsContent value="matching" className="space-y-6 mt-4">
          <PersonOpportunitiesTab personId={person.id} />
          <MuSection
            title="Work preferences"
            description="Client types, live-in or live-out, shifts and travel. Candidates edit this in their portal; only amend here after phone or email confirmation."
          >
            <WorkPreferencesPanel
              personId={person.id}
              actorName={actor?.name ?? null}
              onSaved={load}
              voice="office"
              track={(person as any).track}
            />
          </MuSection>
          <MuSection
            title="Availability"
            description="Set by the candidate in their portal. Unfilled days count as unconfirmed, not unavailable, and outdated availability is discounted when matching."
          >
            <AvailabilityCalendar personId={person.id} lastUpdate={(person as any).last_availability_update} readOnly />
            <div className="mt-6 border-t border-line pt-5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-label">Day by day, with the hours they named</p>
              <AvailabilityDetail personId={person.id} />
            </div>
          </MuSection>
        </TabsContent>

        {/* Offers and contracts: hiring this person, from the offer they were
            sent to the contract it turns into. Both are written from their own
            record, so nothing is retyped. */}
        <TabsContent value="hiring" className="space-y-6 mt-4">
          <HirePanel personId={person.id} person={person} onChanged={load} />
        </TabsContent>

        {/* Work: the engagement they are on, and their leave. */}
        <TabsContent value="work" className="space-y-6 mt-4">
          <WorkPanel personId={person.id} personName={person.full_name} include={["engagements", "leave"]} onChanged={load} />
        </TabsContent>



        {/* Applications: where each role stands, then the record behind it. */}
        <TabsContent value="applications" className="space-y-6 mt-4">
          <ApplicationStages personId={person.id} onChanged={load} />
          <MuSection
            title="What was submitted"
            description="The form each application arrived on, the answers given and where the visit came from."
            padded={false}
          >
            {subs.length === 0 && (
              <MuEmpty art={art.objClipboard} title="No applications recorded" description="This profile was created through another route." />
            )}
            {/* One line per application, everything else folded away. The
                header carries what you scan for; the detail is there when you
                actually want it. */}
            <Accordion type="multiple" className="divide-y divide-border/60">
              {subs.map((s) => {
                const attribution = [
                  ["Source", sourceOf(s)],
                  ["Campaign", s.utm_campaign],
                  ["Medium", s.utm_medium],
                  ["Content", s.utm_content],
                  ["Referrer", s.referrer],
                  ["Landing page", s.landing_path],
                ].filter(([, v]) => v) as [string, string][];
                const answers = Object.entries(s.answers)
                  .map(([k, v]) => ({ label: answerLabel(k), value: answerValue(v) }))
                  .filter((r) => r.label);
                const hasDetail = attribution.length > 0 || answers.length > 0 || !!s.cover_note;

                return (
                  <AccordionItem key={s.id} value={s.id} className="border-0">
                    <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 hover:bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">
                          {s.appliedFor || "Join the network"}
                        </p>
                        {/* Route, date and source each get their own icon so
                            the line scans without punctuation doing the work. */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" />
                            {s.kind === "matchmaker" ? "Matchmaker" : "Join network"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {format(new Date(s.created_at), "d MMM yyyy")}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Compass className="h-3.5 w-3.5" />
                            {sourceOf(s)}
                          </span>
                        </div>
                      </div>
                      {/* No stage chip and no role link here. Both belong to
                          the stage list above; this section is the paperwork. */}

                      {hasDetail && (
                        <AccordionTrigger className="h-8 shrink-0 px-2 py-0 text-[13px] font-semibold hover:no-underline">
                          Detail
                        </AccordionTrigger>
                      )}

                    </div>
                    <AccordionContent className="space-y-4 px-5 pb-4">
                      {s.cover_note && (
                        <p className="whitespace-pre-wrap bg-muted/40 p-3 text-sm">{s.cover_note}</p>
                      )}
                      {answers.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">
                            Application answers
                          </p>
                          <MuTable rows={answers} />
                        </div>
                      )}
                      {attribution.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">
                            How they found us
                          </p>
                          <MuTable rows={attribution.map(([label, value]) => ({ label, value }))} />
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </MuSection>
        </TabsContent>

        {/* Activity: notes, every email we sent and the audit trail, in order. */}
        <TabsContent value="activity" className="space-y-4 mt-4">
          <MuSection title="Internal notes" description="Visible to the team only.">
            <div className="space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="Internal notes about this person"
              />
              <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                {savingNotes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save notes
              </Button>
            </div>
          </MuSection>
          <MuSection
            title="Activity log"
            description="Every email sent and every change made, in order."
            padded={false}
          >
            {timeline.length === 0 && <MuEmpty art={art.objEnvelope} title="Nothing recorded yet" description="Emails sent and changes made to this profile appear here." />}
            <div className="divide-y divide-line-soft">
            {timeline.map((t) => (
              <MuRow
                key={t.id}
                title={t.title}
                state={t.detail || undefined}
                status={t.status ? <MuStatus tone={t.status === "sent" ? "good" : "warning"} label={humaniseTerm(t.status)} /> : undefined}
                action={
                  <span className="text-[13px] tabular-nums text-muted-foreground">
                    {format(new Date(t.at), "d MMM yyyy, HH:mm")}
                  </span>
                }
              />
            ))}
            </div>

          </MuSection>
        </TabsContent>
      </Tabs>
    </MuPage>
  );
};

export default MatchUniversePerson;
