# DEBT-OS Operations Guide

A comprehensive guide for deploying, monitoring, and maintaining DEBT-OS in production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment](#deployment)
- [Environment Configuration](#environment-configuration)
- [Infrastructure Components](#infrastructure-components)
- [Monitoring](#monitoring)
- [Maintenance](#maintenance)
- [Backup & Recovery](#backup--recovery)
- [Security Operations](#security-operations)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4 GB | 8+ GB |
| **Storage** | 50 GB SSD | 200+ GB SSD |
| **Network** | 100 Mbps | 1 Gbps |

### Software Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 24+ | Container runtime |
| Docker Compose | 2.0+ | Multi-container orchestration |
| Node.js | 20+ | Application runtime (if not containerized) |
| PostgreSQL | 16+ | Primary database |
| Redis | 7+ | Queue backend & cache |

### External Services

| Service | Required | Purpose |
|---------|----------|---------|
| GitHub/GitLab | Yes | Repository access |
| OpenAI API | Yes (or Anthropic) | LLM analysis |
| Anthropic API | Yes (or OpenAI) | LLM analysis |

---

## Deployment

### Docker Compose (Recommended)

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/debt_os
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: pgvector/pgvector:pg16
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=debt_os
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=debt_os
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U debt_os"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### Deployment Steps

```bash
# 1. Clone repository
git clone https://github.com/debt-os/debt-os.git
cd debt-os

# 2. Create production environment file
cp apps/api/.env.example apps/api/.env.production
# Edit with production values

# 3. Build and start services
docker-compose -f docker-compose.prod.yml up -d

# 4. Run migrations
docker-compose exec api npm run db:migrate

# 5. Verify deployment
curl http://localhost:3001/api/health
```

### Kubernetes Deployment

For Kubernetes deployments, key considerations:

```yaml
# deployment.yaml (simplified)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: debt-os-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: debt-os-api
  template:
    spec:
      containers:
        - name: api
          image: debt-os/api:latest
          ports:
            - containerPort: 3001
          envFrom:
            - secretRef:
                name: debt-os-secrets
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
```

---

## Environment Configuration

### Required Variables

```env
# ===================
# CORE CONFIGURATION
# ===================

# Server
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@host:5432/debt_os
# Or individual variables:
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=debt_os
DB_PASSWORD=<secure-password>
DB_DATABASE=debt_os
DB_SSL=true

# Redis
REDIS_URL=redis://localhost:6379
# Or individual variables:
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<optional-password>

# ===================
# AUTHENTICATION
# ===================

# JWT
JWT_SECRET=<64-character-random-string>
JWT_EXPIRES_IN=7d

# GitHub OAuth
GITHUB_CLIENT_ID=<oauth-app-id>
GITHUB_CLIENT_SECRET=<oauth-app-secret>
GITHUB_CALLBACK_URL=https://your-domain.com/api/auth/github/callback

# GitLab OAuth (optional)
GITLAB_CLIENT_ID=<oauth-app-id>
GITLAB_CLIENT_SECRET=<oauth-app-secret>
GITLAB_CALLBACK_URL=https://your-domain.com/api/auth/gitlab/callback

# ===================
# LLM PROVIDERS
# ===================

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# ===================
# STORAGE
# ===================

REPO_STORAGE_PATH=/var/lib/debt-os/repos

# ===================
# CORS & SECURITY
# ===================

CORS_ORIGIN=https://your-frontend-domain.com
```

### Secrets Management

**Best Practices**:
- Use secrets manager (AWS Secrets Manager, HashiCorp Vault, K8s Secrets)
- Never commit secrets to version control
- Rotate secrets regularly (especially API keys)
- Use different secrets per environment

---

## Infrastructure Components

### PostgreSQL

**Setup with pgvector**:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Performance Tuning**:

```ini
# postgresql.conf recommendations for DEBT-OS

# Memory
shared_buffers = 256MB           # 25% of RAM for dedicated server
effective_cache_size = 768MB     # 75% of RAM
work_mem = 16MB
maintenance_work_mem = 128MB

# Connections
max_connections = 100

# Checkpoints
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# pgvector specific
max_parallel_workers_per_gather = 4
```

**Backup Schedule**:

```bash
# Daily backup
0 2 * * * pg_dump -U debt_os debt_os | gzip > /backups/debt_os_$(date +\%Y\%m\%d).sql.gz

# Retention: keep 7 daily, 4 weekly
find /backups -name "*.sql.gz" -mtime +7 -delete
```

### Redis

**Configuration**:

```conf
# redis.conf recommendations

# Persistence
appendonly yes
appendfsync everysec

# Memory
maxmemory 512mb
maxmemory-policy allkeys-lru

# Security
requirepass <password>
```

**Monitoring Commands**:

```bash
# Check memory usage
redis-cli INFO memory

# Check queue lengths
redis-cli LLEN bull:scan:wait
redis-cli LLEN bull:scan:active

# Check connected clients
redis-cli CLIENT LIST
```

---

## Monitoring

### Health Checks

| Endpoint | Method | Expected Response |
|----------|--------|-------------------|
| `/api/health` | GET | `{ "status": "ok" }` |
| `/api/health/db` | GET | Database connectivity |
| `/api/health/redis` | GET | Redis connectivity |

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| **API Response Time** | P95 latency | > 2000ms |
| **Error Rate** | 5xx errors / total | > 1% |
| **Queue Depth** | Pending jobs | > 100 |
| **Queue Latency** | Time job waits | > 5 min |
| **Database Connections** | Active connections | > 80% of max |
| **Memory Usage** | Application memory | > 80% |
| **LLM Token Usage** | Daily tokens | Approaching quota |

### Logging

**Log Format** (JSON):

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Scan completed",
  "context": {
    "scanId": "uuid",
    "repositoryId": "uuid",
    "duration": 45000,
    "findingsCount": 12
  }
}
```

**Log Levels**:
- `error`: Failures requiring attention
- `warn`: Potential issues
- `info`: Normal operations
- `debug`: Detailed debugging (not in production)

**Log Aggregation**:
- Use ELK Stack, Datadog, or CloudWatch
- Set up log rotation (max 7 days, 1GB per file)

### Alerting Rules

```yaml
# Example Prometheus rules
groups:
  - name: debt-os
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: QueueBacklog
        expr: bull_queue_waiting > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Queue backlog growing"

      - alert: DatabaseConnectionsHigh
        expr: pg_stat_activity_count > 80
        for: 5m
        labels:
          severity: warning
```

---

## Maintenance

### Database Maintenance

**Daily**:
```sql
-- Analyze for query optimization
ANALYZE;
```

**Weekly**:
```sql
-- Update statistics
VACUUM ANALYZE;

-- Reindex if needed
REINDEX DATABASE debt_os;
```

**Monthly**:
```sql
-- Full vacuum (requires downtime or replica)
VACUUM FULL;

-- Rebuild pgvector indexes
REINDEX INDEX CONCURRENTLY idx_file_embeddings_embedding;
```

### Queue Maintenance

```bash
# Clear completed jobs (older than 7 days)
redis-cli EVAL "
  local keys = redis.call('keys', 'bull:*:completed')
  for i, key in ipairs(keys) do
    redis.call('zremrangebyscore', key, '-inf', os.time() - 604800)
  end
" 0

# Clear failed jobs (review first!)
redis-cli EVAL "
  local keys = redis.call('keys', 'bull:*:failed')
  for i, key in ipairs(keys) do
    redis.call('zremrangebyscore', key, '-inf', os.time() - 2592000)
  end
" 0
```

### Upgrade Procedures

1. **Prepare**:
   - Review changelog for breaking changes
   - Backup database
   - Test upgrade in staging

2. **Execute**:
   ```bash
   # Pull new version
   docker pull debt-os/api:vX.Y.Z

   # Stop current
   docker-compose stop api

   # Run migrations
   docker-compose run api npm run db:migrate

   # Start new version
   docker-compose up -d api
   ```

3. **Verify**:
   - Check health endpoint
   - Review logs for errors
   - Test key functionality

4. **Rollback** (if needed):
   ```bash
   docker-compose stop api
   docker-compose run api npm run db:revert
   docker tag debt-os/api:vPrevious debt-os/api:latest
   docker-compose up -d api
   ```

---

## Backup & Recovery

### Backup Strategy

| Data | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Database | Daily | 30 days | pg_dump |
| Redis | Hourly | 7 days | RDB snapshot |
| Configs | On change | Indefinite | Git |
| Repo clones | N/A | Ephemeral | Re-clone on demand |

### Recovery Procedures

**Database Recovery**:

```bash
# Stop application
docker-compose stop api

# Restore from backup
gunzip < backup_20240115.sql.gz | psql -U debt_os debt_os

# Run any pending migrations
docker-compose run api npm run db:migrate

# Restart application
docker-compose up -d api
```

**Full Disaster Recovery**:

1. Provision new infrastructure
2. Restore database from backup
3. Deploy application containers
4. Update DNS/load balancer
5. Verify connectivity and data integrity

### RTO/RPO Targets

| Scenario | RTO | RPO |
|----------|-----|-----|
| Single service failure | 5 min | 0 |
| Database corruption | 30 min | 1 hour |
| Complete infrastructure loss | 4 hours | 24 hours |

---

## Security Operations

### API Key Management

**Rotation Procedure**:

1. Generate new API key for user
2. User updates applications with new key
3. Revoke old key after confirmation

**Revocation**:
```sql
-- Immediate revocation
UPDATE api_keys SET revoked_at = NOW() WHERE key_prefix = 'xxx';
```

### Audit Logging

Track these events:
- Authentication attempts (success/failure)
- Repository connections
- Scan triggers
- Settings changes
- API key operations

### Security Checklist

- [ ] HTTPS enforced (TLS 1.2+)
- [ ] API rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] CORS properly configured
- [ ] Secrets not in logs
- [ ] Dependencies regularly updated
- [ ] Security headers configured

---

## Troubleshooting

### Common Issues

#### API Won't Start

```bash
# Check logs
docker-compose logs api

# Common causes:
# - Database not ready: Wait for postgres health check
# - Missing env vars: Verify all required vars set
# - Port conflict: Change PORT or stop conflicting service
```

#### Scans Stuck in Queue

```bash
# Check queue status
docker-compose exec api npm run queue:status

# Check worker logs
docker-compose logs api | grep -i "queue\|worker\|job"

# Clear stuck job (use with caution)
redis-cli LREM bull:scan:active 0 "<job-id>"
```

#### Database Connection Issues

```bash
# Test connection
docker-compose exec postgres psql -U debt_os -c "SELECT 1"

# Check max connections
docker-compose exec postgres psql -U debt_os -c "SHOW max_connections"
docker-compose exec postgres psql -U debt_os -c "SELECT count(*) FROM pg_stat_activity"
```

#### High Memory Usage

```bash
# Check Node.js memory
docker stats debt-os-api

# Increase limit if needed
# In docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 4G
```

#### LLM Rate Limits

- Reduce batch size in scan settings
- Add delays between requests
- Check API quota on provider dashboard
- Consider using multiple API keys

### Debug Mode

Enable verbose logging:

```env
LOG_LEVEL=debug
```

Inspect specific components:
```bash
# Database queries
docker-compose exec api npm run db:log

# Redis commands
redis-cli MONITOR
```

---

## Related Documentation

- [Architecture](../technical/ARCHITECTURE.md) - System design
- [Developer Guide](../technical/DEVELOPER_GUIDE.md) - Development setup
- [Management Overview](../management/MANAGEMENT_OVERVIEW.md) - KPIs and planning
