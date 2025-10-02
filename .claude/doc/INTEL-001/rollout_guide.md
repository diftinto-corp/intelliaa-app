# INTEL-001 Rollout Guide

> Gradual deployment strategy for Vercel AI SDK Embedding Service

## Overview

This service uses a **parallel migration pattern** - it runs alongside Flowise rather than replacing it immediately. This enables:
- ✅ Zero-risk deployment
- ✅ Easy rollback (single SQL query)
- ✅ No breaking changes
- ✅ A/B testing capability
- ✅ Gradual confidence building

## Rollout Timeline (6 Weeks)

### Week 1: Deploy with Feature Flag OFF
**Goal:** Deploy code to production safely

```bash
# Ensure feature flag is disabled
NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS=false npm run build

# Deploy to production
# All accounts continue using Flowise
```

**Verification:**
- Service is deployed but not active
- No behavioral changes for users
- Monitor logs for any startup errors

### Week 2: Enable for Test Accounts
**Goal:** Validate service works in production

```sql
-- Enable for specific test accounts
UPDATE accounts SET use_vercel_embeddings = true
WHERE email IN (
  'test@intelliaa.com',
  'admin@intelliaa.com',
  'qa@intelliaa.com'
);
```

**Testing Checklist:**
- [ ] Upload small PDF (< 10 pages)
- [ ] Upload medium PDF (20-50 pages)
- [ ] Upload large PDF (100+ pages)
- [ ] Verify embeddings in database
- [ ] Check cost tracking in `embedding_usage` table
- [ ] Confirm no errors in logs

**Monitoring:**
```sql
-- Check test account usage
SELECT
  account_id,
  COUNT(*) as documents_processed,
  SUM(estimated_cost) as total_cost,
  AVG(processing_time) as avg_time_ms
FROM embedding_usage
WHERE service = 'vercel'
GROUP BY account_id;
```

### Week 3: 10% Rollout
**Goal:** Validate at scale with real users

```sql
-- Enable for 10% of accounts
UPDATE feature_flags
SET enabled_percentage = 10
WHERE feature_name = 'vercel_embeddings';
```

**Monitoring (Daily):**
- Error rates (should be < 1%)
- Processing times (should be 10-30% faster than Flowise)
- Cost per document (should match estimates)
- User complaints (should be zero)

**Key Metrics:**
```sql
-- Compare Vercel vs Flowise performance
SELECT
  service,
  COUNT(*) as total_docs,
  AVG(processing_time) as avg_time_ms,
  AVG(estimated_cost) as avg_cost,
  AVG(chunk_count) as avg_chunks
FROM embedding_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY service;
```

**Decision Point:**
- ✅ If error rate < 1% → Proceed to 50%
- ⚠️ If error rate 1-5% → Investigate issues, stay at 10%
- ❌ If error rate > 5% → Rollback to 0%

### Week 4: 50% Rollout
**Goal:** Majority adoption with monitoring

```sql
-- Enable for 50% of accounts
UPDATE feature_flags
SET enabled_percentage = 50
WHERE feature_name = 'vercel_embeddings';
```

**Monitoring (Twice Daily):**
- All Week 3 metrics
- Cost comparison vs Flowise
- Any degraded performance patterns
- Support tickets mentioning documents

**Cost Analysis:**
```sql
-- Monthly cost projection
SELECT
  service,
  SUM(estimated_cost) as total_cost,
  COUNT(DISTINCT account_id) as unique_accounts,
  SUM(estimated_cost) / COUNT(DISTINCT account_id) as cost_per_account
FROM embedding_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY service;
```

### Week 5-6: 100% Rollout
**Goal:** Full migration

```sql
-- Enable for 100% of accounts
UPDATE feature_flags
SET enabled_percentage = 100
WHERE feature_name = 'vercel_embeddings';
```

**Monitoring (First Week Daily, Then Weekly):**
- Continued monitoring of all metrics
- Watch for any edge cases
- Document any issues and resolutions

**Success Criteria:**
- [ ] Error rate < 0.5%
- [ ] Processing time 10-30% faster than Flowise
- [ ] Zero critical bugs
- [ ] Cost within expected range
- [ ] No support tickets about document processing

### Week 7+: Maintenance & Flowise Deprecation

**Optional Flowise Deprecation:**
```sql
-- After 1-2 months at 100%, consider deprecating Flowise
-- Keep feature flag infrastructure for future use
```

**Keep monitoring:**
- Monthly cost trends
- Processing time trends
- Error patterns

## Emergency Rollback Procedures

### Immediate Rollback (0% - All Accounts to Flowise)

```sql
-- Single query to rollback instantly
UPDATE feature_flags
SET enabled_percentage = 0
WHERE feature_name = 'vercel_embeddings';

-- Verify rollback
SELECT * FROM feature_flags WHERE feature_name = 'vercel_embeddings';
```

**Zero data loss** - Both services write to same tables.

### Partial Rollback (Specific Accounts)

```sql
-- Disable for problematic account
UPDATE accounts
SET use_vercel_embeddings = false
WHERE id = 'problem-account-uuid';

-- Or add to blacklist
UPDATE feature_flags
SET disabled_accounts = array_append(disabled_accounts, 'problem-account-uuid')
WHERE feature_name = 'vercel_embeddings';
```

### Rollback Triggers

Immediate rollback if:
- ❌ Error rate > 10% for any account
- ❌ Critical data loss or corruption
- ❌ OpenAI API outage > 1 hour
- ❌ Costs 3x higher than expected

Investigate and consider rollback if:
- ⚠️ Error rate 5-10% sustained
- ⚠️ Processing time 2x slower than Flowise
- ⚠️ Multiple support tickets about documents

## Monitoring Queries

### Real-Time Health Check

```sql
-- Last 1 hour error rate
SELECT
  COUNT(*) FILTER (WHERE embedding_metadata->>'fallback' = 'true') * 100.0 /
  COUNT(*) as error_rate_percent,
  COUNT(*) as total_attempts
FROM pdf_docs
WHERE created_at >= NOW() - INTERVAL '1 hour'
  AND embedding_service = 'vercel';
```

### Daily Summary

```sql
-- Daily usage summary
SELECT
  DATE(created_at) as date,
  service,
  COUNT(*) as documents,
  SUM(estimated_cost) as total_cost,
  AVG(processing_time) as avg_time_ms,
  MAX(processing_time) as max_time_ms
FROM embedding_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), service
ORDER BY date DESC, service;
```

### Account-Level Analysis

```sql
-- Top 10 accounts by usage
SELECT
  a.id,
  a.name,
  COUNT(*) as documents,
  SUM(eu.estimated_cost) as total_cost,
  a.use_vercel_embeddings as using_vercel
FROM embedding_usage eu
JOIN accounts a ON eu.account_id = a.id
WHERE eu.created_at >= NOW() - INTERVAL '30 days'
GROUP BY a.id, a.name, a.use_vercel_embeddings
ORDER BY documents DESC
LIMIT 10;
```

## Success Metrics

### Week 2 (Test Accounts)
- [ ] 100% success rate on test uploads
- [ ] Processing time < 5s for small PDFs
- [ ] Cost < $0.001 per small PDF

### Week 3 (10% Rollout)
- [ ] Error rate < 1%
- [ ] No user complaints
- [ ] Performance better than or equal to Flowise

### Week 4 (50% Rollout)
- [ ] Error rate < 0.5%
- [ ] Cost within 10% of projections
- [ ] Processing time 10-30% faster than Flowise

### Week 5-6 (100% Rollout)
- [ ] Error rate < 0.5%
- [ ] Zero critical bugs
- [ ] All features working as expected
- [ ] Documentation complete

## Communication Plan

### Internal Team
- Week 1: Notify team of deployment
- Week 2: Share test results
- Week 3: Weekly update on 10% rollout
- Week 4: Weekly update on 50% rollout
- Week 5: Announce 100% rollout
- Week 7+: Final report and retrospective

### Support Team
- Provide troubleshooting guide
- Document common issues
- Create support macros for common questions

### Users
- No communication needed (transparent migration)
- Only communicate if issues arise

## Contingency Plans

### OpenAI API Outage
- Automatic fallback to Flowise
- Monitor OpenAI status page
- Consider temporary rollback if extended outage

### Cost Overrun
- Set up alerts for accounts exceeding $50/month
- Investigate high-usage accounts
- Consider implementing rate limits

### Performance Degradation
- Analyze slow documents
- Check for OpenAI API latency
- Consider increasing timeout values

## Post-Rollout

### Week 8: Retrospective
- Review all metrics
- Document lessons learned
- Identify improvements for future migrations
- Update runbooks

### Ongoing Maintenance
- Monitor monthly costs
- Track error trends
- Update documentation
- Plan for INTEL-003 (Pinecone integration)

## Contact

For rollout questions or issues:
- Technical: See `.claude/sessions/context_session_INTEL-001.md`
- User Story: `.claude/user_histories/INTEL-001-vercel-ai-sdk-embedding-service.md`
- Testing: `.claude/doc/INTEL-001/testing_implementation_plan.md`
