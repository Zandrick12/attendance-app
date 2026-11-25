import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { usernameToEmail } from "@/lib/constants";

export const ensureDemoAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const admin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const email = usernameToEmail("admin");
  let userId: string | undefined;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "admin12345",
    email_confirm: true,
  });

  if (error) {
    if (!/already|registered/i.test(error.message)) throw error;
    // Account exists already: find its id
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    userId = list?.users.find((u) => u.email === email)?.id;
  } else {
    userId = data.user?.id;
  }

  // Create the profile once (ignoreDuplicates keeps any later edits)
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