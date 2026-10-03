// One choice from a long list, found by typing.
//
// The list opens in a popover that is kept inside the viewport and never wider
// than the screen, so a long label cannot push the page sideways.
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FieldShell, fieldControlClass } from "./FieldShell";
import type { FieldOption } from "./Select";

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FieldOption[];
  label?: string;
  hideLabel?: boolean;
  help?: string;
  error?: string | null;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
}

export const SearchableSelect = ({
  value,
  onChange,
  options,
  label,
  hideLabel,
  help,
  error,
  placeholder = "Choose one",
  searchPlaceholder = "Search",
  emptyLabel = "No matches",
  disabled,
  disabledReason,
  readOnly,
  required,
  className,
}: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value);

  return (
    <FieldShell
      label={label}
      hideLabel={hideLabel}
      help={help}
      error={error}
      disabledReason={disabled ? disabledReason : undefined}
      required={required}
      className={className}
    >
      {({ controlId, describedBy, invalid }) =>
        readOnly ? (
          <p id={controlId} className={cn(fieldControlClass(invalid, true))}>{chosen?.label ?? "Not recorded"}</p>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                id={controlId}
                type="button"
                role="combobox"
                aria-expanded={open}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                disabled={disabled}
                className={cn(fieldControlClass(invalid), "justify-between text-left")}
              >
                <span className={cn("truncate", !chosen && "text-muted-foreground")}>
                  {chosen?.label ?? placeholder}
                </span>
                <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              collisionPadding={12}
              avoidCollisions
              className="z-50 w-[min(22rem,calc(100vw-1.5rem))] p-0"
            >
              <Command>
                <CommandInput placeholder={searchPlaceholder} />
                <CommandList className="max-h-[min(18rem,50vh)]">
                  <CommandEmpty>{emptyLabel}</CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        disabled={option.disabled}
                        onSelect={() => {
                          onChange(option.value === value ? "" : option.value);
                          setOpen(false);
                        }}
                      >
                        <Check
                          aria-hidden
                          className={cn("mr-2 h-4 w-4 shrink-0", option.value === value ? "opacity-100" : "opacity-0")}
                        />
                        <span className="min-w-0 break-words">{option.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )
      }
    </FieldShell>
  );
};

export default SearchableSelect;
