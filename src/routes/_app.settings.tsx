import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Pencil, ScrollText, SlidersHorizontal, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/auth";
import { CLASSES } from "@/lib/constants";
import { useProfile, useUpdateProfile } from "@/components/AppLayout";
import { Avatar, AvatarDialog } from "@/components/AvatarDialog";
import { AuditLog } from "@/components/AuditLog";
import { Field, PageHeader } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Section = "profile" | "audit" | "deductions";
const SECTIONS: Section[] = ["profile", "audit", "deductions"];

export const Route = createFileRoute("/_app/settings")({
  validateSearch: (s: Record<string, unknown>): { section?: Section } =>
    SECTIONS.includes(s.section as Section) ? { section: s.section as Section } : {},
  component: SettingsPage,
});

const CARDS = [
  { key: "profile", title: "My Profile", text: "Your photo, rank, name, class and position.", icon: UserRound },
  { key: "audit", title: "Audit Log", text: "Who did what, and when.", icon: ScrollText },
  { key: "deductions", title: "Deduction Points", text: "Points for Present, Late and Absent.", icon: SlidersHorizontal },
] as const;

const RANKS = ["C/COL", "C/LTC", "C/MAJ", "C/CPT", "C/1LT", "C/2LT", "C/CSM", "C/MSG", "C/SFC", "C/SSG", "C/SGT", "C/CPL", "C/PFC", "C/PVT"];

const selectCls =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function SettingsPage() {
  const { section } = Route.useSearch();

  if (!section) {
    return (
      <>
        <PageHeader title="Settings" subtitle="Your profile, the audit log and deduction points." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CARDS.map((c) => (
            <Link
              key={c.key}
              to="/settings"
              search={{ section: c.key }}
              className="flex items-start gap-4 rounded-2xl border bg-card p-6 shadow-sm transition hover:border-emerald-500 hover:shadow-md"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <c.icon className="size-6" />
              </span>
              <span>
                <span className="block text-lg font-bold">{c.title}</span>
                <span className="block text-sm text-muted-foreground">{c.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <Link
        to="/settings"
        search={{}}
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to settings
      </Link>
      {section === "profile" ? <ProfileSection /> : null}
      {section === "audit" ? (
        <>
          <PageHeader title="Audit Log" subtitle="A record of every important action in the system." />
          <AuditLog />
        </>
      ) : null}
      {section === "deductions" ? <DeductionsSection /> : null}
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{children}</span>;
}

function ProfileSection() {
  const me = useProfile();
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [form, setForm] = useState({ name: "", rank: "", cls: "", position: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setForm({
      name: me.name,
      rank: me.cadet_rank ?? "",
      cls: me.cadet_class ?? "",
      position: me.cadet_position ?? "",
    });
    setError("");
    setNotice("");
    setEditing(true);
  }

  async function save() {
    setError("");
    const name = form.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("update_my_profile", {
      p_name: name,
      p_rank: form.rank,
      p_class: form.cls,
      p_position: form.position,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await logAction("UPDATE_PROFILE", `${me.username} updated their profile`);
    update({
      name,
      cadet_rank: form.rank.trim() || null,
      cadet_class: form.cls || null,
      cadet_position: form.position.trim() || null,
    });
    setEditing(false);
    setNotice("Profile saved.");
  }

  const headline = [me.cadet_rank, me.name].filter(Boolean).join(" ");

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Your details as they appear in the system."
        action={
          !editing ? (
            <Button className="h-11" onClick={startEdit}>
              <Pencil className="size-4" /> Edit profile
            </Button>
          ) : undefined
        }
      />

      <div className="max-w-2xl rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <button
            onClick={() => setPhotoOpen(true)}
            title="Change photo"
            className="group relative shrink-0 rounded-full"
          >
            <Avatar profile={me} className="size-28 text-4xl" />
            <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/50 text-xs font-medium text-white group-hover:flex">
              Change
            </span>
          </button>
          <div className="min-w-0">
            <p className="break-words text-2xl font-bold">{headline}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {me.cadet_class ? <Chip>{me.cadet_class}</Chip> : null}
              {me.cadet_position ? <Chip>{me.cadet_position}</Chip> : null}
              {!me.cadet_class && !me.cadet_position ? (
                <span className="text-sm text-muted-foreground">Class and position not set yet.</span>
              ) : null}
            </div>
          </div>
        </div>

        {notice ? <p className="mt-4 text-sm text-emerald-600">{notice}</p> : null}

        {editing ? (
          <div className="mt-6 space-y-4 border-t pt-6">
            <Field label="Full name">
              <Input className="h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rank (e.g. C/LTC)">
                <Input
                  className="h-11"
                  list="rank-list"
                  value={form.rank}
                  onChange={(e) => setForm({ ...form, rank: e.target.value })}
                />
                <datalist id="rank-list">
                  {RANKS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <Field label="Class">
                <select className={selectCls} value={form.cls} onChange={(e) => setForm({ ...form, cls: e.target.value })}>
                  <option value="">Not set</option>
                  {CLASSES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Position (e.g. Bn S7)">
              <Input
                className="h-11"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </Field>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-3">
              <Button variant="outline" className="h-11" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button className="h-11" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <dl className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Username</dt>
              <dd className="mt-1 font-medium">{me.username}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Role</dt>
              <dd className="mt-1 font-medium capitalize">{me.role}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Status</dt>
              <dd className="mt-1 font-medium text-emerald-600">{me.active ? "Active" : "Disabled"}</dd>
            </div>
          </dl>
        )}
      </div>

      <AvatarDialog
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        profile={me}
        onSaved={(url) => update({ avatar_url: url })}
      />
    </>
  );
}

type DedForm = { present: string; late: string; absent: string };

function DeductionsSection() {
  const me = useProfile();
  const isAdmin = me.role === "admin";
  const [form, setForm] = useState<DedForm>({ present: "0", late: "-3", absent: "-5" });
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
        title="Deduction Points"
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