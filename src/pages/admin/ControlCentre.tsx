// Admin access: who can reach the Admin Centre, which areas they hold, and a
// record of every change. The area list is derived from the navigation model,
// so it can never fall behind the Admin itself.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, KeyRound, ShieldOff, ShieldCheck, ChevronDown, Clock, Mail, LogOut, History } from "lucide-react";
import { format } from "date-fns";
import { adminDb, SUPER_ADMIN_ID } from "@/lib/admin-utils";
import AccessAreas from "@/components/admin/AccessAreas";
import { ACCESS_DELEGATE_PERMISSION, namedAreas } from "@/lib/admin-access";
import { MuEmpty, MuPage, MuPageHeader, MuSection, MuStatus, MuTone } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { cn } from "@/lib/utils";

const CAPS = "text-[11px] font-bold uppercase tracking-[0.14em] text-label";

const STATE_TONE: Record<string, MuTone> = { Active: "good", Invited: "info", Withdrawn: "bad" };

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  permissions: string[];
  requires_blog_approval: boolean;
  requires_campaign_approval: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LoginLog {
  id: string;
  email: string;
  logged_in_at: string;
}

interface AccessLog {
  id: string;
  actor_email: string | null;
  action: string;
  created_at: string;
  permissions_after: string[] | null;
}

const ACTION_LABELS: Record<string, string> = {
  invited: "Invitation sent",
  granted_existing_account: "Access granted to an existing sign-in",
  areas_changed: "Areas changed",
  withdrawn: "Access withdrawn",
  restored: "Access restored",
  approval_changed: "Approval requirement changed",
};

const ControlCentre = () => {
  const { user, isSuperAdmin, permissions: myPermissions } = useAuth();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePerms, setInvitePerms] = useState<string[]>(["dashboard"]);
  const [inviteBlogApproval, setInviteBlogApproval] = useState(true);
  const [inviteCampaignApproval, setInviteCampaignApproval] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [loginLogs, setLoginLogs] = useState<Record<string, LoginLog[]>>({});
  const [signedIn, setSignedIn] = useState<Set<string>>(new Set());

  const [accessLogs, setAccessLogs] = useState<Record<string, AccessLog[]>>({});
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resettingPw, setResettingPw] = useState<string | null>(null);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const [forcingSignout, setForcingSignout] = useState<string | null>(null);

  const lockedKeys = isSuperAdmin ? [] : [ACCESS_DELEGATE_PERMISSION];
  const canManage = isSuperAdmin || myPermissions.includes(ACCESS_DELEGATE_PERMISSION);

  const fetchAdmins = async () => {
    const { data, error } = await adminDb()
      .from("admin_permissions")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Could not load admins", description: error.message, variant: "destructive" });
    } else {
      setAdmins(data || []);
    }
    setLoading(false);
  };

  // Whether each admin has ever signed in, so the account state on the list is
  // correct before any history section is opened.
  const fetchSignedIn = async () => {
    const { data } = await adminDb().from("admin_login_log").select("user_id");
    setSignedIn(new Set((data || []).map((row) => (row as { user_id: string }).user_id)));
  };

  useEffect(() => { fetchAdmins(); fetchSignedIn(); }, []);


  const fetchHistory = async (userId: string) => {
    if (!loginLogs[userId]) {
      const { data } = await adminDb()
        .from("admin_login_log")
        .select("*")
        .eq("user_id", userId)
        .order("logged_in_at", { ascending: false })
        .limit(20);
      setLoginLogs((prev) => ({ ...prev, [userId]: data || [] }));
    }
    if (!accessLogs[userId]) {
      const { data } = await adminDb()
        .from("admin_access_log")
        .select("id, actor_email, action, created_at, permissions_after")
        .eq("target_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      setAccessLogs((prev) => ({ ...prev, [userId]: (data as AccessLog[]) || [] }));
    }
  };

  const recordChange = async (target: AdminUser, action: string, before: string[], after: string[]) => {
    if (!user) return;
    await adminDb().from("admin_access_log").insert({
      actor_user_id: user.id,
      actor_email: user.email ?? "",
      target_user_id: target.user_id,
      target_email: target.email,
      action,
      permissions_before: before,
      permissions_after: after,
    });
    setAccessLogs((prev) => {
      const next = { ...prev };
      delete next[target.user_id];
      return next;
    });
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-admin", {
        body: {
          email: inviteEmail.trim(),
          displayName: inviteName.trim() || inviteEmail.trim(),
          permissions: invitePerms,
          requiresBlogApproval: inviteBlogApproval,
          requiresCampaignApproval: inviteCampaignApproval,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast(
        data?.granted
          ? { title: "Access granted", description: `${inviteEmail} can sign in with the account they already have.` }
          : { title: "Invitation sent", description: `${inviteEmail} will receive an email to set a password.` },
      );
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInvitePerms(["dashboard"]);
      setInviteBlogApproval(true);
      setInviteCampaignApproval(true);
      fetchAdmins();
    } catch (err: any) {
      toast({ title: "Could not grant access", description: err.message, variant: "destructive" });
    }
    setInviting(false);
  };

  const updateAdmin = async (adminUser: AdminUser, field: string, value: any, action: string) => {
    const before: string[] = adminUser.permissions || [];
    const { error } = await adminDb()
      .from("admin_permissions")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", adminUser.id);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return false;
    }
    const updated = { ...adminUser, [field]: value } as AdminUser;
    setAdmins((prev) => prev.map((a) => (a.id === adminUser.id ? updated : a)));
    if (editing?.id === adminUser.id) setEditing(updated);
    await recordChange(adminUser, action, before, updated.permissions || []);
    toast({ title: "Changes saved" });
    return true;
  };

  const handlePasswordReset = async (userId: string) => {
    setResettingPw(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-password-reset", { body: { userId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Password reset email sent" });
    } catch (err: any) {
      toast({ title: "Could not send the reset email", description: err.message, variant: "destructive" });
    }
    setResettingPw(null);
  };

  const handleResendInvite = async (adminUser: AdminUser) => {
    setResendingInvite(adminUser.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("invite-admin", {
        body: { email: adminUser.email, displayName: adminUser.display_name, resend: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Invitation resent", description: `A new invitation has been sent to ${adminUser.email}.` });
    } catch (err: any) {
      toast({ title: "Could not resend the invitation", description: err.message, variant: "destructive" });
    }
    setResendingInvite(null);
  };

  const handleForceSignout = async (adminUser: AdminUser) => {
    setForcingSignout(adminUser.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("force-signout-admin", {
        body: { userId: adminUser.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Signed out on every device", description: adminUser.display_name || adminUser.email });
    } catch (err: any) {
      toast({ title: "Could not sign them out", description: err.message, variant: "destructive" });
    }
    setForcingSignout(null);
  };

  const accountState = (adminUser: AdminUser) => {
    if (!adminUser.is_active) return "Withdrawn";
    const hasSignedIn = signedIn.has(adminUser.user_id) || (loginLogs[adminUser.user_id]?.length ?? 0) > 0;
    return hasSignedIn ? "Active" : "Invited";
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <MuPage>
      <MuPageHeader
        title="People and access"
        description="Who can reach the Admin Centre, and which areas each person holds."
        actions={canManage ? (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add admin</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add admin</DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@medicconnect.co"
                    type="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-2">
                  <Label>Areas</Label>
                  <AccessAreas value={invitePerms} onChange={setInvitePerms} lockedKeys={lockedKeys} />
                </div>
                <div className="space-y-3 border-t pt-3">
                  <Label className="text-sm font-medium">Approval requirements</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Blog posts need approval</span>
                    <Switch checked={inviteBlogApproval} onCheckedChange={setInviteBlogApproval} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Campaigns need approval</span>
                    <Switch checked={inviteCampaignApproval} onCheckedChange={setInviteCampaignApproval} />
                  </div>
                </div>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="w-full">
                  {inviting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Working</> : "Grant access"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      <div className="space-y-4">
        {admins.length === 0 && (
          <MuSection padded={false}>
            <MuEmpty art={art.objPadlock} title="No admins yet" description="People you add here can sign in to the Admin Centre." />
          </MuSection>
        )}
        {admins.map((admin) => {
          const isSuper = admin.user_id === SUPER_ADMIN_ID;
          const isSelf = admin.user_id === user?.id;
          const editable = canManage && !isSuper && !isSelf;
          const isExpanded = expandedAdmin === admin.id;
          const areas = namedAreas(admin.permissions);
          return (
            <section key={admin.id} className={cn("border border-line bg-card", !admin.is_active && "opacity-60")}>
              <div className="border-b border-line-soft px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-navy">{admin.display_name || admin.email}</h2>
                    <p className="truncate text-sm text-muted-foreground">{admin.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isSuper && <MuStatus label="Super admin" tone="info" />}
                      <MuStatus label={accountState(admin)} tone={STATE_TONE[accountState(admin)]} />
                      {admin.permissions?.includes(ACCESS_DELEGATE_PERMISSION) && (
                        <MuStatus label="Manages access" tone="neutral" />
                      )}
                    </div>
                  </div>
                  {editable && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(admin)}>Edit areas</Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendInvite(admin)}
                        disabled={resendingInvite === admin.user_id}
                      >
                        {resendingInvite === admin.user_id
                          ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          : <Mail className="mr-1 h-3 w-3" />}
                        Resend invitation
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={forcingSignout === admin.user_id}>
                            {forcingSignout === admin.user_id
                              ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              : <LogOut className="mr-1 h-3 w-3" />}
                            Sign out everywhere
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Sign this person out everywhere?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {admin.display_name || admin.email} will be signed out on every device and will need to sign in again.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleForceSignout(admin)}>Sign out</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePasswordReset(admin.user_id)}
                        disabled={resettingPw === admin.user_id}
                      >
                        {resettingPw === admin.user_id
                          ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          : <KeyRound className="mr-1 h-3 w-3" />}
                        Reset password
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant={admin.is_active ? "destructive" : "default"} size="sm">
                            {admin.is_active
                              ? <><ShieldOff className="mr-1 h-3 w-3" />Withdraw access</>
                              : <><ShieldCheck className="mr-1 h-3 w-3" />Restore access</>}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {admin.is_active ? "Withdraw admin access?" : "Restore admin access?"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {admin.is_active
                                ? `${admin.display_name || admin.email} will lose access to the Admin Centre immediately. Their sign-in stays, so access can be restored later without a new invitation.`
                                : `${admin.display_name || admin.email} will reach the Admin Centre again with the areas they already hold.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                updateAdmin(admin, "is_active", !admin.is_active, admin.is_active ? "withdrawn" : "restored")
                              }
                            >
                              {admin.is_active ? "Withdraw access" : "Restore access"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <p className={`mb-2 ${CAPS}`}>Areas</p>
                  {isSuper ? (
                    <p className="text-sm text-muted-foreground">Every area</p>
                  ) : areas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No areas yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {areas.map((label) => (
                        <MuStatus key={label} label={label} tone="neutral" />
                      ))}
                    </div>
                  )}
                </div>

                {!isSuper && (
                  <div className="border-2 border-navy bg-tint/40 p-3">
                  <p className={`mb-2 ${CAPS}`}>Approvals</p>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={admin.requires_blog_approval}
                        disabled={!editable}
                        onCheckedChange={(v) => updateAdmin(admin, "requires_blog_approval", v, "approval_changed")}
                      />
                      <span className="text-sm">Blog posts need approval</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={admin.requires_campaign_approval}
                        disabled={!editable}
                        onCheckedChange={(v) => updateAdmin(admin, "requires_campaign_approval", v, "approval_changed")}
                      />
                      <span className="text-sm">Campaigns need approval</span>
                    </div>
                  </div>
                  </div>
                )}

                <Collapsible
                  open={isExpanded}
                  onOpenChange={(open) => {
                    setExpandedAdmin(open ? admin.id : null);
                    if (open) fetchHistory(admin.user_id);
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      <History className="mr-1 h-3 w-3" />
                      History
                      <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className={`mb-1 ${CAPS}`}>Access changes</p>
                      {(accessLogs[admin.user_id] || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No recorded changes</p>
                      ) : (
                        <div className="max-h-48 space-y-1 overflow-y-auto">
                          {(accessLogs[admin.user_id] || []).map((log) => (
                            <div key={log.id} className="text-sm text-muted-foreground">
                              {ACTION_LABELS[log.action] || log.action}
                              {log.actor_email ? ` by ${log.actor_email}` : ""}
                              {", "}
                              {format(new Date(log.created_at), "dd MMM yyyy, HH:mm")}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className={`mb-1 ${CAPS}`}>Sign-ins</p>
                      {(loginLogs[admin.user_id] || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No sign-ins recorded</p>
                      ) : (
                        <div className="max-h-48 space-y-1 overflow-y-auto">
                          {(loginLogs[admin.user_id] || []).map((log) => (
                            <div key={log.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(log.logged_in_at), "dd MMM yyyy, HH:mm")}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </section>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.display_name || editing?.email}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <AccessAreas
                value={editing.permissions || []}
                lockedKeys={lockedKeys}
                onChange={(next) => setEditing({ ...editing, permissions: next })}
              />
              <Button
                className="w-full"
                onClick={async () => {
                  const current = admins.find((a) => a.id === editing.id);
                  if (!current) return;
                  const ok = await updateAdmin(current, "permissions", editing.permissions || [], "areas_changed");
                  if (ok) setEditing(null);
                }}
              >
                Save changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MuPage>
  );
};

export default ControlCentre;
