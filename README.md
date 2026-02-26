# Jumpstart Dashboard

Dashboard social media multi-clients (Meta/Instagram+Facebook, LinkedIn, TikTok, YouTube) avec synchronisation quotidienne et analytics par tenant.

## Quick Start (local)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file and configure
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Run Supabase migrations (if using Supabase CLI)
supabase db push
# OR apply SQL files in supabase/migrations/ manually in your Supabase dashboard

# 4. Start development server
npm run dev
```

L'application sera disponible sur http://localhost:3000

## Variables d'environnement

### Requises (runtime)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Supabase | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (backend only) | `eyJ...` |
| `NEXT_PUBLIC_SITE_URL` | URL publique de l'app | `https://app.example.com` |
| `ENCRYPTION_SECRET` | Secret pour chiffrer les tokens OAuth (32 chars) | `random-32-char-string` |
| `CRON_SECRET` | Secret pour auth des cron jobs | `random-long-string` |

### OAuth - Plateformes

| Plateforme | Variables | Portail développeur |
|------------|-----------|---------------------|
| **Meta** | `META_APP_ID`, `META_APP_SECRET` | [developers.facebook.com](https://developers.facebook.com) |
| **LinkedIn** | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | [developer.linkedin.com](https://developer.linkedin.com) |
| **TikTok** | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | [developers.tiktok.com](https://developers.tiktok.com) |
| **YouTube** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [console.cloud.google.com](https://console.cloud.google.com) |
| **Twitter/X** | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` | [developer.twitter.com](https://developer.twitter.com) |

### Optionnelles

| Variable | Description | Default |
|----------|-------------|---------|
| `DEMO_MODE` | Active le mode démo avec données mock | `false` |
| `CRON_ALLOW_QUERY_SECRET` | Autorise `?secret=` en plus du header | `false` |
| `YOUTUBE_API_KEY` | Clé API YouTube (alternative à OAuth) | - |

## Cron Jobs (Vercel)

Les cron jobs sont définis dans `vercel.json` et utilisent `Authorization: Bearer $CRON_SECRET`.

| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/cron/sync` | 0 3 * * * (3h UTC) | Sync quotidien des metrics |
| `/api/cron/refresh-tokens` | 0 2 * * * (2h UTC) | Refresh des tokens OAuth |

### Test local des crons

```bash
# Avec CRON_ALLOW_QUERY_SECRET=true
curl "http://localhost:3000/api/cron/sync?secret=YOUR_CRON_SECRET"

# Ou avec header (recommandé)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/sync
```

## Structure du projet

```
app/
├── (admin)/admin/        # Pages admin (gestion clients, connexions)
├── (auth)/login/         # Page de connexion
├── (client)/client/      # Dashboard client (stats, ads, documents)
├── api/
│   ├── cron/             # Endpoints cron (sync, refresh-tokens, backfill)
│   ├── oauth/            # Callbacks OAuth par plateforme
│   └── export/           # Export PDF/CSV
lib/
├── social-platforms/     # Connecteurs API par plateforme
│   ├── core/             # API client, rate limiter, token manager
│   ├── meta/             # Facebook + Instagram
│   ├── linkedin/
│   ├── tiktok/
│   ├── twitter/
│   └── youtube/
├── supabase/             # Clients Supabase (server + browser)
├── queries.ts            # Requêtes dashboard
└── sync.ts               # Logique de synchronisation
supabase/migrations/      # Migrations SQL
components/               # Composants UI
```

## Connecteurs - État

| Plateforme | Status | Notes |
|------------|--------|-------|
| Instagram | ✅ OK | Insights time series + posts media |
| Facebook | ✅ OK | Page insights + posts |
| LinkedIn | ✅ OK | Org stats + shares + follower gains |
| TikTok | ✅ OK | User info + videos + metrics |
| YouTube | ✅ OK | Channel stats + recent videos |
| Twitter | ⚠️ Limited | API v2 (Basic tier = limites strictes) |

## Commandes utiles

```bash
npm run dev           # Development server
npm run build         # Production build
npm run start         # Start production server
npm run lint          # ESLint
npm run security-check # Vérification isolation tenant
npm run seed:demo     # Seed du workspace demo
```

## Compte demo

La documentation complete est disponible dans `README-DEMO.md`.

## Déploiement Vercel

1. Connecter le repo GitHub à Vercel
2. Configurer les variables d'environnement dans Vercel Dashboard
3. Les crons sont auto-configurés via `vercel.json`
4. Exécuter les migrations sur Supabase avant le premier deploy

### Checklist pre-deploy

- [ ] Variables Supabase configurées
- [ ] `ENCRYPTION_SECRET` généré (32 chars aléatoires)
- [ ] `CRON_SECRET` généré (string long aléatoire)
- [ ] Au moins une plateforme OAuth configurée
- [ ] Migrations SQL appliquées sur Supabase

## Sécurité

- Tokens OAuth chiffrés avec AES-256-GCM
- RLS (Row Level Security) sur toutes les tables
- Middleware auth sur routes `/client` et `/admin`
- Cron protégé par Bearer token
- Aucun secret hardcodé dans le code

## Limitations connues

- **YouTube**: Les `views` sont cumulées (total de la chaîne), pas journalières
- **Twitter**: Rate limits stricts sur API v2 Basic tier
- **LinkedIn**: Stats disponibles sur 12 mois glissants max
- **Meta**: Insights IG Business limités à 30 jours

## Support

Pour toute question ou bug, ouvrir une issue sur le repository.
