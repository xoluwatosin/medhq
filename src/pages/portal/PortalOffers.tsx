// Offers. Work we have offered you, your answer back, and the contract that
// follows once you say yes.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileSignature } from "lucide-react";
import OffersPanel from "@/components/portal/OffersPanel";
import CxPortalPage from "@/components/candidate/CxPortalPage";
import { CxButton, CxCard, CxPill } from "@/components/candidate/primitives";
import { PortalContract, loadMyContracts } from "@/lib/contracts";
import { usePortal } from "./usePortal";

const STATUS_WORDS: Record<string, string> = {
  issued: "Waiting for your signature",
  signed: "Signed, with us for approval",
  active: "Signed by both sides",
  ended: "Ended",
};

const PortalOffers = () => {
  const p = usePortal();
  const [contracts, setContracts] = useState<PortalContract[]>([]);

  useEffect(() => {
    if (!p.person) return;
    loadMyContracts().then(setContracts).catch(() => setContracts([]));
  }, [p.person]);

  if (!p.person) {
    return (
      <CxPortalPage loading={p.authLoading || p.loading} person={p.person} nav={p.nav} title="Offers">
        {null}
      </CxPortalPage>
    );
  }

  return (
    <CxPortalPage
      loading={p.authLoading || p.loading}
      person={p.person}
      nav={p.nav}
      title="Offers"
      eyebrow="Candidate portal"
      back="/portal"
      intro="Work we have offered you. Answer here and the family or clinic hears back the same day."
    >
      <div className="space-y-5">
        <CxCard kind={p.openOffers > 0 ? "emphasis" : "quiet"} className="p-5 sm:p-[22px]">
          <OffersPanel personId={p.person.id} onChanged={p.reload} />
        </CxCard>

        {contracts.length > 0 && (
          <CxCard
            kind={contracts.some((c) => c.status === "issued") ? "emphasis" : "quiet"}
            className="p-5 sm:p-[22px]"
          >
            <p className="cx-heading text-[19px] text-ink">Your contracts</p>
            <p className="mt-1 text-[14px] text-body">
              Read the letter, acknowledge the documents that come with it, and sign, all in here.
            </p>
            <div className="mt-4 divide-y divide-line border-t border-line">
              {contracts.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 py-4">
                  <FileSignature className="h-4 w-4 shrink-0 text-navy" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-ink">
                      {c.fields?.job_title || c.job_title || "Offer of employment"}
                    </p>
                    <p className="mt-0.5 text-[13px] text-body">{STATUS_WORDS[c.status] || c.status}</p>
                  </div>
                  <CxPill tone={c.status === "issued" ? "needs-you" : "settled"}>
                    {c.status === "issued" ? "Needs your signature" : "Signed"}
                  </CxPill>
                  <CxButton rank={c.status === "issued" ? "primary" : "secondary"} asChild>
                    <Link to={`/portal/offers/contract/${c.id}`}>
                      {c.status === "issued" ? "Read and sign" : "Open"}
                    </Link>
                  </CxButton>
                </div>
              ))}
            </div>
          </CxCard>
        )}
      </div>
    </CxPortalPage>
  );
};

export default PortalOffers;
