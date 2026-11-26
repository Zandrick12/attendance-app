import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/auth";
import { CLASSES } from "@/lib/constants";
import { formatSession } from "@/lib/format";
import { Field, PageHeader } from "@/components/Common";
import { AttendanceSheet, SESSION_SELECT, type SessionRow } from "@/components/AttendanceSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/attendance/$cls")({ component: AttendancePage });

function AttendancePage() {
  const { cls } = Route.useParams();
  if (!(CLASSES as readonly string[]).includes(cls)) return <PageHeader title="Unknown class" />;
  // key resets the page state when you switch between 1CL, 2CL, ...
  return <ClassAttendance key={cls} cls={cls} />;
}

function ClassAttendance({ cls }: { cls: string }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<SessionRow | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "07:00", location: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select(SESSION_SELECT)
      .eq("class", cls)
      .order("session_date", { ascending: false })
      .order("session_time", { ascending: false });
    if (error) setLoadError(error.message);
    else {
      setSessions(data as unknown as SessionRow[]);
      setLoadError("");
    }
    setLoading(false);
  }, [cls]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm({ title: "", date: new Date().toLocaleDateString("en-CA"), time: "07:00", location: "" });
    setFormError("");
    setOpen(true);
  }

  async function create() {
    setFormError("");
    const title = form.title.trim();
    if (!title || !form.date || !form.time) {
      setFormError("Activity, date and time are required.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("create_attendance_session", {
      p_title: title,
      p_class: cls,
      p_date: form.date,
      p_time: form.time,
      p_location: form.location,
    });
    if (error || !data?.length) {
      setSaving(false);
      setFormError(error?.message ?? "Could not create the session.");
      return;
    }
    const { new_session_id, cadet_count } = data[0] as { new_session_id: string; cadet_count: number };
    await logAction("CREATE_ATTENDANCE", `Created "${title}" for ${cls} on ${form.date} (${cadet_count} cadets)`);

    const { data: row } = await supabase
      .from("attendance_sessions")
      .select(SESSION_SELECT)
      .eq("id", new_session_id)
      .single();
    setSaving(false);
    setOpen(false);
    if (row) setSelected(row as unknown as SessionRow);
    load();
  }

  if (selected) {
    return (
      <AttendanceSheet
        session={selected}
        onBack={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`${cls} Attendance`}
        subtitle="Create a session, mark cadets, then mark it as done."
        action={
          <Button className="h-11" onClick={openCreate}>
            <Plus className="size-4" /> Create New Attendance
          </Button>
        }
      />

      {loadError ? <p className="mb-4 text-sm text-destructive">Could not load sessions: {loadError}</p> : null}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {loading ? (
          <p className="p-10 text-center text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">No sessions yet for {cls}.</p>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="flex w-full items-center justify-between gap-4 border-b px-6 py-5 text-left last:border-b-0 hover:bg-muted/50"
            >
              <div>
                <p className="text-lg font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatSession(s.session_date, s.session_time)}
                  {s.location ? ` · ${s.location}` : ""} · {s.officer?.name ?? "—"}
                </p>
              </div>
              <span
                className={
                  "rounded-full px-3 py-1 text-xs font-medium " +
                  (s.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")
                }
              >
                {s.status === "done" ? "Done" : "Open"}
              </span>
            </button>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Attendance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Activity">
              <Input
                className="h-11"
                placeholder="e.g. Saturday Instruction"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date">
                <Input
                  className="h-11"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
              <Field label="Time">
                <Input
                  className="h-11"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Location">
              <Input
                className="h-11"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              All active {cls} cadets are added as Present. You can change each one afterwards.
            </p>
            {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}