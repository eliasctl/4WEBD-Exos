#!/bin/bash

SERVICES=("user-service" "notification-service" "account-service")
PIDS=()

cleanup() {
  echo "\nArrêt des services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null
  done
  exit 0
}

trap cleanup SIGINT SIGTERM

echo "=== Installation et génération ==="
for service in "${SERVICES[@]}"; do
  echo "📦 Installation des dépendances pour $service..."
  (cd "$service" && npm install)
  echo "📄 Génération Swagger pour $service..."
  (cd "$service" && node swagger.js)
done
echo "📦 Installation des dépendances pour frontend..."
(cd frontend && npm install)
echo ""

echo "=== Lancement des tests ==="
for service in "${SERVICES[@]}"; do
  if [ -d "$service/__tests__" ]; then
    echo "Tests de $service..."
    (cd "$service" && npm test)
    if [ $? -ne 0 ]; then
      echo "❌ Les tests de $service ont échoué. Arrêt."
      exit 1
    fi
  fi
done
echo "✅ Tous les tests passent."
echo ""

echo "=== Démarrage des services ==="
for service in "${SERVICES[@]}"; do
  echo "🚀 Démarrage de $service..."
  (cd "$service" && npm run dev) &
  PIDS+=($!)
done

echo "🌐 Démarrage du frontend..."
(cd frontend && npm run dev) &
PIDS+=($!)

echo "\nTous les services sont lancés. Ctrl+C pour arrêter."
echo "   Frontend : http://localhost:3000"
wait
