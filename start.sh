#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

echo "[PortfolioHub] Arresto stack corrente..."
docker compose down --remove-orphans

echo "[PortfolioHub] Rebuild completo senza cache..."
docker compose build --no-cache

echo "[PortfolioHub] Avvio con container ricreati e watch attivo..."
exec docker compose up --force-recreate --watch
