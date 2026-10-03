import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isAdminActive, loading } = useAuth();

  // Record an admin login once per browser session, whichever door they used
  // (staff sign-in, candidate portal, or an already-active session).
  useEffect(() => {
    if (!loading && user && isAdmin && isAdminActive) {
      const flag = `admin_login_logged_${user.id}`;
      if (!sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, "1");
        void (supabase as any)
          .from("admin_login_log")
          .insert({ user_id: user.id, email: user.email ?? "" })
          .then(({ error }: { error: unknown }) => {
            // A failed write must not silently swallow the next sign in.
            if (error) sessionStorage.removeItem(flag);
          });
      }
    }
  }, [loading, user, isAdmin, isAdminActive]);


  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-serif font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You do not have admin privileges.</p>
          <a href="/" className="text-primary underline">Return to Home</a>
        </div>
      </div>
    );
  }

  if (!isAdminActive) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-serif font-bold">Access Revoked</h1>
          <p className="text-muted-foreground">Your admin access has been revoked. Contact the super admin.</p>
          <a href="/" className="text-primary underline">Return to Home</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
