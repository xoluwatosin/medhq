import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import { LAGOS_LGAS, ALL_STATES, getLGAsForState } from "@/lib/nigeria-locations";
import { LANGUAGES, FLUENCY_LEVELS, AVAILABILITY_OPTIONS, START_WINDOW_OPTIONS } from "@/lib/join-application-options";

interface LocationStepProps {
  data: any;
  errors: Record<string, string | undefined>;
  onChange: (field: string, value: any) => void;
}

const LocationStep = ({ data, errors, onChange }: LocationStepProps) => {
  const [selectedLang, setSelectedLang] = useState("");
  const lagosMode = data.livesInLagos === "yes";
  const lgaOptions = lagosMode ? LAGOS_LGAS : getLGAsForState(data.state);
  const commuteLGAs = lgaOptions.filter((l) => l !== data.lgaPrimary);

  const addLanguage = (lang: string) => {
    if (!lang || data.languages.some((l: any) => l.language === lang)) return;
    onChange("languages", [...data.languages, { language: lang, fluency: "Conversational" }]);
    setSelectedLang("");
  };
  const removeLanguage = (lang: string) => onChange("languages", data.languages.filter((l: any) => l.language !== lang));
  const updateFluency = (lang: string, fluency: string) => onChange("languages", data.languages.map((l: any) => l.language === lang ? { ...l, fluency } : l));
  const toggleAvailability = (opt: string) => onChange("availability", data.availability.includes(opt) ? data.availability.filter((a: string) => a !== opt) : [...data.availability, opt]);
  const toggleCommuteLGA = (lga: string) => onChange("lgasWillingToCommute", data.lgasWillingToCommute.includes(lga) ? data.lgasWillingToCommute.filter((l: string) => l !== lga) : [...data.lgasWillingToCommute, lga]);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Location, Languages &amp; Availability</h3>

      <div className="space-y-2">
        <Label>Do you live in Lagos? *</Label>
        <RadioGroup value={data.livesInLagos} onValueChange={(v) => { onChange("livesInLagos", v); onChange("state", ""); onChange("lgaPrimary", ""); onChange("lgasWillingToCommute", []); onChange("hasTransport", ""); }} className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" /><span className="text-sm">Yes</span></label>
          <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no" /><span className="text-sm">No</span></label>
        </RadioGroup>
        {errors.livesInLagos && <p className="text-destructive text-sm">{errors.livesInLagos}</p>}
      </div>

      {data.livesInLagos === "no" && (
        <div className="space-y-1.5">
          <Label>State *</Label>
          <Select value={data.state} onValueChange={(v) => { onChange("state", v); onChange("lgaPrimary", ""); onChange("lgasWillingToCommute", []); }}>
            <SelectTrigger className={`rounded-xl bg-background ${errors.state ? "border-destructive" : ""}`}><SelectValue placeholder="Select state" /></SelectTrigger>
            <SelectContent className="bg-popover max-h-60">{ALL_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          {errors.state && <p className="text-destructive text-sm">{errors.state}</p>}
        </div>
      )}

      {(lagosMode || (data.livesInLagos === "no" && data.state)) && lgaOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label>Your LGA *</Label>
          <Select value={data.lgaPrimary} onValueChange={(v) => { onChange("lgaPrimary", v); onChange("lgasWillingToCommute", []); }}>
            <SelectTrigger className={`rounded-xl bg-background ${errors.lgaPrimary ? "border-destructive" : ""}`}><SelectValue placeholder="Select LGA" /></SelectTrigger>
            <SelectContent className="bg-popover max-h-60">{lgaOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
          {errors.lgaPrimary && <p className="text-destructive text-sm">{errors.lgaPrimary}</p>}
        </div>
      )}

      {data.lgaPrimary && commuteLGAs.length > 0 && (
        <div className="space-y-2">
          <Label>Other LGAs you're willing to commute to</Label>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded-xl bg-background">
            {commuteLGAs.map((lga) => (
              <label key={lga} className="flex items-center gap-1.5 cursor-pointer text-sm">
                <Checkbox checked={data.lgasWillingToCommute.includes(lga)} onCheckedChange={() => toggleCommuteLGA(lga)} />{lga}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Do you have your own transport? *</Label>
        <RadioGroup value={data.hasTransport} onValueChange={(v) => onChange("hasTransport", v)} className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" /><span className="text-sm">Yes</span></label>
          <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no" /><span className="text-sm">No</span></label>
        </RadioGroup>
        {errors.hasTransport && <p className="text-destructive text-sm">{errors.hasTransport}</p>}
      </div>

      <div className="space-y-3">
        <Label>Languages *</Label>
        <Select value={selectedLang} onValueChange={addLanguage}>
          <SelectTrigger className="rounded-xl bg-background"><SelectValue placeholder="Add a language" /></SelectTrigger>
          <SelectContent className="bg-popover max-h-60">
            {LANGUAGES.filter((l) => !data.languages.some((dl: any) => dl.language === l)).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        {data.languages.length > 0 && (
          <div className="space-y-2">
            {data.languages.map((entry: any) => (
              <div key={entry.language} className="flex items-center gap-3 p-2 rounded-lg border bg-background">
                <span className="text-sm font-medium flex-1">{entry.language}</span>
                <Select value={entry.fluency} onValueChange={(v) => updateFluency(entry.language, v)}>
                  <SelectTrigger className="w-36 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">{FLUENCY_LEVELS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
                <button type="button" onClick={() => removeLanguage(entry.language)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        {errors.languages && <p className="text-destructive text-sm">{errors.languages}</p>}
      </div>

      <div className="space-y-2">
        <Label>Availability *</Label>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_OPTIONS.map((opt) => (
            <Badge key={opt} variant={data.availability.includes(opt) ? "default" : "outline"} className="cursor-pointer py-1.5 px-3 text-sm" onClick={() => toggleAvailability(opt)}>{opt}</Badge>
          ))}
        </div>
        {errors.availability && <p className="text-destructive text-sm">{errors.availability}</p>}
      </div>

      <div className="space-y-2">
        <Label>How soon can you start? *</Label>
        <RadioGroup value={data.startWindow} onValueChange={(v) => onChange("startWindow", v)} className="flex flex-col gap-2">
          {START_WINDOW_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value={opt.value} /><span className="text-sm">{opt.label}</span></label>
          ))}
        </RadioGroup>
        {errors.startWindow && <p className="text-destructive text-sm">{errors.startWindow}</p>}
      </div>

      {data.startWindow === "future" && (
        <div className="space-y-1.5">
          <Label>Target start date *</Label>
          <Input type="date" value={data.startDate} onChange={(e) => onChange("startDate", e.target.value)} className={`rounded-xl bg-background w-48 ${errors.startDate ? "border-destructive" : ""}`} />
          {errors.startDate && <p className="text-destructive text-sm">{errors.startDate}</p>}
        </div>
      )}
    </div>
  );
};

export default LocationStep;
