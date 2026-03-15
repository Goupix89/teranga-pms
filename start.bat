@echo off
chcp 65001 >nul
title Hotel PMS — Démarrage

echo.
echo ╔══════════════════════════════════════════╗
echo ║     Hotel PMS — Démarrage Rapide         ║
echo ╚══════════════════════════════════════════╝
echo.

:: =============================================================================
:: Vérification des prérequis
:: =============================================================================
echo [1/6] Vérification des prérequis...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js non trouvé. Installez-le depuis https://nodejs.org
    echo    Version requise : 20+
    pause
    exit /b 1
)

for /f "tokens=1" %%v in ('node -v') do echo ✅ Node.js %%v

where npx >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npx non trouvé. Réinstallez Node.js.
    pause
    exit /b 1
)

:: =============================================================================
:: Backend Setup
:: =============================================================================
echo.
echo [2/6] Configuration du Backend...

cd backend

if not exist .env (
    copy .env.example .env >nul
    echo ✅ Fichier backend\.env créé
    echo.
    echo ⚠️  IMPORTANT: Éditez backend\.env pour configurer :
    echo    DATABASE_URL="postgresql://VOTRE_USER:VOTRE_PASSWORD@localhost:5432/hotel_pms"
    echo    JWT_ACCESS_SECRET="(générez avec: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
    echo    JWT_REFRESH_SECRET="(idem, mais différent)"
    echo.
    pause
)

echo [3/6] Installation des dépendances backend...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erreur lors de npm install (backend)
    pause
    exit /b 1
)

echo ✅ Dépendances backend installées

echo [4/6] Prisma: génération du client et migrations...
call npx prisma generate
call npx prisma db push
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erreur Prisma. Vérifiez DATABASE_URL dans .env
    echo    PostgreSQL doit être démarré et la base "hotel_pms" doit exister.
    echo.
    echo    Créez-la avec: createdb hotel_pms
    echo    Ou dans psql: CREATE DATABASE hotel_pms;
    pause
    exit /b 1
)

echo ✅ Base de données configurée

echo Chargement des données de démo...
call npx tsx prisma/seed.ts
echo ✅ Données de démo chargées

cd ..

:: =============================================================================
:: Frontend Setup
:: =============================================================================
echo.
echo [5/6] Configuration du Frontend...

cd frontend

if not exist .env (
    copy .env.example .env >nul
    echo ✅ Fichier frontend\.env créé
)

call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erreur lors de npm install (frontend)
    pause
    exit /b 1
)
echo ✅ Dépendances frontend installées

cd ..

:: =============================================================================
:: Démarrage
:: =============================================================================
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║  ✅  INSTALLATION TERMINÉE !                        ║
echo ╠══════════════════════════════════════════════════════╣
echo ║                                                      ║
echo ║  [6/6] Démarrage des serveurs...                     ║
echo ║                                                      ║
echo ║  Frontend : http://localhost:3000                    ║
echo ║  API      : http://localhost:4000                    ║
echo ║                                                      ║
echo ║  Login : admin@hoteldemo.com / Admin123!             ║
echo ║                                                      ║
echo ╚══════════════════════════════════════════════════════╝
echo.

echo Démarrage du backend (port 4000)...
start "Hotel PMS - Backend" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Démarrage du frontend (port 3000)...
start "Hotel PMS - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ✅ Les deux serveurs démarrent dans des fenêtres séparées.
echo    Attendez ~10 secondes puis ouvrez http://localhost:3000
echo.
echo Appuyez sur une touche pour fermer cette fenêtre...
pause >nul
