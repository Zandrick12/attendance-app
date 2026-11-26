import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, FileDown, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLASSES } from "@/lib/constants";
import { formatSession } from "@/lib/format";
import { exportDocx, exportExcel, exportPdf, fetchRows, writePrint } from "@/lib/exports";
import { Field, PageHeader } from "@/components/Common";
import { AttendanceSheet, SESSION_SELECT, type SessionRow } from "@/components/AttendanceSheet";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/history")({ component: HistoryPage });

type Kind = "pdf" | "docx" | "xlsx" | "print";
type Filters = { date: string; cls: string; q: string; status: string; officer: string };

const selectCls =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const btn =
  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";

function HistoryPage() {
  const [f, setF] = useState<Filters>({ date: "", cls: "", q: "", status: "", officer: "" });
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [officers, setOfficers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,name")
      .order("name")
      .then(({ data }) => data && setOfficers(data));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      let query = supabase
        .from("attendance_sessions")
        .select(SESSION_SELECT)
        .order("session_date", { ascending: false })
        .order("session_time", { ascending: false })
        .limit(200);
      if (f.date) query = query.eq("session_date", f.date);
      if (f.cls) query = query.eq("class", f.cls);
      if (f.status) query = query.eq("status", f.status);
      if (f.officer) query = query.eq("officer_id", f.officer);
      if (f.q.trim()) query = query.ilike("title", `%${f.q.trim().replace(/[%_]/g, "\\$&")}%`);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) setLoadError(error.message);
      else {
        setSessions(data as unknown as SessionRow[]);
        setLoadError("");
      }
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [f, refresh]);

  async function run(s: SessionRow, kind: Kind) {
    setActionError("");
    // Open the print window immediately so the browser doesn't block it
    const w = kind === "print" ? window.open("", "_blank") : null;
    if (kind === "print" && !w) {
      setActionError("Allow pop-ups for this site to use Print.");
      return;
    }
    setBusy(`${s.id}:${kind}`);
    try {
      const rows = await fetchRows(s.id);
      if (kind === "pdf") await exportPdf(s, rows);
      else if (kind === "docx") await exportDocx(s, rows);
      else if (kind === "xlsx") await exportExcel(s, rows);
      else writePrint(w!, s, rows);
    } catch (e) {
      w?.close();
      setActionError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy("");
    }
  }

  if (selected) {
    return (
      <AttendanceSheet
        session={selected}
        onBack={() => {
          setSelected(null);
          setRefresh((n) => n + 1);
        }}
      />
    );
  }

  return (
    <>
      <PageHeader title="Attendance History" subtitle="All attendance sessions across every class." />

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-6 grid gap-4 md:grid-cols-5">
          <Field label="Date">
            <Input className="h-11" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Class">
            <select className={selectCls} value={f.cls} onChange={(e) => setF({ ...f, cls: e.target.value })}>
              <option value="">All</option>
              {CLASSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Activity">
            <Input className="h-11" placeholder="Search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          </Field>
          <Field label="Status">
            <select className={selectCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="done">Done</option>
            </select>
          </Field>
          <Field label="Officer">
            <select className={selectCls} value={f.officer} onChange={(e) => setF({ ...f, officer: e.target.value })}>
              <option value="">All</option>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {loadError ? <p className="mb-4 text-sm text-destructive">Could not load sessions: {loadError}</p> : null}
        {actionError ? <p className="mb-4 text-sm text-destructive">{actionError}</p> : null}

        {loading ? (
          <p className="py-10 text-center text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No sessions match these filters.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-medium">{s.title}</p>
                    <span
                      className={
                        "rounded-full px-2.5 py-0.5 text-xs font-medium " +
                        (s.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")
                      }
                    >
                      {s.status === "done" ? "Done" : "Open"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {s.class} · {formatSession(s.session_date, s.session_time)}
                    {s.location ? ` · ${s.location}` : ""} · {s.officer?.name ?? "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelected(s)}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                  >
                    <Eye className="size-4" /> View
                  </button>
                  <button className={btn} disabled={busy !== ""} onClick={() => run(s, "pdf")}>
                    <FileText className="size-4" /> PDF
                  </button>
                  <button className={btn} disabled={busy !== ""} onClick={() => run(s, "docx")}>
                    <FileDown className="size-4" /> DOCX
                  </button>
                  <button className={btn} disabled={busy !== ""} onClick={() => run(s, "xlsx")}>
                    <FileSpreadsheet className="size-4" /> Excel
                  </button>
                  <button className={btn} disabled={busy !== ""} onClick={() => run(s, "print")}>
                    <Printer className="size-4" /> Print
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {sessions.length === 200 ? (
          <p className="mt-4 text-xs text-muted-foreground">Showing the latest 200 sessions. Use the filters to narrow down.</p>
        ) : null}
      </div>
    </>
  );
}