// A notice on the care record when its service user or one of its contacts
// may already be on file as someone else. Staff decide on the duplicates page.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MuNote } from "@/components/admin/mu/MuShell";
import { matchReason, personMatches, type PersonMatch } from "@/lib/care-records";

const PossibleDuplicates = ({ clientId }: { clientId: string }) => {
  const [matches, setMatches] = useState<PersonMatch[]>([]);

  useEffect(() => {
    let live = true;
    personMatches(clientId).then((m) => { if (live) setMatches(m); }).catch(() => undefined);
    return () => { live = false; };
  }, [clientId]);

  if (matches.length === 0) return null;

  return (
    <MuNote title={matches.length === 1 ? "Possible duplicate" : `${matches.length} possible duplicates`}>
      <ul className="flex flex-col gap-1">
        {matches.slice(0, 3).map((m) => (
          <li key={`${m.person_a.id}:${m.person_b.id}`}>
            {m.person_a.full_name} and {m.person_b.full_name} may be the same person. {matchReason(m)}.
          </li>
        ))}
      </ul>
      <Button asChild variant="link" className="mt-1 h-auto p-0">
        <Link to={`/admin/care/duplicates?client=${clientId}`}>Review</Link>
      </Button>
    </MuNote>
  );
};

export default PossibleDuplicates;
