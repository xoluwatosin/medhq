import { useHeardPath } from "@/components/heard/HeardBase";
import HeardPage from "@/components/heard/v2/HeardLayout";
import { HeardLinkButton, HeardPinnedNote, HeardPostmark, HeardPullLine, HeardTapeLabel } from "@/components/heard/v2/HeardKit";

const ROLES = [
  {
    title: "Peer Listener",
    heading: "Be the one that picks up.",
    body: "Listen to people who call Heard.",
    note: "You don’t need a degree or previous listening experience. We’ll train you before you take a call.",
    action: "Apply as a Peer Listener",
    role: "peer_listener",
    tapeTone: "sky" as const,
  },
  {
    title: "Social Media Volunteer",
    heading: "Help people find us.",
    body: "Write, design, create and help Heard reach more people.",
    action: "Apply as a Social Media Volunteer",
    role: "social_media_volunteer",
    tapeTone: "late" as const,
  },
  {
    title: "Counsellor, psychologist or clinician",
    heading: "Help us keep Heard safe.",
    body: "Listen directly, support the people behind the line, or help us make good referrals when someone needs more.",
    action: "Join as a professional",
    role: "professional",
    tapeTone: "sky" as const,
  },
];

export const HeardGetInvolved = () => {
  const heardPath = useHeardPath();
  return (
    <HeardPage path="/get-involved" title="Get involved — Heard" description="There’s more than one way to be part of Heard." width="wide">
      <div className="flex flex-col gap-12 sm:gap-16">
        <header className="max-w-[760px] flex flex-col gap-5">
          <span className="hv-index">Heard · Get involved</span>
          <h1>Get involved</h1>
          <p className="text-[20px] font-extrabold text-[color:var(--hv-late)]"><HeardPullLine>There’s more than one way to be part of Heard.</HeardPullLine></p>
          <p className="text-[17px] text-[color:var(--hv-violet)]">Whether you want to listen, create, or bring professional experience, there’s a place for you here.</p>
        </header>
        <div className="hv-volunteer-grid">
          {ROLES.map((role, index) => (
            <article key={role.role} className="hv-volunteer-wrap" data-card={index + 1}>
              {index === 0 && <HeardTapeLabel tone={role.tapeTone}>{role.title}</HeardTapeLabel>}
              {index === 1 && <span className="hv-volunteer-pin" aria-hidden="true" />}
              <div className="hv-volunteer-card">
                <div className="hv-volunteer-meta">
                  <span className="hv-volunteer-number" aria-hidden="true">0{index + 1}</span>
                  {index !== 0 && <span className="hv-volunteer-role">{role.title}</span>}
                  {index === 2 && <HeardPostmark place="Heard volunteer" />}
                </div>
              <div className="hv-volunteer-copy">
                <h2 className="text-[28px]">{role.heading}</h2>
                <p>{role.body}</p>
                {role.note && (
                  <HeardPinnedNote>
                    <p>{role.note}</p>
                  </HeardPinnedNote>
                )}
              </div>
              <div className="hv-volunteer-action">
                <HeardLinkButton to={`${heardPath("/volunteer/create-account")}?role=${role.role}`}>{role.action}</HeardLinkButton>
              </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </HeardPage>
  );
};

export default HeardGetInvolved;