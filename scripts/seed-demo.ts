import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildDemoSeedPayload } from "../lib/demo-seed";

type DemoSocialAccountSeed = {
  platform: "instagram" | "facebook" | "linkedin";
  account_name: string;
  external_account_id: string;
};

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sepIndex = trimmed.indexOf("=");
    if (sepIndex < 1) continue;
    const key = trimmed.slice(0, sepIndex).trim();
    const rawValue = trimmed.slice(sepIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} est requis.`);
  }
  return value;
}

async function run() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const demoEmail = process.env.DEMO_USER_EMAIL?.trim() || "demo@jumpstart.studio";
  const demoPassword = required("DEMO_USER_PASSWORD");
  const demoName = process.env.DEMO_USER_FULL_NAME?.trim() || "JumpStart Demo User";
  const tenantName = process.env.DEMO_TENANT_NAME?.trim() || "JumpStart Demo";
  const tenantSlug = process.env.DEMO_TENANT_SLUG?.trim() || "demo";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("[seed:demo] Starting...");

  // 1) Upsert tenant
  const { data: existingTenant, error: tenantLookupError } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .maybeSingle();
  if (tenantLookupError) throw tenantLookupError;

  let tenantId = existingTenant?.id;
  if (!tenantId) {
    const { data: insertedTenant, error: tenantInsertError } = await supabase
      .from("tenants")
      .insert({
        name: tenantName,
        slug: tenantSlug,
        is_active: true,
        is_demo: true,
      })
      .select("id")
      .single();
    if (tenantInsertError || !insertedTenant?.id) {
      throw tenantInsertError || new Error("Impossible de creer le tenant demo.");
    }
    tenantId = insertedTenant.id;
    console.log(`[seed:demo] Tenant created: ${tenantId}`);
  } else {
    const { error: tenantUpdateError } = await supabase
      .from("tenants")
      .update({ name: tenantName, is_active: true, is_demo: true })
      .eq("id", tenantId);
    if (tenantUpdateError) throw tenantUpdateError;
    console.log(`[seed:demo] Tenant updated: ${tenantId}`);
  }

  // 2) Upsert auth user
  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;

  let user = usersPage.users.find((item) => item.email?.toLowerCase() === demoEmail.toLowerCase());
  if (!user) {
    const { data: created, error: createUserError } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { full_name: demoName },
    });
    if (createUserError || !created?.user) {
      throw createUserError || new Error("Impossible de creer l'utilisateur demo.");
    }
    user = created.user;
    console.log(`[seed:demo] Demo user created: ${user.id}`);
  } else {
    const { data: updated, error: updateUserError } = await supabase.auth.admin.updateUserById(user.id, {
      password: demoPassword,
      email_confirm: true,
      user_metadata: { full_name: demoName },
    });
    if (updateUserError || !updated?.user) {
      throw updateUserError || new Error("Impossible de mettre a jour l'utilisateur demo.");
    }
    user = updated.user;
    console.log(`[seed:demo] Demo user updated: ${user.id}`);
  }

  // 3) Lock profile + access to demo tenant only
  const { error: profileUpsertError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: demoEmail,
      full_name: demoName,
      role: "client_user",
      tenant_id: tenantId,
    },
    { onConflict: "id" }
  );
  if (profileUpsertError) throw profileUpsertError;

  const { error: cleanupAccessError } = await supabase
    .from("user_tenant_access")
    .delete()
    .eq("user_id", user.id)
    .neq("tenant_id", tenantId);
  if (cleanupAccessError) throw cleanupAccessError;

  const { error: accessUpsertError } = await supabase.from("user_tenant_access").upsert(
    { user_id: user.id, tenant_id: tenantId },
    { onConflict: "user_id,tenant_id" }
  );
  if (accessUpsertError) throw accessUpsertError;

  // 4) Clean existing demo analytics payload (idempotent reset)
  const cleanupTables = [
    "tenant_goals",
    "score_snapshots",
    "documents",
    "upcoming_shoots",
    "collaboration",
    "social_posts",
    "social_daily_metrics",
    "sync_logs",
    "social_accounts",
  ] as const;
  for (const table of cleanupTables) {
    const { error: cleanupError } = await supabase.from(table).delete().eq("tenant_id", tenantId);
    if (cleanupError) throw cleanupError;
  }

  // 5) Recreate demo social accounts (no real OAuth token)
  const accountSeeds: DemoSocialAccountSeed[] = [
    {
      platform: "instagram",
      account_name: "JumpStart Demo - Instagram",
      external_account_id: "demo-instagram-main",
    },
    {
      platform: "facebook",
      account_name: "JumpStart Demo - Facebook",
      external_account_id: "demo-facebook-main",
    },
    {
      platform: "linkedin",
      account_name: "JumpStart Demo - LinkedIn",
      external_account_id: "urn:li:organization:demo-jumpstart",
    },
  ];

  const { data: insertedAccounts, error: accountInsertError } = await supabase
    .from("social_accounts")
    .insert(
      accountSeeds.map((account) => ({
        tenant_id: tenantId,
        platform: account.platform,
        account_name: account.account_name,
        external_account_id: account.external_account_id,
        auth_status: "active",
        token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
      }))
    )
    .select("id,platform");
  if (accountInsertError) throw accountInsertError;

  const accountMap = {
    instagram: insertedAccounts?.find((item) => item.platform === "instagram")?.id || "",
    facebook: insertedAccounts?.find((item) => item.platform === "facebook")?.id || "",
    linkedin: insertedAccounts?.find((item) => item.platform === "linkedin")?.id || "",
  };
  if (!accountMap.instagram || !accountMap.facebook || !accountMap.linkedin) {
    throw new Error("Impossible de recuperer les comptes sociaux demo.");
  }

  // 6) Insert coherent synthetic analytics payload
  const payload = buildDemoSeedPayload(tenantId, accountMap, new Date());

  const { error: metricsError } = await supabase.from("social_daily_metrics").upsert(payload.metrics, {
    onConflict: "tenant_id,platform,social_account_id,date",
  });
  if (metricsError) throw metricsError;

  const { error: postsError } = await supabase.from("social_posts").upsert(payload.posts, {
    onConflict: "tenant_id,platform,social_account_id,external_post_id",
  });
  if (postsError) throw postsError;

  const { error: collaborationError } = await supabase
    .from("collaboration")
    .upsert(payload.collaboration, { onConflict: "tenant_id" });
  if (collaborationError) throw collaborationError;

  const { error: shootsError } = await supabase.from("upcoming_shoots").insert(payload.shoots);
  if (shootsError) throw shootsError;

  const { error: documentsError } = await supabase.from("documents").insert(payload.documents);
  if (documentsError) throw documentsError;

  const { error: scoreError } = await supabase.from("score_snapshots").upsert(payload.scoreSnapshots, {
    onConflict: "tenant_id,snapshot_date",
  });
  if (scoreError) throw scoreError;

  const { error: goalsError } = await supabase
    .from("tenant_goals")
    .upsert(payload.goals, { onConflict: "tenant_id" });
  if (goalsError) throw goalsError;

  console.log("[seed:demo] Done.");
  console.log(`[seed:demo] Tenant: ${tenantName} (${tenantSlug})`);
  console.log(`[seed:demo] User: ${demoEmail}`);
  console.log(`[seed:demo] Metrics rows: ${payload.metrics.length}`);
  console.log(`[seed:demo] Posts rows: ${payload.posts.length}`);
}

run().catch((error) => {
  console.error("[seed:demo] failed", error);
  process.exit(1);
});

