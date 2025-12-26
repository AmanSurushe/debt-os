---
name: operations-advisor
description: Provides operations perspective on implementation. Evaluates deployment complexity, monitoring requirements, security implications, and operational overhead. Use when making infrastructure decisions, adding integrations, planning deployments, or implementing features with operational impact.
allowed-tools: Read, Grep, Glob
---

# Operations Advisor

## Purpose

This skill ensures features are operationally sound and maintainable. Claude should consider operations implications when implementing features that affect infrastructure, security, or system reliability.

## When to Activate

Claude should consider this perspective when:
- Adding new infrastructure components
- Implementing external integrations
- Making decisions with security implications
- Adding features that affect system performance
- Planning deployment or scaling strategies

## Key Operations Principles

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 50 GB SSD | 200+ GB SSD |

### Infrastructure Stack

- **Runtime**: Node.js 20+, Docker 24+
- **Database**: PostgreSQL 16 + pgvector
- **Queue**: BullMQ + Redis 7
- **Deployment**: Docker Compose or Kubernetes

### Key Monitoring Metrics

| Metric | Alert Threshold |
|--------|-----------------|
| API Response Time (P95) | > 2000ms |
| Error Rate (5xx) | > 1% |
| Queue Depth | > 100 pending |
| Queue Latency | > 5 min |
| Database Connections | > 80% of max |
| Memory Usage | > 80% |

### Security Checklist

- [ ] HTTPS enforced (TLS 1.2+)
- [ ] API rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] Secrets not in logs or code
- [ ] CORS properly configured

### Environment Configuration

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - 64-character random string
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` - LLM access
- `GITHUB_CLIENT_ID/SECRET` - OAuth integration

### Backup Strategy

| Data | Frequency | Retention |
|------|-----------|-----------|
| Database | Daily | 30 days |
| Redis | Hourly | 7 days |
| Configs | On change | Indefinite |

### RTO/RPO Targets

| Scenario | RTO | RPO |
|----------|-----|-----|
| Single service failure | 5 min | 0 |
| Database corruption | 30 min | 1 hour |
| Complete infrastructure loss | 4 hours | 24 hours |

### Common Troubleshooting

**Scans stuck in queue**:
- Check worker logs
- Verify Redis connectivity
- Check for stuck jobs in `bull:scan:active`

**High memory usage**:
- Check Node.js memory with `docker stats`
- Consider increasing container limits
- Review for memory leaks

**LLM rate limits**:
- Reduce batch size
- Add delays between requests
- Consider multiple API keys

## Questions to Ask

When implementing features:
- How will this be deployed and scaled?
- What monitoring/alerting is needed?
- Are there security implications?
- What's the operational overhead?
- How do we handle failures gracefully?

## Reference

See [docs/operations/OPERATIONS_GUIDE.md](../../../docs/operations/OPERATIONS_GUIDE.md) for complete documentation.
