# AI Task Processing Platform

A production-ready, cloud-native AI task processing platform built with the MERN stack, Python worker, Docker, Kubernetes, Argo CD, and GitHub Actions CI/CD.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + React Router |
| Backend API | Node.js + Express |
| Worker | Python 3.12 |
| Database | MongoDB 7 |
| Queue | Redis 7 |
| Container | Docker (multi-stage, non-root) |
| Orchestration | Kubernetes / k3s |
| GitOps | Argo CD |
| CI/CD | GitHub Actions |

## Features

- ✅ JWT authentication (register/login/refresh)
- ✅ Create and run AI tasks asynchronously
- ✅ Task operations: uppercase, lowercase, reverse, word count
- ✅ Real-time status tracking (pending → running → success/failed)
- ✅ Per-task logs and structured results
- ✅ Task retry on failure
- ✅ Dashboard with stats and filtering
- ✅ Production Dockerfiles (multi-stage, non-root)
- ✅ Full Kubernetes manifests with HPA for workers
- ✅ Argo CD GitOps auto-sync
- ✅ GitHub Actions CI/CD pipeline

---

## Project Structure

```
ai-task-platform/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── app.js              # Entry point
│   │   ├── config/             # DB & Redis connections
│   │   ├── controllers/        # Route handlers
│   │   ├── middleware/         # Auth, error, rate-limit
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # Express routers
│   │   └── utils/              # Logger
│   ├── Dockerfile
│   └── package.json
│
├── worker/                     # Python background processor
│   ├── src/
│   │   ├── processor.py        # Main worker loop
│   │   └── operations.py       # Task operation handlers
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── components/         # TaskCard, CreateModal, Layout, StatsBar
│   │   ├── context/            # AuthContext
│   │   ├── pages/              # Login, Register, Dashboard, TaskDetail
│   │   └── services/           # Axios API client
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── k8s/                        # Kubernetes manifests
│   ├── namespace/
│   ├── configmaps/
│   ├── secrets/
│   ├── mongodb/
│   ├── redis/
│   ├── backend/
│   ├── worker/                 # Includes HPA
│   ├── frontend/
│   └── ingress/
│
├── argocd/                     # Argo CD Application
├── docker/                     # Docker helpers (nginx proxy, mongo-init)
├── docs/
│   └── ARCHITECTURE.md
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # Full CI/CD pipeline
└── docker-compose.yml
```

---

## Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev without Docker)
- Python 3.12+ (for local dev without Docker)

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/ai-task-platform.git
cd ai-task-platform
```

### 2. Configure environment
```bash
# Copy and edit backend env
cp backend/.env.example backend/.env
# Edit: JWT_SECRET, JWT_REFRESH_SECRET (use strong random strings)

# Create root .env for docker-compose
cat > .env << EOF
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=changeme_strong_password
REDIS_PASSWORD=changeme_redis_password
JWT_SECRET=changeme_jwt_secret_at_least_32_chars
JWT_REFRESH_SECRET=changeme_refresh_secret_at_least_32_chars
EOF
```

### 3. Start all services
```bash
docker-compose up --build
```

Services:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

### 4. Scale workers locally
```bash
docker-compose up --scale worker=3
```

---

## Kubernetes Deployment

### Prerequisites
- k3s or full Kubernetes cluster
- kubectl configured
- Argo CD installed

### Install k3s (on your server)
```bash
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
```

### Install Argo CD
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Get admin password
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d

# Port-forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Open: https://localhost:8080 (admin / <password above>)
```

### Apply Kubernetes Manifests Manually (first time)
```bash
# Namespace
kubectl apply -f k8s/namespace/

# Secrets (edit real values first!)
kubectl apply -f k8s/secrets/

# ConfigMaps
kubectl apply -f k8s/configmaps/

# Infrastructure
kubectl apply -f k8s/mongodb/
kubectl apply -f k8s/redis/

# Wait for DB to be ready
kubectl wait --for=condition=ready pod -l app=mongodb -n ai-task-platform --timeout=120s

# Applications
kubectl apply -f k8s/backend/
kubectl apply -f k8s/worker/
kubectl apply -f k8s/frontend/

# Ingress
kubectl apply -f k8s/ingress/
```

### Register with Argo CD (GitOps)
```bash
# Point your infra repo URL in argocd/application.yaml, then:
kubectl apply -f argocd/application.yaml

# Argo CD will now auto-sync on every push to your infra repo
```

---

## CI/CD Setup (GitHub Actions)

### Required GitHub Secrets
Go to your repo → Settings → Secrets and Variables → Actions:

| Secret | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `INFRA_REPO` | `username/ai-task-platform-infra` |
| `INFRA_REPO_PAT` | GitHub PAT with `repo` scope for infra repo |

### Pipeline Flow
```
Push to main
  │
  ├─ Lint backend (ESLint)
  ├─ Lint frontend (ESLint)
  ├─ Lint worker (flake8 + black)
  │
  ├─ Build & push Docker images
  │   ├─ backend:SHA + latest
  │   ├─ frontend:SHA + latest
  │   └─ worker:SHA + latest
  │
  └─ Update infra repo image tags
      └─ Argo CD auto-syncs to cluster
```

---

## API Reference

### Auth
```
POST /api/auth/register   { username, email, password }
POST /api/auth/login      { email, password }
POST /api/auth/refresh    { refreshToken }
GET  /api/auth/me         (requires Bearer token)
```

### Tasks
```
GET    /api/tasks          ?page=1&limit=10&status=pending&operation=uppercase
POST   /api/tasks          { title, inputText, operation }
GET    /api/tasks/:id
DELETE /api/tasks/:id
POST   /api/tasks/:id/retry
GET    /api/tasks/stats
```

### Health
```
GET /health/live    # Liveness probe
GET /health/ready   # Readiness probe (checks DB + Redis)
```

---

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT access tokens (15min) + refresh tokens (7 days)
- Helmet HTTP security headers
- Rate limiting: 100 req/15min global, 10/15min for auth, 30/min for tasks
- MongoDB NoSQL injection sanitization
- HPP (HTTP Parameter Pollution) protection
- Non-root Docker containers (UID 1001)
- No hardcoded secrets — all via environment variables

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details on:
- Worker scaling strategy
- 100k tasks/day handling
- Database indexing strategy
- Redis failure handling
- Staging vs production environments

---

## Monitoring (Recommended Additions)

```bash
# View worker logs
kubectl logs -l app=worker -n ai-task-platform --tail=100 -f

# View HPA status
kubectl get hpa -n ai-task-platform

# Check queue depth
kubectl exec -it deploy/redis -n ai-task-platform -- redis-cli llen task_queue

# Pod resource usage
kubectl top pods -n ai-task-platform
```
