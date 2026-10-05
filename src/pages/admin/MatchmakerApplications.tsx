import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, ExternalLink, FileText, Search, ArrowUpDown, Mail, MailX, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MuEmpty, MuPageHeader, MuStatus, type MuTone } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ExportDropdown from "@/components/admin/ExportDropdown";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { APPLICATION_STAGES, STAGE_LABEL } from "@/lib/applications";
import { openDocumentTab } from "@/lib/documents";
import ConsoleMobileList, { ConsoleMobileRow } from "@/components/admin/console/ConsoleMobileList";

const sourceOf = (a: { utm_source: string | null; referrer: string | null }) => {
  if (a.utm_source) return a.utm_source.toLowerCase();
  if (a.referrer) {
    try { return new URL(a.referrer).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "direct"; }
  }
  return "direct";
};

interface EmailLogRow {
  id: string;
  application_id: string;
  email_type: string;
  status: string;
  created_at: string;
}


interface App {
  id: string;
  opportunity_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  current_position: string | null;
  years_experience: number | null;
  cover_note: string | null;
  documents: Record<string, string>;
  requirement_answers: Record<string, any>;
  question_answers: Record<string, any>;
  status: string;
  /** The one application stage, shared with the candidate's record. */
  stage: string;
  admin_notes: string | null;
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_path: string | null;
}

// One stage list for an application, the same one the candidate's record and
// their portal use. The old status column is kept in step by the database.
const stageTone = (stage: string): MuTone =>
  stage === "offer_made" ? "good"
    : stage === "applied" ? "info"
      : stage === "not_taken_forward" || stage === "withdrawn" ? "neutral"
        : "warning";
const STAGE_IN_PROGRESS = ["shortlisted", "interview_offered", "interview_booked", "interview_held"];

interface MatchmakerApplicationsProps {
  embedded?: boolean;
}

const MatchmakerApplications = ({ embedded }: MatchmakerApplicationsProps) => {

  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [opp, setOpp] = useState<{ title: string; slug: string } | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<App | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"created_desc" | "created_asc" | "name_asc" | "exp_desc" | "exp_asc">("created_desc");

  // Candidate communications
  const [emailLog, setEmailLog] = useState<EmailLogRow[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [composeType, setComposeType] = useState<"interview_invite" | "rejection" | null>(null);
  const [bookingLink, setBookingLink] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [templates, setTemplates] = useState<Record<string, { subject: string; body: string }>>({});
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);


  const fetchData = async () => {
    const [{ data: o }, { data: a }, { data: logs }, { data: tpl }] = await Promise.all([
      adminDb().from("matchmaker_opportunities").select("title, slug").eq("id", id).single(),
      adminDb().from("matchmaker_applications").select("*").eq("opportunity_id", id).order("created_at", { ascending: false }),
      adminDb().from("matchmaker_email_log").select("id, application_id, email_type, status, created_at").eq("opportunity_id", id),
      adminDb().from("admin_settings").select("key, value").in("key", ["email_tpl_interview_invite", "email_tpl_rejection"]),
    ]);
    setOpp(o || null);
    setApps((a as App[]) || []);
    setEmailLog((logs as EmailLogRow[]) || []);
    const map: Record<string, { subject: string; body: string }> = {};
    (tpl || []).forEach((t: any) => {
      const k = t.key === "email_tpl_interview_invite" ? "interview_invite" : "rejection";
      map[k] = t.value || { subject: "", body: "" };
    });
    setTemplates(map);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const sentMap = useMemo(() => {
    const m = new Map<string, { invite: boolean; reject: boolean }>();
    emailLog.filter((l) => l.status === "sent").forEach((l) => {
      const cur = m.get(l.application_id) || { invite: false, reject: false };
      if (l.email_type === "interview_invite") cur.invite = true;
      if (l.email_type === "rejection") cur.reject = true;
      m.set(l.application_id, cur);
    });
    return m;
  }, [emailLog]);

  const openCompose = (type: "interview_invite" | "rejection") => {
    const t = templates[type];
    setSubject(t?.subject || (type === "interview_invite" ? "Interview invitation: {{role_title}} at {{company}}" : "Your application for {{role_title}}"));
    setBodyText(t?.body || "");
    setComposeType(type);
  };

  const sendEmails = async () => {
    if (checked.size === 0) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-candidate-email", {
        body: {
          emailType: composeType,
          applicationIds: Array.from(checked),
          bookingLink,
          subject,
          body: bodyText,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: `Sent to ${(data as any)?.sent ?? 0} candidate(s)`, description: (data as any)?.failed ? `${(data as any).failed} failed` : undefined });
      setComposeType(null);
      setChecked(new Set());
      fetchData();
    } catch (err: any) {
      toast({ title: "Could not send", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const sendTest = async () => {
    if (!testEmail.trim()) { toast({ title: "Enter a test email address" }); return; }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-candidate-email", {
        body: {
          emailType: composeType,
          applicationIds: Array.from(checked).slice(0, 1),
          bookingLink,
          subject,
          body: bodyText,
          testEmail: testEmail.trim(),
          roleTitle: opp?.title,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: `Test sent to ${testEmail.trim()}` });
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    }
    setTesting(false);
  };




  const sources = useMemo(() => {
    const s = new Set<string>();
    apps.forEach((a) => s.add(sourceOf(a)));
    return Array.from(s).sort();
  }, [apps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = apps.filter((a) => {
      if (statusFilter !== "all" && a.stage !== statusFilter) return false;
      if (sourceFilter !== "all" && sourceOf(a) !== sourceFilter) return false;
      if (q) {
        const hay = `${a.full_name} ${a.email} ${a.phone || ""} ${a.current_position || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "created_asc": return +new Date(a.created_at) - +new Date(b.created_at);
        case "name_asc": return a.full_name.localeCompare(b.full_name);
        case "exp_desc": return (b.years_experience ?? -1) - (a.years_experience ?? -1);
        case "exp_asc": return (a.years_experience ?? Infinity) - (b.years_experience ?? Infinity);
        default: return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
    return list;
  }, [apps, search, statusFilter, sourceFilter, sortBy]);

  const signedDocUrl = async (path: string) => {
    // path stored as 'matchmakers/...' (bucket-relative). The tab has to open
    // inside the click, before the signed URL round trip, or it is blocked.
    const ok = await openDocumentTab(path);
    if (!ok) toast({ title: "Could not open document", variant: "destructive" });
  };


  const updateStage = async (appId: string, stage: string) => {
    const { error } = await (adminDb() as any).rpc("mu_set_application_stage", { _application_id: appId, _stage: stage, _note: null });
    if (error) {
      toast({ title: "Stage not changed", description: error.message, variant: "destructive" });
      return;
    }
    setApps((p) => p.map((a) => (a.id === appId ? { ...a, stage } : a)));
    if (selected?.id === appId) setSelected({ ...selected, stage });
  };

  const updateNotes = async (appId: string, notes: string) => {
    await adminDb().from("matchmaker_applications").update({ admin_notes: notes }).eq("id", appId);
    setApps((p) => p.map((a) => (a.id === appId ? { ...a, admin_notes: notes } : a)));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      {!embedded && (
        <div className="mb-6">
          <MuPageHeader
            title="Applications"
            description={opp?.title}
            backTo={`/admin/match-universe/opportunities/${id}`}
            backLabel="Back to opportunity"
            actions={<ExportDropdown data={filtered} filename={`matchmaker-${opp?.slug || "applications"}`} />}
          />
        </div>
      )}


      {apps.length === 0 ? (
        <div className="border border-line bg-card">
          <MuEmpty
            art={art.objEnvelope}
            title="No applications yet"
            description="Applications arrive here once people apply through the share link."
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name, email, role…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {APPLICATION_STAGES.map((k) => <SelectItem key={k} value={k}>{STAGE_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[190px]"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Newest first</SelectItem>
                <SelectItem value="created_asc">Oldest first</SelectItem>
                <SelectItem value="name_asc">Name A to Z</SelectItem>
                <SelectItem value="exp_desc">Most experience</SelectItem>
                <SelectItem value="exp_asc">Least experience</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {apps.length}</span>
            {embedded && (
              <ExportDropdown data={filtered} filename={`matchmaker-${opp?.slug || "applications"}`} />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={() => setChecked(new Set(filtered.filter((a) => STAGE_IN_PROGRESS.includes(a.stage)).map((a) => a.id)))}>
              Select everyone in progress
            </Button>
            <Button size="sm" variant="outline" onClick={() => openCompose("interview_invite")}>
              <Mail className="mr-2 h-4 w-4" />Test invite email
            </Button>
            <Button size="sm" variant="outline" onClick={() => openCompose("rejection")}>
              <MailX className="mr-2 h-4 w-4" />Test rejection email
            </Button>


            {checked.size > 0 && (
              <>
                <Button size="sm" onClick={() => openCompose("interview_invite")}>
                  <Mail className="mr-2 h-4 w-4" />Invite to interview ({checked.size})
                </Button>
                <Button size="sm" variant="outline" onClick={() => openCompose("rejection")}>
                  <MailX className="mr-2 h-4 w-4" />Send rejection ({checked.size})
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>Clear</Button>
              </>
            )}
          </div>

          <div className="hidden md:block border border-line overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((a) => checked.has(a.id))}
                      onCheckedChange={(v) => setChecked(v ? new Set(filtered.map((a) => a.id)) : new Set())}
                    />
                  </TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Emailed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="p-0"><MuEmpty art={art.objMagnifier} title="No applications match" description="Try fewer filters or a different search." /></TableCell></TableRow>
                ) : filtered.map((a) => {
                  const src = sourceOf(a);
                  const mail = sentMap.get(a.id);
                  return (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(a)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={checked.has(a.id)}
                        onCheckedChange={(v) => setChecked((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(a.id); else next.delete(a.id);
                          return next;
                        })}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{a.full_name}<p className="text-xs text-muted-foreground">{a.current_position || "No role stated"}</p></TableCell>
                    <TableCell className="text-sm">{a.email}<p className="text-xs text-muted-foreground">{a.phone || "No phone"}</p></TableCell>
                    <TableCell className="text-sm">{a.years_experience != null ? `${a.years_experience} yrs` : "Not stated"}</TableCell>
                    <TableCell className="text-sm">
                      <span className="capitalize">{src}</span>
                      {a.utm_campaign && <p className="text-xs text-muted-foreground">{a.utm_campaign}</p>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(a.created_at), "d MMM yyyy")}</TableCell>
                    <TableCell className="text-xs">
                      {mail?.invite && <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 className="h-3.5 w-3.5" />Invited</span>}
                      {mail?.reject && <span className="inline-flex items-center gap-1 text-muted-foreground">{mail?.invite && <br />}<MailX className="h-3.5 w-3.5" />Rejected</span>}
                      {!mail && <span className="text-muted-foreground">Not yet</span>}
                    </TableCell>
                    <TableCell><MuStatus tone={stageTone(a.stage)} label={STAGE_LABEL[a.stage] ?? a.stage} /></TableCell>

                  </TableRow>
                  );
              })}
            </TableBody>
          </Table>
        </div>

        <ConsoleMobileList
            emptyLabel="No applications match these filters."
            rows={filtered.map((a): ConsoleMobileRow => {
              const src = sourceOf(a);
              const mail = sentMap.get(a.id);
              return {
                key: a.id,
                title: a.full_name,
                state: (
                  <span className="flex flex-wrap gap-x-3">
                    {[a.current_position || "No role stated", `Applied ${format(new Date(a.created_at), "d MMM yyyy")}`, `Via ${src}`, mail?.invite ? "Invited" : mail?.reject ? "Rejected" : null]
                      .filter(Boolean)
                      .map((part, i) => <span key={i}>{part}</span>)}
                  </span>
                ),
                status: <MuStatus tone={stageTone(a.stage)} label={STAGE_LABEL[a.stage] ?? a.stage} />,
                onOpen: () => setSelected(a),
              };
            })}
          />
        </>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.full_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-muted-foreground text-xs">Email</p><p>{selected.email}</p></div>
                  <div><p className="text-muted-foreground text-xs">Phone</p><p>{selected.phone || "Not provided"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Current role</p><p>{selected.current_position || "Not provided"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Experience</p><p>{selected.years_experience != null ? `${selected.years_experience} years` : "Not provided"}</p></div>
                </div>
                {(selected.utm_source || selected.utm_campaign || selected.referrer) && (
                  <div className="border border-line p-3 bg-muted/30">
                    <p className="text-muted-foreground text-xs mb-2 font-medium">Attribution</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selected.utm_source && <div><span className="text-muted-foreground">Source:</span> {selected.utm_source}</div>}
                      {selected.utm_medium && <div><span className="text-muted-foreground">Medium:</span> {selected.utm_medium}</div>}
                      {selected.utm_campaign && <div><span className="text-muted-foreground">Campaign:</span> {selected.utm_campaign}</div>}
                      {selected.utm_content && <div><span className="text-muted-foreground">Content:</span> {selected.utm_content}</div>}
                      {selected.utm_term && <div><span className="text-muted-foreground">Term:</span> {selected.utm_term}</div>}
                      {selected.landing_path && <div className="col-span-2 truncate"><span className="text-muted-foreground">Landing:</span> {selected.landing_path}</div>}
                      {selected.referrer && <div className="col-span-2 truncate"><span className="text-muted-foreground">Referrer:</span> {selected.referrer}</div>}
                    </div>
                  </div>
                )}
                {selected.cover_note && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Cover note</p>
                    <p className="whitespace-pre-wrap bg-muted/40 p-3">{selected.cover_note}</p>
                  </div>
                )}
                {(Object.keys(selected.question_answers || {}).length > 0 || Object.keys(selected.requirement_answers || {}).length > 0) && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Question answers</p>
                    <div className="space-y-2">
                      {Object.entries({ ...(selected.requirement_answers || {}), ...(selected.question_answers || {}) }).filter(([k]) => !k.startsWith("_")).map(([k, v]) => {
                        const isFile = v && typeof v === "object" && (v as any).type === "file";
                        const path = isFile ? (v as any).path : null;
                        const display = Array.isArray(v) ? v.join(", ") : isFile ? null : String(v);
                        return (
                          <div key={k} className="bg-muted/40 p-3">
                            <p className="text-xs font-medium">{k}</p>
                            {isFile ? (
                              <button onClick={() => signedDocUrl(path)} className="text-sm underline inline-flex items-center gap-1 mt-1">
                                <FileText className="h-3.5 w-3.5" />Open uploaded file
                              </button>
                            ) : (
                              <p className="whitespace-pre-wrap">{display}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {Object.keys(selected.documents || {}).length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Documents</p>
                    <div className="space-y-1">
                      {Object.entries(selected.documents).map(([label, path]) => (
                        <button
                          key={label}
                          onClick={() => signedDocUrl(String(path))}
                          className="flex items-center gap-2 text-sm hover:underline w-full text-left"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{label}</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Stage</p>
                  <Select value={selected.stage} onValueChange={(v) => updateStage(selected.id, v)}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {APPLICATION_STAGES.filter((k) => k !== "withdrawn" || selected.stage === "withdrawn").map((k) => (
                        <SelectItem key={k} value={k}>{STAGE_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Admin notes</p>
                  <Textarea
                    rows={3}
                    defaultValue={selected.admin_notes || ""}
                    onBlur={(e) => updateNotes(selected.id, e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!composeType} onOpenChange={(o) => !o && setComposeType(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {composeType === "interview_invite" ? "Invite to interview" : "Send rejection"}
            </DialogTitle>
            <DialogDescription>
              Sending to {checked.size} candidate{checked.size === 1 ? "" : "s"}. Tokens: {"{{first_name}}"}, {"{{candidate_name}}"}, {"{{role_title}}"}, {"{{company}}"}
              {composeType === "interview_invite" ? ", {{booking_link}}" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {composeType === "interview_invite" && (
              <div>
                <Label className="text-xs">Booking link (https)</Label>
                <Input value={bookingLink} onChange={(e) => setBookingLink(e.target.value)} placeholder="https://calendly.com/..." />
              </div>
            )}
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Message</Label>
              <Textarea rows={14} value={bodyText} onChange={(e) => setBodyText(e.target.value)} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground mt-1">Markdown supported. Use [[cta:Label|url]] for a button.</p>
            </div>
            <div className="border-t pt-4">
              <Label className="text-xs">Send a test to yourself</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@medicconnect.co"
                />
                <Button
                  variant="outline"
                  onClick={sendTest}
                  disabled={testing || (composeType === "interview_invite" && !bookingLink.startsWith("https://"))}
                >
                  {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send test
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Uses the first selected candidate's details when available, otherwise sample data. Not logged and never sent to candidates.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setComposeType(null)}>Cancel</Button>
            <Button onClick={sendEmails} disabled={sending || checked.size === 0 || (composeType === "interview_invite" && !bookingLink.startsWith("https://"))}>
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send to {checked.size}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </div>

  );
};

export default MatchmakerApplications;
