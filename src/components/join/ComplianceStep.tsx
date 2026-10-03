import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { NYSC_OPTIONS, isClinicalRole } from "@/lib/join-application-options";

interface ComplianceStepProps {
  data: any;
  errors: Record<string, string | undefined>;
  onChange: (field: string, value: string) => void;
}

const YesNoRadio = ({ label, value, onChange, error, options = [{ v: "yes", l: "Yes" }, { v: "no", l: "No" }] }: any) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-4">
      {options.map((opt: any) => (
        <label key={opt.v} className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value={opt.v} /><span className="text-sm">{opt.l}</span></label>
      ))}
    </RadioGroup>
    {error && <p className="text-destructive text-sm">{error}</p>}
  </div>
);

const ComplianceStep = ({ data, errors, onChange }: ComplianceStepProps) => {
  const isOther = data.role === "Other";
  const clinical = isClinicalRole(data.role);
  // NYSC: ask for clinical roles + Other (Nanny / Caregiver / Educator skip it)
  const showNysc = clinical || isOther;
  // Emergency med: clinical only
  const showEmergencyMed = clinical;
  // Training commitment: applies to every role we deploy
  const showTraining = true;

  const handleCriminalChange = (v: string) => {
    onChange("criminalRecord", v);
    if (v !== "yes") onChange("criminalRecordDetails", "");
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Eligibility &amp; Compliance</h3>

      {showNysc && (
        <div className="space-y-2">
          <Label>Have you completed NYSC, or do you hold a certificate of exemption? *</Label>
          <RadioGroup value={data.nyscStatus} onValueChange={(v) => onChange("nyscStatus", v)} className="flex flex-col gap-2">
            {NYSC_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value={opt.value} /><span className="text-sm">{opt.label}</span></label>
            ))}
          </RadioGroup>
          {errors.nyscStatus && <p className="text-destructive text-sm">{errors.nyscStatus}</p>}
        </div>
      )}

      <YesNoRadio label="Do you have the right to work in the country you are applying from? *" value={data.rightToWork} onChange={(v: string) => onChange("rightToWork", v)} error={errors.rightToWork} />
      <YesNoRadio label="Are you willing to submit to a background check? *" value={data.backgroundCheckConsent} onChange={(v: string) => onChange("backgroundCheckConsent", v)} error={errors.backgroundCheckConsent} />
      <YesNoRadio label="Do you have any criminal record? *" value={data.criminalRecord} onChange={handleCriminalChange} error={errors.criminalRecord} />

      {data.criminalRecord === "yes" && (
        <div className="space-y-1.5 pl-4 border-l-2 border-primary/20">
          <Label>Please provide brief context *</Label>
          <Textarea value={data.criminalRecordDetails} onChange={(e) => onChange("criminalRecordDetails", e.target.value)} maxLength={500} className="rounded-xl bg-background" />
          {errors.criminalRecordDetails && <p className="text-destructive text-sm">{errors.criminalRecordDetails}</p>}
        </div>
      )}

      <YesNoRadio label="Are you willing to undergo a drug test? *" value={data.drugTestConsent} onChange={(v: string) => onChange("drugTestConsent", v)} error={errors.drugTestConsent} />

      {showEmergencyMed && (
        <YesNoRadio label="Would you be interested in emergency medicine training? *" value={data.emergencyMedInterest} onChange={(v: string) => onChange("emergencyMedInterest", v)} error={errors.emergencyMedInterest} options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }, { v: "maybe", l: "Maybe" }]} />
      )}

      {showTraining && (
        <YesNoRadio label="Our roles include a period of virtual and in-person training. Can you commit to this? *" value={data.trainingCommitment} onChange={(v: string) => onChange("trainingCommitment", v)} error={errors.trainingCommitment} />
      )}
    </div>
  );
};

export default ComplianceStep;
