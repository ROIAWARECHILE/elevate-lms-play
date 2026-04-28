// Edge function: admin-delete-user
// Deletes a user completely (auth.users + all related data) when invoked by an admin
// of the same company. Uses the service role key to perform the auth deletion.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }

    // Verify caller identity using their JWT.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Invalid session" }, 401);
    }
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body?.target_user_id;
    if (!targetUserId) return json({ error: "target_user_id required" }, 400);
    if (targetUserId === callerId) {
      return json({ error: "You cannot delete yourself" }, 400);
    }

    // Service-role client for privileged operations.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Confirm caller is admin of the same company as the target.
    const [{ data: callerProfile }, { data: targetProfile }, { data: roles }] =
      await Promise.all([
        admin.from("profiles").select("company_id").eq("id", callerId).maybeSingle(),
        admin.from("profiles").select("company_id").eq("id", targetUserId).maybeSingle(),
        admin.from("user_roles").select("role").eq("user_id", callerId),
      ]);

    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) return json({ error: "Not admin" }, 403);
    if (!callerProfile?.company_id) return json({ error: "No company" }, 400);
    if (!targetProfile || targetProfile.company_id !== callerProfile.company_id) {
      return json({ error: "User not in your company" }, 403);
    }

    const companyId = callerProfile.company_id;

    // Delete all user-scoped data. Order matters only for FK-less integrity;
    // we perform best-effort cleanup before removing the auth user.
    const tables = [
      "user_xp_log",
      "user_progress",
      "user_mistakes",
      "user_achievements",
      "daily_quests",
      "srs_items",
      "user_skill_profile",
    ] as const;

    for (const t of tables) {
      const { error } = await admin.from(t).delete().eq("user_id", targetUserId);
      if (error) console.error(`cleanup ${t}`, error.message);
    }

    await admin.from("user_roles").delete().eq("user_id", targetUserId);
    await admin.from("profiles").delete().eq("id", targetUserId);

    // Finally, delete the auth user. This also removes their session.
    const { error: authDelErr } = await admin.auth.admin.deleteUser(targetUserId);
    if (authDelErr) {
      console.error("auth.deleteUser error", authDelErr);
      return json(
        { error: `Failed to delete auth user: ${authDelErr.message}` },
        500,
      );
    }

    return json({ success: true, company_id: companyId });
  } catch (e) {
    console.error("admin-delete-user fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
