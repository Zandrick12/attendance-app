import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/auth";
import { useProfile } from "@/components/AppLayout";
import { Field, PageHeader } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

type Form = { present: string; late: string; absent: string };

function SettingsPage() {
  const me = useProfile();
  const isAdmin = me.role === "admin";
  const [form, setForm] = useState<Form>({ present: "0", late: "-3", absent: "-5" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    supabase
      .from("settings")
      .select("present_deduction,late_deduction,absent_deduction")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setNotice({ text: error.message, error: true });
        else if (data)
          setForm({
            present: String(data.present_deduction),
            late: String(data.late_deduction),
            absent: String(data.absent_deduction),
          });
        setLoading(false);
      });
  }, []);

  function parse(label: string, value: string): number | string {
    const v = value.trim();
    if (!/^-?\d+$/.test(v)) return `${label} must be a whole number.`;
    const n = Number(v);
    if (n > 0) return `${label} can't be positive. Use 0 or a negative number.`;
    if (n < -100) return `${label} can't be lower than -100.`;
    return n;
  }

  async function save() {
    setNotice(null);
    const p = parse("Present deduction", form.present);
    const l = parse("Late deduction", form.late);
    const a = parse("Absent deduction", form.absent);
    for (const x of [p, l, a]) {
      if (typeof x === "string") {
        setNotice({ text: x, error: true });
        return;
      }
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("settings")
      .update({ present_deduction: p, late_deduction: l, absent_deduction: a })
      .eq("id", 1)
      .select();
    setSaving(false);
    if (error) {
      setNotice({ text: error.message, error: true });
      return;
    }
    if (!data || data.length === 0) {
      setNotice({ text: "Only admins can change these settings.", error: true });
      return;
    }
    await logAction("UPDATE_SETTINGS", `Updated deductions — Present ${p}, Late ${l}, Absent ${a}`);
    setNotice({ text: "Settings saved.", error: false });
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Deduction points applied automatically to new attendance marks."
      />

      <div className="max-w-xl rounded-2xl border bg-card p-6 shadow-sm">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-5">
            <Field label="Present deduction">
              <Input
                className="h-11"
                inputMode="numeric"
                disabled={!isAdmin}
                value={form.present}
                onChange={(e) => setForm({ ...form, present: e.target.value })}
              />
            </Field>
            <Field label="Late deduction">
              <Input
                className="h-11"
                inputMode="numeric"
                disabled={!isAdmin}
                value={form.late}
                onChange={(e) => setForm({ ...form, late: e.target.value })}
              />
            </Field>
            <Field label="Absent deduction">
              <Input
                className="h-11"
                inputMode="numeric"
                disabled={!isAdmin}
                value={form.absent}
                onChange={(e) => setForm({ ...form, absent: e.target.value })}
              />
            </Field>

            {notice ? (
              <p
                role={notice.error ? "alert" : undefined}
                className={"text-sm " + (notice.error ? "text-destructive" : "text-emerald-600")}
              >
                {notice.text}
              </p>
            ) : null}

            {isAdmin ? (
              <Button className="h-11" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Only admins can change these values.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Changes apply to attendance marked from now on. Sessions already saved keep the points they were
              saved with.
            </p>
          </div>
        )}
      </div>
    </>
  );
}