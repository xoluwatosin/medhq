// The pre-assessment, answered from a link.
//
// First the intake: who is asking, who is receiving care and what each of them
// needs. Nothing clinical is asked until that is settled, because who the care
// is for, how old they are and which service is wanted decide every question
// that follows.
//
// Then the questions. Some are asked once for the whole request; the rest are
// asked once for each care recipient and held under that person's own key, so
// a mother and her newborn on one request never overwrite each other. Answers
// save as they are typed and the link resumes where it was left. After it is
// sent it stays readable, because the person who filled it in should be able to
// see what we hold about them without asking anyone.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronDown, Loader2, Pencil } from "lucide-react";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { FormPage, PrimaryAction, SecondaryAction } from "@/components/request/FormSurface";
import {
  ChapterCover, HELP_PHONE, MenuChapter, MenuSheet, Thanks, Welcome,
} from "@/components/care/PreAssessmentParts";
import { art } from "@/components/mc/art";
import { Question } from "@/components/request/RequestShell";
import CareFieldInput from "@/components/care/CareFieldInput";
import { CareIntakeFlow } from "@/components/care/CareIntakeSteps";
import { SaveState, useAutosave } from "@/components/field";
import { cn } from "@/lib/utils";
import {
  applicableSections, buildContext, CareCondition, CareDefinition, CareField, CareOption, CareResponses,
  CareSection, fieldVisible, isAnswered, pruneHiddenFieldAnswers, readAnswer, withDerived,
} from "@/lib/care";
import {
  answersForRecipient, CareIntake, CareIntakeSeed, emptyIntake, intakeRoutingAnswers, IntakeRecipient, mergeIntakeSeed,
  recipientName, scopedKey, sectionKeysFor, sectionScope,
} from "@/lib/care-intake";
import { buildItinerary, ItineraryPage } from "@/lib/care-itinerary";
import { resolveCopy, voiceFor } from "@/lib/care-copy";
import {
  ChapterKey, chapterLine, chapterOf, chapterTitle, inChapterOrder, minutesFor,
} from "@/lib/care-chapters";

interface LoadResult {
  frozen: boolean;
  submitted_at: string | null;
  document_id?: string | null;
  // A top-up asks only about a service recorded after the family answered.
  scope?: "full" | "top_up";
  covers_services?: string[] | null;
  covers_recipient_key?: string | null;
  // Answers may still be corrected until the assessment visit opens.
  amendable?: boolean;
  visit_started?: boolean;
  definition: CareDefinition;
  context: { client_group: string | null; service_key: string | null; service_name: string | null };
  prefill: Record<string, string>;
  intake_seed?: CareIntakeSeed | null;
  budget_bands: { value: string; label: string }[];
  responses: CareResponses;
  outstanding_required: { id: string; record: string }[];
  person: { preferred_name: string | null };
  filler: { type: string; name: string | null; relationship: string | null };
  position?: { section?: string | null; page?: string | null; recipient_id?: string | null } | null;
}

/** A page in the flow, and the person it is being asked about. */
type FlowPage = ItineraryPage & { recipientId: string | null; who: string | null; chapter?: ChapterKey };

/** One block of answers in review: the request, or one care recipient. */
interface AnswerGroup {
  recipientId: string | null;
  label: string | null;
  sections: CareSection[];
  answers: CareResponses;
}

const PreAssessment = () => {
  const { token = "" } = useParams();
  // Opened from the client record by staff filling the form in with the family.
  const [searchParams] = useSearchParams();
  const staffFill = searchParams.get("staff") === "1";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LoadResult | null>(null);
  const [responses, setResponses] = useState<CareResponses>({});
  const [pageKey, setPageKey] = useState<string>("welcome");
  const [submitting, setSubmitting] = useState(false);
  const [consentWarning, setConsentWarning] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // A correction to answers already sent, allowed until the visit opens.
  const [amending, setAmending] = useState<{ recipientId: string | null; sectionId: string } | null>(null);
  const [amendDraft, setAmendDraft] = useState<CareResponses>({});
  const [amendSaving, setAmendSaving] = useState(false);
  const [amendError, setAmendError] = useState<string | null>(null);
  const [amendNote, setAmendNote] = useState<string | null>(null);
  const positionRef = useRef<{ section: string | null; page: string | null; recipient_id: string | null }>({
    section: null, page: null, recipient_id: null,
  });

  // An answer stays pending until the server says it has it. Nothing is
  // cleared because a request was started.
  const saveResponses = useCallback(async (patch: CareResponses) => {
    const { data: result, error: invokeError } = await supabase.functions.invoke("care-form-save", {
      body: { token, responses: patch, mode: "autosave", position: positionRef.current },
    });
    return !invokeError && !!result?.ok;
  }, [token]);

  const autosave = useAutosave<unknown>({ save: saveResponses });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: result, error: invokeError } = await supabase.functions.invoke("care-form-load", {
        body: { token },
      });
      if (cancelled) return;
      if (invokeError || !result?.ok) {
        setError(result?.error ?? "This link is not valid. Ask us for a new one.");
        setLoading(false);
        return;
      }
      const loaded = result as LoadResult;
      const loadedResponses = loaded.responses ?? {};
      const savedIntake = loadedResponses.care_intake as CareIntake | undefined;
      const seededIntake = mergeIntakeSeed(loaded.intake_seed, savedIntake);
      setData(loaded);
      setResponses({ ...loadedResponses, care_intake: seededIntake });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const setAnswer = (id: string, value: unknown) => {
    const clean = isAnswered(value) ? value : null;
    setResponses((prev) => {
      const next = { ...prev, [id]: clean };
      autosave.queue(id, clean);
      if (!data || id === "care_intake") return next;

      const owner = /^r\d+__/.exec(id)?.[0]?.slice(0, -2) ?? null;
      // Visibility is judged with the intake's facts, exactly as the pages are.
      const held = (next.care_intake as CareIntake | undefined) ?? emptyIntake();
      const ownerRecipient = owner ? held.recipients.find((r) => r.id === owner) : undefined;
      const local = owner
        ? withDerived({
          ...answersForRecipient(next, owner),
          ...(ownerRecipient ? intakeRoutingAnswers(held, ownerRecipient) : {}),
          service_requested: ownerRecipient ? sectionKeysFor(ownerRecipient)[0] ?? null : null,
        }, { recordedService: data.context.service_key })
        : next;
      const fields = data.definition.sections.flatMap((section) => section.fields);
      const pruned = pruneHiddenFieldAnswers(fields, local);
      for (const field of fields) {
        if (pruned[field.id] !== null || !isAnswered(local[field.id])) continue;
        const hiddenKey = scopedKey(owner, field.id);
        next[hiddenKey] = null;
        autosave.queue(hiddenKey, null);
      }
      return next;
    });
  };

  /* ---- the intake ------------------------------------------------------ */

  const intake = useMemo<CareIntake>(
    () => (responses.care_intake as CareIntake | undefined) ?? emptyIntake(),
    [responses.care_intake],
  );

  const setIntake = (next: CareIntake) => setAnswer("care_intake", next);

  const readOnly = !!data?.frozen;
  const intakeDone = !!intake.confirmed && intake.recipients.length > 0;

  /* ---- what is asked, of whom ------------------------------------------ */

  // The answers one care recipient's routing is worked out from: their own
  // answers, plus the facts the intake already settled about them.
  const routingAnswers = useCallback(
    // With the derived facts (age, group, service) included, so a question's
    // own condition can read them exactly as a section's can.
    (r: IntakeRecipient): CareResponses => withDerived({
      ...answersForRecipient(responses, r.id),
      ...intakeRoutingAnswers(intake, r),
      service_requested: sectionKeysFor(r)[0] ?? data?.context.service_key ?? null,
    }, { recordedService: data?.context.service_key ?? null }),
    [responses, data, intake],
  );

  const topUp = data?.scope === "top_up";
  const coversServices = data?.covers_services ?? null;
  const topUpPerson = topUp
    ? intake.recipients.find((r) => r.id === data?.covers_recipient_key) ?? null
    : null;
  const topUpName = topUpPerson ? recipientName(topUpPerson) : null;

  // Every section that applies to one care recipient, across all of the
  // services chosen for that person, in the order the definition holds them.
  const sectionsFor = useCallback(
    (r: IntakeRecipient, keys: (string | null)[]): Map<string, CareSection> => {
      const found = new Map<string, CareSection>();
      if (!data) return found;
      const answers = routingAnswers(r);
      for (const key of keys.length ? keys : [data.context.service_key]) {
        const ctx = buildContext(data.definition, {
          clientGroup: data.context.client_group,
          serviceKey: key ?? null,
          responses: { ...answers, service_requested: key ?? null },
        });
        for (const section of applicableSections(data.definition, ctx)) found.set(section.id, section);
      }
      return found;
    },
    [data, routingAnswers],
  );

  const sectionsForRecipient = useCallback(
    (r: IntakeRecipient): CareSection[] => {
      if (!data) return [];
      const allServices = sectionKeysFor(r);
      // A top-up asks only what the service added later brings with it.
      // Anything already asked for the services on the original request stays
      // as it was answered.
      if (topUp && coversServices && coversServices.length > 0) {
        const covered = new Set(coversServices);
        const previousServices = allServices.filter((key) => !covered.has(key));
        // "unknown" still selects always-on sections, so common questions are
        // not repeated when this is the first newly recorded service.
        const previous = sectionsFor(r, previousServices.length ? previousServices : ["unknown"]);
        const added = sectionsFor(r, coversServices);
        return data.definition.sections.filter((s) => added.has(s.id) && !previous.has(s.id));
      }
      const found = sectionsFor(r, allServices);
      return data.definition.sections.filter((s) => found.has(s.id));
    },
    [data, sectionsFor, topUp, coversServices],
  );

  // Each person in turn, then what is asked once for the whole request. A
  // top-up carries no request questions: the shared answers stand, and it asks
  // about one person only.
  const groups = useMemo<AnswerGroup[]>(() => {
    if (!data || !intakeDone) return [];
    if (topUp && !topUpPerson) return [];
    const first = intake.recipients[0];
    const requestSections = topUp
      ? []
      : sectionsForRecipient(first).filter((s) => sectionScope(s.id) === "request");
    const out: AnswerGroup[] = [];
    const asked = topUp && data.covers_recipient_key
      ? intake.recipients.filter((r) => r.id === data.covers_recipient_key)
      : intake.recipients;
    for (const r of asked) {
      out.push({
        recipientId: r.id,
        label: r.isEnquirer ? "You" : recipientName(r) || "Care recipient",
        sections: sectionsForRecipient(r).filter((s) => sectionScope(s.id) === "recipient"),
        answers: routingAnswers(r),
      });
    }
    out.push({ recipientId: null, label: null, sections: requestSections, answers: responses });
    return out;
  }, [data, intake, intakeDone, responses, routingAnswers, sectionsForRecipient, topUp, topUpPerson]);

  // A first name for the chapter titles, or null when the person answering is
  // the one receiving care.
  const firstNameOf = useCallback((recipientId: string | null): string | null => {
    const r = intake.recipients.find((x) => x.id === recipientId);
    if (!r || r.isEnquirer) return null;
    return r.firstName?.trim() || recipientName(r) || null;
  }, [intake]);
  const several = intake.recipients.length > 1;

  // Worked out again on every answer, because one answer can open or close a
  // whole section partway through. The sections are laid out in chapters, and
  // each chapter opens with a page of its own.
  const pages = useMemo<FlowPage[]>(() => {
    if (groups.length === 0) return [];
    const out: FlowPage[] = [{ key: "welcome", kind: "welcome", fields: [], recipientId: null, who: null }];
    for (const group of groups) {
      const sections = inChapterOrder(group.sections.filter((s) => chapterOf(s.id) !== null));
      if (sections.length === 0) continue;
      const built = buildItinerary(sections, group.answers).filter((p) => p.kind === "questions");
      let open: ChapterKey | null = null;
      for (const p of built) {
        const chapter = chapterOf(p.sectionId ?? "") ?? "about";
        if (chapter !== open) {
          open = chapter;
          out.push({
            key: `${group.recipientId ?? "request"}:chapter:${chapter}`,
            kind: "cover",
            fields: [],
            recipientId: group.recipientId,
            who: group.label,
            chapter,
          });
        }
        out.push({
          ...p,
          key: group.recipientId ? `${group.recipientId}:${p.key}` : p.key,
          recipientId: group.recipientId,
          who: group.label,
          chapter,
        });
      }
    }
    out.push({ key: "review", kind: "review", fields: [], recipientId: null, who: null });
    const covers = out.filter((p) => p.kind === "cover");
    let number = 0;
    for (const p of out) {
      if (p.kind === "cover") number += 1;
      if (p.kind === "cover" || p.kind === "questions") { p.sectionNumber = number; p.sectionCount = covers.length; }
    }
    return out;
  }, [groups]);

  // Resume near where this link was left. A page that no longer applies falls
  // back to the start of the flow.
  const resumed = useRef(false);
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    if (resumed.current || !data || pages.length === 0) return;
    resumed.current = true;
    const saved = data.position ?? null;
    const key = saved?.page ?? null;
    const found = pages.find((p) => p.key === key)?.key ?? null;
    setReturning(!!found && found !== "welcome");
    setPageKey(found ?? "welcome");
  }, [data, pages]);

  const index = Math.max(pages.findIndex((p) => p.key === pageKey), 0);
  const page = pages[index];

  const recipientOf = (id: string | null) => intake.recipients.find((r) => r.id === id) ?? null;

  // The wording follows whoever the page is about.
  const voice = useMemo(() => {
    const r = recipientOf(page?.recipientId ?? null);
    if (!r) {
      // A request-wide page is about the one person asking, when they are the
      // only person receiving care: never their own name in the third person.
      const only = intake.recipients.length === 1 ? intake.recipients[0] : null;
      if (only?.isEnquirer) return voiceFor({ who_for: "myself" }, null);
      return voiceFor(responses, data?.person.preferred_name ?? null);
    }
    return voiceFor(
      {
        who_for: r.isEnquirer ? "myself" : "someone_else",
        recipient_first_name: r.firstName,
        intake_newborn_names: intakeRoutingAnswers(intake, r).intake_newborn_names,
        is_parent_guardian: intakeRoutingAnswers(intake, r).intake_filler_parent === "yes"
          ? "yes"
          : answersForRecipient(responses, r.id).is_parent_guardian,
      },
      data?.person.preferred_name ?? null,
    );
  }, [page, intake, responses, data]);
  const say = useCallback((text?: string | null) => resolveCopy(text, voice), [voice]);

  const sectionById = useMemo(() => {
    const map: Record<string, CareSection> = {};
    for (const group of groups) for (const s of group.sections) map[s.id] = s;
    return map;
  }, [groups]);

  // The questions an answer can open. Such a question is never skipped past
  // on its own, because what it opens appears on the same screen.
  const opensFollowUps = useMemo(() => {
    const named = new Set<string>();
    const walk = (c: CareCondition | undefined) => {
      if (!c) return;
      if (c.field) named.add(c.field);
      c.allOf?.forEach(walk);
      c.anyOf?.forEach(walk);
      walk(c.not);
    };
    for (const section of data?.definition.sections ?? []) for (const f of section.fields) walk(f.showWhen);
    return named;
  }, [data]);

  const bandOptions = useMemo<CareOption[]>(
    () => (data?.budget_bands ?? []).map((b) => ({ value: b.value, label: b.label })),
    [data],
  );
  const bandLabels = useMemo(
    () => Object.fromEntries((data?.budget_bands ?? []).map((b) => [b.value, b.label])),
    [data],
  );

  /**
   * Who could be at the assessment visit, from the care recipients this
   * request actually holds. Where the person answering is also receiving
   * care, they appear once: "the person receiving care" and "me" can never
   * be offered as two contradictory answers.
   */
  const recipientAttendeeOptions = (field: CareField): CareOption[] => {
    const named = intake.recipients.map((r) => ({
      value: r.id,
      label: r.isEnquirer
        ? `${recipientName(r) || "Me"} (you, receiving care)`
        : recipientName(r) || "The person receiving care",
    }));
    const someoneElseAnswers = !intake.recipients.some((r) => r.isEnquirer);
    const rest = (field.options ?? []).filter(
      (o) => o.value !== "recipient" && o.value !== "respondent",
    );
    return [
      ...named,
      ...(someoneElseAnswers ? [{ value: "respondent", label: "Me" }] : []),
      ...rest,
    ];
  };

  /**
   * The people this request already holds, so an alternative contact who is
   * already named is pointed out rather than recorded twice.
   */
  const knownPeople = intake.recipients
    .map((r) => ({ name: recipientName(r), role: r.isEnquirer ? "the person asking" : "a person receiving care" }))
    .filter((p) => p.name)
    .concat(
      [intake.enquirer]
        .map((e) => ({ name: [e.firstName, e.lastName].filter(Boolean).join(" ").trim(), role: "the person asking" }))
        .filter((p) => p.name),
    );

  const optionsFor = (field: CareField): CareOption[] => {
    if (field.optionsFrom === "care_recipients") return recipientAttendeeOptions(field);
    return (field.type === "budget_band" ? bandOptions : field.options ?? []).map((o) => ({
      ...o,
      label: say(o.label),
    }));
  };

  /** A question with the list it is actually offered with, so it reads back in words. */
  const resolved = (field: CareField): CareField => ({ ...field, options: optionsFor(field) });

  const goTo = (key: string) => {
    const target = pages.find((p) => p.key === key);
    positionRef.current = {
      section: target?.sectionId ?? null,
      page: target?.key ?? null,
      recipient_id: target?.recipientId ?? null,
    };
    setPageKey(key);
    window.scrollTo({ top: 0 });
  };

  const goNext = async () => {
    await autosave.flush();
    const next = pages[Math.min(index + 1, pages.length - 1)];
    if (next) goTo(next.key);
  };
  // A single choice moves on by itself, a moment after it is picked. The
  // latest pages are read when it fires, not the ones it was set up with.
  const nextRef = useRef(goNext);
  nextRef.current = goNext;
  const advanceTimer = useRef<number | null>(null);
  useEffect(() => () => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current); }, []);

  const goBack = () => {
    const previous = pages[Math.max(index - 1, 0)];
    if (previous) goTo(previous.key);
  };

  const submit = async () => {
    // Answers must be on the server before it is sent.
    const saved = await autosave.flush();
    if (!saved) {
      setSubmitError(true);
      return;
    }
    setSubmitError(false);
    setSubmitting(true);
    const { data: result } = await supabase.functions.invoke("care-form-save", {
      body: { token, responses: {}, mode: "submit" },
    });
    setSubmitting(false);
    if (result?.ok) {
      setConsentWarning(false);
      setData((prev) => (prev ? { ...prev, frozen: true, submitted_at: new Date().toISOString(), amendable: true } : prev));
      window.scrollTo({ top: 0 });
    } else {
      setConsentWarning(true);
    }
  };

  // What was sent stays as it was sent. A correction is recorded against it,
  // and only until the assessment visit opens.
  const saveAmendment = async () => {
    if (!amending || !data?.document_id) return;
    const changes = Object.fromEntries(
      Object.entries(amendDraft).filter(([key, value]) => value !== responses[key]),
    );
    if (Object.keys(changes).length === 0) {
      setAmending(null);
      return;
    }
    setAmendSaving(true);
    setAmendError(null);
    const { data: result } = await supabase.functions.invoke("care-form-save", {
      body: {
        token,
        mode: "amend",
        document_id: data.document_id,
        section_id: amending.sectionId,
        responses: changes,
      },
    });
    setAmendSaving(false);
    if (result?.ok) {
      setResponses((prev) => ({ ...prev, ...changes }));
      setAmending(null);
      setAmendDraft({});
      setAmendNote("Your change has been recorded. The nurse will see it before the visit.");
      window.scrollTo({ top: 0 });
    } else {
      setAmendError(result?.error ?? "That change could not be saved. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy" role="status">
        <Loader2 className="h-7 w-7 animate-spin text-white" aria-hidden="true" />
        <span className="sr-only">Opening your questions</span>
      </div>
    );
  }

  const seo = (
    <SEO
      title="Medic Connect | Before your visit"
      description="Please complete these questions before your care assessment."
      path="/pre-assessment"
      breadcrumbs={[]}
      noindex
    />
  );
  const staffBanner = staffFill ? (
    <div className="sticky top-0 z-50 bg-brand px-4 py-2 text-center text-[13px] font-bold text-white">
      You are filling this in with the family. Ask each question as it is written.
    </div>
  ) : null;

  if (error || !data) {
    return (
      <>
        {seo}
        <FormPage eyebrow="Before your visit" title="Before your visit">
          <Question heading="We could not open this form" stepKey="error">
            <p className="text-[16px] leading-relaxed text-body">{error}</p>
            <p className="mt-3 text-[16px] leading-relaxed text-body">
              Call or WhatsApp us on {HELP_PHONE} and we will send a new link.
            </p>
          </Question>
        </FormPage>
      </>
    );
  }

  interface ShellOptions {
    heading?: React.ReactNode;
    progress?: number | null;
    chip?: React.ReactNode;
    status?: React.ReactNode;
    footer?: React.ReactNode;
    menu?: boolean;
  }

  // Who and what the page is for, for the art and the welcome.
  const firstRecipient = intake.recipients[0] ?? null;
  const mainService = firstRecipient ? sectionKeysFor(firstRecipient)[0] ?? data.context.service_key : data.context.service_key;
  const serviceArt = (() => {
    switch (mainService) {
      case "eldercare": return art.elderWomanAdire;
      case "postnatal_mother": case "postnatal_baby": case "newborn": return art.postnatalSpecialist;
      case "antenatal": return art.midwifePregnantBp;
      case "nanny": return art.nannyReading;
      case "paediatric": case "additional_needs": return art.therapistBoyBlocks;
      case "post_surgical": return art.manCrutches;
      default: return art.charCaregiver;
    }
  })();
  const chapterArt: Record<ChapterKey, string> = {
    about: art.objHandsHeart,
    health: art.objStethoscope,
    daily: mainService === "eldercare" ? art.objWalkingFrame : art.objMeal,
    support: art.objPhoneChat,
    when: art.objCalendar,
  };
  const fillerFirst = (intake.enquirer.firstName || data.filler.name?.split(" ")[0] || "").trim() || null;

  const covers = pages.filter((p) => p.kind === "cover");
  const titleOf = (p: FlowPage) => chapterTitle(p.chapter ?? "about", firstNameOf(p.recipientId));
  const whoOf = (p: FlowPage) => (several && p.recipientId ? p.who : null);

  // Where each chapter stands, for the menu.
  const chapterState = (cover: FlowPage): "done" | "current" | "todo" => {
    if (page?.chapter === cover.chapter && page?.recipientId === cover.recipientId && page.kind !== "review") return "current";
    const asked = pages.filter((p) => p.kind === "questions" && p.chapter === cover.chapter && p.recipientId === cover.recipientId);
    const answered = asked.some((p) => p.fields.some((f) => isAnswered(responses[scopedKey(p.recipientId, f.id)])));
    return answered ? "done" : "todo";
  };
  const menuChapters: MenuChapter[] = covers.map((c) => ({
    key: c.key,
    title: titleOf(c),
    who: whoOf(c),
    state: chapterState(c),
    onGo: () => goTo(c.key),
  }));

  const shell = (children: React.ReactNode, options: ShellOptions = {}) => (
    <>
      {seo}
      {staffBanner}
      <FormPage
        eyebrow="Before your visit"
        title="Before your visit"
        heading={options.heading}
        progress={options.progress ?? null}
        chip={options.chip}
        status={options.status}
        footer={options.footer}
        onMenu={options.menu ? () => setMenuOpen(true) : undefined}
      >
        {children}
      </FormPage>
      {options.menu && (
        <MenuSheet
          open={menuOpen}
          onOpenChange={setMenuOpen}
          chapters={menuChapters}
          onReview={() => goTo("review")}
        />
      )}
    </>
  );

  /** One care recipient's answers, or the request's, written out by chapter. */
  const groupAnswers = (group: AnswerGroup, onEdit?: (sectionId: string) => void) => {
    const byChapter = new Map<ChapterKey, CareSection[]>();
    for (const s of inChapterOrder(group.sections)) {
      const chapter = chapterOf(s.id);
      if (!chapter) continue;
      byChapter.set(chapter, [...(byChapter.get(chapter) ?? []), s]);
    }
    return [...byChapter.entries()].map(([chapter, sections]) => {
      const blocks = sections.map((s) => {
        const shown = s.fields
          .filter((f) => fieldVisible(f, group.answers))
          .filter((f) => f.type !== "checkbox")
          .filter((f) => isAnswered(responses[scopedKey(group.recipientId, f.id)]));
        if (shown.length === 0) return null;
        return (
          <div key={s.id} className="border-t border-hairline-warm pt-4 first:border-t-0 first:pt-0">
            <div className="flex items-start justify-between gap-4">
              {/* A section named like its chapter would say the same thing twice. */}
              {say(s.title)?.toLowerCase() === chapterTitle(chapter, firstNameOf(group.recipientId)).toLowerCase()
                ? <span />
                : <h3 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-label">{say(s.title)}</h3>}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(s.id)}
                  className="-mt-1 inline-flex min-h-9 shrink-0 items-center gap-1.5 text-[14px] font-extrabold text-brand"
                  aria-label={`Change ${say(s.title)}`}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Change
                </button>
              )}
            </div>
            <dl className="mt-2 flex flex-col">
              {shown.map((f) => (
                <div key={f.id} className="py-2">
                  <dt className="text-[14px] font-bold leading-snug text-body">{say(f.record)}</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-[16px] font-semibold leading-relaxed text-ink">
                    {readAnswer(resolved(f), responses[scopedKey(group.recipientId, f.id)], bandLabels)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      }).filter(Boolean);
      if (blocks.length === 0) return null;
      return (
        <section key={`${group.recipientId ?? "request"}:${chapter}`} className="border-2 border-navy bg-card p-4 shadow-offset-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <img src={chapterArt[chapter]} alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain" />
            <h2 className="text-[19px] font-extrabold leading-tight tracking-[-0.035em] text-navy">
              {chapterTitle(chapter, firstNameOf(group.recipientId))}
              {several && group.label && chapter !== "when" && <span className="ml-2 text-[13px] font-bold tracking-normal text-label">{group.label}</span>}
            </h2>
          </div>
          <div className="flex flex-col gap-4">{blocks}</div>
        </section>
      );
    });
  };

  /* ---- Sent, and read back ------------------------------------------- */

  if (readOnly) {
    const canAmend = !!data.amendable && !!data.document_id;
    const editing = amending
      ? groups.find((g) => g.recipientId === amending.recipientId)?.sections
          .find((s) => s.id === amending.sectionId) ?? null
      : null;
    const editingGroup = amending
      ? groups.find((g) => g.recipientId === amending.recipientId) ?? null
      : null;

    if (editing && editingGroup) {
      return shell(
        <Question heading={say(editing.title)} stepKey={editing.id}>
          <div className="mt-2 flex flex-col gap-8">
            {editing.fields
              .filter((f) => fieldVisible(f, editingGroup.answers))
              .map((field) => {
                const key = scopedKey(editingGroup.recipientId, field.id);
                return (
                  <div key={key}>
                    {field.type !== "checkbox" && (
                      <p className="text-[19px] font-extrabold leading-[1.2] tracking-[-0.03em] text-navy">{say(field.asked)}</p>
                    )}
                    <div className={field.type === "checkbox" ? "" : "mt-4"}>
                      <CareFieldInput
                        field={field}
                        value={key in amendDraft ? amendDraft[key] : responses[key]}
                        options={optionsFor(field)}
                        onChange={(value) => setAmendDraft((prev) => ({ ...prev, [key]: value }))}
                        token={token}
                        recipientId={editingGroup.recipientId}
                        responses={field.source
                          ? { [field.source]: responses[scopedKey(editingGroup.recipientId, field.source)] }
                          : undefined}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          {amendError && (
            <p className="mt-5 border-l-4 border-price bg-tint px-4 py-3 text-[15px] font-bold leading-relaxed text-navy">{amendError}</p>
          )}
        </Question>,
        {
          heading: "Change an answer",
          footer: (
            <>
              <PrimaryAction onClick={saveAmendment} disabled={amendSaving}>
                {amendSaving ? "Saving" : "Save change"}
              </PrimaryAction>
              <SecondaryAction onClick={() => { setAmending(null); setAmendError(null); }}>
                Cancel
              </SecondaryAction>
            </>
          ),
        },
      );
    }

    return (
      <>
        {seo}
        <Thanks
          first={fillerFirst}
          art={serviceArt}
          staffBanner={staffBanner}
          steps={[
            { title: "We call you to book the visit", line: "We arrange a time for the home assessment that suits you." },
            { title: "The assessment visit", line: "We go through these answers with you, see the home and agree what care is needed." },
            { title: "Your care offer", line: "We send you the options and prices, ready for you to choose." },
          ]}
        >
          {amendNote && (
            <p className="mt-8 border-l-4 border-brand bg-tint px-4 py-3.5 text-[15px] font-bold leading-relaxed text-navy">{amendNote}</p>
          )}
          <details className="group mt-10 border-t-4 border-navy pt-4" open={!!amendNote}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-[18px] font-extrabold tracking-[-0.03em] text-navy [&::-webkit-details-marker]:hidden">
              See your answers
              <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="mt-2 text-[15px] leading-[1.6] text-body">
              {canAmend
                ? "You can still change these until the assessment visit. After that, changes are made with us on the day."
                : `Changes are now made with us on the day. Call us on ${HELP_PHONE} if something urgent has changed.`}
            </p>
            <div className="mt-5 flex flex-col gap-5">
              {groups.map((group) => (
                <div key={group.recipientId ?? "request"} className="flex flex-col gap-5">
                  {groupAnswers(
                    group,
                    canAmend
                      ? (sectionId) => {
                          setAmendDraft({});
                          setAmendError(null);
                          setAmendNote(null);
                          setAmending({ recipientId: group.recipientId, sectionId });
                          window.scrollTo({ top: 0 });
                        }
                      : undefined,
                  )}
                </div>
              ))}
            </div>
          </details>
        </Thanks>
      </>
    );
  }

  /* ---- The intake, before anything is asked --------------------------- */

  if (!intakeDone) {
    return (
      <>
        {seo}
        {staffBanner}
        <CareIntakeFlow
          intake={intake}
          seeded={!!data.intake_seed}
          onChange={setIntake}
          onComplete={() => {
            // Read what is held now, not what this render closed over, so a
            // choice made on the same screen is never dropped.
            setResponses((prev) => {
              const held = (prev.care_intake as CareIntake | undefined) ?? intake;
              const next = { ...held, confirmed: true };
              autosave.queue("care_intake", next);
              return { ...prev, care_intake: next };
            });
            void autosave.flush();
            setPageKey("welcome");
            window.scrollTo({ top: 0 });
          }}
        />
      </>
    );
  }

  if (topUp && !topUpPerson) {
    return shell(
      <Question heading="We could not match these questions to the care recipient" stepKey="unmatched">
        <p className="text-[16px] leading-relaxed text-body">
          No answers have been changed. Please ask Medic Connect to send a new link for the correct person.
        </p>
      </Question>,
    );
  }

  /* ---- Still being answered ------------------------------------------- */

  const questionCount = (list: FlowPage[]) =>
    list.reduce((n, p) => n + p.fields.filter((f) => f.type !== "checkbox").length, 0);

  const renderField = (field: CareField, onlyOne: boolean) => {
    // A tick box carries its own wording, so heading it as well would say the
    // same thing twice.
    const selfLabelled = field.type === "checkbox";
    const key = scopedKey(page?.recipientId ?? null, field.id);
    const autoAdvance = onlyOne && (field.type === "choice" || field.type === "yes_no") && !opensFollowUps.has(field.id);
    return (
      <fieldset key={key} className="min-w-0 border-t-2 border-hairline-warm pt-7 first:border-t-0 first:pt-0">
        {!selfLabelled && (
          <legend className="contents">
            <span className="block text-[21px] font-extrabold leading-[1.18] tracking-[-0.035em] text-navy sm:text-[24px]">{say(field.asked)}</span>
          </legend>
        )}
        {!selfLabelled && field.help && <p className="mt-2 text-[15px] leading-[1.55] text-body">{say(field.help)}</p>}
        <div className={selfLabelled ? "" : "mt-5"}>
          <CareFieldInput
            field={field}
            value={responses[key]}
            options={optionsFor(field)}
            prefilled={field.prefill ? data.prefill[field.prefill] ?? "" : undefined}
            onChange={(value) => {
              setAnswer(key, value);
              if (autoAdvance && value !== null && value !== undefined && value !== "") {
                if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
                advanceTimer.current = window.setTimeout(() => { void nextRef.current(); }, 380);
              }
            }}
            token={token}
            recipientId={page?.recipientId ?? null}
            responses={page?.recipientId
              ? answersForRecipient(responses, page.recipientId)
              : responses}
            knownPeople={knownPeople}
          />
        </div>
      </fieldset>
    );
  };

  if (!page || page.kind === "welcome") {
    const asked = pages.filter((p) => p.kind === "questions");
    const minutes = minutesFor(questionCount(asked));
    const only = intake.recipients.length === 1 ? intake.recipients[0] : null;
    const name = only && !only.isEnquirer ? firstNameOf(only.id) : null;
    const self = !!only?.isEnquirer;
    const asksMedicines = asked.some((p) => p.fields.some((f) => f.id === "regular_medicines"));
    const chapterNames = [...new Set(covers.map((c) => (several && c.recipientId ? `${titleOf(c)}` : titleOf(c))))];
    return (
      <>
        {seo}
        <Welcome
          staffBanner={staffBanner}
          greeting={fillerFirst ? `Hello ${fillerFirst},` : "Hello,"}
          heading={topUp
            ? `A few more questions${topUpName ? ` about ${topUpName}` : ""}`
            : self ? "A few questions about your care"
            : name ? `A few questions about ${name}’s care`
            : "A few questions about your family’s care"}
          lead={topUp
            ? "A service has been added since you answered. These are the only questions it brings with it. Everything you have already told us stands."
            : `Your answers help us prepare, so the assessment visit can focus on ${self ? "you" : name ?? "your family"} and the right care.`}
          minutes={minutes}
          chapters={chapterNames}
          haveReady={asksMedicines
            ? self
              ? "your medicines, or a photo of the boxes, and your doctor’s details."
              : `${name ? `${name}’s` : "their"} medicines, or a photo of the boxes, and ${name ? "their" : "their"} doctor’s details.`
            : null}
          art={serviceArt}
          startLabel={returning ? "Carry on" : "Let’s begin"}
          onStart={() => {
            const saved = data.position?.page ?? null;
            if (returning && saved && pages.some((p) => p.key === saved)) goTo(saved);
            else void goNext();
          }}
          onChangeWho={topUp ? undefined : () => {
            // Back to who the care is for. Answers already given are kept.
            setResponses((prev) => {
              const held = (prev.care_intake as CareIntake | undefined) ?? intake;
              const next = { ...held, confirmed: false };
              autosave.queue("care_intake", next);
              return { ...prev, care_intake: next };
            });
            void autosave.flush();
            window.scrollTo({ top: 0 });
          }}
        />
      </>
    );
  }

  const progress = pages.length > 1 ? index / (pages.length - 1) : 0;
  const status = (
    <SaveState
      status={autosave.status}
      savedAt={autosave.savedAt}
      onRetry={() => { void autosave.retry(); }}
    />
  );
  const backButton = (
    <SecondaryAction onClick={goBack} label="Back">
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </SecondaryAction>
  );

  if (page.kind === "cover") {
    const inChapter = pages.filter((p) =>
      p.kind === "questions" && p.chapter === page.chapter && p.recipientId === page.recipientId);
    const started = inChapter.some((p) => p.fields.some((f) => isAnswered(responses[scopedKey(p.recipientId, f.id)])));
    return shell(
      <ChapterCover
        number={page.sectionNumber ?? 1}
        count={page.sectionCount ?? covers.length}
        who={whoOf(page)}
        title={titleOf(page)}
        line={chapterLine(page.chapter ?? "about", firstNameOf(page.recipientId))}
        questions={questionCount(inChapter)}
        art={chapterArt[page.chapter ?? "about"]}
      />,
      {
        heading: titleOf(page),
        progress,
        menu: true,
        footer: (
          <>
            <PrimaryAction onClick={() => { void goNext(); }}>
              {started ? "Carry on" : "Start"} <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </PrimaryAction>
            {backButton}
          </>
        ),
      },
    );
  }

  if (page.kind === "review") {
    // Questions that matter to the visit, left unanswered: pointed to, never forced.
    const missing = pages
      .filter((p) => p.kind === "questions")
      .flatMap((p) => p.fields
        .filter((f) => f.required && f.type !== "checkbox" && !isAnswered(responses[scopedKey(p.recipientId, f.id)]))
        .map((f) => ({ key: `${p.key}:${f.id}`, page: p.key, label: f.record, who: whoOf(p) })));
    const requestGroup = groups.find((g) => g.recipientId === null);
    const consentFields = (requestGroup?.sections.find((s) => s.id === "consent")?.fields ?? [])
      .filter((f) => fieldVisible(f, responses));
    return shell(
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        <h2 className="text-[30px] font-extrabold leading-[1.04] tracking-[-0.045em] text-navy sm:text-[38px]">Check and send</h2>
        <p className="mt-3 text-[16px] leading-[1.6] text-body">
          Read your answers through. Tap Change on anything you want to put right.
        </p>

        {missing.length > 0 && (
          <div className="mt-6 border-l-4 border-brand bg-tint px-4 py-4">
            <p className="text-[16px] font-extrabold tracking-[-0.02em] text-navy">
              {missing.length === 1 ? "One question we would like answered" : `${missing.length} questions we would like answered`}
            </p>
            <p className="mt-1 text-[14.5px] leading-[1.5] text-body">You can still send without them, and we will ask at the visit.</p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {missing.map((m) => (
                <li key={m.key}>
                  <button type="button" onClick={() => goTo(m.page)} className="inline-flex min-h-9 items-center gap-1.5 text-left text-[15px] font-extrabold text-brand underline underline-offset-2">
                    {m.who ? `${m.who}: ` : ""}{say(m.label)} <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-7 flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.recipientId ?? "request"} className="flex flex-col gap-5">
              {groupAnswers(group, (sectionId) => {
                const target = pages.find((candidate) =>
                  candidate.kind === "questions" && candidate.sectionId === sectionId && candidate.recipientId === group.recipientId);
                if (target) goTo(target.key);
              })}
            </div>
          ))}
        </div>

        {consentFields.length > 0 && (
          <section className="mt-8 border-2 border-navy bg-tint p-4 sm:p-5">
            <h2 className="text-[19px] font-extrabold tracking-[-0.035em] text-navy">Before you send</h2>
            <div className="mt-4 flex flex-col gap-3">
              {consentFields.map((field) => (
                <CareFieldInput
                  key={field.id}
                  field={{ ...field, asked: say(field.asked) }}
                  value={responses[field.id]}
                  options={[]}
                  onChange={(value) => { setAnswer(field.id, value); setConsentWarning(false); }}
                />
              ))}
            </div>
            {data.definition.privacyUrl && (
              <a href={data.definition.privacyUrl} className="mt-4 inline-block text-[14.5px] font-bold text-brand underline underline-offset-2" target="_blank" rel="noreferrer">
                How we look after your information
              </a>
            )}
          </section>
        )}
        {consentWarning && (
          <p role="alert" className="mt-4 border-l-4 border-price bg-tint px-4 py-3 text-[15px] font-bold leading-relaxed text-navy">
            Please tick the boxes above before sending.
          </p>
        )}
        {submitError && (
          <p role="alert" className="mt-4 border-l-4 border-price bg-tint px-4 py-3 text-[15px] font-bold leading-relaxed text-navy">
            Your latest answers have not saved yet. Check your connection and try again.
          </p>
        )}
      </div>,
      {
        heading: "Check and send",
        progress: 1,
        status,
        menu: true,
        footer: (
          <>
            <PrimaryAction onClick={submit} disabled={submitting}>
              {submitting ? "Sending" : "Send my answers"}
            </PrimaryAction>
            {backButton}
          </>
        ),
      },
    );
  }

  const answeredHere = page.fields.some((f) => isAnswered(responses[scopedKey(page.recipientId, f.id)]));
  const stop = say(page.title ?? sectionById[page.sectionId ?? ""]?.title);
  return shell(
    <div key={page.key} className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex flex-col gap-9">{page.fields.map((f) => renderField(f, page.fields.length === 1))}</div>
    </div>,
    {
      heading: titleOf(page),
      progress,
      chip: `${whoOf(page) ? `${whoOf(page)} · ` : ""}${stop ?? ""}`,
      status,
      menu: true,
      footer: (
        <>
          <PrimaryAction quiet={!answeredHere} onClick={() => { void goNext(); }}>
            {answeredHere ? <>Continue <ArrowRight className="h-5 w-5" aria-hidden="true" /></> : "Skip for now"}
          </PrimaryAction>
          {backButton}
        </>
      ),
    },
  );
};

export default PreAssessment;
