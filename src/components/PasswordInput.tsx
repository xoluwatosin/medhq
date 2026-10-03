// A password field with a show/hide toggle. Most candidates are on a phone and
// a mistyped invisible password is where people give up, so every password
// field in the product uses this rather than a bare <Input type="password" />.
import { forwardRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

type Props = React.ComponentPropsWithoutRef<typeof Input>;

const PasswordInput = forwardRef<HTMLInputElement, Props>(({ className, ...props }, ref) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type={shown ? "text" : "password"}
        className={`pr-11 ${className ?? ""}`}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        tabIndex={-1}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
        className="absolute right-0 top-0 h-full w-11 text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
