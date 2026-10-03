// Reading and signing a contract from an emailed link.
//
// No account needed. The link is the only thing that reaches this contract, and
// nothing else in the system is reachable from here. The signature, the time,
// the address and the device are recorded server side.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Download, Loader2, PenLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import ContractDocument from "@/components/contracts/ContractDocument";
import SignaturePad from "@/components/contracts/SignaturePad";
import { contractToPdfBlob, downloadBlob } from "@/lib/contract-pdf";

interface PublicContract {
  id: string;
  status: string;
  fields: Record<string, string>;
  clauses: any[];
  annexes: any[];
  is_clinical: boolean;
  signed_name: string | null;
  signed_at: string | null;
  signature_image: string | null;
  countersigned_name: string | null;
  countersigned_at: string | null;
  countersignature_image: string | null;
  person_name: string | null;
}

const ContractSign = () => {
  const { token = "" } = useParams();
  const { toast } = useToast();
  const docRef = useRef<HTMLDivElement>(null);
  const [contract, setContract] = useState<PublicContract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<"typed" | "drawn">("typed");
  const [name, setName] = useState("");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const call = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const { data, error: fnErr } = await supabase.functions.invoke("contract-sign", {
        body: { action, token, ...extra },
      });
      if (fnErr) {
        const message = (data as any)?.error || fnErr.message;
        throw new Error(message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { contract: PublicContract };
    },
    [token],
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await call("get");
        setContract(res.contract);
        setName(res.contract.fields.employee_name || res.contract.person_name || "");
      } catch (err: any) {
        setError(err.message || "This link is no longer valid.");
      }
      setLoading(false);
    })();
  }, [call]);

  const sign = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const res = await call("sign", {
        name: name.trim(),
        method,
        signature_image: method === "drawn" ? drawn : null,
        consent,
      });
      setContract(res.contract);
      toast({
        title: "Signed",
        description: "We will countersign it and email you the finished copy.",
      });
    } catch (err: any) {
      toast({ title: "Could not sign", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const download = async () => {
    if (!docRef.current) return;
    const blob = await contractToPdfBlob(docRef.current);
    downloadBlob(blob, "medic-connect-contract.pdf");
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted px-6">
        <div className="max-w-md rounded-3xl bg-background p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">This link cannot be opened</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Email hello@medicconnect.co and we will send a fresh one.
          </p>
        </div>
      </div>
    );
  }

  const done = contract.status !== "issued";

  return (
    <div className="min-h-dvh bg-[#e9e7e2] py-8">
      <SEO
        title="Your contract | Medic Connect"
        description="Read and sign your offer of employment with Medic Connect."
        path={`/contract/${token}`}
        noindex
      />

      <div className="mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 mc-no-print">
        <div className="flex items-center gap-2 text-sm text-[#3d4356]">
          <ShieldCheck className="h-4 w-4 text-[#3B4DC4]" />
          {done ? "Signed and recorded" : "Private link, for you only"}
        </div>
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="mr-2 h-4 w-4" />Download PDF
        </Button>
      </div>

      <ContractDocument
        ref={docRef}
        fields={contract.fields}
        clauses={contract.clauses}
        annexes={contract.annexes}
        isClinical={contract.is_clinical}
        signedName={contract.signed_name}
        signedAt={contract.signed_at}
        signatureImage={contract.signature_image}
        countersignedName={contract.countersigned_name}
        countersignedAt={contract.countersigned_at}
        countersignatureImage={contract.countersignature_image}
        showPlaceholders={false}
      />

      <div className="mx-auto mt-8 max-w-[210mm] px-4 mc-no-print">
        {done ? (
          <div className="flex items-start gap-3 rounded-3xl bg-background p-6 shadow-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium">Thank you, this contract is signed.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed by {contract.signed_name}. We will countersign it and email you the finished
                copy, which is also filed on your profile.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-background p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <PenLine className="h-4 w-4 text-primary" />Sign your contract
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Read the whole document above first. Sign by typing your name or by drawing your signature.
            </p>

            <Tabs value={method} onValueChange={(v) => setMethod(v as "typed" | "drawn")} className="mt-4">
              <TabsList>
                <TabsTrigger value="typed">Type my name</TabsTrigger>
                <TabsTrigger value="drawn">Draw my signature</TabsTrigger>
              </TabsList>
              <TabsContent value="typed" className="mt-4 space-y-1.5">
                <Label>Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </TabsContent>
              <TabsContent value="drawn" className="mt-4 space-y-3">
                <SignaturePad onChange={setDrawn} />
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </TabsContent>
            </Tabs>

            <label className="mt-5 flex items-start gap-3 text-sm text-muted-foreground">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <span>
                By typing my name and ticking this box I confirm that this constitutes my electronic
                signature and has the same effect as a signature in ink.
              </span>
            </label>

            <Button
              className="mt-5"
              onClick={sign}
              disabled={saving || !consent || !name.trim() || (method === "drawn" && !drawn)}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Sign this contract
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractSign;
