import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, UserPlus, Palette } from "lucide-react";
import { adminDb } from "@/lib/admin-utils";

interface Setting {
  id: string;
  key: string;
  value: boolean;
}

const NOTIFICATION_SETTINGS = [
  { key: "notify_contact", label: "Contact Enquiries", description: "Send email when someone submits a contact form", icon: Mail },
  { key: "notify_application", label: "Join Applications", description: "Send email when someone applies to join the network", icon: UserPlus },
  { key: "notify_creator", label: "Creator Applications", description: "Send email when a creator applies to the programme", icon: Palette },
];

const Settings = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await adminDb().from("admin_settings").select("*");
      if (error) toast({ title: "Could not load settings", description: error.message, variant: "destructive" });
      setSettings(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const toggleSetting = async (key: string, newValue: boolean) => {
    // Upsert on the key: a setting that has never been written gets its row
    // here instead of an update that matches nothing and looks like success.
    const { data, error } = await adminDb()
      .from("admin_settings")
      .upsert({ key, value: newValue, updated_at: new Date().toISOString() }, { onConflict: "key" })
      .select("id, key, value")
      .single();
    if (error) {
      toast({ title: "Could not save that", description: error.message, variant: "destructive" });
    } else {
      setSettings((prev) => (prev.some((s) => s.key === key) ? prev.map((s) => (s.key === key ? { ...s, value: newValue } : s)) : [...prev, data as Setting]));
      toast({ title: `Notifications ${newValue ? "enabled" : "disabled"}` });
    }
  };

  const getValue = (key: string) => {
    const s = settings.find((s) => s.key === key);
    return s?.value === true;
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold mb-6">Settings</h1>
      <div className="max-w-xl space-y-1">
        <h2 className="text-lg font-semibold mb-4">Email Notifications</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Control which form submissions trigger an email notification to the admin inbox.
        </p>
        <div className="space-y-4">
          {NOTIFICATION_SETTINGS.map(({ key, label, description, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-sm font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
              </div>
              <Switch
                checked={getValue(key)}
                onCheckedChange={(checked) => toggleSetting(key, checked)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;
