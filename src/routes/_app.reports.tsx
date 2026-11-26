import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileDown, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLASSES } from "@/lib/constants";
import {
  exportReportDocx,
  exportReportExcel,
  exportReportPdf,
  writeReportPrint,
  type ReportMeta,
  type ReportRow,
} from "@/lib/reportExports";
import { Field, PageHeader } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

type Kind = "pdf" | "docx" | "xlsx" | "print";

const selectCls =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const btn =
  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";

function ReportsPage() {
  const [cls, setCls] = useState<string>(CLASSES[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [activity, setActivity] = useState("");
  const [titles, setTitles] = useState<string[]>([]);

  const [result, setResult] = useState<{ meta: ReportMeta; rows: ReportRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  // Activities available for the chosen class (completed sessions only)
  useEffect(() => {
    setActivity("");
    supabase
      .from("attendance_sessions")
      .select("title")
      .eq("class", cls)
      .eq("status", "done")
      .limit(1000)
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((d) => d.title as string))].sort();
        setTitles(unique);
      });
  }, [cls]);

  const totals = useMemo(() => {
    const rows = result?.rows ?? [];
    const sum = (k: "sessions" | "present" | "late" | "absent" | "points") =>
      rows.reduce((n, r) => n + r[k], 0);
    return { present: sum("present"), late: sum("late"), absent: sum("absent"), points: sum("points") };
  }, [result]);

  async function generate() {
    setError("");
    if (from && to && from > to) {
      setError("'Date from' must be on or before 'Date to'.");
      return;
    }
    setBusy(true);

    let sessionQuery = supabase
      .from("attendance_sessions")
      .select("id", { count: "exact", head: true })
      .eq("class", cls)
      .eq("status", "done");
    if (from) sessionQuery = sessionQuery.gte("session_date", from);
    if (to) sessionQuery = sessionQuery.lte("session_date", to);
    if (activity) sessionQuery = sessionQuery.eq("title", activity);

    const [report, count] = await Promise.all([
      supabase.rpc("attendance_report", {
        p_class: cls,
        p_from: from || null,
        p_to: to || null,
        p_title: activity || null,
      }),
      sessionQuery,
    ]);
    setBusy(false);

    if (report.error || count.error) {
      setError((report.error ?? count.error)!.message);
      return;
    }
    setResult({
      meta: { cls, from, to, activity, sessionCount: count.count ?? 0 },
      rows: (report.data ?? []) as ReportRow[],
    });
  }

  async function run(kind: Kind) {
    if (!result) return;
    setError("");
    // Open the print window immediately so the browser doesn't block it
    const w = kind === "print" ? window.open("", "_blank") : null;
    if (kind === "print" && !w) {
      setError("Allow pop-ups for this site to use Print.");
      return;
    }
    setExporting(true);
    try {
      if (kind === "pdf") await exportReportPdf(result.meta, result.rows);
      else if (kind === "docx") await exportReportDocx(result.meta, result.rows);
      else if (kind === "xlsx") await exportReportExcel(result.meta, result.rows);
      else writeReportPrint(w!, result.meta, result.rows);
    } catch (e) {
      w?.close();
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate attendance summaries by class and period." />

      <div className="mb-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-5">
          <Field label="Class">
            <select className={selectCls} value={cls} onChange={(e) => setCls(e.target.value)}>
              {CLASSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Date from">
            <Input className="h-11" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Date to">
            <Input className="h-11" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Activity">
            <select className={selectCls} value={activity} onChange={(e) => setActivity(e.target.value)}>
              <option value="">All</option>
              {titles.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Button className="h-11 w-full" onClick={generate} disabled={busy}>
              {busy ? "Generating…" : "Generate Report"}
            </Button>
          </div>
        </div>
        {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        {!result ? (
          <p className="py-12 text-center text-muted-foreground">Choose filters and press Generate Report.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold">
                  {result.meta.cls} · {result.meta.sessionCount} completed session
                  {result.meta.sessionCount === 1 ? "" : "s"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {result.meta.from || "Any"} to {result.meta.to || "Any"} · {result.meta.activity || "All activities"}
                </p>
              </div>
              {result.rows.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <button className={btn} disabled={exporting} onClick={() => run("pdf")}>
                    <FileText className="size-4" /> PDF
                  </button>
                  <button className={btn} disabled={exporting} onClick={() => run("docx")}>
                    <FileDown className="size-4" /> DOCX
                  </button>
                  <button className={btn} disabled={exporting} onClick={() => run("xlsx")}>
                    <FileSpreadsheet className="size-4" /> Excel
                  </button>
                  <button className={btn} disabled={exporting} onClick={() => run("print")}>
                    <Printer className="size-4" /> Print
                  </button>
                </div>
              ) : null}
            </div>

            {result.rows.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                No completed attendance found for these filters. Open sessions aren't counted until they are
                marked as done.
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Present {totals.present}</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Late {totals.late}</span>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">Absent {totals.absent}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    Total deduction {totals.points}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-3 font-medium">Student No.</th>
                        <th className="px-3 py-3 font-medium">Name</th>
                        <th className="px-3 py-3 font-medium">Platoon</th>
                        <th className="px-3 py-3 text-right font-medium">Sessions</th>
                        <th className="px-3 py-3 text-right font-medium">Present</th>
                        <th className="px-3 py-3 text-right font-medium">Late</th>
                        <th className="px-3 py-3 text-right font-medium">Absent</th>
                        <th className="px-3 py-3 text-right font-medium">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((r) => (
                        <tr key={r.student_no} className="border-t">
                          <td className="px-3 py-3 font-mono text-xs">{r.student_no}</td>
                          <td className="px-3 py-3 font-medium">
                            {r.name}
                            {r.archived ? <span className="ml-2 text-xs text-muted-foreground">(archived)</span> : null}
                          </td>
                          <td className="px-3 py-3">{r.platoon}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{r.sessions}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{r.present}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{r.late}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{r.absent}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{r.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}