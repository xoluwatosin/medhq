// The family's home in Care: the people whose care they can follow, and what
// they can open for each. Access is decided by the care team, section by
// section, so the page says plainly what each person's access covers.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  FamilyCard, FamilyHeading, FamilyLoading, FamilyNote, FamilyShell, FamilyText,
  familyOnNavy, familySecondary,
} from "@/components/care/FamilyShell";

type CareRecord = {
  grant_id: string;
  client_id?: string;
  reference: string;
  display_name?: string | null;
  scopes: { journey: boolean; clinical: boolean; finance: boolean };
};

const SECTIONS: { key: keyof CareRecord["scopes"]; label: string }[] = [
  { key: "journey", label: "Progress of the request" },
  { key: "clinical", label: "Care proposal and care plan" },
  { key: "finance", label: "Quotes, invoices and payments" },
];

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

const CareHome = () => {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void supabase.functions.invoke("care-portal-accept", { body: { action: "home" } }).then(({ data, error: invokeError }) => {
      if (!live) return;
      setLoading(false);
      if (invokeError || data?.error) { setError(String(data?.error ?? "We could not open your care record.")); return; }
      setName(String(data?.person_name ?? ""));
      setRecords((data?.records ?? []) as CareRecord[]);
    });
    return () => { live = false; };
  }, []);

  return (
    <FamilyShell
      eyebrow="Your care"
      title={name ? `Welcome, ${firstName(name)}` : "Your care"}
      lead="The care you can follow with Medic Connect. The care team decides what each part shows, and will tell you when something new is ready."
      path="/care"
      action={
        <button type="button" className={familyOnNavy} onClick={() => void supabase.auth.signOut()}>
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
        </button>
      }
    >
      {loading ? (
        <FamilyCard><FamilyLoading label="Opening your care record" /></FamilyCard>
      ) : error ? (
        <FamilyCard>
          <FamilyHeading>We could not open your care record</FamilyHeading>
          <FamilyText className="mt-1">{error}</FamilyText>
          <Link to="/contact" className={`${familySecondary} mt-4`}>Contact Medic Connect</Link>
        </FamilyCard>
      ) : records.length === 0 ? (
        <FamilyCard>
          <FamilyHeading>Nothing to show yet</FamilyHeading>
          <FamilyText className="mt-1">
            Your account is set up, but no care record is open to you at the moment. The care team will let you know
            when it is.
          </FamilyText>
        </FamilyCard>
      ) : (
        records.map((record) => (
          <FamilyCard key={record.grant_id}>
            <span className="label-caps text-[11px] text-label">{record.reference}</span>
            <FamilyHeading>{record.display_name ? `Care for ${record.display_name}` : "Care record"}</FamilyHeading>
            <ul className="mt-4 flex flex-col divide-y divide-hairline-warm border-y border-hairline-warm">
              {SECTIONS.map((section) => {
                const open = record.scopes[section.key];
                const proposal = section.key === "clinical" && open;
                const body = (
                  <>
                    <span className={open ? "text-ink" : "text-label"}>{section.label}</span>
                    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[13.5px]">
                      {open
                        ? proposal
                          ? <>Open <ArrowRight className="h-4 w-4" aria-hidden="true" /></>
                          : <span className="text-body">Shared with you</span>
                        : <span className="text-label">Not shared</span>}
                    </span>
                  </>
                );
                return (
                  <li key={section.key}>
                    {proposal ? (
                      <Link
                        to={record.client_id ? `/care/proposal?client=${record.client_id}` : "/care/proposal"}
                        className="flex min-h-12 items-center justify-between gap-3 py-2 text-[15px] font-semibold text-brand hover:underline"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex min-h-12 items-center justify-between gap-3 py-2 text-[15px] font-medium">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </FamilyCard>
        ))
      )}
      {!loading && !error && (
        <FamilyNote title="Need something?">
          Message the care team on WhatsApp or call us. For an emergency, call 112 first.
        </FamilyNote>
      )}
    </FamilyShell>
  );
};

export default CareHome;
