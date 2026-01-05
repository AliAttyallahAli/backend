#!/bin/bash

echo "🚀 Déploiement de ADOUAS-MC..."

# Build du frontend
echo "📦 Building frontend..."
cd frontend
npm run build

# Backup de la base de données
echo "💾 Sauvegarde de la base de données..."
cp ../backend/adouas_mc.db ../backend/backups/backup_$(date +%Y%m%d_%H%M%S).db

# Démarrage des services
echo "🔧 Démarrage des services..."
cd ../backend
pm2 start server.js --name "adouas-mc-backend"

echo "✅ Déploiement terminé!"
echo "🌐 Application disponible sur http://localhost:3000"
echo "🔧 Backend disponible sur http://localhost:5000"