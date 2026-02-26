# Demo Account

## Objectif
Mettre a disposition un workspace de demonstration complet, isole et non destructif.

## Pre-requis
- Migrations appliquees (`supabase db push` ou SQL dashboard)
- Variables env configurees:
  - `DEMO_ENABLED=true`
  - `DEMO_TENANT_NAME` (default: `JumpStart Demo`)
  - `DEMO_TENANT_SLUG` (default: `demo`)
  - `DEMO_USER_EMAIL` (default: `demo@jumpstart.studio`)
  - `DEMO_USER_PASSWORD` (obligatoire)
  - `DEMO_USER_FULL_NAME` (optionnel)
  - `DEMO_ACCESS_EXPIRES_AT` (optionnel, ISO datetime)
  - `DEMO_CONTACT_EMAIL` (optionnel)
  - `DEMO_PDF_WATERMARK` (`true|false`, default `true`)
  - `DEMO_PDF_WATERMARK_TEXT` (default `DEMO`)

## Seeder demo
```bash
npm run seed:demo
```

Le script est idempotent:
- recree/maintient le tenant `is_demo=true`
- recree/maintient l'utilisateur demo
- purge puis reinjecte un dataset synthetique coherent (90 jours)
- ne touche pas aux tenants non-demo

## Acces demo
- URL publique: `/demo`
- Le bouton "Acceder a la demo" effectue un login securise cote serveur
- Login standard aussi possible via `/login` avec `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`

## Activation / desactivation prod
- Activer: `DEMO_ENABLED=true`
- Desactiver immediatement: `DEMO_ENABLED=false`
- Expiration automatique: definir `DEMO_ACCESS_EXPIRES_AT`
- Rotation credentials:
  1. Changer `DEMO_USER_PASSWORD`
  2. Relancer `npm run seed:demo`

## Guardrails implementes
- Tenant flag: `tenants.is_demo`
- Blocage ecriture sur demo:
  - actions admin (sync/connecteurs/settings)
  - collaboration client (notes/shoots)
  - OAuth start + upsert comptes sociaux
  - sync cron/backfill ignores demo tenants
- Isolation acces:
  - si tenant principal utilisateur = demo, les listes multi-tenant sont filtrees demo-only
- Anti-abus:
  - rate limiting sur `POST /api/auth/login`
  - rate limiting strict sur `POST /api/demo/login`
- Observabilite:
  - logs structurés prefixes `[demo_access]`

## PDF demo
- Export PDF branche sur le meme dataset que le dashboard (`fetchDashboardData`)
- Watermark configurable pour tenant demo (`DEMO` par defaut)
- Top posts PDF derives de la meme logique d'affichage que l'UI

## Checklist RGPD / securite
- [x] Aucune PII reelle dans les donnees seedees
- [x] Donnees demo isolees par tenant
- [x] Pas de token social reel injecte dans demo
- [x] Ecritures sensibles bloquees en demo
- [x] Acces demo desactivable/expirable
- [x] Rate limiting applique

