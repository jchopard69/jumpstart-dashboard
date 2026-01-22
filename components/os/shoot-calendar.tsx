import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyShoots } from "@/components/ui/empty-state";
import type { UpcomingShoot } from "@/lib/types/dashboard";

type ShootCalendarProps = {
  shoots: UpcomingShoot[];
  canEdit: boolean;
  addShootAction: (formData: FormData) => Promise<void>;
};

function formatShootDate(dateStr: string): { day: string; month: string; weekday: string } {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleDateString("fr-FR", { month: "short" });
  const weekday = date.toLocaleDateString("fr-FR", { weekday: "short" });
  return { day, month, weekday };
}

function isUpcoming(dateStr: string): boolean {
  const shootDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((shootDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
}

export function ShootCalendar({ shoots, canEdit, addShootAction }: ShootCalendarProps) {
  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
        <h2 className="section-title">Tournages à venir</h2>
      </div>
      <div className="mt-4 space-y-3">
        {shoots.length === 0 ? (
          <EmptyShoots />
        ) : (
          shoots.map((shoot) => {
            const { day, month, weekday } = formatShootDate(shoot.shoot_date);
            const upcoming = isUpcoming(shoot.shoot_date);
            return (
              <div
                key={shoot.id}
                className={`group flex items-start gap-4 rounded-xl border p-4 transition-all ${
                  upcoming
                    ? "border-purple-200 bg-purple-50/50"
                    : "border-border/60 hover:border-purple-200 hover:bg-purple-50/30"
                }`}
              >
                <div className="flex flex-col items-center rounded-lg bg-white px-3 py-2 shadow-sm border border-border/40">
                  <span className="text-lg font-bold leading-none">{day}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{month}</span>
                  <span className="text-[10px] text-muted-foreground">{weekday}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{shoot.location ?? "Lieu à définir"}</p>
                  {shoot.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{shoot.notes}</p>
                  )}
                  {upcoming && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Cette semaine
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {canEdit && (
        <form action={addShootAction} className="mt-4 space-y-3 border-t border-border/40 pt-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Nouveau tournage</p>
          <Input name="shoot_date" type="date" required />
          <Input name="location" placeholder="Lieu" />
          <Textarea name="notes" placeholder="Notes" rows={2} />
          <Button type="submit" className="w-full">
            Ajouter un tournage
          </Button>
        </form>
      )}
    </Card>
  );
}
