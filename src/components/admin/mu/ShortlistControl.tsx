// One shortlist control for a person and an opportunity, wherever the pair
// appears (the opportunity's Matches, the person's Opportunities tab). Not
// shortlisted: a Shortlist button. Shortlisted: the stage, moved through
// mu_shortlist_set_stage, with Remove only while nothing has happened yet.
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// The only stages the database accepts, in the order they normally happen.
export const SHORTLIST_STAGES = [
  { value: "shortlisted", label: "Shortlisted" },
  { value: "put_forward", label: "Put forward" },
  { value: "client_interviewing", label: "Client interviewing" },
  { value: "placed", label: "Placed" },
  { value: "withdrawn", label: "Withdrawn" },
];

export const shortlistStageLabel = (stage: string) =>
  SHORTLIST_STAGES.find((s) => s.value === stage)?.label ?? stage;

export const ShortlistControl = ({
  stage,
  onAdd,
  onStage,
  onRemove,
  busy,
}: {
  /** The shortlist stage, or null when the person is not on it. */
  stage: string | null;
  onAdd: () => void;
  onStage: (stage: string) => void;
  onRemove: () => void;
  busy?: boolean;
}) =>
  stage ? (
    <Select value={stage} disabled={busy} onValueChange={(v) => (v === "__remove" ? onRemove() : onStage(v))}>
      <SelectTrigger className="h-9 w-[190px]" aria-label="Shortlist stage">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SHORTLIST_STAGES.map((s) => (
          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
        ))}
        {/* Once someone has been put forward, the shortlist is the record of
            it; withdraw them instead of erasing it. */}
        {stage === "shortlisted" && <SelectItem value="__remove">Remove from shortlist</SelectItem>}
      </SelectContent>
    </Select>
  ) : (
    <Button variant="outline" size="sm" disabled={busy} onClick={onAdd}>
      <Star className="mr-2 h-4 w-4" />
      Shortlist
    </Button>
  );

export default ShortlistControl;
