# Teranga PMS — Guide Utilisateur

Ce guide vous accompagne dans l'utilisation quotidienne de la plateforme Teranga PMS, que ce soit depuis l'interface web ou l'application mobile.

---

## Table des matières

1. [Connexion](#1-connexion)
2. [Tableau de bord](#2-tableau-de-bord)
3. [Gestion du menu (Manager)](#3-gestion-du-menu-manager)
4. [Approbations (DAF)](#4-approbations-daf)
5. [Prise de commandes (Serveur)](#5-prise-de-commandes-serveur)
6. [Cuisine (Cuisinier)](#6-cuisine-cuisinier)
7. [Chambres et réservations](#7-chambres-et-réservations)
8. [Factures et paiements](#8-factures-et-paiements)
9. [Reçus et factures PDF](#9-reçus-et-factures-pdf)
10. [Ménage (Nettoyage)](#10-ménage-nettoyage)
11. [Notifications](#11-notifications)
12. [Synchronisation calendrier (iCal)](#12-synchronisation-calendrier-ical)
13. [Profil utilisateur](#13-profil-utilisateur)
14. [Rapports et exports](#14-rapports-et-exports)
15. [Gestion des utilisateurs](#15-gestion-des-utilisateurs)
16. [Application mobile](#16-application-mobile)
17. [Questions fréquentes](#17-questions-fréquentes)

---

## 1. Connexion

### Interface web

1. Ouvrez votre navigateur et accédez à l'adresse de la plateforme (ex : `http://localhost:3001`)
2. Saisissez votre **adresse e-mail** et votre **mot de passe**
3. Cliquez sur **Se connecter**

Vous serez redirigé vers le tableau de bord correspondant à votre rôle.

### Application mobile

1. Ouvrez l'application **Teranga PMS** sur votre appareil Android
2. Saisissez votre e-mail et mot de passe
3. Appuyez sur **Connexion**

L'application détecte automatiquement votre rôle et affiche l'interface adaptée.

### Rôles disponibles

| Rôle | Accès principal |
|------|----------------|
| **Propriétaire (Owner)** | Accès complet, modifier l'établissement, canaux de réservation |
| **DAF** | Tout voir, approuver, rapports, finances |
| **Manager** | Créer le menu, gérer le personnel, rapports, canaux |
| **Serveur** | Prendre les commandes, afficher les QR codes, télécharger les reçus |
| **Cuisinier** | Voir et traiter les commandes en cuisine |
| **Ménage** | Pointer le nettoyage des chambres, notifications cliquables |
| **POS** | Facturation et encaissement |

---

## 2. Tableau de bord

Chaque rôle dispose d'un tableau de bord adapté à ses besoins.

### Propriétaire (Owner)

Le dashboard du Propriétaire est identique à celui du DAF, avec le titre "Propriétaire". Il a accès à toutes les fonctionnalités, incluant la modification de l'établissement et les canaux de réservation.

### DAF

Le dashboard du DAF affiche :

- **Bandeau d'approbation** : si des demandes sont en attente (création d'articles, d'employés, etc.), un bandeau orange avec un badge animé s'affiche en haut. Cliquez dessus pour accéder directement à la page d'approbations.
- **Chambres** : nombre de chambres disponibles, occupées, taux d'occupation
- **Réservations** : dernières réservations avec statut
- **Commandes** : statistiques du jour, de la semaine, du mois
- **Indicateurs financiers** : flux de paiement, mouvements de stock, temps de traitement, statut des chambres
- **Factures** : dernières factures et montants en attente
- **Graphiques** : occupation des chambres, niveaux de stock, commandes par serveur, flux de paiement

### Manager

Le dashboard du Manager affiche :

- **Chambres** : disponibilité et taux d'occupation
- **Réservations** : dernières réservations
- **Commandes** : statistiques du jour, semaine, mois
- **Stock** : alertes stock bas
- **Graphiques** : occupation, stock, commandes cuisine, commandes par serveur

### Serveur

Le dashboard du Serveur affiche :

- **État des chambres** : vue d'ensemble rapide (libres, occupées, nettoyage)
- **Mes commandes** : nombre de commandes du jour, de la semaine, du mois (uniquement les vôtres)
- **Commandes globales** : vue d'ensemble de toutes les commandes
- **Accès rapide** : lien vers la page commandes

### Cuisinier

- Commandes en attente, en préparation et prêtes
- Résumé des commandes du jour

### Ménage

- Chambres à nettoyer
- Nettoyages en cours
- Chambres nettoyées aujourd'hui
- Accès rapide à la liste des chambres

---

## 3. Gestion du menu (Manager)

Le Manager est responsable de la création des éléments du menu. Les articles sont organisés en catégories : **Restaurant** (plats) et **Boissons**.

### Créer un article

1. Allez dans **Menu & Articles** dans la barre latérale
2. Cliquez sur le bouton **+ Article** en haut à droite
3. Remplissez le formulaire :

| Champ | Obligatoire | Description |
|-------|:-----------:|-------------|
| **Catégorie** | Oui | Restaurant ou Boissons |
| **Nom** | Oui | Nom du plat ou de la boisson (ex : "Poulet braisé") |
| **Prix de vente** | Oui | Prix en FCFA |
| **Photo** | Non | Cliquez sur la zone d'upload pour ajouter une image depuis votre appareil (JPG, PNG ou WebP, max 5 Mo) |
| **Description** | Non | Description visible par le serveur sur l'app mobile |
| **Unité** | Non | Plat, Verre, Bouteille, Canette, etc. |
| **SKU** | Non | Code interne optionnel |
| **Prix d'achat** | Non | Pour le calcul des marges |

4. La section **Stock & inventaire** est optionnelle. Pour les plats préparés, vous n'avez pas besoin de renseigner le stock.
5. Cliquez sur **Créer l'article**

**Important** : Les articles créés par un Manager sont en statut **"En attente d'approbation"** jusqu'à validation par le DAF. Ils n'apparaîtront pas dans le menu du serveur tant qu'ils ne sont pas approuvés.

### Comprendre les erreurs

Le formulaire affiche des messages d'erreur clairs sous chaque champ :
- *"Le nom de l'article est requis"* → Saisissez un nom
- *"Le prix de vente est requis et doit être positif"* → Entrez un prix valide
- *"Veuillez sélectionner une catégorie"* → Choisissez Restaurant ou Boissons
- *"L'image ne doit pas dépasser 5 Mo"* → Réduisez la taille de votre photo

### Voir le statut d'un article

Dans la liste des articles :
- Badge **"Validé"** (vert) : l'article est actif et visible par les serveurs
- Badge **"En attente"** (orange) : l'article attend la validation du DAF
- Les articles en attente apparaissent en grisé

### Filtrer les articles

Utilisez les filtres en haut de la liste :
- **Recherche** : tapez un nom ou un SKU
- **Catégorie** : filtrez par Restaurant, Boissons ou autre

---

## 4. Approbations (DAF)

Le DAF valide les demandes soumises par le Manager et les autres rôles.

### Voir les demandes en attente

1. Un **bandeau d'alerte** sur le dashboard indique le nombre de demandes en attente. Cliquez dessus.
2. Vous pouvez aussi accéder à la page via **Approbations** dans la barre latérale.

### Types de demandes

| Type | Description |
|------|-------------|
| **Création article menu** | Un Manager a créé un nouvel article. Vous voyez le nom et le prix proposé. |
| **Création employé** | Un Manager a créé un nouveau collaborateur. Vous voyez son nom, e-mail et rôle. |
| **Création de chambre** | Un Manager a ajouté une chambre. |
| **Mouvement de stock** | Un mouvement de stock nécessite votre validation. |
| **Modification réservation** | Un Manager a modifié les dates d'une réservation. |

### Approuver ou rejeter

1. Pour **approuver** : cliquez sur l'icône vert (coche) à droite de la demande
2. Pour **rejeter** : cliquez sur l'icône rouge (croix). Une fenêtre vous demande un motif optionnel.

Lorsqu'un article est approuvé, il devient immédiatement visible dans le menu des serveurs.

### Filtrer les demandes

- **Statut** : En attente, Approuvées, Rejetées
- **Type** : filtrer par type de demande (article, employé, chambre, etc.)

---

## 5. Prise de commandes (Serveur)

Le serveur prend les commandes des clients et génère les QR codes de paiement.

### Sur le web

1. Allez dans **Commandes** dans la barre latérale
2. Cliquez sur **+ Nouvelle commande**
3. Remplissez le formulaire :
   - **N° Table** (optionnel) : numéro ou nom de la table
   - **Moyen de paiement** : Flooz (Moov Money), Yas (MTN), Espèces, Carte, etc.
   - **Articles** : sélectionnez les articles dans la liste déroulante. Seuls les articles des catégories Restaurant et Boissons sont proposés. Ajustez la quantité. Cliquez sur *"+ Ajouter un article"* pour en ajouter d'autres.
   - **Notes** (optionnel) : instructions spéciales
4. Cliquez sur **Créer la commande**
5. Un **QR code de paiement** s'affiche automatiquement. Montrez-le au client pour qu'il scanne avec son application Flooz ou Yas.

### Sur l'application mobile

1. Depuis le dashboard, appuyez sur le bouton **"Accéder au menu"**
2. Le menu s'affiche avec deux onglets : **Restaurant** et **Boissons**
3. Chaque article est présenté sous forme de carte avec :
   - Photo du plat/boisson
   - Nom
   - Prix en FCFA
   - Description
4. Appuyez sur un article pour l'ajouter à la commande
5. Sélectionnez le moyen de paiement (Flooz ou Yas)
6. Validez la commande
7. Le **QR code** s'affiche. Montrez-le au client.

### Afficher le QR code d'une commande existante

Dans la liste des commandes, cliquez sur l'icône QR code (colonne "Paiement") pour réafficher le QR code d'une commande déjà créée.

### Suivi des commandes

- **En attente** : la commande vient d'être créée
- **En préparation** : la cuisine a pris en charge la commande
- **Prête** : la commande est prête à être servie
- **Servie** : le serveur peut marquer la commande comme servie

---

## 6. Cuisine (Cuisinier)

Le cuisinier gère la préparation des commandes.

### Voir les commandes

1. Allez dans **Cuisine** (web) ou ouvrez l'onglet Cuisine (mobile)
2. Les commandes apparaissent par statut :
   - **En attente** : nouvelles commandes à préparer
   - **En préparation** : commandes en cours de préparation
   - **Prêtes** : commandes terminées, en attente d'être servies

### Changer le statut d'une commande

- Cliquez sur **"En préparation"** pour signaler que vous commencez à préparer
- Cliquez sur **"Prête"** pour signaler que la commande est terminée

Le serveur sera notifié que la commande est prête à être servie.

---

## 7. Chambres et réservations

### Voir les chambres (DAF, Manager, Ménage)

1. Allez dans **Chambres** dans la barre latérale
2. Chaque chambre affiche son numéro et son statut :
   - **Disponible** (vert) : prête à accueillir un client
   - **Occupée** (rouge) : un client est en séjour
   - **Nettoyage** (bleu) : en cours de nettoyage
   - **Maintenance** (orange) : hors service temporaire

### Créer une réservation (DAF, Manager)

1. Allez dans **Réservations**
2. Cliquez sur **+ Nouvelle réservation**
3. Renseignez : nom du client, chambre, dates d'arrivée et de départ
4. Validez

### Check-in / Check-out

- **Check-in** : confirmez l'arrivée du client. La chambre passe en statut "Occupée"
- **Check-out** : confirmez le départ. La chambre passe automatiquement en statut "Nettoyage"

> Le serveur voit l'état des chambres sur son dashboard mais n'a pas accès aux écrans Chambres et Réservations.

---

## 8. Factures et paiements

### Voir les factures

1. Allez dans **Factures** dans la barre latérale
2. Les factures sont numérotées automatiquement : `FAC-YYYYMMDD-NNNN`
3. Statuts possibles :
   - **Émise** : facture créée, en attente de paiement
   - **Payée** : paiement reçu
   - **Annulée** : facture annulée
   - **En retard** : paiement non reçu après la date limite

### Factures automatiques

Chaque commande créée génère automatiquement une facture. Vous n'avez pas besoin de créer manuellement une facture pour les commandes.

### Paiements

1. Allez dans **Paiements**
2. Vous pouvez enregistrer un paiement reçu et l'associer à une facture
3. Les moyens de paiement : Espèces, Carte, Flooz, Yas, Mobile Money, Virement

---

## 9. Reçus et factures PDF

Les rôles **Serveur**, **Manager**, **DAF**, **Owner** et **Super Admin** peuvent télécharger les documents PDF.

### Télécharger un reçu (commandes)

1. Allez dans **Commandes**
2. Sur chaque ligne de commande, cliquez sur l'icône de téléchargement (flèche vers le bas) dans la colonne "Paiement"
3. Un fichier PDF est téléchargé au format **ticket de caisse** (80mm)

Le reçu contient :
- En-tête : nom de l'établissement, adresse, téléphone, email
- Numéro de commande et date
- Numéro de table et nom du serveur
- Liste des articles avec quantités et prix
- Total en FCFA
- Moyen de paiement
- QR code de vérification
- Message de remerciement

### Télécharger une facture PDF

1. Allez dans **Factures**
2. Sur chaque facture, cliquez sur l'icône de téléchargement (flèche vers le bas)
3. Un fichier PDF est téléchargé au format **A4**

La facture contient :
- En-tête de l'établissement
- Numéro de facture, date, statut
- Informations client (si réservation liée)
- Numéro de commande, table, serveur, moyen de paiement
- Tableau détaillé des articles (description, quantité, prix unitaire, total)
- Sous-total, taxe et total en FCFA
- QR code de vérification

---

## 10. Ménage (Nettoyage)

### Démarrer un nettoyage depuis une notification

Lorsqu'un client quitte sa chambre (check-out), l'agent de ménage reçoit une **notification automatique**. Pour commencer le nettoyage :

1. Cliquez sur la notification dans la barre latérale (icône cloche)
2. La page Ménage s'ouvre automatiquement avec la **chambre pré-sélectionnée**
3. Cliquez sur **Commencer** pour démarrer le nettoyage

### Pointer un nettoyage manuellement

1. Allez dans **Ménage** (web) ou ouvrez l'onglet Ménage (mobile)
2. Cliquez sur **Pointer (début)**
3. Sélectionnez la chambre dans la liste (les chambres "Disponible" et "Nettoyage" sont affichées)
4. Ajoutez des notes si nécessaire (ex : nettoyage en profondeur)
5. Cliquez sur **Commencer**

### Terminer un nettoyage

1. Dans la section **Sessions en cours**, trouvez votre session
2. Cliquez sur **Pointer (fin)**
3. La chambre repasse automatiquement en statut **"Disponible"**
4. Une notification est envoyée au Manager/DAF

### Suivi (web)

- **Sessions en cours** : cartes avec le numéro de chambre, l'agent, l'heure de début
- **Historique** : tableau avec chambre, agent, début, fin, durée, statut

### Suivi (mobile)

Le dashboard du ménage affiche :
- Chambres à nettoyer
- Sessions du jour
- Durée moyenne de nettoyage
- Résumé de l'état des chambres

---

## 11. Notifications

Le système envoie des notifications en temps réel selon votre rôle. Elles sont visibles via l'icône **cloche** dans la barre latérale.

### Types de notifications

| Notification | Destinataires | Action au clic |
|-------------|---------------|----------------|
| **Check-out chambre** | Ménage | Ouvre la page Ménage avec la chambre pré-sélectionnée |
| **Nettoyage terminé** | Manager, DAF | Ouvre la page Ménage |
| **Nouvelle commande** | Cuisinier | Ouvre la page Cuisine |
| **Commande prête** | Serveur | Ouvre la page Commandes |
| **Approbation requise** | DAF, Owner | Ouvre la page Approbations |
| **Résultat approbation** | Demandeur | Ouvre la page Approbations |
| **Alerte stock** | Manager, DAF | Ouvre la page Alertes stock |
| **Synchronisation canal** | Manager, DAF, Owner | Ouvre la page Canaux |

### Gérer les notifications

- **Marquer comme lue** : cliquez sur la notification
- **Tout marquer comme lu** : cliquez sur "Tout lire" en haut du panneau
- **Indicateur** : un badge rouge sur la cloche indique le nombre de notifications non lues

---

## 12. Synchronisation calendrier (iCal)

La synchronisation iCal permet de connecter les chambres aux plateformes de réservation externes pour éviter les doubles réservations.

### Rôles autorisés

Seuls les comptes **Owner**, **DAF** et **Manager** ont accès à la page **Canaux**.

### Connecter une chambre

1. Allez dans **Canaux** dans la barre latérale
2. Cliquez sur **Connecter un canal**
3. Sélectionnez la chambre et la plateforme (Airbnb, Booking.com, Expedia)
4. Cliquez sur **Connecter**

### Exporter les disponibilités

1. Sur la connexion créée, cliquez sur l'icône **Copier** pour copier l'URL d'export
2. Dans la plateforme externe : collez cette URL dans la section "Importer un calendrier"
3. La plateforme synchronisera automatiquement les dates bloquées

### Importer les réservations externes

1. Dans la plateforme externe, trouvez l'option "Exporter le calendrier"
2. Copiez l'URL iCal fournie
3. Dans le PMS : collez l'URL dans le champ **URL d'import** de la connexion
4. Cliquez sur **Synchroniser maintenant** pour tester
5. La synchronisation automatique s'exécute toutes les 15 minutes (configurable : 5 min à 24h)

### Gestion des conflits

- Le PMS a **priorité** : une réservation externe en conflit est ignorée
- Les conflits sont visibles dans l'historique de synchronisation
- Les annulations sur la plateforme externe sont automatiquement détectées

### Sécurité

- Chaque URL d'export contient un **token unique** (non devinable)
- Si compromis, le token peut être **régénéré** (l'ancienne URL cesse de fonctionner)
- Les feeds ne contiennent aucune donnée client

---

## 13. Profil utilisateur

### Modifier ses informations

1. Cliquez sur **Profil** dans la barre latérale
2. Modifiez votre nom, prénom ou e-mail
3. Sauvegardez

### Changer son mot de passe

1. Allez dans **Profil**
2. Renseignez l'ancien mot de passe, puis le nouveau (2 fois)
3. Sauvegardez

---

## 14. Rapports et exports

Accessible aux rôles **DAF** et **Manager** via **Rapports** dans la barre latérale.

### Indicateurs disponibles

| Indicateur | Description |
|-----------|-------------|
| **Taux d'occupation** | Pourcentage de chambres occupées |
| **Revenus totaux** | Total des commandes enregistrées |
| **Factures en attente** | Montant des factures non payées |
| **Commandes du jour** | Nombre de commandes aujourd'hui, cette semaine, ce mois |

### Graphiques

- **Occupation des chambres** : camembert (disponibles, occupées, nettoyage, maintenance)
- **Modes de paiement** : répartition Flooz, Yas, Espèces, Carte, etc.
- **Performance par serveur** : histogramme double axe (nombre de commandes + revenus générés)
- **Statut des commandes** : camembert (en attente, en cours, prêtes, servies, annulées)

### Tableau des serveurs

Un tableau détaillé affiche pour chaque serveur :
- Nom
- Nombre de commandes
- Revenus générés
- Moyenne par commande

### Exporter les données

Trois boutons d'export CSV sont disponibles en haut de la page :
- **Commandes** : toutes les commandes avec numéro, date, serveur, total, statut, paiement
- **Chambres** : toutes les chambres avec numéro, statut, type, étage
- **Serveurs** (DAF uniquement) : performance par serveur

Les fichiers sont téléchargés au format CSV, utilisables dans Excel ou Google Sheets.

---

## 15. Gestion des utilisateurs

### Créer un employé (Manager)

1. Allez dans **Utilisateurs**
2. Cliquez sur **+ Nouvel utilisateur**
3. Renseignez : nom, prénom, e-mail, mot de passe, rôle (Serveur, Cuisinier ou Ménage)
4. Validez

L'employé sera créé en statut **"En attente"** jusqu'à validation par le DAF.

### Approuver un employé (DAF)

1. Allez dans **Approbations**
2. Trouvez la demande de type "Création employé"
3. Approuvez ou rejetez

Une fois approuvé, l'employé peut se connecter avec ses identifiants.

---

## 16. Application mobile

### Installation

L'application est disponible pour les appareils Android. Contactez votre administrateur pour obtenir le fichier APK ou l'accès via le Play Store interne.

### Navigation

La barre de navigation en bas de l'écran affiche les sections accessibles selon votre rôle :

| Rôle | Onglets visibles |
|------|-----------------|
| **Serveur** | Accueil, Commandes, POS |
| **Cuisinier** | Accueil, Cuisine |
| **Ménage** | Accueil, Ménage |
| **Manager** | Accueil, Chambres, Réservations, Commandes, Stock, Approbations, POS |
| **DAF** | Accueil, Chambres, Réservations, Commandes, Stock, Approbations |

### Fonctionnalités clés par rôle

**Serveur :**
- Dashboard avec bouton "Accéder au menu" rouge
- Menu en cartes avec onglets Restaurant/Boissons
- Prise de commande en un clic sur l'article
- QR code de paiement automatique
- Stats personnelles (mes commandes, mes revenus du jour)
- Vue de l'état des chambres

**Cuisinier :**
- Vue des commandes en attente, en préparation, prêtes
- Changement de statut en un clic

**Ménage :**
- Clock-in / Clock-out sur les chambres
- Suivi des sessions du jour

### Connexion au serveur

L'application se connecte au serveur backend via l'URL configurée. Si vous rencontrez des problèmes de connexion :
1. Vérifiez que vous êtes connecté au même réseau que le serveur
2. Vérifiez que l'URL du serveur est correcte dans les paramètres de l'application
3. Vérifiez que votre compte est actif (approuvé par le DAF)

---

## 17. Questions fréquentes

### Je n'arrive pas à créer un article

- Vérifiez que vous avez sélectionné une **catégorie** (Restaurant ou Boissons)
- Vérifiez que vous avez saisi un **nom** et un **prix de vente**
- Le champ stock n'est pas obligatoire pour les plats préparés
- Si l'erreur persiste, lisez le message d'erreur affiché sous le champ concerné

### Mon article n'apparaît pas dans le menu du serveur

Les articles créés par un Manager nécessitent l'**approbation du DAF**. Demandez au DAF de valider votre article dans la page Approbations.

### Le QR code ne s'affiche pas

- Vérifiez que la commande a bien été créée (message de confirmation)
- Le QR code nécessite qu'une facture soit générée automatiquement
- Vous pouvez réafficher le QR code en cliquant sur l'icône QR dans la colonne "Paiement"

### Je ne vois pas certains menus dans la barre latérale

Chaque rôle a accès uniquement aux fonctionnalités qui le concernent. Par exemple :
- Le **Serveur** ne voit pas Réservations, Chambres, Stock, Approbations
- Le **Cuisinier** ne voit que le Dashboard et la Cuisine
- Le **Ménage** ne voit que le Dashboard, les Chambres et le Ménage

### Comment exporter un rapport ?

1. Connectez-vous en tant que **Manager** ou **DAF**
2. Allez dans **Rapports**
3. Cliquez sur l'un des boutons d'export en haut à droite : **Commandes**, **Chambres** ou **Serveurs**
4. Un fichier CSV est téléchargé automatiquement

### Comment changer le mot de passe d'un utilisateur ?

Contactez le DAF ou le Super Admin pour réinitialiser le mot de passe.

### Comment télécharger un reçu ou une facture en PDF ?

1. Depuis **Commandes** : cliquez sur l'icône de téléchargement (flèche vers le bas) sur la ligne de la commande
2. Depuis **Factures** : cliquez sur l'icône de téléchargement sur la ligne de la facture
3. Le fichier PDF est téléchargé automatiquement
4. Rôles autorisés : Serveur, Manager, DAF, Owner, Super Admin

### Je ne reçois pas de notification quand un client part

- Vérifiez que le check-out a bien été effectué (la chambre doit passer en statut "Nettoyage")
- Le système envoie automatiquement une notification ROOM_CHECKOUT aux agents de ménage
- Vérifiez la connexion SSE (polling toutes les 30 secondes en fallback)

### L'application mobile affiche "EMPLOYEE" au lieu de mon rôle

Déconnectez-vous et reconnectez-vous. L'application détectera votre rôle d'établissement.

---

*Document mis à jour le 25 mars 2026 — Teranga PMS v2.1*
