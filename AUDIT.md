# Jumpstart Dashboard - Audit Technique (Feb 21, 2026)

## Résumé de l'audit

**Status global: READY FOR MVP** - L'application build, lint passe, architecture solide.

### Stack technique
- **Frontend/Backend**: Next.js 14 (App Router) avec Server Components
- **Base de données**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **UI**: Tailwind CSS + Radix UI + Recharts
- **Plateformes social**: Meta (FB+IG), LinkedIn, TikTok, YouTube, Twitter
- **Déploiement**: Vercel avec Cron jobs
- **Sécurité**: AES-256-GCM pour tokens, RLS multi-tenant, middleware auth

### Ce qui fonctionne ✅

1. **Build & Lint**
   - `npm run build` - OK (0 errors)
   - `npm run lint` - OK (0 warnings)
   - TypeScript compilation - OK

2. **Architecture multi-tenant**
   - RLS policies sur toutes les tables
   - Isolation complète entre tenants
   - Rôles: agency_admin, client_manager, client_user

3. **OAuth & Tokens**
   - 5 plateformes configurées (Meta, LinkedIn, TikTok, YouTube, Twitter)
   - Tokens chiffrés AES-256-GCM au repos
   - Refresh automatique avant expiration
   - Validation Meta token sans refresh (page tokens n'expirent pas)

4. **Synchronisation**
   - Cron daily sync avec auth Bearer
   - Rate limiting par plateforme
   - Logs de sync avec status/errors
   - Backfill endpoint pour historique

5. **Dashboard UI**
   - KPIs agrégés multi-plateformes
   - Graphiques de tendance avec comparaison période précédente
   - Top posts triés par performance
   - Export PDF/CSV
   - Filtres par période/plateforme/compte

6. **Ads tracking**
   - Modèle de données Meta + LinkedIn Ads
   - Métriques par campagne et par jour
   - KPIs: impressions, reach, clicks, spend, CTR, CPC, CPM

## Corrections appliquées lors de cet audit

### P1 - Corrigé

1. **Contrainte unicité `social_accounts`** (migration 0005)
   - Ajout: `UNIQUE (tenant_id, platform, external_account_id)`
   - Prévient les doublons de comptes sociaux par tenant

2. **Login: recherche profil par user.id**
   - Avant: recherche par email (fragile si email change)
   - Après: recherche par `auth.uid()` (robuste)
   - Fichier: `app/(auth)/login/page.tsx`

3. **Documentation complète**
   - README mis à jour avec instructions run local
   - Variables d'environnement documentées
   - Checklist de déploiement

### P2 - Documenté (non bloquant)

1. **YouTube views cumulées**
   - Limitation API: YouTube Data API retourne views totales de la chaîne
   - Pas de daily breakdown sans YouTube Analytics API (nécessite audit YouTube)
   - Documenté dans README comme limitation connue

2. **Twitter rate limits**
   - API v2 Basic tier très limité
   - Documenté comme plateforme "Limited"

## Structure des migrations

```
supabase/migrations/
├── 0001_init.sql                      # Schema initial + RLS
├── 0002_social_accounts_oauth_fixes.sql # Twitter enum + updated_at + last_error
├── 0003_collaboration_os.sql          # Collab items / Kanban
├── 0004_ads.sql                       # Ad accounts/campaigns/metrics
└── 0005_social_accounts_unique.sql    # Contrainte unicité (NOUVEAU)
```

## Endpoints API

### Cron (protégés par Bearer token)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cron/sync` | GET/POST | Sync quotidien metrics |
| `/api/cron/refresh-tokens` | GET/POST | Refresh tokens expirants |
| `/api/cron/backfill` | GET/POST | Backfill historique |
| `/api/cron/ads-sync` | GET/POST | Sync campagnes ads |

### OAuth callbacks

| Endpoint | Plateforme |
|----------|------------|
| `/api/oauth/meta/callback` | Facebook + Instagram |
| `/api/oauth/linkedin/callback` | LinkedIn |
| `/api/oauth/tiktok/callback` | TikTok |
| `/api/oauth/youtube/callback` | YouTube |
| `/api/oauth/twitter/callback` | Twitter/X |

### Export

| Endpoint | Description |
|----------|-------------|
| `/api/export/pdf` | Export PDF du dashboard |
| `/api/export/csv` | Export CSV des métriques |

## Risques identifiés (pour le futur)

1. **Pas de tests automatisés** - Recommandation: ajouter tests E2E avec Playwright
2. **Global sync sans queue** - OK pour < 50 tenants, prévoir queue pour scale
3. **Pas d'alerting** - Logs existent mais pas de notification sur erreurs cron
4. **Pas d'audit trail** - Les backfills modifient l'historique sans trace

## MVP Definition of Done ✅

- [x] Daily sync et token refresh fonctionnent (Vercel Cron GET + auth)
- [x] Dashboard affiche KPIs avec drill-down par plateforme
- [x] Pas de secrets hardcodés
- [x] `npm run build` passe
- [x] Lint non-interactif configuré
- [x] Admin health view montre status sync

## Run local (1 commande)

```bash
# Après configuration .env.local
npm install && npm run dev
```

## Comment tester chaque plateforme

### Meta (Facebook + Instagram)
1. Configurer `META_APP_ID` et `META_APP_SECRET`
2. Aller dans Admin > Client > "Connecter Meta"
3. Autoriser les permissions: pages_read_engagement, instagram_basic, etc.
4. Vérifier dans la page client que les comptes apparaissent

### LinkedIn
1. Configurer `LINKEDIN_CLIENT_ID` et `LINKEDIN_CLIENT_SECRET`
2. Créer une app LinkedIn avec produit "Community Management API"
3. Connecter via Admin > Client > "Connecter LinkedIn"
4. Sélectionner l'organisation à suivre

### TikTok
1. Configurer `TIKTOK_CLIENT_KEY` et `TIKTOK_CLIENT_SECRET`
2. App TikTok avec scope `user.info.basic`, `video.list`
3. Connecter via l'admin

### YouTube
1. Configurer `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`
2. Activer YouTube Data API v3 dans Google Cloud Console
3. Connecter via l'admin

### Twitter
1. Configurer `TWITTER_CLIENT_ID` et `TWITTER_CLIENT_SECRET`
2. App Twitter avec OAuth 2.0 User Context
3. Note: limites strictes sur Basic tier

## Fichiers modifiés dans cet audit

```
app/(auth)/login/page.tsx           # Fix recherche profil par user.id
supabase/migrations/0005_*.sql      # Contrainte unicité
README.md                           # Documentation complète
AUDIT.md                            # Ce fichier
```

---

*Audit réalisé par Claude Code - Feb 21, 2026*
