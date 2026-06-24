import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEMO_PASSWORD = "Demo1234!";
const DEMO_USERS = [
  { email: "manager1@demo.com", full_name: "Morgan Lee", role: "manager" as const, job_title: "Operations Manager" },
  { email: "employee1@demo.com", full_name: "Alex Chen", role: "employee" as const, job_title: "Account Executive" },
  { email: "employee2@demo.com", full_name: "Priya Patel", role: "employee" as const, job_title: "Support Specialist" },
  { email: "employee3@demo.com", full_name: "Diego Ramirez", role: "employee" as const, job_title: "Sales Associate" },
];

const SAMPLE_TASKS = [
  { title: "Onboard Acme Corp", description: "Send welcome packet and schedule kick-off call.", priority: "high", status: "in_progress", offsetDays: 2 },
  { title: "Quarterly performance review prep", description: "Compile KPIs for Q review.", priority: "medium", status: "pending", offsetDays: 7 },
  { title: "Fix invoice template footer", description: "Logo overlapping address block.", priority: "low", status: "pending", offsetDays: 4 },
  { title: "Follow up with Globex lead", description: "Send proposal v2 with updated pricing.", priority: "critical", status: "pending", offsetDays: 1 },
  { title: "Update employee handbook", description: "Add new PTO policy.", priority: "medium", status: "completed", offsetDays: -3 },
  { title: "Renew SSL certificate", description: "Production cert expires soon.", priority: "high", status: "in_progress", offsetDays: 10 },
] as const;

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Verify caller is admin
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const createdProfiles: { id: string; email: string; role: string }[] = [];

    for (const u of DEMO_USERS) {
      // Try create; if already exists, fetch
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      let id: string;
      if (createErr || !created?.user) {
        // Likely exists
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = list?.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
        if (!existing) throw new Error(`Could not create or find ${u.email}: ${createErr?.message}`);
        id = existing.id;
      } else {
        id = created.user.id;
      }
      // Ensure profile fields
      await supabaseAdmin.from("profiles").update({ full_name: u.full_name, job_title: u.job_title }).eq("id", id);
      // Ensure correct role
      await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: u.role }, { onConflict: "user_id,role" });
      createdProfiles.push({ id, email: u.email, role: u.role });
    }

    // Assign employees to manager
    const manager = createdProfiles.find((p) => p.role === "manager");
    const employees = createdProfiles.filter((p) => p.role === "employee");
    if (manager) {
      await supabaseAdmin
        .from("profiles")
        .update({ manager_id: manager.id })
        .in("id", employees.map((e) => e.id));
    }

    // Insert sample tasks (only if none exist yet)
    const { count } = await supabaseAdmin.from("tasks").select("*", { count: "exact", head: true });
    if (!count) {
      const allAssignees = [userId, ...employees.map((e) => e.id)];
      const now = Date.now();
      const rows = SAMPLE_TASKS.map((t, i) => ({
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        due_date: new Date(now + t.offsetDays * 86400000).toISOString(),
        assigned_to: allAssignees[i % allAssignees.length],
        created_by: userId,
        completed_at: t.status === "completed" ? new Date().toISOString() : null,
      }));
      await supabaseAdmin.from("tasks").insert(rows);
    }

    return {
      ok: true,
      created: createdProfiles.length,
      credentials: DEMO_USERS.map((u) => ({ email: u.email, password: DEMO_PASSWORD, role: u.role })),
    };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "admin" | "manager" | "employee" }) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "manager", "employee"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Replace existing role(s) with this single role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; active: boolean }) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ is_active: data.active }).eq("id", data.userId);
    return { ok: true };
  });
