// One answer control per field. Anything we hold a known list for is a picker,
// never free text, so what comes back is always a value we can match on.
import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { STATES_AND_LGAS, getLGAsForState } from "@/lib/nigeria-locations";
import { PROFESSIONS } from "@/lib/professions";
import {
  licensingBodiesFor, licensingBodyIsSettled, LICENSING_BODY_NAMES,
} from "@/lib/licensing-bodies";
import LanguagePicker from "@/components/portal/LanguagePicker";
import TagPicker from "@/components/portal/TagPicker";
import { SPECIALTIES, SKILLS, facetLabel } from "@/lib/match-taxonomy";
import { SEX_OPTIONS } from "@/lib/work-preferences";
import { COURSES, STUDY_LEVELS, OTHER } from "@/lib/study";
import { JOIN_TRACKS, YEAR_OF_STUDY } from "@/lib/join-tracks";
import { candidateFieldValue } from "@/lib/candidate-field-copy";


const ALL_STATES = Object.keys(STATES_AND_LGAS).sort();

export { ALL_LICENSING_BODIES as LICENSING_BODIES } from "@/lib/licensing-bodies";

// We hold a list for these, so they are picked rather than typed. Anything the
// list misses goes in the box underneath, in the candidate's own words.
const PICKER_FIELDS: Record<string, readonly string[]> = {
  specialisms: SPECIALTIES.map(facetLabel),
  clinical_skills: SKILLS.map(facetLabel),
};

const LIST_FIELDS = new Set([
  "certifications", "education", "qualifications",
]);

const CODED_FIELDS = new Set([
  "sex", "right_to_work", "nysc_status", "track",
]);

/** Best guess at the state we already hold, so the LGA list can be narrowed. */
export const canonicalState = (value?: string | null): string | null => {
  if (!value) return null;
  const tokens = value.split(/[,/|;&]|\band\b/i).map((t) => t.trim().replace(/\s+state$/i, ""));
  for (const t of tokens) {
    const hit = ALL_STATES.find((s) => s.toLowerCase() === t.toLowerCase());
    if (hit) return hit;
  }
  return null;
};

interface Props {
  field: string;
  value: string;
  personState?: string | null;
  /** What they do, so the licensing question can answer itself. */
  personProfession?: string | null;
  onChange: (value: string) => void;
}

const FieldAnswerInput = ({ field, value, personState, personProfession, onChange }: Props) => {
  const candidateValue = CODED_FIELDS.has(field) ? value : candidateFieldValue(value);
  const stateForLga = useMemo(
    () => canonicalState(value.includes("::") ? value.split("::")[0] : personState),
    [personState, value],
  );

  const settledBody = licensingBodyIsSettled(personProfession);

  // A profession with one regulator answers the question on the candidate's
  // behalf, so we fill it in rather than asking them to guess.
  useEffect(() => {
    if (field === "licensing_body" && settledBody && value !== settledBody) onChange(settledBody);
  }, [field, settledBody, value, onChange]);



  if (field === "state") {
    return (
      <Select value={ALL_STATES.includes(value) ? value : ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Choose your state" /></SelectTrigger>
        <SelectContent className="max-h-72">
          {ALL_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (field === "lga") {
    const lgas = stateForLga ? getLGAsForState(stateForLga) : [];
    if (!lgas.length) {
      // No usable state on file, so ask for both in order.
      return (
        <p className="text-xs text-muted-foreground">
          Tell us your state first, then choose your area.
        </p>
      );
    }
    return (
      <Select value={lgas.includes(value) ? value : ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={`Choose your area in ${stateForLga}`} /></SelectTrigger>
        <SelectContent className="max-h-72">
          {lgas.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (field === "profession") {
    return (
      <Select value={(PROFESSIONS as readonly string[]).includes(value) ? value : ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Choose your profession" /></SelectTrigger>
        <SelectContent className="max-h-72">
          {PROFESSIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (field === "licensing_body") {
    // Settled by the profession: show the answer, do not make them pick it.
    if (settledBody) {
      return (
        <div className="border border-border bg-muted px-3 py-2.5 text-[14.5px] text-foreground">
          <span className="font-semibold">{settledBody}</span>
          <span className="block text-xs text-muted-foreground">
            {LICENSING_BODY_NAMES[settledBody] ?? "Taken from your profession."}
          </span>
        </div>
      );
    }
    const bodies = licensingBodiesFor(personProfession);
    return (
      <Select value={bodies.includes(value) ? value : ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Who licenses you?" /></SelectTrigger>
        <SelectContent>
          {bodies.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }


  // Route parity: everyone gets asked these, however they first applied.
  if (field === "sex") {
    return (
      <Select value={SEX_OPTIONS.some((o) => o.code === value) ? value : ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
        <SelectContent>
          {SEX_OPTIONS.map((o) => (
            <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }


  if (field === "right_to_work") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Can you legally work in Nigeria?" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Yes, I can work here</SelectItem>
          <SelectItem value="no">No, not yet</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (field === "nysc_status") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Your NYSC status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="completed">Yes, completed</SelectItem>
          <SelectItem value="exempt">Yes, certificate of exemption</SelectItem>
          <SelectItem value="no">No</SelectItem>
          <SelectItem value="not_applicable">Not applicable</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (field === "track") {
    return (
      <Select value={JOIN_TRACKS.some((t) => t.id === value) ? value : ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Which describes you?" /></SelectTrigger>
        <SelectContent>
          {JOIN_TRACKS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (field === "study_level") {
    return (
      <Select value={(STUDY_LEVELS as readonly string[]).includes(value) ? value : ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="What are you studying towards?" /></SelectTrigger>
        <SelectContent className="max-h-72">
          {STUDY_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  // Courses are a list so we can match on them. Anything outside it is "Other",
  // and the box beneath takes the course in the student's own words.
  if (field === "course_of_study") {
    const known = (COURSES as readonly string[]).includes(value);
    const picked = known ? value : value ? OTHER : "";
    return (
      <div className="space-y-2">
        <Select
          value={picked}
          onValueChange={(v) => onChange(v === OTHER ? "" : v)}
        >
          <SelectTrigger><SelectValue placeholder="Choose your course" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {COURSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {picked === OTHER && (
          <Input
            value={value}
            placeholder="Type your course"
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    );
  }

  if (field === "year_of_study") {
    return (
      <Select value={(YEAR_OF_STUDY as readonly string[]).includes(value) ? value : ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Which year are you in?" /></SelectTrigger>
        <SelectContent className="max-h-72">
          {YEAR_OF_STUDY.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (field === "expected_graduation") {
    return (
      <Input
        value={value}
        placeholder="e.g. July 2027"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field === "joining_statement") {
    return (
      <Textarea
        rows={5}
        value={value}
        placeholder="What do you hope to learn, and where would you like your career to go?"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field === "institution") {
    return (
      <Input
        value={value}
        placeholder="e.g. University of Lagos"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field === "languages") {
    return <LanguagePicker value={candidateValue} onChange={onChange} />;
  }

  if (field.endsWith("_expiry") || field.endsWith("_date")) {
    // Native date fields run wide on small screens, so hold them to the column.
    return (
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block h-11 w-full min-w-0 max-w-full appearance-none text-[15px]"
      />
    );
  }


  if (PICKER_FIELDS[field]) {
    return <TagPicker options={PICKER_FIELDS[field]} value={candidateValue} onChange={onChange} />;
  }

  if (LIST_FIELDS.has(field)) {
    return (
      <Textarea
        rows={2} value={candidateValue} placeholder="Separate each one with a comma"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }


  return <Input value={candidateValue} placeholder="Type your answer" onChange={(e) => onChange(e.target.value)} />;
};

export default FieldAnswerInput;
