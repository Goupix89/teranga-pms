# Teranga PMS — Scenarios de tests

Ce document liste **tous les scenarios de tests** a executer avant la mise en production.

---

## Table des matieres

1. [Inscription et abonnements](#1-inscription-et-abonnements)
2. [Authentification et securite](#2-authentification-et-securite)
3. [Gestion des chambres et etablissements](#3-gestion-des-chambres-et-etablissements)
4. [Reservations](#4-reservations)
5. [Commandes (POS)](#5-commandes-pos)
6. [Facturation et paiements](#6-facturation-et-paiements)
7. [FedaPay (paiements en ligne)](#7-fedapay-paiements-en-ligne)
8. [Gestion des stocks](#8-gestion-des-stocks)
9. [Channel Manager (iCal)](#9-channel-manager-ical)
10. [Application mobile Android](#10-application-mobile-android)
11. [Limites des plans](#11-limites-des-plans)
12. [Cycle de vie des abonnements](#12-cycle-de-vie-des-abonnements)
13. [Notifications](#13-notifications)
14. [API et integrations externes](#14-api-et-integrations-externes)
15. [Performance et charge](#15-performance-et-charge)
16. [Securite](#16-securite)

---

## 1. Inscription et abonnements

### 1.1 Inscription avec essai gratuit
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 1.1.1 | Inscription basique | POST /api/registration/register avec plan "basic" | Tenant cree, statut TRIAL, isActive=true, superadmin ACTIVE |
| 1.1.2 | Essai gratuit actif | Se connecter avec le tenant cree | Connexion reussie, acces complet pendant 14 jours |
| 1.1.3 | Slug reserve | Tenter slug "admin", "api", "www" | Erreur 409 "Ce slug est reserve" |
| 1.1.4 | Slug duplique | Tenter un slug deja utilise | Erreur 409 "Ce slug est deja utilise" |
| 1.1.5 | Email duplique | Tenter un email deja utilise | Erreur 409 "Cet email est deja utilise" |
| 1.1.6 | Plan inexistant | Envoyer planSlug="inexistant" | Erreur 404 |

### 1.2 Affichage des plans
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 1.2.1 | Liste des plans | GET /api/registration/plans | 3 plans retournes (Basic, Pro, Enterprise) avec prix et features |
| 1.2.2 | Plans sur le dashboard | Page /dashboard/subscription | Affiche le plan actuel, l'utilisation, les plans disponibles |

### 1.3 Activation manuelle
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 1.3.1 | Activer manuellement | POST /api/subscriptions/activate {planSlug:"pro", months:1} | Statut ACTIVE, periodEnd = +1 mois |
| 1.3.2 | Activer annuel | POST /api/subscriptions/activate {planSlug:"pro", billingInterval:"YEARLY", months:12} | periodEnd = +12 mois |
| 1.3.3 | Reactiver un suspendu | Depuis un tenant SUSPENDED, activer manuellement | Tenant reactive, users delockes, statut ACTIVE |
| 1.3.4 | Changement de plan | Activer avec un plan different | Plan mis a jour sur le tenant |

---

## 2. Authentification et securite

### 2.1 Connexion
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 2.1.1 | Connexion valide | POST /api/auth/login avec bon email/password | Access token + refresh token retournes |
| 2.1.2 | Mauvais mot de passe | Envoyer un mauvais password | Erreur 401, compteur failedLoginAttempts incremente |
| 2.1.3 | Compte verrouille | 10 tentatives echouees | Compte LOCKED pendant 30 minutes |
| 2.1.4 | Tenant inactif | Se connecter sur un tenant isActive=false | Erreur 401 "Compte desactive" |
| 2.1.5 | Abonnement suspendu | Se connecter sur un tenant avec sub SUSPENDED | Erreur 401 "Abonnement suspendu" |

### 2.2 Tokens
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 2.2.1 | Token expire | Utiliser un token apres 15min | Erreur 401 "Token expire" |
| 2.2.2 | Token invalide | Envoyer un JWT falsifie | Erreur 401 "Token invalide" |
| 2.2.3 | Refresh token | POST /api/auth/refresh avec refresh token valide | Nouveau access token |
| 2.2.4 | SSE avec query token | GET /api/notifications/stream?token=xxx | Connexion SSE etablie |

### 2.3 RBAC
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 2.3.1 | SUPERADMIN acces total | Acceder a toutes les routes | Acces accorde |
| 2.3.2 | SERVER limite | Tenter de creer un utilisateur | Erreur 403 |
| 2.3.3 | COOK acces cuisine | GET /api/orders (cuisine) | Acces accorde |
| 2.3.4 | DAF gestion financiere | Creer facture, paiement, stock | Acces accorde |

---

## 3. Gestion des chambres et etablissements

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 3.1 | Creer un etablissement | POST /api/establishments | Etablissement cree |
| 3.2 | Creer une chambre | POST /api/rooms | Chambre creee avec statut AVAILABLE |
| 3.3 | Modifier chambre | PATCH /api/rooms/:id {type, pricePerNight} | Chambre mise a jour |
| 3.4 | Chambre occupee | Check-in d'une reservation | Chambre passe a OCCUPIED |
| 3.5 | Chambre liberee | Check-out d'une reservation | Chambre passe a AVAILABLE |

---

## 4. Reservations

### 4.1 Creation
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 4.1.1 | Creer reservation | POST /api/reservations avec chambre dispo | Reservation CONFIRMED, facture ISSUED |
| 4.1.2 | Chambre occupee | Tenter de reserver une chambre occupee | Erreur 409 ou chambre indisponible |
| 4.1.3 | Dates invalides | checkOut avant checkIn | Erreur de validation |
| 4.1.4 | Calcul du prix | Reserver 3 nuits a 25000/nuit | totalPrice = 75000 |
| 4.1.5 | Avec FedaPay | paymentMethod=FEDAPAY | Facture avec paymentMethod FEDAPAY |

### 4.2 Cycle de vie
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 4.2.1 | Check-in | POST /api/reservations/:id/check-in | Statut CHECKED_IN, chambre OCCUPIED |
| 4.2.2 | Check-out | POST /api/reservations/:id/check-out | Statut CHECKED_OUT, chambre AVAILABLE |
| 4.2.3 | Annulation | POST /api/reservations/:id/cancel | Statut CANCELLED |
| 4.2.4 | Modifier dates | PATCH /api/reservations/:id/dates | Nouvelles dates, prix recalcule |

---

## 5. Commandes (POS)

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 5.1 | Creer commande | POST /api/orders avec articles | Commande PENDING, facture creee |
| 5.2 | Numero unique | Creer 2 commandes rapidement | Numeros CMD-YYYYMMDD-NNNN differents |
| 5.3 | Numero de facture unique | Creer commande + reservation | Pas de collision FAC-YYYYMMDD-NNNN (compteur global) |
| 5.4 | Marquer servie | PATCH /api/orders/:id {status: "SERVED"} | Statut SERVED |
| 5.5 | Annuler commande | PATCH /api/orders/:id {status: "CANCELLED"} | Statut CANCELLED |
| 5.6 | Commande avec FedaPay | paymentMethod=FEDAPAY | QR code avec URL FedaPay |

---

## 6. Facturation et paiements

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 6.1 | Facture auto | Creer reservation ou commande | Facture FAC-YYYYMMDD-NNNN creee automatiquement |
| 6.2 | QR code paiement | GET /api/invoices/:id/qrcode | QR code data URL retourne |
| 6.3 | QR FedaPay | GET /api/invoices/:id/qrcode?paymentMethod=FEDAPAY | QR code + fedapayCheckoutUrl |
| 6.4 | Paiement cash | POST /api/payments | Paiement enregistre, facture PAID |
| 6.5 | Page factures | /dashboard/invoices | Details des reservations et commandes affiches |
| 6.6 | PDF facture | GET /api/invoices/:id/pdf | PDF genere correctement |

---

## 7. FedaPay (paiements en ligne)

### 7.1 Configuration
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 7.1.1 | Configurer cle | PATCH /api/tenant/settings/fedapay | Cle chiffree et sauvegardee |
| 7.1.2 | Tester connexion | POST /api/tenant/settings/fedapay/test | "Connexion FedaPay reussie" |
| 7.1.3 | Supprimer config | DELETE /api/tenant/settings/fedapay | Configuration supprimee |

### 7.2 Paiement de factures
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 7.2.1 | Creer transaction | GET /api/invoices/:id/qrcode?paymentMethod=FEDAPAY | Transaction FedaPay creee, URL de checkout retournee |
| 7.2.2 | URL valide | Ouvrir l'URL de checkout | Page de paiement FedaPay s'affiche (pas "page not found") |
| 7.2.3 | Webhook approved | POST /api/webhooks/fedapay {name:"transaction.approved"} | Paiement enregistre, facture PAID |
| 7.2.4 | Webhook idempotent | Renvoyer le meme webhook | Pas de doublon de paiement |
| 7.2.5 | Bouton sur le web | Modal QR sur /dashboard/orders | Bouton "Payer avec FedaPay" visible |
| 7.2.6 | Bouton sur mobile | App Android, modal QR | Bouton "Payer avec FedaPay" visible |

### 7.3 Paiement d'abonnements
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 7.3.1 | Lien de renouvellement | POST /api/subscriptions/renew | URL FedaPay retournee |
| 7.3.2 | Paiement abonnement | Webhook avec metadata type=subscription | Subscription ACTIVE, tenant isActive=true |
| 7.3.3 | Periode mise a jour | Apres paiement | currentPeriodStart/End correctement definis |

---

## 8. Gestion des stocks

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 8.1 | Entree de stock | POST /api/stock-movements {type:IN} | Stock article incremente |
| 8.2 | Sortie de stock | POST /api/stock-movements {type:OUT} | Stock article decremente |
| 8.3 | Stock insuffisant | Sortie > stock disponible | Erreur ou alerte |
| 8.4 | Alerte stock bas | Stock < seuil configure | Alerte de stock creee |
| 8.5 | Approbation requise | MANAGER cree un mouvement important | ApprovalRequest creee pour le DAF |

---

## 9. Channel Manager (iCal)

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 9.1 | Exporter iCal | GET /api/calendar/:token.ics | Fichier iCal valide avec les reservations |
| 9.2 | Importer iCal | Configurer une URL d'import | Reservations importees depuis le calendrier externe |
| 9.3 | Sync auto 1min | Configurer syncIntervalMin=1 | Synchronisation chaque minute |
| 9.4 | Logs de sync | Verifier les channel_sync_logs | Logs avec eventsFound, eventsCreated, etc. |
| 9.5 | Conflit de dates | Reservation importee chevauche une existante | Gere sans doublon |

---

## 10. Application mobile Android

### 10.1 Authentification
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 10.1.1 | Login | Entrer email/password | Connexion reussie, token stocke |
| 10.1.2 | Token expire | Attendre 15min | Refresh automatique |
| 10.1.3 | Deconnexion | Bouton deconnexion | Retour a l'ecran de login |

### 10.2 Reservations
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 10.2.1 | Creer reservation | Remplir formulaire + date picker | Reservation creee, QR code affiche |
| 10.2.2 | Date picker check-in | Taper sur le champ date | DatePickerDialog s'ouvre |
| 10.2.3 | Date picker check-out | Selectionner check-in puis check-out | Check-out > check-in (contrainte) |
| 10.2.4 | Methode de paiement | Selectionner FedaPay dans le dropdown | Dropdown visible (scroll), FedaPay selectionnable |
| 10.2.5 | QR + FedaPay | Creer reservation avec FedaPay | Bouton "Payer avec FedaPay" dans le modal QR |
| 10.2.6 | Modifier dates | Bouton modifier dates | DatePicker pour les nouvelles dates |
| 10.2.7 | Check-in mobile | Bouton check-in | Statut mis a jour |
| 10.2.8 | Check-out mobile | Bouton check-out | Statut mis a jour |

### 10.3 Commandes
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 10.3.1 | Creer commande | Selectionner articles + table | Commande creee, QR affiche |
| 10.3.2 | Selection paiement | Cliquer sur chip "FedaPay" | Chip selectionne |
| 10.3.3 | QR + FedaPay | Commande avec FedaPay | Bouton FedaPay dans le modal QR |

### 10.4 Build
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 10.4.1 | Compilation | Build debug dans Android Studio | Pas d'erreur de compilation |
| 10.4.2 | APK release | Build release signe | APK genere correctement |

---

## 11. Limites des plans

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 11.1 | Limite chambres Basic | Creer 21eme chambre (max 20) | Erreur 403 PLAN_LIMIT_REACHED |
| 11.2 | Limite users Basic | Creer 6eme utilisateur (max 5) | Erreur 403 PLAN_LIMIT_REACHED |
| 11.3 | Limite etablissements Basic | Creer 2eme etablissement (max 1) | Erreur 403 PLAN_LIMIT_REACHED |
| 11.4 | Plan Pro sans limite | Creer chambres sur plan Pro (max 100) | Autorise jusqu'a 100 |
| 11.5 | Plan Enterprise illimite | Creer des ressources sans limite | Toujours autorise (max=-1) |
| 11.6 | Affichage usage | Page /dashboard/subscription | Barres de progression correctes |

---

## 12. Cycle de vie des abonnements

### 12.1 Essai gratuit
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 12.1.1 | Debut essai | Inscription avec plan ayant trialDays=14 | statut TRIAL, trialEndsAt = J+14 |
| 12.1.2 | Pendant essai | Utiliser toutes les fonctionnalites | Acces complet |
| 12.1.3 | Fin d'essai | Simuler trialEndsAt dans le passe, executer le cron | Statut PAST_DUE, notification envoyee |

### 12.2 Renouvellement
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 12.2.1 | Rappel J-7 | currentPeriodEnd = J+7, executer le cron | Notification de rappel creee |
| 12.2.2 | Rappel J-3 | currentPeriodEnd = J+3, executer le cron | Notification de rappel creee |
| 12.2.3 | Expiration | currentPeriodEnd = hier, executer le cron | Statut PAST_DUE, gracePeriodEndsAt = J+7 |

### 12.3 Suspension et annulation
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 12.3.1 | Suspension | gracePeriodEndsAt = hier, executer le cron | Statut SUSPENDED, tenant isActive=false |
| 12.3.2 | Acces bloque | Tenter de se connecter sur tenant suspendu | Erreur "Abonnement suspendu" |
| 12.3.3 | Reactivation paiement | Payer via FedaPay | Statut ACTIVE, tenant isActive=true |
| 12.3.4 | Reactivation manuelle | POST /api/subscriptions/activate | Statut ACTIVE, users delockes |
| 12.3.5 | Annulation 30j | 30 jours apres suspension, cron | Statut CANCELLED |

---

## 13. Notifications

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 13.1 | SSE connexion | Ouvrir /api/notifications/stream?token=xxx | Connexion SSE active |
| 13.2 | Notification temps reel | Creer une reservation | Notification apparait en temps reel |
| 13.3 | Cloche notification | Cliquer sur la cloche | Liste des notifications non lues |
| 13.4 | Marquer comme lu | Cliquer sur une notification | Notification marquee comme lue |

---

## 14. API et integrations externes

### 14.1 API Keys
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 14.1.1 | Creer cle API | POST /api/api-keys | Cle generee avec prefix affiche |
| 14.1.2 | Utiliser cle API | Requete avec header X-Api-Key | Acces autorise |
| 14.1.3 | Cle expiree | Utiliser une cle apres expiresAt | Erreur 401 |
| 14.1.4 | IP non autorisee | Requete depuis une IP non whitelistee | Erreur 401 |

### 14.2 Reservations externes (WordPress)
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 14.2.1 | Creer reservation | POST /api/external-bookings avec X-Api-Key | Reservation creee |
| 14.2.2 | Doublon externalRef | Meme externalRef deux fois | Erreur 409 ou mise a jour |

---

## 15. Performance et charge

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 15.1 | Charge moderee | 50 requetes/seconde pendant 1 min | Temps de reponse < 500ms |
| 15.2 | Rate limiting | Plus de 100 requetes/min | Erreur 429 "Trop de requetes" |
| 15.3 | Commandes simultanees | 10 commandes en parallele | Pas de collision de numeros de facture |
| 15.4 | Startup | Redemarrer le backend | Service disponible en < 10 secondes |

---

## 16. Securite

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 16.1 | CORS rejete | Requete depuis un domaine non autorise | Erreur CORS |
| 16.2 | Headers securite | Verifier les headers HTTP | Helmet headers presents (CSP, HSTS, etc.) |
| 16.3 | XSS prevention | Injecter `<script>` dans un champ | Pas d'execution, donnees echappees |
| 16.4 | SQL injection | Injecter `'; DROP TABLE` dans un champ | Requete echoue sans effet |
| 16.5 | Multi-tenant isolation | Acceder aux donnees d'un autre tenant | Erreur 404 ou donnees non retournees |
| 16.6 | Webhook public | POST /api/webhooks/fedapay sans auth | Traite correctement (webhook public) |
| 16.7 | Encryption | Lire les cles FedaPay en base | Cles chiffrees (AES-256-GCM) |

---

## Comment executer les tests

### Tests manuels (avant production)
```bash
# 1. Demarrer l'environnement de dev
docker compose up -d

# 2. Reinitialiser la base de test
docker compose exec backend npx prisma db push --force-reset
docker compose exec backend npx prisma db seed

# 3. Tester les API avec curl ou Postman
# Inscription
curl -X POST http://localhost:4000/api/registration/register \
  -H "Content-Type: application/json" \
  -d '{"tenantName":"Hotel Test","slug":"hotel-test","email":"test@test.com","password":"Test1234!","firstName":"Admin","lastName":"Test","planSlug":"pro","billingInterval":"MONTHLY"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: hotel-test" \
  -d '{"email":"test@test.com","password":"Test1234!"}'
```

### Tests du cycle d'abonnement
```bash
# Simuler l'expiration d'un essai
docker compose exec postgres psql -U pms_user -d hotel_pms -c \
  "UPDATE subscriptions SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE status = 'TRIAL';"

# Forcer l'execution du cron
docker compose exec backend node -e "
  const {manageSubscriptions} = require('./dist/jobs/cron');
  manageSubscriptions().then(() => console.log('Done'));
"

# Verifier le resultat
docker compose exec postgres psql -U pms_user -d hotel_pms -c \
  "SELECT tenant_id, status, grace_period_ends_at FROM subscriptions;"
```

### Tests avec Postman
Importer la collection Postman disponible dans `docs/postman/` (a creer) avec les variables d'environnement pour les tokens et URLs.

### Tests automatises (CI/CD)
Les tests unitaires et d'integration sont executes automatiquement dans GitHub Actions a chaque push/PR. Voir `.github/workflows/deploy.yml`.
