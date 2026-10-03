import HeardPage from "@/components/heard/v2/HeardLayout";
import { HeardDivider } from "@/components/heard/v2/HeardKit";

const SECTIONS = [
  {
    title: "Story Swap",
    body: "Your email is used to send your swap. It is never shown with your story.",
  },
  {
    title: "Letters",
    body: "Your email is used for moderation and, where relevant, delivery. It is never shown publicly with your letter.",
  },
  {
    title: "Write to us",
    body: "Your message is sent to Heard and is not published.",
  },
  {
    title: "Phone notifications",
    body: "We'll use your email only to let you know when the phone lines open.",
  },
];

export const HeardPrivacy = () => (
  <HeardPage path="/privacy" title="Privacy — Heard" description="What Heard does with what you send.">
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <h1>What we do with what you send.</h1>
      </header>

      <div className="flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h3>{section.title}</h3>
            <p className="text-[16px] text-[color:var(--hv-violet)]">{section.body}</p>
          </section>
        ))}
      </div>

      <HeardDivider variant="bar" />

      {/* TODO: the full Heard legal privacy notice (lawful basis, retention periods,
          data-subject rights, controller details, complaints route) is still to be
          drafted and approved. Only the product explanations above are published. */}
      <p className="text-[14px] text-[color:var(--hv-mute)]">
        The full Heard privacy notice is being prepared. Until it is published, this page explains only what each
        part of Heard does with your email and what you write.
      </p>
    </div>
  </HeardPage>
);

export default HeardPrivacy;
