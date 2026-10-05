// Read-only CV summary for one person: a short written summary plus a table of
// everything extracted from their CV. No verification step.
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, FileText } from "lucide-react";
import { MuEmpty } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminDb } from "@/lib/admin-utils";
import { humaniseTerm, joinList, lowerList, lowerTerm, readableYears, sentence, splitList } from "@/lib/readable";


export interface ParsedField {
  id: string;
  person_id: string;
  document_id: string | null;
  field: string;
  value: string | null;
  confidence: number;
  evidence: string | null;
  model: string | null;
  status: string;
  note: string | null;
  created_at: string;
}

interface ParseRun {
  id: string;
  document_label: string | null;
  model: string | null;
  profession: string | null;
  gaps: any;
  fields: any;
  created_at: string;
}

export const FIELD_LABELS: Record<string, string> = {
  profession: "Profession",
  profession_text: "Stated role on CV",
  current_position: "Current position",
  employer: "Employer",
  years_experience: "Years of experience",
  qualification: "Qualification",
  licensing_body: "Licensing body",
  license_number: "Licence number",
  license_expiry: "Licence expiry",
  state: "State",
  lga: "LGA",
  languages: "Languages",
  specialisms: "Specialisation",
  clinical_skills: "Clinical skills",
  education: "Education",
  certifications: "Certifications",
  availability: "Availability",
  sex: "Sex",
  right_to_work: "Right to work in Nigeria",
  nysc_status: "NYSC status",
};

// Order the table reads in, most useful first.
const ORDER = [
  "profession",
  "profession_text",
  "current_position",
  "employer",
  "years_experience",
  "specialisms",
  "clinical_skills",
  "qualification",
  "education",
  "certifications",
  "licensing_body",
  "license_number",
  "license_expiry",
  "languages",
  "state",
  "lga",
  "availability",
];

interface Props {
  personId: string;
  parseStatus: string;
  gaps: string[];
  actor: { id?: string | null; name?: string | null };
  onProfileChanged: () => void;
}

const CvDataTab = ({ personId, parseStatus }: Props) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ParsedField[]>([]);
  const [runs, setRuns] = useState<ParseRun[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: f }, { data: h }] = await Promise.all([
        adminDb().from("mu_parsed_fields").select("*").eq("person_id", personId),
        adminDb().from("mu_cv_parses").select("*").eq("person_id", personId).order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      // A document read is the only thing that belongs here. What the candidate
      // typed about themselves lives on their profile, not in this summary.
      setRows(((f as ParsedField[]) || []).filter(
        (r) => Boolean(r.document_id) && r.model !== "candidate",
      ));

      setRuns((h as ParseRun[]) || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [personId, parseStatus]);

  const map = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of rows) {
      const v = (r.value ?? "").trim();
      if (v && !m[r.field]) m[r.field] = v;
    }
    return m;
  }, [rows]);

  const ordered = useMemo(
    () => [...new Set([...ORDER, ...Object.keys(map)])].filter((k) => map[k]),
    [map],
  );

  // Plain-English read of the CV, built only from what was actually stated.
  const summary = useMemo(() => {
    if (!ordered.length) return null;
    const role = lowerTerm(map.current_position || map.profession || map.profession_text || "");
    const years = readableYears(map.years_experience);
    const bits: string[] = [];

    if (role) {
      const article = /^[aeiou]/i.test(role) ? "an" : "a";
      const employer = map.employer ? ` at ${humaniseTerm(map.employer)}` : "";
      const exp = years ? `, with ${years} of experience stated` : "";
      bits.push(sentence(`Their CV describes them as ${article} ${role}${employer}${exp}`));
    } else if (years) {
      bits.push(sentence(`Their CV states ${years} of experience`));
    }

    const quals = splitList(map.qualification || map.education);
    if (quals.length) bits.push(sentence(`Qualified as ${lowerList(quals, 4)}`));

    if (map.licensing_body) {
      const number = map.license_number ? ` (number ${map.license_number.trim()})` : "";
      const expiry = map.license_expiry ? `, expiring ${map.license_expiry.trim()}` : "";
      bits.push(sentence(`Licensed with ${humaniseTerm(map.licensing_body)}${number}${expiry}`));
    }

    const specialisms = splitList(map.specialisms);
    if (specialisms.length) bits.push(sentence(`Specialises in ${lowerList(specialisms, 5)}`));

    const skills = splitList(map.clinical_skills);
    if (skills.length) {
      bits.push(sentence(`Clinical skills listed include ${lowerList(skills, 5)}`));
    }

    const certs = splitList(map.certifications);
    if (certs.length) bits.push(sentence(`Certifications on the CV: ${joinList(certs, 4)}`));

    const place = [map.lga, map.state].filter(Boolean).map((v) => humaniseTerm(v!));
    if (place.length) bits.push(sentence(`Based in ${place.join(", ")}`));

    const languages = splitList(map.languages);
    if (languages.length) bits.push(sentence(`Speaks ${joinList(languages, 4)}`));

    if (map.availability) bits.push(sentence(`Availability given as ${lowerTerm(map.availability)}`));


    return bits.join(" ");
  }, [map, ordered]);

  // Fields that hold several values and read better as a proper list.
  const LIST_FIELDS = new Set([
    "specialisms", "clinical_skills", "certifications", "languages", "qualification", "education",
  ]);


  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {parseStatus === "no_cv" && <span>No CV on file yet, so nothing to read.</span>}
        {parseStatus === "failed" && <span>The last CV could not be read. Ask for a PDF or DOCX.</span>}
        {parseStatus === "not_parsed" && <span>Reading the CV now, this refreshes on its own.</span>}
      </div>

      {summary && (
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Summary</p>
            <p className="mt-2 text-sm leading-relaxed">{summary}</p>
          </CardContent>
        </Card>
      )}

      {ordered.length === 0 ? (
        <Card>
          <MuEmpty
            art={art.objDocumentMagnifier}
            title={parseStatus === "parsed" ? "Nothing usable on the CV" : "Nothing read yet"}
            description={
              parseStatus === "parsed"
                ? "The CV was read but nothing usable was stated on it."
                : "Nothing has been read from a document yet. Anything the candidate told us themselves sits on their profile, not here."
            }
          />
        </Card>

      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">Field</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordered.map((k) => (
                  <TableRow key={k}>
                    <TableCell className="text-muted-foreground align-top">
                      {FIELD_LABELS[k] ?? humaniseTerm(k)}
                    </TableCell>
                    <TableCell className="whitespace-pre-wrap">
                      {LIST_FIELDS.has(k)
                        ? joinList(splitList(map[k]), 99)
                        : k === "years_experience"
                          ? readableYears(map[k]) ?? map[k]
                          : humaniseTerm(map[k])}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {runs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Reads on file</p>
            {runs.map((run) => (
              <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 border border-line p-3">
                <p className="text-sm flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {run.document_label || "CV"}
                </p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(run.created_at), "d MMM yyyy, HH:mm")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CvDataTab;
