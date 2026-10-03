import { useState } from "react";
import HeardPage from "@/components/heard/v2/HeardLayout";
import {
  HeardButton,
  HeardHoursPanel,
  HeardNotice,
  HeardPullLine,
  HeardStackFrame,
  HeardTextField,
} from "@/components/heard/v2/HeardKit";
import { HEARD_ERRORS, heardSubmit, isEmail } from "@/components/heard/v2/heardSubmit";

/** Pre-launch. No telephone number is shown, and the lines are not open. */
export const HeardTalk = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setError(email.trim() ? HEARD_ERRORS.email : HEARD_ERRORS.required);
      return;
    }
    setError(undefined);
    setFailed(false);
    setSending(true);
    try {
      await heardSubmit({ kind: "phone_waitlist", email: email.trim(), source: "heard_talk" });
      setDone(true);
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <HeardPage path="/talk" title="Talk to us — Heard" description="Our phone lines are coming soon.">
      {done ? (
        <h1>We'll let you know.</h1>
      ) : (
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-4">
            <h1>Sometimes you just need to tell somebody.</h1>
            <p className="text-[17px] text-[color:var(--hv-violet)]">Our phone lines are coming soon.</p>
            <p className="text-[17px] text-[color:var(--hv-violet)]">
              When they open, we'll be here from <HeardPullLine>6pm to 2am</HeardPullLine>.
            </p>
          </header>

          <HeardHoursPanel hours="6PM–2AM" note="Not live yet. We will say so here when it is." />

          {failed && (
            <HeardNotice tone="problem" title={HEARD_ERRORS.generic}>
              Nothing is lost. Try again when you are ready.
            </HeardNotice>
          )}

          <HeardStackFrame>
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
              <HeardTextField
                label="Your email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                help="We'll let you know when the lines open."
                error={error}
                maxLength={255}
              />
              <div>
                <HeardButton type="submit" disabled={sending}>
                  {sending ? "Sending…" : "Tell me when"}
                </HeardButton>
              </div>
            </form>
          </HeardStackFrame>
        </div>
      )}
    </HeardPage>
  );
};

export default HeardTalk;
