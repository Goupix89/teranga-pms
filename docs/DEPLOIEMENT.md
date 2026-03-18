# Teranga PMS — Guide de deploiement

## Sommaire

1. [Architecture](#1-architecture)
2. [Prerequis serveur](#2-prerequis-serveur)
3. [Environnement TEST](#3-environnement-test)
4. [Environnement PRODUCTION](#4-environnement-production)
5. [Configuration CyberPanel / OpenLiteSpeed](#5-configuration-cyberpanel--openlitespeed)
6. [Operations courantes](#6-operations-courantes)
7. [Monitoring et alertes](#7-monitoring-et-alertes)
8. [Securite](#8-securite)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Architecture

```
                    Internet
                       |
              [ CyberPanel / OLS ]
              SSL + Reverse Proxy
                  :443 (HTTPS)
                 /            \
          /api/*               /*
             |                  |
     [ Backend API ]    [ Frontend Next.js ]
      :4000 (local)       :3001 (local)
         |       \
  [ PostgreSQL ]  [ Redis ]
   :5432 (local)   :6379 (local)
```

**Stack technique :**

| Composant | Technologie | Port interne |
|-----------|-------------|-------------|
| Frontend | Next.js 14 (standalone) | 3000 |
| Backend API | Express.js + TypeScript | 4000 |
| Base de donnees | PostgreSQL 15 | 5432 |
| Cache / Sessions | Redis 7 | 6379 |
| Reverse proxy | OpenLiteSpeed (CyberPanel) | 443 |

Tous les ports sont bindes sur `127.0.0.1` — seul OLS expose le 443 au public.

---

## 2. Prerequis serveur

### Specifications materielles

| Ressource | TEST | PROD (5 etablissements) | PROD (20 etablissements) |
|-----------|------|------------------------|--------------------------|
| CPU | 2 vCPU | 4 vCPU | 8 vCPU |
| RAM | 2 Go | 4 Go | 8 Go |
| Stockage | 20 Go SSD | 60 Go NVMe | 150 Go NVMe |
| Bande passante | 500 Go/mois | 1 To/mois | Illimite |
| OS | Ubuntu 22.04 | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

**Estimation consommation RAM (prod 5 etablissements) :**

```
CyberPanel + OLS    ~800 Mo
PostgreSQL           ~512 Mo
Redis                ~128 Mo
Backend Node.js      ~256 Mo
Frontend Next.js     ~256 Mo
Systeme              ~500 Mo
─────────────────────────────
Total                ~2.5 Go (pic: ~3.5 Go)
```

### Installation des prerequis

```bash
# Se connecter en root
ssh root@<IP_SERVEUR>

# Mettre a jour le systeme
apt update && apt upgrade -y

# Installer Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Installer Docker Compose (inclus dans Docker >= 24)
docker compose version

# Installer Git
apt install -y git

# Creer le repertoire du projet
mkdir -p /opt/teranga
```

---

## 3. Environnement TEST

**URL :** `https://demo-teranga.jdidit.cloud`
**Objectif :** Tests fonctionnels, validation avant mise en production.

### 3.1 Deployer le code

```bash
cd /opt/teranga

# Cloner le repo
git clone <URL_REPO> .

# OU depuis votre machine locale :
# scp -r /home/user/hotel-pms/* root@<IP>:/opt/teranga/
```

### 3.2 Creer le fichier de configuration

```bash
cat > /opt/teranga/.env.test << 'EOF'
# =============================================
# Teranga PMS — Configuration TEST
# =============================================

# --- Base de donnees ---
DB_PASSWORD=TerangaTest_2026!xR9m

# --- Redis ---
REDIS_PASSWORD=RedisTest_2026!pK4n

# --- JWT (generer avec: openssl rand -hex 32) ---
JWT_ACCESS_SECRET=REMPLACER_PAR_openssl_rand_hex_32
JWT_REFRESH_SECRET=REMPLACER_PAR_openssl_rand_hex_32

# --- URLs ---
PUBLIC_URL=https://demo-teranga.jdidit.cloud
ALLOWED_ORIGINS=https://demo-teranga.jdidit.cloud
EOF

chmod 600 /opt/teranga/.env.test
```

**Generer les secrets JWT :**
```bash
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
# Copier les valeurs dans .env.test
```

### 3.3 Lancer les conteneurs

```bash
cd /opt/teranga

# Build et demarrer
docker compose -f docker-compose.test.yml --env-file .env.test up -d --build

# Verifier le statut
docker compose -f docker-compose.test.yml ps

# Suivre les logs (Ctrl+C pour quitter)
docker compose -f docker-compose.test.yml logs -f
```

### 3.4 Initialiser la base de donnees

```bash
# Charger les donnees de demonstration
docker compose -f docker-compose.test.yml exec backend \
  npx tsx prisma/seed.ts
```

**Comptes de test disponibles apres le seed :**

| Role | Email | Mot de passe |
|------|-------|-------------|
| Super Admin | superadmin@hoteldemo.com | Admin123! |
| Proprietaire | owner@hoteldemo.com | Owner123! |
| DAF | daf@hoteldemo.com | Daf12345! |
| Manager | manager@hoteldemo.com | Manager123! |
| Serveur | serveur@hoteldemo.com | Serveur123! |
| Point de vente | pos@hoteldemo.com | Pos12345! |
| Cuisinier | cuisinier@hoteldemo.com | Cook1234! |
| Menage | menage@hoteldemo.com | Menage123! |

### 3.5 Verifier le deploiement

```bash
# Test sante API
curl -s https://demo-teranga.jdidit.cloud/api/health

# Test login
curl -s https://demo-teranga.jdidit.cloud/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@hoteldemo.com","password":"Admin123!"}' \
  | python3 -m json.tool | head -5

# Test page frontend
curl -sI https://demo-teranga.jdidit.cloud | head -5
```

### 3.6 Mettre a jour l'environnement de test

```bash
cd /opt/teranga

# Recuperer les dernieres modifications
git pull origin main

# Reconstruire et redemarrer
docker compose -f docker-compose.test.yml --env-file .env.test up -d --build

# Appliquer les migrations de schema si necessaire
docker compose -f docker-compose.test.yml exec backend \
  npx prisma db push --skip-generate --accept-data-loss
```

### 3.7 Reinitialiser l'environnement de test

```bash
# Tout arreter et supprimer les volumes (DESTRUCTIF)
docker compose -f docker-compose.test.yml --env-file .env.test down -v

# Relancer
docker compose -f docker-compose.test.yml --env-file .env.test up -d --build

# Re-seeder
docker compose -f docker-compose.test.yml exec backend \
  npx tsx prisma/seed.ts
```

---

## 4. Environnement PRODUCTION

**URL :** `https://teranga.jdidit.cloud` (ou votre domaine de production)
**Objectif :** Exploitation reelle, donnees clients.

### 4.1 Creer le fichier de configuration

```bash
cat > /opt/teranga/.env.prod << 'EOF'
# =============================================
# Teranga PMS — Configuration PRODUCTION
# =============================================

# --- Base de donnees ---
DB_PASSWORD=REMPLACER_PAR_MOT_DE_PASSE_FORT

# --- Redis ---
REDIS_PASSWORD=REMPLACER_PAR_MOT_DE_PASSE_FORT

# --- JWT (OBLIGATOIRE : generer avec openssl rand -hex 32) ---
JWT_ACCESS_SECRET=REMPLACER
JWT_REFRESH_SECRET=REMPLACER

# --- URLs ---
PUBLIC_URL=https://teranga.jdidit.cloud
ALLOWED_ORIGINS=https://teranga.jdidit.cloud

# --- Stripe (paiements en ligne) ---
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
EOF

chmod 600 /opt/teranga/.env.prod
```

**Generer TOUS les secrets :**
```bash
echo "DB_PASSWORD=$(openssl rand -base64 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
```

### 4.2 Lancer les conteneurs

```bash
cd /opt/teranga

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Verifier
docker compose -f docker-compose.prod.yml ps
```

### 4.3 Premier deploiement uniquement

```bash
# La base est creee automatiquement par Prisma au demarrage.
# NE PAS executer le seed en production.
# Le premier utilisateur se cree via l'inscription Stripe ou manuellement :

docker compose -f docker-compose.prod.yml exec backend \
  node -e "
    const bcrypt = require('bcryptjs');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    (async () => {
      const hash = await bcrypt.hash('VotreMotDePasse!', 12);
      const tenant = await prisma.tenant.create({
        data: { name: 'Mon Hotel', slug: 'mon-hotel', plan: 'premium' }
      });
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: 'admin@monhotel.com',
          passwordHash: hash,
          firstName: 'Admin',
          lastName: 'Principal',
          role: 'SUPERADMIN',
          status: 'ACTIVE',
        }
      });
      console.log('Admin cree : admin@monhotel.com');
      await prisma.\$disconnect();
    })();
  "
```

### 4.4 Mettre a jour la production

```bash
cd /opt/teranga

# 1. Sauvegarder la base AVANT toute mise a jour
docker compose -f docker-compose.prod.yml --profile backup run --rm backup

# 2. Recuperer le code
git pull origin main

# 3. Reconstruire (zero downtime: les anciens conteneurs tournent jusqu'au remplacement)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 4. Verifier
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=50 backend
```

### 4.5 Sauvegardes automatiques (cron)

```bash
# Ajouter un cron pour backup quotidien a 3h du matin
crontab -e
```

Ajouter la ligne :
```
0 3 * * * cd /opt/teranga && docker compose -f docker-compose.prod.yml --profile backup run --rm backup >> /var/log/teranga-backup.log 2>&1
```

Verifier les backups :
```bash
docker volume inspect teranga-prod-prod_backups
# ou
docker run --rm -v teranga-prod-prod_backups:/backups alpine ls -lah /backups/
```

---

## 5. Configuration CyberPanel / OpenLiteSpeed

### 5.1 Creer le site web

1. **CyberPanel** > **Websites** > **Create Website**
   - Domain Name : `demo-teranga.jdidit.cloud`
   - Email : votre email
   - PHP : ne pas activer (pas necessaire)

2. **SSL** > **Manage SSL** > **Issue SSL** pour le domaine

### 5.2 Configurer le reverse proxy

Aller dans **CyberPanel** > **Websites** > **demo-teranga.jdidit.cloud** > **Rewrite Rules**

OU editer directement le fichier vHost :
```bash
nano /usr/local/lsws/conf/vhosts/demo-teranga.jdidit.cloud/vhconf.conf
```

**Methode A — Via les contextes CyberPanel (recommande) :**

Aller dans **Websites** > **demo-teranga.jdidit.cloud** > **vHost Conf**

Coller dans le champ de configuration :

```apacheconf
# ─────────────────────────────────────────────
# Reverse Proxy — API Backend
# ─────────────────────────────────────────────

extprocessor teranga_api {
  type                    proxy
  address                 http://127.0.0.1:4000
  maxConns                200
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

extprocessor teranga_web {
  type                    proxy
  address                 http://127.0.0.1:3001
  maxConns                200
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

# API + Uploads → Backend
context /api/ {
  type                    proxy
  handler                 teranga_api
  addDefaultCharset       off
}

context /uploads/ {
  type                    proxy
  handler                 teranga_api
  addDefaultCharset       off
}

# Tout le reste → Frontend
context / {
  type                    proxy
  handler                 teranga_web
  addDefaultCharset       off
}
```

**Methode B — Si OLS n'accepte pas les blocs extprocessor :**

Configurer via l'interface **Web Admin OLS** (`https://<IP>:7080`) :

1. **Virtual Hosts** > `demo-teranga.jdidit.cloud` > **External App**
   - Ajouter `teranga_api` : Type = `Web Server`, Address = `127.0.0.1:4000`
   - Ajouter `teranga_web` : Type = `Web Server`, Address = `127.0.0.1:3001`

2. **Virtual Hosts** > `demo-teranga.jdidit.cloud` > **Context**
   - Ajouter contexte `/api/` → Type Proxy → Web Server = `teranga_api`
   - Ajouter contexte `/uploads/` → Type Proxy → Web Server = `teranga_api`
   - Ajouter contexte `/` → Type Proxy → Web Server = `teranga_web`

3. **Graceful Restart** dans l'interface OLS

### 5.3 Configurer les headers de securite

Dans le vHost, ajouter :

```apacheconf
context / {
  type                    proxy
  handler                 teranga_web
  addDefaultCharset       off
  extraHeaders            <<<END_HEADERS
    X-Frame-Options SAMEORIGIN
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
    Permissions-Policy camera=(), microphone=(), geolocation=()
  END_HEADERS
}
```

### 5.4 Configurer les WebSockets (si necessaire plus tard)

```apacheconf
context /ws/ {
  type                    proxy
  handler                 teranga_api
  addDefaultCharset       off
  # OLS gere nativement le upgrade WebSocket
}
```

### 5.5 Redemarrer OLS

```bash
# Via CyberPanel
systemctl restart lsws

# Ou via l'interface web OLS
# Actions > Graceful Restart
```

---

## 6. Operations courantes

### Commandes par environnement

Chaque commande utilise le fichier compose et le .env correspondant.
Pour simplifier, creer des alias :

```bash
# Ajouter a ~/.bashrc
alias teranga-test="docker compose -f /opt/teranga/docker-compose.test.yml --env-file /opt/teranga/.env.test"
alias teranga-prod="docker compose -f /opt/teranga/docker-compose.prod.yml --env-file /opt/teranga/.env.prod"
source ~/.bashrc
```

Ensuite :
```bash
teranga-test ps
teranga-test logs -f backend
teranga-prod ps
teranga-prod logs --tail=100 backend
```

### Voir les logs

```bash
# Tous les services
teranga-test logs -f

# Un service specifique
teranga-test logs -f backend
teranga-test logs -f frontend
teranga-test logs -f postgres

# Les 200 dernieres lignes
teranga-prod logs --tail=200 backend
```

### Redemarrer un service

```bash
teranga-test restart backend
teranga-prod restart frontend
```

### Acceder a la base de donnees

```bash
# Console psql
teranga-test exec postgres psql -U teranga_user -d teranga_test
teranga-prod exec postgres psql -U teranga_user -d teranga_prod

# Exemples de requetes utiles
# Nombre d'utilisateurs par etablissement :
# SELECT e.name, COUNT(m.*) FROM "Establishment" e
#   LEFT JOIN "EstablishmentMember" m ON m."establishmentId" = e.id
#   GROUP BY e.name;
```

### Acceder a Redis

```bash
teranga-test exec redis redis-cli -a $REDIS_PASSWORD
# > KEYS *
# > DBSIZE
```

### Backup manuel de la base

```bash
# Exporter
teranga-prod exec postgres \
  pg_dump -U teranga_user teranga_prod | gzip > ~/backup_teranga_$(date +%Y%m%d).sql.gz

# Restaurer
gunzip -c ~/backup_teranga_20260318.sql.gz | \
  teranga-prod exec -T postgres psql -U teranga_user teranga_prod
```

### Nettoyer l'espace disque Docker

```bash
# Voir l'espace utilise
docker system df

# Supprimer les images inutilisees (ne supprime PAS les volumes)
docker system prune -f

# Supprimer aussi les images non utilisees
docker image prune -a -f
```

---

## 7. Monitoring et alertes

### Verifier la sante des services

```bash
# Script de verification rapide
cat > /opt/teranga/healthcheck.sh << 'SCRIPT'
#!/bin/bash
ENV=${1:-test}
URL=$(grep PUBLIC_URL /opt/teranga/.env.$ENV | cut -d= -f2)

echo "=== Teranga PMS [$ENV] — Health Check ==="
echo ""

# API
API=$(curl -s -o /dev/null -w "%{http_code}" "$URL/api/health" --max-time 5)
if [ "$API" = "200" ]; then
  echo "[OK] API Backend : $URL/api/health"
else
  echo "[KO] API Backend : HTTP $API"
fi

# Frontend
WEB=$(curl -s -o /dev/null -w "%{http_code}" "$URL" --max-time 5)
if [ "$WEB" = "200" ]; then
  echo "[OK] Frontend    : $URL"
else
  echo "[KO] Frontend    : HTTP $WEB"
fi

# Containers
echo ""
echo "--- Conteneurs ---"
docker compose -f /opt/teranga/docker-compose.$ENV.yml ps --format "table {{.Name}}\t{{.Status}}"
echo ""

# Disk
echo "--- Espace disque ---"
df -h / | tail -1
echo ""

# Memory
echo "--- Memoire ---"
free -h | head -2
SCRIPT

chmod +x /opt/teranga/healthcheck.sh
```

Utilisation :
```bash
/opt/teranga/healthcheck.sh test
/opt/teranga/healthcheck.sh prod
```

### Monitoring automatique (cron)

```bash
crontab -e
```

```
# Health check toutes les 5 minutes, alerte si KO
*/5 * * * * /opt/teranga/healthcheck.sh prod 2>&1 | grep -q "\[KO\]" && echo "ALERTE Teranga PROD" | mail -s "Teranga DOWN" votre@email.com
```

---

## 8. Securite

### Checklist avant mise en production

- [ ] Tous les mots de passe dans `.env.prod` sont uniques et forts (>= 24 caracteres)
- [ ] Les secrets JWT sont generes avec `openssl rand -hex 32`
- [ ] Le fichier `.env.prod` a les permissions `600` (`chmod 600 .env.prod`)
- [ ] Les ports 4000, 5432, 6379 ne sont PAS exposes au public (bindes sur 127.0.0.1)
- [ ] Le SSL est actif et force (redirection HTTP → HTTPS dans CyberPanel)
- [ ] Le seed de demo n'a PAS ete execute en production
- [ ] Le firewall autorise uniquement les ports 22, 80, 443
- [ ] Les backups automatiques sont configures et testes

### Configurer le firewall

```bash
# UFW (Ubuntu)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect vers HTTPS)
ufw allow 443/tcp   # HTTPS
ufw allow 8090/tcp  # CyberPanel
ufw enable

# Verifier
ufw status
```

### Securiser SSH

```bash
# Desactiver le login root par mot de passe (utiliser des cles SSH)
# /etc/ssh/sshd_config :
# PermitRootLogin prohibit-password
# PasswordAuthentication no

systemctl restart sshd
```

---

## 9. Troubleshooting

### Le frontend affiche une page blanche

```bash
# Verifier que NEXT_PUBLIC_API_URL est correct
teranga-test logs frontend | head -20

# L'URL doit etre l'URL publique, PAS localhost
# NEXT_PUBLIC_API_URL=https://demo-teranga.jdidit.cloud  (CORRECT)
# NEXT_PUBLIC_API_URL=http://localhost:4000              (INCORRECT en prod)
```

### Erreur CORS sur le navigateur

```bash
# Verifier ALLOWED_ORIGINS dans le backend
teranga-test exec backend env | grep ALLOWED

# Doit correspondre EXACTEMENT a l'URL du navigateur
# ALLOWED_ORIGINS=https://demo-teranga.jdidit.cloud  (CORRECT)
# ALLOWED_ORIGINS=https://demo-teranga.jdidit.cloud/ (INCORRECT — pas de slash final)
```

### Erreur 502 Bad Gateway

```bash
# Le conteneur backend n'est pas pret
teranga-test logs backend --tail=50

# Causes frequentes :
# 1. PostgreSQL pas encore healthy → le backend attend
# 2. Prisma db push en cours → attendre 10-20 secondes
# 3. Erreur de config → lire les logs
```

### La base de donnees est vide apres redemarrage

```bash
# Les volumes Docker persistent les donnees.
# Si vous avez utilise `down -v`, les volumes ont ete supprimes.
# Utiliser `down` SANS le flag -v pour conserver les donnees.

# SAFE :
teranga-test down
teranga-test up -d

# DESTRUCTIF (supprime les donnees) :
teranga-test down -v
```

### Espace disque insuffisant

```bash
# Voir ce qui prend de la place
docker system df

# Nettoyer les images de build intermediaires
docker builder prune -f

# Nettoyer les images non utilisees
docker image prune -a -f

# ATTENTION : ne PAS supprimer les volumes en production
```

### Le conteneur redémarre en boucle

```bash
# Voir les logs du conteneur qui crash
teranga-test logs --tail=100 backend

# Causes frequentes :
# - Variable d'environnement manquante (JWT_ACCESS_SECRET, DATABASE_URL)
# - Base de donnees pas encore prete (healthcheck pas encore OK)
# - Erreur de syntaxe TypeScript (verifier le build)
```

### Tester la connexion a la base depuis le backend

```bash
teranga-test exec backend node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.\$queryRaw\`SELECT 1 as ok\`.then(r => {
    console.log('DB OK:', r);
    process.exit(0);
  }).catch(e => {
    console.error('DB KO:', e.message);
    process.exit(1);
  });
"
```

---

## Recapitulatif des fichiers

```
/opt/teranga/
  docker-compose.yml          # Dev local (existant)
  docker-compose.test.yml     # Environnement TEST
  docker-compose.prod.yml     # Environnement PRODUCTION
  .env.test                   # Config TEST (ne pas committer)
  .env.prod                   # Config PROD (ne pas committer)
  healthcheck.sh              # Script de verification
  backend/
    Dockerfile                # Dev
    Dockerfile.prod           # Test + Prod
  frontend/
    Dockerfile                # Dev
    Dockerfile.prod           # Test + Prod
```

## Differences entre les environnements

| Parametre | DEV (local) | TEST | PROD |
|-----------|------------|------|------|
| `NODE_ENV` | development | production | production |
| Hot reload | oui | non | non |
| Seed data | oui | oui | non |
| SSL | non | oui (Let's Encrypt) | oui (Let's Encrypt) |
| Rate limit | 100/min | 200/min | 100/min |
| Token access | 15 min | 30 min | 15 min |
| Token refresh | 7 jours | 7 jours | 30 jours |
| Backups auto | non | non | oui (quotidien) |
| `restart` | unless-stopped | unless-stopped | always |
| Volumes sources | montes (live edit) | non | non |
| Limites memoire | aucune | aucune | oui |
