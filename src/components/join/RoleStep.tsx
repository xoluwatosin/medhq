import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ROLES,
  QUALIFICATIONS_BY_ROLE,
  LICENSING_BODIES_BY_ROLE,
  roleRequiresLicenceQuestion,
  licenceAnswerNeedsBody,
} from "@/lib/join-application-options";

interface RoleStepProps {
  data: any;
  errors: Record<string, string | undefined>;
  onChange: (field: string, value: string) => void;
}

const RoleStep = ({ data, errors, onChange }: RoleStepProps) => {
  const isOther = data.role === "Other";
  const qualifications = data.role && !isOther ? (QUALIFICATIONS_BY_ROLE[data.role] || []) : [];
  const licensingBodies = data.role && !isOther ? (LICENSING_BODIES_BY_ROLE[data.role] || []) : [];

  const showLicenceQuestion = roleRequiresLicenceQuestion(data.role);
  const showBodyAndExpiry = showLicenceQuestion && licenceAnswerNeedsBody(data.licenseToPractice);
  const showExpiry = showBodyAndExpiry && data.licenseToPractice === "yes";

  // Reset all licence-related fields when role changes
  const handleRoleChange = (v: string) => {
    onChange("role", v);
    onChange("roleOther", "");
    onChange("qualification", "");
    onChange("qualificationOther", "");
    onChange("licenseToPractice", "");
    onChange("licensingBody", "");
    onChange("licensingBodyOther", "");
    onChange("licenseExpiry", "");
  };

  // Clear body & expiry when licence answer no longer needs them
  const handleLicenceAnswerChange = (v: string) => {
    onChange("licenseToPractice", v);
    if (!licenceAnswerNeedsBody(v)) {
      onChange("licensingBody", "");
      onChange("licensingBodyOther", "");
      onChange("licenseExpiry", "");
    } else if (v === "in_progress") {
      onChange("licenseExpiry", "");
    }
  };

  return (
    <div className="space-y-5">
      <h3 className="text-xl font-semibold">Role &amp; Qualifications</h3>

      {/* 1. Role */}
      <div className="space-y-1.5">
        <Label>Role *</Label>
        <Select value={data.role} onValueChange={handleRoleChange}>
          <SelectTrigger className={`rounded-xl bg-background ${errors.role ? "border-destructive" : ""}`}><SelectValue placeholder="Select a role" /></SelectTrigger>
          <SelectContent className="bg-popover">{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        {errors.role && <p className="text-destructive text-sm">{errors.role}</p>}
      </div>

      {/* 2. Role — Other (specify) */}
      {isOther && (
        <div className="space-y-1.5">
          <Label>Please specify your role *</Label>
          <Input value={data.roleOther} onChange={(e) => onChange("roleOther", e.target.value)} maxLength={100} className={`rounded-xl bg-background ${errors.roleOther ? "border-destructive" : ""}`} />
          {errors.roleOther && <p className="text-destructive text-sm">{errors.roleOther}</p>}
        </div>
      )}

      {/* 3. Qualification — known role */}
      {qualifications.length > 0 && (
        <div className="space-y-1.5">
          <Label>Qualification *</Label>
          <Select value={data.qualification} onValueChange={(v) => { onChange("qualification", v); if (v !== "Other") onChange("qualificationOther", ""); }}>
            <SelectTrigger className={`rounded-xl bg-background ${errors.qualification ? "border-destructive" : ""}`}><SelectValue placeholder="Select qualification" /></SelectTrigger>
            <SelectContent className="bg-popover">{qualifications.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
          </Select>
          {errors.qualification && <p className="text-destructive text-sm">{errors.qualification}</p>}
        </div>
      )}

      {/* 3b. Qualification — known role's "Other" */}
      {!isOther && data.qualification === "Other" && (
        <div className="space-y-1.5">
          <Label>Please specify your qualification *</Label>
          <Input value={data.qualificationOther} onChange={(e) => onChange("qualificationOther", e.target.value)} maxLength={100} className={`rounded-xl bg-background ${errors.qualificationOther ? "border-destructive" : ""}`} />
          {errors.qualificationOther && <p className="text-destructive text-sm">{errors.qualificationOther}</p>}
        </div>
      )}

      {/* 3c. Qualification — Other role: free-text qualification */}
      {isOther && data.roleOther && (
        <div className="space-y-1.5">
          <Label>Qualification or training *</Label>
          <Input
            value={data.qualificationOther}
            onChange={(e) => onChange("qualificationOther", e.target.value)}
            maxLength={150}
            placeholder="e.g. Diploma in Public Health, NEBOSH IGC"
            className={`rounded-xl bg-background ${errors.qualificationOther ? "border-destructive" : ""}`}
          />
          <p className="text-xs text-muted-foreground">Briefly describe your highest relevant qualification or training.</p>
          {errors.qualificationOther && <p className="text-destructive text-sm">{errors.qualificationOther}</p>}
        </div>
      )}

      {/* 4. Years of Experience */}
      <div className="space-y-1.5">
        <Label>Years of Experience *</Label>
        <Input type="number" min={0} max={60} value={data.yearsExperience} onChange={(e) => onChange("yearsExperience", e.target.value)} className={`rounded-xl bg-background w-32 ${errors.yearsExperience ? "border-destructive" : ""}`} />
        {errors.yearsExperience && <p className="text-destructive text-sm">{errors.yearsExperience}</p>}
      </div>

      {/* 5. Do you have a licence to practise? */}
      {showLicenceQuestion && (
        <div className="space-y-2">
          <Label>
            {isOther
              ? "Does your role require a licence, and do you hold one? *"
              : "Do you have a licence to practise for the role you are applying for? *"}
          </Label>
          <RadioGroup value={data.licenseToPractice} onValueChange={handleLicenceAnswerChange} className="flex flex-wrap gap-4">
            {[
              { v: "yes", l: "Yes" },
              { v: "no", l: "No" },
              { v: "in_progress", l: "In progress" },
              ...(isOther ? [{ v: "not_applicable", l: "Not applicable" }] : []),
            ].map((opt) => (
              <label key={opt.v} className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value={opt.v} /><span className="text-sm">{opt.l}</span></label>
            ))}
          </RadioGroup>
          {errors.licenseToPractice && <p className="text-destructive text-sm">{errors.licenseToPractice}</p>}
        </div>
      )}

      {/* 6. Licensing body — known role dropdown */}
      {showBodyAndExpiry && !isOther && licensingBodies.length > 0 && (
        <div className="space-y-1.5">
          <Label>Licensing Body *</Label>
          <Select value={data.licensingBody} onValueChange={(v) => { onChange("licensingBody", v); if (v !== "Other") onChange("licensingBodyOther", ""); }}>
            <SelectTrigger className={`rounded-xl bg-background ${errors.licensingBody ? "border-destructive" : ""}`}><SelectValue placeholder="Select licensing body" /></SelectTrigger>
            <SelectContent className="bg-popover">{licensingBodies.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
          {errors.licensingBody && <p className="text-destructive text-sm">{errors.licensingBody}</p>}
        </div>
      )}

      {/* 6b. Licensing body — known role's "Other" */}
      {showBodyAndExpiry && !isOther && data.licensingBody === "Other" && (
        <div className="space-y-1.5">
          <Label>Please specify licensing body *</Label>
          <Input value={data.licensingBodyOther} onChange={(e) => onChange("licensingBodyOther", e.target.value)} maxLength={100} className={`rounded-xl bg-background ${errors.licensingBodyOther ? "border-destructive" : ""}`} />
          {errors.licensingBodyOther && <p className="text-destructive text-sm">{errors.licensingBodyOther}</p>}
        </div>
      )}

      {/* 6c. Licensing body — Other role: free text */}
      {showBodyAndExpiry && isOther && (
        <div className="space-y-1.5">
          <Label>Licensing body *</Label>
          <Input
            value={data.licensingBodyOther}
            onChange={(e) => onChange("licensingBodyOther", e.target.value)}
            maxLength={100}
            placeholder="e.g. Pharmacists Council of Nigeria"
            className={`rounded-xl bg-background ${errors.licensingBodyOther ? "border-destructive" : ""}`}
          />
          {errors.licensingBodyOther && <p className="text-destructive text-sm">{errors.licensingBodyOther}</p>}
        </div>
      )}

      {/* 7. Licence expiry — only if currently held */}
      {showExpiry && (
        <div className="space-y-1.5 max-w-xs">
          <Label>Licence Expiry (month &amp; year)</Label>
          <Input type="month" value={data.licenseExpiry} onChange={(e) => onChange("licenseExpiry", e.target.value)} className="rounded-xl bg-background" />
        </div>
      )}
    </div>
  );
};

export default RoleStep;
