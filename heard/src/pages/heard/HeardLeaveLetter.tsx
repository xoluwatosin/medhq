import { useState } from "react";
import { useHeardPath } from "@/components/heard/HeardBase";
import HeardPage from "@/components/heard/v2/HeardLayout";
import {
  HeardButton,
  HeardCheckbox,
  HeardDivider,
  HeardLetterPaper,
  HeardLinkButton,
  HeardNotice,
  HeardStackFrame,
  HeardSteps,
  HeardTextArea,
  HeardTextField,
  HeardWatermark,
} from "@/components/heard/v2/HeardKit";

import HeardSecretSignup from "@/components/heard/v2/HeardSecretSignup";
import { HEARD_CONSENT_VERSION, HEARD_ERRORS, heardSubmit, isEmail } from "@/components/heard/v2/heardSubmit";

type Stage = "write" | "preview" | "left";

export const HeardLeaveLetter = () => {
  const heardPath = useHeardPath();
  const [stage, setStage] = useState<Stage>("write");
  const [heading, setHeading] = useState("");
  const [content, setContent] = useState("");
  const [signItAs, setSignItAs] = useState("");
  const [email, setEmail] = useState("");
  const [consentUse, setConsentUse] = useState(false);
  const [consentReceive, setConsentReceive] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);

  const onPreview = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!content.trim()) next.content = HEARD_ERRORS.required;
    if (!signItAs.trim()) next.signItAs = HEARD_ERRORS.required;
    if (!isEmail(email)) next.email = email.trim() ? HEARD_ERRORS.email : HEARD_ERRORS.required;
    if (!consentUse) next.consentUse = HEARD_ERRORS.required;
    setErrors(next);
    if (Object.keys(next).length) return;
    setStage("preview");
    window.scrollTo({ top: 0 });
  };

  const onLeave = async () => {
    setFailed(false);
    setSending(true);
    try {
      await heardSubmit({
        kind: "letter",
        heading: heading.trim() || undefined,
        content: content.trim(),
        signItAs: signItAs.trim(),
        email: email.trim(),
        consentVersion: HEARD_CONSENT_VERSION,
      });
      // The optional consent is a separate record, submitted separately.
      if (consentReceive) {
        try {
          await heardSubmit({
            kind: "letter_subscribe",
            email: email.trim(),
            consentVersion: HEARD_CONSENT_VERSION,
          });
        } catch (err) {
          console.error("letter opt-in:", err);
        }
      }
      setStage("left");
      window.scrollTo({ top: 0 });
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const stageIndex = stage === "write" ? 0 : stage === "preview" ? 1 : 2;

  return (
    <HeardPage
      path="/letters/leave"
      title="Leave a letter — Heard"
      description="Leave something for someone you don't know."
      width="wide"
    >
      <div className="pb-10">
        <HeardSteps steps={["Write", "Preview", "Left"]} current={stageIndex} />
      </div>

      {stage === "left" && (
        <div className="flex flex-col gap-12">
          <div className="relative overflow-hidden bg-[color:var(--hv-sky)] px-6 py-16 sm:px-14 sm:py-20">
            <HeardWatermark fill="#FFFFFF" />
            <div className="relative flex flex-col gap-5 max-w-[620px]">
              <span className="hv-index">Left</span>
              <h1>Left.</h1>
              <p className="text-[17px] text-[color:var(--hv-late)]">
                It is read before it goes anywhere. Somebody you will never meet may read it next.
              </p>
              <div className="pt-2">
                <HeardLinkButton to={heardPath("/letters")}>Back to the Letter Room</HeardLinkButton>
              </div>
            </div>
          </div>
          {!consentReceive && <HeardSecretSignup />}
        </div>
      )}

      {stage === "preview" && (
        <div className="flex flex-col gap-8 max-w-[760px]">
          <h1>Before you leave it.</h1>
          <HeardLetterPaper
            marker="Your letter"
            heading={heading.trim() || null}
            body={content.trim()}
            signature={signItAs.trim()}
            stacked={false}
            edgeLabel="Preview"
          />
          {failed && (
            <HeardNotice tone="problem" title={HEARD_ERRORS.letter}>
              Nothing is lost. Try again when you are ready.
            </HeardNotice>
          )}
          <div className="flex flex-wrap gap-4">
            <HeardButton type="button" tone="pill" onClick={() => setStage("write")} disabled={sending}>
              Edit
            </HeardButton>
            <HeardButton type="button" onClick={onLeave} disabled={sending}>
              {sending ? "Submitting…" : "Leave my letter"}
            </HeardButton>
          </div>
        </div>
      )}

      {stage === "write" && (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-16">
          <header className="flex flex-col gap-5">
            <span className="hv-index">Leave a letter</span>
            <h1>Leave a letter.</h1>
            <p className="text-[17px] text-[color:var(--hv-violet)]">
              Leave something for someone you don't know.
            </p>
            <HeardDivider variant="dotted" />
            <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[14.5px] text-[color:var(--hv-violet)]">
              <li>Every letter is read before it goes anywhere.</li>
              <li>Your email is never published with your letter.</li>
              <li>You can preview it before you leave it.</li>
            </ul>
          </header>

          <HeardStackFrame>

            <form onSubmit={onPreview} noValidate className="flex flex-col gap-6">
              <HeardTextField
                label="Heading"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                help="Optional."
                maxLength={200}
              />
              <div className="flex flex-col gap-2">
                <HeardTextArea
                  label="Your letter"
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
                help="For moderation and contact only. It will never be published with your letter."
                error={errors.email}
                maxLength={255}
              />

              <div className="flex flex-col gap-5 pt-2 border-t border-[color:var(--hv-hair)]">
                <HeardCheckbox checked={consentUse} onChange={setConsentUse} error={errors.consentUse}>
                  I agree to my letter being reviewed before it is published or sent, and I give Heard permission to
                  use it as part of the Letters experience. I've read the{" "}
                  {/* TODO: Heard Terms and Conditions page does not exist yet. Replace this
                      placeholder with the real URL once the legal page is published. */}
                  <a
                    href="#heard-terms-placeholder"
                    className="underline underline-offset-4"
                    onClick={(e) => e.preventDefault()}
                  >
                    Terms and Conditions
                  </a>
                  .
                </HeardCheckbox>

                <HeardCheckbox
                  checked={consentReceive}
                  onChange={setConsentReceive}
                  help="Optional. You can unsubscribe at any time."
                >
                  Yes, send me letters too.
                </HeardCheckbox>
              </div>

              <div>
                <HeardButton type="submit">Preview</HeardButton>
              </div>
            </form>
          </HeardStackFrame>
        </div>
      )}
    </HeardPage>
  );
};

export default HeardLeaveLetter;
