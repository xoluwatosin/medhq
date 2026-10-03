// Availability.
//
// Admin picks a window and a time of day, and the candidate pool answers. Availability
// stays three-state: available, unavailable, and unknown, where unknown means
// the person has said nothing rather than no. Booked shifts and approved leave
// are taken off the top automatically.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, CalendarCheck, CalendarClock, ChevronDown, ChevronRight, Loader2, Mail, MapPin, Search, Users } from "lucide-react";
import { adminDb } from "@/lib/admin-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { MuEmpty, MuPage, MuPageHeader, MuSection, MuStats, MuToolbar } from "@/components/admin/mu/MuShell";
import ConsoleMobileList, { ConsoleMobileRow } from "@/components/admin/console/ConsoleMobileList";
import { PROFESSIONS } from "@/lib/professions";
import { STATES_AND_LGAS } from "@/lib/nigeria-locations";
import { LgaSelect } from "@/components/LocationSelect";
import { freshnessLabel } from "@/lib/availability";
import AvailabilityDetail from "@/components/admin/mu/AvailabilityDetail";

interface FreeRow {
  person_id: string;
  full_name: string;
  profession: string | null;
  state: string | null;
  lga: string | null;
  years_experience: number | null;
  verification_state: string;
  availability: "available" | "unavailable" | "unknown";
  free_days: number;
  busy_days: number;
  free_dates: string[] | null;
  last_availability_update: string | null;
}

interface StaleRow {
  person_id: string;
  full_name: string;
  email: string | null;
  profession: string | null;
  last_availability_update: string | null;
  days_since: number | null;
  claimed: boolean;
}

interface NextFreeRow {
  person_id: string;
  full_name: string;
  profession: string | null;
  state: string | null;
  lga: string | null;
  next_free_date: string;
  days_away: number;
  last_availability_update: string | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const humanDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const BLOCK_OPTIONS = [
  { value: "any", label: "Any time of day", blocks: null as string[] | null },
  { value: "morning", label: "Mornings", blocks: ["morning"] },
  { value: "afternoon", label: "Afternoons", blocks: ["afternoon"] },
  { value: "evening", label: "Evenings", blocks: ["evening"] },
  { value: "night", label: "Nights", blocks: ["night"] },
  { value: "day", label: "Daytime", blocks: ["morning", "afternoon"] },
];

const MatchUniverseAvailability = () => {
  const { toast } = useToast();
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(iso(today));
  const [to, setTo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 13); return iso(d); });
  const [block, setBlock] = useState("any");
  const [profession, setProfession] = useState("any");
  const [state, setState] = useState("any");
  const [lga, setLga] = useState("");
  const [rows, setRows] = useState<FreeRow[]>([]);
  const [stale, setStale] = useState<StaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextFree, setNextFree] = useState<NextFreeRow[]>([]);
  const [nextLoading, setNextLoading] = useState(false);
  // Which rows have been opened out to show the exact days and hours.
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const toggleRow = (id: string) => setOpenRows((p) => ({ ...p, [id]: !p[id] }));

  const run = useCallback(async () => {
    setLoading(true);
    const { data, error } = await adminDb().rpc("mu_available_people", {
      _from: from,
      _to: to,
      _blocks: BLOCK_OPTIONS.find((b) => b.value === block)?.blocks ?? null,
      _profession: profession === "any" ? null : profession,
      _state: state === "any" ? null : state,
      _lga: lga.trim() || null,
      _limit: 200,
    } as any);
    setLoading(false);
    if (error) {
      toast({ title: "Could not search", description: error.message, variant: "destructive" });
      return;
    }
    const found = ((data as any) || []) as FreeRow[];
    setRows(found);

    // Nobody free inside the window is a real answer, but a useless one on its
    // own. Look past the window and name the closest people instead.
    if (found.some((r) => r.availability === "available")) {
      setNextFree([]);
      return;
    }
    setNextLoading(true);
    const { data: later } = await adminDb().rpc("mu_next_free_dates", {
      _after: to,
      _blocks: BLOCK_OPTIONS.find((b) => b.value === block)?.blocks ?? null,
      _profession: profession === "any" ? null : profession,
      _state: state === "any" ? null : state,
      _lga: lga.trim() || null,
      _horizon_days: 180,
      _limit: 10,
    } as any);
    setNextLoading(false);
    setNextFree(((later as any) || []) as NextFreeRow[]);
  }, [from, to, block, profession, state, lga, toast]);

  const loadStale = useCallback(async () => {
    const { data } = await adminDb().rpc("mu_availability_freshness", { _limit: 100 } as any);
    setStale(((data as any) || []) as StaleRow[]);
  }, []);

  useEffect(() => { run(); loadStale(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const free = rows.filter((r) => r.availability === "available");
  const busy = rows.filter((r) => r.availability === "unavailable");

  const silent = rows.filter((r) => r.availability === "unknown");

  return (
    <MuPage>
      <MuPageHeader
        backTo="/admin/match-universe"
        backLabel="Match Universe"
        title="Availability"
        description="Search candidates by date range and shift. Unknown means the candidate has not confirmed, not that they are unavailable."
        actions={
          <Button variant="outline" asChild>
            <Link to="/admin/match-universe/workforce">Workforce</Link>
          </Button>
        }
      />

      <MuStats
        columns={4}
        stats={[
          { label: "Free in window", value: free.length, icon: CalendarCheck, tone: free.length ? "attention" : "default" },
          { label: "Booked or unavailable", value: busy.length, icon: CalendarClock },
          { label: "Have not told us yet", value: silent.length, icon: Users, hint: "Silence is not a no" },
          { label: "Outdated availability", value: stale.length, icon: CalendarClock, hint: "Never set or over two weeks old" },
        ]}
      />

      <MuToolbar>
        <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Shift</Label>
            <Select value={block} onValueChange={setBlock}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BLOCK_OPTIONS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Profession</Label>
            <Select value={profession} onValueChange={setProfession}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any profession</SelectItem>
                {PROFESSIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">State</Label>
            <Select value={state} onValueChange={(v) => { setState(v); setLga(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any state</SelectItem>
                {Object.keys(STATES_AND_LGAS).sort().map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <LgaSelect
            state={state === "any" ? "" : state}
            value={lga}
            onChange={setLga}
            className="w-48"
          />
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
            Search
          </Button>
        </div>
      </MuToolbar>

      <MuSection title="Available in this window" padded={false}>
        {free.length === 0 ? (
          <div className="px-5 py-6">
            <MuEmpty
              icon={CalendarCheck}
              title={`Nobody has told us they are free between ${humanDate(from)} and ${humanDate(to)}`}
              description="No matches in this range. The nearest available candidates are listed below."
            />
            {nextFree.length > 0 ? (
              <ul className="mt-4 divide-y divide-border/60 rounded-lg border border-border/60">
                {nextFree.map((n) => (
                  <li key={n.person_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <Link
                        to={`/admin/match-universe/${n.person_id}?tab=work`}
                        className="text-sm font-medium hover:underline"
                      >
                        {n.full_name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {n.profession && (
                          <span className="inline-flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" />{n.profession}
                          </span>
                        )}
                        {[n.lga, n.state].filter(Boolean).length > 0 && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />{[n.lga, n.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {!n.profession && !n.state && !n.lga && <span>No profession or location on file</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Free {humanDate(n.next_free_date)}</Badge>
                      <Badge variant="outline">{n.days_away} days out</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                {nextLoading ? "Looking further ahead…" : "Nobody in the candidate pool has a free date in the next six months either."}
              </p>
            )}
          </div>
        ) : (

          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Person</TableHead>
                  <TableHead>Profession</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead className="text-right">Days free</TableHead>
                  <TableHead>Next available dates</TableHead>
                  <TableHead>Calendar</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {free.map((r) => (
                  <Fragment key={r.person_id}>
                  <TableRow>
                    <TableCell className="w-8 align-middle">
                      <button
                        type="button"
                        onClick={() => toggleRow(r.person_id)}
                        aria-label={openRows[r.person_id] ? `Hide ${r.full_name}'s exact hours` : `Show ${r.full_name}'s exact hours`}
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                      >
                        {openRows[r.person_id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.profession || "Not set"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {[r.lga, r.state].filter(Boolean).join(", ") || "Not set"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.free_days}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="flex flex-wrap gap-1.5">
                        {(r.free_dates || []).slice(0, 5).map((d) => (
                          <span key={d} className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px]">
                            {new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        ))}
                        {(r.free_dates || []).length > 5 && (
                          <span className="text-[11px]">and {(r.free_dates || []).length - 5} more</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{freshnessLabel(r.last_availability_update)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/admin/match-universe/${r.person_id}?tab=work`}>Offer work</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                  {openRows[r.person_id] && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={8} className="p-4">
                        <AvailabilityDetail
                          personId={r.person_id}
                          lastUpdate={r.last_availability_update}
                          from={from}
                          weeks={8}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {free.length > 0 && (
          <ConsoleMobileList
            emptyLabel="Nobody is free in this window."
            emptyIcon={CalendarCheck}
            rows={free.map((r): ConsoleMobileRow => ({
              key: r.person_id,
              title: r.full_name,
              state: [
                r.profession || "Not set",
                [r.lga, r.state].filter(Boolean).join(", ") || "Not set",
                `${r.free_days} day${r.free_days === 1 ? "" : "s"} free`,
              ].join(" · "),
              status: <Badge variant="outline">{freshnessLabel(r.last_availability_update)}</Badge>,
              to: `/admin/match-universe/${r.person_id}?tab=work`,
            }))}
          />
        )}
      </MuSection>

      <MuSection
        title="Outdated availability"
        description="Never set, or not updated in over two weeks."
        padded={false}
      >
        {stale.length === 0 ? (
          <MuEmpty icon={CalendarCheck} title="All availability is up to date" />
        ) : (
          <ul className="divide-y divide-border/60">
            {stale.slice(0, 40).map((s) => (
              <li key={s.person_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <Link to={`/admin/match-universe/${s.person_id}?tab=work`} className="text-sm font-medium hover:underline">
                    {s.full_name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {s.profession && (
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" />{s.profession}
                      </span>
                    )}
                    {s.email && (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />{s.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!s.claimed && <Badge variant="outline">Never signed in</Badge>}
                  <Badge variant="secondary">{freshnessLabel(s.last_availability_update)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </MuSection>
    </MuPage>
  );
};

export default MatchUniverseAvailability;
