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
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";
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

// The navy cap every emailed link opens under, so the page is plainly ours.
const Cap = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <header className="relative overflow-hidden bg-navy px-4 pb-6 pt-[max(16px,env(safe-area-inset-top))] sm:px-8 mc-no-print">
    <div className="absolute right-[-30px] top-[-60px] h-44 w-44 rounded-full border-[26px] border-primary-foreground/10" aria-hidden="true" />
    <div className="relative mx-auto w-full max-w-[210mm]">
      <img src={logoWhite} alt="Medic Connect" className="h-8 w-auto" />
      <p className="label-caps mt-5 text-[11px] !text-[#A8B0E8]">{eyebrow}</p>
      <h1 className="mt-1.5 text-[26px] font-medium tracking-[-0.025em] text-primary-foreground sm:text-[32px]">{title}</h1>
    </div>
  </header>
);

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
      <div className="flex min-h-dvh items-center justify-center bg-desk" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
        <span className="sr-only">Opening your contract</span>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-dvh bg-desk">
        <Cap eyebrow="Your contract" title="This link cannot be opened" />
        <div className="mx-auto max-w-[210mm] px-4 py-6 sm:px-8">
          <div className="rounded-2xl border border-hairline-warm bg-card p-6">
            <p className="text-[15px] leading-relaxed text-body">{error}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-body">
              Email <a className="font-semibold text-brand underline" href="mailto:hello@medicconnect.co">hello@medicconnect.co</a> and
              we will send a fresh one.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const done = contract.status !== "issued";

  return (
    <div className="min-h-dvh bg-desk pb-10">
      <SEO
        title="Your contract | Medic Connect"
        description="Read and sign your offer of employment with Medic Connect."
        path={`/contract/${token}`}
        noindex
      />

      <Cap eyebrow="Your contract" title={done ? "Your signed contract" : "Read and sign your contract"} />
      <div className="mx-auto my-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 mc-no-print">
        <div className="flex items-center gap-2 text-[14px] text-body">
          <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
          {done ? "Signed and recorded" : "Private link, for you only"}
        </div>
        <Button variant="outline" className="h-11 rounded-[10px]" onClick={download}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />Download PDF
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
          <div className="flex items-start gap-3 rounded-2xl border border-hairline-warm bg-card p-6">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <div>
              <p className="text-[16px] font-semibold text-ink">Thank you, this contract is signed.</p>
              <p className="mt-1 text-[15px] leading-relaxed text-body">
                Signed by {contract.signed_name}. We will countersign it and email you the finished
                copy, which is also filed on your profile.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-hairline-warm bg-card p-6">
            <h2 className="flex items-center gap-2 text-[19px] font-semibold text-ink">
              <PenLine className="h-4 w-4 text-brand" aria-hidden="true" />Sign your contract
            </h2>
            <p className="mt-1 text-[15px] leading-relaxed text-body">
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

            <label className="mt-5 flex items-start gap-3 text-[14.5px] leading-relaxed text-body">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <span>
                By typing my name and ticking this box I confirm that this constitutes my electronic
                signature and has the same effect as a signature in ink.
              </span>
            </label>

            <Button
              className="mt-5 h-11 rounded-[10px] px-5 text-[15px]"
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
