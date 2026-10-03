import HeardPage from "@/components/heard/v2/HeardLayout";
import { HeardPullLine, HeardSafetyBox } from "@/components/heard/v2/HeardKit";

export const HeardSupport = () => (
  <HeardPage
    path="/support"
    title="Support — Heard"
    description="Heard is not an emergency service."
  >
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        <h1>If you need more than a conversation.</h1>
        <p className="text-[17px] text-[color:var(--hv-violet)]"><HeardPullLine>Heard is not an emergency service.</HeardPullLine></p>
        <p className="text-[17px] text-[color:var(--hv-violet)]">
          If you or someone else is in immediate danger, contact your local emergency service.
        </p>
        <p className="text-[17px] text-[color:var(--hv-violet)]">
          If you need ongoing or specialist support, we can point you towards places that may be able to help.
        </p>
      </header>

      <HeardSafetyBox title="If tonight is urgent">
        <p>Contact your local emergency service.</p>
        {/* Verified service listings are pending sign-off before launch. */}
        <p className="text-[color:var(--hv-mute)]">
          Specialist and ongoing support listings are being verified before launch.
        </p>
      </HeardSafetyBox>
    </div>
  </HeardPage>
);

export default HeardSupport;
