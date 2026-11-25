import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/components/AppLayout";
import { Field, PageHeader } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createOfficer, resetOfficerPassword, updateOfficer } from "@/lib/officers.functions";

export const Route = createFileRoute("/_app/officers")({ component: OfficersPage });

type Role = "admin" | "officer";
type Officer = { id: string; name: string; username: string; role: Role; active: boolean };
type LogRow = { id: string; user_name: string; action: string; description: string; created_at: string };
type Mode = null | "add" | "edit" | "password";

const selectCls =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function OfficersPage() {
  const me = useProfile();
  const isAdmin = me.role === "admin";
  const createFn = useServerFn(createOfficer);
  const updateFn = useServerFn(updateOfficer);
  const resetFn = useServerFn(resetOfficerPassword);

  const [officers, setOfficers] = useState<Officer[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadError, setLoadError] = useState("");

  const [mode, setMode] = useState<Mode>(null);
  const [target, setTarget] = useState<Officer | null>(null);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "officer" as Role, active: true });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [o, l] = await Promise.all([
      supabase.from("profiles").select("id,name,username,role,active").order("name"),
      supabase
        .from("audit_log")
        .select("id,user_name,action,description,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (o.error || l.error) setLoadError((o.error ?? l.error)!.message);
    else setLoadError("");
    if (o.data) setOfficers(o.data as Officer[]);
    if (l.data) setLogs(l.data as LogRow[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setTarget(null);
    setForm({ name: "", username: "", password: "", role: "officer", active: true });
    setError("");
    setMode("add");
  }
  function openEdit(o: Officer) {
    setTarget(o);
    setForm({ name: o.name, username: o.username, password: "", role: o.role, active: o.active });
    setError("");
    setMode("edit");
  }
  function openPassword(o: Officer) {
    setTarget(o);
    setForm({ ...form, password: "" });
    setError("");
    setMode("password");
  }

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      if (mode === "add") {
        await createFn({
          data: { token, name: form.name, username: form.username, password: form.password, role: form.role },
        });
      } else if (mode === "edit" && target) {
        await updateFn({
          data: { token, id: target.id, name: form.name, role: form.role, active: form.active },
        });
      } else if (mode === "password" && target) {
        await resetFn({ data: { token, id: target.id, password: form.password } });
      }
      setMode(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const title =
    mode === "add" ? "Add Officer" : mode === "edit" ? "Edit Officer" : `Reset password for ${target?.username ?? ""}`;

  return (
    <>
      <PageHeader
        title="Officers"
        subtitle="Officer accounts and the system audit log."
        action={
          isAdmin ? (
            <Button className="h-11" onClick={openAdd}>
              <Plus className="size-4" /> Add Officer
            </Button>
          ) : undefined
        }
      />

      {loadError ? <p className="mb-4 text-sm text-destructive">Could not load data: {loadError}</p> : null}

      <div className="mb-6 overflow-x-auto rounded-2xl border bg-card p-6 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Username</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">Status</th>
              {isAdmin ? <th className="px-3 py-3 text-right font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {officers.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-3 py-4 font-medium">{o.name}</td>
                <td className="px-3 py-4">{o.username}</td>
                <td className="px-3 py-4 capitalize">{o.role}</td>
                <td className={"px-3 py-4 " + (o.active ? "text-emerald-600" : "text-muted-foreground")}>
                  {o.active ? "Active" : "Disabled"}
                </td>
                {isAdmin ? (
                  <td className="px-3 py-4">
                    <div className="flex justify-end gap-1">
                      <button title="Edit" onClick={() => openEdit(o)} className="rounded-lg p-2 hover:bg-muted">
                        <Pencil className="size-4" />
                      </button>
                      <button
                        title="Reset password"
                        onClick={() => openPassword(o)}
                        className="rounded-lg p-2 hover:bg-muted"
                      >
                        <KeyRound className="size-4" />
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">Audit Log</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-3 font-medium">Date / Time</th>
              <th className="px-3 py-3 font-medium">User</th>
              <th className="px-3 py-3 font-medium">Action</th>
              <th className="px-3 py-3 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                  No activity yet.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 font-medium">{l.user_name}</td>
                  <td className="px-3 py-3 font-mono text-xs">{l.action}</td>
                  <td className="px-3 py-3">{l.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">Showing the latest 100 entries.</p>
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {mode !== "password" ? (
              <>
                <Field label="Full name">
                  <Input className="h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Username">
                  <Input
                    className="h-11"
                    disabled={mode === "edit"}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </Field>
                <Field label="Role">
                  <select
                    className={selectCls}
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  >
                    <option value="officer">Officer</option>
                    <option value="admin">Admin</option>
                  </select>
                </Field>
              </>
            ) : null}

            {mode === "add" || mode === "password" ? (
              <Field label={mode === "add" ? "Password (min. 8 characters)" : "New password (min. 8 characters)"}>
                <Input
                  className="h-11"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
            ) : null}

            {mode === "edit" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Account active (untick to disable sign-in)
              </label>
            ) : null}

            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}