import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title="Page not found | Medic Connect" description="The page you're looking for doesn't exist." path={location.pathname} noindex />
      <MedicHeader />

      
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center animate-slide-up max-w-2xl mx-auto">
          <div className="kit-curve-lg bg-card p-12 md:p-16 shadow-lg">
            <h1 className="mb-6 text-6xl md:text-7xl font-bold text-primary">404</h1>
            <p className="mb-8 text-2xl md:text-3xl font-serif">Page not found</p>
            <p className="mb-10 text-lg text-muted-foreground leading-relaxed">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <a 
              href="/" 
              className="inline-block px-10 py-4 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 hover:scale-105 transition-all"
            >
              Return to Home
            </a>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default NotFound;
