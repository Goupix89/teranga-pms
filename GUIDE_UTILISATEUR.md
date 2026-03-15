# Guide Utilisateur — Hotel PMS

## Table des matières

1. [Présentation](#1-présentation)
2. [Inscription et abonnement](#2-inscription-et-abonnement)
3. [Connexion](#3-connexion)
4. [Sélection d'établissement](#4-sélection-détablissement)
5. [Tableau de bord](#5-tableau-de-bord)
6. [Établissements](#6-établissements)
7. [Chambres](#7-chambres)
8. [Réservations](#8-réservations)
9. [Commandes (Restaurant/Bar)](#9-commandes-restaurantbar)
10. [Cuisine (temps réel)](#10-cuisine-temps-réel)
11. [Factures](#11-factures)
12. [Paiements](#12-paiements)
13. [Stock & Articles](#13-stock--articles)
14. [Alertes de stock](#14-alertes-de-stock)
15. [Fournisseurs](#15-fournisseurs)
16. [Ménage & Pointage](#16-ménage--pointage)
17. [Approbations](#17-approbations)
18. [Utilisateurs](#18-utilisateurs)
19. [Paramètres](#19-paramètres)
20. [Rôles et permissions](#20-rôles-et-permissions)
21. [FAQ](#21-faq)

---

## 1. Présentation

Hotel PMS est une plateforme de gestion hôtelière multi-établissements. Elle permet de gérer vos chambres, réservations, commandes, factures, stocks et équipes depuis une interface web unique, avec une application mobile pour les serveurs et le POS.

### Fonctionnalités principales

- Gestion de plusieurs établissements depuis un seul compte
- Rôles spécialisés par établissement (DAF, Manager, Serveur, POS, Cuisinier, Ménage)
- Commandes restaurant/bar avec vue cuisine en temps réel
- Paiement mobile via QR code (Moov Money, Mixx by Yas)
- Suivi des réservations et du calendrier d'occupation
- Facturation avec calcul automatique des taxes
- Gestion des stocks avec alertes de pénurie
- Système de pointage pour le service de ménage
- Workflow d'approbation (création employés, modification réservations)
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

5. Après le paiement, votre compte est activé (rôle SUPERADMIN) et vous pouvez vous connecter.

---

## 3. Connexion

1. Accédez à la page de connexion
2. Saisissez votre **email** et votre **mot de passe**
3. Cliquez sur **« Se connecter »**

Après connexion, le système charge automatiquement vos **memberships** (établissements et rôles associés). Si vous avez accès à plusieurs établissements, le premier est sélectionné par défaut.

---

## 4. Sélection d'établissement

Si vous êtes assigné à **plusieurs établissements**, un sélecteur apparaît en haut du menu latéral :

1. Cliquez sur le nom de l'établissement courant
2. Sélectionnez l'établissement souhaité dans la liste déroulante
3. Votre rôle et les menus visibles se mettent à jour automatiquement

> **Note** : Le Super Admin n'a pas de sélecteur car il a accès global à tous les établissements.

---

## 5. Tableau de bord

> **Accès** : Tous les rôles

Le tableau de bord affiche une vue d'ensemble adaptée à votre rôle :

### Indicateurs principaux (cartes en haut)

- **Chambres occupées** : nombre de chambres actuellement occupées / total
- **Arrivées du jour** : réservations avec check-in aujourd'hui
- **Départs du jour** : réservations avec check-out aujourd'hui
- **Revenus du mois** : montant total facturé sur le mois en cours

### Pour le DAF (Dashboard enrichi)

- Diagrammes de fréquentation de l'hôtel
- Taux d'occupation des chambres
- État du stock (articles en alerte)
- Revenus et performance des équipes

### Réservations récentes

Tableau des dernières réservations avec nom du client, chambre, dates et statut.

### Alertes de stock

Articles dont le stock actuel est inférieur au seuil minimum configuré.

---

## 6. Établissements

> **Accès** : Menu latéral → **Établissements** (Super Admin uniquement)

### Créer un établissement

1. Cliquez sur **« Nouvel établissement »**
2. Remplissez : **Nom**, **Adresse**, **Ville**, **Pays**, **Téléphone**, **Email**, **Étoiles** (1-5), **Fuseau horaire**, **Devise**
3. Cliquez sur **« Créer »**

### Modifier / Supprimer

- Le **DAF** peut modifier les informations de son établissement
- Seul le **Super Admin** peut créer ou supprimer des établissements

---

## 7. Chambres

> **Accès** : Menu latéral → **Chambres**
> **Visible par** : DAF, Manager, Serveur, Ménage

### Statuts de chambre

| Statut | Description |
|--------|-------------|
| **Disponible** | Prête à accueillir un client |
| **Occupée** | Un client y séjourne (check-in automatique) |
| **Maintenance** | Travaux en cours |
| **Hors service** | Non utilisable |
| **Nettoyage** | En cours de ménage (automatique via pointage) |

> Pendant un **nettoyage**, la chambre est automatiquement indisponible à la réservation. Elle repasse en **Disponible** quand le ménage se termine.

---

## 8. Réservations

> **Accès** : Menu latéral → **Réservations**
> **Visible par** : DAF, Manager, Serveur

### Créer une réservation

Le **DAF** et le **Manager** peuvent créer des réservations. Les **modifications** faites par un Manager nécessitent une **validation du DAF** via le système d'approbation.

### Cycle de vie

```
En attente → Confirmée → Check-in → Check-out
                ↓
            Annulée / No-show
```

Le check-in/check-out peut être effectué par le DAF, le Manager ou le Serveur.

---

## 9. Commandes (Restaurant/Bar)

> **Accès** : Menu latéral → **Commandes**
> **Visible par** : DAF, Manager, Serveur

### Prise de commande (Serveur)

1. Le serveur crée une commande depuis l'application (web ou mobile)
2. Sélectionnez l'**établissement** et le **numéro de table** (optionnel)
3. Ajoutez les **articles** (boissons, plats) avec les quantités
4. La commande est transmise automatiquement en cuisine

### Paiement par QR code

Pour les paiements mobiles (Moov Money / Mixx by Yas) :
1. Le serveur génère un QR code de paiement
2. Le client scanne le QR code avec son téléphone
3. Le code USSD s'exécute pour un paiement marchand
4. Le système reçoit la confirmation via webhook

### Statistiques Serveur

Chaque serveur peut consulter ses statistiques de commandes :
- **Aujourd'hui** : nombre de commandes du jour
- **Cette semaine** : total hebdomadaire
- **Ce mois** : total mensuel

---

## 10. Cuisine (temps réel)

> **Accès** : Menu latéral → **Cuisine**
> **Visible par** : DAF, Manager, Cuisinier

### Interface cuisine

Le cuisinier accède à un écran temps réel affichant les commandes en cours :
- Commandes **En attente** (nouvelles)
- Commandes **En préparation** (en cours)

### Workflow

1. Le cuisinier voit une nouvelle commande arriver
2. Il la marque **En préparation**
3. Une fois terminée, il la signale **Prête**
4. Le serveur est notifié et peut servir le client
5. Le serveur marque la commande **Servie**

---

## 11. Factures

> **Accès** : Menu latéral → **Factures**
> **Visible par** : DAF, Manager, Serveur

Créez des factures associées à des réservations ou des commandes. Le DAF et le Manager peuvent émettre et annuler des factures.

---

## 12. Paiements

> **Accès** : Menu latéral → **Paiements**
> **Visible par** : DAF, Manager, Serveur, POS

### Méthodes de paiement acceptées

| Méthode | Description |
|---------|-------------|
| Espèces | Paiement en liquide |
| Carte bancaire | Via l'application mobile (POS) |
| Virement | Paiement par virement bancaire |
| Mobile Money | Paiement générique mobile |
| Moov Money | Paiement USSD via Moov |
| Mixx by Yas | Paiement USSD via Mixx |

### Compte POS

Le rôle **POS** regroupe toutes les facturations et permet d'effectuer les paiements par carte bancaire ou Momo depuis l'application mobile.

---

## 13. Stock & Articles

> **Accès** : Menu latéral → **Stock & Inventaire**
> **Visible par** : DAF, Manager

### Création d'articles (DAF uniquement)

Le DAF crée les produits mis en vente et fixe les prix : boissons, menu du restaurant, prix des activités, etc.

### Mouvements de stock

Le DAF et le Manager peuvent enregistrer des mouvements de stock (achat, vente, ajustement, transfert, perte, retour).

---

## 14. Alertes de stock

> **Accès** : Menu latéral → **Alertes Stock**
> **Visible par** : DAF, Manager

### Signaler une pénurie (Manager)

Quand le Manager constate une pénurie d'articles :
1. Accédez à **Alertes Stock**
2. Cliquez sur **« Nouvelle alerte »**
3. Sélectionnez l'**article** concerné
4. Rédigez un **message** décrivant la situation
5. L'alerte est envoyée au DAF

### Résoudre une alerte (DAF)

Le DAF peut marquer une alerte comme **résolue** après avoir pris les mesures nécessaires (commande fournisseur, etc.).

---

## 15. Fournisseurs

> **Accès** : Menu latéral → **Fournisseurs**
> **Visible par** : DAF uniquement

Gestion complète des fournisseurs (nom, email, téléphone, adresse).

---

## 16. Ménage & Pointage

> **Accès** : Menu latéral → **Ménage**
> **Visible par** : DAF, Manager, Ménage (Cleaner)

### Système de pointage

Le service de ménage utilise un système de pointage pour tracer les sessions de nettoyage :

1. **Début de ménage** : le membre du ménage clique sur **« Pointer (début) »** en sélectionnant la chambre
   - L'heure de début est enregistrée
   - La chambre passe automatiquement en statut **Nettoyage** (indisponible à la réservation)

2. **Fin de ménage** : cliquez sur **« Pointer (fin) »** sur la session active
   - L'heure de fin est enregistrée
   - La durée est calculée automatiquement
   - La chambre repasse en statut **Disponible**

### Suivi par le DAF/Manager

Le DAF et le Manager peuvent consulter :
- Les sessions actives (en cours)
- L'historique des sessions de nettoyage
- La durée de chaque session
- Les performances de chaque membre du ménage

---

## 17. Approbations

> **Accès** : Menu latéral → **Approbations**
> **Visible par** : DAF uniquement

Le système d'approbation gère deux types de demandes :

### Création d'employés

Quand un Manager crée un nouvel employé, celui-ci reste en statut **En attente**. Le DAF reçoit une demande d'approbation :
- **Approuver** : l'employé passe en statut **Actif** et peut se connecter
- **Rejeter** : la demande est refusée avec un motif optionnel

### Modification de réservations

Quand un Manager modifie une réservation, la modification passe par le système d'approbation :
- **Approuver** : les changements sont appliqués
- **Rejeter** : la réservation reste inchangée

### Compteur de demandes en attente

Un badge indique le nombre de demandes en attente sur l'icône Approbations dans le menu.

---

## 18. Utilisateurs

> **Accès** : Menu latéral → **Utilisateurs**
> **Visible par** : DAF, Manager

### Liste des utilisateurs

Le tableau affiche :
- Nom complet
- Email
- Établissements assignés et rôle dans chaque établissement
- Statut (Actif, En attente, Verrouillé, Archivé)
- Dernière connexion

### Qui peut créer des utilisateurs ?

| Créateur | Rôles créables | Statut initial |
|----------|---------------|----------------|
| **Super Admin** | Tous les rôles | Actif |
| **DAF** | Manager, Serveur, POS, Cuisinier, Ménage | Actif |
| **Manager** | Serveur, Cuisinier, Ménage | **En attente de validation DAF** |

### Créer un utilisateur

1. Cliquez sur **« Nouvel utilisateur »**
2. Remplissez :
   - **Prénom** et **Nom**
   - **Email**
   - **Mot de passe** (minimum 8 caractères, avec majuscule, minuscule et chiffre)
   - **Rôle d'établissement** : les options disponibles dépendent de votre propre rôle
   - **Téléphone** (optionnel)
   - **Établissements assignés** : cochez les établissements auxquels l'utilisateur aura accès
3. Cliquez sur **« Créer »**

> **Manager** : les employés que vous créez apparaîtront avec le statut « En attente ». Ils ne pourront se connecter qu'après validation par le DAF.

### Approuver un employé (DAF uniquement)

1. Repérez l'utilisateur avec le badge **En attente**
2. Cliquez sur l'icône de validation (✓)
3. L'utilisateur passe en statut **Actif** et peut se connecter

### Archiver un utilisateur

L'archivage :
- Passe l'utilisateur en statut **Archivé**
- Révoque toutes ses sessions (déconnexion immédiate)

> Le dernier Super Admin ne peut pas être archivé.

---

## 19. Paramètres

> **Accès** : Menu latéral → **Paramètres**
> **Visible par** : Super Admin uniquement

La page paramètres permet de consulter et modifier les informations de votre organisation :
- Nom de l'organisation
- Plan d'abonnement actif
- Préférences (devise, fuseau horaire, langue)

---

## 20. Rôles et permissions

Le système utilise un **RBAC à 2 niveaux** :

### Niveau 1 — Rôle Tenant

| Rôle | Description |
|------|-------------|
| **SUPERADMIN** | Administrateur plateforme, accès total |
| **EMPLOYEE** | Utilisateur standard, droits définis par ses rôles d'établissement |

### Niveau 2 — Rôle Établissement

| Rôle | Description |
|------|-------------|
| **DAF** | Directeur Administratif et Financier — administrateur de l'établissement |
| **MANAGER** | Opérations courantes, stock, réservations, création d'employés |
| **SERVER** | Serveur — prise de commandes, paiements |
| **POS** | Point de vente — facturation et encaissement |
| **COOK** | Cuisinier — vue temps réel des commandes |
| **CLEANER** | Ménage — pointage et nettoyage des chambres |

### Matrice des permissions

| Fonctionnalité | SuperAdmin | DAF | Manager | Serveur | POS | Cuisinier | Ménage |
|----------------|:----------:|:---:|:-------:|:-------:|:---:|:---------:|:------:|
| Paramètres plateforme | ✅ | | | | | | |
| Créer/supprimer établissements | ✅ | | | | | | |
| Modifier établissement | ✅ | ✅ | | | | | |
| Gérer utilisateurs | ✅ | ✅ | ✅ ¹ | | | | |
| Approuver employés | ✅ | ✅ | | | | | |
| Rapports & Dashboard | ✅ | ✅ | | | | | |
| Fournisseurs | ✅ | ✅ | | | | | |
| Approbations | ✅ | ✅ | | | | | |
| Articles & Prix | ✅ | ✅ | | | | | |
| Stock & Inventaire | ✅ | ✅ | ✅ | | | | |
| Alertes stock | ✅ | ✅ | ✅ | | | | |
| Factures & Paiements | ✅ | ✅ | ✅ | ✅ | ✅ | | |
| Commandes | ✅ | ✅ | ✅ | ✅ | | | |
| Cuisine (temps réel) | ✅ | ✅ | ✅ | | | ✅ | |
| Chambres | ✅ | ✅ | ✅ | ✅ | | | ✅ |
| Réservations | ✅ | ✅ | ✅ | ✅ | | | |
| Ménage & Pointage | ✅ | ✅ | ✅ | | | | ✅ |
| Tableau de bord | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

¹ Le manager ne peut créer que des serveurs, cuisiniers et ménage, en statut **« En attente »** jusqu'à validation par le DAF.

### Visibilité des menus

Les utilisateurs ne voient dans le menu latéral **que les sections auxquelles ils ont accès** selon leur rôle d'établissement. Un cuisinier ne verra que : Tableau de bord et Cuisine.

### Isolation par établissement

- Le **Super Admin** a une vue globale sur tous les établissements
- Les autres utilisateurs ne voient que les données de leurs établissements assignés

---

## 21. FAQ

**Q : J'ai oublié mon mot de passe, que faire ?**
R : Cliquez sur « Mot de passe oublié ? » sur la page de connexion et suivez les instructions.

**Q : Comment changer de plan d'abonnement ?**
R : Contactez le support ou accédez à la section Paramètres pour gérer votre abonnement.

**Q : Un utilisateur ne voit pas certaines chambres ou réservations.**
R : Vérifiez que l'utilisateur est bien assigné aux établissements concernés (menu Utilisateurs → modifier → cocher les établissements).

**Q : Un employé créé par un manager ne peut pas se connecter.**
R : L'employé est en attente de validation. Le DAF doit l'approuver depuis la page Utilisateurs (icône ✓).

**Q : Comment savoir quels articles sont en rupture de stock ?**
R : Le tableau de bord affiche les alertes de stock bas. Le Manager peut aussi créer des alertes de stock pour signaler une pénurie au DAF.

**Q : Puis-je supprimer définitivement un établissement ou un utilisateur ?**
R : Non, les suppressions sont logiques (archivage/désactivation) pour préserver l'historique des données.

**Q : Quelle est la différence entre Super Admin et DAF ?**
R : Le Super Admin a un accès global à la plateforme (tous les établissements, paramètres). Le DAF est l'administrateur d'un établissement spécifique : il gère les finances, le stock, les utilisateurs et les rapports de son établissement.

**Q : Comment fonctionne le pointage du ménage ?**
R : Le membre du ménage clique « Pointer (début) » pour signaler le début du nettoyage d'une chambre. La chambre devient indisponible. En cliquant « Pointer (fin) », la chambre redevient disponible et la durée de la session est enregistrée.

**Q : Qu'est-ce que le système d'approbation ?**
R : Quand un Manager crée un employé ou modifie une réservation, la demande passe par le DAF qui peut approuver ou rejeter. Cela garantit un contrôle administratif sur les opérations sensibles.

**Q : Comment les serveurs prennent-ils les paiements Momo ?**
R : Le serveur génère un QR code depuis l'application. Le client scanne le QR code qui déclenche un USSD de paiement marchand (Moov Money ou Mixx by Yas). Le paiement est confirmé automatiquement.

---

*Document mis à jour le 15 mars 2026 — Hotel PMS v2.0*
