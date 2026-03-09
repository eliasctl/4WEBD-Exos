#!/bin/bash

SERVICES=("user-service" "notification-service")
PIDS=()

cleanup() {
  echo "\nArrêt des services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null
  done
  exit 0
}

trap cleanup SIGINT SIGTERM

echo "=== Lancement des tests ==="
for service in "${SERVICES[@]}"; do
  echo "Tests de $service..."
  (cd "$service" && npm test)
  if [ $? -ne 0 ]; then
    echo "❌ Les tests de $service ont échoué. Arrêt."
    exit 1
  fi
done
echo "✅ Tous les tests passent."
echo ""

for service in "${SERVICES[@]}"; do
  echo "Démarrage de $service..."
  (cd "$service" && npm run dev) &
  PIDS+=($!)
done

echo "Tous les services sont lancés. Ctrl+C pour arrêter."
wait
