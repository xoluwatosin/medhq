import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useClearListParams, useListParam, useRestoreListParams } from "@/hooks/useListParam";
import { FilterChips, type ActiveFilter } from "@/components/admin/FilterChips";
import { humaniseTerm } from "@/lib/readable";

import { Loader2, Search, Users, GitMerge, MoreHorizontal, ShieldCheck, FileText, BriefcaseBusiness, Inbox, Send, Sparkles, UserRound, ClipboardList, Moon, UserX } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExportDropdown from "@/components/admin/ExportDropdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { art } from "@/components/mc/art";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import {
  Person,
  DOC_TYPES,
  DOC_TYPE_LABELS,
  DocType,
  VERIFICATION_LABELS,
  docTypeOf,
  initialsOf,
  sourceOf,
} from "@/lib/match-universe";
import { resolveProfession, PROFESSIONS } from "@/lib/professions";
import { TRACK_TAGS, trackRules, trackKnown } from "@/lib/tracks";
import { facetLabel } from "@/lib/match-taxonomy";
import { CARE_TYPES, CARE_TYPE_LABEL, LOOKING_OPTIONS } from "@/lib/work-preferences";
import { MuEmpty, MuPage, MuPageHeader, MuSection, MuStats, MuStatus, MuToolbar } from "@/components/admin/mu/MuShell";
import ConsoleMobileList, { ConsoleMobileRow } from "@/components/admin/console/ConsoleMobileList";
import ConsoleTabs from "@/components/admin/console/ConsoleTabs";
import { LgaSelect } from "@/components/LocationSelect";
import { NIGERIA_STATES } from "@/lib/nigeria-locations";
import { freshnessLabel, isFresh as isAvailabilityFresh } from "@/lib/availability";
import { selectAll } from "@/lib/select-all";

// Governed rule: a record with no meaningful activity in this many days is
// dormant. Falls back to when the record was created if it has never had any
// activity recorded at all. This threshold is the single source of truth for
// "dormant" anywhere on this page. Do not invent a separate engagement score.
const DORMANT_DAYS = 90;

// looking_status only ever holds one of these four codes (see
// src/lib/work-preferences.ts). "paused" and "placed" are the two states that
// mean the person is not to be put forward right now; the data does not
// distinguish "temporarily unavailable" from "on assignment elsewhere" beyond
// that, so both are labelled honestly rather than folded into one guess.
const NOT_LOOKING_CODES = ["paused", "placed"];

const daysSince = (iso: string | null | undefined) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity;


interface Submission {
  person_id: string | null;
  id: string;
  kind: "matchmaker" | "join";
  appliedFor: string | null;
  ownRole: string | null;
  created_at: string;
  source: string;
}

interface Row {
  person: Person;
  applications: number;
  docTypes: DocType[];
  docs: number;
  verifiedDocs: number;
  profession: string | null;
  specialties: string[];
  careTypes: string[];
  liveIn: string | null;
  sources: string[];
  referees: number;
  latestAt: string;
}

const MatchUniverse = () => {
  const { toast } = useToast();
  // Filters live in the address bar and the list remembers the last set used.
  useRestoreListParams();
  const clearParams = useClearListParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const { search: filterSearch } = useLocation();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [inviting, setInviting] = useState(false);
  const [pendingMerges, setPendingMerges] = useState(0);
  const [pendingClaims, setPendingClaims] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);


  const [search, setSearch] = useListParam<string>("q", "");
  const [sourceFilter, setSourceFilter] = useListParam<string>("channel", "all");
  const [docFilter, setDocFilter] = useListParam<string>("docs", "all");
  const [verifyFilter, setVerifyFilter] = useListParam<string>("verified", "all");
  const [specialtyFilter, setSpecialtyFilter] = useListParam<string>("specialty", "all");
  const [careFilter, setCareFilter] = useListParam<string>("care", "all");
  const [trackFilter, setTrackFilter] = useListParam<string>("route", "all");
  const [liveInFilter, setLiveInFilter] = useListParam<string>("livein", "all");
  // Referees the candidate has given us. A separate question from whether we
  // hold a written reference letter, so it gets its own filter.
  const [refFilter, setRefFilter] = useListParam<string>("referees", "all");
  const [tidying, setTidying] = useState(false);
  const [sortBy, setSortBy] = useListParam<"recent" | "docs_desc" | "name_asc" | "exp_desc">("sort", "recent");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // Account state: who can actually sign in, and who we have asked but not heard from.
  const [accountFilter, setAccountFilter] = useListParam<string>("account", "all");
  // Talent is a lifecycle state, not a UI convenience. People currently on the
  // Workforce belong in Workforce, so the default pool leaves them out. Their
  // record and history are untouched and still reachable here under "Everyone".
  const [lifecycleFilter, setLifecycleFilter] = useListParam<"talent" | "workforce" | "all">("lifecycle", "talent");
  // Optional role to invite against, so the email leads with the job.
  const [blastOpp, setBlastOpp] = useState("none");
  const [openRoles, setOpenRoles] = useState<{ id: string; title: string }[]>([]);

  // The primary register view. Active talent is the working default; the rest
  // surface a specific operational job (chase readiness, re-engage, invite,
  // stand down).
  const [rawView, setView] = useListParam<"active" | "needs_completion" | "dormant" | "unclaimed" | "unavailable" | "all">("view", "active");
  const view = rawView === "dormant" ? "all" : rawView;
  // Placement readiness, read from mu_readiness_summary, never recomputed here.
  const [readiness, setReadiness] = useState<Map<string, { candidate: number; office: number }>>(new Map());
  const [readinessFilter, setReadinessFilter] = useListParam<"all" | "ready" | "office" | "candidate" | "any">("readiness", "all");
  const [professionFilter, setProfessionFilter] = useListParam<string>("profession", "all");
  const [stateFilter, setStateFilter] = useListParam<string>("state", "all");
  const [lgaFilter, setLgaFilter] = useListParam<string>("lga", "");
  const [minExpFilter, setMinExpFilter] = useListParam<string>("minyears", "");
  const [engagementFilter, setEngagementFilter] = useListParam<"all" | "recent" | "dormant">("engagement", "all");
  const [freshnessFilter, setFreshnessFilter] = useListParam<"all" | "current" | "stale" | "never">("availability", "all");
  const [lookingFilter, setLookingFilter] = useListParam<string>("looking", "all");

  const load = async () => {
    // Each list is read whole, a page at a time: a plain select stops at
    // 1,000 rows, and documents alone are close to that.
    const all = (q: () => any, key = "id") =>
      selectAll<any>((a, z) => q().order(key).range(a, z)).then((data) => ({ data }));
    const [{ data: people }, { data: mm }, { data: jn }, { data: docs }, { count: merges }, { count: claims }, { data: facetRows }, { data: prefRows }, { data: refRows }, { data: readinessRows }] = await Promise.all([
      all(() => adminDb().from("mu_people").select("*").order("last_activity_at", { ascending: false })),
      all(() => adminDb()
        .from("matchmaker_applications")
        .select("id, person_id, created_at, current_position, utm_source, referrer")
        .order("created_at", { ascending: false })),
      all(() => adminDb()
        .from("join_applications")
        .select("id, person_id, created_at, role, role_other, qualification, utm_source, referrer")
        .order("created_at", { ascending: false })),
      all(() => adminDb().from("mu_documents").select("id, person_id, label, url, verified")),
      adminDb().from("mu_merge_candidates").select("id", { count: "exact", head: true }).eq("status", "pending"),
      adminDb().from("mu_parsed_fields").select("id", { count: "exact", head: true }).eq("status", "pending"),
      // What each person is actually good at, and what work they will take on.
      // Both are filters the office asks for by name, so they load with the roster.
      all(() => adminDb().from("mu_profile_facets").select("id, person_id, facet_type, code").eq("facet_type", "specialty")),
      all(() => adminDb().from("mu_work_preferences").select("person_id, care_types, live_in"), "person_id"),
      all(() => adminDb().from("mu_references").select("id, person_id")),
      // Placement readiness is decided entirely by the database rule set: this
      // page only reads the totals and never re-implements the logic.
      (adminDb() as any).rpc("mu_readiness_summary"),
    ]);

    const readinessMap = new Map<string, { candidate: number; office: number }>();
    ((readinessRows || []) as any[]).forEach((r) => {
      readinessMap.set(r.person_id, { candidate: r.candidate_items ?? 0, office: r.office_items ?? 0 });
    });
    setReadiness(readinessMap);

    const specialtyByPerson = new Map<string, string[]>();
    ((facetRows || []) as any[]).forEach((f) => {
      const list = specialtyByPerson.get(f.person_id) || [];
      if (!list.includes(f.code)) list.push(f.code);
      specialtyByPerson.set(f.person_id, list);
    });
    const prefByPerson = new Map<string, { care_types: string[]; live_in: string | null }>();
    ((prefRows || []) as any[]).forEach((w) => {
      prefByPerson.set(w.person_id, { care_types: w.care_types || [], live_in: w.live_in ?? null });
    });

    const refByPerson = new Map<string, number>();
    ((refRows || []) as any[]).forEach((r) => {
      refByPerson.set(r.person_id, (refByPerson.get(r.person_id) || 0) + 1);
    });

    const subs: Submission[] = [
      ...((mm || []) as any[]).map((a) => ({
        person_id: a.person_id,
        id: a.id,
        kind: "matchmaker" as const,
        appliedFor: null,
        ownRole: a.current_position ?? null,
        created_at: a.created_at,
        source: sourceOf(a),
      })),
      ...((jn || []) as any[]).map((a) => ({
        person_id: a.person_id,
        id: a.id,
        kind: "join" as const,
        appliedFor: null,
        ownRole: (a.role === "other" ? a.role_other : a.role) ?? a.qualification ?? null,
        created_at: a.created_at,
        source: sourceOf(a),
      })),
    ];

    const byPerson = new Map<string, Submission[]>();
    subs.forEach((s) => {
      if (!s.person_id) return;
      const list = byPerson.get(s.person_id) || [];
      list.push(s);
      byPerson.set(s.person_id, list);
    });

    const docStats = new Map<string, { total: number; verified: number; types: Set<DocType> }>();
    ((docs || []) as any[]).forEach((d) => {
      const cur = docStats.get(d.person_id) || { total: 0, verified: 0, types: new Set<DocType>() };
      cur.total += 1;
      if (d.verified) cur.verified += 1;
      cur.types.add(docTypeOf(d.label || "", d.url || ""));
      docStats.set(d.person_id, cur);
    });

    const built: Row[] = ((people || []) as Person[]).map((p) => {
      const list = (byPerson.get(p.id) || []).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const stats = docStats.get(p.id) || { total: 0, verified: 0, types: new Set<DocType>() };
      return {
        person: p,
        applications: list.length,
        docs: stats.total,
        verifiedDocs: stats.verified,
        docTypes: Array.from(stats.types),
        profession: resolveProfession({
          adminSet: (p as any).profession,
          stated: p.current_position || list.find((s) => s.ownRole)?.ownRole || null,
        }).profession,
        specialties: specialtyByPerson.get(p.id) || [],
        careTypes: prefByPerson.get(p.id)?.care_types || [],
        liveIn: prefByPerson.get(p.id)?.live_in ?? null,
        sources: Array.from(new Set(list.map((s) => s.source))),
        referees: refByPerson.get(p.id) || 0,
        latestAt: list[0]?.created_at ?? p.created_at,
      };
    });

    setRows(built);
    setPendingMerges(merges ?? 0);
    setPendingClaims(claims ?? 0);

    // Documents waiting on a decision, so the candidate pool page shows work has arrived.
    const { data: waiting } = await (adminDb() as any).rpc("mu_review_queue_count");
    setPendingReviews(typeof waiting === "number" ? waiting : 0);
    setLoading(false);

  };

  useEffect(() => {
    adminDb()
      .from("matchmaker_opportunities")
      .select("id, title")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .then(({ data }: any) => setOpenRoles((data as any[])?.map((o) => ({ id: o.id, title: o.title })) ?? []));
  }, []);

  useEffect(() => {
    load();
    // Any CV waiting to be read gets read in the background. Nobody has to ask.
    supabase.functions
      .invoke("parse-cv", { body: { limit: 10 } })
      .then((res: any) => {
        if (res?.data?.results?.length) load();
      })
      .catch(() => null);
  }, []);

  // Only offer specialties that somebody in the pool actually holds, so a filter
  // never returns nobody by definition.
  const allSpecialties = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.specialties))).sort(),
    [rows],
  );

  const allSources = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.sources))).sort(),
    [rows],
  );

  // A record is actionable once we have done, or can do, something with it:
  // we hold an account claim, we have invited them, or they have shown up
  // somewhere (an application, a document, a referee). A blank shell with none
  // of that is not yet "talent" in any operational sense.
  const isActionable = (r: Row) =>
    Boolean(r.person.claimed_at) || Boolean(r.person.invited_at) || r.applications > 0 || r.docs > 0 || r.referees > 0;

  const isDormant = (r: Row) => daysSince(r.person.last_activity_at || r.person.created_at) >= DORMANT_DAYS;
  const isNotLooking = (r: Row) => NOT_LOOKING_CODES.includes((r.person as any).looking_status);
  const readinessOf = (r: Row) => readiness.get(r.person.id) ?? { candidate: 0, office: 0 };
  const needsCompletion = (r: Row) => {
    const it = readinessOf(r);
    return it.candidate > 0 || it.office > 0;
  };
  const isExited = (r: Row) => (r.person as any).staff_status === "exited";
  const isUnclaimed = (r: Row) => !r.person.invited_at || (Boolean(r.person.invited_at) && !r.person.claimed_at);

  const matchesView = (r: Row, v: typeof rawView) => {
    const p = r.person;
    switch (v) {
      case "active":
        return (
          ((p as any).lifecycle_state ?? "talent") === "talent" &&
          !isExited(r) &&
          !isNotLooking(r) &&
          isActionable(r)
        );
      case "needs_completion":
        return needsCompletion(r);
      case "dormant":
        return isDormant(r);
      case "unclaimed":
        return isUnclaimed(r);
      case "unavailable":
        return isNotLooking(r);
      case "all":
      default:
        return true;
    }
  };

  // Counts respect the lifecycle filter (Talent / Workforce / Everyone), same
  // as the "All" view does, so the tab row and the table never disagree.
  const afterLifecycle = useMemo(
    () => rows.filter((r) => lifecycleFilter === "all" || ((r.person as any).lifecycle_state ?? "talent") === lifecycleFilter),
    [rows, lifecycleFilter],
  );

  const viewCounts = useMemo(
    () => ({
      active: afterLifecycle.filter((r) => matchesView(r, "active")).length,
      needs_completion: afterLifecycle.filter((r) => matchesView(r, "needs_completion")).length,
      dormant: afterLifecycle.filter((r) => matchesView(r, "dormant")).length,
      unclaimed: afterLifecycle.filter((r) => matchesView(r, "unclaimed")).length,
      unavailable: afterLifecycle.filter((r) => matchesView(r, "unavailable")).length,
      all: afterLifecycle.length,
    }),
    [afterLifecycle, readiness],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minExp = minExpFilter.trim() ? Number(minExpFilter) : null;
    let out = afterLifecycle.filter((r) => {
      const p = r.person;
      if (!matchesView(r, view)) return false;
      if (q) {
        const hay = `${p.full_name} ${p.email ?? ""} ${p.phone ?? ""} ${r.profession ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sourceFilter !== "all" && !r.sources.includes(sourceFilter)) return false;
      if (verifyFilter !== "all" && p.verification_state !== verifyFilter) return false;
      if (accountFilter !== "all") {
        const claimed = Boolean(p.claimed_at);
        const invited = Boolean(p.invited_at);
        if (accountFilter === "claimed" && !claimed) return false;
        if (accountFilter === "invited" && (claimed || !invited)) return false;
        if (accountFilter === "never" && (claimed || invited)) return false;
      }
      if (specialtyFilter !== "all" && !r.specialties.includes(specialtyFilter)) return false;
      if (trackFilter !== "all") {
        const t = (p as any).track ?? "";
        if (trackFilter === "unknown" ? trackKnown(t) : t !== trackFilter) return false;
      }
      if (careFilter !== "all" && !r.careTypes.includes(careFilter)) return false;
      if (liveInFilter !== "all") {
        // "Either suits me" answers count for both live-in and live-out searches.
        const li = r.liveIn;
        if (liveInFilter === "unknown" ? li && li !== "unknown" : !(li === liveInFilter || li === "either")) return false;
      }
      if (refFilter === "any" && r.referees === 0) return false;
      if (refFilter === "none" && r.referees > 0) return false;
      if (refFilter === "two" && r.referees < 2) return false;
      if (docFilter === "none" && r.docs > 0) return false;
      if (docFilter === "any" && r.docs === 0) return false;
      if (DOC_TYPES.includes(docFilter as DocType) && !r.docTypes.includes(docFilter as DocType)) return false;
      if (professionFilter !== "all" && r.profession !== professionFilter) return false;
      if (stateFilter !== "all" && (p.state || "") !== stateFilter) return false;
      if (lgaFilter && (p.lga || "") !== lgaFilter) return false;
      if (minExp !== null && !Number.isNaN(minExp) && (p.years_experience ?? -1) < minExp) return false;
      if (engagementFilter === "recent" && isDormant(r)) return false;
      if (engagementFilter === "dormant" && !isDormant(r)) return false;
      if (freshnessFilter !== "all") {
        const last = p.last_availability_update;
        const state = !last ? "never" : isAvailabilityFresh(last) ? "current" : "stale";
        if (state !== freshnessFilter) return false;
      }
      if (lookingFilter !== "all" && (p as any).looking_status !== lookingFilter) return false;
      if (readinessFilter !== "all") {
        const it = readinessOf(r);
        if (readinessFilter === "ready" && (it.candidate > 0 || it.office > 0)) return false;
        if (readinessFilter === "office" && it.office === 0) return false;
        if (readinessFilter === "candidate" && it.candidate === 0) return false;
        if (readinessFilter === "any" && it.candidate === 0 && it.office === 0) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sortBy === "recent") return b.latestAt.localeCompare(a.latestAt);
      if (sortBy === "docs_desc") return b.docs - a.docs;
      if (sortBy === "name_asc") return a.person.full_name.localeCompare(b.person.full_name);
      return (b.person.years_experience ?? -1) - (a.person.years_experience ?? -1);
    });
    return out;
  }, [
    afterLifecycle, search, sourceFilter, docFilter, verifyFilter, sortBy, accountFilter,
    specialtyFilter, careFilter, liveInFilter, trackFilter, refFilter, view, readiness,
    professionFilter, stateFilter, lgaFilter, minExpFilter, engagementFilter, freshnessFilter,
    lookingFilter, readinessFilter,
  ]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allShown = filtered.length > 0 && filtered.every((r) => checked.has(r.person.id));
  const toggleAll = () => {
    setChecked(allShown ? new Set() : new Set(filtered.map((r) => r.person.id)));
  };

  const copyEmails = async () => {
    const list = filtered
      .filter((r) => checked.has(r.person.id) && r.person.email)
      .map((r) => r.person.email)
      .join(", ");
    if (!list) {
      toast({ title: "No email addresses in your selection", variant: "destructive" });
      return;
    }
    await navigator.clipboard.writeText(list);
    toast({ title: `Copied ${checked.size} email addresses` });
  };

  // Inviting people one at a time is why most of the candidate pool never claims a
  // profile. Anyone already invited is skipped unless they are picked again
  // deliberately, and the send is sequential so we never flood the mailer.
  const inviteSelected = async () => {
    const targets = filtered.filter((r) => checked.has(r.person.id) && r.person.email);
    if (!targets.length) {
      toast({ title: "No email addresses in your selection", variant: "destructive" });
      return;
    }
    setInviting(true);
    let sent = 0;
    let failed = 0;
    for (const r of targets) {
      const { error } = await supabase.functions.invoke("invite-candidate", {
        body: { person_id: r.person.id, opportunity_id: blastOpp === "none" ? undefined : blastOpp },
      });
      if (error) failed += 1;
      else sent += 1;
    }
    setInviting(false);
    toast({
      title: `${sent} invited`,
      description: failed
        ? `${failed} could not be sent. Check those profiles.`
        : blastOpp === "none"
          ? "Each person has a personalised link to their account."
          : "Each person has a personalised link that opens the role and their application.",
      variant: failed ? "destructive" : undefined,
    });
    load();
  };

  // One pass over the whole pool: repeated wording in names, documents sitting
  // in Other that the file name already explains, and repeat uploads folded
  // into history. Counted first, then applied on confirmation.
  const tidyDocuments = async () => {
    setTidying(true);
    const { data, error } = await (adminDb() as any).rpc("mu_tidy_documents", { _apply: false });
    if (error) {
      setTidying(false);
      toast({ title: "Could not read the documents", description: error.message, variant: "destructive" });
      return;
    }
    const found = (data?.labels ?? 0) + (data?.kinds ?? 0) + (data?.repeats ?? 0);
    if (found === 0) {
      setTidying(false);
      toast({ title: "Nothing to tidy", description: "Every document is named and filed correctly." });
      return;
    }
    const ok = window.confirm(
      `Found ${data.labels} names to clean up, ${data.kinds} documents to refile out of Other and ${data.repeats} repeat uploads to fold into history. Apply this?`,
    );
    if (!ok) {
      setTidying(false);
      return;
    }
    const { error: applyError } = await (adminDb() as any).rpc("mu_tidy_documents", { _apply: true });
    setTidying(false);
    if (applyError) {
      toast({ title: "The tidy-up did not finish", description: applyError.message, variant: "destructive" });
      return;
    }
    toast({ title: "Documents tidied", description: "Names cleaned, kinds refiled and repeats moved to history." });
    load();
  };

  const exportRows = filtered.map((r) => ({
    Name: r.person.full_name,
    Email: r.person.email ?? "",
    Phone: r.person.phone ?? "",
    Route: trackKnown((r.person as any).track) ? trackRules((r.person as any).track).label : "Not confirmed",
    Profession: r.profession ?? "",
    "Years of experience": r.person.years_experience ?? "",
    Location: r.person.state ?? "",
    Documents: r.docs,
    "Document types": r.docTypes.join(" | "),
    Referees: r.referees,
    Specialties: r.specialties.map(facetLabel).join(" | "),
    "Types of care accepted": r.careTypes.map((c) => CARE_TYPE_LABEL[c] ?? c).join(" | "),
    Verification: VERIFICATION_LABELS[r.person.verification_state] ?? r.person.verification_state,
    Channels: r.sources.join(" | "),
    "Last activity": r.latestAt,
  }));

  // Rows hidden by a filter must never stay selected and get acted on.
  useEffect(() => { setChecked(new Set()); }, [filterSearch]);

  // One chip per filter that is narrowing the list.
  const activeFilters: ActiveFilter[] = [
    { key: "q", on: search !== "", label: `Search: ${search}`, clear: () => setSearch("") },
    { key: "lifecycle", on: lifecycleFilter !== "talent", label: lifecycleFilter === "all" ? "Everyone, including Workforce" : "On the Workforce", clear: () => setLifecycleFilter("talent") },
    { key: "profession", on: professionFilter !== "all", label: professionFilter, clear: () => setProfessionFilter("all") },
    { key: "specialty", on: specialtyFilter !== "all", label: `Specialty: ${specialtyFilter}`, clear: () => setSpecialtyFilter("all") },
    { key: "route", on: trackFilter !== "all", label: `Route: ${TRACK_TAGS.find((t) => t.id === trackFilter)?.label ?? humaniseTerm(trackFilter)}`, clear: () => setTrackFilter("all") },
    { key: "care", on: careFilter !== "all", label: `Care: ${CARE_TYPE_LABEL[careFilter as keyof typeof CARE_TYPE_LABEL] ?? humaniseTerm(careFilter)}`, clear: () => setCareFilter("all") },
    { key: "livein", on: liveInFilter !== "all", label: `Live-in: ${humaniseTerm(liveInFilter)}`, clear: () => setLiveInFilter("all") },
    { key: "state", on: stateFilter !== "all", label: stateFilter, clear: () => { setStateFilter("all"); setLgaFilter(""); } },
    { key: "lga", on: lgaFilter !== "", label: lgaFilter, clear: () => setLgaFilter("") },
    { key: "minyears", on: minExpFilter !== "", label: `${minExpFilter}+ years`, clear: () => setMinExpFilter("") },
    { key: "engagement", on: engagementFilter !== "all", label: engagementFilter === "recent" ? "Active in the last 90 days" : "Quiet for 90 days", clear: () => setEngagementFilter("all") },
    { key: "availability", on: freshnessFilter !== "all", label: `Availability: ${humaniseTerm(freshnessFilter)}`, clear: () => setFreshnessFilter("all") },
    { key: "looking", on: lookingFilter !== "all", label: LOOKING_OPTIONS.find((o) => o.code === lookingFilter)?.label ?? humaniseTerm(lookingFilter), clear: () => setLookingFilter("all") },
    { key: "readiness", on: readinessFilter !== "all", label: `Readiness: ${humaniseTerm(readinessFilter)}`, clear: () => setReadinessFilter("all") },
    { key: "docs", on: docFilter !== "all", label: `Documents: ${humaniseTerm(docFilter)}`, clear: () => setDocFilter("all") },
    { key: "referees", on: refFilter !== "all", label: `Referees: ${humaniseTerm(refFilter)}`, clear: () => setRefFilter("all") },
    { key: "verified", on: verifyFilter !== "all", label: humaniseTerm(verifyFilter), clear: () => setVerifyFilter("all") },
    { key: "channel", on: sourceFilter !== "all", label: `Channel: ${humaniseTerm(sourceFilter)}`, clear: () => setSourceFilter("all") },
    { key: "account", on: accountFilter !== "all", label: `Account: ${humaniseTerm(accountFilter)}`, clear: () => setAccountFilter("all") },
  ]
    .filter((f) => f.on)
    .map(({ key, label, clear }) => ({ key, label, onRemove: clear }));
  // Filters folded under More filters; the summary says how many are set.
  const MORE_KEYS = ["specialty", "care", "livein", "minyears", "looking", "readiness", "engagement", "availability", "docs", "referees", "verified", "account", "lifecycle", "channel"];
  const moreSet = activeFilters.filter((f) => MORE_KEYS.includes(f.key)).length;
  const clearAllFilters = () =>
    clearParams(["q", "lifecycle", "profession", "specialty", "route", "care", "livein", "state", "lga", "minyears", "engagement", "availability", "looking", "readiness", "docs", "referees", "verified", "channel", "account"]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  const totals = {
    people: rows.length,
    withDocs: rows.filter((r) => r.docs > 0).length,
    verified: rows.filter((r) => r.person.verification_state === "verified").length,
  };

  return (
    <MuPage>
      <MuPageHeader
        title="Talent pool"
        description="The talent register. One profile per person."
        actions={
          <>
            <Button variant={pendingReviews > 0 ? "default" : "outline"} size="sm" asChild>
              <Link to="/admin/match-universe/verification">
                <ShieldCheck className="mr-2 h-4 w-4" />Document review
                {pendingReviews > 0 && (
                  <span className="ml-2 bg-white/20 px-1.5 text-[12px] font-bold tabular-nums">{pendingReviews}</span>
                )}
              </Link>
            </Button>
            <ExportDropdown data={exportRows} filename="talent-pool" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="More actions">
                  <MoreHorizontal className="mr-2 h-4 w-4" />More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/admin/match-universe/merges">
                    <GitMerge className="mr-2 h-4 w-4" />Duplicates
                    {pendingMerges > 0 && (
                      <span className="ml-auto pl-3 text-[12px] font-bold tabular-nums text-muted-foreground">{pendingMerges}</span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin/match-universe/workforce">
                    <BriefcaseBusiness className="mr-2 h-4 w-4" />Workforce
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { void tidyDocuments(); }} disabled={tidying}>
                  {tidying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Tidy documents
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <MuStats
        columns={4}
        stats={[
          { label: "Talent register", value: totals.people, icon: Users },
          { label: "With documents", value: totals.withDocs, icon: FileText },
          { label: "Verified profiles", value: totals.verified, icon: ShieldCheck },
          {
            label: "Documents pending review",
            value: pendingReviews,
            icon: Inbox,
            tone: pendingReviews > 0 ? "attention" : "default",
            hint: pendingReviews > 0 ? "New uploads awaiting a decision." : "None outstanding.",
          },
        ]}
      />

      <ConsoleTabs
        label="Talent pool view"
        active={view}
        onChange={(id) => setView(id as typeof view)}
        tabs={[
          { id: "active", label: "Active talent", count: viewCounts.active },
          { id: "needs_completion", label: "Needs completion", count: viewCounts.needs_completion },
          { id: "unavailable", label: "Not looking", count: viewCounts.unavailable },
          { id: "unclaimed", label: "Not signed in", count: viewCounts.unclaimed },
          { id: "all", label: "All", count: viewCounts.all },
        ]}
      />

      {/* One filter area for every screen size: the everyday filters in a row,
          everything else folded under More filters. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone or profession"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Select value={professionFilter} onValueChange={setProfessionFilter}>
              <SelectTrigger className="w-full sm:w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Any profession</SelectItem>
                {PROFESSIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setLgaFilter(""); }}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Any state</SelectItem>
                {NIGERIA_STATES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
              </SelectContent>
            </Select>
            <LgaSelect
              state={stateFilter === "all" ? "" : stateFilter}
              value={lgaFilter}
              onChange={setLgaFilter}
              allowClear
              className="w-full sm:w-[170px]"
            />
            <Select value={trackFilter} onValueChange={setTrackFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any route</SelectItem>
                {TRACK_TAGS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                <SelectItem value="unknown">Route not confirmed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent activity</SelectItem>
                <SelectItem value="docs_desc">Most documents</SelectItem>
                <SelectItem value="name_asc">Name A to Z</SelectItem>
                <SelectItem value="exp_desc">Most experience</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <details
          className="border border-line-soft bg-card"
          open={moreOpen}
          onToggle={(e) => setMoreOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold text-navy">
            More filters
            {moreSet > 0 && <span className="bg-navy px-2 py-0.5 text-[12px] font-bold text-white">{moreSet} set</span>}
          </summary>
          <div className="grid grid-cols-1 gap-2 border-t border-line-soft p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Any specialty</SelectItem>
                {allSpecialties.map((c) => (
                  <SelectItem key={c} value={c}>{facetLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={careFilter} onValueChange={setCareFilter}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Any type of care</SelectItem>
                {CARE_TYPES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={liveInFilter} onValueChange={setLiveInFilter}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Live-in or live-out</SelectItem>
                <SelectItem value="live_in">Will live in</SelectItem>
                <SelectItem value="live_out">Will live out</SelectItem>
                <SelectItem value="unknown">Has not said</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              placeholder="Min. years experience"
              value={minExpFilter}
              onChange={(e) => setMinExpFilter(e.target.value)}
              className="w-full"
            />
            <Select value={lookingFilter} onValueChange={setLookingFilter}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any looking status</SelectItem>
                {LOOKING_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={readinessFilter} onValueChange={(v) => setReadinessFilter(v as any)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any placement readiness</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="office">Office action required</SelectItem>
                <SelectItem value="candidate">Candidate action required</SelectItem>
                <SelectItem value="any">Any blocker</SelectItem>
              </SelectContent>
            </Select>
            <Select value={engagementFilter} onValueChange={(v) => setEngagementFilter(v as any)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any engagement</SelectItem>
                <SelectItem value="recent">Active in the last 90 days</SelectItem>
                <SelectItem value="dormant">Quiet for 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={freshnessFilter} onValueChange={(v) => setFreshnessFilter(v as any)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any availability freshness</SelectItem>
                <SelectItem value="current">Availability current</SelectItem>
                <SelectItem value="stale">Availability stale</SelectItem>
                <SelectItem value="never">Never provided</SelectItem>
              </SelectContent>
            </Select>
            <Select value={docFilter} onValueChange={setDocFilter}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any documents</SelectItem>
                <SelectItem value="any">Has documents</SelectItem>
                <SelectItem value="none">No documents</SelectItem>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {`${DOC_TYPE_LABELS[t]} on file`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={refFilter} onValueChange={setRefFilter}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any referees</SelectItem>
                <SelectItem value="any">Referees given</SelectItem>
                <SelectItem value="two">Two or more referees</SelectItem>
                <SelectItem value="none">No referees yet</SelectItem>
              </SelectContent>
            </Select>
            <Select value={verifyFilter} onValueChange={setVerifyFilter}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any verification</SelectItem>
                {Object.entries(VERIFICATION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any account state</SelectItem>
                <SelectItem value="claimed">Has signed in</SelectItem>
                <SelectItem value="invited">Invited, not claimed</SelectItem>
                <SelectItem value="never">Never invited</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lifecycleFilter} onValueChange={(v) => setLifecycleFilter(v as any)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="talent">Talent</SelectItem>
                <SelectItem value="workforce">On the Workforce</SelectItem>
                <SelectItem value="all">Everyone</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {allSources.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </details>
      </div>



      <FilterChips filters={activeFilters} onClearAll={clearAllFilters} />

      <MuSection
        title={`Showing ${filtered.length} of ${rows.length} people`}
        description="Select a person to view their profile, documents and match history."
        padded={false}
        actions={
          checked.size > 0 ? (
            <>
              <span className="text-xs font-medium text-foreground">{checked.size} selected</span>
              <Select value={blastOpp} onValueChange={setBlastOpp}>
                <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Invite to their profile</SelectItem>
                  {openRoles.map((o) => (
                    <SelectItem key={o.id} value={o.id}>Lead with: {o.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={inviteSelected} disabled={inviting}>
                {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {blastOpp === "none" ? "Invite to profile" : "Send this role"}
              </Button>
              <Button variant="outline" size="sm" onClick={copyEmails}>Copy email addresses</Button>
              <Button variant="ghost" size="sm" onClick={() => setChecked(new Set())}>Clear</Button>
            </>
          ) : undefined
        }
      >
      <div className="hidden md:block overflow-x-auto">
        <Table>

          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allShown} onCheckedChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Profession</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead className="hidden lg:table-cell">Verification</TableHead>
              <TableHead className="hidden lg:table-cell">Readiness</TableHead>
              <TableHead className="hidden xl:table-cell">Looking status</TableHead>
              <TableHead className="hidden xl:table-cell">Last activity</TableHead>

            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.person.id} className="hover:bg-muted/40">
                <TableCell>
                  <Checkbox
                    checked={checked.has(r.person.id)}
                    onCheckedChange={() => toggle(r.person.id)}
                    aria-label={`Select ${r.person.full_name}`}
                  />
                </TableCell>
                <TableCell>
                  {/* The name is the way in, so it reads as a strong ink link
                      with the profession and email quiet beneath it. */}
                  <Link to={`/admin/match-universe/${r.person.id}`} className="flex items-center gap-3 group">
                    <span className="h-8 w-8 shrink-0 bg-tint text-navy text-xs font-bold flex items-center justify-center">
                      {initialsOf(r.person.full_name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-bold tracking-[-0.01em] text-foreground group-hover:underline">
                        {r.person.full_name || "Unnamed"}
                      </span>
                      <span className="block text-[13px] text-muted-foreground truncate">{r.person.email}</span>
                      <span className="mt-1 inline-block bg-tint px-1.5 py-0.5 text-[10.5px] font-semibold text-navy">
                        {trackKnown((r.person as any).track)
                          ? trackRules((r.person as any).track).tag
                          : "Route not confirmed"}
                      </span>
                    </span>
                  </Link>
                </TableCell>

                <TableCell className="hidden md:table-cell text-sm">
                  {r.profession || <span className="text-muted-foreground">Not confirmed</span>}
                </TableCell>

                <TableCell className="text-sm">
                  {[r.person.lga, r.person.state].filter(Boolean).join(", ") || "Not stated"}
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    {r.docs === 0 ? (
                      <span className="text-[13px] text-muted-foreground">No documents</span>
                    ) : (
                      r.docTypes.map((t) => (
                        <span key={t} className="bg-tint px-1.5 py-0.5 text-[10.5px] font-semibold text-navy">{t}</span>
                      ))
                    )}
                    {r.referees > 0 && (
                      <span className="inline-flex items-center gap-1 border border-border px-1.5 py-0.5 text-[10.5px] font-semibold text-navy">
                        <UserRound className="h-3 w-3" />
                        {r.referees === 1 ? "One referee" : `${r.referees} referees`}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm">
                  <MuStatus
                    tone={r.person.verification_state === "verified" ? "good" : "neutral"}
                    label={VERIFICATION_LABELS[r.person.verification_state] ?? r.person.verification_state}
                  />
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm">
                  {(() => {
                    const it = readiness.get(r.person.id) ?? { candidate: 0, office: 0 };
                    if (it.candidate === 0 && it.office === 0) return <MuStatus tone="good" label="Ready" />;
                    if (it.office > 0) return <MuStatus tone="warning" label="Office action required" />;
                    return <MuStatus tone="warning" label="Candidate action required" />;
                  })()}
                </TableCell>
                <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                  {LOOKING_OPTIONS.find((o) => o.code === (r.person as any).looking_status)?.label ?? "Not said"}
                </TableCell>
                <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                  {r.person.last_activity_at
                    ? new Date(r.person.last_activity_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "Not recorded"}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <MuEmpty
                    art={art.objMagnifier}
                    title="No people match"
                    description="Try fewer filters or a different search."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ConsoleMobileList
        emptyLabel="No people match these filters."
        emptyIcon={Users}
        rows={filtered.map((r): ConsoleMobileRow => {
          const it = readiness.get(r.person.id) ?? { candidate: 0, office: 0 };
          const readinessLabel =
            it.candidate === 0 && it.office === 0
              ? "Ready"
              : it.office > 0
                ? "Office action required"
                : "Candidate action required";
          return {
            key: r.person.id,
            title: r.person.full_name || "Unnamed",
            state: (
              <span className="flex flex-wrap gap-x-3">
                {[
                  r.profession,
                  [r.person.lga, r.person.state].filter(Boolean).join(", ") || "Not stated",
                  LOOKING_OPTIONS.find((o) => o.code === (r.person as any).looking_status)?.label ?? "Not said",
                  readinessLabel,
                ]
                  .filter(Boolean)
                  .map((part, i) => <span key={i}>{part}</span>)}
              </span>
            ),
            status: (
              <MuStatus
                tone={r.person.verification_state === "verified" ? "good" : "neutral"}
                label={VERIFICATION_LABELS[r.person.verification_state] ?? r.person.verification_state}
              />
            ),
            to: `/admin/match-universe/${r.person.id}`,
          };
        })}
      />
      </MuSection>
    </MuPage>

  );
};

export default MatchUniverse;
