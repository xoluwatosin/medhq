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
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import {
  FormCard, FormPage, PrimaryAction, SecondaryAction, SectionRail,
} from "@/components/request/FormSurface";
import { Question } from "@/components/request/RequestShell";
import CareFieldInput from "@/components/care/CareFieldInput";
import { CareIntakeFlow } from "@/components/care/CareIntakeSteps";
import { SaveState, useAutosave } from "@/components/field";
import { cn } from "@/lib/utils";
import {
  applicableSections, buildContext, CareDefinition, CareField, CareOption, CareResponses,
  CareSection, fieldVisible, isAnswered, pruneHiddenFieldAnswers, readAnswer, withDerived,
} from "@/lib/care";
import {
  answersForRecipient, CareIntake, CareIntakeSeed, emptyIntake, intakeRoutingAnswers, IntakeRecipient, mergeIntakeSeed,
  recipientName, scopedKey, sectionKeysFor, sectionScope,
} from "@/lib/care-intake";
import { buildItinerary, ItineraryPage } from "@/lib/care-itinerary";
import { resolveCopy, voiceFor } from "@/lib/care-copy";

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
type FlowPage = ItineraryPage & { recipientId: string | null; who: string | null };

/** One block of answers in review: the request, or one care recipient. */
interface AnswerGroup {
  recipientId: string | null;
  label: string | null;
  sections: CareSection[];
  answers: CareResponses;
}

const PreAssessment = () => {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LoadResult | null>(null);
  const [responses, setResponses] = useState<CareResponses>({});
  const [pageKey, setPageKey] = useState<string>("welcome");
  const [submitting, setSubmitting] = useState(false);
  const [consentWarning, setConsentWarning] = useState(false);
  const [submitError, setSubmitError] = useState(false);
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

  // Request first, then each person in turn. A top-up carries neither: the
  // shared answers stand, and it asks about one person only.
  const groups = useMemo<AnswerGroup[]>(() => {
    if (!data || !intakeDone) return [];
    if (topUp && !topUpPerson) return [];
    const first = intake.recipients[0];
    const requestSections = topUp
      ? []
      : sectionsForRecipient(first).filter((s) => sectionScope(s.id) === "request");
    const out: AnswerGroup[] = [
      { recipientId: null, label: null, sections: requestSections, answers: responses },
    ];
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
    return out;
  }, [data, intake, intakeDone, responses, routingAnswers, sectionsForRecipient, topUp, topUpPerson]);

  // Worked out again on every answer, because one answer can open or close a
  // whole section partway through.
  const pages = useMemo<FlowPage[]>(() => {
    if (groups.length === 0) return [];
    const out: FlowPage[] = [{ key: "welcome", kind: "welcome", fields: [], recipientId: null, who: null }];
    for (const group of groups) {
      if (group.sections.length === 0) continue;
      const built = buildItinerary(group.sections, group.answers)
        .filter((p) => p.kind === "cover" || p.kind === "questions");
      for (const p of built) {
        out.push({
          ...p,
          key: group.recipientId ? `${group.recipientId}:${p.key}` : p.key,
          recipientId: group.recipientId,
          who: group.label,
        });
      }
    }
    out.push({ key: "review", kind: "review", fields: [], recipientId: null, who: null });
    // Numbered across the whole flow, so the family sees one run of sections.
    const covers = out.filter((p) => p.kind === "cover");
    covers.forEach((cover, i) => { cover.sectionNumber = i + 1; cover.sectionCount = covers.length; });
    for (const p of out) {
      if (p.kind !== "questions") continue;
      const cover = covers.find((c) =>
        c.sectionId === p.sectionId &&
        c.presentationId === p.presentationId &&
        c.recipientId === p.recipientId);
      p.sectionNumber = cover?.sectionNumber;
      p.sectionCount = covers.length;
    }
    return out;
  }, [groups]);

  // Resume near where this link was left. A page that no longer applies falls
  // back to the start of the flow.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !data || pages.length === 0) return;
    resumed.current = true;
    const saved = data.position ?? null;
    const key = saved?.page ?? null;
    setPageKey(pages.find((p) => p.key === key)?.key ?? "welcome");
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
      setData((prev) => (prev ? { ...prev, frozen: true, submitted_at: new Date().toISOString() } : prev));
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
      <div className="flex min-h-dvh items-center justify-center bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-navy" />
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

  if (error || !data) {
    return (
      <>
        {seo}
        <FormPage eyebrow="Pre-assessment" title="Before your visit">
          <Question heading="We could not open this form" stepKey="error">
            <p className="text-[15px] leading-relaxed text-body">{error}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-body">
              Call us on +234 812 698 8237 and we will send a new link.
            </p>
          </Question>
        </FormPage>
      </>
    );
  }

  interface ShellOptions {
    step?: number | null;
    total?: number;
    chip?: React.ReactNode;
    status?: React.ReactNode;
    rail?: React.ReactNode;
    footer?: React.ReactNode;
  }

  const shell = (children: React.ReactNode, options: ShellOptions = {}) => (
    <>
      {seo}
      <FormPage
        eyebrow="Pre-assessment"
        title="Before your visit"
        step={options.step ?? null}
        total={options.total ?? 0}
        chip={options.chip}
        status={options.status}
        rail={options.rail}
        footer={options.footer}
      >
        {children}
      </FormPage>
    </>
  );

  /** One care recipient's answers, or the request's, written out. */
  const groupAnswers = (group: AnswerGroup, onEdit?: (sectionId: string) => void) =>
    group.sections.map((s) => {
      const shown = s.fields
        .filter((f) => fieldVisible(f, group.answers))
        .filter((f) => isAnswered(responses[scopedKey(group.recipientId, f.id)]));
      if (shown.length === 0) return null;
      return (
        <FormCard key={`${group.recipientId ?? "request"}:${s.id}`}>
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-[16px] font-bold leading-snug text-navy">{say(s.title)}</h2>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(s.id)}
                className="shrink-0 text-[15px] font-semibold text-brand underline"
              >
                Edit
              </button>
            )}
          </div>
          <dl className="mt-2 flex flex-col divide-y divide-hairline-warm">
            {shown.map((f) => (
              <div key={f.id} className="py-2.5">
                <dt className="text-[15px] font-semibold text-body">{say(f.record)}</dt>
                <dd className="mt-1 whitespace-pre-line text-[16px] leading-relaxed text-ink">
                  {readAnswer(resolved(f), responses[scopedKey(group.recipientId, f.id)], bandLabels)}
                </dd>
              </div>
            ))}
          </dl>
        </FormCard>
      );
    });

  const groupHeading = (group: AnswerGroup) =>
    group.label && (
      <p className="label-caps mt-6 text-[12px] text-label">{group.label}</p>
    );

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
          <div className="flex flex-col gap-5">
            {editing.fields
              .filter((f) => fieldVisible(f, editingGroup.answers))
              .map((field) => {
                const key = scopedKey(editingGroup.recipientId, field.id);
                return (
                  <div key={key} className="border-t border-hairline-warm pt-5 first:border-t-0 first:pt-0">
                    {field.type !== "checkbox" && (
                      <p className="text-[16px] font-semibold leading-snug text-ink">{say(field.asked)}</p>
                    )}
                    <div className={field.type === "checkbox" ? "" : "mt-3"}>
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
            <p className="mt-4 text-[15px] font-semibold leading-relaxed text-warn-ink">{amendError}</p>
          )}
        </Question>,
        {
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

    return shell(
      <>
        <Question
          heading="Thank you, we have your answers"
          help={canAmend
            ? "You can still change these answers until the assessment visit. After that, changes are made with the nurse on the day."
            : data.definition.closing ??
              "Changes are now made with the nurse on the day. Call us on +234 812 698 8237 if something urgent has changed."}
          stepKey="sent"
        >
          {amendNote && (
            <p className="mb-3 rounded-xl border border-hairline-warm bg-tint/50 p-3.5 text-[15px] font-semibold leading-relaxed text-navy">
              {amendNote}
            </p>
          )}
          {groups.map((group) => (
            <div key={group.recipientId ?? "request"}>
              {groupHeading(group)}
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
        </Question>
      </>,
    );
  }

  /* ---- The intake, before anything is asked --------------------------- */

  if (!intakeDone) {
    return (
      <>
        {seo}
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
        <p className="text-[15px] leading-relaxed text-body">
          No answers have been changed. Please ask Medic Connect to send a new link for the correct person.
        </p>
      </Question>,
    );
  }

  /* ---- Still being answered ------------------------------------------- */

  const renderField = (field: CareField) => {
    // A tick box carries its own wording, so heading it as well would say the
    // same thing twice.
    const selfLabelled = field.type === "checkbox";
    const key = scopedKey(page?.recipientId ?? null, field.id);
    return (
      <div key={key} className="border-t border-hairline-warm pt-5 first:border-t-0 first:pt-0">
        {!selfLabelled && (
          <>
            <p className="text-[15px] font-semibold leading-snug text-ink">{say(field.asked)}</p>
            {field.help && <p className="mt-1 text-[13px] leading-relaxed text-body">{say(field.help)}</p>}
          </>
        )}
        <div className={selfLabelled ? "" : "mt-3"}>
          <CareFieldInput
            field={field}
            value={responses[key]}
            options={optionsFor(field)}
            prefilled={field.prefill ? data.prefill[field.prefill] ?? "" : undefined}
            onChange={(value) => setAnswer(key, value)}
            token={token}
            recipientId={page?.recipientId ?? null}
            responses={page?.recipientId
              ? answersForRecipient(responses, page.recipientId)
              : responses}
            knownPeople={knownPeople}
          />
        </div>
      </div>
    );
  };

  if (!page || page.kind === "welcome") {
    return shell(
      <Question
        heading={topUp
          ? `A few more questions${topUpName ? ` about ${topUpName}` : ""}`
          : "Before your assessment"}
        help={topUp
          ? "A service has been added since you answered. These are the only questions it brings with it. Everything you have already told us stands."
          : data.definition.opening ??
            "These questions help our care team understand what is needed and prepare for the assessment. Your answers save as you go, so you can leave and return using the same link."}
        stepKey="welcome"
      >
        <span className="sr-only">Ready when you are.</span>
        {!topUp && (
          <p className="mt-4 text-[15px] leading-snug text-body">
            Not right?{" "}
            <button
              type="button"
              className="font-semibold text-brand underline underline-offset-2"
              onClick={() => {
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
            >
              Change who the care is for
            </button>
          </p>
        )}
      </Question>,
      {
        footer: (
          <PrimaryAction onClick={() => { void goNext(); }}>
            {topUp ? "Start" : "Start pre-assessment"}
          </PrimaryAction>
        ),
      },
    );
  }

  const covers = pages.filter((p) => p.kind === "cover");

  // Every section on the rail is reachable: answers are saved as they are
  // given, so moving about cannot lose anything.
  const answeredNumbers = covers
    .filter((cover) => (sectionById[cover.sectionId ?? ""]?.fields ?? []).some(
      (f) => isAnswered(responses[scopedKey(cover.recipientId, f.id)]),
    ))
    .map((cover) => cover.sectionNumber ?? 0);

  const rail = (
    <SectionRail
      count={covers.length}
      current={page.sectionNumber ?? 1}
      answered={answeredNumbers}
      onSelect={(n) => { const target = covers[n - 1]; if (target) goTo(target.key); }}
    />
  );

  const status = (
    <SaveState
      status={autosave.status}
      savedAt={autosave.savedAt}
      onRetry={() => { void autosave.retry(); }}
    />
  );

  const chip = `${page.who ? `${page.who} · ` : ""}${say(page.title ?? sectionById[page.sectionId ?? ""]?.title) ?? ""}`;

  if (page.kind === "cover") {
    const section = sectionById[page.sectionId ?? ""];
    const started = (page.fields.length ? page.fields : section?.fields ?? []).some(
      (f) => isAnswered(responses[scopedKey(page.recipientId, f.id)]),
    );
    const questionPages = pages.filter((candidate) =>
      candidate.kind === "questions" &&
      candidate.recipientId === page.recipientId &&
      candidate.sectionId === page.sectionId &&
      candidate.presentationId === page.presentationId);
    const questionCount = questionPages.reduce(
      (count, candidate) => count + candidate.fields.filter((field) => field.type !== "checkbox").length,
      0,
    );
    return shell(
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="relative -mx-5 overflow-hidden bg-navy px-5 py-7 text-white sm:-mx-8 sm:px-8">
          <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 text-[128px] font-black leading-none text-white/[0.07]">{page.sectionNumber}</span>
          <span aria-hidden className="pointer-events-none absolute -bottom-12 left-1/3 h-28 w-28 rounded-full border-[18px] border-white/[0.06]" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-[15px] font-bold text-white">
              {page.sectionNumber}
            </span>
            <p className="label-caps on-emphasis-label text-[11px]">
              {page.who ? `${page.who} · ` : ""}Section {page.sectionNumber} of {page.sectionCount}
            </p>
          </div>
          <h2 className="relative mt-3 text-[19px] font-bold leading-tight text-white">{say(page.title ?? section?.title)}</h2>
        </div>
        <div className="pt-4">
          {section?.intro && (
            <p className="text-[14px] leading-relaxed text-body">{say(section.intro)}</p>
          )}
          <p className="mt-2 text-[13px] text-muted-foreground">
            {questionCount === 1 ? "1 question in this section." : `${questionCount} questions in this section.`}
          </p>
        </div>
      </div>,
      {
        step: (page.sectionNumber ?? 1) - 1,
        total: page.sectionCount ?? covers.length,
        chip,
        status,
        rail,
        footer: (
          <>
            <PrimaryAction onClick={() => { void goNext(); }}>
              {started ? "Continue" : "Start section"}
            </PrimaryAction>
            {index > 1 && <SecondaryAction onClick={goBack}>Back</SecondaryAction>}
          </>
        ),
      },
    );
  }

  if (page.kind === "review") {
    return shell(
      <Question
        heading="Check your answers"
        help="Read this through before you send it. You can go back and change anything."
        stepKey="review"
      >
        {groups.map((group) => (
          <div key={group.recipientId ?? "request"}>
            {groupHeading(group)}
            {groupAnswers(group, (sectionId) =>
              {
                const target = pages.find((candidate) =>
                  candidate.kind === "cover" && candidate.sectionId === sectionId && candidate.recipientId === group.recipientId);
                if (target) goTo(target.key);
              })}
          </div>
        ))}
        {consentWarning && (
          <p className="mt-4 text-[15px] font-semibold leading-relaxed text-warn-ink">
            Please tick the boxes in the last section before sending this.
          </p>
        )}
        {submitError && (
          <p className="mt-4 text-[15px] font-semibold leading-relaxed text-warn-ink">
            Your latest answers have not saved yet. Check your connection and try again.
          </p>
        )}
      </Question>,
      {
        rail,
        footer: (
          <>
            <PrimaryAction onClick={submit} disabled={submitting}>
              {submitting ? "Sending" : "Send my answers"}
            </PrimaryAction>
            <SecondaryAction onClick={goBack}>Back</SecondaryAction>
          </>
        ),
      },
    );
  }

  return shell(
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      {(page.partCount ?? 1) > 1 && (
        <p className="mb-2 text-[13px] text-muted-foreground">
          Part {page.partNumber} of {page.partCount}
        </p>
      )}
      <div className="flex flex-col gap-4">{page.fields.map(renderField)}</div>

      <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
        Leave anything you are unsure about. The nurse will go through it with you on the day.
        {data.definition.privacyUrl && (
          <>
            {" "}
            <a href={data.definition.privacyUrl} className="font-semibold text-brand underline" target="_blank" rel="noreferrer">
              How we look after your information
            </a>
          </>
        )}
      </p>
    </div>,
    {
      step: (page.sectionNumber ?? 1) - 1,
      total: page.sectionCount ?? covers.length,
      chip,
      status,
      rail,
      footer: (
        <>
          <PrimaryAction onClick={() => { void goNext(); }}>Continue</PrimaryAction>
          <SecondaryAction onClick={goBack}>Back</SecondaryAction>
        </>
      ),
    },
  );
};

export default PreAssessment;
