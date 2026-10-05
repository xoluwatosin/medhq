// The people linked to a care record.
//
// A mother and the child she arranged care for are one family, so the record
// says so on the first screen: the household, who is in it, how they are
// related, and a way straight into their own file.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { MuEmpty, MuSection } from "@/components/admin/mu/MuShell";
import { careErrorMessage } from "@/lib/care-errors";
import { clientLinks, roleText, type ClientLinks } from "@/lib/care-records";

const LinkedPeople = ({ clientId }: { clientId: string }) => {
  const [links, setLinks] = useState<ClientLinks | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const data = await clientLinks(clientId);
        if (live) setLinks(data);
      } catch (error) {
        if (live) setProblem(careErrorMessage(error, "Could not load the linked people"));
      }
    })();
    return () => { live = false; };
  }, [clientId]);

  if (problem) {
    return (
      <MuSection title="Family">
        <p className="text-[14.5px] text-muted-foreground">{problem}</p>
      </MuSection>
    );
  }

  if (!links?.household) return null;

  const others = links.people.filter((person) => person.client_id !== clientId);

  return (
    <MuSection
      title={links.household.display_name}
      description="The family this file belongs to."
    >
      {others.length === 0 ? (
        <MuEmpty title="No one else in this family" description="Add relatives from the Family tab." />
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {others.map((person) => {
            const related = person.relationships
              .map((rel) => (rel.label ? `${rel.label} ${rel.to_name}` : rel.other_label))
              .filter(Boolean);
            return (
              <li key={person.person_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[14.5px] font-semibold text-foreground">
                    <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {person.full_name}
                  </span>
                  <span className="mt-0.5 block text-[13.5px] text-muted-foreground">
                    {[roleText(person.roles), related.join(", "), person.phone, person.email]
                      .filter(Boolean)
                      .join(", ") || "No details recorded"}
                  </span>
                </span>
                {person.client_id && (
                  <Link
                    to={`/admin/clients/${person.client_id}`}
                    className="text-[13.5px] font-semibold text-navy underline underline-offset-4"
                  >
                    Open their file
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </MuSection>
  );
};

export default LinkedPeople;
