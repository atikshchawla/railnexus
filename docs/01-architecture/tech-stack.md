# 🛠️ Tech Stack Blueprint — RailNexus

---

## Core Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Framework** | Next.js (App Router) | 16.x | Server Components, API routes, WebSocket support, SSR for Digital Twin |
| **Language** | TypeScript | 5.x | Type safety across the entire codebase |
| **Runtime** | Node.js | 22.x LTS | Long-term support, native fetch, WebSocket |
| **ORM** | Prisma | 7.x | Type-safe database access, migrations, schema-first design |
| **Database (Primary)** | PostgreSQL | 16.x | ACID compliance, PostGIS for geospatial queries, JSONB for flexible schemas |
| **Database (Telemetry)** | TimescaleDB | 2.x | Time-series optimized extension on PostgreSQL for IoT/sensor data |
| **Cache / Pub-Sub** | Redis | 7.x | Real-time state caching, WebSocket pub/sub backbone, session store |
| **Message Broker** | Apache Kafka | 3.x | Event streaming, audit trail, inter-service decoupling |
| **Styling** | Tailwind CSS | 4.x | Already configured in the project; utility-first responsive design |

---

## AI/ML Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **MILP Solver** | Google OR-Tools / PuLP (Python) | Industry-standard constrained optimization |
| **Reinforcement Learning** | Stable-Baselines3 (PyTorch) | Heuristic exploration for large state spaces |
| **PINN Models** | PyTorch + Physics Constraints | Electromechanical degradation modeling for S&T RUL |
| **Model Serving** | FastAPI + ONNX Runtime | Low-latency inference serving over REST/gRPC |
| **ML Pipeline** | Apache Airflow | Scheduled retraining, data pipeline orchestration |
| **Feature Store** | Feast (on Redis) | Real-time feature serving for prediction models |

---

## Digital Twin Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Geospatial Engine** | Mapbox GL JS / Deck.gl | High-performance WebGL map rendering with custom layers |
| **Real-time Sync** | WebSocket (Socket.IO) | Sub-500ms state synchronization between server and client |
| **Graph Rendering** | D3.js | Custom node-and-edge railway network visualization |
| **Animation Engine** | Framer Motion + GSAP | Smooth train movement animations, signal transitions |
| **Timeline Component** | Custom (React) | Drag-and-drop block scheduling timeline |

---

## Infrastructure & DevOps

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Container Runtime** | Docker | Consistent development and deployment environments |
| **Orchestration** | Kubernetes (K8s) | Production scaling, rolling deployments, health checks |
| **CI/CD** | GitHub Actions | Automated testing, building, deployment pipelines |
| **Monitoring** | Prometheus + Grafana | Metrics collection, dashboarding, alerting |
| **Logging** | ELK Stack (Elasticsearch, Logstash, Kibana) | Centralized log aggregation and search |
| **APM** | OpenTelemetry + Jaeger | Distributed tracing across services |
| **Secrets Management** | HashiCorp Vault | Secure storage for API keys, database credentials, certificates |

---

## Security Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Authentication** | NextAuth.js v5 | Flexible auth with support for institutional SSO |
| **Authorization** | Custom RBAC Engine (Prisma-backed) | Fine-grained role-permission matrix |
| **Encryption (Transit)** | TLS 1.3 | Mandatory for all data transmissions |
| **Encryption (At Rest)** | AES-256 | Database encryption, object storage encryption |
| **API Security** | Rate limiting + JWT + API keys | Multi-layer API protection |
| **Audit Trail** | Kafka-backed immutable log | Every action logged, tamper-proof |

---

## Testing Stack

| Type | Technology | Coverage Target |
|------|-----------|-----------------|
| **Unit Tests** | Vitest | ≥ 80% line coverage |
| **Integration Tests** | Vitest + Testcontainers | All API routes, database operations |
| **E2E Tests** | Playwright | Critical user flows (block proposal → approval) |
| **Load Tests** | k6 | Concurrent user simulation, WebSocket stress |
| **Visual Regression** | Chromatic (Storybook) | UI component consistency |

---

## Package Dependencies (Current)

From [package.json](file:///Users/deep/Desktop/railnexus/package.json):

### Production
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.3.2 | Application framework |
| `react` / `react-dom` | 19.2.8 | UI rendering |
| `@prisma/client` | ^7.9.1 | Database client |
| `@prisma/adapter-pg` | ^7.9.1 | PostgreSQL driver adapter |
| `pg` | ^8.23.0 | PostgreSQL driver |
| `dotenv` | ^17.4.2 | Environment variable management |

### Development
| Package | Version | Purpose |
|---------|---------|---------|
| `prisma` | ^7.9.1 | Database toolkit CLI |
| `typescript` | ^5 | Type checking |
| `tailwindcss` | ^4 | CSS framework |
| `eslint` / `eslint-config-next` | ^9 / 16.3.2 | Code linting |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
