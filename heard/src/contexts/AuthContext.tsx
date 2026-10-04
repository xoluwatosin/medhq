import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Session state for Heard. Volunteers and admins share one sign-in; admin
 * rights come from the caller's own row in heard_admins (readable by that
 * user only). The database enforces every permission; this is display only.
 */
interface AuthContextType {
  session: Session | null;
  user: User | null;
  /** Heard admin permission keys, e.g. "heard_volunteers_manage". Empty for volunteers. */
  permissions: string[];
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  permissions: [],
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPermissions = async (userId: string) => {
    const { data } = await supabase
      .from("heard_admins")
      .select("permissions")
      .eq("user_id", userId)
      .maybeSingle();
    setPermissions(data?.permissions ?? []);
  };

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!isMounted) return;
      setSession(next);
      if (next?.user) setTimeout(() => loadPermissions(next.user.id), 0);
      else setPermissions([]);
    });

    supabase.auth.getSession()
      .then(async ({ data: { session: current } }) => {
        if (!isMounted) return;
        setSession(current);
        if (current?.user) await loadPermissions(current.user.id);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setPermissions([]);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        permissions,
        isAdmin: permissions.length > 0,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
