import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SUPER_ADMIN_ID } from "@/lib/admin-utils";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: string[];
  requiresBlogApproval: boolean;
  requiresCampaignApproval: boolean;
  adminDisplayName: string;
  isAdminActive: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  forceSignOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  isSuperAdmin: false,
  permissions: [],
  requiresBlogApproval: false,
  requiresCampaignApproval: false,
  adminDisplayName: "",
  isAdminActive: true,
  loading: true,
  signOut: async () => {},
  forceSignOut: async () => {},
});


export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [requiresBlogApproval, setRequiresBlogApproval] = useState(false);
  const [requiresCampaignApproval, setRequiresCampaignApproval] = useState(false);
  const [adminDisplayName, setAdminDisplayName] = useState("");
  const [isAdminActive, setIsAdminActive] = useState(true);
  const [loading, setLoading] = useState(true);

  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const admin = !!data;
    setIsAdmin(admin);
    setIsSuperAdmin(userId === SUPER_ADMIN_ID);

    if (admin) {
      // Fetch permissions
      const { data: permData } = await (supabase as any)
        .from("admin_permissions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (permData) {
        setPermissions(permData.permissions || []);
        setRequiresBlogApproval(permData.requires_blog_approval ?? false);
        setRequiresCampaignApproval(permData.requires_campaign_approval ?? false);
        setAdminDisplayName(permData.display_name || "");
        setIsAdminActive(permData.is_active ?? true);
      } else if (userId === SUPER_ADMIN_ID) {
        // Super admin always has full access even without a permissions row
        setPermissions(["dashboard","blog","campaigns","email_templates","enquiries","applications","creator_applications","audience","archives","settings","matchmakers","invoices"]);
        setRequiresBlogApproval(false);
        setRequiresCampaignApproval(false);
        setIsAdminActive(true);
      }
    }
  };



  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => checkAdminRole(session.user.id), 0);
        } else {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setPermissions([]);
          setRequiresBlogApproval(false);
          setRequiresCampaignApproval(false);
          setAdminDisplayName("");
          setIsAdminActive(true);
        }
      }
    );

    /** Clear only a provably malformed local session. Temporary backend or
     * network failures must never sign a valid user out.
     */
    const discardBrokenSession = async () => {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        /* nothing left to clear */
      }
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-")) localStorage.removeItem(key);
      });
    };

    const tokenHasSubject = (accessToken: string) => {
      try {
        const payloadPart = accessToken.split(".")[1];
        if (!payloadPart) return false;
        const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(normalized)) as { sub?: unknown };
        return typeof payload.sub === "string" && payload.sub.length > 0;
      } catch {
        return false;
      }
    };

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (session && !tokenHasSubject(session.access_token)) {
          await discardBrokenSession();
          if (!isMounted) return;
          setSession(null);
          setUser(null);
          return;
        }
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkAdminRole(session.user.id);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };


    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const resetAuthState = () => {
    // Let the next sign in this tab be recorded in login history.
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith("admin_login_logged_")) sessionStorage.removeItem(key);
    });
    setSession(null);

    setUser(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setPermissions([]);
    setRequiresBlogApproval(false);
    setRequiresCampaignApproval(false);
    setAdminDisplayName("");
    setIsAdminActive(true);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    resetAuthState();
  };

  const forceSignOut = async () => {
    await supabase.auth.signOut();
    // Clear all Supabase-related keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-")) {
        localStorage.removeItem(key);
      }
    });
    resetAuthState();
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, isSuperAdmin, permissions, requiresBlogApproval, requiresCampaignApproval, adminDisplayName, isAdminActive, loading, signOut, forceSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};
