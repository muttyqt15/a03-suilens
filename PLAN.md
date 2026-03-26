# A03 — API and Kubernetes Deployment: Implementation Plan

**Course**: CSCE604271 — Arsitektur Aplikasi Web
**Weight**: 6.5% of final grade
**Deadline**: ~~Sun 23-03-2026 23:55~~ (LATE — submit ASAP)
**Submission**: GitHub repo link + Docker Hub swagger image link on SCELE
**SCELE Link**: https://scele.cs.ui.ac.id/mod/assign/view.php?id=212127

---

## Submission Format

The assignment is submitted as **two links** on SCELE:
1. GitHub repo link (https://github.com/muttyqt15/a03-suilens)
2. Docker Hub link to image with swagger documentation

The **README.md** in the repo is the primary deliverable — it must contain:
- Answers to all implicit questions
- Screenshots of OpenAPI docs per service
- Screenshot of `kubectl get pods -o wide`
- Any other documentation

### Screenshot Standards

All evidence should be screenshots. Follow these rules:
- **Terminal commands**: show both the command typed AND the output
- **Browser/UI**: show the full browser window with URL bar visible
- **Kubernetes**: show full terminal output, no truncation
- **Before/after pairs**: take both from same session, same window size
- **Naming**: `XX-description.png` (e.g. `01-swagger-catalog.png`)
- **Store in**: `screenshots/` directory in repo root

---

## What We Have

| Resource | Status | Details |
|----------|--------|---------|
| Forked repo | Done | `muttyqt15/a03-suilens`, cloned to `/Users/qin/Projects/acad/aaw/a03-suilens` |
| Multipass VMs | Restarting | `cp1` (control plane), `w1`, `w2` (workers) — 192.168.64.7/8/9 |
| K8s cluster | Exists | kubeadm, Flannel CNI, MetalLB — from tutorial-a03 |
| Latihan PDF | Submitted | `Tutorial_OnPremise_2306207101_MuttaqinMuzakkir.pdf` |
| Docker | Installed | Local Docker Desktop |
| bun | Needed | Services use Bun runtime |

---

## Codebase Overview

**Architecture**: 3 microservices + 1 Vue 3 frontend + RabbitMQ + 3 PostgreSQL DBs

| Service | Port | Framework | Endpoints |
|---------|------|-----------|-----------|
| catalog-service | 3001 | Elysia (Bun) | `GET /api/lenses`, `GET /api/lenses/:id`, `GET /health` |
| order-service | 3002 | Elysia (Bun) | `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`, `GET /health` |
| notification-service | 3003 | Elysia (Bun) | `GET /health` (+ RabbitMQ consumer) |
| frontend | 5173 | Vue 3 + Vuetify + Vite | Lens catalog UI, notifications panel |

**Inter-service communication**:
- order-service → catalog-service: HTTP (validate lens)
- order-service → RabbitMQ: publish `order.placed` to exchange `suilens.events`
- notification-service ← RabbitMQ: consume from queue `notification-service.order-events`
- Frontend has notifications UI shell but NO WebSocket connection yet

---

## Steps

### Step 1: Implement OpenAPI Documentation

**Doc requirement (exact)**:
> "Implementasikan dokumentasi OpenAPI pada suilens untuk setiap endpoint yang ada."

**What to do**:
- Add `@elysiajs/swagger` plugin to each of the 3 backend services
- Add `.use(swagger())` to each Elysia app instance
- Ensure all endpoints have typed request/response schemas (Elysia `t.*` validators)
- Swagger UI must be browsable at each service's `/swagger` path

**Files to modify**:
- `services/catalog-service/package.json` — add `@elysiajs/swagger`
- `services/catalog-service/src/index.ts` — import and `.use(swagger())`
- `services/order-service/package.json` — add `@elysiajs/swagger`
- `services/order-service/src/index.ts` — import and `.use(swagger())`
- `services/notification-service/package.json` — add `@elysiajs/swagger`
- `services/notification-service/src/index.ts` — import and `.use(swagger())`

**Acceptance criteria**:
- [ ] `http://localhost:3001/swagger` shows catalog-service docs (GET /api/lenses, GET /api/lenses/:id, GET /health)
- [ ] `http://localhost:3002/swagger` shows order-service docs (POST /api/orders with full body schema, GET /api/orders, GET /api/orders/:id, GET /health)
- [ ] `http://localhost:3003/swagger` shows notification-service docs (GET /health)
- [ ] All request bodies and response types are accurately documented (not generic `any`)

**Screenshots needed**:
- `01-swagger-catalog.png` — catalog-service swagger page
- `02-swagger-order.png` — order-service swagger page
- `03-swagger-notification.png` — notification-service swagger page

---

### Step 2: Implement WebSocket API

**Doc requirement (exact)**:
> "Implementasikan API WebSocket pada suilens yang langsung menunjukkan notifikasi muncul pada frontend."

**What to do**:
- Add WebSocket endpoint to notification-service (Elysia has built-in `.ws()` support)
- When RabbitMQ consumer receives `order.placed`, broadcast to all connected WS clients
- Connect frontend (`HelloWorld.vue`) to the WebSocket on component mount
- Display incoming notifications in the existing notifications UI

**Files to modify**:
- `services/notification-service/src/index.ts` — add `.ws()` route
- `services/notification-service/src/consumer.ts` — broadcast to WS clients after saving to DB
- `frontend/suilens-frontend/src/components/HelloWorld.vue` — add WS connection in `onMounted`, push to `notifications` array

**Acceptance criteria**:
- [ ] `ws://localhost:3003/ws` accepts WebSocket connections
- [ ] When an order is placed (POST /api/orders), the notification-service broadcasts the event via WebSocket
- [ ] Frontend receives the WS message and displays notification in real-time (no page refresh)
- [ ] Notification displays lens name and customer name (matching existing UI: "Order placed for [lensName] by [customerName]")

**No screenshots yet** — screenshots come in Step 3.

---

### Step 3: Run Smoke Test & Capture Screenshots

**Doc requirement (exact)**:
> "Jalankan smoke test yang ada pada README.md suilens, namun ganti customerName menjadi nama kalian, dan customerEmail menjadi <NPM>@gmail.com. Ekspektasi hasil frontend setelah implementasi websocket adalah sebagai berikut (layout tidak harus sama, yang penting menunjukan websocket berhasil)"

**What to do**:
1. Start all services: `docker compose up --build -d`
2. Run migrations and seed:
   ```bash
   (cd services/catalog-service && bun install --frozen-lockfile && bunx drizzle-kit push)
   (cd services/order-service && bun install --frozen-lockfile && bunx drizzle-kit push)
   (cd services/notification-service && bun install --frozen-lockfile && bunx drizzle-kit push)
   (cd services/catalog-service && bun run src/db/seed.ts)
   ```
3. Open frontend at `http://localhost:5173` — screenshot BEFORE POST
4. Run smoke test:
   ```bash
   curl http://localhost:3001/api/lenses | jq
   LENS_ID=$(curl -s http://localhost:3001/api/lenses | jq -r '.[0].id')
   curl -X POST http://localhost:3002/api/orders \
     -H "Content-Type: application/json" \
     -d '{
       "customerName": "Muttaqin Muzakkir",
       "customerEmail": "2306207101@gmail.com",
       "lensId": "'"$LENS_ID"'",
       "startDate": "2025-03-01",
       "endDate": "2025-03-05"
     }' | jq
   ```
5. Screenshot frontend AFTER POST — notification must be visible

**Acceptance criteria**:
- [ ] `customerName` is exactly **"Muttaqin Muzakkir"**
- [ ] `customerEmail` is exactly **"2306207101@gmail.com"**
- [ ] Before-screenshot shows frontend with empty/no notifications
- [ ] After-screenshot shows frontend with WebSocket notification visible
- [ ] The two screenshots clearly demonstrate WebSocket is working

**Screenshots needed**:
- `04-frontend-before-post.png` — frontend before smoke test
- `05-frontend-after-post.png` — frontend after smoke test, notification visible
- `06-smoke-test-terminal.png` — terminal showing curl commands and their JSON output

---

### Step 4: Build & Push Docker Images to Docker Hub

**Doc requirement (exact)**:
> "Kumpulkan link github/gitlab beserta link ke image swagger documentation pada Docker hub."

**What to do**:
- Build Docker images for all services (swagger must be included/accessible)
- Tag and push to Docker Hub
- The "image swagger documentation" likely means: push the service images that serve swagger, then link to them

**Commands**:
```bash
# Login to Docker Hub
docker login

# Build and tag
docker build -t qinnyboy/suilens-catalog:latest ./services/catalog-service
docker build -t qinnyboy/suilens-order:latest ./services/order-service
docker build -t qinnyboy/suilens-notification:latest ./services/notification-service
docker build -t qinnyboy/suilens-frontend:latest ./frontend/suilens-frontend

# Push
docker push qinnyboy/suilens-catalog:latest
docker push qinnyboy/suilens-order:latest
docker push qinnyboy/suilens-notification:latest
docker push qinnyboy/suilens-frontend:latest
```

**Acceptance criteria**:
- [ ] All images pushed to Docker Hub and publicly accessible
- [ ] Running the pushed images serves swagger documentation at `/swagger`
- [ ] Docker Hub links ready for SCELE submission

**Screenshots needed**:
- `07-dockerhub-images.png` — Docker Hub page showing pushed images

---

### Step 5: Deploy to Kubernetes Cluster

**Doc requirement (exact)**:
> "Buatlah sebuah local kubernetes cluster. Anda dapat menggunakan cluster yang dibuat saat tutorial, maupun membuat cluster baru dengan tools lain (kind, k3s, etc). Berikut spesifikasi cluster yang perlu dibuat:
> - Terdiri dari 1 control plane dan 2 worker node, resource dibebaskan.
> - Deploy aplikasi ke sebuah namespace kubernetes dengan nama "suilens-<NPM>""

**What we have**: Existing multipass cluster (cp1 + w1 + w2) from tutorial. Reuse it.

**What to do**:
1. Verify cluster is healthy: `kubectl get nodes`
2. Create namespace: `kubectl create namespace suilens-2306207101`
3. Create Kubernetes manifests (Deployments + Services) for:
   - 3x PostgreSQL databases
   - RabbitMQ
   - catalog-service
   - order-service
   - notification-service
   - frontend
4. Deploy all manifests to namespace `suilens-2306207101`
5. Verify all pods are running

**Files to create**:
- `k8s/namespace.yaml`
- `k8s/databases.yaml` (3 postgres instances)
- `k8s/rabbitmq.yaml`
- `k8s/catalog-service.yaml` (Deployment + Service)
- `k8s/order-service.yaml` (Deployment + Service)
- `k8s/notification-service.yaml` (Deployment + Service)
- `k8s/frontend.yaml` (Deployment + Service with LoadBalancer)

**Acceptance criteria**:
- [ ] Namespace `suilens-2306207101` exists
- [ ] All pods running in that namespace
- [ ] 1 control plane + 2 worker nodes (already have this)
- [ ] `kubectl get pods -n suilens-2306207101 -o wide` shows all pods distributed across workers

**Screenshots needed**:
- `08-kubectl-get-nodes.png` — `kubectl get nodes` showing cp1, w1, w2
- `09-kubectl-get-pods.png` — `kubectl get pods -n suilens-2306207101 -o wide` (THIS IS EXPLICITLY REQUIRED)

---

### Step 6: Write README

**Doc requirement (exact)**:
> "Jawaban dari pertanyaan ditulis di dalam file README. Kumpulkan link github/gitlab beserta link ke image swagger documentation pada Docker hub."
>
> "Sertakan dokumentasi-dokumentasi berikut pada file README Anda:
> - Screenshot tangkapan layar OpenAPI documentation untuk masing-masing service
> - Jalankan command 'kubectl get pods -o wide'. Screenshot outputnya."

**README must contain**:

1. **Project overview** — what suilens is, architecture diagram
2. **OpenAPI screenshots** — one per service (catalog, order, notification)
3. **WebSocket implementation** — brief explanation + before/after screenshots
4. **Smoke test results** — terminal output + frontend screenshots
5. **Kubernetes deployment** — how to deploy + `kubectl get pods -o wide` screenshot
6. **Docker Hub links** — links to each pushed image
7. **How to run** — local dev instructions (docker compose)

**Acceptance criteria**:
- [ ] README has screenshot of swagger for catalog-service
- [ ] README has screenshot of swagger for order-service
- [ ] README has screenshot of swagger for notification-service
- [ ] README has screenshot of `kubectl get pods -n suilens-2306207101 -o wide`
- [ ] README has before/after WebSocket screenshots
- [ ] README has Docker Hub image links
- [ ] README has GitHub repo link

---

### Step 7: Submit on SCELE

**What to submit** (as text on SCELE Assignment: A03):
1. GitHub link: `https://github.com/muttyqt15/a03-suilens`
2. Docker Hub link: `https://hub.docker.com/r/qinnyboy/suilens-catalog` (and others)

---

## Execution Order

```
1. OpenAPI/Swagger     ← code changes only, fast
2. WebSocket           ← code changes, needs testing
3. Smoke test          ← run locally via docker-compose, take screenshots
4. Docker Hub push     ← build + push images
5. K8s deploy          ← ensure VMs are up, deploy manifests, screenshot
6. README              ← compile all screenshots + write docs
7. Submit on SCELE     ← paste links
```

Steps 1-2 are code. Step 3 validates 1-2. Steps 4-5 are infra. Step 6 is docs. Step 7 is submit.

---

## Risk Checklist

| Risk | Mitigation |
|------|-----------|
| Multipass VMs won't start | Restart with `multipass restart cp1 w1 w2`, or recreate |
| macOS bridge100 networking | Use `sudo multipass exec` (known workaround) |
| K8s cluster state broken | `kubeadm reset` + re-init if needed, or use kind/k3s as fallback |
| Docker Hub push fails | Ensure `docker login` first, check account |
| Elysia swagger plugin issues | Check `@elysiajs/swagger` version compatibility with elysia@1.4.25 |
| WebSocket not working through Docker networking | Ensure ports are exposed, CORS allows WS upgrade |
| Late penalty | Submit ASAP — no cutoff date set, so submission is still open |
