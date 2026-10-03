import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PersonalStepProps {
  data: { firstName: string; lastName: string; email: string; phone: string };
  errors: Record<string, string | undefined>;
  onChange: (field: string, value: string) => void;
}

const PersonalStep = ({ data, errors, onChange }: PersonalStepProps) => (
  <div className="space-y-5">
    <h3 className="text-xl font-semibold">Personal Details</h3>
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="firstName">First Name *</Label>
        <Input id="firstName" value={data.firstName} onChange={(e) => onChange("firstName", e.target.value)} maxLength={50} className={`rounded-xl bg-background ${errors.firstName ? "border-destructive" : ""}`} />
        {errors.firstName && <p className="text-destructive text-sm">{errors.firstName}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lastName">Last Name *</Label>
        <Input id="lastName" value={data.lastName} onChange={(e) => onChange("lastName", e.target.value)} maxLength={50} className={`rounded-xl bg-background ${errors.lastName ? "border-destructive" : ""}`} />
        {errors.lastName && <p className="text-destructive text-sm">{errors.lastName}</p>}
      </div>
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="email">Email Address *</Label>
      <Input id="email" type="email" value={data.email} onChange={(e) => onChange("email", e.target.value)} maxLength={255} className={`rounded-xl bg-background ${errors.email ? "border-destructive" : ""}`} />
      {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="phone">Phone Number *</Label>
      <Input id="phone" type="tel" value={data.phone} onChange={(e) => onChange("phone", e.target.value)} maxLength={20} placeholder="+234..." className={`rounded-xl bg-background ${errors.phone ? "border-destructive" : ""}`} />
      {errors.phone && <p className="text-destructive text-sm">{errors.phone}</p>}
    </div>
  </div>
);

export default PersonalStep;
