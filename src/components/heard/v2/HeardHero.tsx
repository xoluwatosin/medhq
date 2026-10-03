import { Link } from "react-router-dom";
import { useHeardPath } from "@/components/heard/HeardBase";
import HeardMark from "@/components/heard/v2/HeardMark";

/**
 * The official Heard infinity mark with two linked entry points.
 * The mark geometry and colours come from the Heard brand system.
 */
const HeardHeroMark = () => {
  const heardPath = useHeardPath();

  return (
    <div className="hv-hero-mark" aria-label="Choose how to enter Heard">
      <div className="hv-hero-symbol">
        <HeardMark className="h-auto w-full" />
      </div>

      <span className="hv-hero-lead hv-hero-lead-left" aria-hidden="true" />
      <span className="hv-hero-lead hv-hero-lead-right" aria-hidden="true" />

      <Link
        to={heardPath("/write")}
        className="hv-hero-pill hv-hero-pill-left"
      >
        Be heard
      </Link>
      <Link
        to={heardPath("/letters")}
        className="hv-hero-pill hv-hero-pill-right"
      >
        Read a letter
      </Link>
    </div>
  );
};

export default HeardHeroMark;
