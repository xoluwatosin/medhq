// Your contract pack, inside your own account.
//
// This screen is a list, not a wall. The letter, then every document that
// comes with it, each with its own status and its own button. The reading and
// the signing happen one document at a time, on their own screens.
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CxPortalPage from "@/components/candidate/CxPortalPage";
import { CxCard } from "@/components/candidate/primitives";
import ContractPackList from "@/components/contracts/ContractPackList";
import {
  PortalContract as PortalContractRow, loadMyContract, packOutstanding,
} from "@/lib/contracts";
import { usePortal } from "./usePortal";

const STATUS_WORDS: Record<string, string> = {
  issued: "Waiting for your signature",
  signed: "Signed, with us for approval",
  active: "Signed by both sides",
  ended: "Ended",
};

const PortalContract = () => {
  const { id = "" } = useParams();
  const { toast } = useToast();
  const p = usePortal();

  const [contract, setContract] = useState<PortalContractRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setContract(await loadMyContract(id));
    } catch (err: any) {
      toast({ title: "We could not open this contract", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }, [id, toast]);

  useEffect(() => { if (!p.authLoading) load(); }, [load, p.authLoading]);

  const c = contract;
  const outstanding = c ? packOutstanding(c) : [];
  const needsLetter = c?.status === "issued";

  return (
    <CxPortalPage
      loading={p.authLoading || p.loading || loading}
      person={p.person}
      nav={p.nav}
      title="Your contract pack"
      eyebrow="Candidate portal"
      back="/portal/offers"
      intro="Open each document, read it, and sign the ones that ask for a signature. You can do them in any order and come back later."
    >
      {!loading && !c && (
        <CxCard kind="quiet" className="p-5 sm:p-[22px]">
          <p className="text-[15px] leading-relaxed text-body">
            We cannot find this contract on your account. Email hello@medicconnect.co and we will
            send it again.
          </p>
        </CxCard>
      )}

      {c && (
        <div className="space-y-5">
          <CxCard kind={needsLetter ? "emphasis" : "quiet"} className="p-5 sm:p-[22px]">
            <p className="cx-heading text-[19px] leading-snug text-ink">
              {c.fields?.job_title || c.job_title || "Offer of employment"}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-body">
              {STATUS_WORDS[c.status] || c.status}
              {c.signed_at ? `. You signed on ${new Date(c.signed_at).toLocaleDateString("en-GB")}` : ""}
              {c.countersigned_at
                ? `. Countersigned on ${new Date(c.countersigned_at).toLocaleDateString("en-GB")}`
                : ""}
            </p>
            {needsLetter && (
              <p className="mt-3 text-[15px] leading-relaxed text-body">
                {outstanding.length === 0
                  ? "Every document is done. The letter is the last thing to sign."
                  : outstanding.length === 1
                    ? "One document still needs you."
                    : `${outstanding.length} documents still need you.`}
              </p>
            )}
          </CxCard>

          <CxCard kind="quiet" className="p-5 sm:p-[22px]">
            <p className="cx-heading text-[18px] text-ink">The documents in this pack</p>
            <p className="mt-1 text-[15px] leading-relaxed text-body">
              Each one opens on its own, with its own signature at the foot.
            </p>
            <ContractPackList contract={c} className="mt-4" />
          </CxCard>

          {c.status !== "issued" && (
            <CxCard kind="quiet" className="p-5 sm:p-[22px]">
              <p className="flex items-start gap-3 text-[15px] leading-relaxed text-body">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-navy" />
                {c.status === "signed"
                  ? "Thank you. We are approving and countersigning this now. The finished copy will be emailed to you and kept in your documents."
                  : "This contract is signed by both sides. A copy is kept in your documents."}
              </p>
            </CxCard>
          )}
        </div>
      )}
    </CxPortalPage>
  );
};

export default PortalContract;
