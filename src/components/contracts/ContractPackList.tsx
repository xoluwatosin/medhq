// The contract pack, lined up.
//
// One row per document: the letter first, then each annex in order. A row says
// what it is, where it stands, and carries its own button. Nothing here opens
// a wall of text; every row leads to one document on its own screen.
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronRight, FileSignature, FileText, PenLine } from "lucide-react";
import { CxButton, CxPill } from "@/components/candidate/primitives";
import { PackItem, PortalContract, packDocLink, packItems } from "@/lib/contracts";

const ICON: Record<PackItem["action"], typeof FileText> = {
  sign: PenLine,
  acknowledge: FileSignature,
  read: FileText,
};

const actionWord = (item: PackItem, open: boolean) => {
  if (item.done) return "Open";
  if (!open) return "Read";
  if (item.action === "sign") return "Sign";
  if (item.action === "acknowledge") return "Acknowledge";
  return "Read";
};

interface Props {
  contract: PortalContract;
  /** Hide the letter row where the page already shows the letter. */
  skipMain?: boolean;
  className?: string;
}

const ContractPackList = ({ contract, skipMain = false, className }: Props) => {
  const open = contract.status === "issued";
  const items = packItems(contract).filter((i) => (skipMain ? i.key !== "main" : true));

  return (
    <div className={className}>
      <div className="divide-y divide-line border-t border-line">
        {items.map((item) => {
          const Icon = item.done ? CheckCircle2 : ICON[item.action];
          const needs = open && !item.done && item.action !== "read";
          return (
            <div
              key={item.key}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${item.done ? "text-navy" : needs ? "text-warn-ink" : "text-muted-foreground"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold leading-snug text-ink">
                  {item.code ? `${item.code}. ` : ""}
                  {item.title}
                </p>
                <p className="mt-0.5 text-[14px] leading-snug text-body">
                  {item.note && item.note !== item.title ? `${item.note}. ` : ""}
                  {item.status}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                {needs
                  ? <CxPill tone="needs-you">Needs you</CxPill>
                  : item.done
                    ? <CxPill tone="settled">Done</CxPill>
                    : <CxPill tone="quiet">For reading</CxPill>}
                <CxButton
                  rank={needs ? "primary" : "secondary"}
                  asChild
                  className="min-h-11 px-4"
                >
                  <Link to={packDocLink(contract.id, item.key)}>
                    {actionWord(item, open)}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </CxButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContractPackList;
