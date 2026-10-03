import { useNavigate, useParams } from "react-router-dom";
import ConsolePageHeader from "@/components/admin/console/ConsolePageHeader";
import ConsoleTabs from "@/components/admin/console/ConsoleTabs";
import SeoPagesRegister from "@/components/admin/seo/SeoPagesRegister";
import SeoModulesRegister from "@/components/admin/seo/SeoModulesRegister";
import SeoClaimsRegister from "@/components/admin/seo/SeoClaimsRegister";
import SeoMarketsRegister from "@/components/admin/seo/SeoMarketsRegister";

const SECTIONS = [
  { id: "pages", label: "Pages" },
  { id: "modules", label: "Modules" },
  { id: "claims", label: "Claims" },
  { id: "markets", label: "Markets" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const Seo = () => {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const active = (SECTIONS.find((item) => item.id === section)?.id ?? "pages") as SectionId;

  return (
    <section className="mx-auto w-full max-w-[1120px]" aria-labelledby="seo-heading">
      <ConsolePageHeader
        id="seo-heading"
        title="SEO"
        description="Governed pages, canonical modules, public claims and markets. Operational truth stays in services, fees and the Bridge."
      />
      <ConsoleTabs
        tabs={SECTIONS}
        active={active}
        onChange={(id) => navigate(`/admin/seo/${id}`)}
        label="SEO registers"
        controls="seo-register"
      />
      <div id="seo-register">
        {active === "pages" && <SeoPagesRegister />}
        {active === "modules" && <SeoModulesRegister />}
        {active === "claims" && <SeoClaimsRegister />}
        {active === "markets" && <SeoMarketsRegister />}
      </div>
    </section>
  );
};

export default Seo;
