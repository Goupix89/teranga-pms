# Teranga PMS — Guide de mise en production

Ce guide couvre **toutes** les étapes pour déployer Teranga PMS en production avec CyberPanel, de la préparation des secrets jusqu'au CI/CD automatisé.

---

## Table des matières

1. [Architecture de production](#1-architecture-de-production)
2. [Prérequis serveur](#2-prérequis-serveur)
3. [Installation CyberPanel](#3-installation-cyberpanel)
4. [Gestion des secrets](#4-gestion-des-secrets)
5. [Configuration du domaine](#5-configuration-du-domaine)
6. [Déploiement Docker](#6-déploiement-docker)
7. [Configuration OpenLiteSpeed (reverse proxy)](#7-configuration-openlitespeed-reverse-proxy)
8. [SSL/TLS avec Let's Encrypt](#8-ssltls-avec-lets-encrypt)
9. [Base de données en production](#9-base-de-données-en-production)
10. [FedaPay en production](#10-fedapay-en-production)
11. [Sauvegardes](#11-sauvegardes)
12. [Monitoring et alertes](#12-monitoring-et-alertes)
13. [CI/CD avec GitHub Actions](#13-cicd-avec-github-actions)
14. [Sécurité](#14-sécurité)
15. [Maintenance](#15-maintenance)
16. [Checklist avant lancement](#16-checklist-avant-lancement)

---

## 1. Architecture de production

```
Internet
    │
    ▼
┌─────────────────────────────────┐
│  CyberPanel + OpenLiteSpeed     │
│  (SSL termination, reverse proxy)│
│  Port 443 → backend:4000       │
│  Port 443 → frontend:3001      │
└─────────────┬───────────────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌──────┐
│Backend │ │Frontend│ │Redis │
│:4000   │ │:3001   │ │:6379 │
└───┬────┘ └────────┘ └──────┘
    │
    ▼
┌──────────┐
│PostgreSQL│
│:5432     │
└──────────┘
```

**Technologies utilisées :**
| Composant | Technologie | Rôle |
|-----------|-------------|------|
| Serveur | VPS Linux (Ubuntu 22.04+) | Hébergement |
| Panel | CyberPanel | Gestion web, DNS, SSL |
| Reverse proxy | OpenLiteSpeed | SSL, routage, cache |
| Backend | Node.js 20 + Express + Prisma | API REST |
| Frontend | Next.js 14 | Interface web |
| Base de données | PostgreSQL 15 | Stockage persistant |
| Cache | Redis 7 | Sessions, cache |
| Paiements | FedaPay | Abonnements + paiements |
| CI/CD | GitHub Actions | Build, test, déploiement |
| Monitoring | UptimeRobot + Logrotate | Surveillance + logs |
| Backups | pg_dump + cron | Sauvegardes quotidiennes |

---

## 2. Prérequis serveur

### Spécifications minimales
- **CPU** : 2 vCPU
- **RAM** : 4 Go (8 Go recommandé)
- **Disque** : 40 Go SSD
- **OS** : Ubuntu 22.04 LTS
- **Fournisseurs recommandés** : Contabo, Hetzner, DigitalOcean, OVH

### Logiciels requis sur le serveur
```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker et Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Installer Git
sudo apt install -y git

# Vérifier les installations
docker --version        # Docker 24+
docker compose version  # Docker Compose v2+
git --version           # Git 2.34+
```

---

## 3. Installation CyberPanel

```bash
# Installer CyberPanel avec OpenLiteSpeed
sh <(curl https://cyberpanel.net/install.sh || wget -O - https://cyberpanel.net/install.sh)
```

Pendant l'installation :
- Choisir **OpenLiteSpeed** (gratuit)
- Installer **PowerDNS** : Non (sauf si vous gérez votre DNS vous-même)
- Installer **Memcached** : Non (on utilise Redis)
- Installer **phpMyAdmin** : Non

Après l'installation, accéder à CyberPanel : `https://VOTRE_IP:8090`

---

## 4. Gestion des secrets

### Générer tous les secrets

```bash
# Sur votre machine locale ou serveur
echo "DB_PASSWORD=$(openssl rand -hex 24)"
echo "REDIS_PASSWORD=$(openssl rand -hex 24)"
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

### Créer le fichier .env.prod sur le serveur

```bash
# Se connecter au serveur
ssh user@votre-serveur

# Créer le fichier (NE JAMAIS le commiter dans git)
cd /home/teranga/hotel-pms
cp .env.prod.example .env.prod
nano .env.prod
```

Remplir avec les valeurs générées :

```env
DB_PASSWORD=votre_mot_de_passe_db_genere
REDIS_PASSWORD=votre_mot_de_passe_redis_genere
JWT_ACCESS_SECRET=votre_secret_jwt_access_genere
JWT_REFRESH_SECRET=votre_secret_jwt_refresh_genere
ENCRYPTION_KEY=votre_cle_encryption_generee
PUBLIC_URL=https://app.votredomaine.com
ALLOWED_ORIGINS=https://app.votredomaine.com
FEDAPAY_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxx
FEDAPAY_SANDBOX=false
FEDAPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxx
```

### Sécuriser le fichier

```bash
chmod 600 .env.prod
chown root:root .env.prod  # Ou l'utilisateur du déploiement
```

### Rotation des secrets (tous les 6 mois)

```bash
# 1. Générer de nouveaux secrets
NEW_JWT_ACCESS=$(openssl rand -hex 32)
NEW_JWT_REFRESH=$(openssl rand -hex 32)

# 2. Mettre à jour .env.prod
nano .env.prod

# 3. Redéployer
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Note: Les utilisateurs devront se reconnecter après la rotation des JWT
```

---

## 5. Configuration du domaine

### DNS (chez votre registrar)

Créer les enregistrements DNS suivants :

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | app.votredomaine.com | IP_DU_SERVEUR | 3600 |
| A | api.votredomaine.com | IP_DU_SERVEUR | 3600 |
| A | *.app.votredomaine.com | IP_DU_SERVEUR | 3600 |

Le wildcard `*.app` est nécessaire pour le multi-tenancy par sous-domaine (hotel-x.app.votredomaine.com).

### Dans CyberPanel

1. **Websites → Create Website**
   - Domain : `app.votredomaine.com`
   - PHP : Non (nous utilisons Node.js via Docker)
2. Répéter pour `api.votredomaine.com`

---

## 6. Déploiement Docker

### Première installation

```bash
# Se connecter au serveur
ssh user@votre-serveur

# Cloner le repo
cd /home/teranga
git clone https://github.com/votre-org/hotel-pms.git
cd hotel-pms

# Copier et configurer les secrets (voir section 4)
cp .env.prod.example .env.prod
nano .env.prod

# Créer la première migration Prisma (une seule fois)
cd backend
npx prisma migrate dev --name init
cd ..

# Build et démarrer
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Vérifier que tout tourne
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend --tail=20

# Appliquer le seed (première fois uniquement)
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

### Mises à jour

```bash
cd /home/teranga/hotel-pms
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

---

## 7. Configuration OpenLiteSpeed (reverse proxy)

CyberPanel utilise OpenLiteSpeed. Configurer le reverse proxy pour acheminer le trafic vers les conteneurs Docker.

### Via CyberPanel WebAdmin (port 7080)

1. Accéder à `https://VOTRE_IP:7080` (OpenLiteSpeed WebAdmin)
2. **Virtual Hosts → app.votredomaine.com → Context**
3. Ajouter un **Proxy Context** :

Pour le **frontend** (app.votredomaine.com) :
```
Type: Proxy
URI: /
Web Server: [Proxy] http://127.0.0.1:3001
Header Operations:
  X-Forwarded-For %{REMOTE_ADDR}e
  X-Forwarded-Proto https
  X-Real-IP %{REMOTE_ADDR}e
```

Pour l'**API** (app.votredomaine.com/api) :
```
Type: Proxy
URI: /api/
Web Server: [Proxy] http://127.0.0.1:4000
Header Operations:
  X-Forwarded-For %{REMOTE_ADDR}e
  X-Forwarded-Proto https
  X-Real-IP %{REMOTE_ADDR}e
```

Pour les **webhooks** (important — pas de rate limit) :
```
Type: Proxy
URI: /api/webhooks/
Web Server: [Proxy] http://127.0.0.1:4000
```

Pour les **uploads** :
```
Type: Proxy
URI: /uploads/
Web Server: [Proxy] http://127.0.0.1:4000
```

### Alternative : fichier .htaccess (si OLS le supporte)

```apache
RewriteEngine On

# API requests → backend
RewriteRule ^api/(.*)$ http://127.0.0.1:4000/api/$1 [P,L]

# Uploads → backend
RewriteRule ^uploads/(.*)$ http://127.0.0.1:4000/uploads/$1 [P,L]

# Health check
RewriteRule ^health$ http://127.0.0.1:4000/health [P,L]

# Everything else → frontend
RewriteRule ^(.*)$ http://127.0.0.1:3001/$1 [P,L]
```

### Restart OpenLiteSpeed après les changements

```bash
sudo systemctl restart lsws
# ou depuis CyberPanel : Dashboard → Restart LiteSpeed
```

---

## 8. SSL/TLS avec Let's Encrypt

### Via CyberPanel (recommandé)

1. **Websites → List Websites → app.votredomaine.com → SSL**
2. Cliquer **Issue SSL** (Let's Encrypt)
3. CyberPanel gère le renouvellement automatique tous les 60 jours

### Forcer HTTPS

Dans CyberPanel :
- **Websites → app.votredomaine.com → Rewrite Rules**
- Ajouter la règle de redirection HTTP → HTTPS (CyberPanel le fait souvent automatiquement)

### Vérification

```bash
curl -I https://app.votredomaine.com
# Doit retourner HTTP/2 200 avec des headers de sécurité
```

---

## 9. Base de données en production

### Migrations (pas db push !)

En production, **toujours** utiliser `prisma migrate deploy` :

```bash
# Créer une migration en dev
npx prisma migrate dev --name description_du_changement

# Appliquer en production
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

**JAMAIS** `prisma db push --accept-data-loss` en production.

### Accès direct à la base

```bash
# Shell PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U teranga_user -d teranga_prod

# Exemples de requêtes utiles
SELECT name, slug, plan, is_active FROM tenants;
SELECT status, count(*) FROM subscriptions GROUP BY status;
```

### Optimisations PostgreSQL

Ajouter dans docker-compose.prod.yml sous postgres :

```yaml
command: >
  postgres
    -c shared_buffers=256MB
    -c effective_cache_size=1GB
    -c work_mem=16MB
    -c maintenance_work_mem=128MB
    -c max_connections=100
```

---

## 10. FedaPay en production

### Passer de sandbox à live

1. Connectez-vous sur [dashboard.fedapay.com](https://dashboard.fedapay.com)
2. Passez en mode **Live**
3. Récupérez votre **clé secrète live** (`sk_live_...`)
4. Configurez le **webhook** :
   - URL : `https://app.votredomaine.com/api/webhooks/fedapay`
   - Événements : `transaction.approved`, `transaction.declined`
5. Notez le **webhook secret** pour la vérification des signatures

### Mettre à jour .env.prod

```env
FEDAPAY_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxx
FEDAPAY_SANDBOX=false
FEDAPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxx
```

### Cycle de vie des abonnements

```
Inscription → Essai gratuit (14j) → Paiement FedaPay → ACTIVE
                                                          │
                            Renouvellement (J-7 rappel) ◄─┘
                                         │
                            Non payé → PAST_DUE (7j de grâce)
                                         │
                            Toujours pas payé → SUSPENDED (bloqué)
                                         │
                            30j sans paiement → CANCELLED
```

Le tenant peut **réactiver** son abonnement à tout moment en payant.

### Configuration per-tenant

Chaque hôtel peut configurer sa propre clé FedaPay pour recevoir les paiements directement :

1. Dashboard → Paramètres → FedaPay
2. Entrer la clé secrète du tenant
3. Les paiements des clients vont directement sur le compte FedaPay du tenant

---

## 11. Sauvegardes

### Backup quotidien automatique

```bash
# Ajouter au crontab du serveur
crontab -e

# Backup quotidien à 2h du matin
0 2 * * * cd /home/teranga/hotel-pms && docker compose -f docker-compose.prod.yml --profile backup run --rm backup

# Vérifier les backups
ls -la /var/lib/docker/volumes/hotel-pms_prod_backups/_data/
```

### Backup off-site (recommandé)

```bash
# Installer rclone pour synchro cloud
curl https://rclone.org/install.sh | sudo bash
rclone config  # Configurer Google Drive, S3, etc.

# Ajouter au crontab (après le backup local)
30 2 * * * rclone sync /var/lib/docker/volumes/hotel-pms_prod_backups/_data/ gdrive:teranga-backups/
```

### Restauration

```bash
# Trouver le backup à restaurer
ls /var/lib/docker/volumes/hotel-pms_prod_backups/_data/

# Restaurer
gunzip -c /backups/teranga_20260328_020000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U teranga_user -d teranga_prod
```

---

## 12. Monitoring et alertes

### UptimeRobot (gratuit, recommandé)

1. Créer un compte sur [uptimerobot.com](https://uptimerobot.com)
2. Ajouter un moniteur :
   - Type : HTTP(s)
   - URL : `https://app.votredomaine.com/health`
   - Intervalle : 5 minutes
3. Configurer les alertes par email/SMS/Telegram

### Monitoring des logs

```bash
# Voir les logs en temps réel
docker compose -f docker-compose.prod.yml logs -f backend

# Logs des 100 dernières lignes
docker compose -f docker-compose.prod.yml logs backend --tail=100

# Rechercher les erreurs
docker compose -f docker-compose.prod.yml logs backend 2>&1 | grep -i error
```

### Logrotate (éviter que les logs remplissent le disque)

```bash
sudo tee /etc/logrotate.d/docker-teranga << 'EOF'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
    maxsize 100M
}
EOF
```

### Monitoring des ressources

```bash
# Utilisation CPU/RAM des conteneurs
docker stats --no-stream

# Espace disque
df -h

# Ajouter au crontab : alerte si disque > 80%
0 */6 * * * [ $(df /  --output=pcent | tail -1 | tr -d ' %') -gt 80 ] && echo "DISQUE PLEIN" | mail -s "Alerte Teranga" admin@votredomaine.com
```

---

## 13. CI/CD avec GitHub Actions

### Configuration

Le workflow est déjà configuré dans `.github/workflows/deploy.yml`. Il :

1. **Sur chaque PR** : compile le backend (TypeScript), build le frontend
2. **Sur push sur main** : compile + déploie automatiquement sur le serveur

### Secrets GitHub à configurer

Dans **GitHub → Settings → Secrets and variables → Actions** :

| Secret | Valeur |
|--------|--------|
| `DEPLOY_HOST` | IP de votre serveur |
| `DEPLOY_USER` | Utilisateur SSH (ex: `teranga`) |
| `DEPLOY_SSH_KEY` | Clé privée SSH |

### Configurer l'accès SSH

```bash
# Sur votre machine locale
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/teranga_deploy

# Sur le serveur
cat ~/.ssh/teranga_deploy.pub >> ~/.ssh/authorized_keys

# Copier la clé privée dans GitHub Secrets (DEPLOY_SSH_KEY)
cat ~/.ssh/teranga_deploy
```

### Pipeline

```
Push sur main → GitHub Actions :
  ├── Backend : npm ci → prisma generate → tsc --noEmit → npm test
  ├── Frontend : npm ci → npm run build
  └── Deploy (si tests OK) :
       └── SSH → git pull → docker compose up --build → prisma migrate deploy
```

---

## 14. Sécurité

### Firewall (UFW)

```bash
# Configurer le firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Autoriser SSH, HTTP, HTTPS, CyberPanel
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (redirection vers HTTPS)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8090/tcp  # CyberPanel
sudo ufw allow 7080/tcp  # OpenLiteSpeed WebAdmin

# NE PAS exposer les ports internes
# 4000 (backend), 3001 (frontend), 5432 (postgres), 6379 (redis) restent en 127.0.0.1

sudo ufw enable
sudo ufw status
```

### Fail2Ban (protection brute force)

```bash
sudo apt install -y fail2ban

sudo tee /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 22
maxretry = 5
bantime = 3600
findtime = 600
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Mises à jour automatiques de sécurité

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Headers de sécurité

Déjà configurés dans le backend via Helmet.js :
- `Content-Security-Policy`
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

---

## 15. Maintenance

### Mise à jour du système

```bash
# Mensuel
sudo apt update && sudo apt upgrade -y

# Mise à jour Docker
sudo apt install --only-upgrade docker-ce docker-ce-cli containerd.io

# Mise à jour des images de base
docker compose -f docker-compose.prod.yml pull postgres redis
docker compose -f docker-compose.prod.yml up -d
```

### Nettoyage Docker (mensuel)

```bash
# Supprimer les images/volumes non utilisés
docker system prune -af --volumes
```

### Vérifier l'état des abonnements

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U teranga_user -d teranga_prod -c \
  "SELECT t.name, s.status, s.current_period_end, s.grace_period_ends_at
   FROM subscriptions s JOIN tenants t ON s.tenant_id = t.id
   ORDER BY s.current_period_end;"
```

---

## 16. Checklist avant lancement

### Secrets et sécurité
- [ ] `.env.prod` créé avec des vrais secrets générés
- [ ] `.env.prod` n'est PAS dans git (vérifié avec `git status`)
- [ ] Firewall UFW activé (ports 22, 80, 443, 8090, 7080 uniquement)
- [ ] Fail2Ban installé et actif
- [ ] SSL/TLS configuré et fonctionnel

### Infrastructure
- [ ] Docker et Docker Compose installés
- [ ] CyberPanel installé et accessible
- [ ] Domaine configuré avec DNS (A records)
- [ ] Reverse proxy OpenLiteSpeed configuré
- [ ] Health check accessible : `https://app.votredomaine.com/health`

### Base de données
- [ ] Migrations appliquées (`prisma migrate deploy`)
- [ ] Seed exécuté (plans d'abonnement créés)
- [ ] Backup quotidien configuré dans crontab
- [ ] Backup off-site configuré (rclone)

### FedaPay
- [ ] Compte FedaPay en mode **Live**
- [ ] Clé secrète live dans `.env.prod`
- [ ] `FEDAPAY_SANDBOX=false` dans `.env.prod`
- [ ] Webhook configuré sur FedaPay dashboard : `https://app.votredomaine.com/api/webhooks/fedapay`
- [ ] Test de transaction réussi

### Application
- [ ] Frontend accessible et fonctionnel
- [ ] Inscription d'un tenant de test réussie
- [ ] Essai gratuit fonctionne (tenant actif immédiatement)
- [ ] Paiement FedaPay fonctionne (redirection + webhook)
- [ ] QR codes fonctionnels
- [ ] App mobile connectée à l'URL de production

### CI/CD
- [ ] Secrets GitHub configurés (DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY)
- [ ] Pipeline testé avec un push de test
- [ ] Rollback documenté et testé

### Monitoring
- [ ] UptimeRobot configuré
- [ ] Logrotate configuré
- [ ] Alertes email/SMS configurées

### Documentation
- [ ] Credentials du premier tenant notés en lieu sûr
- [ ] URL de la console CyberPanel notée
- [ ] Procédure de restauration de backup testée

---

## Commandes rapides (mémo)

```bash
# Démarrer
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Arrêter
docker compose -f docker-compose.prod.yml down

# Logs en temps réel
docker compose -f docker-compose.prod.yml logs -f backend

# État des conteneurs
docker compose -f docker-compose.prod.yml ps

# Redéployer après un git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Backup manuel
docker compose -f docker-compose.prod.yml --profile backup run --rm backup

# Shell PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres psql -U teranga_user -d teranga_prod

# Shell backend (debug)
docker compose -f docker-compose.prod.yml exec backend sh
```
