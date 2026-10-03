// Contract templates.
//
// A role you hire several people into is one contract written once. A template
// holds the wording, the terms that are the same for everybody, and the annex
// set the role carries.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { FileStack, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { MuEmpty, MuPage, MuPageHeader, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { ContractTemplate, createTemplate, loadTemplates } from "@/lib/contract-templates";

const ContractTemplates = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { adminDisplayName } = useAuth();

  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await loadTemplates(true));
    } catch (err: any) {
      toast({ title: "Could not load the templates", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await createTemplate(name.trim(), adminDisplayName);
      navigate(`/admin/contracts/templates/${id}`);
    } catch (err: any) {
      toast({ title: "Could not create the template", description: err.message, variant: "destructive" });
    }
    setBusy(false);
  };

  return (
    <MuPage>
      <MuPageHeader
        title="Contract templates"
        description="Write the contract for a role once, then issue it to everybody who accepted that role."
        backTo="/admin/workforce"
        backLabel="Back to workforce"
        actions={
          <>
            <Button variant="outline" asChild><Link to="/admin/contracts/annexes">Annex library</Link></Button>
            <Button onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />New template</Button>
          </>
        }
      />

      <MuSection padded={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <MuEmpty
            icon={FileStack}
            title="No templates yet"
            description="Create one for a role you hire into more than once."
            action={<Button onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />New template</Button>}
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {templates.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/admin/contracts/templates/${t.id}`}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{t.name}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {[t.job_title, t.department, t.contract_type?.replace("_", " ")].filter(Boolean).join(" · ") ||
                        "No role set yet"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {t.is_clinical && <MuStatus tone="info" label="Clinical" />}
                    <MuStatus tone={t.active ? "good" : "neutral"} label={t.active ? "In use" : "Retired"} />
                    <span className="text-xs text-muted-foreground">
                      Updated {format(new Date(t.updated_at), "d MMM yyyy")}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </MuSection>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New contract template</DialogTitle>
            <DialogDescription>
              It starts from the current clause library and the annex library. You can change everything afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Name it after the role</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Registered nurse, full time" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={add} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MuPage>
  );
};

export default ContractTemplates;
