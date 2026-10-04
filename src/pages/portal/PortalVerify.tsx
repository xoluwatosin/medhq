// Contact verification. Compulsory: there is no skip, and no portal screen
// opens until the code sent to the candidate has been checked on the server.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CxJoinShell, CxJoinAside } from "@/components/candidate/CxJoinShell";
import { art } from "@/components/mc/art";
import { CxCard, CxButton, CxField } from "@/components/candidate/primitives";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;

// The function answers with plain wording and a non-2xx status. supabase-js
// hands that back as an error, so the readable line is read off the response
// body rather than the client's own technical message.
const readFailure = async (data: unknown, error: unknown): Promise<string> => {
  const fromBody = (data as any)?.error;
  if (typeof fromBody === "string" && fromBody) return fromBody;
  if (!error) return "";
  const context = (error as any)?.context;
  if (context && typeof context.text === "function") {
    try {
      const raw = await context.text();
      const parsed = JSON.parse(raw);
      if (typeof parsed?.error === "string" && parsed.error) return parsed.error;
    } catch {
      // fall through to the generic line below
    }
  }
  return "We could not check that code just now. Please try again in a moment.";
};


const PortalVerify = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [active, setActive] = useState(0);
  const [sending, setSending] = useState(true);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [destination, setDestination] = useState("");
  const [problem, setProblem] = useState("");
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const requested = useRef(false);

  const send = useCallback(async (announce: boolean) => {
    setSending(true);
    setProblem("");
    const { data, error } = await supabase.functions.invoke("candidate-verify", {
      body: { action: "send" },
    });
    setSending(false);
    const failure = await readFailure(data, error);
    if ((data as any)?.alreadyVerified) { navigate("/portal", { replace: true }); return; }
    if (failure) { setProblem(failure); return; }
    setDestination((data as any)?.destination ?? "");
    setCountdown(RESEND_SECONDS);
    if (announce) toast.success("A new code is on its way.");
  }, [navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/portal/login", { replace: true }); return; }
    if (requested.current) return;
    requested.current = true;
    send(false);
  }, [authLoading, user, send, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const full = code.join("");

  const submit = async (e?: React.FormEvent, override?: string) => {
    e?.preventDefault();
    const value = override ?? full;
    if (value.length !== CODE_LENGTH || checking) return;
    setChecking(true);
    setProblem("");
    const { data, error } = await supabase.functions.invoke("candidate-verify", {
      body: { action: "verify", code: value },
    });
    setChecking(false);
    const failure = await readFailure(data, error);
    if (failure) {
      setProblem(failure);
      setCode(Array(CODE_LENGTH).fill(""));
      setActive(0);
      inputsRef.current[0]?.focus();
      return;
    }
    toast.success("Thank you. That is you confirmed.");
    navigate("/portal/start", { replace: true });
  };

  const setDigit = (idx: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < CODE_LENGTH - 1) {
      setActive(idx + 1);
      inputsRef.current[idx + 1]?.focus();
    }
    if (digit && idx === CODE_LENGTH - 1 && next.every(Boolean)) submit(undefined, next.join(""));
  };

  const onKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      setActive(idx - 1);
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    const next = Array(CODE_LENGTH).fill("");
    text.split("").forEach((d, i) => (next[i] = d));
    setCode(next);
    const focus = Math.min(text.length, CODE_LENGTH - 1);
    setActive(focus);
    inputsRef.current[focus]?.focus();
    if (text.length === CODE_LENGTH) submit(undefined, text);
  };

  const signOut = () => supabase.auth.signOut().then(() => navigate("/portal/login"));

  return (
    <>
      <SEO
        title="Confirm your email | Medic Connect"
        description="Confirm your email address to open your Medic Connect candidate profile."
        path="/portal/verify"
        noindex
      />
      <CxJoinShell
        title="Confirm it is you"
        eyebrow="One step left"
        step={1}
        aside={
          <CxJoinAside
            eyebrow="Almost there"
            heading="One code, and your profile is open."
            art={art.coordinatorDeskPhoneCutout}
            lede="We check every candidate is reachable before we put them in front of a client. It takes a moment and it only happens once."
            items={[
              { title: "Enter the code", body: "Six digits, sent to the email you signed up with." },
              { title: "Tell us where you are", body: "Your state and area, so we only send you work you can reach." },
              { title: "Add your documents", body: "We hold them, so you never fill the same form twice." },
            ]}
          />
        }
        headerAction={
          <button
            type="button"
            onClick={signOut}
            className="text-[14px] font-bold text-white underline-offset-4 hover:underline md:text-brand"
          >
            Sign out
          </button>
        }
      >
        <CxCard kind="quiet" className="p-5 md:p-8">
          <div className="flex items-start gap-3">
            <span className="cx-chip flex h-9 w-9 shrink-0 items-center justify-center bg-tint text-navy">
              <Mail className="h-[18px] w-[18px]" />
            </span>
            <p className="text-[16px] leading-relaxed text-body">
              We sent a six-digit code to{" "}
              <span className="font-bold text-ink">{destination || user?.email || "your email"}</span>.
              Enter it below. This cannot be skipped.
            </p>
          </div>

          <form onSubmit={submit} className="mt-6">
            <CxField label="Verification code">
              <div className="flex justify-center gap-2 sm:gap-3">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputsRef.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onKeyDown(i, e)}
                    onPaste={onPaste}
                    onFocus={() => setActive(i)}
                    className={cn(
                      "h-14 w-11 rounded-[10px] border bg-white text-center text-[22px] font-extrabold text-ink outline-none transition-colors sm:h-16 sm:w-14 sm:text-[26px]",
                      active === i ? "border-brand" : "border-line",
                    )}
                    aria-label={`Digit ${i + 1}`}
                  />
                ))}
              </div>
            </CxField>

            {problem && (
              <p className="mt-4 border border-warn-line bg-warn-bg px-4 py-3 text-[14.5px] font-semibold text-ink">
                {problem}
              </p>
            )}

            <CxButton
              type="submit"
              full
              disabled={full.length !== CODE_LENGTH || checking || sending}
              className="mt-6"
            >
              {checking ? <><Loader2 className="h-4 w-4 animate-spin" />Checking</> : "Confirm and continue"}
            </CxButton>
          </form>

          <div className="mt-6 border-t border-line pt-5">
            <p className="text-[14.5px] text-body">
              {sending
                ? "Sending your code."
                : countdown > 0
                  ? `You can ask for another code in ${countdown} seconds.`
                  : "Nothing arrived? Check your spam folder, then ask for a new code."}
            </p>
            <CxButton
              rank="secondary"
              className="mt-3"
              disabled={countdown > 0 || sending}
              onClick={() => send(true)}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send me a new code"}
            </CxButton>
          </div>
        </CxCard>
      </CxJoinShell>
    </>
  );
};

export default PortalVerify;
