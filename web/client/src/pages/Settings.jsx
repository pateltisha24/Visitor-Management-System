import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { apiFetch } from "../api";
import { toast } from "react-toastify";
import { FiUser, FiLock, FiLogOut, FiSave, FiCpu } from "react-icons/fi";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Label } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore",
  "Asia/Tokyo", "Australia/Sydney",
];

export const Settings = () => {
  const { user, setUser, isDemo, LogoutUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ organisation: "", timezone: "UTC" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  const [ai, setAi] = useState({ provider: "groq", model: "", apiKey: "", hasKey: false, defaultAvailable: false, providers: ["groq", "openai", "anthropic", "openrouter"], defaults: {} });
  const [savingAi, setSavingAi] = useState(false);

  useEffect(() => {
    if (user) setProfile({ organisation: user.organisation || "", timezone: user.timezone || "UTC" });
  }, [user]);

  useEffect(() => {
    if (isDemo) return;
    apiFetch("/api/ai/config").then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        setAi((a) => ({ ...a, ...d, apiKey: "" }));
      }
    }).catch(() => {});
  }, [isDemo]);

  const saveAi = async (e) => {
    e.preventDefault();
    if (isDemo) return toast.info("AI settings are disabled in the demo");
    setSavingAi(true);
    try {
      const body = { provider: ai.provider, model: ai.model };
      if (ai.apiKey) body.apiKey = ai.apiKey;
      const res = await apiFetch("/api/ai/config", { method: "PATCH", body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        toast.success("AI settings saved");
        setAi((a) => ({ ...a, apiKey: "", hasKey: a.hasKey || !!a.apiKey }));
      } else {
        toast.error(data.message || "Could not save AI settings");
      }
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSavingAi(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (isDemo) return toast.info("Profile changes are disabled in the demo");
    setSavingProfile(true);
    try {
      const res = await apiFetch("/api/auth/profile", { method: "PATCH", body: JSON.stringify(profile) });
      const data = await res.json();
      if (res.ok) {
        setUser(data.userData);
        toast.success("Profile updated");
      } else {
        toast.error(data.message || "Could not update profile");
      }
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (isDemo) return toast.info("Password changes are disabled in the demo");
    if (pwd.newPassword !== pwd.confirm) return toast.error("New passwords don't match");
    if (pwd.newPassword.length < 6) return toast.error("New password must be at least 6 characters");
    setSavingPwd(true);
    try {
      const res = await apiFetch("/api/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: pwd.currentPassword, newPassword: pwd.newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Password updated");
        setPwd({ currentPassword: "", newPassword: "", confirm: "" });
      } else {
        toast.error(data.message || "Could not update password");
      }
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSavingPwd(false);
    }
  };

  const handleLogout = () => {
    LogoutUser();
    toast.success("Logged out");
    navigate("/login");
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-secondary/20">
      <div className="container max-w-3xl py-10">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
          {isDemo && <Badge className="border-primary/20 bg-primary/10 text-primary">Demo</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account, workspace and security.</p>

        {/* Profile */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FiUser className="text-primary" /> Profile</CardTitle>
            <CardDescription>Your workspace details.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="organisation">Organisation</Label>
                  <Input id="organisation" value={profile.organisation}
                    onChange={(e) => setProfile({ ...profile, organisation: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <select id="timezone" value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                    className="flex h-12 w-full rounded-xl border border-input bg-background/60 px-4 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30">
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled />
              </div>
              <Button type="submit" disabled={savingProfile}><FiSave /> {savingProfile ? "Saving…" : "Save changes"}</Button>
            </form>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FiLock className="text-primary" /> Security</CardTitle>
            <CardDescription>Change your password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input id="currentPassword" type="password" autoComplete="current-password"
                  value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} required />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input id="newPassword" type="password" autoComplete="new-password"
                    value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input id="confirm" type="password" autoComplete="new-password"
                    value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
                </div>
              </div>
              <Button type="submit" disabled={savingPwd}><FiLock /> {savingPwd ? "Updating…" : "Update password"}</Button>
            </form>
          </CardContent>
        </Card>

        {/* AI insights (BYOK) */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FiCpu className="text-primary" /> AI insights</CardTitle>
            <CardDescription>
              Bring your own model. Defaults to Groq's free tier; add a key to use OpenAI, Anthropic or OpenRouter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveAi} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <select id="provider" value={ai.provider}
                    onChange={(e) => setAi({ ...ai, provider: e.target.value, model: ai.defaults?.[e.target.value] || "" })}
                    className="flex h-12 w-full rounded-xl border border-input bg-background/60 px-4 text-sm capitalize focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30">
                    {ai.providers.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" value={ai.model} placeholder={ai.defaults?.[ai.provider] || "model id"}
                    onChange={(e) => setAi({ ...ai, model: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API key {ai.hasKey && <span className="text-xs text-muted-foreground">(saved — leave blank to keep)</span>}</Label>
                <Input id="apiKey" type="password" placeholder={ai.hasKey ? "•••••••• stored" : "Paste your provider API key"}
                  value={ai.apiKey} onChange={(e) => setAi({ ...ai, apiKey: e.target.value })} />
                <p className="text-xs text-muted-foreground">
                  {ai.defaultAvailable ? "A shared Groq key is configured, so AI works out of the box." : "No shared key set — add your own to enable AI summaries."}
                  {" "}Keys are encrypted at rest and never returned.
                </p>
              </div>
              <Button type="submit" disabled={savingAi}><FiSave /> {savingAi ? "Saving…" : "Save AI settings"}</Button>
            </form>
          </CardContent>
        </Card>

        {/* Session */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FiLogOut className="text-primary" /> Session</CardTitle>
            <CardDescription>Sign out of this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleLogout}><FiLogOut /> Log out</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Settings;
