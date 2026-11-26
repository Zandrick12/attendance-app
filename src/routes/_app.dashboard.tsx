import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, ClipboardList, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLASSES } from "@/lib/constants";
import { formatSession } from "@/lib/format";
import { PageHeader } from "@/components/Common";
import { useProfile } from "@/components/AppLayout";
import { SESSION_SELECT, type SessionRow } from "@/components/AttendanceSheet";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

type LogRow = { id: string; user_name: string; action: string; description: string; created_at: string };
type Stats = {
  cadets: number;
  open: number;
  done: number;
  perClass: { cls: string; count: number }[];
  recent: SessionRow[];
  activity: LogRow[];
};

const head = { count: "exact" as const, head: true };

function DashboardPage() {
  const me = useProfile();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [active, open, done, recent, activity] = await Promise.all([
        supabase.from("cadets").select("id", head).eq("archived", false),
        supabase.from("attendance_sessions").select("id", head).eq("status", "open"),
        supabase.from("attendance_sessions").select("id", head).eq("status", "done"),
        supabase
          .from("attendance_sessions")
          .select(SESSION_SELECT)
          .order("session_date", { ascending: false })
          .order("session_time", { ascending: false })
          .limit(5),
        supabase
          .from("audit_log")
          .select("id,user_name,action,description,created_at")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      const perClass = await Promise.all(
        CLASSES.map((c) => supabase.from("cadets").select("id", head).eq("archived", false).eq("class", c)),
      );

      const failed = [active, open, done, recent, activity, ...perClass].find((r) => r.error);
      if (failed?.error) {
        setError(failed.error.message);
        return;
      }
      setStats({
        cadets: active.count ?? 0,
        open: open.count ?? 0,
        done: done.count ?? 0,
        perClass: CLASSES.map((c, i) => ({ cls: c, count: perClass[i].count ?? 0 })),
        recent: (recent.data ?? []) as unknown as SessionRow[],
        activity: (activity.data ?? []) as LogRow[],
      });
    })();
  }, []);

  const cards = stats
    ? [
        { label: "Active cadets", value: stats.cadets, icon: Users },
        { label: "Open sessions", value: stats.open, icon: Clock },
        { label: "Completed sessions", value: stats.done, icon: CalendarCheck },
        { label: "Total sessions", value: stats.open + stats.done, icon: ClipboardList },
      ]
    : [];

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Welcome, ${me.name}.`} />

      {error ? <p className="mb-4 text-sm text-destructive">Could not load the dashboard: {error}</p> : null}
      {!stats && !error ? <p className="text-muted-foreground">Loading…</p> : null}

      {stats ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
                <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <c.icon className="size-6" />
                </span>
                <div>
                  <p className="text-3xl font-bold tabular-nums">{c.value}</p>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Active cadets per class</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.perClass.map((c) => (
                <Link
                  key={c.cls}
                  to="/attendance/$cls"
                  params={{ cls: c.cls }}
                  className="rounded-xl border px-4 py-3 hover:bg-muted/50"
                >
                  <p className="text-sm text-muted-foreground">{c.cls}</p>
                  <p className="text-2xl font-bold tabular-nums">{c.count}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Latest sessions</h2>
                <Link to="/history" className="text-sm text-emerald-600 hover:underline">
                  View all
                </Link>
              </div>
              {stats.recent.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No sessions yet.</p>
              ) : (
                <div className="divide-y">
                  {stats.recent.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">{s.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {s.class} · {formatSession(s.session_date, s.session_time)}
                        </p>
                      </div>
                      <span
                        className={
                          "rounded-full px-2.5 py-0.5 text-xs font-medium " +
                          (s.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")
                        }
                      >
                        {s.status === "done" ? "Done" : "Open"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Recent activity</h2>
                <Link to="/officers" className="text-sm text-emerald-600 hover:underline">
                  Full audit log
                </Link>
              </div>
              {stats.activity.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="divide-y">
                  {stats.activity.map((a) => (
                    <div key={a.id} className="py-3">
                      <p className="text-sm">
                        <span className="font-medium">{a.user_name}</span> · {a.description}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}