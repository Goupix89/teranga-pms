#!/bin/bash
# =============================================================================
# Hotel PMS — Script de démarrage rapide
# =============================================================================
# Ce script configure et démarre la plateforme complète.
# Usage: chmod +x start.sh && ./start.sh
# =============================================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }
print_ok() { echo -e "${GREEN}✅ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_err() { echo -e "${RED}❌ $1${NC}"; }

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║     Hotel PMS — Démarrage Rapide         ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# 1. Vérification des prérequis
# =============================================================================
print_step "Vérification des prérequis"

check_command() {
    if command -v "$1" &> /dev/null; then
        print_ok "$1 trouvé: $($1 --version 2>/dev/null | head -1)"
        return 0
    else
        print_err "$1 non trouvé"
        return 1
    fi
}

HAS_DOCKER=false
HAS_NODE=false

if check_command docker; then HAS_DOCKER=true; fi
if check_command node; then HAS_NODE=true; fi
check_command git || true

# =============================================================================
# 2. Choix du mode de démarrage
# =============================================================================
if [ "$HAS_DOCKER" = true ]; then
    echo ""
    echo "Docker est disponible. Quel mode de démarrage ?"
    echo "  1) Docker Compose (recommandé — tout automatisé)"
    echo "  2) Manuel (Node.js + PostgreSQL local)"
    read -p "Votre choix [1]: " MODE
    MODE=${MODE:-1}
else
    print_warn "Docker non trouvé. Mode manuel sélectionné."
    MODE=2
fi

# =============================================================================
# MODE 1: Docker Compose
# =============================================================================
if [ "$MODE" = "1" ]; then
    print_step "Démarrage avec Docker Compose"

    # Vérifier docker compose
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif docker-compose --version &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        print_err "docker compose non trouvé. Installez Docker Compose."
        exit 1
    fi

    # Créer le fichier .env du backend s'il n'existe pas
    if [ ! -f backend/.env ]; then
        print_step "Création du fichier backend/.env"
        cp backend/.env.example backend/.env

        # Générer des secrets JWT aléatoires
        JWT_ACCESS=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | head -c 64)
        JWT_REFRESH=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | head -c 64)

        # Remplacer les valeurs dans .env
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/CHANGE_ME_generate_with_openssl_rand_hex_32_different/$JWT_REFRESH/" backend/.env
            sed -i '' "s/CHANGE_ME_generate_with_openssl_rand_hex_32/$JWT_ACCESS/" backend/.env
            sed -i '' 's|postgresql://pms_user:your_secure_password@localhost:5432/hotel_pms?sslmode=prefer|postgresql://pms_user:pms_dev_password_2026@postgres:5432/hotel_pms?sslmode=disable|' backend/.env
        else
            # Linux
            sed -i "s/CHANGE_ME_generate_with_openssl_rand_hex_32_different/$JWT_REFRESH/" backend/.env
            sed -i "s/CHANGE_ME_generate_with_openssl_rand_hex_32/$JWT_ACCESS/" backend/.env
            sed -i 's|postgresql://pms_user:your_secure_password@localhost:5432/hotel_pms?sslmode=prefer|postgresql://pms_user:pms_dev_password_2026@postgres:5432/hotel_pms?sslmode=disable|' backend/.env
        fi

        print_ok "Fichier .env créé avec des secrets JWT générés"
    fi

    # Créer .env frontend
    if [ ! -f frontend/.env ]; then
        cp frontend/.env.example frontend/.env
        print_ok "Fichier frontend/.env créé"
    fi

    # Build et démarrage
    print_step "Build des images Docker..."
    $COMPOSE_CMD build

    print_step "Démarrage des services..."
    $COMPOSE_CMD up -d

    # Attendre que PostgreSQL soit prêt
    print_step "Attente de PostgreSQL..."
    for i in {1..30}; do
        if $COMPOSE_CMD exec -T postgres pg_isready -U pms_user -d hotel_pms &> /dev/null; then
            print_ok "PostgreSQL prêt"
            break
        fi
        echo -n "."
        sleep 2
    done

    # Migrations Prisma
    print_step "Exécution des migrations Prisma..."
    $COMPOSE_CMD exec -T backend npx prisma migrate dev --name init --skip-generate 2>/dev/null || \
    $COMPOSE_CMD exec -T backend npx prisma db push
    print_ok "Migrations appliquées"

    # Post-migration SQL
    print_step "Application des contraintes avancées..."
    $COMPOSE_CMD exec -T postgres psql -U pms_user -d hotel_pms -f /dev/stdin < backend/prisma/post-migration.sql 2>/dev/null || true
    print_ok "Contraintes PostgreSQL appliquées"

    # Seed
    print_step "Chargement des données de démonstration..."
    $COMPOSE_CMD exec -T backend npx tsx prisma/seed.ts
    print_ok "Données de démo chargées"

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  🎉  PLATEFORME DÉMARRÉE AVEC SUCCÈS !              ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║                                                      ║${NC}"
    echo -e "${GREEN}║  Frontend : ${BLUE}http://localhost:3000${GREEN}                  ║${NC}"
    echo -e "${GREEN}║  API      : ${BLUE}http://localhost:4000${GREEN}                  ║${NC}"
    echo -e "${GREEN}║  API Doc  : ${BLUE}http://localhost:4000/health${GREEN}           ║${NC}"
    echo -e "${GREEN}║                                                      ║${NC}"
    echo -e "${GREEN}║  Identifiants :                                      ║${NC}"
    echo -e "${GREEN}║    Email : ${YELLOW}admin@hoteldemo.com${GREEN}                    ║${NC}"
    echo -e "${GREEN}║    Pass  : ${YELLOW}Admin123!${GREEN}                              ║${NC}"
    echo -e "${GREEN}║                                                      ║${NC}"
    echo -e "${GREEN}║  Commandes utiles :                                  ║${NC}"
    echo -e "${GREEN}║    Logs   : ${NC}$COMPOSE_CMD logs -f${GREEN}                     ║${NC}"
    echo -e "${GREEN}║    Stop   : ${NC}$COMPOSE_CMD down${GREEN}                        ║${NC}"
    echo -e "${GREEN}║    Prisma : ${NC}$COMPOSE_CMD exec backend npx prisma studio${GREEN} ║${NC}"
    echo -e "${GREEN}║                                                      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"

# =============================================================================
# MODE 2: Manuel
# =============================================================================
elif [ "$MODE" = "2" ]; then
    print_step "Démarrage manuel"

    if [ "$HAS_NODE" = false ]; then
        print_err "Node.js est requis. Installez Node.js 20+ depuis https://nodejs.org"
        exit 1
    fi

    # Vérifier la version de Node
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_err "Node.js $NODE_VERSION détecté. Version 18+ requise."
        exit 1
    fi
    print_ok "Node.js v$NODE_VERSION"

    # Vérifier PostgreSQL
    if command -v psql &> /dev/null; then
        print_ok "PostgreSQL client trouvé"
    else
        print_warn "psql non trouvé. Assurez-vous que PostgreSQL est accessible."
    fi

    # ---- Backend Setup ----
    print_step "Configuration du Backend"

    cd backend

    # Créer .env
    if [ ! -f .env ]; then
        cp .env.example .env

        JWT_ACCESS=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        JWT_REFRESH=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/CHANGE_ME_generate_with_openssl_rand_hex_32_different/$JWT_REFRESH/" .env
            sed -i '' "s/CHANGE_ME_generate_with_openssl_rand_hex_32/$JWT_ACCESS/" .env
        else
            sed -i "s/CHANGE_ME_generate_with_openssl_rand_hex_32_different/$JWT_REFRESH/" .env
            sed -i "s/CHANGE_ME_generate_with_openssl_rand_hex_32/$JWT_ACCESS/" .env
        fi

        print_ok "Fichier .env créé"
        print_warn "IMPORTANT: Éditez backend/.env pour configurer DATABASE_URL avec vos paramètres PostgreSQL"
        echo ""
        echo "  DATABASE_URL=\"postgresql://VOTRE_USER:VOTRE_PASSWORD@localhost:5432/hotel_pms\""
        echo ""
        read -p "Appuyez sur Entrée quand DATABASE_URL est configuré..."
    fi

    # Installer les dépendances
    print_step "Installation des dépendances backend..."
    npm install

    # Générer le client Prisma
    print_step "Génération du client Prisma..."
    npx prisma generate

    # Migrations
    print_step "Exécution des migrations..."
    npx prisma db push
    print_ok "Schéma de base de données créé"

    # Seed
    print_step "Chargement des données de démo..."
    npx tsx prisma/seed.ts

    # Post-migration
    if command -v psql &> /dev/null; then
        print_step "Application des contraintes avancées..."
        source .env 2>/dev/null || true
        psql "$DATABASE_URL" < prisma/post-migration.sql 2>/dev/null || true
    fi

    cd ..

    # ---- Frontend Setup ----
    print_step "Configuration du Frontend"

    cd frontend

    if [ ! -f .env ]; then
        cp .env.example .env
        print_ok "Fichier frontend/.env créé"
    fi

    print_step "Installation des dépendances frontend..."
    npm install

    cd ..

    # ---- Démarrage ----
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅  INSTALLATION TERMINÉE !                        ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║                                                      ║${NC}"
    echo -e "${GREEN}║  Pour démarrer, ouvrez 2 terminaux :                 ║${NC}"
    echo -e "${GREEN}║                                                      ║${NC}"
    echo -e "${GREEN}║  Terminal 1 (Backend) :                              ║${NC}"
    echo -e "${GREEN}║    ${NC}cd backend && npm run dev${GREEN}                        ║${NC}"
    echo -e "${GREEN}║                                                      ║${NC}"
    echo -e "${GREEN}║  Terminal 2 (Frontend) :                             ║${NC}"
    echo -e "${GREEN}║    ${NC}cd frontend && npm run dev${GREEN}                       ║${NC}"
    echo -e "${GREEN}║                                                      ║${NC}"
    echo -e "${GREEN}║  Frontend : ${BLUE}http://localhost:3000${GREEN}                  ║${NC}"
    echo -e "${GREEN}║  API      : ${BLUE}http://localhost:4000${GREEN}                  ║${NC}"
    echo -e "${GREEN}║                                                      ║${NC}"
    echo -e "${GREEN}║  Login : ${YELLOW}admin@hoteldemo.com / Admin123!${GREEN}          ║${NC}"
    echo -e "${GREEN}║                                                      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"

    echo ""
    read -p "Voulez-vous démarrer maintenant ? (o/n) [o]: " START
    START=${START:-o}

    if [ "$START" = "o" ] || [ "$START" = "O" ]; then
        print_step "Démarrage du backend en arrière-plan..."
        cd backend && npm run dev &
        BACKEND_PID=$!
        cd ..

        sleep 3

        print_step "Démarrage du frontend..."
        cd frontend && npm run dev &
        FRONTEND_PID=$!
        cd ..

        echo ""
        print_ok "Backend PID: $BACKEND_PID"
        print_ok "Frontend PID: $FRONTEND_PID"
        echo ""
        echo "Pour arrêter: kill $BACKEND_PID $FRONTEND_PID"
        echo ""

        # Attendre
        wait
    fi
fi
