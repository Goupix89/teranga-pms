# Guide Utilisateur — Hotel PMS

## Table des matières

1. [Présentation](#1-présentation)
2. [Inscription et abonnement](#2-inscription-et-abonnement)
3. [Connexion](#3-connexion)
4. [Tableau de bord](#4-tableau-de-bord)
5. [Établissements](#5-établissements)
6. [Chambres](#6-chambres)
7. [Réservations](#7-réservations)
8. [Factures](#8-factures)
9. [Stock & Articles](#9-stock--articles)
10. [Fournisseurs](#10-fournisseurs)
11. [Utilisateurs](#11-utilisateurs)
12. [Paramètres](#12-paramètres)
13. [Rôles et permissions](#13-rôles-et-permissions)
14. [FAQ](#14-faq)

---

## 1. Présentation

Hotel PMS est une plateforme de gestion hôtelière multi-établissements. Elle permet de gérer vos chambres, réservations, factures, stocks et équipes depuis une interface web unique.

### Fonctionnalités principales

- Gestion de plusieurs établissements depuis un seul compte
- Suivi des réservations et du calendrier d'occupation
- Facturation avec calcul automatique des taxes
- Gestion des stocks et des fournisseurs
- Gestion des utilisateurs avec contrôle d'accès par établissement
- Tableau de bord avec indicateurs clés en temps réel

---

## 2. Inscription et abonnement

### Créer un compte

1. Depuis la page de connexion, cliquez sur **« Inscrivez-vous »**
2. **Étape 1 — Choix du plan** : sélectionnez votre formule d'abonnement :

| Plan | Mensuel | Annuel | Établissements | Chambres | Utilisateurs |
|------|---------|--------|----------------|----------|--------------|
| Basic | 29 €/mois | 290 €/an | 1 | 20 | 5 |
| Pro | 79 €/mois | 790 €/an | 3 | 100 | 20 |
| Enterprise | 199 €/mois | 1 990 €/an | Illimité | Illimité | Illimité |

   Basculez entre facturation **mensuelle** et **annuelle** avec le sélecteur en haut de page.

3. **Étape 2 — Informations du compte** :
   - Nom de l'organisation
   - Identifiant unique (slug) — généré automatiquement à partir du nom, modifiable
   - Prénom, nom, email et mot de passe de l'administrateur

   Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre.

4. **Étape 3 — Confirmation et paiement** : vérifiez le récapitulatif puis cliquez sur **« Procéder au paiement »**. Vous serez redirigé vers Stripe pour finaliser le paiement.

5. Après le paiement, votre compte est activé et vous pouvez vous connecter.

---

## 3. Connexion

1. Accédez à la page de connexion
2. Saisissez votre **email** et votre **mot de passe**
3. Cliquez sur **« Se connecter »**

En cas d'oubli de mot de passe, cliquez sur **« Mot de passe oublié ? »** et suivez les instructions envoyées par email.

---

## 4. Tableau de bord

Le tableau de bord affiche une vue d'ensemble de votre activité :

### Indicateurs principaux (cartes en haut)

- **Chambres occupées** : nombre de chambres actuellement occupées / total
- **Arrivées du jour** : réservations avec check-in aujourd'hui
- **Départs du jour** : réservations avec check-out aujourd'hui
- **Revenus du mois** : montant total facturé sur le mois en cours

### Réservations récentes

Tableau des dernières réservations avec :
- Nom du client
- Chambre attribuée
- Dates de séjour
- Statut (Confirmée, En cours, etc.)

### Alertes de stock

Liste des articles dont le stock actuel est inférieur ou égal au seuil minimum configuré. Chaque alerte indique :
- Nom de l'article
- Stock actuel vs. stock minimum
- Unité de mesure

---

## 5. Établissements

> **Accès** : Menu latéral → **Établissements**

### Consulter la liste

La page affiche tous vos établissements avec :
- Nom et localisation (ville, pays)
- Nombre d'étoiles
- Nombre de chambres
- Statut (actif/inactif)

### Créer un établissement

1. Cliquez sur **« Nouvel établissement »** (bouton en haut à droite)
2. Remplissez le formulaire :
   - **Nom** (obligatoire)
   - **Adresse** (obligatoire)
   - **Ville** et **Pays** (obligatoires)
   - **Téléphone** et **Email** (optionnels)
   - **Étoiles** (1 à 5, optionnel)
   - **Fuseau horaire** (défaut : UTC)
   - **Devise** (défaut : XOF)
3. Cliquez sur **« Créer »**

### Modifier un établissement

Cliquez sur l'icône de crayon (✏️) à droite de l'établissement pour ouvrir le formulaire de modification.

### Supprimer un établissement

Cliquez sur l'icône de suppression. L'établissement sera désactivé (suppression logique) et n'apparaîtra plus dans les listes.

---

## 6. Chambres

> **Accès** : Menu latéral → **Chambres**

### Vue d'ensemble

La page affiche toutes les chambres avec filtres par :
- **Établissement** (menu déroulant)
- **Type** : Simple, Double, Suite, Familiale, Deluxe
- **Statut** : Disponible, Occupée, Maintenance, Hors service
- **Recherche** par numéro de chambre

### Créer une chambre

1. Cliquez sur **« Nouvelle chambre »**
2. Remplissez :
   - **Établissement** (obligatoire)
   - **Numéro** de chambre (obligatoire)
   - **Étage** (optionnel)
   - **Type** : Simple, Double, Suite, Familiale, Deluxe
   - **Prix par nuit** (obligatoire)
   - **Capacité maximale** (nombre de personnes)
   - **Équipements** : wifi, TV, climatisation, minibar, etc.
   - **Description** (optionnel)
3. Cliquez sur **« Créer »**

### Changer le statut d'une chambre

Utilisez le menu déroulant de statut directement dans la ligne de la chambre :
- **Disponible** : prête à accueillir un client
- **Occupée** : un client y séjourne (mis à jour automatiquement lors d'un check-in)
- **Maintenance** : travaux en cours
- **Hors service** : non utilisable

### Modifier / Désactiver une chambre

- Cliquez sur ✏️ pour modifier les informations
- Désactivez une chambre pour la retirer des disponibilités sans la supprimer

---

## 7. Réservations

> **Accès** : Menu latéral → **Réservations**

### Liste des réservations

Filtres disponibles :
- **Statut** : En attente, Confirmée, Check-in, Check-out, Annulée, No-show
- **Source** : Direct, Booking.com, Expedia, Airbnb, Channel Manager, Téléphone, Walk-in
- **Recherche** par nom de client

### Créer une réservation

1. Cliquez sur **« Nouvelle réservation »**
2. Remplissez :
   - **Chambre** (sélection parmi les chambres disponibles)
   - **Nom du client** (obligatoire)
   - **Email** et **Téléphone** du client (optionnels)
   - **Date d'arrivée** et **Date de départ** (obligatoires, le départ doit être après l'arrivée)
   - **Nombre de personnes**
   - **Source** de la réservation
   - **Notes** (optionnel)
3. Le **prix total** est calculé automatiquement (nombre de nuits × prix par nuit)
4. Cliquez sur **« Créer »**

### Gérer le cycle de vie d'une réservation

Chaque réservation suit un cycle de statuts :

```
En attente → Confirmée → Check-in → Check-out
                ↓
            Annulée / No-show
```

- **Confirmer** : valide la réservation
- **Check-in** : le client est arrivé (la chambre passe en « Occupée »)
- **Check-out** : le client est parti (la chambre repasse en « Disponible »)
- **Annuler** : annule la réservation
- **No-show** : le client ne s'est pas présenté

### Modifier une réservation

Cliquez sur ✏️ pour modifier les dates, le nombre de personnes ou les notes. Le changement de chambre nécessite l'annulation et la recréation de la réservation.

---

## 8. Factures

> **Accès** : Menu latéral → **Factures**

### Liste des factures

Chaque facture affiche :
- Numéro de facture (généré automatiquement)
- Client associé
- Montant total
- Statut : Brouillon, Émise, Payée, Partiellement payée, Annulée, En retard
- Date de création

Filtres disponibles par **statut** et **recherche** par numéro ou nom de client.

### Créer une facture

1. Cliquez sur **« Nouvelle facture »**
2. Associez optionnellement une **réservation**
3. Ajoutez des **lignes de facture** :
   - Sélectionnez un article du stock (optionnel) ou saisissez une description libre
   - Quantité et prix unitaire
   - Le total par ligne est calculé automatiquement
4. Configurez :
   - **Taux de taxe** (en %, défaut : 0)
   - **Devise** (défaut : XOF)
   - **Date d'échéance** (optionnel)
   - **Notes** (optionnel)
5. Le sous-total, le montant de taxe et le total TTC sont calculés automatiquement
6. Cliquez sur **« Créer »**

### Enregistrer un paiement

1. Ouvrez la facture concernée
2. Cliquez sur **« Ajouter un paiement »**
3. Renseignez :
   - **Montant** payé
   - **Méthode** : Espèces, Carte, Virement bancaire, Mobile Money, Autre
   - **Référence** de transaction (optionnel)
4. Le statut de la facture se met à jour automatiquement :
   - Si le total des paiements couvre le montant → **Payée**
   - Si partiel → **Partiellement payée**

---

## 9. Stock & Articles

> **Accès** : Menu latéral → **Stock**

### Articles

La page stock liste tous les articles avec :
- Nom et SKU (référence)
- Catégorie
- Prix de vente et prix d'achat
- Stock actuel / Stock minimum
- Unité de mesure

**Indicateur visuel** : les articles en rupture (stock ≤ minimum) sont signalés en rouge.

#### Créer un article

1. Cliquez sur **« Nouvel article »**
2. Remplissez :
   - **Nom** (obligatoire)
   - **SKU** (référence, optionnel)
   - **Catégorie** (optionnel)
   - **Description** (optionnel)
   - **Prix de vente** et **Prix d'achat**
   - **Stock initial** et **Stock minimum** (seuil d'alerte)
   - **Unité** : pièce, bouteille, kg, etc.
3. Cliquez sur **« Créer »**

### Catégories

Organisez vos articles par catégories (ex : Boissons, Nourriture, Fournitures). Les catégories supportent une hiérarchie parent-enfant.

### Mouvements de stock

Chaque variation de stock est tracée :

| Type | Description |
|------|-------------|
| Achat | Réception de marchandise d'un fournisseur |
| Vente | Sortie liée à une vente |
| Ajustement | Correction manuelle d'inventaire |
| Transfert | Déplacement entre établissements |
| Perte | Produit perdu, cassé ou périmé |
| Retour | Retour fournisseur |

#### Enregistrer un mouvement

1. Cliquez sur **« Nouveau mouvement »**
2. Sélectionnez l'**article** et le **type** de mouvement
3. Indiquez la **quantité** (positive pour les entrées, négative pour les sorties)
4. Optionnel : **fournisseur**, **coût unitaire**, **motif**
5. Le stock est mis à jour automatiquement

> Certains mouvements peuvent nécessiter une **approbation** par un manager ou administrateur avant d'être appliqués.

---

## 10. Fournisseurs

> **Accès** : Menu latéral → **Fournisseurs**

### Liste des fournisseurs

Affiche tous les fournisseurs actifs avec nom, email, téléphone et adresse.

### Créer un fournisseur

1. Cliquez sur **« Nouveau fournisseur »**
2. Remplissez :
   - **Nom** (obligatoire)
   - **Email** (optionnel)
   - **Téléphone** (optionnel)
   - **Adresse** (optionnel)
   - **Notes** (optionnel)
3. Cliquez sur **« Créer »**

### Modifier / Supprimer

- ✏️ pour modifier les informations
- 🗑️ pour désactiver le fournisseur (suppression logique)

---

## 11. Utilisateurs

> **Accès** : Menu latéral → **Utilisateurs**
> **Visible par** : Super Admin, Admin Établissement, Manager

### Liste des utilisateurs

Le tableau affiche :
- Nom complet
- Email
- Rôle (Super Admin, Admin Établissement, Manager, Employé)
- Établissements assignés
- Statut (Actif, En attente, Verrouillé, Archivé)
- Dernière connexion

### Qui peut créer des utilisateurs ?

| Créateur | Rôles créables | Statut initial |
|----------|---------------|----------------|
| **Super Admin** | Super Admin, Admin, Manager, Employé | Actif |
| **Admin Établissement** | Manager, Employé | Actif |
| **Manager** | Employé uniquement | **En attente de validation** |

### Créer un utilisateur

1. Cliquez sur **« Nouvel utilisateur »** (ou **« Nouvel employé »** pour les managers)
2. Remplissez :
   - **Prénom** et **Nom**
   - **Email**
   - **Mot de passe** (minimum 8 caractères, avec majuscule, minuscule et chiffre)
   - **Rôle** : les options disponibles dépendent de votre propre rôle
   - **Téléphone** (optionnel)
   - **Établissements assignés** : cochez les établissements auxquels l'utilisateur aura accès
3. Cliquez sur **« Créer »**

> **Manager** : les employés que vous créez apparaîtront avec le statut « En attente ». Ils ne pourront se connecter qu'après validation par un administrateur de l'établissement.

### Approuver un employé (Admin uniquement)

Lorsqu'un manager crée un employé, celui-ci apparaît avec le statut **« En attente »** dans la liste. Pour l'activer :

1. Repérez l'utilisateur avec le badge **En attente**
2. Cliquez sur l'icône de validation (✓) à droite de la ligne
3. L'utilisateur passe en statut **Actif** et peut désormais se connecter

### Assigner des établissements

Chaque utilisateur (sauf le Super Admin) ne voit que les données des établissements auxquels il est assigné :
- Chambres filtrées par établissement
- Réservations limitées aux chambres de ses établissements
- Factures associées à ses réservations

Le **Super Admin** a accès à tous les établissements sans restriction.

### Modifier un utilisateur

Cliquez sur ✏️ pour modifier le rôle, le téléphone ou les établissements assignés. L'email ne peut pas être modifié après création.

### Archiver un utilisateur

Cliquez sur l'icône d'archivage. L'utilisateur sera :
- Passé en statut **Archivé**
- Toutes ses sessions seront révoquées (déconnexion immédiate)

> Le dernier Super Admin ne peut pas être archivé.

---

## 12. Paramètres

> **Accès** : Menu latéral → **Paramètres**
> **Visible par** : Super Admin uniquement

La page paramètres permet de consulter et modifier les informations de votre organisation :
- Nom de l'organisation
- Plan d'abonnement actif
- Préférences (devise, fuseau horaire, langue)

---

## 13. Rôles et permissions

Le système définit **quatre niveaux d'accès** :

| Rôle | Portée | Description |
|------|--------|-------------|
| **Super Admin** | Plateforme | Administrateur principal, accès total à tous les établissements et paramètres |
| **Admin Établissement** | Établissement(s) | Gère son/ses établissements : utilisateurs, fournisseurs, rapports |
| **Manager** | Établissement(s) | Opérations courantes, peut créer des employés (sous validation admin) |
| **Employé** | Établissement(s) | Accès opérationnel : chambres et réservations |

### Matrice des permissions

| Fonctionnalité | Super Admin | Admin Étab. | Manager | Employé |
|----------------|:-----------:|:-----------:|:-------:|:-------:|
| Paramètres plateforme | ✅ | | | |
| Créer/supprimer établissements | ✅ | | | |
| Modifier un établissement | ✅ | ✅ | | |
| Rapports | ✅ | ✅ | | |
| Fournisseurs | ✅ | ✅ | | |
| Gérer les utilisateurs | ✅ | ✅ | ✅ ¹ | |
| Approuver les nouveaux employés | ✅ | ✅ | | |
| Factures & Paiements | ✅ | ✅ | ✅ | |
| Stock & Inventaire | ✅ | ✅ | ✅ | |
| Chambres (CRUD) | ✅ | ✅ | ✅ | lecture |
| Réservations | ✅ | ✅ | ✅ | ✅ |
| Tableau de bord | ✅ | ✅ | ✅ | ✅ |

¹ Le manager ne peut créer que des employés, qui restent en statut **« En attente »** jusqu'à validation par un admin.

### Visibilité des menus

Les utilisateurs ne voient dans le menu latéral **que les sections auxquelles ils ont accès**. Un employé ne verra par exemple que : Tableau de bord, Chambres et Réservations.

### Isolation par établissement

- Le **Super Admin** a une vue globale sur tous les établissements
- Les **Admin, Manager et Employé** ne voient que les données liées à leurs établissements assignés

---

## 14. FAQ

**Q : J'ai oublié mon mot de passe, que faire ?**
R : Cliquez sur « Mot de passe oublié ? » sur la page de connexion et suivez les instructions.

**Q : Comment changer de plan d'abonnement ?**
R : Contactez le support ou accédez à la section Paramètres pour gérer votre abonnement.

**Q : Un utilisateur ne voit pas certaines chambres ou réservations.**
R : Vérifiez que l'utilisateur est bien assigné aux établissements concernés (menu Utilisateurs → modifier → cocher les établissements).

**Q : Un employé créé par un manager ne peut pas se connecter.**
R : L'employé est en attente de validation. Un administrateur de l'établissement doit l'approuver depuis la page Utilisateurs (icône ✓).

**Q : Comment savoir quels articles sont en rupture de stock ?**
R : Le tableau de bord affiche les alertes de stock bas. Vous pouvez aussi filtrer les articles en stock faible depuis la page Stock.

**Q : Puis-je supprimer définitivement un établissement ou un utilisateur ?**
R : Non, les suppressions sont logiques (archivage/désactivation) pour préserver l'historique des données.

**Q : Comment associer une facture à une réservation ?**
R : Lors de la création d'une facture, sélectionnez la réservation dans le champ prévu. Vous pouvez aussi créer une facture libre sans réservation.

**Q : Quelle est la différence entre Super Admin et Admin Établissement ?**
R : Le Super Admin a un accès global à la plateforme (tous les établissements, paramètres, création d'autres admins). L'Admin Établissement est rattaché à un ou plusieurs établissements et ne gère que ceux-ci.

---

*Document mis à jour le 15 mars 2026 — Hotel PMS v1.1*
