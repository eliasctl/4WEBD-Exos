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

for service in "${SERVICES[@]}"; do
  if [ ! -d "$service/node_modules" ]; then
    echo "📦 Installation des dépendances pour $service..."
    (cd "$service" && npm install)
  fi
  echo "🚀 Démarrage de $service..."
  (cd "$service" && npm run start) &
  PIDS+=($!)
done

echo "\nTous les services sont lancés. Ctrl+C pour arrêter."
wait
