#!/bin/bash
# ============================================
# MejoraWS — Backup Script
# ============================================
# Uso: ./scripts/backup.sh
# Cron: 0 */6 * * * /path/to/scripts/backup.sh
# ============================================

set -euo pipefail

# Config
DB_PATH="${DB_PATH:-./data/mejoraws.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
MAX_BACKUPS="${MAX_BACKUPS:-7}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mejoraws-$TIMESTAMP.db"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}[MejoraWS Backup]${NC} Iniciando backup..."

# Check DB exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}[ERROR]${NC} Database no encontrada: $DB_PATH"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup using SQLite .backup (safe for concurrent access)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# Verify backup integrity
INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>/dev/null)
if [ "$INTEGRITY" != "ok" ]; then
    echo -e "${RED}[ERROR]${NC} Backup corrupto, eliminando..."
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Get backup size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${GREEN}[OK]${NC} Backup creado: $BACKUP_FILE ($SIZE)"

# Cleanup old backups (keep last N)
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/mejoraws-*.db 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    DELETED=$(ls -1t "$BACKUP_DIR"/mejoraws-*.db | tail -n +$((MAX_BACKUPS + 1)) | wc -l)
    ls -1t "$BACKUP_DIR"/mejoraws-*.db | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f
    echo -e "${YELLOW}[CLEANUP]${NC} Eliminados $DELETED backups antiguos (máximo: $MAX_BACKUPS)"
fi

echo -e "${GREEN}[MejoraWS Backup]${NC} Completado ✓"
