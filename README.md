# Teranga PMS — Plateforme SaaS de Gestion Hôtelière

Plateforme complète multi-tenant de gestion hôtelière (Property Management System) avec interface web, application mobile Android, et flux de paiement mobile (Flooz / Yas) par QR code.

## Architecture

```
hotel-pms/
├── backend/           # API REST — Node.js/Express + TypeScript + Prisma + PostgreSQL
├── frontend/          # Interface Web — Next.js 14 (App Router) + TypeScript + Tailwind CSS
├── android/           # App Mobile — Kotlin + Jetpack Compose + Hilt + Room DB
├── wordpress/         # Plugins WordPress (Teranga Booking, BA Book Everything Sync)
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
| Paiement | FedaPay (abonnements + gateway intégrée + WordPress), Flooz/Yas via QR code |
| QR Code | `qrcode` npm (génération data URL côté serveur) |
| Upload | Multer (images articles, max 5 Mo, JPG/PNG/WebP) |
| Mobile | Kotlin, Jetpack Compose, Room DB, Retrofit, Hilt DI |
| DevOps | Docker, Docker Compose, GitHub Actions CI/CD |

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
8. **Paiements** — Multi-méthodes (Espèces, Carte, Mobile Money, Flooz, Yas, FedaPay, Virement), idempotence POS via UUID, intégration FedaPay par tenant (chaque propriétaire connecte son compte FedaPay)
9. **Commandes** — Création avec moyen de paiement, auto-génération facture, QR code pour paiement client
10. **Menu & Articles** — Catégories Restaurant/Boissons, upload d'images, workflow d'approbation DAF, stock optionnel pour plats préparés
11. **Cuisine** — Vue temps réel des commandes pour les cuisiniers, notification serveur quand prêt
12. **Stock & Inventaire** — Mouvements, alertes stock bas, approbation DAF pour écarts
13. **Fournisseurs** — CRUD complet
14. **Ménage** — Pointage début/fin (clock-in/clock-out), chambre indisponible pendant nettoyage, démarrage direct depuis notification
15. **Rapports** — Taux d'occupation, revenus, performance par serveur, export CSV, graphiques
16. **Intégrations** — API disponibilité (JSON/iCal), Channel Manager, POS Android, WordPress + FedaPay
17. **Inscription & Abonnements** — Inscription self-service avec essai gratuit (14 jours) et paiement FedaPay, plans Basic/Pro/Enterprise, cycle de vie complet (essai → actif → retard → suspendu → annulé), activation manuelle par le SUPERADMIN pour paiements en espèces, limites de plan (chambres, utilisateurs, établissements)
18. **Notifications temps réel** — SSE + polling, alertes par rôle (checkout, ménage, commandes, approbations, stock), navigation contextuelle (clic → page concernée)
19. **Synchronisation calendrier (iCal)** — Sync bidirectionnelle des disponibilités avec Airbnb, Booking.com, Expedia via iCal (intervalle configurable : 1 min à 24h)
20. **Profil utilisateur** — Modification des informations personnelles, changement de mot de passe
21. **Reçus & Factures PDF** — Génération de reçus (format ticket 80mm) et factures (A4) en PDF avec QR code, téléchargement depuis les pages Commandes et Factures
22. **Configuration FedaPay par tenant** — Chaque propriétaire peut connecter son propre compte FedaPay via l'interface Paramètres (clés chiffrées AES-256-GCM)

## Flux de Paiement (Commandes & Réservations)

```
Serveur/Manager crée une commande ou réservation (web ou mobile)
  → Sélectionne le moyen de paiement (Flooz, Yas, FedaPay, etc.)
  → Facture auto-générée (FAC-YYYYMMDD-NNNN)
  → QR code affiché (web ou mobile)
  → Si FedaPay : bouton + lien cliquable vers la gateway de paiement
  → Client scanne le QR code ou clique sur le lien FedaPay
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
| `FEDAPAY` | FedaPay | Paiement via FedaPay (Mobile Money, carte) — WordPress + Teranga |
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

### Configuration FedaPay (abonnements)

Pour activer le module d'inscription avec paiement :

1. Créer un compte [FedaPay](https://app.fedapay.com) et récupérer les clés API
2. Configurer les variables d'environnement avant de lancer `docker compose up` :

```bash
export FEDAPAY_SECRET_KEY="sk_sandbox_..."
export FEDAPAY_SANDBOX="true"                     # "false" en production
export FEDAPAY_CALLBACK_URL="http://localhost:3001/auth/login"
```

3. Configurer le webhook dans FedaPay Dashboard :
   - URL : `https://votre-api/api/webhooks/fedapay`
   - Événement : `transaction.approved`

4. Exécuter le seed pour créer les plans d'abonnement :

```bash
docker compose exec backend npx tsx prisma/seed.ts
```

Tous les plans incluent un **essai gratuit de 14 jours** — aucun paiement n'est requis à l'inscription.

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
| **OWNER** | Propriétaire — accès complet à l'établissement, mêmes droits que le DAF + gestion des canaux de réservation + configuration FedaPay |
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
| Abonnement (voir/renouveler) | X | X | X | | | | | |
| Abonnement (activation manuelle) | X | | | | | | | |
| Clés API | X | X | X | | | | | |
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
- `POST /api/registration/register` — Inscription (essai gratuit ou FedaPay Checkout)
- `GET /api/subscriptions` — Abonnement du tenant (SUPERADMIN, OWNER, DAF)
- `GET /api/subscriptions/plans` — Plans disponibles (SUPERADMIN, OWNER, DAF)
- `POST /api/subscriptions/renew` — Générer un lien de renouvellement FedaPay (SUPERADMIN, OWNER, DAF)
- `POST /api/subscriptions/activate` — Activation manuelle (SUPERADMIN uniquement, paiements en espèces)
- `POST /api/webhooks/fedapay` — Webhook FedaPay (public)

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

### Clés API
- `GET /api/api-keys` — Liste des clés API du tenant
- `POST /api/api-keys` — Créer une nouvelle clé API (retourne la clé en clair une seule fois)
- `PATCH /api/api-keys/:id` — Modifier (nom, activer/désactiver, IPs autorisées)
- `DELETE /api/api-keys/:id` — Supprimer une clé API

### Paramètres tenant
- `GET /api/tenant/settings` — Paramètres du tenant (secrets masqués)
- `PATCH /api/tenant/settings/fedapay` — Configurer FedaPay (clé secrète chiffrée, mode sandbox/live, callback URL, webhook URL)
- `DELETE /api/tenant/settings/fedapay` — Déconnecter FedaPay
- `POST /api/tenant/settings/fedapay/test` — Tester la connexion FedaPay

### Intégrations
- `GET /api/availability.json` — Disponibilité chambres (JSON)
- `GET /api/availability.ics` — Calendrier iCal global (RFC 5545, authentifié)
- `POST /api/external-bookings` — Réservations Channel Manager (API Key) avec paiement FedaPay
- `POST /api/webhooks/fedapay` — Webhook FedaPay (confirmation paiement, public)
- `POST /api/pos/transactions` — Transactions POS Android

### Plugin WordPress — Teranga Booking
Un plugin WordPress est fourni dans `wordpress/teranga-booking/` pour intégrer un formulaire de réservation avec paiement FedaPay sur un site externe.

**Installation :**
1. Copier le dossier `teranga-booking/` dans `wp-content/plugins/`
2. Activer le plugin dans WordPress
3. Aller dans **Réglages → Teranga Booking** et configurer :
   - URL API Teranga PMS (ex: `https://api.mon-hotel.teranga.app`)
   - Clé API Teranga (générée depuis le PMS)
   - Clés FedaPay (publique + secrète, depuis [app.fedapay.com](https://app.fedapay.com))
   - Environnement : `sandbox` pour les tests, `live` pour la production
4. Configurer le webhook dans FedaPay Dashboard :
   - URL : `https://api.mon-hotel.teranga.app/api/webhooks/fedapay`
   - Événement : `transaction.approved`
5. Insérer le shortcode `[teranga_booking]` dans une page WordPress

**Flux de paiement :**
1. Le client remplit le formulaire sur le site WordPress
2. FedaPay Checkout s'ouvre pour le paiement (Mobile Money, carte, etc.)
3. Paiement confirmé → la réservation est créée dans Teranga PMS avec facture
4. Le webhook FedaPay confirme le paiement côté serveur (double sécurité)

### Plugin BA Book Everything Sync
Si votre site WordPress utilise déjà **BA Book Everything** avec FedaPay, utilisez le plugin `wordpress/teranga-ba-sync/` à la place :

1. Copier `teranga-ba-sync/` dans `wp-content/plugins/`
2. Activer dans WordPress
3. Configurer dans **Réglages → Teranga BA Sync** :
   - URL API et clé API Teranga
   - **Mapping chambres** : associer chaque ID d'objet BA au numéro de chambre Teranga (JSON `{"ID_BA": "NUM_CHAMBRE"}`)
   - Moment de sync : `babe_order_paid` (recommandé) ou `babe_order_completed`
4. Configurer le webhook FedaPay (même URL que ci-dessus)

Le plugin écoute automatiquement les hooks de BA Book Everything et synchronise chaque réservation payée vers Teranga PMS (avec facture et paiement auto-enregistré). Les annulations sont aussi propagées.

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
5. La synchronisation automatique s'exécute toutes les minutes par défaut (configurable : 1 min à 24h)

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

## Fonctionnalités à venir

- **Calendrier de disponibilité par chambre** — Vue calendrier visuelle des disponibilités de chaque chambre, synchronisée en temps réel entre tous les canaux connectés (Airbnb, Booking.com, Expedia, PMS). Permettra de visualiser d'un coup d'oeil les réservations PMS et externes sur un calendrier interactif.

## Cycle de vie des abonnements

```
Inscription → TRIAL (14 jours, accès complet)
  → Paiement FedaPay ou activation manuelle → ACTIVE
  → Expiration sans paiement → PAST_DUE (grâce 7 jours)
    → Rappels J-7, J-3 avant expiration
    → Paiement reçu → ACTIVE
    → Pas de paiement → SUSPENDED (accès bloqué)
      → Paiement reçu → ACTIVE
      → 30 jours sans paiement → CANCELLED
```

### Limites de plan

Chaque plan définit des limites sur les ressources :

| Ressource | Basic | Pro | Enterprise |
|-----------|-------|-----|------------|
| Établissements | 1 | 3 | Illimité |
| Chambres | 20 | 100 | Illimité |
| Utilisateurs | 5 | 20 | Illimité |
| Channel Manager | Non | Oui | Oui |
| App POS | Non | Oui | Oui |

Les limites sont vérifiées automatiquement lors de la création de chambres, utilisateurs et établissements. Le SUPERADMIN peut activer/modifier manuellement un abonnement pour les paiements en espèces.

### Accès à la page Abonnement

| Rôle | Voir l'abonnement | Renouveler | Activation manuelle |
|------|:-:|:-:|:-:|
| SUPERADMIN | X | X | X |
| OWNER | X | X | |
| DAF | X | X | |

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
# teranga-pms-v1
