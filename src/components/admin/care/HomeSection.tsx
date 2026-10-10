// Where this care record lives, and who else lives there.
//
// A family can have several homes; care records under one roof share one, so
// the address is entered once. Joining another record's home takes its
// address; moving out starts a home of its own from the same address.
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MuSection } from "@/components/admin/mu/MuShell";
import { SearchableSelect } from "@/components/field";
import ConfirmAction from "@/components/admin/ConfirmAction";
import { careErrorMessage } from "@/lib/care-errors";
import { separateHome, shareHome, type HomeOverview } from "@/lib/care-records";

interface Props {
  clientId: string;
  clientName: string;
  home: HomeOverview | null;
  canEdit: boolean;
  onChanged: () => void;
}

const names = (list: { full_name: string }[]) => {
  const all = list.map((m) => m.full_name);
  return all.length <= 1 ? all.join("") : `${all.slice(0, -1).join(", ")} and ${all[all.length - 1]}`;
};

const HomeSection = ({ clientId, clientName, home, canEdit, onChanged }: Props) => {
  const [joinWith, setJoinWith] = useState("");
  const [busy, setBusy] = useState(false);
  if (!home) return null;

  const options = home.family.filter((f) => f.has_address);
  const chosen = options.find((f) => f.client_id === joinWith);

  const join = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      await shareHome(clientId, chosen.client_id);
      toast.success(`${clientName} now lives with ${chosen.full_name}`);
      setJoinWith("");
      onChanged();
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not change the home"));
    } finally {
      setBusy(false);
    }
  };

  const moveOut = async () => {
    setBusy(true);
    try {
      await separateHome(clientId);
      toast.success(`${clientName} has a home of their own. Update the address if it has changed.`);
      onChanged();
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not change the home"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MuSection
      title="Home"
      description="Where care happens."
    >
      <div className="flex flex-col gap-4">
        {home.housemates.length > 0 ? (
          <p className="text-[14.5px] text-body">
            Lives with{" "}
            {home.housemates.map((m, i) => (
              <span key={m.client_id}>
                {i > 0 && (i === home.housemates.length - 1 ? " and " : ", ")}
                <Link className="font-bold text-brand" to={`/admin/clients/${m.client_id}`}>{m.full_name}</Link>
              </span>
            ))}
            .
          </p>
        ) : (
          <p className="text-[14.5px] text-muted-foreground">
            {home.home_id ? "No other care record lives here." : "No address recorded yet."}
          </p>
        )}

        {canEdit && options.length > 0 && (
          <div className="border-2 border-navy bg-tint/40 p-3">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-label">Move in</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <SearchableSelect
                label="Lives with someone else in the family"
                value={joinWith}
                onChange={setJoinWith}
                options={options.map((f) => ({
                  value: f.client_id,
                  label: f.address_line ? `${f.full_name}, ${f.address_line}` : f.full_name,
                }))}
                placeholder="Choose a care record"
              />
            </div>
            <ConfirmAction
              trigger={
                <Button type="button" variant="outline" className="h-11" disabled={!chosen || busy}>
                  Move in
                </Button>
              }
              title={chosen ? `${clientName} lives with ${chosen.full_name}?` : "Move in"}
              description={chosen ? `${clientName} takes ${chosen.full_name}'s address. The current address is replaced.` : ""}
              confirmLabel="Move in"
              onConfirm={join}
              disabled={!chosen || busy}
            />
          </div>
          </div>
        )}

        {canEdit && home.housemates.length > 0 && (
          <div>
            <ConfirmAction
              trigger={
                <Button type="button" variant="outline" size="sm" className="h-9" disabled={busy}>
                  Lives somewhere else
                </Button>
              }
              title={`${clientName} lives somewhere else?`}
              description={`${clientName} gets a home of their own, starting from the current address. ${names(home.housemates)} keep${home.housemates.length === 1 ? "s" : ""} this one. Then update ${clientName}'s address.`}
              confirmLabel="Move out"
              onConfirm={moveOut}
              disabled={busy}
            />
          </div>
        )}
      </div>
    </MuSection>
  );
};

export default HomeSection;
