import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { usernameToEmail } from "@/lib/constants";

type Role = "admin" | "officer";

function adminClient() {
  return createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Verifies the caller's session token and that they are an active admin.
async function requireAdmin(token: string) {
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("You are not signed in.");
  const { data: caller } = await admin
    .from("profiles")
    .select("id,name,role,active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!caller || !caller.active || caller.role !== "admin") throw new Error("Admins only.");
  return { admin, caller: caller as { id: string; name: string } };
}

async function audit(
  admin: ReturnType<typeof adminClient>,
  caller: { id: string; name: string },
  action: string,
  description: string,
) {
  await admin
    .from("audit_log")
    .insert({ user_id: caller.id, user_name: caller.name, action, description });
}

export const ensureDemoAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const admin = adminClient();
  const email = usernameToEmail("admin");
  let userId: string | undefined;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "admin12345",
    email_confirm: true,
  });

  if (error) {
    if (!/already|registered/i.test(error.message)) throw error;
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    userId = list?.users.find((u) => u.email === email)?.id;
  } else {
    userId = data.user?.id;
  }

  if (userId) {
    await admin
      .from("profiles")
      .upsert(
        { id: userId, name: "Admin", username: "admin", role: "admin", active: true },
        { onConflict: "id", ignoreDuplicates: true },
      );
  }
  return { ok: true };
});

export const createOfficer = createServerFn({ method: "POST" })
  .validator(
    (d: { token: string; name: string; username: string; password: string; role: Role }) => d,
  )
  .handler(async ({ data }) => {
    const { admin, caller } = await requireAdmin(data.token);
    const name = data.name.trim();
    const username = data.username.trim().toLowerCase();

    if (!name) throw new Error("Name is required.");
    if (!/^[a-z0-9._-]{3,30}$/.test(username))
      throw new Error("Username must be 3 to 30 letters, numbers, dots, dashes or underscores.");
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (!["admin", "officer"].includes(data.role)) throw new Error("Invalid role.");

    const { data: created, error } = await admin.auth.admin.createUser({
      email: usernameToEmail(username),
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) {
      throw new Error(
        /already|registered/i.test(error?.message ?? "")
          ? "That username is already taken."
          : (error?.message ?? "Could not create the account."),
      );
    }

    const { error: pErr } = await admin
      .from("profiles")
      .insert({ id: created.user.id, name, username, role: data.role, active: true });
    if (pErr) {
      await admin.auth.admin.deleteUser(created.user.id); // roll back
      throw new Error(pErr.code === "23505" ? "That username is already taken." : pErr.message);
    }

    await audit(admin, caller, "CREATE_OFFICER", `Created ${data.role} account "${username}"`);
    return { ok: true };
  });

export const updateOfficer = createServerFn({ method: "POST" })
  .validator((d: { token: string; id: string; name: string; role: Role; active: boolean }) => d)
  .handler(async ({ data }) => {
    const { admin, caller } = await requireAdmin(data.token);
    const name = data.name.trim();
    if (!name) throw new Error("Name is required.");
    if (!["admin", "officer"].includes(data.role)) throw new Error("Invalid role.");
    if (data.id === caller.id && (data.role !== "admin" || !data.active))
      throw new Error("You can't remove your own admin access or disable your own account.");

    const { data: target } = await admin
      .from("profiles")
      .select("username")
      .eq("id", data.id)
      .maybeSingle();
    if (!target) throw new Error("Officer not found.");

    const { error } = await admin
      .from("profiles")
      .update({ name, role: data.role, active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Disabled officers can't sign in at all
    const { error: banErr } = await admin.auth.admin.updateUserById(data.id, {
      ban_duration: data.active ? "none" : "876000h",
    });
    if (banErr) throw new Error(banErr.message);

    await audit(
      admin,
      caller,
      "UPDATE_OFFICER",
      `Updated "${target.username}" (${data.role}, ${data.active ? "active" : "disabled"})`,
    );
    return { ok: true };
  });

export const resetOfficerPassword = createServerFn({ method: "POST" })
  .validator((d: { token: string; id: string; password: string }) => d)
  .handler(async ({ data }) => {
    const { admin, caller } = await requireAdmin(data.token);
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters.");

    const { data: target } = await admin
      .from("profiles")
      .select("username")
      .eq("id", data.id)
      .maybeSingle();
    if (!target) throw new Error("Officer not found.");

    const { error } = await admin.auth.admin.updateUserById(data.id, { password: data.password });
    if (error) throw new Error(error.message);

    await audit(admin, caller, "RESET_PASSWORD", `Reset password for "${target.username}"`);
    return { ok: true };
  });