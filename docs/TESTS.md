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
17. [Mode hors ligne (PWA + Android)](#17-mode-hors-ligne-pwa--android)
18. [Depenses et decaissements](#18-depenses-et-decaissements)
19. [Flag bon proprietaire (isVoucher)](#19-flag-bon-proprietaire-isvoucher)
20. [Modification de reservation](#20-modification-de-reservation)
21. [Factures channel manager](#21-factures-channel-manager)

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
| 4.2.5 | Modifier reservation (DAF direct) | PATCH /api/reservations/:id avec {roomId, checkIn, checkOut, discountRuleId} en tant que DAF | Reservation mise a jour, facture recalculee, Invoice.amount = nouveau montant |
| 4.2.6 | Modifier reservation chambre plus chere | Changer chambre 50k/nuit → 80k/nuit, 2 nuits | Invoice.amount = 160000 (ou 160000 - remise) |
| 4.2.7 | Modifier reservation facture payee | Tenter PATCH sur reservation avec facture PAID | Erreur 409 "Facture deja payee" |
| 4.2.8 | Modifier reservation (Manager via approbation) | PATCH /api/reservations/:id en tant que MANAGER | ApprovalRequest creee, reservation non modifiee immediatement |

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
| 5.7 | POS attribue commande a serveur | Compte POS : POST /api/orders {serverId: X, items: [...]} | Commande cree avec createdById=POS, serverId=X |
| 5.8 | Serveur voit la commande POS | Compte serveur X : GET /api/orders?forUserId=X | La commande saisie par le POS en 5.7 apparait |
| 5.9 | Rapport attribue au serveur | GET /api/orders/stats ou rapport daily apres 5.7 | Le revenu est compte pour X, pas pour POS |
| 5.10 | Date d'operation retroactive (serveur) | POST /api/orders {operationDate: "2026-04-18T12:00:00Z"} (3j passe) | Accepte, facture avec issueDate = 2026-04-18 |
| 5.11 | Date d'operation au-dela de 15j (serveur) | POST /api/orders {operationDate: J-20} avec role SERVER | 400 Bad Request (depasse la limite) |
| 5.12 | Override superviseur | Meme POST en tant que DAF/OWNER/MANAGER | Accepte, pas de limite |
| 5.13 | Puces date mobile | App Android, menu POS/Commandes | Puces "Aujourd'hui / Hier / Avant-hier / Il y a 3j" visibles ; puce "Il y a 14j" visible uniquement pour OWNER/DAF/MANAGER/SUPERADMIN |
| 5.14 | CSV rapports attribue au serveur | /dashboard/reports > export CSV commandes et caisse | Colonne Serveur = serveur attribue (pas le POS) |

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
| 8.6 | Decrement auto a la vente | Article trackStock=true, currentStock=5, creer commande avec quantite=2 | Stock passe a 3, mouvement SALE cree avec orderId |
| 8.7 | Blocage stock zero | Article trackStock=true, currentStock=0, tenter commande | Erreur 409 "Stock insuffisant pour [article]" |
| 8.8 | Blocage stock insuffisant | Article trackStock=true, currentStock=1, commander quantite=2 | Erreur 409 |
| 8.9 | Pas de blocage sans trackStock | Article trackStock=false, currentStock=0, tenter commande | Commande creee normalement |
| 8.10 | Restauration stock sur annulation | Annuler la commande du test 8.6 | Stock revient a 5, mouvement RETURN cree |
| 8.11 | Multi-articles atomique | Commande avec 3 articles trackStock, l'un a stock=0 | Toute la commande refusee (atomique) |

---

## 9. Channel Manager (iCal)

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 9.1 | Exporter iCal | GET /api/calendar/:token.ics | Fichier iCal valide avec les reservations |
| 9.2 | Importer iCal | Configurer une URL d'import | Reservations importees depuis le calendrier externe |
| 9.3 | Sync auto 1min | Configurer syncIntervalMin=1 | Synchronisation chaque minute |
| 9.4 | Logs de sync | Verifier les channel_sync_logs | Logs avec eventsFound, eventsCreated, etc. |
| 9.5 | Conflit de dates | Reservation importee chevauche une existante | Gere sans doublon |
| 9.6 | Facture auto iCal | Importer une reservation depuis iCal | Reservation creee + facture FAC-* PAID + paiement OTHER |
| 9.7 | Facture auto external-bookings | POST /api/external-bookings avec X-Api-Key | Reservation + facture FEDAPAY PAID + client cree si email present |
| 9.8 | CA impacte par channel | Apres 9.6 et 9.7, consulter le rapport du jour | Les montants apparaissent dans l'encaissement et le CA total |
| 9.9 | Backfill CLI | npx tsx scripts/backfill-channel-invoices.ts --dry-run --slug hotel-test | Liste des reservations sans facture, aucune modification |
| 9.10 | Backfill execution | npx tsx scripts/backfill-channel-invoices.ts --slug hotel-test | Factures et paiements crees pour les reservations manquantes |
| 9.11 | Backfill idempotent | Relancer le backfill apres 9.10 | Aucune facture en double creee |

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

---

## 17. Mode hors ligne (PWA + Android)

### 17.1 Web — detection et badge
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 17.1.1 | Perte connexion | Couper le Wi-Fi ou bloquer l'API (DevTools) | Badge rouge "Hors ligne" apparait dans la barre de navigation |
| 17.1.2 | Articles caches | Aller sur le POS en mode hors ligne | Les articles du dernier chargement sont affiches depuis le cache |
| 17.1.3 | Mobile Money desactive | Etre hors ligne sur le POS | Option Flooz/Yas grisee et non selectionnable |
| 17.1.4 | Commande mise en file | Creer une commande hors ligne | Commande ajoutee dans IndexedDB, compteur du badge incremente |

### 17.2 Web — synchronisation
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 17.2.1 | Drain auto a la reconnexion | Retablir la connexion apres 17.1.4 | La commande est envoyee au backend, badge disparait |
| 17.2.2 | Idempotence | Soumettre la meme commande deux fois (uuid identique) | Une seule commande creee dans le backend |
| 17.2.3 | Page file hors ligne | Aller sur /dashboard/offline-queue | Liste des operations en attente visible |
| 17.2.4 | Sync manuelle | Cliquer sur "Synchroniser maintenant" depuis la page file | Drain force, operations envoyees |
| 17.2.5 | Suppression operation | Cliquer sur corbeille sur une operation | Operation supprimee de la file locale |

### 17.3 Android
| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 17.3.1 | Commande hors ligne | Activer mode avion, creer une commande | Commande stockee en Room DB |
| 17.3.2 | Ecran file hors ligne | Ouvrir l'ecran "File hors ligne" | Operations en attente affichees |
| 17.3.3 | Sync au retablissement | Desactiver mode avion | WorkManager envoie les operations, ecran mis a jour |

---

## 18. Depenses et decaissements

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 18.1 | Creer depense | POST /api/expenses {label, category, amount, date} | Depense enregistree |
| 18.2 | Lister depenses | GET /api/expenses?startDate=X&endDate=Y | Liste des depenses sur la periode |
| 18.3 | Filtrer par categorie | GET /api/expenses?category=MATIERES_PREMIERES | Seules les depenses de cette categorie |
| 18.4 | Depenses dans le rapport PDF | Generer le rapport PDF du jour apres 18.1 | Section "Decaissements" presente avec le montant de la depense |
| 18.5 | Ligne Solde | Rapport PDF avec encaissements=50000, decaissements=20000 | Solde = 30 000 FCFA affiche |
| 18.6 | Solde negatif | Decaissements > encaissements | Solde affiche en rouge ou avec signe negatif |
| 18.7 | Depenses dans CSV | Export CSV du rapport | Colonne ou section decaissements presente |
| 18.8 | Acces role SERVER | Tenter GET /api/expenses en tant que SERVER | Erreur 403 |

---

## 19. Flag bon proprietaire (isVoucher)

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 19.1 | Activer flag | PATCH /api/orders/:id/voucher {isVoucher: true} en tant que DAF | Order.isVoucher = true, ApprovalRequest de type VOUCHER_FLAG creee |
| 19.2 | Desactiver flag | PATCH /api/orders/:id/voucher {isVoucher: false} | Order.isVoucher = false |
| 19.3 | Acces SERVER refuse | Meme PATCH en tant que SERVER | Erreur 403 |
| 19.4 | UI — modal confirmation | Cliquer sur l'icone flag dans /dashboard/orders | Modal s'ouvre avec confirmation |
| 19.5 | Affichage dans la liste | Commande avec isVoucher=true dans la liste | Badge ou indicateur visible sur la ligne |

---

## 20. Modification de reservation

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 20.1 | Modifier chambre (DAF) | PATCH /api/reservations/:id {roomId: newRoomId} | Reservation mise a jour, facture.amount recalcule |
| 20.2 | Modifier dates (DAF) | PATCH /api/reservations/:id {checkIn, checkOut} | Nuits recalculees, totalPrice et facture mis a jour |
| 20.3 | Modifier avec remise | PATCH {checkIn, checkOut, discountRuleId} | Remise appliquee au nouveau montant |
| 20.4 | Facture deja payee | PATCH sur reservation avec Invoice.status=PAID | Erreur 409 |
| 20.5 | Modifier (Manager) | PATCH en tant que MANAGER | ApprovalRequest cree, reservation inchangee jusqu'a approbation DAF |
| 20.6 | Approbation DAF → modification effective | DAF approuve la demande 20.5 | Reservation modifiee, facture recalculee |
| 20.7 | Calcul correct | Chambre 25000/nuit, 4 nuits, remise 10% | totalPrice = 90000, Invoice.amount = 90000 |

---

## 21. Factures channel manager

| # | Scenario | Etapes | Resultat attendu |
|---|----------|--------|------------------|
| 21.1 | Reservation iCal → facture | Trigger sync iCal avec une nouvelle reservation | Reservation + Invoice PAID + Payment OTHER crees |
| 21.2 | Reservation external-bookings → facture | POST /api/external-bookings | Reservation + Invoice PAID + Payment FEDAPAY crees |
| 21.3 | Client cree si email | external-bookings avec guestEmail | Client cree ou trouve (findOrCreate) |
| 21.4 | Rapport inclut channel | Rapport quotidien apres 21.1 et 21.2 | Montants des reservations canal inclus dans les encaissements |
| 21.5 | Backfill via endpoint | POST /api/reservations/admin/backfill-channel-invoices | Rapport JSON avec nb de factures creees |
| 21.6 | Backfill idempotent | Rappeler l'endpoint | created=0, aucun doublon |
| 21.7 | Backfill acces restreint | Meme endpoint en tant que SERVER | Erreur 403 |
