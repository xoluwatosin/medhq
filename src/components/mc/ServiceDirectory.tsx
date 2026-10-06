import { Link } from "react-router-dom";
import { SectionHead } from "@/components/mc/service-sections";
import type { DirectoryGroup } from "@/content/seo/site-directory";

/** Every page in the chosen groups, as plain grouped links on a hub page. */
const ServiceDirectory = ({
  id,
  eyebrow,
  title,
  intro,
  groups,
  exclude,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  groups: DirectoryGroup[];
  exclude?: string;
}) => (
  <section aria-labelledby={id} className="mt-20 lg:mt-28">
    <SectionHead id={id} eyebrow={eyebrow} title={title} intro={intro} />
    <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <nav key={g.key} aria-label={g.title} className="border-2 border-navy bg-white p-5 sm:p-6">
          <h3 className="text-[19px] leading-[1.15] tracking-[-0.03em]">{g.title}</h3>
          <ul className="mt-3 divide-y divide-navy/10">
            {g.links
              .filter((l) => l.path !== exclude)
              .map((l) => (
                <li key={l.path}>
                  <Link
                    to={l.path}
                    className="group flex min-h-[44px] items-center justify-between gap-3 py-2 text-[15px] font-bold text-navy transition-colors hover:text-brand"
                  >
                    {l.label}
                    <span aria-hidden="true" className="text-brand transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      ))}
    </div>
  </section>
);

export default ServiceDirectory;
