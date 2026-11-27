import { createContext, useContext, useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentProfile, getLastProfileError, logAction, type Profile } from "@/lib/auth";
import { APP_NAME, APP_TAGLINE, BRAND_SHORT } from "@/lib/constants";
import { Avatar, AvatarDialog } from "@/components/AvatarDialog";
import { Logo } from "@/components/Logo";

const ProfileContext = createContext<Profile | null>(null);
export const useProfile = () => useContext(ProfileContext)!;
const UpdateProfileContext = createContext<(patch: Partial<Profile>) => void>(() => {});
export const useUpdateProfile = () => useContext(UpdateProfileContext);

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

// Shared by the desktop sidebar and the mobile drawer
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="mb-6 flex items-center gap-3 px-2 pt-2">
        {/* bg-white/10 gives dark logos a light tile; remove "bg-white/10 p-1" if your logo looks better without it */}
        <Logo className="size-11 shrink-0 bg-white/10 p-1" />
        <div>
          <p className="font-bold text-white">{BRAND_SHORT}</p>
          <p className="text-xs leading-tight text-slate-400">{APP_TAGLINE}</p>
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
                onClick={onNavigate}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors hover:bg-slate-800 md:py-2.5"
                activeProps={{ className: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15" }}
              >
                <it.icon className="size-4" />
                {it.label}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
    </>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [problem, setProblem] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

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
      if (event === "SIGNED_OUT") navigate({ to: "/login", replace: true });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  // Close the drawer whenever the page changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // While the drawer is open: Esc closes it and the page behind it doesn't scroll
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  async function signOut() {
    if (profile) await logAction("LOGOUT", `${profile.username} signed out`);
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
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
              navigate({ to: "/login", replace: true });
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
      <UpdateProfileContext.Provider value={(patch) => setProfile((p) => (p ? { ...p, ...patch } : p))}>
        <div className="flex min-h-screen bg-muted/40">
          {/* Desktop sidebar */}
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-slate-900 p-4 text-slate-300 md:flex">
            <SidebarNav />
          </aside>

          {/* Mobile drawer */}
          {menuOpen ? (
            <div className="fixed inset-0 z-40 md:hidden">
              <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
              <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col overflow-y-auto bg-slate-900 p-4 text-slate-300 shadow-xl">
                <button
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="size-5" />
                </button>
                <SidebarNav onNavigate={() => setMenuOpen(false)} />
              </aside>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3 md:px-6 md:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  aria-label="Open menu"
                  onClick={() => setMenuOpen(true)}
                  className="rounded-lg p-2 hover:bg-muted md:hidden"
                >
                  <Menu className="size-6" />
                </button>
                <div className="min-w-0">
                  <p className="truncate font-bold tracking-tight">{APP_NAME.toUpperCase()}</p>
                  <p className="hidden text-sm text-muted-foreground sm:block">{APP_TAGLINE}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="hidden text-right leading-tight sm:block">
                  <p className="font-medium">{profile.name}</p>
                  <p className="text-sm capitalize text-muted-foreground">{profile.role}</p>
                </div>
                <button
                  onClick={() => setAvatarOpen(true)}
                  title="Change profile photo"
                  aria-label="Change profile photo"
                  className="rounded-full ring-offset-2 transition hover:ring-2 hover:ring-emerald-500"
                >
                  <Avatar profile={profile} />
                </button>
                <button
                  onClick={signOut}
                  title="Sign out"
                  aria-label="Sign out"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="size-5" />
                </button>
              </div>
            </header>
            <main className="flex-1 p-4 md:p-10">
              <Outlet />
            </main>
          </div>
        </div>

        <AvatarDialog
          open={avatarOpen}
          onOpenChange={setAvatarOpen}
          profile={profile}
          onSaved={(url) => setProfile((p) => (p ? { ...p, avatar_url: url } : p))}
        />
      </UpdateProfileContext.Provider>
    </ProfileContext.Provider>
  );
}