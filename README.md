# Teranga PMS — Plateforme SaaS de Gestion Hôtelière

Plateforme complète multi-tenant de gestion hôtelière (Property Management System) avec interface web, application mobile Android, et flux de paiement mobile (Flooz / Yas) par QR code.

## Architecture

```
hotel-pms/
├── backend/           # API REST — Node.js/Express + TypeScript + Prisma + PostgreSQL
├── frontend/          # Interface Web — Next.js 14 (App Router) + TypeScript + Tailwind CSS
├── android/           # App Mobile — Kotlin + Jetpack Compose + Hilt + Room DB
├── docs/              # Documentation (RBAC, Guide utilisateur)
└── docker-compose.yml # PostgreSQL, Redis, API, Frontend
```

## Stack Technique

| Couche | Technologie |
|--------|-------------|
| Frontend Web | Next.js 14+, TypeScript, Tailwind CSS, React Query, Zustand, Recharts |
| Backend API | Node.js, Express, TypeScript, Zod |
| ORM / DB | Prisma + PostgreSQL 15+ |
| Cache | Redis 7 |
| Auth | JWT (access + refresh tokens), bcryptjs, RBAC 2 niveaux |
| Paiement | Stripe (abonnements), Flooz/Yas via QR code (commandes) |
| QR Code | `qrcode` npm (génération data URL côté serveur) |
| Upload | Multer (images articles, max 5 Mo, JPG/PNG/WebP) |
| Mobile | Kotlin, Jetpack Compose, Room DB, Retrofit, Hilt DI |
| DevOps | Docker, Docker Compose |

## Design System

### Web — Teranga (Sénégal)
- Terracotta `#C4704A`, Gold `#D4A843`, Sage `#7A9B76`

### Mobile — Bénin
- Rouge Dahomey `#C0392B`, Or Béninois `#F1C40F`, Vert Béninois `#27AE60`, Bronze Abomey `#8D6E63`

## Modules Fonctionnels

1. **Multi-tenant** — Isolation par `tenant_id`, middleware Prisma automatique
2. **Authentification** — JWT dual-token, RBAC 2 niveaux (tenant + établissement)
3. **Utilisateurs** — CRUD, approbation par DAF, archivage automatique des comptes inactifs, rôles par établissement
4. **Établissements** — Multi-établissement par tenant, rôles dédiés (DAF, Manager, Serveur, POS, Cuisinier, Ménage)
5. **Chambres** — CRUD, gestion des statuts, filtres avancés
6. **Réservations** — CRUD, check-in/check-out, anti-double-booking transactionnel, paiement par QR code ou espèces, auto-génération facture et reçu PDF
7. **Factures** — Lifecycle complet (brouillon → émise → payée), numérotation auto `FAC-YYYYMMDD-NNNN`
8. **Paiements** — Multi-méthodes (Espèces, Carte, Mobile Money, Flooz, Yas, Virement), idempotence POS via UUID
9. **Commandes** — Création avec moyen de paiement, auto-génération facture, QR code pour paiement client
10. **Menu & Articles** — Catégories Restaurant/Boissons, upload d'images, workflow d'approbation DAF, stock optionnel pour plats préparés
11. **Cuisine** — Vue temps réel des commandes pour les cuisiniers, notification serveur quand prêt
12. **Stock & Inventaire** — Mouvements, alertes stock bas, approbation DAF pour écarts
13. **Fournisseurs** — CRUD complet
14. **Ménage** — Pointage début/fin (clock-in/clock-out), chambre indisponible pendant nettoyage, démarrage direct depuis notification
15. **Rapports** — Taux d'occupation, revenus, performance par serveur, export CSV, graphiques
16. **Intégrations** — API disponibilité (JSON/iCal), Channel Manager, POS Android
17. **Inscription & Abonnements** — Inscription self-service avec paiement Stripe, plans Basic/Pro/Enterprise
18. **Notifications temps réel** — SSE + polling, alertes par rôle (checkout, ménage, commandes, approbations, stock), navigation contextuelle (clic → page concernée)
19. **Synchronisation calendrier (iCal)** — Sync bidirectionnelle des disponibilités avec Airbnb, Booking.com, Expedia via iCal
20. **Profil utilisateur** — Modification des informations personnelles, changement de mot de passe
21. **Reçus & Factures PDF** — Génération de reçus (format ticket 80mm) et factures (A4) en PDF avec QR code, téléchargement depuis les pages Commandes et Factures

## Flux de Paiement (Commandes)

```
Serveur crée une commande (web ou mobile)
  → Sélectionne le moyen de paiement (Flooz ou Yas)
  → Facture auto-générée (FAC-YYYYMMDD-NNNN)
  → QR code affiché (web ou mobile)
  → Client scanne le QR code avec son app Flooz/Yas
  → Paiement effectué
```

### Moyens de paiement supportés

| Code | Label | Usage |
|------|-------|-------|
| `MOOV_MONEY` | Flooz | Paiement mobile Moov Africa |
| `MIXX_BY_YAS` | Yas | Paiement mobile MTN |
| `CASH` | Espèces | Paiement en liquide |
| `CARD` | Carte bancaire | Paiement par carte |
| `MOBILE_MONEY` | Mobile Money | Paiement mobile générique |
| `BANK_TRANSFER` | Virement | Virement bancaire |

## Workflow d'approbation des articles

```
Manager crée un article (nom, catégorie, prix, image, description)
  → Article créé avec statut "En attente d'approbation"
  → Demande d'approbation envoyée au DAF
  → DAF voit le badge sur son dashboard + dans la page Approbations
  → DAF approuve → Article actif et visible par les serveurs
  → DAF rejette → Article reste inactif
```

Le DAF peut créer des articles directement sans approbation.

## Démarrage Rapide

### Prérequis

- Docker et Docker Compose
- Node.js 20+ (si dev sans Docker)
- Android Studio (pour l'app mobile)

### Avec Docker (recommandé)

```bash
# Cloner et démarrer
cd hotel-pms
docker compose up -d

# Exécuter les migrations et le seed
docker compose exec backend npx prisma db push
docker compose exec backend npx tsx prisma/seed.ts

# L'application est accessible sur :
# Frontend : http://localhost:3001
# API :      http://localhost:4000
# Health :   http://localhost:4000/health
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
npx prisma db push
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
| Basic | 32 500 FCFA | 325 000 FCFA | 1 | 20 | 5 |
| Pro | 65 000 FCFA | 650 000 FCFA | 3 | 100 | 20 |
| Enterprise | 130 000 FCFA | 1 300 000 FCFA | Illimité | Illimité | Illimité |

### Identifiants de démonstration

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Super Admin | superadmin@hoteldemo.com | Admin123! |
| Propriétaire | owner@hoteldemo.com | Owner123! |
| DAF | daf@hoteldemo.com | Daf12345! |
| Manager | manager@hoteldemo.com | Manager123! |
| Serveur | serveur@hoteldemo.com | Serveur123! |
| POS | pos@hoteldemo.com | Pos12345! |
| Cuisinier | cuisinier@hoteldemo.com | Cook1234! |
| Ménage | menage@hoteldemo.com | Menage123! |

## Rôles et Permissions (RBAC)

Le système utilise un **RBAC à 2 niveaux** :

### Niveau 1 — Rôle Tenant (UserRole)

| Rôle | Description |
|------|-------------|
| **SUPERADMIN** | Administrateur plateforme, accès total, bypass toutes les vérifications |
| **EMPLOYEE** | Utilisateur standard, droits déterminés par ses rôles par établissement |

### Niveau 2 — Rôle Établissement (EstablishmentRole)

| Rôle | Description |
|------|-------------|
| **OWNER** | Propriétaire — accès complet à l'établissement, mêmes droits que le DAF + gestion des canaux de réservation |
| **DAF** | Directeur Administratif et Financier — administrateur de l'établissement. Valide les créations d'articles/employés, gère finances/stock/rapports. Badge d'approbation en temps réel sur le dashboard |
| **MANAGER** | Gestion quotidienne — crée les articles du menu (soumis à approbation DAF), crée employés (sous validation DAF), rapports d'activité, gestion stock |
| **SERVER** | Serveur — prise de commandes via le menu (Restaurant/Boissons), affichage QR code pour paiement client, stats personnelles. N'a pas accès aux réservations ni aux chambres directement |
| **POS** | Point de vente — facturations, paiements carte/Mobile Money |
| **COOK** | Cuisinier — interface temps réel des commandes en cuisine, signale quand une commande est prête |
| **CLEANER** | Ménage — pointage début/fin de ménage, chambre indisponible pendant le nettoyage |

### Matrice des permissions

| Fonctionnalité | SuperAdmin | Owner | DAF | Manager | Serveur | POS | Cuisinier | Ménage |
|----------------|:----------:|:-----:|:---:|:-------:|:-------:|:---:|:---------:|:------:|
| Paramètres plateforme | X | | | | | | | |
| Créer/supprimer établissements | X | | | | | | | |
| Modifier établissement | X | | | | | | | |
| Gérer utilisateurs | X | X | X | X ^1 | | | | |
| Approuver demandes | X | X | X | | | | | |
| Rapports & Export CSV | X | X | X | X | | | | |
| Fournisseurs | X | X | X | | | | | |
| Menu & Articles (créer) | X | X | X | X ^2 | | | | |
| Stock & Inventaire | X | X | X | X | | | | |
| Alertes stock | X | X | X | X | | | | |
| Canaux (iCal sync) | X | X | X | X | | | | |
| Factures & Paiements | X | X | X | X | X | X | | |
| Reçus & Factures PDF | X | X | X | X | X | | | |
| Commandes + QR code | X | X | X | X | X | | | |
| Filtrer commandes par serveur | X | X | X | X | | | | |
| Cuisine (temps réel) | X | X | X | X | | | X | |
| Chambres | X | X | X | X | | | | X |
| Réservations | X | X | X | X | | | | |
| Ménage & Pointage | X | X | X | X | | | | X |
| Tableau de bord | X | X | X | X | X | X | X | X |

^1 Le Manager ne peut créer que des serveurs, cuisiniers et ménage (soumis à validation DAF).
^2 Les articles créés par le Manager nécessitent l'approbation du DAF avant d'apparaître au menu.

## Endpoints API

### Authentification
- `POST /api/auth/login` — Connexion (retourne les memberships)
- `POST /api/auth/refresh` — Renouvellement token
- `POST /api/auth/logout` — Déconnexion
- `GET /api/auth/me` — Profil courant

### Utilisateurs & Membres
- `/api/users` — Gestion utilisateurs (+ `POST /:id/approve`)
- `/api/establishments/:id/members` — Membres d'un établissement

### Établissements & Chambres
- `/api/establishments` — Établissements
- `/api/rooms` — Chambres (+ `PATCH /:id/status`)

### Réservations & Commandes
- `/api/reservations` — Réservations (+ check-in, check-out, cancel), auto-génération facture à la création
- `GET /api/reservations/:id/receipt` — Télécharger le reçu PDF de réservation (format ticket 80mm)
- `/api/orders` — Commandes (+ `GET /kitchen/:estId`, `GET /stats/:estId`, filtre `?createdById=`)
- `GET /api/orders/:id/receipt` — Télécharger le reçu PDF (format ticket 80mm)

### Facturation & Paiements
- `/api/invoices` — Factures (+ issue, cancel)
- `GET /api/invoices/:id/qrcode` — QR code de paiement pour une facture
- `GET /api/invoices/:id/pdf` — Télécharger la facture PDF (format A4)
- `/api/payments` — Paiements

### Menu & Stock
- `/api/articles` — Articles du menu (+ `/low-stock`, filtre `?menuOnly=true`)
- `/api/categories` — Catégories (Restaurant, Boissons, etc.)
- `/api/stock-movements` — Mouvements de stock (+ approve)
- `/api/stock-alerts` — Alertes de stock
- `/api/suppliers` — Fournisseurs
- `POST /api/upload` — Upload d'image (multipart/form-data, max 5 Mo)

### Workflows
- `/api/approvals` — Demandes d'approbation (création employé, article, chambre, modification réservation)
- `GET /api/approvals/pending-count/:establishmentId` — Nombre d'approbations en attente
- `/api/cleaning` — Sessions de ménage (clock-in/clock-out)

### Inscription & Abonnements
- `GET /api/registration/plans` — Liste des plans (public)
- `POST /api/registration/register` — Inscription + Stripe Checkout
- `POST /api/webhooks/stripe` — Webhook Stripe

### Notifications
- `GET /api/notifications` — Liste des notifications (+ `?unread=true`)
- `GET /api/notifications/unread-count` — Compteur non lues
- `POST /api/notifications/:id/read` — Marquer comme lue
- `POST /api/notifications/read-all` — Tout marquer comme lu
- `GET /api/notifications/stream` — Flux SSE temps réel

### Canaux de réservation (iCal sync)
- `GET /api/channels` — Liste des connexions (+ `?roomId=`, `?establishmentId=`)
- `GET /api/channels/:id` — Détail avec historique de sync
- `POST /api/channels` — Créer une connexion
- `PATCH /api/channels/:id` — Modifier (importUrl, isActive, syncIntervalMin)
- `DELETE /api/channels/:id` — Supprimer
- `POST /api/channels/:id/sync` — Déclencher un sync manuel
- `POST /api/channels/:id/regenerate-token` — Régénérer le token d'export
- `GET /api/calendar/:token.ics` — **Feed iCal public** (sans authentification, token dans l'URL)

### Intégrations
- `GET /api/availability.json` — Disponibilité chambres (JSON)
- `GET /api/availability.ics` — Calendrier iCal global (RFC 5545, authentifié)
- `POST /api/external-bookings` — Réservations Channel Manager (API Key)
- `POST /api/pos/transactions` — Transactions POS Android

## Synchronisation Calendrier (iCal) — Guide de configuration

La synchronisation iCal permet de connecter les chambres aux plateformes de réservation externes (Airbnb, Booking.com, Expedia) pour éviter les doubles réservations.

### Principe

Chaque chambre peut être connectée à un ou plusieurs canaux. La synchronisation est **bidirectionnelle** :

- **Export (PMS → OTA)** : Le PMS génère un feed iCal par chambre, accessible via une URL publique unique. L'OTA s'y abonne pour voir les dates bloquées.
- **Import (OTA → PMS)** : Le PMS importe périodiquement le feed iCal de l'OTA pour récupérer les réservations faites sur la plateforme externe.

### Rôles autorisés

Seuls les comptes **OWNER**, **DAF** et **MANAGER** ont accès à la page "Canaux" et peuvent configurer les connexions.

### Étapes de configuration

#### 1. Connecter une chambre à Airbnb

1. Se connecter avec un compte OWNER, DAF ou MANAGER
2. Aller dans **Canaux** (menu latéral)
3. Cliquer **Connecter un canal**
4. Sélectionner la chambre et la plateforme (Airbnb)
5. Cliquer **Connecter**

#### 2. Exporter les disponibilités vers Airbnb

1. Sur la connexion créée, cliquer l'icône **Copier** pour copier l'URL d'export
2. Dans Airbnb : Calendrier > Paramètres de disponibilité > **Importer le calendrier**
3. Coller l'URL copiée
4. Airbnb synchronisera automatiquement les dates bloquées du PMS

#### 3. Importer les réservations Airbnb

1. Dans Airbnb : Calendrier > Paramètres de disponibilité > **Exporter le calendrier**
2. Copier l'URL iCal fournie par Airbnb (format : `https://www.airbnb.com/calendar/ical/xxx.ics`)
3. Dans le PMS : déplier la connexion, coller l'URL dans le champ **URL d'import**
4. Cliquer **Synchroniser maintenant** pour un premier test
5. La synchronisation automatique s'exécute toutes les 15 minutes (configurable : 5 min à 24h)

### Mêmes étapes pour Booking.com et Expedia

Les plateformes proposent toutes un export/import iCal dans leurs paramètres de calendrier. Le principe est identique : coller l'URL d'export du PMS dans l'OTA, et l'URL d'export de l'OTA dans le PMS.

### Gestion des conflits

- Si une réservation externe entre en conflit avec une réservation PMS existante, elle est **ignorée** (le PMS a priorité)
- Les conflits sont visibles dans l'historique de synchronisation de chaque connexion
- Les annulations sur l'OTA sont automatiquement détectées et appliquées dans le PMS

### Sécurité

- Chaque URL d'export contient un **token unique de 64 caractères** (non devinable)
- Si un token est compromis, il peut être régénéré (l'ancienne URL cesse de fonctionner immédiatement)
- Les feeds iCal ne contiennent aucune donnée client (uniquement "Non disponible" + dates)

## App Mobile Android

Application native pour les rôles de terrain (Serveur, Cuisinier, POS, Ménage, Manager, DAF).

### Fonctionnalités
- **Dashboard par rôle** : chaque rôle voit un dashboard adapté à ses besoins
  - Serveur : bouton "Accéder au menu", stats personnelles (commandes, revenus du jour), état des chambres
  - Cuisinier : commandes en attente, en préparation, prêtes
  - Ménage : chambres à nettoyer, sessions du jour, durée moyenne
  - Manager/DAF : vue d'ensemble complète avec graphiques financiers
- **Menu Restaurant** : onglets Restaurant/Boissons, cartes avec image, prix, description
- **Commandes** : sélection directe sur le menu, QR code de paiement automatique
- **Cuisine** : vue temps réel des commandes en cours
- **Ménage** : pointage clock-in/clock-out
- **Offline-first** : transactions stockées en Room DB puis synchronisées
- **Sécurité** : tokens chiffrés avec EncryptedSharedPreferences
- **Sync automatique** : WorkManager toutes les 15 min
- **Thème Bénin** : Rouge Dahomey, Or Béninois, Vert Béninois, Bronze Abomey

### Build
```bash
cd android
# Ouvrir dans Android Studio
# Sync Gradle > Build > Run
```

## Sécurité

- Isolation multi-tenant via Prisma middleware + RLS PostgreSQL
- JWT signé HS256, durée courte (15 min), refresh en cookie HttpOnly
- Refresh token également accepté dans le body (mobile)
- Validation Zod sur tous les endpoints (whitelist)
- Rate limiting par IP et par tenant (production)
- Anti-double-booking en transaction Serializable
- Idempotence POS par UUID unique
- Recalcul serveur des montants (anti-manipulation)
- bcryptjs 12 rounds, timing-attack safe
- Headers de sécurité (Helmet)
- CORS configurable par domaine
- Logging structuré pour audit
- Upload images limité (5 Mo, formats JPG/PNG/WebP uniquement)

## Licence

Propriétaire — Tous droits réservés.
