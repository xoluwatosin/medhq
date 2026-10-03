// References the candidate gives us. Names and contact details only, never a
// judgement — we take up the reference ourselves when the time comes.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { adminDb } from "@/lib/admin-utils";

export interface PersonReference {
  id: string;
  person_id: string;
  referee_name: string;
  relationship: string | null;
  job_title: string | null;
  organisation: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  status: string;
  created_at: string;
}

interface Props {
  personId: string;
  /** Admins read and tidy; candidates own their own list. */
  admin?: boolean;
  readOnly?: boolean;
}

const blank = (personId: string) => ({
  person_id: personId,
  referee_name: "",
  relationship: "",
  job_title: "",
  organisation: "",
  email: "",
  phone: "",
  note: "",
});

const ReferencesPanel = ({ personId, admin, readOnly }: Props) => {
  const { toast } = useToast();
  const db = () => (admin ? (adminDb() as any) : (supabase as any));

  const [rows, setRows] = useState<PersonReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(() => blank(personId));
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db()
      .from("mu_references")
      .select("*")
      .eq("person_id", personId)
      .order("created_at", { ascending: true });
    setRows((data ?? []) as PersonReference[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, admin]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!draft.referee_name.trim()) {
      toast({ title: "We need their name", description: "A reference without a name is no use to anyone.", variant: "destructive" });
      return;
    }
    if (!draft.email.trim() && !draft.phone.trim()) {
      toast({ title: "We need a way to reach them", description: "Give us an email address or a phone number.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await db().from("mu_references").insert({
      ...draft,
      relationship: draft.relationship || null,
      job_title: draft.job_title || null,
      organisation: draft.organisation || null,
      email: draft.email || null,
      phone: draft.phone || null,
      note: draft.note || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save that reference", description: "Please check the details and try again.", variant: "destructive" });
      return;
    }
    setDraft(blank(personId));
    setAdding(false);
    toast({ title: "Reference saved" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await db().from("mu_references").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not remove that", description: "Please try again.", variant: "destructive" });
      return;
    }
    setRows((p) => p.filter((r) => r.id !== id));
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No referees yet. Two people who have managed you or worked closely with you is ideal.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-4 py-3">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.referee_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[r.job_title, r.organisation, r.relationship].filter(Boolean).join(" · ") || "No role given"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[r.email, r.phone].filter(Boolean).join(" · ")}
                </p>
                {r.note ? <p className="mt-1 text-xs italic text-muted-foreground">{r.note}</p> : null}
              </div>
              {!readOnly && (
                <Button variant="ghost" size="sm" onClick={() => remove(r.id)} aria-label={`Remove ${r.referee_name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (adding ? (
        <div className="space-y-3 rounded-xl border border-border/70 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Their full name"
              value={draft.referee_name}
              onChange={(e) => setDraft({ ...draft, referee_name: e.target.value })}
            />
            <Input
              placeholder="How do you know them? e.g. my ward manager"
              value={draft.relationship}
              onChange={(e) => setDraft({ ...draft, relationship: e.target.value })}
            />
            <Input
              placeholder="Their job title"
              value={draft.job_title}
              onChange={(e) => setDraft({ ...draft, job_title: e.target.value })}
            />
            <Input
              placeholder="Where they work"
              value={draft.organisation}
              onChange={(e) => setDraft({ ...draft, organisation: e.target.value })}
            />
            <Input
              type="email" placeholder="Their email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            <Input
              type="tel" placeholder="Their phone number"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </div>
          <Textarea
            rows={2} placeholder="Anything we should know before we contact them (optional)"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={add} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save reference
            </Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setDraft(blank(personId)); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" />Add a reference
        </Button>
      ))}
    </div>
  );
};

export default ReferencesPanel;
