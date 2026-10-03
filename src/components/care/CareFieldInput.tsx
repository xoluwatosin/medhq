// One question on the pre-assessment, drawn the way its type asks for.
//
// Everything we hold a list for is picked, never typed, so what comes back is
// always something we can match on later.
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { cxInputClass } from "@/components/candidate/primitives";
import AddressAutocomplete from "@/components/portal/AddressAutocomplete";
import LanguagePicker from "@/components/portal/LanguagePicker";
import { STATES_AND_LGAS, getLGAsForState } from "@/lib/nigeria-locations";
import { DateField, PhoneField } from "@/components/field";
import {
  ContactBlockAnswer, MatrixAnswer, MeasurementAnswer, RepeatableAnswer,
  TagListAnswer, TimeAnswer, WeeklyPatternAnswer,
} from "@/components/care/CareAnswerControls";
import {
  AppointmentPreferenceAnswer, CareUploadAnswer, ClinicalListAnswer,
  HospitalAnswer, MedicineChoiceAnswer, ProfessionalAnswer,
} from "@/components/care/CareClinicalControls";
import {
  CareField, CareOption, CLINICAL_LIST_FIELDS, RELATIONSHIPS, RELATIONSHIP_OTHER, toggleMulti,
} from "@/lib/care";

interface Props {
  field: CareField;
  value: unknown;
  options: CareOption[];
  prefilled?: string;
  /** The link segment, so a file can be sent without an account. */
  token?: string;
  /** Which recipient this answer belongs to, on a shared family session. */
  recipientId?: string | null;
  /** Answers on the same page, so a follow-up can be chosen from an earlier one. */
  responses?: Record<string, unknown>;
  /** People this request already holds, so the same person is not added twice. */
  knownPeople?: { name: string; role: string }[];
  onChange: (value: unknown) => void;
}


const optionButton =
  "cx-control min-h-11 w-full px-3.5 py-2.5 text-left text-[14px] leading-snug transition-colors";
const chosenLook = "border-[1.5px] border-navy bg-tint font-bold text-navy";
const restingLook = "border border-line bg-white text-ink hover:bg-desk/60";

const asObject = (value: unknown): Record<string, string> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {};

export const CareFieldInput = ({
  field, value, options, prefilled, token, recipientId, responses, knownPeople, onChange,
}: Props) => {
  const text = typeof value === "string" ? value : "";

  switch (field.type) {
    case "long_text":
      return (
        <textarea
          className={cn(cxInputClass(), "min-h-[120px]")}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <input
          type="number"
          inputMode="numeric"
          className={cxInputClass()}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );

    case "date":
      return (
        <DateField
          label={field.record}
          hideLabel
          value={text}
          controlClassName={cxInputClass()}
          onChange={(next) => onChange(next)}
        />
      );

    case "phone":
      return (
        <PhoneField
          label={field.record}
          hideLabel
          value={text}
          controlClassName={cxInputClass()}
          onChange={({ e164, raw }) => onChange(e164 ?? raw)}
        />
      );

    case "address":
      return <AddressAutocomplete value={text} onChange={onChange} placeholder="Start typing the address" />;

    case "language_picker":
      return <LanguagePicker value={text} onChange={onChange} />;

    case "lga":
      return <LgaAnswer value={value} onChange={onChange} />;

    case "person_name":
      return <PersonNameAnswer value={value} onChange={onChange} />;

    case "relationship":
      return <RelationshipAnswer value={value} onChange={onChange} />;

    case "confirm":
      return <ConfirmAnswer value={value} prefilled={prefilled ?? ""} onChange={onChange} />;

    case "checkbox":
      return (
        <button
          type="button"
          role="checkbox"
          aria-checked={value === true}
          onClick={() => onChange(value === true ? null : true)}
          className={cn(
            "cx-control flex min-h-11 w-full items-start gap-3 px-3.5 py-2.5 text-left text-[14px] leading-relaxed transition-colors",
            value === true ? chosenLook : restingLook,
          )}
        >
          <span
            aria-hidden
            className={cn(
              "cx-chip mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border",
              value === true ? "border-navy bg-navy text-white" : "border-line bg-white",
            )}
          >
            {value === true && <Check className="h-3.5 w-3.5" />}
          </span>
          <span>{field.asked}</span>
        </button>
      );

    case "choice":
    case "budget_band":
      return (
        <div className="flex flex-col gap-2.5">
          {options.map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(selected ? null : option.value)}
                className={cn(optionButton, selected ? chosenLook : restingLook)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );

    case "multi":
      return (
        <div className="flex flex-col gap-2.5">
          {options.map((option) => {
            const list = Array.isArray(value) ? (value as string[]) : [];
            const selected = list.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(toggleMulti({ ...field, options }, value, option.value))}
                className={cn(optionButton, "flex items-center gap-3", selected ? chosenLook : restingLook)}
              >
                <span
                  aria-hidden
                  className={cn(
                    "cx-chip flex h-5 w-5 shrink-0 items-center justify-center border",
                    selected ? "border-navy bg-navy text-white" : "border-line bg-white",
                  )}
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      );

    case "yes_no":
      return (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          {[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }].map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(selected ? null : option.value)}
                className={cn(optionButton, "sm:flex-1", selected ? chosenLook : restingLook)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );

    case "time":
      return <TimeAnswer field={field} value={value} onChange={onChange} />;

    case "tag_list":
      return <TagListAnswer field={field} value={value} responses={responses} onChange={onChange} />;

    case "contact_block":
      return (
        <ContactBlockAnswer
          field={field}
          value={value}
          knownPeople={knownPeople}
          onChange={onChange}
        />
      );

    case "measurement":
      return <MeasurementAnswer field={field} value={value} onChange={onChange} />;

    case "repeatable":
      return <RepeatableAnswer field={field} value={value} onChange={onChange} />;

    case "matrix":
      return <MatrixAnswer field={field} options={options} value={value} onChange={onChange} />;

    case "weekly_pattern":
      return <WeeklyPatternAnswer options={options} value={value} onChange={onChange} />;

    case "condition_list":
    case "medicine_list":
    case "allergy_list":
      return (
        <ClinicalListAnswer
          list={CLINICAL_LIST_FIELDS[field.type]!}
          value={value}
          onChange={onChange}
        />
      );

    case "medicine_choice":
      return (
        <MedicineChoiceAnswer
          source={field.source ? (responses ?? {})[field.source] : undefined}
          value={value}
          onChange={onChange}
        />
      );

    case "hospital":
      return <HospitalAnswer value={value} onChange={onChange} />;

    case "professional":
      return <ProfessionalAnswer value={value} onChange={onChange} />;

    case "appointment_preference":
      return <AppointmentPreferenceAnswer value={value} responses={responses} onChange={onChange} />;

    case "care_upload":
      return token ? (
        <CareUploadAnswer
          field={field}
          token={token}
          recipientId={recipientId}
          value={value}
          onChange={onChange}
        />
      ) : (
        <p className="text-[15px] leading-relaxed text-body">
          This document is collected at the visit.
        </p>
      );

    case "upload":
      return (
        <p className="text-[15px] leading-relaxed text-body">
          Bring this to the visit, or send it on WhatsApp to +234 812 698 8237. There is nothing to upload here.
        </p>
      );


    default:
      return <input className={cxInputClass()} value={text} onChange={(e) => onChange(e.target.value)} />;
  }
};

/* ---------- the answers that need more than one box ---------- */

const PersonNameAnswer = ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => {
  const parts = asObject(value);
  const set = (key: string, next: string) => {
    const merged = { ...parts, [key]: next };
    const empty = !merged.first?.trim() && !merged.middle?.trim() && !merged.last?.trim();
    onChange(empty ? null : merged);
  };
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { key: "first", label: "First name" },
        { key: "middle", label: "Middle name" },
        { key: "last", label: "Last name" },
      ].map((part) => (
        <label key={part.key} className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-ink2">{part.label}</span>
          <input
            className={cxInputClass()}
            value={parts[part.key] ?? ""}
            onChange={(e) => set(part.key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
};

const RelationshipAnswer = ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => {
  const current = asObject(value);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? RELATIONSHIPS.filter((r) => r.toLowerCase().includes(q)) : RELATIONSHIPS;
    return list.slice(0, 8);
  }, [query]);
  const picked = current.value ?? "";

  return (
    <div className="flex flex-col gap-2.5">
      <input
        className={cxInputClass()}
        placeholder="Search, for example daughter"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search relationships"
      />
      <div className="flex flex-wrap gap-2">
        {[...matches, RELATIONSHIP_OTHER].map((option) => {
          const selected = picked === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange(selected ? null : { value: option, other: option === RELATIONSHIP_OTHER ? "" : undefined })
              }
              className={cn(
                "cx-chip min-h-11 px-3.5 py-2 text-[14px] transition-colors",
                selected ? chosenLook : restingLook,
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {picked === RELATIONSHIP_OTHER && (
        <input
          className={cxInputClass()}
          placeholder="How are you related"
          value={current.other ?? ""}
          onChange={(e) => onChange({ value: RELATIONSHIP_OTHER, other: e.target.value })}
        />
      )}
    </div>
  );
};

const LgaAnswer = ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => {
  const current = asObject(value);
  const state = current.state ?? "";
  const lgas = useMemo(() => (state ? getLGAsForState(state) : []), [state]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-ink2">State</span>
        <select
          className={cxInputClass()}
          value={state}
          onChange={(e) => onChange(e.target.value ? { state: e.target.value, lga: "" } : null)}
        >
          <option value="">Choose a state</option>
          {Object.keys(STATES_AND_LGAS).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-ink2">Local government area</span>
        <select
          className={cxInputClass()}
          value={current.lga ?? ""}
          disabled={!state}
          onChange={(e) => onChange({ state, lga: e.target.value })}
        >
          <option value="">{state ? "Choose an area" : "Choose a state first"}</option>
          {lgas.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </label>
    </div>
  );
};

const ConfirmAnswer = ({
  value,
  prefilled,
  onChange,
}: {
  value: unknown;
  prefilled: string;
  onChange: (v: unknown) => void;
}) => {
  const current = asObject(value);
  const confirmed = value && typeof value === "object" ? (value as { confirmed?: boolean }).confirmed : undefined;
  const shown = current.value ?? prefilled;
  const [editing, setEditing] = useState(confirmed === false);

  if (editing) {
    return (
      <div className="flex flex-col gap-2.5">
        <input
          className={cxInputClass()}
          value={current.value ?? ""}
          autoFocus
          onChange={(e) => onChange(e.target.value.trim() ? { confirmed: false, value: e.target.value } : null)}
        />
        <button
          type="button"
          onClick={() => { setEditing(false); onChange({ confirmed: true, value: prefilled }); }}
          className="self-start text-[13px] font-bold text-brand underline"
        >
          Use {prefilled} after all
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="cx-chip border border-line bg-desk/60 px-3.5 py-2.5 text-[14px] text-ink">{shown || "Not held"}</p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          aria-pressed={confirmed === true}
          onClick={() => onChange({ confirmed: true, value: prefilled })}
          className={cn(optionButton, "sm:flex-1", confirmed === true ? chosenLook : restingLook)}
        >
          Yes, that is right
        </button>
        <button
          type="button"
          onClick={() => { setEditing(true); onChange({ confirmed: false, value: "" }); }}
          className={cn(optionButton, "sm:flex-1", restingLook)}
        >
          No, change it
        </button>
      </div>
    </div>
  );
};

export default CareFieldInput;
