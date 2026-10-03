import { useState } from "react";
import {
  HeardButton,
  HeardCheckbox,
  HeardNotice,
  HeardStackFrame,
  HeardTextField,
} from "./HeardKit";
import { HEARD_CONSENT_VERSION, HEARD_ERRORS, heardSubmit, isEmail } from "./heardSubmit";

/**
 * Can you keep a secret? The letter recipient opt-in.
 * Letters only. It is never joined to Story Swap, and nobody has to write a
 * letter in order to receive one.
 */
export const HeardSecretSignup = () => {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!isEmail(email)) next.email = email.trim() ? HEARD_ERRORS.email : HEARD_ERRORS.required;
    if (!consent) next.consent = HEARD_ERRORS.required;
    setErrors(next);
    if (Object.keys(next).length) return;

    setFailed(false);
    setSending(true);
    try {
      await heardSubmit({
        kind: "letter_subscribe",
        email: email.trim(),
        consentVersion: HEARD_CONSENT_VERSION,
      });
      setDone(true);
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <section aria-labelledby="secret" className="flex flex-col gap-4">
        <h2 id="secret">You're in.</h2>
        <p className="text-[17px] text-[color:var(--hv-violet)]">
          If a letter finds its way to you, you'll get it by email.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="secret" className="flex flex-col gap-6">
      <h2 id="secret">Can you keep a secret?</h2>
      <div className="flex flex-col gap-2 max-w-[620px]">
        <p className="text-[17px] text-[color:var(--hv-violet)]">
          Some letters are written without knowing who will read them.
        </p>
        <p className="text-[17px] text-[color:var(--hv-violet)]">
          Leave your email. Every now and then, one may find you.
        </p>
      </div>

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
            error={errors.email}
            maxLength={255}
          />
          <HeardCheckbox checked={consent} onChange={setConsent} error={errors.consent}>
            Yes, send me letters.
          </HeardCheckbox>
          <div>
            <HeardButton type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send me a letter"}
            </HeardButton>
          </div>
        </form>
      </HeardStackFrame>
    </section>
  );
};

export default HeardSecretSignup;
