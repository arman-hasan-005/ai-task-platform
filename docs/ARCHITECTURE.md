# AI Task Processing Platform — Architecture Document

## 1. System Overview

The AI Task Processing Platform is a cloud-native, asynchronous job processing system built on the MERN stack with a Python worker service. It allows users to submit text-processing tasks (uppercase, lowercase, reverse, word count) that are queued in Redis and processed asynchronously by horizontally scalable Python workers.

```
User → React Frontend → Node.js API → Redis Queue → Python Worker(s) → MongoDB
                    ↑                                        ↓
                    └──────────── Status Polling ────────────┘
```

---

## 2. Worker Scaling Strategy

### Current Architecture
Workers use a **competing consumers** pattern. Multiple worker replicas all listen on the same Redis queue (`BLPOP`). Redis atomically delivers each job to exactly one worker, ensuring no duplicate processing.

### Horizontal Scaling Triggers
The Kubernetes HorizontalPodAutoscaler (HPA) scales workers based on:
- **CPU utilization** > 70% → scale up
- **Memory utilization** > 80% → scale up
- Min replicas: **2** (for high availability)
- Max replicas: **10**

### How Scaling Works
1. Tasks pile up → workers get busy → CPU spikes
2. HPA detects CPU > 70% and adds replicas (up to 10)
3. New pods start in ~15–30 seconds, connect to Redis, and begin consuming
4. Queue drains → CPU drops → HPA scales back down after cooldown

### Advanced Scaling (Future)
For queue-depth-based scaling, integrate **KEDA (Kubernetes Event Driven Autoscaler)**:
```yaml
# KEDA ScaledObject on Redis queue length
triggers:
  - type: redis
    metadata:
      listName: task_queue
      listLength: "10"   # 1 worker per 10 pending tasks
```
This enables 0-to-N scaling based purely on queue depth, not CPU — ideal for bursty workloads.

---

## 3. Handling High Task Volume (100,000 Tasks/Day)

### Throughput Analysis
- 100,000 tasks/day = ~1.16 tasks/second on average
- Peak hours may reach 5–10x average = ~6–12 tasks/second
- Each task processes in ~1–50ms (simple string operations)

### Current Capacity (2 workers)
- Each worker: ~100–1000 tasks/minute depending on task complexity
- 2 workers: easily handles 200–2000 tasks/minute = **288,000–2,880,000 tasks/day**
- 100k/day is well within 2-worker capacity at default load

### Bottlenecks & Mitigations

| Bottleneck | Solution |
|---|---|
| Redis single instance | Redis Sentinel or Redis Cluster for HA |
| MongoDB write contention | Compound indexes + write concern tuning |
| Worker CPU saturation | HPA auto-scales to 10 workers |
| API rate limits | Per-user rate limiting (30 tasks/min) |
| Queue backlog growth | Dead Letter Queue for failed jobs |

### Queue Architecture
```
Redis RPUSH (API) → task_queue → BLPOP (Worker)
                              ↘ failed_queue (after 3 retries)
```

Workers use `BLPOP` with a 1-second timeout — this means zero CPU waste when the queue is empty, and instant pickup when jobs arrive.

### Batch Processing
For bulk imports (e.g., 10,000 tasks at once), the API supports pipeline-style submission. Workers process independently, and results are retrievable via polling or (future) WebSocket push.

---

## 4. Database Indexing Strategy

### Users Collection Indexes
```javascript
{ email: 1 }          // unique — login lookup
{ username: 1 }       // unique — registration check
{ createdAt: -1 }     // admin analytics
```

### Tasks Collection Indexes
```javascript
{ owner: 1, createdAt: -1 }   // PRIMARY: user's task list, sorted newest-first
{ status: 1, createdAt: 1 }   // queue monitoring, find oldest pending tasks
{ owner: 1, status: 1 }       // filter by owner + status (dashboard filters)
{ createdAt: -1 }             // global recency, TTL candidate
{ operation: 1, status: 1 }   // analytics: operation success rates
```

### Why These Indexes
- **`{owner, createdAt}`** is the most frequent query: "give me this user's tasks, newest first". Without this, MongoDB does a full collection scan.
- **`{status, createdAt}`** enables monitoring queries like "find all pending tasks older than 5 minutes" for stale-task detection.
- **`{owner, status}`** powers the dashboard filter tabs (pending/running/success/failed) without scanning all user tasks.

### Index Monitoring
```javascript
db.tasks.explain("executionStats").find({ owner: userId, status: "pending" })
// Check: IXSCAN (good) vs COLLSCAN (bad)
```

For 100k tasks/day at 30-day retention = ~3M documents. All queries should remain <10ms with proper indexing. Consider **TTL index** on `createdAt` to auto-delete tasks older than 90 days:
```javascript
db.tasks.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 })
```

---

## 5. Handling Redis Failure

Redis is a critical dependency — it is the task queue. Failure means tasks cannot be submitted or processed. The system handles this at multiple layers:

### Prevention: Redis Sentinel (Production)
In production, run Redis with **Sentinel** for automatic failover:
- 1 primary + 2 replicas + 3 sentinels
- Sentinel promotes a replica to primary in ~30 seconds on failure
- Workers and API reconnect automatically via ioredis retry strategy

### Detection & Graceful Degradation
**API (Node.js):**
```javascript
// ioredis retryStrategy: exponential backoff up to 3s
retryStrategy: (times) => Math.min(times * 100, 3000)
```
If Redis is down when a task is submitted, the API returns `503 Service Unavailable` — the task is NOT created in MongoDB (preventing phantom tasks with no queue entry).

**Worker (Python):**
```python
# On ConnectionError: retry with exponential backoff
# After MAX_RETRIES: exit (Kubernetes restarts the pod)
```
The Kubernetes `restartPolicy: Always` ensures workers automatically recover.

### In-Flight Job Protection
Workers use `BLPOP` (blocking pop), which is atomic. If a worker crashes mid-processing:
- The job is already removed from Redis (no re-queue)
- The task stays in `running` state in MongoDB
- A **stale task detector** (cron job, future feature) can reset `running` tasks older than 5 minutes back to `pending` and re-queue them

### Fallback for Critical Failures
If Redis is completely unavailable for an extended period:
1. API returns meaningful errors to users
2. Tasks submitted during downtime are rejected (not silently dropped)
3. Once Redis recovers, new tasks flow normally
4. Previously submitted tasks that were in queue are NOT lost (they were already in MongoDB with `pending` status and can be re-queued via admin API)

---

## 6. Staging vs Production Deployment

### Environment Strategy
Two Argo CD `Application` resources point to the same infra repo but different branches/paths:

```yaml
# Staging
source:
  targetRevision: develop
  path: k8s/overlays/staging

# Production  
source:
  targetRevision: main
  path: k8s/overlays/production
```

Using **Kustomize overlays**:
```
k8s/
├── base/                    # Shared manifests
│   ├── backend.yaml
│   ├── worker.yaml
│   └── frontend.yaml
└── overlays/
    ├── staging/
    │   ├── kustomization.yaml
    │   └── patches/
    │       └── replicas-patch.yaml   # replicas: 1 for staging
    └── production/
        ├── kustomization.yaml
        └── patches/
            └── replicas-patch.yaml   # replicas: 2+ for production
```

### Key Differences: Staging vs Production

| Config | Staging | Production |
|---|---|---|
| Replicas (backend) | 1 | 2 |
| Replicas (worker) | 1 | 2–10 (HPA) |
| Auto-sync | Enabled | Manual approval (PR-gated) |
| Resource limits | Lower | Full |
| Log level | debug | info |
| MongoDB | Shared Atlas dev cluster | Dedicated Atlas M10+ |
| Redis | Single instance | Redis Sentinel |
| TLS | Self-signed | Let's Encrypt via cert-manager |

### Promotion Flow
```
Feature branch → PR → develop → Auto-deploy to Staging
                                        ↓ (QA passes)
                               PR to main → Manual approval
                                        ↓
                               Auto-deploy to Production (Argo CD)
```

### CI/CD Integration
The GitHub Actions pipeline:
1. Builds images and tags them with the git short SHA
2. Updates `k8s/overlays/staging` image tags automatically on `develop` push
3. Updates `k8s/overlays/production` image tags only on `main` push
4. Argo CD detects the infra repo change and syncs within 3 minutes

---

## 7. Security Architecture

- **Secrets management**: Kubernetes Secrets (base64). In production, use **Sealed Secrets** or **External Secrets Operator** with AWS Secrets Manager / HashiCorp Vault
- **No hardcoded secrets**: All sensitive values via environment variables injected at runtime
- **JWT**: Short-lived access tokens (15m) + long-lived refresh tokens (7d)
- **Password hashing**: bcrypt with 12 salt rounds (~300ms/hash — brute-force resistant)
- **Rate limiting**: Global (100 req/15min), auth (10 req/15min), task creation (30 req/min)
- **Helmet**: HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
- **MongoDB sanitization**: `express-mongo-sanitize` prevents NoSQL injection
- **Non-root containers**: All pods run as UID 1001
- **Read-only root filesystem**: where possible
- **Network policies**: (recommended) restrict pod-to-pod communication to only what's needed
