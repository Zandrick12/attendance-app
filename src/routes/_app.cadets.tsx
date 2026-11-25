import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Pencil, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/auth";
import { CLASSES, PLATOONS } from "@/lib/constants";
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

export const Route = createFileRoute("/_app/cadets")({ component: CadetsPage });

type Cadet = {
  id: string;
  student_no: string;
  name: string;
  class: string;
  platoon: string;
  archived: boolean;
  created_at: string;
};
type Form = { student_no: string; name: string; class: string; platoon: string };

const emptyForm: Form = { student_no: "", name: "", class: CLASSES[0], platoon: PLATOONS[0] };
const selectCls =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function CadetsPage() {
  const [cadets, setCadets] = useState<Cadet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [platoonFilter, setPlatoonFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cadet | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("cadets")
      .select("*")
      .order("name")
      .order("class");
    if (error) setLoadError(error.message);
    else {
      setCadets(data as Cadet[]);
      setLoadError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cadets.filter(
      (c) =>
        (statusFilter === "all" || (statusFilter === "archived") === c.archived) &&
        (!classFilter || c.class === classFilter) &&
        (!platoonFilter || c.platoon === platoonFilter) &&
        (!q || c.name.toLowerCase().includes(q) || c.student_no.toLowerCase().includes(q)),
    );
  }, [cadets, search, classFilter, platoonFilter, statusFilter]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setOpen(true);
  }

  function openEdit(c: Cadet) {
    setEditing(c);
    setForm({ student_no: c.student_no, name: c.name, class: c.class, platoon: c.platoon });
    setFormError("");
    setOpen(true);
  }

  async function save() {
    setFormError("");
    const student_no = form.student_no.trim();
    const name = form.name.trim();
    if (!student_no || !name) {
      setFormError("Student number and name are required.");
      return;
    }
    setSaving(true);
    const payload = { student_no, name, class: form.class, platoon: form.platoon };
    const { error } = editing
      ? await supabase.from("cadets").update(payload).eq("id", editing.id)
      : await supabase.from("cadets").insert(payload);
    setSaving(false);
    if (error) {
      setFormError(error.code === "23505" ? "That student number already exists." : error.message);
      return;
    }
    await logAction(
      editing ? "UPDATE_CADET" : "CREATE_CADET",
      `${editing ? "Updated" : "Added"} cadet ${name} (${student_no})`,
    );
    setOpen(false);
    load();
  }

  async function toggleArchive(c: Cadet) {
    const { error } = await supabase
      .from("cadets")
      .update({ archived: !c.archived })
      .eq("id", c.id);
    if (error) {
      alert(error.message);
      return;
    }
    await logAction(
      c.archived ? "RESTORE_CADET" : "ARCHIVE_CADET",
      `${c.archived ? "Restored" : "Archived"} cadet ${c.name} (${c.student_no})`,
    );
    load();
  }

  return (
    <>
      <PageHeader
        title="Cadets"
        subtitle="Manage the cadet roster. Archived cadets keep their attendance history."
        action={
          <Button className="h-11" onClick={openAdd}>
            <Plus className="size-4" /> Add Cadet
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-9"
              placeholder="Search name or number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className={selectCls} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All classes</option>
            {CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className={selectCls} value={platoonFilter} onChange={(e) => setPlatoonFilter(e.target.value)}>
            <option value="">All platoons</option>
            {PLATOONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            className={selectCls}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>

        {loadError ? <p className="mb-4 text-sm text-destructive">Could not load cadets: {loadError}</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-3 font-medium">Student No.</th>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Class</th>
                <th className="px-3 py-3 font-medium">Platoon</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Created</th>
                <th className="px-3 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    No cadets found.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-4 font-mono text-xs">{c.student_no}</td>
                    <td className="px-3 py-4 font-medium">{c.name}</td>
                    <td className="px-3 py-4">{c.class}</td>
                    <td className="px-3 py-4">{c.platoon}</td>
                    <td className={"px-3 py-4 " + (c.archived ? "text-muted-foreground" : "text-emerald-600")}>
                      {c.archived ? "Archived" : "Active"}
                    </td>
                    <td className="px-3 py-4">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          title="Edit"
                          onClick={() => openEdit(c)}
                          className="rounded-lg p-2 hover:bg-muted"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          title={c.archived ? "Restore" : "Archive"}
                          onClick={() => toggleArchive(c)}
                          className="rounded-lg p-2 hover:bg-muted"
                        >
                          {c.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Cadet" : "Add Cadet"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Student number">
              <Input
                className="h-11"
                value={form.student_no}
                onChange={(e) => setForm({ ...form, student_no: e.target.value })}
              />
            </Field>
            <Field label="Full name">
              <Input
                className="h-11"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Class">
                <select
                  className={selectCls}
                  value={form.class}
                  onChange={(e) => setForm({ ...form, class: e.target.value })}
                >
                  {CLASSES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Platoon">
                <select
                  className={selectCls}
                  value={form.platoon}
                  onChange={(e) => setForm({ ...form, platoon: e.target.value })}
                >
                  {PLATOONS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
            </div>
            {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}