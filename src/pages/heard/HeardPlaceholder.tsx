import { ReactNode } from "react";
import { useHeardPath } from "@/components/heard/HeardBase";
import HeardPage from "@/components/heard/v2/HeardLayout";
import { HeardLinkButton, HeardRevealStatement } from "@/components/heard/v2/HeardKit";

/**
 * A plain Heard page shell. Foundation work only: the headings mark out the
 * route, the finished copy and the forms come later. Everything stays inside
 * .heard-scope, so no Medic Connect Care or clinical styling reaches Heard.
 */
export const HeardPlaceholder = ({
  path,
  title,
  eyebrow,
  heading,
  intro,
  children,
}: {
  path: string;
  title: string;
  eyebrow?: string;
  heading: string;
  intro?: string;
  children?: ReactNode;
}) => {
  const heardPath = useHeardPath();
  return (
    <HeardPage path={path} title={title} description={intro ?? heading}>
      <section className="flex flex-col gap-7">
        {eyebrow && <p className="hv-index">{eyebrow}</p>}
        <HeardRevealStatement lines={[heading, ...(intro ? [intro] : [])]} asPageHeading />
        {children}
        <div><HeardLinkButton to={heardPath("/")}>Back to Heard</HeardLinkButton></div>
      </section>
    </HeardPage>
  );
};

export default HeardPlaceholder;
