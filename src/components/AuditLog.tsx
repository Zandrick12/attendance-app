import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type LogRow = { id: string; user_name: string; action: string; description: string; created_at: string };

export function AuditLog() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select("id,user_name,action,description,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setError(error.message);
    else {
      setLogs(data as LogRow[]);
      setError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Showing the latest 100 entries.</p>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={"size-4 " + (loading ? "animate-spin" : "")} /> Refresh
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">Could not load the audit log: {error}</p> : null}

      <div className="overflow-x-auto">
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
                  {loading ? "Loading…" : "No activity yet."}
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
      </div>
    </div>
  );
}