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
- `GET/PUT /users/:id` — Consulter / mettre à jour un utilisateur
- `DELETE /users/:id` — Supprimer un utilisateur (admin, retourne 204)

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

## Devenir administrateur

### Compte admin par défaut

Au premier lancement, si la base de données est vide, un compte admin est automatiquement créé :

| Email             | Mot de passe |
| ----------------- | ------------ |
| `alice@bank.fr`   | `admin123`   |

### À l'inscription

Passer le champ `role` à `"ADMIN"` lors de l'inscription :

```bash
curl -X POST http://localhost:3002/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@bank.fr",
    "password": "motdepasse",
    "role": "ADMIN"
  }'
```

### Via un admin existant

Un administrateur peut promouvoir un utilisateur via `PUT /users/:id` :

```bash
curl -X PUT http://localhost:3002/users/<USER_ID> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{ "role": "ADMIN" }'
```

## Docker

### Architecture conteneurisée

En mode Docker, l'architecture est renforcée avec un **load balancer NGINX** qui distribue le trafic sur plusieurs instances de chaque service.

```
Internet
   │
   └── frontend :3010
         ├── lb :3005  →  user-service-1 :3002
         │             →  user-service-2 :3002
         ├── lb :3004  →  notification-service-1 :3001
         │             →  notification-service-2 :3001
         └── account-service :3003
```

| Conteneur               | Rôle                                        | Port exposé (hôte) |
| ----------------------- | ------------------------------------------- | ------------------ |
| `user-service-1/2`      | User service (2 instances, round-robin)     | —                  |
| `notification-service-1/2` | Notification service (2 instances)       | —                  |
| `account-service`       | Account service (1 instance)                | —                  |
| `lb`                    | NGINX — reverse proxy + load balancer       | —                  |
| `frontend`              | Interface web                               | **3010**           |

Seul le frontend est accessible depuis l'hôte. Tous les backends communiquent sur le réseau interne Docker.

### Prérequis

- Docker >= 24
- Docker Compose >= 2

### Variables d'environnement

Créer un fichier `.env` à la racine du projet :

```bash
JWT_SECRET=votre_secret_jwt
```

### Lancement

```bash
# Construire les images et démarrer tous les conteneurs
docker compose up --build

# En arrière-plan
docker compose up --build -d
```

L'application est accessible sur http://localhost:3010.

### Commandes utiles

```bash
# Voir l'état des conteneurs
docker compose ps

# Consulter les logs d'un service
docker compose logs -f user-service-1

# Arrêter tous les conteneurs
docker compose down

# Arrêter et supprimer les volumes (reset complet des données)
docker compose down -v

# Reconstruire un seul service
docker compose up --build user-service-1
```

### Volumes persistants

Les bases de données SQLite sont stockées dans des volumes Docker nommés :

| Volume              | Données                        |
| ------------------- | ------------------------------ |
| `user-data`         | `users.db` (partagé 1 et 2)    |
| `notification-data` | `notifications.db` (partagé 1 et 2) |
| `account-data`      | `accounts.db`                  |

### Load Balancer NGINX

Le service `lb` est un NGINX configuré en reverse proxy exposant deux ports internes :

- **:3005** → `user-service-1` et `user-service-2` (round-robin)
- **:3004** → `notification-service-1` et `notification-service-2` (round-robin)

Il gère également les en-têtes CORS et la transmission des headers `Authorization`.

Un endpoint de santé est disponible sur chaque port :

```bash
# Depuis l'intérieur du réseau Docker
curl http://lb:3005/health
curl http://lb:3004/health
```

### Dockerfiles

Chaque service Node.js utilise un **build multi-stage** pour limiter la taille de l'image finale :

1. **Stage `build`** — installe les dépendances de compilation (python3, make, g++) et génère la doc Swagger
2. **Stage final** — image légère `node:20-alpine` avec uniquement les fichiers nécessaires à l'exécution

## CI

Les tests sont exécutés automatiquement via GitHub Actions sur chaque push (hors `main-old`) et pull request.

Chaque service est testé indépendamment en parallèle. Un audit des dépendances (`npm audit --audit-level=high`) est également exécuté pour détecter les vulnérabilités connues.
