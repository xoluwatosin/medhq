import { useState } from "react";
import HeardPage from "@/components/heard/v2/HeardLayout";
import {
  HeardButton,
  HeardNotice,
  HeardSectionOpener,
  HeardStackFrame,
  HeardTapeLabel,
  HeardTextArea,
  HeardTextField,
} from "@/components/heard/v2/HeardKit";
import { HEARD_ERRORS, heardSubmit, isEmail } from "@/components/heard/v2/heardSubmit";

export const HeardStorySwap = () => {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [signItAs, setSignItAs] = useState("");
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
    if (!signItAs.trim()) next.signItAs = HEARD_ERRORS.required;
    if (!isEmail(email)) next.email = email.trim() ? HEARD_ERRORS.email : HEARD_ERRORS.required;
    setErrors(next);
    if (Object.keys(next).length) return;

    setFailed(false);
    setSending(true);
    try {
      await heardSubmit({
        kind: "story",
        subject: subject.trim(),
        content: content.trim(),
        signItAs: signItAs.trim(),
        email: email.trim(),
      });
      setSent(true);
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <HeardPage path="/story-swap" title="Story Swap — Heard" description="Give one. Get one." width="wide">
      {sent ? (
        <div className="max-w-[760px] flex flex-col gap-6">
          <h1>Your story is in.</h1>
          <p className="text-[17px] text-[color:var(--hv-violet)]">
            When your swap is ready, it will arrive by email.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <HeardSectionOpener eyebrow="Story Swap" lines={["Give one.", "Get one."]} asPageHeading />

          <div className="max-w-[760px] flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <p className="text-[17px] text-[color:var(--hv-violet)]">
                Leave a story. Receive one from someone else.
              </p>
              <p className="text-[17px] text-[color:var(--hv-violet)]">
                A brief look into a life you may never otherwise know.
              </p>
            </div>

            {failed && (
              <HeardNotice tone="problem" title={HEARD_ERRORS.story}>
                Nothing is lost. Try again when you are ready.
              </HeardNotice>
            )}

            <HeardStackFrame>
              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
                <HeardTapeLabel placement="edge">Story Swap</HeardTapeLabel>
                <HeardTextField
                  label="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  error={errors.subject}
                  maxLength={200}
                />
                <HeardTextArea
                  label="Your story"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  error={errors.content}
                  maxLength={20000}
                />
                <HeardTextField
                  label="Sign it as"
                  value={signItAs}
                  onChange={(e) => setSignItAs(e.target.value)}
                  help="Your name, Anonymous, or something else."
                  error={errors.signItAs}
                  maxLength={200}
                />
                <HeardTextField
                  label="Your email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  help="For delivery and moderation only. It is never shared with the person who receives your story."
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

export default HeardStorySwap;
