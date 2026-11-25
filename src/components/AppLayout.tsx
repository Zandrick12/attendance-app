import { createContext, useContext, useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentProfile, getLastProfileError, logAction, type Profile } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";

const ProfileContext = createContext<Profile | null>(null);
export const useProfile = () => useContext(ProfileContext)!;

const NavLink = Link as any; // keeps nav simple; routes are checked at runtime

type Item = { label: string; to: string; params?: Record<string, string>; icon: typeof Users };
const groups: { title?: string; items: Item[] }[] = [
  { items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Attendance",
    items: ["1CL", "2CL", "3CL", "Aspirant"].map((c) => ({
      label: c,
      to: "/attendance/$cls",
      params: { cls: c },
      icon: ClipboardList,
    })),
  },
  {
    title: "Management",
    items: [
      { label: "Cadets", to: "/cadets", icon: Users },
      { label: "Officers", to: "/officers", icon: Shield },
      { label: "Attendance History", to: "/history", icon: History },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Reports", to: "/reports", icon: FileText },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];

export function AppLayout() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getCurrentProfile();
      if (cancelled) return;
            if (!p || !p.active) {
        setProblem(p ? "This profile is marked inactive." : getLastProfileError());
        return;
      }
     
      setProfile(p);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/", replace: true });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function signOut() {
    if (profile) await logAction("LOGOUT", `${profile.username} signed out`);
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }
    if (problem) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-card p-6 shadow">
          <h2 className="mb-2 text-lg font-bold">Could not load your profile</h2>
          <p className="mb-4 break-words text-sm text-muted-foreground">{problem}</p>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/", replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <ProfileContext.Provider value={profile}>
      <div className="flex min-h-screen bg-muted/40">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-slate-900 p-4 text-slate-300 md:flex">
          <div className="mb-6 flex items-center gap-3 px-2 pt-2">
            <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <ShieldCheck className="size-6" />
            </span>
            <div>
              <p className="font-bold text-white">AMS</p>
              <p className="text-xs leading-tight text-slate-400">Officer Attendance Management</p>
            </div>
          </div>

          {groups.map((g, i) => (
            <div key={i} className="mb-4">
              {g.title ? (
                <p className="mb-2 px-3 text-xs font-medium uppercase tracking-widest text-slate-500">
                  {g.title}
                </p>
              ) : null}
              <nav className="space-y-1">
                {g.items.map((it) => (
                  <NavLink
                    key={it.label}
                    to={it.to}
                    params={it.params}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-slate-800"
                    activeProps={{ className: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15" }}
                  >
                    <it.icon className="size-4" />
                    {it.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b bg-card px-6 py-4">
            <div>
              <p className="font-bold tracking-tight">{APP_NAME.toUpperCase()}</p>
              <p className="text-sm text-muted-foreground">Officer Attendance Management</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <p className="font-medium">{profile.name}</p>
                <p className="text-sm capitalize text-muted-foreground">{profile.role}</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-full bg-slate-900 font-semibold text-white">
                {profile.name.charAt(0).toUpperCase()}
              </span>
              <button
                onClick={signOut}
                title="Sign out"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-5" />
              </button>
            </div>
          </header>
          <main className="flex-1 p-6 md:p-10">
            <Outlet />
          </main>
        </div>
      </div>
    </ProfileContext.Provider>
  );
}