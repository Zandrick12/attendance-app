import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoAdmin } from "@/lib/officers.functions";
import { APP_NAME, APP_SUBTITLE, usernameToEmail } from "@/lib/constants";
import { logAction } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/Common";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Attendance Management System" },
      { name: "description", content: "Officer sign-in for cadet attendance tracking, reports and exports." },
      { property: "og:title", content: "Sign in — Attendance Management System" },
      { property: "og:description", content: "Officer sign-in for cadet attendance tracking, reports and exports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const ensureAdmin = useServerFn(ensureDemoAdmin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ensureAdmin().catch(() => {});
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [ensureAdmin, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) return setError("Enter your username and password.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    setBusy(false);
    if (error) return setError(error.message.includes("banned") ? "This account is disabled." : "Invalid username or password.");
    logAction("LOGIN", `${username} signed in`);
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="font-display text-lg font-bold tracking-tight">{APP_NAME}</h1>
          <p className="text-sm text-muted-foreground">{APP_SUBTITLE}</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Username">
            <Input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11" />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          </Field>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
