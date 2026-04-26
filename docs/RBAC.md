# Teranga PMS — Gestion des Rôles et Permissions (RBAC)

## Architecture des rôles

Le système utilise un RBAC à deux niveaux :

| Niveau | Rôles | Description |
|--------|-------|-------------|
| **Tenant** (plateforme) | `SUPERADMIN`, `EMPLOYEE` | Accès global à la plateforme |
| **Etablissement** | `OWNER`, `DAF`, `MANAGER`, `SERVER`, `POS`, `COOK`, `CLEANER` | Accès spécifique à un établissement |

---

## Matrice des permissions par rôle

### SuperAdmin

Accès complet à toutes les fonctionnalités, tous les établissements.

- Bypass de toutes les restrictions d'établissement
- Dashboard complet avec toutes les statistiques
- Gestion des utilisateurs et des établissements
- **Gestion des abonnements** : voir, renouveler, et activation manuelle (paiements en espèces)

---

### Owner (Propriétaire)

Le propriétaire a les mêmes permissions que le DAF, plus la gestion des canaux de réservation, des clés API et de l'abonnement.

#### Permissions spécifiques (en plus du DAF)

| Module | Action | Autorisé |
|--------|--------|----------|
| **Clés API** | Créer / modifier / supprimer | Oui |
| **Canaux iCal** | Connecter / configurer | Oui |
| **Configuration FedaPay** | Connecter / tester / déconnecter | Oui |
| **Fournisseurs** | CRUD complet | Oui |
| **Abonnement** | Voir / renouveler via FedaPay | Oui |
| **Remises (Discount Rules)** | Créer / modifier / activer (hébergements et commandes) | Oui |
| **Clients** | Voir liste, fiche, télécharger carte de fidélité PDF | Oui |
| **Backfill factures channel** | `POST /api/reservations/admin/backfill-channel-invoices` | Oui |

---

### DAF (Directeur Administratif et Financier)

Le DAF est l'administrateur de l'établissement. Il valide les actions sensibles soumises par le Manager.

#### Permissions

| Module | Action | Autorisé |
|--------|--------|----------|
| **Chambres** | Créer / modifier / supprimer | Oui (direct) |
| **Réservations** | Créer / modifier tous les champs / annuler | Oui |
| **Réservations** | Check-in / Check-out | Oui |
| **Articles** | Créer / modifier / supprimer | Oui |
| **Stock** | Mouvements de stock (direct) | Oui |
| **Commandes** | Voir les commandes | Oui |
| **Commandes** | Changer statut cuisine (EN_COURS / PRET) | Non |
| **Commandes** | Marquer comme servie | Non |
| **Commandes** | Annuler une commande | Oui |
| **Commandes** | Basculer flag bon propriétaire (`isVoucher`) | Oui |
| **Réservations** | Modifier tous les champs (direct, sans approbation) | Oui |
| **Dépenses** | CRUD complet | Oui |
| **Approbations** | Voir toutes les demandes | Oui |
| **Approbations** | Approuver / rejeter | Oui |
| **Cuisine** | Voir le tableau cuisine | Oui (lecture seule) |
| **Ménage** | Pointage (clock-in/out) | Non |
| **Clés API** | Créer / modifier / supprimer | Oui |
| **Abonnement** | Voir / renouveler via FedaPay | Oui |
| **Dashboard** | Stats Manager + financières | Oui (7 graphiques) |

#### Dashboard DAF

Le dashboard DAF inclut les 4 graphiques Manager + 3 graphiques supplémentaires :

- Niveaux de stock (barres horizontales)
- Occupation des chambres (camembert)
- Commandes cuisine par jour (histogramme)
- Commandes par serveur (histogramme)
- **Flux de paiements mensuels** (histogramme)
- **Mouvements de stock par type** (camembert)
- **Temps de traitement moyen** (histogramme)

---

### Manager

Le Manager gère l'établissement au quotidien. Certaines actions sensibles nécessitent la validation du DAF.

#### Permissions

| Module | Action | Autorisé | Approbation DAF |
|--------|--------|----------|-----------------|
| **Chambres** | Créer une chambre | Oui | Requise |
| **Chambres** | Modifier / supprimer | Oui | - |
| **Réservations** | Créer | Oui | - |
| **Réservations** | Modifier les dates, chambre, remise, invités | Oui | Requise (via approbation DAF) |
| **Réservations** | Check-in / Check-out | Oui | - |
| **Articles** | Créer (avec image et description) | Oui | - |
| **Articles** | Modifier / supprimer | Oui | - |
| **Stock** | Mouvements de stock | Oui | Requise |
| **Commandes** | Voir les commandes | Oui | - |
| **Commandes** | Changer statut cuisine (EN_COURS / PRET) | Non | - |
| **Commandes** | Marquer comme servie | Non | - |
| **Commandes** | Annuler une commande | Oui | - |
| **Cuisine** | Voir le tableau cuisine | Oui (lecture seule) | - |
| **Ménage** | Pointage (clock-in/out) | Non | - |
| **Ménage** | Assigner un ménage | Oui (aux CLEANERs) | - |
| **Approbations** | Voir ses propres demandes | Oui | - |
| **Approbations** | Approuver / rejeter | Non | - |

#### Dashboard Manager

4 graphiques :

- Niveaux de stock (barres horizontales)
- Occupation des chambres (camembert)
- Commandes cuisine par jour (histogramme)
- Commandes par serveur (histogramme)

#### Workflow d'approbation Manager

1. Le Manager soumet une action (création chambre, mouvement stock, modification dates)
2. Une demande d'approbation est créée (statut `PENDING`)
3. Le Manager peut voir le statut de sa demande dans la page **Approbations > Mes demandes**
4. Le DAF voit la demande dans sa page **Approbations** et peut approuver ou rejeter
5. Si approuvée, l'action est exécutée automatiquement (chambre créée, stock mis à jour, etc.)

---

### Serveur (Server)

Le serveur gère les commandes en salle.

#### Permissions

| Module | Action | Autorisé |
|--------|--------|----------|
| **Commandes** | Créer une commande | Oui |
| **Commandes** | Marquer comme servie (`SERVED`) | Oui |
| **Commandes** | Changer statut cuisine (EN_COURS / PRET) | Non |
| **Commandes** | Annuler une commande | Non |
| **Commandes** | Basculer flag bon propriétaire (`isVoucher`) | Non |
| **Commandes** | Voir ses commandes (créées par lui OU attribuées par le POS) | Oui |
| **Commandes** | Saisir une commande avec date d'opération rétroactive (≤ 15 jours) | Oui |
| **Chambres** | Créer / modifier | Non |
| **Stock** | Mouvements de stock | Non |
| **Ménage** | Pointage | Non |

#### Dashboard Serveur

- Statistiques de commandes globales
- Statistiques de commandes personnelles (mes commandes du jour — inclut les commandes saisies par le POS en son nom)

---

### POS (Caissier)

Le POS saisit les commandes en caisse pour le compte des serveurs.

#### Permissions

| Module | Action | Autorisé |
|--------|--------|----------|
| **Point de vente** | Accès à `/dashboard/pos` (web) et écran POS (mobile) | Oui |
| **Commandes** | Créer une commande | Oui |
| **Commandes** | **Attribuer une commande à un serveur** (sélecteur Serveur attribué) | Oui |
| **Commandes** | Saisir avec date d'opération rétroactive (≤ 15 jours) | Oui |
| **Commandes** | Saisir en mode hors ligne (file IndexedDB/Room DB) | Oui |
| **Commandes** | Basculer flag bon propriétaire (`isVoucher`) | Non |
| **Paiements** | Encaisser une commande (espèces, carte, mobile money) | Oui |
| **Factures** | Voir les factures générées | Oui |
| **Commandes** | Changer statut cuisine / annuler | Non |
| **Chambres / Réservations / Stock** | Accès | Non |

> **Attribution** — Lorsque le POS coche un serveur dans « Serveur attribué », la commande est enregistrée avec `createdById = POS` (audit de qui a tapé) et `serverId = serveur choisi` (pour le reporting). Le serveur verra la commande dans sa liste et dans ses stats ; les rapports l'attribuent au serveur, pas au POS.

---

### Cuisinier (Cook)

Le cuisinier gère la préparation des commandes en cuisine.

#### Permissions

| Module | Action | Autorisé |
|--------|--------|----------|
| **Cuisine** | Voir les commandes | Oui |
| **Cuisine** | Passer en `EN_COURS` (IN_PROGRESS) | Oui |
| **Cuisine** | Passer en `PRET` (READY) | Oui |
| **Cuisine** | Marquer comme servie | Non |
| **Cuisine** | Annuler | Non |
| **Chambres** | Accès | Non |
| **Stock** | Accès | Non |
| **Ménage** | Accès | Non |

#### Dashboard Cuisinier

- Statistiques cuisine uniquement (commandes en attente, en cours, prêtes)

---

### Ménage (Cleaner)

Le personnel de ménage gère le nettoyage des chambres.

#### Permissions

| Module | Action | Autorisé |
|--------|--------|----------|
| **Ménage** | Pointage clock-in | Oui |
| **Ménage** | Pointage clock-out | Oui |
| **Ménage** | Voir les sessions de ménage | Oui |
| **Chambres** | Créer / modifier | Non |
| **Commandes** | Accès | Non |
| **Stock** | Accès | Non |

#### Dashboard Ménage

- Section ménage uniquement
- Résumé de l'état des chambres (disponibles, en nettoyage, occupées)

---

## Workflows automatiques

### Création de commande → Facture automatique

Lorsqu'une commande est créée, une facture est automatiquement générée :

- Numéro de facture : `FAC-YYYYMMDD-NNNN`
- Statut : `ISSUED`
- Montant : total de la commande
- La facture est liée à la commande
- Si `operationDate` est fournie : la facture utilise `issueDate = operationDate` (backdate), sinon la date courante

### Attribution POS → Serveur

Lorsqu'une commande est créée depuis le module Point de vente (POS) avec un `serverId` :

- `createdById` = ID du compte POS (audit : qui a saisi en caisse)
- `serverId` = ID du serveur attribué (revenue credit)
- Filtre `forUserId=X` : retourne les commandes où `createdById = X` **OU** `serverId = X` — le serveur voit toutes les commandes qui le concernent
- Agrégations de rapports : `attributed = server || createdBy` — priorité au serveur attribué, fallback sur le créateur

### Date d'opération (backdate)

Le paramètre `operationDate` permet d'enregistrer aujourd'hui une opération datée d'hier :

- Validation côté backend via `validateOperationDate(date, roleCtx)`
- Rôles opérationnels (SERVER, POS, MAITRE_HOTEL) : rejetés au-delà de 15 jours dans le passé
- Rôles superviseurs (OWNER, DAF, MANAGER, SUPERADMIN) : aucune limite
- Propagé sur `Invoice.issueDate`, `Payment.paidAt`, `Order.occurredAt` selon le contexte

### Création de réservation → Facture + QR code

Lorsqu'une réservation est créée (web, mobile ou WordPress) :

- Facture auto-générée : `FAC-YYYYMMDD-NNNN`, statut `ISSUED`
- Le moyen de paiement est stocké sur la facture
- QR code de paiement disponible immédiatement
- Moyen de paiement : Espèces, Mobile Money, Flooz, Yas, FedaPay, Carte, Virement
- Si FedaPay : bouton + lien cliquable vers la gateway de paiement
- Reçu PDF téléchargeable (format ticket 80mm)

### Réservation WordPress + FedaPay

Lorsqu'un client réserve depuis un site WordPress :

1. Paiement FedaPay (Mobile Money, carte)
2. Plugin WordPress envoie la réservation via `POST /api/external-bookings` (instantané)
3. Réservation créée + facture auto-générée + paiement enregistré (montant partiel supporté : acompte 60%)
4. Webhook FedaPay confirme le paiement (double sécurité)
5. Notification vers WordPress via webhook de paiement (si configuré)

### Checkout → Nettoyage automatique

Lorsqu'un check-out est effectué sur une réservation :

1. La réservation passe en statut `CHECKED_OUT`
2. La chambre passe automatiquement en statut `CLEANING`
3. Un cleaner peut ensuite faire un clock-in sur cette chambre
4. Au clock-out, la chambre repasse en statut `AVAILABLE`

---

## Workflows automatiques (suite)

### Décrémentation automatique du stock à la vente

Lorsqu'un article a `trackStock = true` et qu'une commande est créée ou qu'un article est ajouté :

- Le stock est décrémenté atomiquement (transaction Serializable)
- Un mouvement `SALE` est enregistré dans `stock_movements` avec le `orderId`
- Si `currentStock <= 0` : la vente est **bloquée** avec une erreur 409 (web + Android)
- En cas d'annulation de la commande : le stock est restauré (mouvement `RETURN`)

### Synchronisation channel manager → Facture automatique

Lorsqu'une réservation est importée via iCal ou `/api/external-bookings` :

1. La réservation est créée via `reservationService.create()` (pas d'insertion directe)
2. Une facture `FAC-YYYYMMDD-NNNN` est générée automatiquement (statut `PAID`)
3. Un paiement est enregistré (`FEDAPAY` pour les réservations en ligne, `OTHER` pour iCal)
4. Une fiche client est créée ou mise à jour si l'email est disponible
5. Ces revenus sont inclus dans les rapports quotidiens et le tableau de bord

### Flag bon propriétaire (`isVoucher`)

`PATCH /api/orders/:id/voucher` (OWNER, DAF, MANAGER) :

- Bascule `isVoucher` sur l'`Order`
- Met à jour la note sur la facture associée
- Crée un `ApprovalRequest` de type `VOUCHER_FLAG` pour traçabilité DAF

### Mode hors ligne — file de synchronisation

Le POS web utilise IndexedDB (Dexie) pour mettre en file d'attente les opérations hors ligne :

- Chaque opération est stockée avec un UUID idempotent avant envoi
- Le drain FIFO commence automatiquement à la reconnexion
- En cas d'erreur 4xx (client) : l'opération est marquée `FAILED` (pas de retry infini)
- En cas d'erreur 5xx (serveur) : backoff exponentiel avec max 5 tentatives

---

## Types d'approbation

| Type | Déclencheur | Action à l'approbation |
|------|-------------|----------------------|
| `ROOM_CREATION` | Manager crée une chambre | Chambre créée à partir du payload |
| `STOCK_MOVEMENT` | Manager crée un mouvement de stock | Mouvement exécuté, stock article mis à jour |
| `RESERVATION_MODIFICATION` | Manager modifie une réservation | Modification appliquée, facture recalculée |
| `VOUCHER_FLAG` | Owner/DAF/Manager bascule `isVoucher` sur une commande | Enregistrement pour audit (pas d'action supplémentaire) |

---

## Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| SuperAdmin | `superadmin@hoteldemo.com` | `Admin123!` |
| Owner | `owner@hoteldemo.com` | `Owner123!` |
| DAF | `daf@hoteldemo.com` | `Daf12345!` |
| Manager | `manager@hoteldemo.com` | `Manager123!` |
| Serveur | `serveur@hoteldemo.com` | `Serveur123!` |
| POS | `pos@hoteldemo.com` | `Pos12345!` |
| Cuisinier | `cuisinier@hoteldemo.com` | `Cook1234!` |
| Ménage | `menage@hoteldemo.com` | `Menage123!` |
