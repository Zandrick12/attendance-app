import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { usernameToEmail } from "@/lib/constants";

export const ensureDemoAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const admin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { error } = await admin.auth.admin.createUser({
    email: usernameToEmail("admin"),
    password: "admin12345",
    email_confirm: true,
  });
  if (error && !/already/i.test(error.message)) throw error;
  return { ok: true };
});