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

for service in "${SERVICES[@]}"; do
  echo "Démarrage de $service..."
  (cd "$service" && npm run dev) &
  PIDS+=($!)
done

echo "Tous les services sont lancés. Ctrl+C pour arrêter."
wait
