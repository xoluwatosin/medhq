// The intake that runs before any question is asked.
//
// Five short screens establish who is asking, who is receiving care, how old
// each of them is, and which service each of them needs. Everything the
// questionnaire routes on comes from here, so it is deliberately plain: one
// decision per screen, names in separate fields, and no service assigned to
// anybody without the respondent choosing it.
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  FormPage, PrimaryAction, SecondaryAction,
} from "@/components/request/FormSurface";
import { Question } from "@/components/request/RequestShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RELATIONSHIPS, RELATIONSHIP_OTHER } from "@/lib/care";
import {
  blankRecipient, CARE_SERVICES, CareIntake, incompleteIntakeSteps, intakeComplete, INTAKE_STAGE_NUMBER, intakeSteps,
  intakeSummary, IntakeRecipient, IntakeStepId, recipientName, serviceLabel, stepProblems,
} from "@/lib/care-intake";

/* ---------- small shared pieces ---------- */

const Field = ({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-[13px] font-bold text-ink2">{label}</span>
    <span className="mt-1.5 block">{children}</span>
    {error && <span className="mt-1 block text-[13px] font-medium text-warn-ink">{error}</span>}
  </label>
);

const textClass = "h-11 w-full rounded-lg border-line bg-white px-3.5 text-[16px]";

const Pick = ({
  label, help, selected, onClick,
}: { label: string; help?: string; selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      "flex min-h-11 w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
      selected ? "border-navy bg-tint" : "border-line bg-white hover:border-navy/40",
    )}
  >
    <span
      className={cn(
        "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2",
        selected ? "border-navy bg-navy" : "border-line",
      )}
      aria-hidden
    />
    <span className="min-w-0">
      <span className="block text-[14px] font-bold leading-snug text-ink">{label}</span>
      {help && <span className="mt-0.5 block text-[13px] leading-snug text-body">{help}</span>}
    </span>
  </button>
);

/* ---------- the flow ---------- */

interface FlowProps {
  intake: CareIntake;
  onChange: (next: CareIntake) => void;
  onComplete: () => void;
  seeded?: boolean;
  /** Stage the respondent had reached previously, so a saved link resumes there. */
  startStage?: number;
  /** Reports the stage currently on screen so it can be stored with the answers. */
  onStage?: (stage: number) => void;
}

export const CareIntakeFlow = ({
  intake, onChange, onComplete, seeded = false, startStage, onStage,
}: FlowProps) => {
  const initialStep = () => {
    const steps = intakeSteps(intake);
    if (startStage && startStage > 1) {
      const resumeIndex = steps.findIndex((step) => INTAKE_STAGE_NUMBER[step.id] === startStage);
      if (resumeIndex >= 0) return resumeIndex;
    }
    if (seeded && intakeComplete(intake)) return Math.max(steps.findIndex((step) => step.id === "confirm"), 0);
    if (seeded) {
      const missing = incompleteIntakeSteps(intake)[0];
      const missingIndex = steps.findIndex((step) => step.id === missing);
      if (missingIndex >= 0) return missingIndex;
    }
    return 0;
  };
  const [stepIndex, setStepIndex] = useState(initialStep);
  const [showProblems, setShowProblems] = useState(false);

  const steps = useMemo(() => intakeSteps(intake), [intake]);
  const index = Math.min(stepIndex, steps.length - 1);
  const step = steps[index];
  const problems = stepProblems(intake, step.id);
  const problem = (key: string) => (showProblems ? problems[key] : undefined);
  const currentStage = INTAKE_STAGE_NUMBER[step.id];
  const stageTargets = new Map(steps.map((item, stepPosition) => [INTAKE_STAGE_NUMBER[item.id], stepPosition]));

  useEffect(() => { onStage?.(currentStage); }, [currentStage, onStage]);

  const patch = (next: Partial<CareIntake>) => onChange({ ...intake, ...next });

  const setRecipient = (id: string, next: Partial<IntakeRecipient>) =>
    patch({
      recipients: intake.recipients.map((r) => (r.id === id ? { ...r, ...next } : r)),
    });

  const removeRecipient = (id: string) =>
    patch({
      recipients: intake.recipients.filter((r) => r.id !== id && r.addedFor?.recipientId !== id),
    });

  const addRecipient = (over: Partial<IntakeRecipient> = {}) =>
    patch({ recipients: [...intake.recipients, { ...blankRecipient(intake.recipients), ...over }] });

  const toggleService = (r: IntakeRecipient, value: string) =>
    setRecipient(r.id, {
      services: r.services.includes(value)
        ? r.services.filter((s) => s !== value)
        : [...r.services, value],
    });

  // Choosing who the request is for sets up the first care recipient.
  const chooseForWhom = (value: "myself" | "other" | "several") => {
    const kept = intake.recipients.filter((r) => !r.addedFor);
    if (value === "myself") {
      const self: IntakeRecipient = {
        ...(kept.find((r) => r.isEnquirer) ?? blankRecipient([])),
        id: "r1",
        isEnquirer: true,
        firstName: intake.enquirer.firstName,
        lastName: intake.enquirer.lastName,
        phone: intake.enquirer.phone,
        email: intake.enquirer.email,
        relationship: undefined,
        services: kept[0]?.services ?? [],
      };
      patch({ forWhom: value, enquirerReceivesCare: undefined, recipients: [self] });
      return;
    }
    const others = kept.filter((r) => !r.isEnquirer);
    patch({
      forWhom: value,
      enquirerReceivesCare: value === "several" ? intake.enquirerReceivesCare : undefined,
      recipients: others.length ? others : [blankRecipient([])],
    });
  };

  const setEnquirerReceivesCare = (value: "yes" | "no") => {
    const withoutSelf = intake.recipients.filter((r) => !r.isEnquirer);
    if (value === "no") {
      patch({ enquirerReceivesCare: value, recipients: withoutSelf.length ? withoutSelf : [blankRecipient([])] });
      return;
    }
    const self: IntakeRecipient = {
      ...blankRecipient(withoutSelf),
      isEnquirer: true,
      firstName: intake.enquirer.firstName,
      lastName: intake.enquirer.lastName,
      phone: intake.enquirer.phone,
      email: intake.enquirer.email,
      services: [],
    };
    patch({ enquirerReceivesCare: value, recipients: [self, ...withoutSelf] });
  };

  const advance = () => {
    if (Object.keys(problems).length > 0) {
      setShowProblems(true);
      return;
    }
    setShowProblems(false);
    if (step.id === "confirm") {
      onComplete();
      return;
    }
    setStepIndex(index + 1);
    window.scrollTo({ top: 0 });
  };

  const back = () => {
    setShowProblems(false);
    setStepIndex(Math.max(index - 1, 0));
    window.scrollTo({ top: 0 });
  };

  /* ---------- one recipient's details ---------- */

  const recipientCard = (r: IntakeRecipient, canRemove: boolean) => (
    <div key={r.id} className="border-t border-line py-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[15px] font-bold text-ink">
          {r.isEnquirer ? "You" : recipientName(r) || "Care recipient"}
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={() => removeRecipient(r.id)}
            className="inline-flex items-center gap-1 text-[15px] font-bold text-brand"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Remove
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={problem(`${r.id}.firstName`)}>
          <Input
            className={textClass}
            value={r.firstName}
            onChange={(e) => setRecipient(r.id, { firstName: e.target.value })}
          />
        </Field>
        <Field label="Last name" error={problem(`${r.id}.lastName`)}>
          <Input
            className={textClass}
            value={r.lastName}
            onChange={(e) => setRecipient(r.id, { lastName: e.target.value })}
          />
        </Field>

        {!r.isEnquirer && (
          <Field label="Relationship to you" error={problem(`${r.id}.relationship`)}>
            <Select
              value={r.relationship ?? ""}
              onValueChange={(value) => setRecipient(r.id, { relationship: value })}
            >
              <SelectTrigger className={textClass}>
                <SelectValue placeholder="Choose a relationship" />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {[...RELATIONSHIPS, RELATIONSHIP_OTHER].map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {r.relationship === RELATIONSHIP_OTHER && (
          <Field label="Please say how you are related">
            <Input
              className={textClass}
              value={r.relationshipOther ?? ""}
              onChange={(e) => setRecipient(r.id, { relationshipOther: e.target.value })}
            />
          </Field>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[15px] font-bold text-ink2">Date of birth</p>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          <Pick
            label="I know the date of birth"
            selected={r.dobKnown === "yes"}
            onClick={() => setRecipient(r.id, { dobKnown: "yes", approxAge: null })}
          />
          <Pick
            label="I do not know the exact date"
            selected={r.dobKnown === "no"}
            onClick={() => setRecipient(r.id, { dobKnown: "no", dateOfBirth: undefined })}
          />
        </div>
        {problem(`${r.id}.dobKnown`) && (
          <p className="mt-1 text-[15px] font-medium text-warn-ink">{problem(`${r.id}.dobKnown`)}</p>
        )}
        {r.dobKnown === "yes" && (
          <div className="mt-3">
            <Field label="Date of birth" error={problem(`${r.id}.dateOfBirth`)}>
              <Input
                type="date"
                className={textClass}
                value={r.dateOfBirth ?? ""}
                onChange={(e) => setRecipient(r.id, { dateOfBirth: e.target.value })}
              />
            </Field>
          </div>
        )}
        {r.dobKnown === "no" && (
          <div className="mt-3">
            <Field label="Approximate age in years" error={problem(`${r.id}.approxAge`)}>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={120}
                className={textClass}
                value={r.approxAge ?? ""}
                onChange={(e) =>
                  setRecipient(r.id, { approxAge: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[15px] font-bold text-ink2">
          Which support is required for this person?
        </p>
        <p className="mt-1 text-[15px] leading-snug text-body">
          Choose every service that applies.
        </p>
        <div className="mt-2 grid gap-2">
          {CARE_SERVICES.map((service) => (
            <Pick
              key={service.value}
              label={service.label}
              selected={r.services.includes(service.value)}
              onClick={() => toggleService(r, service.value)}
            />
          ))}
        </div>
        {problem(`${r.id}.services`) && (
          <p className="mt-1.5 text-[15px] font-medium text-warn-ink">{problem(`${r.id}.services`)}</p>
        )}
      </div>

      {!r.isEnquirer && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Phone (optional)">
            <Input
              className={textClass}
              type="tel"
              value={r.phone ?? ""}
              onChange={(e) => setRecipient(r.id, { phone: e.target.value })}
            />
          </Field>
          <Field label="Email (optional)">
            <Input
              className={textClass}
              type="email"
              value={r.email ?? ""}
              onChange={(e) => setRecipient(r.id, { email: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  );

  /* ---------- screens ---------- */

  const body = () => {
    if (step.id === "enquirer") {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={problem("firstName")}>
            <Input
              className={textClass}
              value={intake.enquirer.firstName}
              onChange={(e) => patch({ enquirer: { ...intake.enquirer, firstName: e.target.value } })}
            />
          </Field>
          <Field label="Last name" error={problem("lastName")}>
            <Input
              className={textClass}
              value={intake.enquirer.lastName}
              onChange={(e) => patch({ enquirer: { ...intake.enquirer, lastName: e.target.value } })}
            />
          </Field>
          <Field label="Phone" error={problem("phone")}>
            <Input
              className={textClass}
              type="tel"
              value={intake.enquirer.phone ?? ""}
              onChange={(e) => patch({ enquirer: { ...intake.enquirer, phone: e.target.value } })}
            />
          </Field>
          <Field label="Email" error={problem("email")}>
            <Input
              className={textClass}
              type="email"
              value={intake.enquirer.email ?? ""}
              onChange={(e) => patch({ enquirer: { ...intake.enquirer, email: e.target.value } })}
            />
          </Field>
        </div>
      );
    }

    if (step.id === "for_whom") {
      return (
        <div className="grid gap-2">
          <Pick label="Myself" selected={intake.forWhom === "myself"} onClick={() => chooseForWhom("myself")} />
          <Pick label="Another person" selected={intake.forWhom === "other"} onClick={() => chooseForWhom("other")} />
          <Pick label="Several people" selected={intake.forWhom === "several"} onClick={() => chooseForWhom("several")} />
          {problem("forWhom") && (
            <p className="text-[15px] font-medium text-warn-ink">{problem("forWhom")}</p>
          )}
        </div>
      );
    }

    if (step.id === "enquirer_receives_care") {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Pick label="Yes" selected={intake.enquirerReceivesCare === "yes"} onClick={() => setEnquirerReceivesCare("yes")} />
          <Pick label="No" selected={intake.enquirerReceivesCare === "no"} onClick={() => setEnquirerReceivesCare("no")} />
          {problem("enquirerReceivesCare") && (
            <p className="text-[15px] font-medium text-warn-ink">{problem("enquirerReceivesCare")}</p>
          )}
        </div>
      );
    }

    if (step.id === "recipients") {
      const listed = intake.recipients.filter((r) => !r.addedFor);
      return (
        <div className="grid gap-4">
          {listed.map((r) => recipientCard(r, listed.length > 1 && !r.isEnquirer))}
          {problem("recipients") && (
            <p className="text-[15px] font-medium text-warn-ink">{problem("recipients")}</p>
          )}
          {intake.forWhom === "several" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => addRecipient()}
              className="h-12 w-full rounded-xl border-hairline-warm text-[15px] font-semibold"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden /> Add another care recipient
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {intakeSummary(intake).map((line) => (
          <div
            key={line.recipientId}
            className="flex items-start justify-between gap-4 border-t border-line py-4 first:border-t-0"
          >
            <p className="text-[15px] leading-snug text-ink">{line.line}</p>
            <button
              type="button"
              onClick={() => {
                setStepIndex(steps.findIndex((s) => s.id === "recipients"));
                window.scrollTo({ top: 0 });
              }}
              className="shrink-0 text-[15px] font-bold text-brand underline"
            >
              Edit
            </button>
          </div>
        ))}
        <p className="text-[15px] leading-relaxed text-body">
          The questions that follow are organised for the request and for each care recipient,
          based on the services selected above.
        </p>
      </div>
    );
  };

  return (
    <FormPage
      eyebrow="Pre-assessment"
      title="Before your visit"
      step={null}
      rail={
        <nav aria-label="Opening stages" className="mb-4">
          <ol className="flex items-center justify-between gap-2">
            {Array.from({ length: 5 }).map((_, stageIndex) => {
              const number = stageIndex + 1;
              const target = stageTargets.get(number);
              const reachable = target !== undefined && target < index;
              const current = number === currentStage;
              const complete = number < currentStage;
              return (
                <li key={number} className="flex flex-1 items-center last:flex-none">
                  <button
                    type="button"
                    aria-label={`Go to opening stage ${number} of 5`}
                    aria-current={current ? "step" : undefined}
                    disabled={!reachable || current}
                    onClick={() => {
                      if (target === undefined || !reachable) return;
                      setShowProblems(false);
                      setStepIndex(target);
                      window.scrollTo({ top: 0 });
                    }}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[14px] font-bold transition-colors",
                      current
                        ? "border-navy bg-navy text-primary-foreground"
                        : complete
                          ? "border-brand/40 bg-tint text-navy"
                          : "border-line bg-background text-label",
                      reachable && "cursor-pointer hover:border-brand",
                    )}
                  >
                    {number}
                  </button>
                  {number < 5 && <span aria-hidden className={cn("mx-2 h-px flex-1", complete ? "bg-brand/40" : "bg-line")} />}
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-right text-[12px] text-muted-foreground">Stage {currentStage} of 5</p>
        </nav>
      }
      footer={
        <>
          <PrimaryAction onClick={advance}>
            {step.id === "confirm" ? "Confirm and start" : "Continue"}
          </PrimaryAction>
          {index > 0 && <SecondaryAction onClick={back}>Back</SecondaryAction>}
        </>
      }
    >
      <Question heading={step.title} stepKey={step.id}>
        {body()}
      </Question>
    </FormPage>
  );
};

export { serviceLabel };
export default CareIntakeFlow;
