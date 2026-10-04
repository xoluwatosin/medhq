import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendEnquiryReply, submitCareRequest } from "@/lib/enquiries";
import { DIAL_CODES } from "@/components/request/care-kinds";
import { ChevronSteps } from "@/components/mc/brand";
import { art } from "@/components/mc/art";
import { cn } from "@/lib/utils";

/**
 * The facility enquiry, in two short steps: what the facility needs, then who
 * is asking. It lands in the same enquiry desk as care requests, on the
 * hospital_staffing, hospital_support or clinical_research line, so the admin inbox shows each
 * answer as a row and the tailored reply with the brochure goes out.
 *
 * Answer keys and options match the facility questions in the enquiry desk
 * (supabase/migrations/20260825152232_*.sql) so desk and form agree.
 */

const SERVICES = [
  { key: "staffing", label: "Clinical staff", line: "hospital_staffing", lineName: "Hospital staffing" },
  { key: "support", label: "Support services", line: "hospital_support", lineName: "Hospital support services" },
  { key: "research", label: "Clinical research staff", line: "clinical_research", lineName: "Clinical research" },
  { key: "other", label: "Something else", line: "general", lineName: "Something else" },
] as const;
type ServiceKey = (typeof SERVICES)[number]["key"];
export type FacilityServiceKey = ServiceKey;

const ROLES = ["Registered nurses", "Midwives", "Doctors", "Lab scientists", "Pharmacy", "Care assistants"];
const RESEARCH_ROLES = ["Research coordinators", "Research nurses", "Data managers", "Lab scientists", "Support staff"];
const SUPPORT_LINES = ["Portering and ward support", "Security", "Event medical cover", "Permanent placements", "Cleaning and hygiene"];
const COVER = ["One-off shifts", "Locum cover (weeks or months)", "Permanent hire", "Ongoing contract"];
const SHIFTS = ["Day shifts", "Night shifts", "Weekends", "Round the clock"];
const START = ["As soon as possible", "Within a week", "Within a month", "Planning ahead"];
const FACILITY_TYPES = ["Hospital", "Clinic", "Diagnostic centre or lab", "Research site", "Company or NGO", "Other"];

const emailOk = (v: string) => /^\S+@\S+\.\S+$/.test(v);

/** A row of tappable options; multi lets several be on at once. */
const Chips = ({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: readonly string[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) => (
  <div className="mt-2.5 flex flex-wrap gap-2">
    {options.map((o) => {
      const on = multi ? (value as string[]).includes(o) : value === o;
      return (
        <button
          key={o}
          type="button"
          aria-pressed={on}
          onClick={() =>
            multi
              ? onChange(on ? (value as string[]).filter((x) => x !== o) : [...(value as string[]), o])
              : onChange(o)
          }
          className={cn(
            "min-h-[40px] rounded-control border-2 px-3.5 text-left text-[14px] font-bold transition-colors duration-150",
            on ? "border-navy bg-navy text-white" : "border-navy/20 bg-white text-navy hover:border-brand",
          )}
        >
          {o}
        </button>
      );
    })}
  </div>
);

const Label = ({
  htmlFor,
  children,
  optional,
  first,
}: {
  htmlFor?: string;
  children: string;
  optional?: boolean;
  /** The first question in a step sits flush under the step bar. */
  first?: boolean;
}) => (
  <label htmlFor={htmlFor} className={cn("block text-[15px] font-extrabold leading-tight text-navy", first ? "mt-0" : "mt-6")}>
    {children}
    {optional && <span className="ml-1.5 text-[13px] font-semibold text-muted-foreground">optional</span>}
  </label>
);

const inputCls =
  "mt-2 w-full rounded-control border-2 border-navy/25 bg-white px-4 py-3 text-[16px] text-ink outline-none focus:border-brand";

/** initialService preselects the first answer, e.g. on the staffing page. */
const FacilityEnquiryForm = ({ initialService }: { initialService?: ServiceKey } = {}) => {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [sending, setSending] = useState(false);

  const [service, setService] = useState<ServiceKey | "">(initialService ?? "");
  const [roles, setRoles] = useState<string[]>([]);
  const [headcount, setHeadcount] = useState("");
  const [cover, setCover] = useState("");
  const [shifts, setShifts] = useState<string[]>([]);
  const [start, setStart] = useState("");

  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [facility, setFacility] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [dial, setDial] = useState("+234");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);

  const roleOptions = service === "support" ? SUPPORT_LINES : service === "research" ? RESEARCH_ROLES : ROLES;
  const roleQuestion = service === "support" ? "Which services do you need?" : "Which roles do you need?";

  const needDone = service !== "" && (service === "other" || roles.length > 0) && start !== "";
  const youDone =
    name.trim() && facility.trim() && emailOk(email.trim()) && phone.trim().length > 5 && consent;

  const pickService = (k: ServiceKey) => {
    if (k !== service) setRoles([]);
    setService(k);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youDone || !service) {
      toast.error("Please fill in the required details.");
      return;
    }
    const s = SERVICES.find((x) => x.key === service)!;
    const fullPhone = `${dial} ${phone.trim()}`;
    const answers: Record<string, string | string[]> = {
      looking_for: s.label,
      [service === "support" ? "support_lines" : "roles_needed"]: roles,
      headcount: headcount.trim(),
      cover_type: cover,
      shift_pattern: shifts,
      start_when: start,
      facility_name: facility.trim(),
      facility_type: facilityType,
      job_title: jobTitle.trim(),
    };
    // Drop the questions they skipped, so the desk only shows real answers.
    Object.keys(answers).forEach((k) => {
      const v = answers[k];
      if (!v || (Array.isArray(v) && v.length === 0)) delete answers[k];
    });
    const summary = [
      `${s.label} for ${facility.trim()}${city.trim() ? `, ${city.trim()}` : ""}`,
      roles.length ? roles.join(", ") : "",
      headcount.trim() ? `About ${headcount.trim()} people` : "",
      start ? `Start: ${start}` : "",
      notes.trim(),
    ]
      .filter(Boolean)
      .join(". ");

    setSending(true);
    try {
      const id = await submitCareRequest({
        name: name.trim(),
        email: email.trim(),
        phone: fullPhone,
        city: city.trim(),
        serviceLineKey: s.line,
        serviceLineName: s.lineName,
        message: summary,
        answers,
        consentEmail: consent,
        source: "for_facilities_form",
      });
      sendEnquiryReply(id).catch(() => undefined);
      supabase.functions
        .invoke("send-form-notification", {
          body: {
            formType: "contact",
            data: { name: name.trim(), email: email.trim(), phone: fullPhone, service: s.lineName, message: summary },
          },
        })
        .catch(() => undefined);
      setStep(2);
    } catch {
      toast.error("That did not send. Please try again, or message us on WhatsApp.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="relative w-full border-2 border-navy bg-white p-6 shadow-offset sm:p-7">
      <img src={art.objClipboardChecks} alt="" className="absolute -right-4 -top-8 h-[72px] rotate-[6deg]" />
      <h3 className="pr-12 text-[24px] leading-[1.15] tracking-[-0.04em]">Tell us what you need</h3>
      <p className="mt-2 text-[15px] leading-[1.6] text-body">
        Two quick steps. A coordinator calls you back to confirm scope, shifts and compliance.
      </p>
      <div className="mt-5">
        <ChevronSteps steps={["Your need", "Your facility", "Sent"]} current={step} />
      </div>

      {step === 0 && (
        <div className="mt-6">
          <Label first>What are you looking for?</Label>
          <Chips options={SERVICES.map((s) => s.label)} value={SERVICES.find((s) => s.key === service)?.label ?? ""} onChange={(v) => pickService(SERVICES.find((s) => s.label === v)!.key)} />

          {service && service !== "other" && (
            <>
              <Label>{roleQuestion}</Label>
              <p className="mt-1 text-[13px] text-muted-foreground">Choose as many as apply.</p>
              <Chips options={roleOptions} value={roles} onChange={(v) => setRoles(v as string[])} multi />
            </>
          )}

          {service && service !== "support" && service !== "other" && (
            <>
              <Label>What kind of cover?</Label>
              <Chips options={COVER} value={cover} onChange={(v) => setCover(v as string)} />
            </>
          )}

          {service && service !== "other" && (
            <>
              <Label>Which shifts?</Label>
              <Chips options={SHIFTS} value={shifts} onChange={(v) => setShifts(v as string[])} multi />

              <Label htmlFor="fe-headcount" optional>
                Roughly how many people?
              </Label>
              <input id="fe-headcount" inputMode="numeric" value={headcount} onChange={(e) => setHeadcount(e.target.value)} className={cn(inputCls, "max-w-[160px]")} />
            </>
          )}

          {service && (
            <>
              <Label>When do you need them?</Label>
              <Chips options={START} value={start} onChange={(v) => setStart(v as string)} />
            </>
          )}

          <button
            type="button"
            disabled={!needDone}
            onClick={() => setStep(1)}
            className="mt-7 min-h-[48px] w-full rounded-control bg-brand px-6 text-[16px] font-extrabold text-white shadow-offset-sm transition-colors duration-200 hover:bg-navy disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next: your facility <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="mt-6">
          <Label htmlFor="fe-facility" first>Facility or organisation</Label>
          <input id="fe-facility" value={facility} onChange={(e) => setFacility(e.target.value)} className={inputCls} autoComplete="organization" />

          <Label>Type of facility</Label>
          <Chips options={FACILITY_TYPES} value={facilityType} onChange={(v) => setFacilityType(v as string)} />

          <Label htmlFor="fe-city">Town or city</Label>
          <input id="fe-city" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} autoComplete="address-level2" placeholder="For example Ikeja, Lagos" />

          <div className="grid gap-x-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fe-name">Your name</Label>
              <input id="fe-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoComplete="name" />
            </div>
            <div>
              <Label htmlFor="fe-title" optional>
                Job title
              </Label>
              <input id="fe-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={inputCls} autoComplete="organization-title" />
            </div>
          </div>

          <Label htmlFor="fe-email">Work email</Label>
          <input id="fe-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" />

          <Label htmlFor="fe-phone">Phone</Label>
          <div className="mt-2 flex gap-2">
            {/* Shows just the code; the list underneath names each country. */}
            <div className="relative w-[92px] shrink-0 [&:focus-within>span]:border-brand">
              <span aria-hidden="true" className="pointer-events-none flex h-full items-center justify-between rounded-control border-2 border-navy/25 bg-white px-3 text-[15px] font-bold text-navy">
                {dial} <span className="text-[11px]">▼</span>
              </span>
              <select
                aria-label="Country code"
                value={dial}
                onChange={(e) => setDial(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                {DIAL_CODES.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} {d.label}
                  </option>
                ))}
              </select>
            </div>
            <input id="fe-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={cn(inputCls, "mt-0 min-w-0 flex-1")} autoComplete="tel-national" />
          </div>

          <Label htmlFor="fe-notes" optional>
            Anything else we should know?
          </Label>
          <textarea id="fe-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Specialties, wards, compliance or onboarding requirements" />

          <label className="mt-6 flex cursor-pointer items-start gap-3 bg-tint p-4 text-[14px] leading-[1.5] text-body">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--navy))]" />
            <span>I agree to be contacted about this request, and to Medic Connect holding these details to arrange cover.</span>
          </label>

          <div className="mt-7 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="min-h-[48px] whitespace-nowrap rounded-control border-2 border-navy px-4 text-[15px] font-extrabold text-navy transition-colors duration-200 hover:bg-tint"
            >
              <span aria-hidden="true">←</span> Back
            </button>
            <button
              type="submit"
              disabled={!youDone || sending}
              className="min-h-[48px] flex-1 whitespace-nowrap rounded-control bg-brand px-4 text-[15px] sm:text-[16px] font-extrabold text-white shadow-offset-sm transition-colors duration-200 hover:bg-navy disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Sending" : "Request a call back"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 flex items-center gap-4 bg-tint p-5">
          <img src={art.objHandshake} alt="" className="h-16 w-16 shrink-0 object-contain" />
          <div>
            <p className="text-[18px] font-extrabold leading-tight text-navy">Thank you, {name.trim().split(" ")[0]}.</p>
            <p className="mt-1 text-[15px] leading-[1.55] text-body">
              A coordinator will call you to confirm the details. We will also email you what happens next.
            </p>
          </div>
        </div>
      )}
    </form>
  );
};

export default FacilityEnquiryForm;
