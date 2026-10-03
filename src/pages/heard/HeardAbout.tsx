import HeardPage from "@/components/heard/v2/HeardLayout";
import { HeardDivider, HeardRevealStatement } from "@/components/heard/v2/HeardKit";

export const HeardAbout = () => (
  <HeardPage path="/about" title="About Heard" description="Heard is somewhere to be heard.">
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <h1>Heard is somewhere to be heard.</h1>
        <p className="text-[17px] text-[color:var(--hv-violet)]">
          Sometimes it's easier to talk to someone who doesn't know you.
        </p>
        <p className="text-[17px] text-[color:var(--hv-violet)]">
          Heard gives you a few ways to do that. You can write to us, exchange a story with someone else, leave a
          letter for a stranger, or speak to a Listener.
        </p>
        <p className="text-[17px] text-[color:var(--hv-violet)]">
          It can be something serious. Something small. Something you have been thinking about for weeks. Something
          that happened five minutes ago.
        </p>
        <p className="text-[17px] text-[color:var(--hv-violet)]">You don't need to call it anything.</p>
        <p className="text-[17px] text-[color:var(--hv-violet)]">
          Heard is a peer-support and listening service by Medic Connect.
        </p>
        <p className="text-[17px] text-[color:var(--hv-violet)]">It is not therapy or an emergency service.</p>
      </section>

      <HeardDivider variant="mark" />

      <section className="flex flex-col gap-5">
        <h2>Sometimes, not knowing helps.</h2>
        <HeardRevealStatement lines={["They don't know your history.", "They don't know the people in your life.", "They don't already have a version of you in their head."]} />
        <p className="text-[17px] text-[color:var(--hv-violet)]">Here, you can simply be you.</p>
      </section>
    </div>
  </HeardPage>
);

export default HeardAbout;
