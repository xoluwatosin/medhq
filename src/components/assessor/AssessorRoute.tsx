// An assessment visit is clinical work. Only a signed-in professional reaches
// it, and being signed in is read from the session already on the device, so a
// visit still opens in a house with no signal.
//
// This is also the single owner of the assessor top safe area and browser
// canvas. Assessor pages never repeat that handling themselves.
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** The shared assessor surface paints the complete viewport, including iPhone safe areas. */
export const AssessorShell = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className="min-h-dvh w-full bg-background pt-[env(safe-area-inset-top)]">
    <main className={`min-h-dvh w-full bg-background ${className}`}>{children}</main>
  </div>
);

const AssessorRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <AssessorShell className="px-4 pb-10 pt-10">
        <p className="text-center text-[15px] text-body">Loading</p>
      </AssessorShell>
    );
  }

  if (!session) {
    return (
      <AssessorShell className="px-4 pb-10 pt-10">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">Sign in to see your visits</h1>
          <p className="mt-2 text-[15px] text-body">
            Assessment visits are only open to the professional carrying them out.
          </p>
          <Link className="mt-4 inline-block font-bold text-navy underline" to="/portal/login">Sign in</Link>
        </div>
      </AssessorShell>
    );
  }

  return <>{children}</>;
};

export default AssessorRoute;
