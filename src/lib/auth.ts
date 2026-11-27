import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  name: string;
  username: string;
  role: "admin" | "officer";
  active: boolean;
  avatar_url: string | null;
  cadet_rank: string | null;
  cadet_class: string | null;
  cadet_position: string | null;
};

let lastProfileError = "";
export const getLastProfileError = () => lastProfileError;

export async function getCurrentProfile(): Promise<Profile | null> {
  lastProfileError = "";
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    lastProfileError = "Session error: " + userError.message;
    return null;
  }
  if (!user) {
    lastProfileError = "No signed-in user found.";
    return null;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,username,role,active,avatar_url,cadet_rank,cadet_class,cadet_position")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    lastProfileError = "Profile query error: " + error.message;
    return null;
  }
  if (!data) {
    lastProfileError = `No profile row for user id ${user.id} (${user.email}).`;
    return null;
  }
  return data as Profile;
}

// Writes a row to the audit_log table. Never blocks or breaks the caller.
export async function logAction(action: string, description: string) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return;
    await supabase.from("audit_log").insert({
      user_id: profile.id,
      user_name: profile.name,
      action,
      description,
    });
  } catch (e) {
    console.error("logAction failed", e);
  }
}