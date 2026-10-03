// The access picker used both on the Admin access screen and on a staff record,
// so one person's areas are described the same way wherever they are edited.
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ACCESS_GROUPS } from "@/lib/admin-access";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  /** Keys the current user is not allowed to grant. */
  lockedKeys?: string[];
  disabled?: boolean;
}

const AccessAreas = ({ value, onChange, lockedKeys = [], disabled }: Props) => {
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div className="space-y-4">
      {ACCESS_GROUPS.map((group) => {
        const keys = group.areas.map((a) => a.key).filter((k) => !lockedKeys.includes(k));
        const all = keys.length > 0 && keys.every((k) => value.includes(k));
        return (
          <div key={group.key} className="rounded-xl border border-border/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{group.label}</p>
              {keys.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() =>
                    onChange(all ? value.filter((k) => !keys.includes(k)) : [...new Set([...value, ...keys])])
                  }
                >
                  {all ? "Clear all" : "Select all"}
                </Button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.areas.map((area) => {
                const locked = lockedKeys.includes(area.key);
                return (
                  <label
                    key={area.key}
                    className={`flex items-start gap-2 text-sm ${locked ? "opacity-50" : ""}`}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={value.includes(area.key)}
                      disabled={disabled || locked}
                      onCheckedChange={() => toggle(area.key)}
                    />
                    <span>{area.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AccessAreas;
