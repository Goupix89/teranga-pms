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
| **Réservations** | Modifier les dates uniquement | Oui | Requise |
| **Réservations** | Modifier autres champs | Non | - |
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
| **Chambres** | Créer / modifier | Non |
| **Stock** | Mouvements de stock | Non |
| **Ménage** | Pointage | Non |

#### Dashboard Serveur

- Statistiques de commandes globales
- Statistiques de commandes personnelles (mes commandes du jour)

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

## Types d'approbation

| Type | Déclencheur | Action à l'approbation |
|------|-------------|----------------------|
| `ROOM_CREATION` | Manager crée une chambre | Chambre créée à partir du payload |
| `STOCK_MOVEMENT` | Manager crée un mouvement de stock | Mouvement exécuté, stock article mis à jour |
| `RESERVATION_MODIFICATION` | Manager modifie les dates d'une réservation | Dates de la réservation mises à jour |

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
