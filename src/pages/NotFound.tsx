import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { art } from "@/components/mc/art";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title="Page not found | Medic Connect" description="The page you're looking for doesn't exist." path={location.pathname} noindex />
      <MedicHeader />

      {/* The lost nurse with her map: the visitor is lost too, so the page smiles about it. */}
      <main className="mx-auto flex max-w-[1100px] flex-col items-center gap-8 px-[22px] py-14 sm:px-[50px] lg:flex-row lg:gap-16 lg:py-24">
        <div className="relative w-[220px] shrink-0 bg-tint pt-6 shadow-offset sm:w-[280px]">
          <img src={art.nurseStreetMap} alt="" className="mx-auto h-[220px] object-contain sm:h-[280px]" />
        </div>
        <div className="text-center lg:text-left">
          <p className="eyebrow">Error 404</p>
          <h1 className="mt-3 text-[40px] leading-[1] tracking-[-0.05em] sm:text-[56px]">This page took a wrong turn.</h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-[1.6] text-body">
            The page you are looking for does not exist or has moved. Our map points home.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-control bg-brand px-7 text-[16px] font-extrabold text-white shadow-offset-sm transition-colors duration-200 hover:bg-navy"
          >
            Back to the home page <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NotFound;
