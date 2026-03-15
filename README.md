# Hotel PMS — Plateforme SaaS de Gestion Hôtelière

Plateforme complète multi-tenant de gestion hôtelière (Property Management System) avec module web et application mobile Android POS.

## Architecture

```
hotel-pms/
├── backend/          # API REST — Node.js/Express + TypeScript + Prisma + PostgreSQL
├── frontend/         # Interface Web — Next.js 14 (App Router) + TypeScript + Tailwind CSS
├── android/          # App POS — Kotlin + Jetpack Compose
└── docker-compose.yml
```

## Stack Technique

| Couche | Technologie |
|--------|-------------|
| Frontend Web | Next.js 14+, TypeScript, Tailwind CSS, React Query, Zustand |
| Backend API | Node.js, Express, TypeScript, Zod |
| ORM / DB | Prisma + PostgreSQL 15+ |
| Cache | Redis |
| Auth | JWT (access + refresh tokens), bcrypt, RBAC |
| Paiement | Stripe (Checkout Sessions, Webhooks) |
| Mobile POS | Kotlin, Jetpack Compose, Room DB, Retrofit, Hilt |
| DevOps | Docker, Docker Compose |

## Modules Fonctionnels

1. **Multi-tenant** — Isolation par `tenant_id`, middleware Prisma automatique
2. **Authentification** — JWT dual-token, RBAC 4 niveaux (SuperAdmin/Admin/Manager/Employé)
3. **Utilisateurs** — CRUD, approbation par admin, archivage automatique des comptes inactifs, isolation par établissement
4. **Établissements** — Multi-établissement par tenant, admin dédié par établissement
5. **Chambres** — CRUD, gestion des statuts, filtres avancés
6. **Réservations** — CRUD, check-in/check-out, anti-double-booking transactionnel
7. **Factures** — Lifecycle complet (brouillon → émise → payée), numérotation auto
8. **Paiements** — Multi-méthodes, idempotence POS via UUID
9. **Stock & Inventaire** — Articles, catégories, mouvements, alertes stock bas
10. **Fournisseurs** — CRUD complet
11. **Intégrations** — API disponibilité (JSON/iCal), Channel Manager, POS Android
12. **Inscription & Abonnements** — Inscription self-service avec paiement Stripe, plans Basic/Pro/Enterprise, gestion du cycle de vie abonnement via webhooks

## Démarrage Rapide

### Prérequis

- Docker et Docker Compose
- Node.js 20+ (si dev sans Docker)
- Android Studio (pour l'app POS)

### Avec Docker (recommandé)

```bash
# Cloner et démarrer
cd hotel-pms
docker compose up -d

# Exécuter les migrations et le seed
docker exec -it hotel-pms-api npx prisma migrate dev
docker exec hotel-pms-api npx tsx prisma/seed.ts

# L'application est accessible sur :
# Frontend : http://localhost:3001
# API :      http://localhost:4000
# API Doc :  http://localhost:4000/health
```

### Configuration Stripe (abonnements)

Pour activer le module d'inscription avec paiement :

1. Créer un compte [Stripe](https://stripe.com) et récupérer les clés API
2. Créer les Products/Prices dans le Stripe Dashboard (Basic, Pro, Enterprise en mensuel et annuel)
3. Configurer les variables d'environnement avant de lancer `docker compose up` :

```bash
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
```

4. Pour le développement local, utiliser le Stripe CLI pour recevoir les webhooks :

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

5. Mettre à jour les `stripePriceId*` dans le seed (`prisma/seed.ts`) avec les Price IDs Stripe réels, puis relancer le seed.

### Sans Docker (développement local)

```bash
# 1. Base de données PostgreSQL et Redis doivent être démarrés

# 2. Backend
cd backend
cp .env.example .env
# Éditer .env avec vos paramètres
npm install
npx prisma migrate dev
npx tsx prisma/seed.ts
npm run dev

# 3. Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev
```

### Plans d'abonnement

| Plan | Prix mensuel | Prix annuel | Établissements | Chambres | Utilisateurs |
|------|-------------|-------------|----------------|----------|-------------|
| Basic | 29 EUR | 290 EUR | 1 | 20 | 5 |
| Pro | 79 EUR | 790 EUR | 3 | 100 | 20 |
| Enterprise | 199 EUR | 1990 EUR | Illimité | Illimité | Illimité |

### Identifiants de démonstration

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Super Admin | superadmin@hoteldemo.com | Admin123! |
| Admin Établissement | admin@hoteldemo.com | Admin123! |
| Manager | manager@hoteldemo.com | Manager123! |
| Employé | employee@hoteldemo.com | Employee123! |

## Rôles et permissions (RBAC)

Le système définit **4 niveaux d'accès** :

| Rôle | Portée | Description |
|------|--------|-------------|
| **SUPERADMIN** | Plateforme | Administrateur principal, accès total à tous les établissements et paramètres |
| **ADMIN** | Établissement | Administrateur rattaché à un ou plusieurs établissements, gère uniquement ses établissements |
| **MANAGER** | Établissement | Peut créer des employés (sous validation de l'admin), gère les opérations courantes |
| **EMPLOYEE** | Établissement | Accès opérationnel : chambres, réservations |

### Matrice des permissions

| Fonctionnalité | Super Admin | Admin Étab. | Manager | Employé |
|----------------|:-----------:|:-----------:|:-------:|:-------:|
| Paramètres plateforme | ✅ | | | |
| Créer/supprimer établissements | ✅ | | | |
| Modifier un établissement | ✅ | ✅ | | |
| Gérer les utilisateurs | ✅ | ✅ | ✅ ¹ | |
| Approuver les nouveaux employés | ✅ | ✅ | | |
| Rapports | ✅ | ✅ | | |
| Fournisseurs | ✅ | ✅ | | |
| Factures & Paiements | ✅ | ✅ | ✅ | |
| Stock & Inventaire | ✅ | ✅ | ✅ | |
| Chambres (CRUD) | ✅ | ✅ | ✅ | lecture |
| Réservations | ✅ | ✅ | ✅ | ✅ |
| Tableau de bord | ✅ | ✅ | ✅ | ✅ |

¹ Le manager ne peut créer que des employés, qui restent en statut **« En attente »** jusqu'à validation par un admin.

### Isolation par établissement

- **SUPERADMIN** : accès global à tous les établissements du tenant
- **ADMIN / MANAGER / EMPLOYEE** : accès limité aux établissements auxquels ils sont assignés

## Endpoints API

### Authentification
- `POST /api/auth/login` — Connexion
- `POST /api/auth/refresh` — Renouvellement token
- `POST /api/auth/logout` — Déconnexion
- `GET /api/auth/me` — Profil courant

### Ressources (CRUD)
- `/api/users` — Gestion utilisateurs (+ approve pour validation admin)
- `/api/establishments` — Établissements
- `/api/rooms` — Chambres
- `/api/reservations` — Réservations (+ check-in, check-out, cancel)
- `/api/invoices` — Factures (+ issue, cancel)
- `/api/payments` — Paiements
- `/api/articles` — Articles inventaire
- `/api/categories` — Catégories articles
- `/api/stock-movements` — Mouvements de stock (+ approve)
- `/api/suppliers` — Fournisseurs

### Inscription & Abonnements
- `GET /api/registration/plans` — Liste des plans d'abonnement (public)
- `POST /api/registration/register` — Inscription nouveau tenant + redirection Stripe Checkout
- `POST /api/webhooks/stripe` — Webhook Stripe (activation/désactivation automatique)

### Intégrations
- `GET /api/availability.json` — Disponibilité chambres (JSON)
- `GET /api/availability.ics` — Calendrier iCal (RFC 5545)
- `POST /api/external-bookings` — Réservations Channel Manager (API Key)
- `POST /api/pos/transactions` — Transactions POS Android

## App Android POS

L'application mobile est conçue pour les tablettes en mode paysage.

### Fonctionnalités
- **Offline-first** : Les transactions sont stockées en SQLite puis synchronisées
- **Sécurité** : Tokens chiffrés avec EncryptedSharedPreferences
- **Sync automatique** : WorkManager sync en arrière-plan toutes les 15 min
- **Idempotence** : UUID unique par transaction, pas de double comptabilisation

### Build
```bash
cd android
# Ouvrir dans Android Studio
# Build > Make Project
# Run sur un émulateur ou appareil physique
```

## Sécurité

23 risques de sécurité identifiés et traités — voir le document d'architecture pour le détail complet.

**Mesures principales :**
- Isolation multi-tenant via Prisma middleware + RLS PostgreSQL
- JWT signé HS256, durée courte (15 min), refresh en cookie HttpOnly
- Validation Zod sur tous les endpoints (whitelist)
- Rate limiting par IP et par tenant
- Anti-double-booking en transaction Serializable
- Idempotence POS par UUID unique
- Recalcul serveur des montants (anti-manipulation)
- Bcrypt 12 rounds, timing-attack safe
- Headers de sécurité (Helmet)
- Logging structuré pour audit

## Licence

Propriétaire — Tous droits réservés.
