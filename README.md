# 4WEBD — Microservices Bancaires

Application bancaire construite en architecture microservices avec Node.js, Express et SQLite.

## Architecture

| Service                  | Port | Description                                      |
| ------------------------ | ---- | ------------------------------------------------ |
| **user-service**         | 3002 | Gestion des utilisateurs et authentification JWT |
| **account-service**      | 3003 | Comptes bancaires, dépôts, retraits et virements |
| **notification-service** | 3001 | Notifications (EMAIL, SMS, PUSH) et alertes      |
| **frontend**             | 3000 | Interface web                                    |

## Prérequis

- Node.js >= 20

## Lancement rapide

```bash
chmod +x dev.sh
./dev.sh
```

Ce script :

1. Installe les dépendances de chaque service
2. Génère la documentation Swagger
3. Lance les tests — s'arrête si un test échoue
4. Démarre tous les services et le frontend

## Lancement individuel

```bash
cd user-service && npm install && npm run dev
cd account-service && npm install && npm run dev
cd notification-service && npm install && npm run dev
cd frontend && npm install && npm run dev
```

## Tests

```bash
# Tous les services
cd user-service && npm test
cd account-service && npm test
cd notification-service && npm test
```

Les tests utilisent Jest et Supertest avec une base SQLite en mémoire (`:memory:`).

## API Documentation

Chaque service expose une documentation Swagger UI :

- User Service : http://localhost:3002/api-docs
- Account Service : http://localhost:3003/api-docs
- Notification Service : http://localhost:3001/api-docs

## Endpoints principaux

### User Service (`:3002`)

- `POST /auth/register` — Inscription
- `POST /auth/login` — Connexion (retourne un JWT)
- `GET /auth/me` — Profil courant (token requis)
- `GET /users` — Liste des utilisateurs (admin)
- `GET/PUT/DELETE /users/:id` — CRUD utilisateur

### Account Service (`:3003`)

- `POST /accounts` — Créer un compte
- `GET /accounts` — Lister ses comptes
- `POST /accounts/:id/deposit` — Déposer
- `POST /accounts/:id/withdraw` — Retirer
- `POST /transactions/transfer` — Virement
- `GET /transactions` — Historique

### Notification Service (`:3001`)

- `POST /notifications` — Envoyer une notification
- `GET /notifications` — Historique des notifications
- `POST /notifications/transaction` — Notifier une transaction
- `POST /notifications/alert` — Alerte de sécurité

## CI

Les tests sont exécutés automatiquement via GitHub Actions sur chaque push (hors `main`) et pull request.
