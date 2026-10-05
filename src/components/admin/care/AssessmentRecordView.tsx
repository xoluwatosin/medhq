// The sent assessment, read exactly as it was sent.
//
// Two question sets meet on this page and are never mixed up. The family's
// answers are rendered from the pre-assessment definition they were given, each
// with the assessor's decision to confirm or amend. The assessor's own clinical
// questions are rendered from the exact definition, at the exact version, that
// this assessment document was written against, showing only the modules frozen
// onto it when the visit was started. Nothing here can be edited.
import { useMemo } from "react";
import { MuEmpty, MuSection, MuTable } from "@/components/admin/mu/MuShell";
import { Status } from "@/components/field";
import { formatDateTime } from "@/lib/format";
import { fieldVisible, isAnswered, readAnswer, type CareField, type CareSection } from "@/lib/care";
import { sectionsForModules } from "@/lib/care-schema";
import { confirmFieldId, noteFieldId, readConfirm, type AssessmentRecord } from "@/lib/care-assessment";

// An amended answer keeps the shape of the question it replaces, so anything
// that is not a plain choice is read the way that question is read.
const labelOf = (field: CareField, raw: unknown): string =>
  typeof raw === "string"
    ? (field.options?.find((o) => o.value === raw)?.label ?? raw)
    : readAnswer(field, raw);

const AUDIENCE_LABELS: Record<string, string> = {
  client: "Shared with the client",
  internal: "Internal",
  restricted: "Restricted",
};

const RowLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
    <span className="w-44 shrink-0 text-[12.5px] font-bold text-ink2">{label}</span>
    <span className="min-w-0 whitespace-pre-wrap break-words text-[13.5px] text-body">{value}</span>
  </div>
);

/** One carried family answer, with what the assessor decided about it. */
const Evidence = ({
  field, answer, decision,
}: {
  field: CareField;
  answer: unknown;
  decision: ReturnType<typeof readConfirm>;
}) => {
  const answered = isAnswered(answer);
  const family = answered ? readAnswer(field, answer) : null;
  const amended = decision?.decision === "amended" ? decision.value ?? "" : null;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[14px] font-bold text-ink">{field.record}</p>
        {decision
          ? <Status
              label={decision.decision === "amended" ? "Amended by the assessor" : "Confirmed"}
              tone={decision.decision === "amended" ? "warning" : "good"}
            />
          : answered
            ? <Status label="No decision recorded" tone="warning" />
            : field.required
              ? <Status label="Required, not answered" tone="warning" />
              : <Status label="Not answered" tone="neutral" />}
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {family !== null && <RowLine label="Recorded by the family" value={family} />}
        {amended !== null && (
          <RowLine
            label="Assessor's answer"
            value={amended ? labelOf(field, amended) : "No value given"}
          />
        )}
        {decision?.decision === "amended" && (
          <RowLine label="Reason for amending" value={decision.reason?.trim() || "No reason recorded"} />
        )}
        {decision?.at && (
          <RowLine
            label={decision.decision === "amended" ? "Amended" : "Confirmed"}
            value={formatDateTime(decision.at)}
          />
        )}
      </div>
    </div>
  );
};

/** One clinical question the assessor answered at the visit. */
const ClinicalAnswer = ({ field, answer }: { field: CareField; answer: unknown }) => {
  const answered = isAnswered(answer);
  const audience = AUDIENCE_LABELS[field.audience ?? "client"];

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 text-[14px] font-bold text-ink">{field.record}</p>
        {answered
          ? <Status label={audience} tone={field.audience === "restricted" ? "warning" : "neutral"} />
          : field.required
            ? <Status label="Required, not answered" tone="warning" />
            : <Status label="Not answered" tone="neutral" />}
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-body">
        {answered ? readAnswer(field, answer) : "The assessor recorded no answer."}
      </p>
    </div>
  );
};

const AssessmentRecordView = ({ record }: { record: AssessmentRecord }) => {
  const responses = record.document.responses ?? {};

  // The family's questions, as they were given them.
  const carried = useMemo<CareSection[]>(() => {
    const all = record.pre_assessment_definition?.sections ?? [];
    return all.filter((s) => (s.fields ?? []).some((f) => fieldVisible(f, record.pre_assessment)));
  }, [record]);

  // The assessor's questions, from this document's own definition and only the
  // modules that were frozen onto it.
  const clinical = useMemo<CareSection[]>(() => {
    const definition = record.definition;
    if (!definition?.sections?.length) return [];
    return sectionsForModules(definition, record.resolved_modules ?? [])
      .map((section) => ({
        ...section,
        fields: (section.fields ?? []).filter((f) => fieldVisible(f, responses)),
      }))
      .filter((section) => section.fields.length > 0);
  }, [record, responses]);

  const flags = (record.flags ?? []).filter((f) => !f.cleared_at);
  const outstanding = Array.isArray(record.document.outstanding_required)
    ? record.document.outstanding_required : [];
  const account = typeof responses["note.assessor_account"] === "string"
    ? String(responses["note.assessor_account"]) : "";

  return (
    <div className="flex flex-col gap-4">
      <MuSection title="Provenance">
        <MuTable
          rows={[
            {
              label: "Assessment question set",
              value: record.definition_version ? `Version ${record.definition_version}` : "Not recorded",
            },
            {
              label: "Modules applied",
              value: (record.resolved_modules ?? []).length
                ? (record.resolved_modules ?? []).join(", ")
                : "The core questions only",
            },
            {
              label: "Pre-assessment question set",
              value: record.pre_assessment_version ? `Version ${record.pre_assessment_version}` : "",
            },
            { label: "Built from", value: record.document.built_from_id ? "An earlier assessment draft" : "The family's answers" },
            { label: "Replaces", value: record.document.supersedes_id ? "An earlier sent version" : "" },
          ]}
        />
      </MuSection>

      {flags.length > 0 && (
        <MuSection title="Clinical flags">
          <MuTable
            rows={flags.map((f) => ({
              label: f.kind,
              value: [f.severity, f.detail].filter(Boolean).join(": "),
            }))}
          />
        </MuSection>
      )}

      {outstanding.length > 0 && (
        <MuSection title="Required answers still outstanding">
          <MuTable
            rows={outstanding.map((item) => {
              const row = (item ?? {}) as { record?: string; section?: string; id?: string };
              return { label: row.record ?? row.id ?? "A required answer", value: row.section ?? "" };
            })}
          />
        </MuSection>
      )}

      <MuSection title="Assessor's account">
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-body">
          {account || "The assessor wrote no account."}
        </p>
      </MuSection>

      {clinical.length > 0 && clinical.map((section) => (
        <MuSection key={`clinical-${section.id}`} title={section.title} padded={false}>
          <div className="divide-y divide-line-soft">
            {section.fields.map((field) => (
              <ClinicalAnswer key={field.id} field={field} answer={responses[field.id]} />
            ))}
          </div>
        </MuSection>
      ))}

      {carried.length === 0 && clinical.length === 0 && (
        <MuSection title="The record">
          <MuEmpty
            title="No questions to show"
            description="The question set carries no applicable questions for this client."
          />
        </MuSection>
      )}

      {carried.map((section) => {
        const note = responses[noteFieldId(section.id)];
        const fields = (section.fields ?? []).filter((f) => fieldVisible(f, record.pre_assessment));
        return (
          <MuSection key={section.id} title={`${section.title}: what the family told us`} padded={false}>
            <div className="divide-y divide-line-soft">
              {fields.map((field) => (
                <Evidence
                  key={field.id}
                  field={field}
                  answer={record.pre_assessment[field.id]}
                  decision={readConfirm(responses[confirmFieldId(field.id)])}
                />
              ))}
              {typeof note === "string" && note.trim() && (
                <div className="px-5 py-4">
                  <p className="text-[12.5px] font-bold text-ink2">Assessor's note on this section</p>
                  <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-body">{note}</p>
                </div>
              )}
            </div>
          </MuSection>
        );
      })}
    </div>
  );
};

export default AssessmentRecordView;
