// Work preferences, shared by the candidate portal and the admin profile.
//
// Same table, same component, so what a candidate says and what an admin sees
// can never drift apart. Nothing here is inferred: an empty answer stays empty
// rather than becoming a "no".
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CARE_TYPES, CARE_TYPE_LABEL, ENGAGEMENT_TYPES, LIVE_IN_OPTIONS, NOTICE_PERIODS, SHIFT_PATTERNS,
  CLIENT_SEX_OPTIONS, CLIENT_RELIGION_OPTIONS, PETS_OPTIONS, SMOKING_OPTIONS,
  type WorkPreferences, emptyPreferences, loadPreferences, preferencesComplete, savePreferences,
} from "@/lib/work-preferences";
import {
  FUNCTION_AREAS, FUNCTION_AREA_LABEL, EMPLOYER_TYPES, WORK_SETTINGS,
  CONTRACT_TYPES, CONTRACT_TYPE_LABEL, SALARY_BANDS,
} from "@/lib/non-clinical";
import { PLACEMENT_TYPES, PLACEMENT_LABEL } from "@/lib/study";
import { trackRules } from "@/lib/tracks";

interface Props {
  personId: string;
  readOnly?: boolean;
  actorName?: string | null;
  onSaved?: () => void;
  /** Who is reading. The candidate is asked questions; the office reads a record. */
  voice?: "candidate" | "office";
  /** Which route they joined on. It decides which questions are honest to ask. */
  track?: string | null;
}

/** One copy table, two voices, so the office never reads a question meant for
    the candidate and the candidate never reads a case note. */
const COPY = {
  candidate: {
    careTitle: "Who do you want to work with?",
    careHelp: "Pick everything you are comfortable taking on.",
    liveIn: "Live-in or live-out?",
    shifts: "Shifts you will take",
    length: "Length of work",
    householdTitle: "Who you are comfortable working with",
    householdHelp: "This never counts against you. It stops us sending you somewhere that will not suit.",
    ownFaith: "Your own faith (optional)",
    dealBreakers: "Anything you will not do",
  },
  office: {
    careTitle: "Client types accepted",
    careHelp: "Stated by the candidate. Amend only after they confirm by telephone or email.",
    liveIn: "Living arrangement",
    shifts: "Shift patterns accepted",
    length: "Length of engagement accepted",
    householdTitle: "Household fit",
    householdHelp: "Stated preferences. Matching uses these to exclude households that would not suit.",
    ownFaith: "Faith of the candidate (optional)",
    dealBreakers: "Work refused",
  },
} as const;

const Chip = ({
  on, label, disabled, onClick,
}: { on: boolean; label: string; disabled?: boolean; onClick: () => void }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "min-h-11 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
      on ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground",
      !disabled && "hover:border-primary",
      disabled && "cursor-default",
    )}
  >
    {label}
  </button>
);

const WorkPreferencesPanel = ({
  personId, readOnly = false, actorName, onSaved, voice = "candidate", track,
}: Props) => {
  const t = COPY[voice];
  const rules = trackRules(track);
  const office = rules.needsFunctionAreas;
  const student = rules.needsPlacement;
  const care = rules.needsCarePreferences;
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<WorkPreferences>(emptyPreferences(personId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);

  const groupStates = useMemo(() => {
    const empty = emptyPreferences(personId);
    const groups = office
      ? [
          { id: "function", answered: prefs.function_areas.length > 0, completed: { function_areas: ["other"] } },
          { id: "contract", answered: prefs.contract_types.length > 0, completed: { contract_types: ["permanent"] } },
          { id: "office-detail", answered: prefs.employer_types.length > 0 || prefs.work_setting !== null || prefs.salary_band !== null || Boolean(prefs.roles_wanted_other?.trim()), completed: {} },
          { id: "shared", answered: prefs.notice_period !== null || prefs.willing_to_relocate !== null || Boolean(prefs.notes?.trim()), completed: {} },
        ]
      : student
        ? [
            { id: "placement", answered: prefs.placement_types.length > 0, completed: { placement_types: ["placement"] } },
            { id: "shared", answered: prefs.max_travel_minutes !== null || prefs.notice_period !== null || prefs.willing_to_relocate !== null || Boolean(prefs.notes?.trim()), completed: {} },
          ]
        : [
            { id: "care", answered: prefs.care_types.length > 0, completed: { care_types: ["elderly"] } },
            { id: "live-in", answered: prefs.live_in !== "unknown", completed: { live_in: "either" } },
            { id: "shifts", answered: prefs.shift_patterns.length > 0, completed: { shift_patterns: ["days"] } },
            { id: "engagement", answered: prefs.engagement_types.length > 0, completed: {} },
            { id: "household", answered: prefs.client_sex !== "any" || prefs.client_religion !== "any" || Boolean(prefs.religion?.trim()) || prefs.pets !== "unknown" || prefs.smoking_household !== "unknown" || Boolean(prefs.deal_breakers?.trim()), completed: {} },
            { id: "shared", answered: prefs.max_travel_minutes !== null || prefs.notice_period !== null || prefs.willing_to_relocate !== null || Boolean(prefs.notes?.trim()), completed: {} },
          ];
    const completed = groups.reduce(
      (next, group) => ({ ...next, ...group.completed }),
      { ...empty } as WorkPreferences,
    );
    const required = new Set(
      groups
        .filter((group) => !preferencesComplete({ ...completed, ...group.completed, ...Object.fromEntries(
          Object.keys(group.completed).map((key) => [key, (empty as unknown as Record<string, unknown>)[key]]),
        ) } as WorkPreferences, track))
        .map((group) => group.id),
    );
    return {
      required,
      remaining: groups.filter((group) => required.has(group.id) && !group.answered).length,
      optionalAnswered: groups.some((group) => !required.has(group.id) && group.answered),
    };
  }, [office, personId, prefs, student, track]);

  useEffect(() => {
    if (groupStates.optionalAnswered) setOptionalOpen(true);
  }, [groupStates.optionalAnswered]);

  const load = useCallback(async () => {
    setPrefs(await loadPreferences(personId));
    setLoading(false);
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  const patch = (p: Partial<WorkPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...p }));
    setDirty(true);
  };

  const toggle = (
    key: "care_types" | "shift_patterns" | "engagement_types" | "function_areas"
       | "employer_types" | "contract_types" | "placement_types",
    code: string,
  ) => {
    if (readOnly) return;
    const list = prefs[key];
    patch({ [key]: list.includes(code) ? list.filter((c) => c !== code) : [...list, code] } as any);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await savePreferences(prefs, actorName);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error, variant: "destructive" });
      return;
    }
    setDirty(false);
    toast({ title: "Preferences saved", description: "Matching uses this straight away." });
    onSaved?.();
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (readOnly) {
    const chips = (codes: string[], labels: Record<string, string>) =>
      codes.length === 0
        ? <span className="text-xs text-muted-foreground">Not said yet</span>
        : codes.map((c) => <Badge key={c} variant="secondary" className="rounded-full">{labels[c] ?? c}</Badge>);
    return (
      <Card className="rounded-xl border-border/70 shadow-none">
        <CardContent className="space-y-4 p-4 text-sm">
          {office ? (
            <>
              <div className="flex flex-wrap gap-1.5">{chips(prefs.function_areas, FUNCTION_AREA_LABEL)}</div>
              <div className="flex flex-wrap gap-1.5">{chips(prefs.contract_types, CONTRACT_TYPE_LABEL)}</div>
            </>
          ) : student ? (
            <div className="flex flex-wrap gap-1.5">{chips(prefs.placement_types, PLACEMENT_LABEL)}</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">{chips(prefs.care_types, CARE_TYPE_LABEL)}</div>
              <div className="text-xs text-muted-foreground">
                {LIVE_IN_OPTIONS.find((o) => o.code === prefs.live_in)?.label}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const requiredCount = groupStates.required.size;
  const matchIntro = requiredCount === 1
    ? "Answer this one and we can start putting you forward."
    : `Answer these ${requiredCount === 2 ? "two" : "three"} and we can start putting you forward.`;

  const sharedOptional = (
    <Card className="rounded-xl border-border/70 shadow-none">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div className={cn("space-y-1.5", office && "hidden")}>
          <Label className="text-xs">Longest journey you will make (minutes)</Label>
          <Input
            type="number"
            min={0}
            value={prefs.max_travel_minutes ?? ""}
            onChange={(e) => patch({ max_travel_minutes: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="e.g. 60"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">How soon can you start?</Label>
          <Select value={prefs.notice_period ?? ""} onValueChange={(v) => patch({ notice_period: v })}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>
              {NOTICE_PERIODS.map((n) => <SelectItem key={n.code} value={n.code}>{n.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Would you relocate for the right role?</Label>
          <div className="flex gap-2">
            <Chip label="Yes" on={prefs.willing_to_relocate === true} onClick={() => patch({ willing_to_relocate: true })} />
            <Chip label="No" on={prefs.willing_to_relocate === false} onClick={() => patch({ willing_to_relocate: false })} />
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Anything else we should know</Label>
          <Textarea
            rows={3}
            value={prefs.notes ?? ""}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Languages you prefer, areas you know well, work you would rather not take."
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">What we match on</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {matchIntro}
        </p>
      </div>

      <div className="space-y-4">
        {office && groupStates.required.has("function") && (
          <Card className="rounded-xl border-border/70 shadow-none">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div>
                <p className="text-sm font-semibold">{voice === "candidate" ? "Which areas of work do you do?" : "Function areas"}</p>
                <p className="text-xs text-muted-foreground">
                  {voice === "candidate" ? "Pick every area you can work in. We match roles to these." : "Stated by the candidate. Roles are matched against these areas."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {FUNCTION_AREAS.map((f) => <Chip key={f.code} label={f.label} on={prefs.function_areas.includes(f.code)} onClick={() => toggle("function_areas", f.code)} />)}
              </div>
            </CardContent>
          </Card>
        )}

        {office && groupStates.required.has("contract") && (
          <Card className="rounded-xl border-border/70 shadow-none">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <p className="text-sm font-semibold">{voice === "candidate" ? "What kind of contract suits you?" : "Contract types accepted"}</p>
              <div className="flex flex-wrap gap-2">
                {CONTRACT_TYPES.map((c) => <Chip key={c.code} label={c.label} on={prefs.contract_types.includes(c.code)} onClick={() => toggle("contract_types", c.code)} />)}
              </div>
            </CardContent>
          </Card>
        )}

        {student && groupStates.required.has("placement") && (
          <Card className="rounded-xl border-border/70 shadow-none">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div>
                <p className="text-sm font-semibold">{voice === "candidate" ? "What are you looking for?" : "Placement sought"}</p>
                <p className="text-xs text-muted-foreground">
                  {voice === "candidate" ? "Pick everything that would work around your studies." : "Stated by the student. Opportunities are matched against these."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PLACEMENT_TYPES.map((pt) => <Chip key={pt.code} label={pt.label} on={prefs.placement_types.includes(pt.code)} onClick={() => toggle("placement_types", pt.code)} />)}
              </div>
            </CardContent>
          </Card>
        )}

        {care && groupStates.required.has("care") && (
          <Card className="rounded-xl border-border/70 shadow-none">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div><p className="text-sm font-semibold">{t.careTitle}</p><p className="text-xs text-muted-foreground">{t.careHelp}</p></div>
              <div className="flex flex-wrap gap-2">
                {CARE_TYPES.map((c) => <Chip key={c.code} label={c.label} on={prefs.care_types.includes(c.code)} onClick={() => toggle("care_types", c.code)} />)}
              </div>
            </CardContent>
          </Card>
        )}

        {care && groupStates.required.has("live-in") && (
          <Card className="rounded-xl border-border/70 shadow-none">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <p className="text-sm font-semibold">{t.liveIn}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {LIVE_IN_OPTIONS.filter((o) => o.code !== "unknown").map((o) => (
                  <button key={o.code} type="button" onClick={() => patch({ live_in: o.code })} className={cn("min-h-11 rounded-xl border p-3 text-left transition-colors", prefs.live_in === o.code ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}>
                    <p className="text-sm font-medium">{o.label}</p><p className="text-xs text-muted-foreground">{o.help}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {care && groupStates.required.has("shifts") && (
          <Card className="rounded-xl border-border/70 shadow-none">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <p className="text-sm font-semibold">{t.shifts}</p>
              <div className="flex flex-wrap gap-2">
                {SHIFT_PATTERNS.map((shift) => <Chip key={shift.code} label={shift.label} on={prefs.shift_patterns.includes(shift.code)} onClick={() => toggle("shift_patterns", shift.code)} />)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Collapsible open={optionalOpen} onOpenChange={setOptionalOpen}>
        <div className="border-y border-border py-1">
          <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between gap-4 py-3 text-left">
            <span>
              <span className="block text-sm font-semibold text-foreground">Add more detail</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Optional. The more we know, the better the fit.</span>
            </span>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", optionalOpen && "rotate-180")} />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-4 pt-4">
          {office && (
            <Card className="rounded-xl border-border/70 shadow-none">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{voice === "candidate" ? "Who would you work for?" : "Employer types accepted"}</p>
                  <div className="flex flex-wrap gap-2">{EMPLOYER_TYPES.map((e) => <Chip key={e.code} label={e.label} on={prefs.employer_types.includes(e.code)} onClick={() => toggle("employer_types", e.code)} />)}</div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{voice === "candidate" ? "How do you want to work?" : "Work setting"}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {WORK_SETTINGS.map((o) => <button key={o.code} type="button" onClick={() => patch({ work_setting: o.code })} className={cn("min-h-11 rounded-xl border p-3 text-left transition-colors", prefs.work_setting === o.code ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}><p className="text-sm font-medium">{o.label}</p><p className="text-xs text-muted-foreground">{o.help}</p></button>)}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label className="text-xs">{voice === "candidate" ? "What are you looking to earn?" : "Salary expectation"}</Label><Select value={prefs.salary_band ?? ""} onValueChange={(v) => patch({ salary_band: v })}><SelectTrigger className="h-11"><SelectValue placeholder="Choose a band" /></SelectTrigger><SelectContent>{SALARY_BANDS.map((sb) => <SelectItem key={sb.code} value={sb.code}>{sb.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label className="text-xs">{voice === "candidate" ? "Job titles you are after" : "Job titles sought"}</Label><Input value={prefs.roles_wanted_other ?? ""} onChange={(e) => patch({ roles_wanted_other: e.target.value })} placeholder="e.g. Practice Manager, Payroll Officer" /></div>
                </div>
              </CardContent>
            </Card>
          )}

          {care && (
            <>
              <Card className="rounded-xl border-border/70 shadow-none">
                <CardContent className="space-y-3 p-4 sm:p-5"><p className="text-sm font-semibold">{t.length}</p><div className="flex flex-wrap gap-2">{ENGAGEMENT_TYPES.map((engagement) => <Chip key={engagement.code} label={engagement.label} on={prefs.engagement_types.includes(engagement.code)} onClick={() => toggle("engagement_types", engagement.code)} />)}</div></CardContent>
              </Card>
              <Card className="rounded-xl border-border/70 shadow-none">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div><p className="text-sm font-semibold">{t.householdTitle}</p><p className="text-xs text-muted-foreground">{t.householdHelp}</p></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label className="text-xs">Client sex you prefer</Label><Select value={prefs.client_sex} onValueChange={(v) => patch({ client_sex: v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{CLIENT_SEX_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label className="text-xs">Household faith you prefer</Label><Select value={prefs.client_religion} onValueChange={(v) => patch({ client_religion: v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{CLIENT_RELIGION_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label className="text-xs">{t.ownFaith}</Label><Input value={prefs.religion ?? ""} onChange={(e) => patch({ religion: e.target.value })} placeholder="e.g. Christian, Muslim, none" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Pets in the home</Label><Select value={prefs.pets} onValueChange={(v) => patch({ pets: v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{PETS_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label className="text-xs">Smoking households</Label><Select value={prefs.smoking_household} onValueChange={(v) => patch({ smoking_household: v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{SMOKING_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label className="text-xs">{t.dealBreakers}</Label><Input value={prefs.deal_breakers ?? ""} onChange={(e) => patch({ deal_breakers: e.target.value })} placeholder="e.g. no night driving" /></div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          {sharedOptional}
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-2">
        <p className="text-right text-sm font-medium text-muted-foreground">
          {groupStates.remaining === 0 ? "Ready to save." : groupStates.remaining === 1 ? "One more to go" : `${groupStates.remaining} more to go`}
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{prefs.updated_at ? `Last updated ${new Date(prefs.updated_at).toLocaleDateString("en-GB")}` : "Not saved yet"}</p>
          <Button className="min-h-11" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save preferences
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkPreferencesPanel;
