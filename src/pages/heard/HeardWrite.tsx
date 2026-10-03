import { useState } from "react";
import HeardPage from "@/components/heard/v2/HeardLayout";
import {
  HeardButton,
  HeardDivider,
  HeardNotice,
  HeardPinnedNote,
  HeardStackFrame,
  HeardTapeLabel,
  HeardTextArea,
  HeardTextField,
  HeardWatermark,
} from "@/components/heard/v2/HeardKit";

import { HEARD_ERRORS, heardSubmit, isEmail } from "@/components/heard/v2/heardSubmit";

export const HeardWrite = () => {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!subject.trim()) next.subject = HEARD_ERRORS.required;
    if (!content.trim()) next.content = HEARD_ERRORS.required;
    if (!isEmail(email)) next.email = email.trim() ? HEARD_ERRORS.email : HEARD_ERRORS.required;
    setErrors(next);
    if (Object.keys(next).length) return;

    setFailed(false);
    setSending(true);
    try {
      await heardSubmit({ kind: "message", subject: subject.trim(), content: content.trim(), email: email.trim() });
      setSent(true);
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <HeardPage
      path="/write"
      title="Write to us — Heard"
      description="Some things are easier written down."
      width="wide"
    >
      {sent ? (
        <div className="relative overflow-hidden bg-[color:var(--hv-sky)] px-6 py-16 sm:px-14 sm:py-20">
          <HeardWatermark fill="#FFFFFF" />
          <div className="relative flex flex-col gap-5 max-w-[620px]">
            <span className="hv-index">Sent</span>
            <h1>We got it.</h1>
            <p className="text-[17px] text-[color:var(--hv-late)]">
              A real person reads every message. A reply goes to the email address you gave us.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-16">
          <div className="flex flex-col gap-6">
            <span className="hv-index">Write to us</span>
            <h1>Some things are easier written down.</h1>
            <p className="text-[17px] text-[color:var(--hv-violet)]">Tell us what's on your mind.</p>
            <HeardDivider variant="dotted" />
            <HeardPinnedNote>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[14.5px] text-[color:var(--hv-violet)]">
                <li>No account. No profile. Nothing public.</li>
                <li>A real person reads it.</li>
                <li>Write as much or as little as you like.</li>
              </ul>
            </HeardPinnedNote>
          </div>

          <div className="flex flex-col gap-6">
            {failed && (
              <HeardNotice tone="problem" title={HEARD_ERRORS.message}>
                Nothing is lost. Try again when you are ready.
              </HeardNotice>
            )}

            <HeardStackFrame>
              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
                <HeardTapeLabel placement="edge">Private</HeardTapeLabel>
                <HeardTextField
                  label="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  error={errors.subject}
                  maxLength={200}
                />
                <div className="flex flex-col gap-2">
                  <HeardTextArea
                    label="What would you like to share?"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    error={errors.content}
                    maxLength={20000}
                  />
                  <span className="hv-index self-end" aria-live="polite">
                    {content.length} of 20,000 characters
                  </span>
                </div>
                <HeardTextField
                  label="Your email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  help="So we can reply."
                  error={errors.email}
                  maxLength={255}
                />
                <div>
                  <HeardButton type="submit" disabled={sending}>
                    {sending ? "Sending…" : "Send"}
                  </HeardButton>
                </div>
              </form>
            </HeardStackFrame>
          </div>
        </div>
      )}
    </HeardPage>
  );
};


export default HeardWrite;
