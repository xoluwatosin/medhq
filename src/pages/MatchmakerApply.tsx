import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { MapPin, ArrowLeft, Loader2, Upload, CheckCircle2 } from "lucide-react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { adminDb } from "@/lib/admin-utils";
import { getAttribution } from "@/lib/utm";
import {
  DocumentField,
  Question,
  StandardFieldsConfig,
  normaliseStandardFields,
} from "@/lib/matchmaker";

interface Opp {
  id: string; slug: string; title: string; summary: string | null;
  location: string | null; status: string;
  document_fields: DocumentField[]; questions: Question[];
  standard_fields: StandardFieldsConfig;
}

const MatchmakerApply = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [opp, setOpp] = useState<Opp | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { user, loading: authLoading } = useAuth();
  // The person record behind the signed-in account, if we hold one.
  const [person, setPerson] = useState<any>(null);
  const [personLoading, setPersonLoading] = useState(true);

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    current_position: "", years_experience: "", cover_note: "",
  });
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});

  useEffect(() => {
    (async () => {
      const { data } = await adminDb()
        .from("matchmaker_opportunities")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      setOpp(data ? {
        ...data,
        document_fields: Array.isArray(data.document_fields) ? data.document_fields : [],
        questions: Array.isArray(data.questions) ? data.questions : [],
        standard_fields: normaliseStandardFields((data as any).standard_fields),
      } : null);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    })();
  }, [slug]);

  // Applying is an act of a signed-in person. Their profile fills the form so
  // they only answer what is specific to this role.
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setPerson(null); setPersonLoading(false); return; }
    (async () => {
      let { data: p } = await supabase
        .from("mu_people" as any).select("*").eq("auth_user_id", user.id).maybeSingle();
      if (!p) {
        const { data: claimed } = await supabase.rpc("mu_claim_my_person" as any);
        if (claimed) {
          const retry = await supabase
            .from("mu_people" as any).select("*").eq("auth_user_id", user.id).maybeSingle();
          p = retry.data;
        }
      }
      const row = p as any;
      setPerson(row ?? null);
      if (row) {
        const parts = String(row.full_name || "").trim().split(/\s+/);
        setForm((f) => ({
          ...f,
          first_name: f.first_name || parts[0] || "",
          last_name: f.last_name || parts.slice(1).join(" ") || "",
          email: f.email || row.email || user.email || "",
          phone: f.phone || row.phone || "",
          current_position: f.current_position || row.current_position || "",
          years_experience: f.years_experience || (row.years_experience != null ? String(row.years_experience) : ""),
        }));
      } else {
        setForm((f) => ({ ...f, email: f.email || user.email || "" }));
      }
      setPersonLoading(false);
    })();
  }, [authLoading, user]);

  if (loading || authLoading || (personLoading && !!user)) {
    return <div className="min-h-dvh flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!opp) {
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <MedicHeader />
        <main className="flex-1 pt-24 pb-16 text-center px-4">
          <h1 className="font-serif text-3xl font-bold">Opportunity not found</h1>
          <Button asChild className="mt-6"><Link to="/hm">All opportunities</Link></Button>
        </main>
        <Footer />
      </div>
    );
  }

  // Signed-out visitors meet the account step first. We keep the destination so
  // they land back on this application the moment they are in.
  if (!user) {
    const next = encodeURIComponent(`/hm/${opp.slug}/apply`);
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <SEO title={`Apply — ${opp.title}`} description="Apply through the Healthcare Matchmakers Network." path={`/hm/${opp.slug}/apply`} noindex breadcrumbs={[]} />
        <MedicHeader />
        <main className="flex-1 pt-10 pb-16">
          <div className="max-w-xl mx-auto px-5 sm:px-6">
            <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(`/hm/${opp.slug}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />Job details
            </Button>
            <div className="kit-curve-sm border border-border bg-background p-6 sm:p-8 space-y-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Applying for</p>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold leading-tight">{opp.title}</h1>
              <p className="text-base text-muted-foreground">
                Applications run through your candidate profile, so your details and documents travel with them and you
                can see where each one stands. It takes a minute to open.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild><Link to={`/portal/login?next=${next}`}>Sign in and apply</Link></Button>
                <Button variant="outline" asChild><Link to="/join">Create a profile</Link></Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Applied to us before? Your profile is already here. Sign in with the same email, or ask for a link on
                the sign-in page.
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const sf = opp.standard_fields;
  const setAns = (qid: string, value: any) => setAnswers((a) => ({ ...a, [qid]: value }));

  const isReq = (state: "off" | "optional" | "required") => state === "required";
  const isShown = (state: "off" | "optional" | "required") => state !== "off";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      toast({ title: "First name, last name and email are required", variant: "destructive" }); return;
    }
    if (isReq(sf.phone) && !form.phone.trim()) { toast({ title: "Phone is required", variant: "destructive" }); return; }
    if (isReq(sf.current_position) && !form.current_position.trim()) { toast({ title: "Current role is required", variant: "destructive" }); return; }
    if (isReq(sf.years_experience) && !form.years_experience.trim()) { toast({ title: "Years of experience is required", variant: "destructive" }); return; }
    if (isReq(sf.cover_note) && !form.cover_note.trim()) { toast({ title: "Cover note is required", variant: "destructive" }); return; }

    for (const d of opp.document_fields) {
      if (d.required && !files[d.key]) { toast({ title: `${d.label} is required`, variant: "destructive" }); return; }
    }
    for (const q of opp.questions) {
      if (q.required) {
        const v = answers[q.id];
        const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
        if (empty && q.type !== "file") { toast({ title: `${q.label} is required`, variant: "destructive" }); return; }
        if (q.type === "file" && !files[`q:${q.id}`]) { toast({ title: `${q.label} is required`, variant: "destructive" }); return; }
      }
    }

    setSubmitting(true);
    try {
      const documents: Record<string, string> = {};
      for (const d of opp.document_fields) {
        const file = files[d.key];
        if (!file) continue;
        const path = `matchmakers/${opp.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("applications").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        documents[d.label] = path;
      }

      const finalAnswers: Record<string, any> = {
        _first_name: form.first_name.trim(),
        _last_name: form.last_name.trim(),
      };
      for (const q of opp.questions) {
        if (q.type === "file") {
          const file = files[`q:${q.id}`];
          if (file) {
            const path = `matchmakers/${opp.id}/q-${q.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
            const { error: upErr } = await supabase.storage.from("applications").upload(path, file, { upsert: false });
            if (upErr) throw upErr;
            finalAnswers[q.label || q.id] = { type: "file", path };
          }
        } else if (answers[q.id] != null && answers[q.id] !== "") {
          finalAnswers[q.label || q.id] = answers[q.id];
        }
      }

      const full_name = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();

      const attr = getAttribution();

      const { error } = await adminDb().from("matchmaker_applications").insert({
        opportunity_id: opp.id,
        person_id: person?.id ?? null,
        full_name,
        email: form.email.trim(),
        phone: isShown(sf.phone) ? (form.phone.trim() || null) : null,
        current_position: isShown(sf.current_position) ? (form.current_position.trim() || null) : null,
        years_experience: isShown(sf.years_experience) && form.years_experience ? parseInt(form.years_experience, 10) : null,
        cover_note: isShown(sf.cover_note) ? (form.cover_note.trim() || null) : null,
        question_answers: finalAnswers,
        documents,
        utm_source: attr?.utm_source ?? null,
        utm_medium: attr?.utm_medium ?? null,
        utm_campaign: attr?.utm_campaign ?? null,
        utm_term: attr?.utm_term ?? null,
        utm_content: attr?.utm_content ?? null,
        referrer: attr?.referrer ?? null,
        landing_path: attr?.landing_path ?? null,
      } as any);
      if (error) throw error;
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message || "Try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestionInput = (q: Question) => {
    switch (q.type) {
      case "long_text":
        return <Textarea rows={4} value={answers[q.id] || ""} onChange={(e) => setAns(q.id, e.target.value)} />;
      case "number":
        return <Input type="number" value={answers[q.id] ?? ""} onChange={(e) => setAns(q.id, e.target.value)} />;
      case "date":
        return <Input type="date" value={answers[q.id] || ""} onChange={(e) => setAns(q.id, e.target.value)} />;
      case "yes_no":
        return (
          <RadioGroup value={answers[q.id] || ""} onValueChange={(v) => setAns(q.id, v)} className="flex gap-4">
            <label className="flex items-center gap-2 text-base"><RadioGroupItem value="Yes" />Yes</label>
            <label className="flex items-center gap-2 text-base"><RadioGroupItem value="No" />No</label>
          </RadioGroup>
        );
      case "single_select":
        return (
          <RadioGroup value={answers[q.id] || ""} onValueChange={(v) => setAns(q.id, v)} className="space-y-2">
            {(q.options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-base"><RadioGroupItem value={opt} />{opt}</label>
            ))}
          </RadioGroup>
        );
      case "multi_select": {
        const selected: string[] = Array.isArray(answers[q.id]) ? answers[q.id] : [];
        return (
          <div className="space-y-2">
            {(q.options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-base">
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(c) => setAns(q.id, c ? [...selected, opt] : selected.filter((x) => x !== opt))}
                />
                {opt}
              </label>
            ))}
          </div>
        );
      }
      case "file":
        return (
          <label className="inline-flex items-center gap-2 text-base cursor-pointer border border-border rounded-full px-4 py-2 hover:bg-muted">
            <Upload className="h-4 w-4" />
            <span>{files[`q:${q.id}`]?.name || "Upload file"}</span>
            <input type="file" className="hidden" onChange={(e) => setFiles({ ...files, [`q:${q.id}`]: e.target.files?.[0] || null })} />
          </label>
        );
      default:
        return <Input value={answers[q.id] || ""} onChange={(e) => setAns(q.id, e.target.value)} className="text-base" />;
    }
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SEO
        title={`Apply — ${opp.title}`}
        description="Apply through the Healthcare Matchmakers Network."
        path={`/hm/${opp.slug}/apply`}
        noindex
        breadcrumbs={[]}
      />
      <MedicHeader />

      {/* Toggle bar: Job details | Application */}
      <div className="sticky top-16 sm:top-20 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 flex items-center gap-1 py-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/hm/${opp.slug}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />Job details
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">Application</span>
        </div>
      </div>

      <main className="flex-1 pt-6 pb-16">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          {/* Compact opportunity summary card */}
          <div className="kit-curve-sm border border-border bg-muted/40 p-5 mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Applying for</p>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold leading-tight">{opp.title}</h1>
            {opp.location && (
              <p className="text-base text-muted-foreground mt-2 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" /><span>{opp.location}</span>
              </p>
            )}
            <div className="mt-3">
              <Button variant="link" className="px-0 h-auto text-base" onClick={() => navigate(`/hm/${opp.slug}`)}>
                View full job details
              </Button>
            </div>
          </div>

          {done ? (
            <div className="kit-curve-sm border border-border bg-background p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" />
              <h2 className="font-serif text-2xl font-semibold">Application submitted</h2>
              <p className="text-muted-foreground mt-2">Thanks — we'll be in touch if there's a match.</p>
              <div className="mt-6 flex gap-3 justify-center flex-wrap">
                <Button variant="outline" asChild><Link to={`/hm/${opp.slug}`}>Back to job details</Link></Button>
                <Button asChild><Link to="/hm">All opportunities</Link></Button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="kit-curve-sm border border-border bg-background p-5 sm:p-7 space-y-6">
              <div className="space-y-5">
                <h2 className="font-serif text-xl sm:text-2xl font-semibold">Your details</h2>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div><Label htmlFor="fn" className="text-base">First name *</Label><Input id="fn" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="mt-2 text-base" /></div>
                  <div><Label htmlFor="ln" className="text-base">Last name *</Label><Input id="ln" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="mt-2 text-base" /></div>
                  <div className="sm:col-span-2"><Label htmlFor="em" className="text-base">Email *</Label><Input id="em" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 text-base" /></div>
                  {isShown(sf.phone) && (
                    <div><Label htmlFor="ph" className="text-base">Phone{isReq(sf.phone) && " *"}</Label><Input id="ph" required={isReq(sf.phone)} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-2 text-base" /></div>
                  )}
                  {isShown(sf.current_position) && (
                    <div><Label htmlFor="cp" className="text-base">Current role{isReq(sf.current_position) && " *"}</Label><Input id="cp" required={isReq(sf.current_position)} value={form.current_position} onChange={(e) => setForm({ ...form, current_position: e.target.value })} className="mt-2 text-base" /></div>
                  )}
                  {isShown(sf.years_experience) && (
                    <div><Label htmlFor="yr" className="text-base">Years of experience{isReq(sf.years_experience) && " *"}</Label><Input id="yr" type="number" min={0} required={isReq(sf.years_experience)} value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: e.target.value })} className="mt-2 text-base" /></div>
                  )}
                </div>
                {isShown(sf.cover_note) && (
                  <div><Label htmlFor="cn" className="text-base">Cover note{isReq(sf.cover_note) && " *"}</Label><Textarea id="cn" rows={4} required={isReq(sf.cover_note)} value={form.cover_note} onChange={(e) => setForm({ ...form, cover_note: e.target.value })} className="mt-2 text-base" /></div>
                )}
              </div>

              {opp.questions.length > 0 && (
                <div className="space-y-7 pt-2 border-t border-border">
                  <h2 className="font-serif text-xl sm:text-2xl font-semibold pt-4">A few questions</h2>
                  {opp.questions.map((q) => (
                    <div key={q.id} className="space-y-3">
                      <Label className="block text-base">
                        {q.label}{q.required && <span className="text-destructive"> *</span>}
                      </Label>
                      {q.help && <p className="text-sm text-muted-foreground">{q.help}</p>}
                      <div className="pt-1">{renderQuestionInput(q)}</div>
                    </div>
                  ))}
                </div>
              )}

              {opp.document_fields.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <h2 className="font-serif text-xl sm:text-2xl font-semibold pt-4">Documents</h2>
                  {opp.document_fields.map((d) => (
                    <div key={d.key} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium">{d.label}{d.required && <span className="text-destructive"> *</span>}</p>
                        {files[d.key] && <p className="text-sm text-muted-foreground truncate">{files[d.key]?.name}</p>}
                      </div>
                      <label className="inline-flex items-center gap-2 text-base cursor-pointer border border-border rounded-full px-4 py-2 hover:bg-muted shrink-0">
                        <Upload className="h-4 w-4" />
                        <span>Upload</span>
                        <input type="file" className="hidden" onChange={(e) => setFiles({ ...files, [d.key]: e.target.files?.[0] || null })} accept=".pdf,application/pdf" />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              <Button type="submit" size="lg" disabled={submitting} className="w-full rounded-full">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit application
              </Button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MatchmakerApply;
