import { LoginForm } from "./login-form";
import { isDemoEnabled } from "@/lib/demo";

export default function LoginPage() {
  return (
    <div className="min-h-screen gradient-hero px-6 py-12">
      <div className="mx-auto grid w-full max-w-5xl items-stretch gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-panel jumpstart-header flex flex-col justify-between p-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="jumpstart-brand-mark" aria-hidden="true">J</div>
              <div>
                <p className="text-sm font-semibold text-foreground">JumpStart</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Studio</p>
              </div>
              <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Accès sécurisé</span>
            </div>
            <h1 className="mt-6 text-3xl font-semibold font-display">
              Votre intelligence sociale, centralisée.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Pilotez la stratégie digitale de vos clients avec des données consolidées, des insights actionnables et un suivi premium.
            </p>
          </div>
          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            <p>&#10004; Scoring propriétaire JumpStart Score</p>
            <p>&#10004; Insights stratégiques auto-générés</p>
            <p>&#10004; Rapports PDF premium prêts à partager</p>
          </div>
        </div>

        <LoginForm demoEnabled={isDemoEnabled()} />
      </div>
    </div>
  );
}
