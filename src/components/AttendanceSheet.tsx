import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/auth";
import { formatSession } from "@/lib/format";
import { PageHeader } from "@/components/Common";
import { Button } from "@/components/ui/button";

export type Status = "present" | "late" | "absent";

export type SessionRow = {
  id: string;
  title: string;
  class: string;
  session_date: string;
  session_time: string;
  location: string;
  status: "open" | "done";
  officer: { name: string } | null;
};

// Use this select string everywhere sessions are loaded
export const SESSION_SELECT = "*, officer:profiles!officer_id(name)";

type RecordRow = {
  id: string;
  session_id: string;
  cadet_id: string;
  status: Status;
  deduction: number;
  cadets: { student_no: string; name: string; platoon: string };
};
type Settings = { present_deduction: number; late_deduction: number; absent_deduction: number };

const OPTIONS: { v: Status; label: string; on: string }[] = [
  { v: "present", label: "Present", on: "bg-emerald-600 text-white" },
  { v: "late", label: "Late", on: "bg-amber-500 text-white" },
  { v: "absent", label: "Absent", on: "bg-red-600 text-white" },
];

export function AttendanceSheet({ session, onBack }: { session: SessionRow; onBack: () => void }) {
  const readOnly = session.status === "done";
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [settings, setSettings] = useState<Settings>({
    present_deduction: 0,
    late_deduction: -3,
    absent_deduction: -5,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const [r, s] = await Promise.all([
        supabase
          .from("attendance_records")
          .select("id,session_id,cadet_id,status,deduction,cadets(student_no,name,platoon)")
          .eq("session_id", session.id),
        supabase
          .from("settings")
          .select("present_deduction,late_deduction,absent_deduction")
          .eq("id", 1)
          .maybeSingle(),
      ]);
      if (r.error) {
        setNotice({ text: r.error.message, error: true });
      } else {
        const rows = (r.data as unknown as RecordRow[]).sort((a, b) =>
          a.cadets.name.localeCompare(b.cadets.name),
        );
        setRecords(rows);
        setMarks(Object.fromEntries(rows.map((x) => [x.id, x.status])));
      }
      if (s.data) setSettings(s.data as Settings);
      setLoading(false);
    })();
  }, [session.id]);

  const ded = (s: Status) =>
    s === "present" ? settings.present_deduction : s === "late" ? settings.late_deduction : settings.absent_deduction;

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0 };
    for (const r of records) c[marks[r.id] ?? r.status]++;
    return c;
  }, [records, marks]);

  async function persist(): Promise<boolean> {
    const rows = records.map((r) => ({
      id: r.id,
      session_id: r.session_id,
      cadet_id: r.cadet_id,
      status: marks[r.id],
      deduction: ded(marks[r.id]),
    }));
    const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "id" });
    if (error) {
      setNotice({ text: error.message, error: true });
      return false;
    }
    await logAction(
      "SAVE_ATTENDANCE",
      `Saved "${session.title}" (${session.class}, ${session.session_date}) — P${counts.present}/L${counts.late}/A${counts.absent}`,
    );
    return true;
  }

  async function save() {
    setBusy(true);
    setNotice(null);
    if (await persist()) setNotice({ text: "Attendance saved.", error: false });
    setBusy(false);
  }

  async function markDone() {
    if (!confirm("Mark this attendance as done? It can't be changed afterwards.")) return;
    setBusy(true);
    setNotice(null);
    if (!(await persist())) {
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("attendance_sessions")
      .update({ status: "done" })
      .eq("id", session.id);
    if (error) {
      setNotice({ text: error.message, error: true });
      setBusy(false);
      return;
    }
    await logAction(
      "COMPLETE_ATTENDANCE",
      `Marked "${session.title}" (${session.class}, ${session.session_date}) as done`,
    );
    onBack();
  }

  return (
    <>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to sessions
      </button>

      <PageHeader
        title={session.title}
        subtitle={`${session.class} · ${formatSession(session.session_date, session.session_time)} · ${
          session.location || "No location"
        } · ${session.officer?.name ?? "—"}`}
        action={
          <span
            className={
              "rounded-full px-3 py-1 text-xs font-medium " +
              (readOnly ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")
            }
          >
            {readOnly ? "Done" : "Open"}
          </span>
        }
      />

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Present {counts.present}</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Late {counts.late}</span>
          <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">Absent {counts.absent}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-3 font-medium">Student No.</th>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Platoon</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const current = marks[r.id] ?? r.status;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-3 font-mono text-xs">{r.cadets.student_no}</td>
                      <td className="px-3 py-3 font-medium">{r.cadets.name}</td>
                      <td className="px-3 py-3">{r.cadets.platoon}</td>
                      <td className="px-3 py-3">
                        <div className="inline-flex overflow-hidden rounded-lg border">
                          {OPTIONS.map((o) => (
                            <button
                              key={o.v}
                              disabled={readOnly}
                              onClick={() => setMarks({ ...marks, [r.id]: o.v })}
                              className={
                                "px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default " +
                                (current === o.v ? o.on : "bg-background text-muted-foreground hover:bg-muted")
                              }
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {readOnly ? r.deduction : ded(current)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {notice ? (
          <p className={"mt-4 text-sm " + (notice.error ? "text-destructive" : "text-emerald-600")}>
            {notice.text}
          </p>
        ) : null}

        {!readOnly ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" className="h-11" onClick={save} disabled={busy || loading}>
              Save
            </Button>
            <Button className="h-11" onClick={markDone} disabled={busy || loading}>
              Mark as done
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}