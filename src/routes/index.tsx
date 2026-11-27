import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME, BRAND_SHORT } from "@/lib/constants";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — ${BRAND_SHORT} attendance management` },
      {
        name: "description",
        content: "Create attendance sessions, mark cadets, and export reports. Built for ROTC officers.",
      },
      { property: "og:title", content: `${APP_NAME} — ${BRAND_SHORT} attendance management` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ClipboardCheck,
    title: "Attendance sessions",
    text: "Create a session for 1CL, 2CL, 3CL or Aspirant, mark each cadet Present, Late or Absent, then lock it as done.",
  },
  {
    icon: Users,
    title: "Cadet roster",
    text: "Add, edit and archive cadets. Archived cadets keep their full attendance history.",
  },
  {
    icon: FileText,
    title: "Reports and exports",
    text: "Summaries by class and period, ready as PDF, DOCX or Excel, or printed straight from the browser.",
  },
  {
    icon: ScrollText,
    title: "Audit trail",
    text: "Every sign-in, save and change is recorded, so you can always see who did what and when.",
  },
];

const STEPS = [
  { n: "1", title: "Sign in", text: "Use the account your admin created for you." },
  { n: "2", title: "Mark attendance", text: "Open a class, create the session and tap Present, Late or Absent." },
  { n: "3", title: "Export reports", text: "Download or print summaries whenever you need them." },
];

const ROLES: { icon: LucideIcon; title: string; text: string; points: string[] }[] = [
  {
    icon: ShieldCheck,
    title: "Admins",
    text: "Run the system.",
    points: [
      "Create, edit and disable officer accounts",
      "Set the deduction points",
      "Review the full audit log",
      "Do everything an officer can do",
    ],
  },
  {
    icon: ClipboardCheck,
    title: "Officers",
    text: "Run the attendance.",
    points: [
      "Create sessions and mark attendance",
      "Manage the cadet roster",
      "Run reports and export files",
      "Keep their own profile and photo",
    ],
  },
];

const STRIP = [
  ["1CL · 2CL · 3CL · Aspirant", "Every class covered"],
  ["Present · Late · Absent", "Three simple statuses"],
  ["PDF · DOCX · Excel", "Export anywhere"],
  ["Audit log", "Every action recorded"],
];

const PREVIEW_ROWS = [
  { sn: "SN-0001", name: "Dela Cruz, Juan", status: "present" },
  { sn: "SN-0002", name: "Santos, Maria", status: "late" },
  { sn: "SN-0003", name: "Reyes, Andres", status: "present" },
  { sn: "SN-0004", name: "Garcia, Liza", status: "absent" },
] as const;

const PILLS = [
  { v: "present", label: "Present", on: "bg-emerald-600 text-white" },
  { v: "late", label: "Late", on: "bg-amber-500 text-white" },
  { v: "absent", label: "Absent", on: "bg-red-600 text-white" },
] as const;

// A small, non-interactive picture of the real attendance sheet
function AppPreview() {
  return (
    <div aria-hidden className="relative select-none">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-800/60 shadow-2xl shadow-black/40 ring-1 ring-white/5">
        <div className="flex items-center gap-1.5 border-b border-white/10 bg-slate-900/80 px-4 py-3">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 rounded-md bg-white/5 px-3 py-0.5 text-[10px] text-slate-400">
            {APP_NAME.toLowerCase()} / attendance / 1CL
          </span>
        </div>

        <div className="flex">
          <div className="hidden w-32 shrink-0 bg-slate-900 p-3 sm:block">
            <div className="mb-4 flex items-center gap-2">
              <Logo className="size-7 shrink-0 bg-white/10 p-0.5" />
              <span className="text-[11px] font-bold text-white">{BRAND_SHORT}</span>
            </div>
            {["Dashboard", "1CL", "2CL", "3CL", "Cadets", "Reports"].map((l, i) => (
              <div
                key={l}
                className={
                  "mb-1 rounded-md px-2 py-1.5 text-[10px] " +
                  (i === 1 ? "bg-emerald-500/15 text-emerald-400" : "text-slate-400")
                }
              >
                {l}
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1 bg-slate-100 p-4 text-slate-900">
            <p className="text-sm font-bold">Conference meeting</p>
            <p className="mb-3 text-[10px] text-slate-500">1CL · Open</p>

            <div className="mb-3 flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-700">Present 2</span>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-700">Late 1</span>
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-red-700">Absent 1</span>
            </div>

            <div className="rounded-xl border bg-white">
              {PREVIEW_ROWS.map((r, i) => (
                <div
                  key={r.sn}
                  className={"flex items-center justify-between gap-2 px-3 py-2 " + (i > 0 ? "border-t" : "")}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium">{r.name}</p>
                    <p className="font-mono text-[9px] text-slate-400">{r.sn}</p>
                  </div>
                  <div className="inline-flex shrink-0 overflow-hidden rounded-md border">
                    {PILLS.map((p) => (
                      <span
                        key={p.v}
                        className={
                          "px-1.5 py-1 text-[9px] font-medium " +
                          (r.status === p.v ? p.on : "bg-white text-slate-400")
                        }
                      >
                        {p.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2 text-[10px] font-medium">
              <span className="rounded-md border bg-white px-3 py-1.5">Save</span>
              <span className="rounded-md bg-slate-900 px-3 py-1.5 text-white">Save and mark as done</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 left-4 flex animate-[float_7s_ease-in-out_infinite] items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-900 shadow-xl motion-reduce:animate-none">
        <CheckCircle2 className="size-4 text-emerald-600" /> Attendance saved
      </div>
      <p className="mt-9 text-center text-[11px] text-slate-500">Sample data for illustration</p>
    </div>
  );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-600">{eyebrow}</p>
      <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {text ? <p className="mt-3 text-muted-foreground">{text}</p> : null}
    </div>
  );
}

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  const to = signedIn ? "/dashboard" : "/login";
  const label = signedIn ? "Open dashboard" : "Sign in";

  const primary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400";
  const secondary =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10";

  return (
    <div className="bg-muted/40 text-foreground">
      {/* HERO */}
      <section className="relative overflow-hidden bg-slate-900">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(55rem 28rem at 78% -8%, rgba(16,185,129,0.22), transparent 60%), linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "auto, 56px 56px, 56px 56px",
          }}
        />

        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <Logo className="size-10 shrink-0 bg-white/10 p-1" />
            <div className="leading-tight">
              <p className="font-bold text-white">{APP_NAME}</p>
              <p className="text-xs text-slate-400">{BRAND_SHORT}</p>
            </div>
          </div>
          <nav className="flex items-center gap-7">
            <a href="#features" className="hidden text-sm text-slate-300 hover:text-white md:block">
              Features
            </a>
            <a href="#how" className="hidden text-sm text-slate-300 hover:text-white md:block">
              How it works
            </a>
            <a href="#roles" className="hidden text-sm text-slate-300 hover:text-white md:block">
              Roles
            </a>
            <Link
              to={to}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              {label}
            </Link>
          </nav>
        </header>

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-12 lg:grid-cols-2 lg:pb-28 lg:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {BRAND_SHORT} · Officer attendance
            </span>
            <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Attendance that keeps <span className="text-emerald-400">in step</span> with your unit.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              {APP_NAME} helps officers create attendance sessions, mark every cadet Present, Late or Absent, and
              export clean reports in minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={to} className={primary}>
                {label} <ArrowRight className="size-4" />
              </Link>
              <a href="#how" className={secondary}>
                See how it works
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs text-slate-400">
              {["1CL", "2CL", "3CL", "Aspirant", "PDF", "DOCX", "Excel"].map((t) => (
                <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <AppPreview />
        </div>
      </section>

      {/* STRIP */}
      <div className="border-b border-white/10 bg-slate-950">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 lg:grid-cols-4">
          {STRIP.map(([big, small]) => (
            <div key={big}>
              <p className="text-sm font-semibold text-white">{big}</p>
              <p className="text-xs text-slate-400">{small}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-4 px-6 py-20">
        <SectionTitle
          eyebrow="Features"
          title="Everything an attendance day needs"
          text="One place to take attendance, keep the roster and produce the reports."
        />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border bg-card p-6 shadow-sm transition hover:border-emerald-500 hover:shadow-md"
            >
              <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <f.icon className="size-6" />
              </span>
              <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-4 border-y bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionTitle eyebrow="How it works" title="Three steps, every time" />
          <div className="grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-900 text-xl font-bold text-emerald-400">
                  {s.n}
                </span>
                <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" className="mx-auto max-w-5xl scroll-mt-4 px-6 py-20">
        <SectionTitle
          eyebrow="Roles"
          title="The right access for the right person"
          text="Accounts are created by an admin. There is no public sign-up."
        />
        <div className="grid gap-6 md:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <r.icon className="size-6" />
                </span>
                <div>
                  <h3 className="text-lg font-bold">{r.title}</h3>
                  <p className="text-sm text-muted-foreground">{r.text}</p>
                </div>
              </div>
              <ul className="space-y-3">
                {r.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-6 py-14 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(40rem 16rem at 50% 0%, rgba(16,185,129,0.22), transparent 70%)",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to take attendance?</h2>
            <p className="mx-auto mt-3 max-w-md text-slate-300">
              Sign in with your officer account and start your first session.
            </p>
            <Link to={to} className={primary + " mt-8"}>
              {label} <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-slate-900 px-6 py-8 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-3 text-white">
            <Logo className="size-8 shrink-0 bg-white/10 p-1" />
            <span className="font-semibold">
              {APP_NAME} · {BRAND_SHORT}
            </span>
          </div>
          <p>Officers only. Sign in to continue. © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}