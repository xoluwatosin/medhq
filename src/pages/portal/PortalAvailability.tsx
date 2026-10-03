// Availability. A calendar and the sentence that explains what a blank day means.
import AvailabilityCalendar from "@/components/portal/AvailabilityCalendar";
import CxPortalPage from "@/components/candidate/CxPortalPage";
import { usePortal } from "./usePortal";

const PortalAvailability = () => {
  const p = usePortal();

  return (
    <CxPortalPage
      loading={p.authLoading || p.loading}
      person={p.person}
      nav={p.nav}
      title="Your availability"
      eyebrow="Candidate portal"
      back="/portal"
      intro="Tell us the days you usually work. That is enough for us to put you forward. If some dates are different, you can adjust them below."
    >
      <p className="cx-measure text-[14.5px] leading-relaxed text-body md:hidden">
        A day you leave alone is not a no, it just means we do not know yet.
      </p>
      <AvailabilityCalendar
        personId={p.person?.id}
        lastUpdate={p.person?.last_availability_update}
        onChanged={p.reload}
      />
    </CxPortalPage>
  );
};

export default PortalAvailability;
