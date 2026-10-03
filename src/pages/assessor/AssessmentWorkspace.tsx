// The assessor's workspace, built to work in a house with no signal.
//
// Everything typed is written to the device first as an append-only event,
// under the assessor who wrote it, the visit it belongs to and the clinical
// document it lands in. The queue is sent when there is a connection, and only
// the server saying it holds an event clears it. Pressing Complete with no
// signal records the intention and acts on it when the signal returns: nothing
// here claims a visit has been sent until the server says so.
//
// The whole visit is held on the device, not only the answers, so reloading
// the page in a house with no signal reopens it in full.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { cxInputClass } from "@/components/candidate/primitives";
import { Status } from "@/components/field";
import { CareConfirm, carePrimary } from "@/components/admin/care/CareSurface";
import { AssessorShell } from "@/components/assessor/AssessorRoute";
import { formatDateTime } from "@/lib/format";
import { careErrorMessage } from "@/lib/care-errors";
import {
  readAnswer, isAnswered, fieldVisible, fieldCarry, sectionApplies,
  type CareCarry, type CareDefinition, type CareField,
} from "@/lib/care";
import { CareFieldInput } from "@/components/care/CareFieldInput";
import {
  assessmentStatusLabel, assessmentStatusTone, confirmFieldId, locationLabel, noteFieldId,
  readConfirm, sectionProgress, type AssessmentSection, type AssessmentWork, type CarriedNote,
  type EvidenceItem,
} from "@/lib/care-assessment";

import {
  appendEvent, clearAssessment, clearSubmission, heldVisits, mergedResponses, markSent,
  noteSubmissionProblem, offlineSupported, otherOwnersPending, pendingEvents, queueSubmission,
  readSnapshot, readSubmission, saveSnapshot, strandedPending,
  type CaptureEvent, type OfflineScope,
} from "@/lib/care-offline";

interface Brief {
  assessment: AssessmentWork;
  source_document_id: string | null;
  client: { id: string; reference: string | null; name: string | null; address_line: string | null };
  pre_assessment: Record<string, unknown>;
  pre_assessment_definition: CareDefinition;
  /** The clinical evidence frozen when the family sent their form. */
  active_evidence: string[];
  /** The exact definition this assessment document was written against. */
  definition: CareDefinition;
  definition_version: number | null;
  /** The modules frozen onto the document when the visit was started. */
  resolved_modules: string[];
  /** Service, recipient facts and modules frozen when the visit opened. */
  routing_facts: Record<string, unknown>;
  responses: Record<string, unknown>;
}


type Sync = "offline" | "held" | "sending" | "synced" | "failed" | "queued";

const SYNC_LABEL: Record<Sync, string> = {
  offline: "Offline, held on this device",
  held: "Not sent yet",
  sending: "Sending",
  synced: "Saved",
  failed: "Could not send, still held on this device",
  queued: "Complete, waiting for a signal",
};

const SYNC_TONE = {
  offline: "warning", held: "warning", sending: "progress",
  synced: "good", failed: "bad", queued: "warning",
} as const;

const evidenceCard = "cx-control border border-line bg-tint/30 p-4 sm:p-5";
const readingBlock = "border-t border-line py-5 first:border-t-0";

const AssessmentWorkspace = () => {
  const { id = "" } = useParams();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [scope, setScope] = useState<OfflineScope | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [sections, setSections] = useState<AssessmentSection[]>([]);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [pending, setPending] = useState<CaptureEvent[]>([]);
  const [queuedSubmission, setQueuedSubmission] = useState(false);
  const [otherPending, setOtherPending] = useState(0);
  const [stranded, setStranded] = useState(0);
  const [fromDevice, setFromDevice] = useState(false);
  const [heldAt, setHeldAt] = useState<string | null>(null);
  const [sync, setSync] = useState<Sync>("held");
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [serviceOptions, setServiceOptions] = useState<{ id: string; name: string }[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [serviceNote, setServiceNote] = useState("");
  const [savingService, setSavingService] = useState(false);
  const online = useRef(typeof navigator === "undefined" ? true : navigator.onLine);

  // Who is signed in is read from the session already on this device. Asking
  // the server who you are is a network call, and a visit must open without
  // one.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setOwnerId(data.session?.user?.id ?? null);
      setSignedOut(!data.session);
    });
  }, []);

  const scopeRef = useRef<OfflineScope | null>(null);
  scopeRef.current = scope;

  const load = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);

    // What this device already holds for this visit, under this person.
    const held = (await heldVisits<Brief>(ownerId).catch(() => []))
      .find((v) => v.assessment_id === id) ?? null;

    let here: OfflineScope | null = held
      ? { ownerId, assessmentId: id, clientId: held.client_id, documentId: held.document_id }
      : null;
    let loaded: Brief | null = (held?.brief as Brief | undefined) ?? null;
    let cached = !!held;

    const { data: documentId, error: startError } = await supabase.rpc("care_assessment_start", { _id: id });
    if (!startError && typeof documentId === "string") {
      const { data: briefData } = await supabase.rpc("care_assessment_brief", { _id: id });
      const fresh = (briefData ?? null) as unknown as Brief | null;
      if (fresh?.client?.id) {
        here = { ownerId, assessmentId: id, clientId: fresh.client.id, documentId };
        loaded = fresh;
        cached = false;
        await saveSnapshot(here, fresh, fresh.responses ?? {}, fresh.source_document_id ?? null)
          .catch(() => undefined);
      }
    }

    if (!here || !loaded) {
      setError(
        startError && navigator.onLine
          ? careErrorMessage(startError, "This visit could not be opened.")
          : "You are offline and this visit is not on this device yet.",
      );
      setLoading(false);
      return;
    }

    const snapshot = await readSnapshot<Brief>(here).catch(() => null);
    const queued = await pendingEvents(here).catch(() => [] as CaptureEvent[]);
    const intent = await readSubmission(here).catch(() => null);

    setScope(here);
    setBrief(loaded);
    setSections(buildSections(loaded));
    setResponses(mergedResponses(snapshot ?? { responses: loaded.responses ?? {} }, queued));
    setPending(queued);
    setQueuedSubmission(!!intent);
    setFromDevice(cached);
    setHeldAt(snapshot?.fetched_at ?? held?.fetched_at ?? null);
    setOtherPending(await otherOwnersPending(ownerId).catch(() => 0));
    setStranded(await strandedPending(ownerId).catch(() => 0));
    setError(null);
    setLoading(false);
  }, [id, ownerId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!ownerId || !online.current) return;
    const loadServiceOptions = async () => {
      const result = await supabase.from("services").select("id, name").eq("is_offered", true).order("name");
      setServiceOptions((result.data ?? []) as Array<{ id: string; name: string }>);
    };
    void loadServiceOptions();
  }, [ownerId]);

  const requestService = async () => {
    if (!serviceId || !serviceNote.trim()) return;
    setSavingService(true);
    const { data, error: serviceError } = await supabase.rpc("care_assessment_service_request", {
      _work_id: id,
      _service_id: serviceId,
      _note: serviceNote.trim(),
    });
    setSavingService(false);
    if (serviceError) {
      toast.error(careErrorMessage(serviceError, "The service could not be recorded"));
      return;
    }
    const service = (data as { service?: string } | null)?.service ?? "Service";
    toast.success(`${service} recorded for office follow-up`);
    setServiceId("");
    setServiceNote("");
  };

  /** Sends what is held, then acts on a completion that is waiting for signal. */
  const flush = useCallback(async () => {
    const here = scopeRef.current;
    if (!here) return;
    const queue = await pendingEvents(here).catch(() => [] as CaptureEvent[]);
    const intent = await readSubmission(here).catch(() => null);
    setPending(queue);
    setQueuedSubmission(!!intent);

    if (!online.current) { setSync(queue.length || intent ? "offline" : "synced"); return; }

    if (queue.length > 0) {
      setSync("sending");
      const { data, error: rpcError } = await supabase.rpc("care_assessment_capture", {
        _id: here.assessmentId,
        _events: queue.map((e) => ({
          client_event_id: e.client_event_id,
          field_id: e.field_id,
          value: e.value,
          captured_at: e.captured_at,
          client_seq: e.client_seq,
        })) as never,
      });
      if (rpcError) { setSync("failed"); return; }
      // The server tells us what it holds. Nothing is cleared on hope. An
      // event it already had is acknowledged too, so a replay settles.
      const accepted = (data as { accepted?: string[] } | null)?.accepted;
      await markSent(here, accepted?.length ? accepted : queue.map((e) => e.client_event_id));
    }

    const left = await pendingEvents(here).catch(() => [] as CaptureEvent[]);
    setPending(left);
    if (left.length > 0) { setSync("failed"); return; }

    if (intent) {
      // Answers first, always. Only a fully acknowledged visit is submitted.
      const { error: submitError } = await supabase.rpc("care_assessment_submit", { _id: here.assessmentId });
      if (submitError) {
        await noteSubmissionProblem(here, submitError.message);
        setSync("queued");
        return;
      }
      await clearSubmission(here);
      await clearAssessment(here).catch(() => undefined);
      setQueuedSubmission(false);
      setSync("synced");
      toast.success("Assessment sent");
      void load();
      return;
    }
    setSync("synced");
  }, [load]);

  useEffect(() => {
    if (!scope) return;
    void flush();
    const timer = window.setInterval(() => { void flush(); }, 8000);
    const up = () => { online.current = true; void flush(); };
    const down = () => { online.current = false; setSync("offline"); };
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [flush, scope]);

  const record = async (fieldId: string, value: unknown) => {
    const here = scopeRef.current;
    if (!here) return;
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
    try {
      await appendEvent(here, fieldId, value);
    } catch {
      toast.error("This device cannot hold work offline. Do not rely on it for a visit.");
      return;
    }
    setSync("held");
    void flush();
  };

  const outstanding = useMemo(
    () => sections.reduce((count, s) => {
      const { decided, total } = sectionProgress(s, responses);
      return count + (total - decided);
    }, 0),
    [sections, responses],
  );

  /**
   * Completing is a decision, not a request. It is written down, so a reload
   * or a lost signal cannot lose it, and it is carried out in order.
   */
  const send = async () => {
    const here = scopeRef.current;
    if (!here) return;
    setSending(true);
    await queueSubmission(here);
    setQueuedSubmission(true);
    setConfirmSend(false);
    await flush();
    setSending(false);
    const still = await readSubmission(here).catch(() => null);
    if (still) {
      toast.message(
        online.current
          ? "Held on this device. It will be sent as soon as everything has reached us."
          : "Held on this device. It will be sent when you are back in signal.",
      );
    }
  };

  if (signedOut) {
    return (
      <AssessorShell className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">Sign in to open this visit</h1>
        <Link className="mt-4 inline-block font-bold text-navy underline" to="/portal/login">Sign in</Link>
      </AssessorShell>
    );
  }
  if (loading) return <p className="p-10 text-center text-[15px] text-body">Loading the visit</p>;
  if (error) {
    return (
      <AssessorShell className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">This visit cannot be opened</h1>
        <p className="mt-2 text-[15px] text-body">{error}</p>
        <Link className="mt-4 inline-block font-bold text-navy underline" to="/assessor">Back to your visits</Link>
      </AssessorShell>
    );
  }


  const work = brief?.assessment;
  const submitted = work?.status === "submitted";
  const section = sections[active];

  return (
    <AssessorShell className="mx-auto max-w-3xl overflow-x-hidden px-4 pb-40 pt-8">
      <Helmet>
        <title>Assessment visit | Medic Connect</title>
        <meta name="description" content="Record the assessment visit, on or offline." />
      </Helmet>

      <header className="flex flex-wrap items-start gap-3 border-b border-line-soft pb-5">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-[22px] font-bold tracking-[-0.02em] text-ink">
            {brief?.client.name ?? "Assessment visit"}
          </h1>
          <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-[15px] sm:grid-cols-2">
            {brief?.client.reference && (
              <div><dt className="text-[15px] font-bold text-ink2">Reference</dt><dd className="text-body">{brief.client.reference}</dd></div>
            )}
            {work?.appointment_at && (
              <div><dt className="text-[15px] font-bold text-ink2">Appointment</dt><dd className="text-body">{formatDateTime(work.appointment_at)}</dd></div>
            )}
            {work && (
              <div><dt className="text-[15px] font-bold text-ink2">Where</dt><dd className="text-body">{locationLabel(work.location_kind)}</dd></div>
            )}
            {brief?.client.address_line && (
              <div className="min-w-0"><dt className="text-[15px] font-bold text-ink2">Address</dt><dd className="break-words text-body">{brief.client.address_line}</dd></div>
            )}
          </dl>
        </div>
        <div className="flex flex-col items-end gap-2">
          {work && <Status label={assessmentStatusLabel(work.status)} tone={assessmentStatusTone(work.status)} />}
          <Status label={SYNC_LABEL[sync]} tone={SYNC_TONE[sync]} />
        </div>
      </header>

      {fromDevice && (
        <p className="cx-chip mt-4 border border-line bg-desk/60 px-4 py-3 text-[15px] text-body">
          Opened from this device.{heldAt ? ` Last brought down on ${formatDateTime(heldAt)}.` : ""} Anything you
          write now is held here until there is a signal.
        </p>
      )}

      {!offlineSupported() && (
        <p className="cx-chip mt-4 border border-warn-line bg-warn-wash px-4 py-3 text-[15px] text-warn-ink">
          This device cannot hold work when there is no signal. Use a different device for the visit.
        </p>
      )}

      {otherPending > 0 && (
        <p className="cx-chip mt-4 border border-line bg-desk/60 px-4 py-3 text-[15px] text-body">
          Another assessor has unsent work on this device. Nothing of theirs is shown or sent from your account.
        </p>
      )}

      {stranded > 0 && (
        <p className="cx-chip mt-4 border border-warn-line bg-warn-wash px-4 py-3 text-[15px] text-warn-ink">
          {stranded === 1 ? "One answer" : `${stranded} answers`} written by an older version of the app cannot be
          matched to a visit record. They are still on this device. Tell the care team before you clear it.
        </p>
      )}

      <section className="mt-6 border-t border-line pt-6">
        <h2 className="text-[20px] font-bold leading-[1.2] text-ink sm:text-[23px]">Service coverage</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-body">
          The assessment sections below are fixed from the services recorded when this visit opened.
        </p>
        {submitted ? (
          <p className="mt-3 rounded-xl bg-tint px-3.5 py-3 text-[15px] text-ink2">
            This assessment has been submitted. Ask the office to create a follow-up assessment for any additional service.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-[15px] font-bold text-ink2">Family asked for another service</span>
              <select className={cxInputClass()} value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                <option value="">Choose a service</option>
                {serviceOptions.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[15px] font-bold text-ink2">Reason for adding this service</span>
              <textarea
                className={cn(cxInputClass(), "min-h-[88px]")}
                value={serviceNote}
                onChange={(event) => setServiceNote(event.target.value)}
                placeholder="Record what the family requested and why."
              />
            </label>
            <button
              type="button"
              className={cn(carePrimary, "sm:w-fit")}
              disabled={!serviceId || !serviceNote.trim() || savingService || !online.current}
              onClick={() => void requestService()}
            >
              {savingService ? "Recording" : "Record additional service"}
            </button>
            {!online.current && <p className="text-[15px] text-body">Connect to the internet to record a service change.</p>}
          </div>
        )}
      </section>

      {sections.length === 0 ? (
        <p className="mt-8 text-[15px] text-body">
          There is nothing carried forward from the pre-assessment for this client.
        </p>
      ) : (
        <>
          <nav aria-label="Assessment sections" className="mt-5 flex flex-wrap gap-2">
            {sections.map((s, index) => {
              const { decided, total } = sectionProgress(s, responses);
              const chosen = index === active;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-current={chosen}
                  className={cn(
                    "cx-control min-h-11 px-3.5 py-2 text-left text-[15px] transition-colors",
                    chosen
                      ? "border-[1.5px] border-navy bg-tint font-bold text-navy"
                      : "border border-line bg-white text-ink hover:bg-desk/60",
                  )}
                >
                  <span className="block font-bold">{s.title}</span>
                  <span className="block text-[15px] opacity-80">
                    {decided === total ? "All checked" : `${total - decided} still to check`}
                  </span>
                </button>
              );
            })}
          </nav>

          {section && (
            <section className="mt-6 flex flex-col gap-4">
              <div className="relative -mx-4 overflow-hidden bg-navy px-4 py-6 text-white sm:mx-0 sm:rounded-2xl sm:px-6">
                <span aria-hidden className="pointer-events-none absolute -right-5 -top-8 text-[112px] font-black leading-none text-white/[0.07]">{active + 1}</span>
                <span aria-hidden className="pointer-events-none absolute -bottom-12 left-1/3 h-28 w-28 rounded-full border-[18px] border-white/[0.06]" />
                <p className="relative label-caps text-[11px] text-white/80">Section {active + 1} of {sections.length}</p>
                <h2 className="relative mt-2 text-[20px] font-bold leading-[1.2] text-white sm:text-[23px]">{section.title}</h2>
              </div>
              {section.evidence.length > 0 && (
                <div>
                  <h3 className="text-[16px] font-bold text-ink">Clinical evidence to verify</h3>
                  <p className="text-[15px] text-body">Each one is either still right, or different now.</p>
                </div>
              )}
              {section.evidence.map((item) => {

                const decision = readConfirm(responses[confirmFieldId(item.field_id)]);
                return (
                  <div key={item.field_id} className={evidenceCard}>
                    <p className="text-[15px] font-bold text-ink2">{item.record}</p>
                    <p className="mt-1 text-[16px] text-ink">{item.answer}</p>
                    <p className="mt-1 text-[15px] text-body">Said before the visit by the family.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {([
                        { key: "confirmed", label: "Still right" },
                        { key: "amended", label: "Different now" },
                      ] as const).map((choice) => (
                        <button
                          key={choice.key}
                          type="button"
                          disabled={submitted}
                          className={cn(
                            "cx-control min-h-11 px-4 text-[15px] font-bold transition-colors disabled:opacity-50",
                            decision?.decision === choice.key
                              ? "border-[1.5px] border-navy bg-tint text-navy"
                              : "border border-line bg-white text-ink hover:bg-desk/60",
                          )}
                          onClick={() =>
                            record(
                              confirmFieldId(item.field_id),
                              choice.key === "confirmed"
                                ? { decision: "confirmed" }
                                : {
                                    decision: "amended",
                                    value: decision?.value ?? "",
                                    reason: decision?.reason ?? "",
                                  },
                            )
                          }
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                    {decision?.decision === "amended" && (
                      <>
                        {item.options && item.options.length > 0 ? (
                          // A controlled answer is amended to another recorded
                          // option, never to free text.
                          <select
                            className={cn(cxInputClass(), "mt-3")}
                            aria-label={`What ${item.record} is now`}
                            value={typeof decision.value === "string" ? decision.value : ""}
                            disabled={submitted}
                            onChange={(e) =>
                              record(confirmFieldId(item.field_id), {
                                decision: "amended", value: e.target.value, reason: decision.reason ?? "",
                              })
                            }
                          >
                            <option value="">Choose what it is now</option>
                            {item.options.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <textarea
                            className={cn(cxInputClass(), "mt-3 min-h-[96px]")}
                            aria-label={`What is different about ${item.record}`}
                            placeholder="What did you find?"
                            defaultValue={typeof decision.value === "string" ? decision.value : ""}
                            disabled={submitted}
                            onBlur={(e) =>
                              record(confirmFieldId(item.field_id), {
                                decision: "amended", value: e.target.value, reason: decision.reason ?? "",
                              })
                            }
                          />
                        )}
                        {/* An amendment replaces what a family said, so it says why. */}
                        <textarea
                          className={cn(cxInputClass(), "mt-2 min-h-[72px]")}
                          aria-label={`Why ${item.record} is being amended`}
                          placeholder="Why is this different?"
                          defaultValue={decision.reason ?? ""}
                          disabled={submitted}
                          onBlur={(e) =>
                            record(confirmFieldId(item.field_id), {
                              decision: "amended", value: decision.value ?? "", reason: e.target.value,
                            })
                          }
                        />
                        {!decision.reason?.trim() && (
                            <p className="mt-1 text-[15px] text-warn-ink">
                            An amendment needs a reason before it can be sent.
                          </p>
                        )}
                        {decision.at && (
                          <p className="mt-1 text-[15px] text-body">
                            Amended at the visit on {formatDateTime(decision.at)}.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Read, not judged. Context never becomes clinical evidence. */}
              {section.context.length > 0 && (
                <div className={readingBlock}>
                  <h3 className="text-[16px] font-bold text-ink">Context from the family</h3>
                  <p className="text-[15px] text-body">For reading only. There is nothing to decide here.</p>
                  <dl className="mt-3 flex flex-col gap-2">
                    {section.context.map((item) => (
                      <div key={item.field_id}>
                        <dt className="text-[15px] font-bold text-ink2">{item.record}</dt>
                        <dd className="text-[16px] text-ink">{item.answer}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {section.authority.length > 0 && (
                <div className={readingBlock}>
                  <h3 className="text-[16px] font-bold text-ink">Authority and consent</h3>
                  <p className="text-[15px] text-body">Recorded before the visit. For reading only.</p>
                  <dl className="mt-3 flex flex-col gap-2">
                    {section.authority.map((item) => (
                      <div key={item.field_id}>
                        <dt className="text-[15px] font-bold text-ink2">{item.record}</dt>
                        <dd className="text-[16px] text-ink">{item.answer}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}


              {section.questions
                .filter((field) => fieldVisible(field, responses))
                .map((field) => (
                  <div key={field.id} className={readingBlock}>
                    <p className="text-[16px] font-bold text-ink">{field.asked || field.record}</p>
                    {field.help && <p className="mt-1 text-[15px] text-body">{field.help}</p>}
                    {!field.required && <p className="mt-1 text-[15px] text-body">Optional</p>}
                    <div className={cn("mt-3", submitted && "pointer-events-none opacity-60")}>
                      <CareFieldInput
                        field={field}
                        value={responses[field.id]}
                        options={field.options ?? []}
                        onChange={(value) => record(field.id, value)}
                      />
                    </div>
                  </div>
                ))}

              {section.note && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[15px] font-bold text-ink2">
                    What you found in this part of the visit
                  </span>
                  <textarea
                    className={cn(cxInputClass(), "min-h-[140px]")}
                    defaultValue={String(responses[noteFieldId(section.id)] ?? "")}
                    disabled={submitted}
                    onBlur={(e) => record(noteFieldId(section.id), e.target.value)}
                  />
                </label>
              )}

            </section>
          )}
        </>
      )}

      <div
        className="fixed inset-x-0 bottom-0 border-t border-line-soft bg-white px-4 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-[15px] text-body">
            {queuedSubmission
              ? "Complete. Waiting to reach us, and it will be sent on its own."
              : pending.length > 0
                ? `${pending.length} ${pending.length === 1 ? "answer is" : "answers are"} held on this device`
                : "Everything on this device has reached us"}
          </p>
          {submitted ? (
            <Status label="Sent for clinical review" tone="good" />
          ) : (
            <button
              type="button"
              className={carePrimary}
              disabled={queuedSubmission}
              onClick={() => setConfirmSend(true)}
            >
              {queuedSubmission ? "Waiting to send" : "Send the assessment"}
            </button>
          )}
        </div>
      </div>

      <CareConfirm
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Send the assessment"
        description="Once it is sent it cannot be changed, and the clinical team picks it up."
        confirmLabel={sending ? "Sending" : "Send"}
        confirmDisabled={sending}
        keepLabel="Keep working"
        onConfirm={send}
      >
        {outstanding > 0 && (
          <p className="text-[15px] text-body">
            {outstanding} {outstanding === 1 ? "thing has" : "things have"} not been checked against what the
            family told us. You can still send it.
          </p>
        )}
        {!online.current && (
          <p className="text-[15px] text-body">
            You are offline. This will be held on the device and sent on its own once you are back in signal.
          </p>
        )}
      </CareConfirm>

      <p className="sr-only" aria-live="polite">{SYNC_LABEL[sync]}</p>
    </AssessorShell>
  );
};

/**
 * The visit is built from the assessment document's own definition and the
 * modules frozen onto it when the visit was started, never from whatever is
 * published today. A section marked confirm_amend carries what the family
 * already told us for the assessor to confirm or amend; every other section
 * asks the assessor's own questions. Nothing clinical is invented here.
 */
const buildSections = (brief: Brief): AssessmentSection[] => {
  const definition: CareDefinition = brief.definition ?? { sections: [] };
  const carried = brief.pre_assessment ?? {};
  const modules = brief.resolved_modules ?? [];
  const facts = brief.routing_facts ?? {};
  const active = new Set(brief.active_evidence ?? []);

  const carriedFields: CareField[] = (brief.pre_assessment_definition?.sections ?? [])
    .flatMap((s) => s.fields ?? []);

  // Only clinical evidence that applied and was answered is confirmed or
  // amended. Context, operational and consent answers are read, not judged.
  const evidence: EvidenceItem[] = carriedFields
    .filter((f: CareField) => active.has(f.id) && isAnswered(carried[f.id]))
    .map((f: CareField) => ({
      field_id: f.id,
      record: f.record,
      answer: readAnswer(f, carried[f.id]),
      options: f.type === "choice" && Array.isArray(f.options)
        ? f.options.map((o) => ({ value: String(o.value), label: String(o.label ?? o.value) }))
        : undefined,
    }));

  // The same classifications the definition itself carries decide what is
  // shown as context and what is shown as authority and consent. Operational
  // answers belong to neither, and never become clinical evidence.
  const carriedOfKind = (kind: CareCarry): CarriedNote[] => carriedFields
    .filter((f: CareField) => fieldCarry(f) === kind && isAnswered(carried[f.id]))
    .map((f: CareField) => ({ field_id: f.id, record: f.record, answer: readAnswer(f, carried[f.id]) }));

  const context = carriedOfKind("context");
  const authority = carriedOfKind("authority_consent");

  // The route was frozen when the visit opened: group, service and modules are
  // read from it, and applicability follows the same grammar as the family form.
  const ctx = {
    clientGroup: typeof facts.recipient_group === "string" && facts.recipient_group !== "unknown"
      ? facts.recipient_group : null,
    serviceKey: typeof facts.service === "string" && facts.service !== "unknown"
      ? facts.service : null,
    responses: carried,
    modules,
  };

  return (definition.sections ?? [])
    .filter((s) => sectionApplies(s, ctx))
    .map((s) => ({
      id: s.id,
      title: s.title,
      evidence: s.mode === "confirm_amend" ? evidence : [],
      context: s.mode === "confirm_amend" ? context : [],
      authority: s.mode === "confirm_amend" ? authority : [],
      questions: s.fields ?? [],
      note: true,
    }))
    .filter((s) => s.evidence.length > 0 || s.questions.length > 0 || s.note);
};



export default AssessmentWorkspace;
