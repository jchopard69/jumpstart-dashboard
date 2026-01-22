import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionProfile, requireClientAccess } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PriorityBoard } from "@/components/os/priority-board";
import { QuickAddForm } from "@/components/os/quick-add-form";
import { NextStepsTracker } from "@/components/os/next-steps-tracker";
import { IdeasList } from "@/components/os/ideas-list";
import { KanbanBoard } from "@/components/os/kanban-board";
import { ShootCalendar } from "@/components/os/shoot-calendar";
import { NotesEditor } from "@/components/os/notes-editor";

const PIPELINE_KINDS = ["shoot", "edit", "publish"];

export default async function ClientOsPage() {
  const profile = await getSessionProfile();
  if (profile.role === "agency_admin") {
    if (!profile.tenant_id) {
      redirect("/admin");
    }
  } else {
    requireClientAccess(profile);
  }

  const supabase = createSupabaseServerClient();
  const canEdit = profile.role === "agency_admin" || profile.role === "client_manager";

  const [{ data: collaboration }, { data: shoots }, { data: items }] = await Promise.all([
    supabase
      .from("collaboration")
      .select("shoot_days_remaining,notes,updated_at")
      .eq("tenant_id", profile.tenant_id)
      .single(),
    supabase
      .from("upcoming_shoots")
      .select("id,shoot_date,location,notes")
      .eq("tenant_id", profile.tenant_id)
      .order("shoot_date", { ascending: true }),
    supabase
      .from("collab_items")
      .select("id,title,description,kind,status,priority,due_date,owner,sort_order,created_at")
      .eq("tenant_id", profile.tenant_id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
  ]);

  const pipelineItems = (items ?? []).filter((item) => PIPELINE_KINDS.includes(item.kind));
  const ideas = (items ?? []).filter((item) => item.kind === "idea");
  const nextSteps = (items ?? []).filter((item) => item.kind === "next_step");
  const monthlyPriorities = (items ?? []).filter((item) => item.kind === "monthly_priority");

  async function createItem(formData: FormData) {
    "use server";
    const title = String(formData.get("title") ?? "").trim();
    const kind = String(formData.get("kind") ?? "idea");
    const priority = String(formData.get("priority") ?? "medium");
    const dueDateRaw = String(formData.get("due_date") ?? "");
    const owner = String(formData.get("owner") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!title) return;
    const client = createSupabaseServerClient();
    await client.from("collab_items").insert({
      tenant_id: profile.tenant_id,
      title,
      kind,
      priority,
      status: "planned",
      due_date: dueDateRaw || null,
      owner: owner || null,
      description: description || null
    });
    revalidatePath("/client/os");
  }

  async function updateItemStatus(formData: FormData) {
    "use server";
    const itemId = String(formData.get("item_id") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!itemId || !status) return;
    const client = createSupabaseServerClient();
    await client
      .from("collab_items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    revalidatePath("/client/os");
  }

  async function updateNotes(formData: FormData) {
    "use server";
    const notes = String(formData.get("notes") ?? "");
    const client = createSupabaseServerClient();
    await client
      .from("collaboration")
      .upsert({ tenant_id: profile.tenant_id, notes, updated_at: new Date().toISOString() });
    revalidatePath("/client/os");
  }

  async function addShoot(formData: FormData) {
    "use server";
    const shootDate = String(formData.get("shoot_date") ?? "");
    const location = String(formData.get("location") ?? "");
    const notes = String(formData.get("notes") ?? "");
    if (!shootDate) return;
    const client = createSupabaseServerClient();
    await client.from("upcoming_shoots").insert({
      tenant_id: profile.tenant_id,
      shoot_date: shootDate,
      location: location || null,
      notes: notes || null
    });
    revalidatePath("/client/os");
  }

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">JumpStart OS</p>
            <h1 className="page-heading">Collaboration & Production</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Suivi des contenus, priorités et prochaines actions pour garder le rythme.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Jours de tournage</p>
            <p className="text-2xl font-semibold">{collaboration?.shoot_days_remaining ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PriorityBoard priorities={monthlyPriorities} />
        <QuickAddForm canEdit={canEdit} createItemAction={createItem} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NextStepsTracker nextSteps={nextSteps} />
        <IdeasList ideas={ideas} />
      </section>

      <KanbanBoard items={pipelineItems} canEdit={canEdit} updateStatusAction={updateItemStatus} />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ShootCalendar shoots={shoots ?? []} canEdit={canEdit} addShootAction={addShoot} />
        <NotesEditor
          notes={collaboration?.notes ?? null}
          updatedAt={collaboration?.updated_at ?? null}
          canEdit={canEdit}
          updateNotesAction={updateNotes}
        />
      </section>
    </div>
  );
}
