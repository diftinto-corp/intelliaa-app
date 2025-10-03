# INTEL-004 Implementation Checklist

**Feature**: Create Document Storage with PDF
**Plan Document**: `backend_architecture_plan.md`
**Status**: Ready for Implementation

---

## Quick Start Guide

### Prerequisites
- [x] INTEL-001 (Embedding Service) - Completed
- [x] INTEL-002 (VAPI KB Service) - Completed
- [x] INTEL-003 (Pinecone Service) - Completed
- [ ] Review backend_architecture_plan.md (Line 1-1800+)

### Implementation Order

**Phase 1: Database Setup** (30 mins)
- [ ] Create migration file: `supabase/migrations/20251002_create_document_storage_transaction.sql`
- [ ] Copy function from plan (Section: File 3, Lines 600-750)
- [ ] Apply migration locally: `supabase db reset`
- [ ] Test function manually: `SELECT create_document_storage_with_pdf(...)`

**Phase 2: Validation Layer** (1 hour)
- [ ] Create: `src/lib/actions/intelliaa/documentStorageValidation.ts`
- [ ] Copy from plan (Section: File 4, Lines 850-1050)
- [ ] Implement: `validateFile()`, `generateUniqueNamespace()`, `validateAccountAccess()`
- [ ] Write unit tests for validation logic

**Phase 3: Error Handling** (45 mins)
- [ ] Create: `src/lib/actions/intelliaa/documentStorageErrors.ts`
- [ ] Copy from plan (Section: File 5, Lines 1100-1300)
- [ ] Implement custom error classes: `TimeoutError`, `PineconeError`, `VapiError`, etc.
- [ ] Implement: `handleError()` function

**Phase 4: Rollback Mechanism** (1.5 hours)
- [ ] Create: `src/lib/actions/intelliaa/documentStorageRollback.ts`
- [ ] Copy from plan (Section: File 2, Lines 450-600)
- [ ] Implement: `executeRollback()` with 4-phase cleanup
- [ ] Test rollback with mocked service failures

**Phase 5: VAPI KB Helper** (30 mins)
- [ ] Modify: `src/lib/actions/intelliaa/documents.ts`
- [ ] Add: `getOrCreateVapiKB()` function (Section: File 6, Lines 1350-1450)
- [ ] Test helper with existing KB and new KB scenarios

**Phase 6: Main Server Action** (2 hours)
- [ ] Modify: `src/lib/actions/intelliaa/documents.ts`
- [ ] Add: `createDocumentStorageWithPDF()` function (Section: File 1, Lines 100-450)
- [ ] Implement 7-phase orchestration
- [ ] Add export at top of file
- [ ] Test happy path with real services

**Phase 7: Testing** (3 hours)
- [ ] Create: `src/lib/actions/intelliaa/__tests__/documentStorageWithPDF.test.ts`
- [ ] Implement 15+ unit tests (validation, namespace, rollback, timeout)
- [ ] Create: `src/lib/actions/intelliaa/__tests__/documentStorageIntegration.test.ts`
- [ ] Implement integration tests with real services
- [ ] Execute manual testing checklist (14 points)

**Phase 8: Documentation & Deployment** (1 hour)
- [ ] Update API documentation
- [ ] Create deployment runbook
- [ ] Test migration in staging
- [ ] Deploy to production
- [ ] Monitor for issues

---

## Critical Code Snippets

### Server Action Signature
```typescript
// Add to src/lib/actions/intelliaa/documents.ts
export async function createDocumentStorageWithPDF(
  accountId: string,
  input: CreateDocumentStorageInput
): Promise<CreateDocumentStorageResult>
```

### Namespace Generation (AC7)
```typescript
// Cryptographically secure unique namespace
export function generateUniqueNamespace(name: string): string {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
  const randomBytes = crypto.randomBytes(4);
  const randomSuffix = randomBytes.toString('hex').substring(0, 6);
  return `${sanitized}-${randomSuffix}`;
}
```

### Rollback State Tracking
```typescript
interface RollbackState {
  namespace: string | null;
  vapiFileId: string | null;
  vapiKbId: string | null;
  vapiKbCreatedNew: boolean;
  documentStorageId: string | null;
}
```

### Timeout Enforcement
```typescript
const abortController = new AbortController();
const timeoutId = setTimeout(() => abortController.abort(), 5 * 60 * 1000);

// Pass to embedding service
await generateEmbeddings(buffer, {
  abortSignal: abortController.signal,
  // ...
});
```

---

## Testing Quick Reference

### Unit Test Commands
```bash
# Run all document storage tests
npm test -- documentStorageWithPDF

# Run specific test suite
npm test -- --testNamePattern="Validation"

# Run with coverage
npm test -- --coverage documentStorageWithPDF
```

### Manual Test Cases
1. **Happy Path**: 1MB PDF → Should complete in 10-20s
2. **Large File**: 50MB PDF → Should complete within 5min
3. **File Too Large**: 51MB PDF → Should reject immediately
4. **Wrong Type**: JPG file → Should reject immediately
5. **Empty File**: 0 bytes → Should reject immediately
6. **Duplicate Name**: Same name twice → Different namespaces
7. **Unauthorized**: Other account ID → Should reject
8. **Pinecone Failure**: Mock failure → Should rollback
9. **VAPI Failure**: Mock failure → Should rollback
10. **Timeout**: Mock 6min delay → Should abort

### Integration Test Setup
```bash
# Start local Supabase
supabase start

# Set test environment variables
export PINECONE_INDEX=intelliaa-test
export OPENAI_API_KEY=sk-test-...
export NEXT_PRIVATE_VAPI_KEY=test-key

# Run integration tests
npm test -- documentStorageIntegration
```

---

## Common Issues & Solutions

### Issue: Namespace collision
**Symptom**: PostgreSQL error code 23505
**Solution**: Check `generateUniqueNamespace()` uses crypto.randomBytes, not Math.random()

### Issue: Rollback doesn't delete Pinecone namespace
**Symptom**: Orphaned vectors in Pinecone
**Solution**: Verify `deleteNamespace()` is called with correct namespace string

### Issue: VAPI KB deleted on failure when it existed before
**Symptom**: Existing KB gone after failed operation
**Solution**: Check `vapiKbCreatedNew` flag is correctly set in `getOrCreateVapiKB()`

### Issue: Timeout not triggering
**Symptom**: Operation runs > 5 minutes
**Solution**: Verify AbortController signal passed to all service calls

### Issue: Database transaction fails silently
**Symptom**: No document_storages record but no error
**Solution**: Check PostgreSQL function returns RAISE EXCEPTION on error

---

## Performance Optimization Tips

### If embedding generation is too slow:
- Reduce `chunkSize` from 1500 to 1000 (fewer chunks)
- Increase `chunkOverlap` from 750 to 500 (less context)
- Consider batching multiple documents

### If Pinecone upsert is slow:
- Increase `maxConcurrent` from 5 to 10 (more parallel batches)
- Reduce `batchSize` from 100 to 50 (smaller batches, faster)

### If VAPI upload is slow:
- Check network latency to VAPI servers
- Consider CDN for file delivery
- Monitor VAPI API status

---

## Rollout Strategy

### Stage 1: Staging Environment (1 day)
- Deploy code changes
- Apply database migration
- Test with 10 sample PDFs
- Monitor logs for errors
- Verify no orphaned resources

### Stage 2: Production Canary (1 day)
- Deploy to 10% of users
- Monitor success rate
- Monitor rollback execution rate
- Check for timeout issues
- Verify RLS isolation

### Stage 3: Full Production (1 day)
- Deploy to 100% of users
- Monitor metrics dashboard
- Set up alerts for failures
- Document known issues
- Prepare hotfix if needed

---

## Monitoring & Alerts

### Key Metrics to Track
- **Success Rate**: Target > 95%
- **Rollback Rate**: Target < 5%
- **Timeout Rate**: Target < 2%
- **Average Processing Time**: Target < 60s (1MB file)
- **P95 Processing Time**: Target < 180s
- **Cost per Document**: Target < $0.01

### Alerts to Configure
- **Critical**: Rollback failure (indicates orphaned resources)
- **Warning**: Timeout rate > 5% (may need optimization)
- **Warning**: Pinecone errors > 2% (service health)
- **Info**: Success rate < 95% (investigate)

### Log Monitoring
```bash
# Search for INTEL-004 logs
grep -r "INTEL-004" /var/log/app.log

# Check for rollback errors
grep "Rollback: .*failed" /var/log/app.log

# Monitor success rate
grep "Document storage created successfully" /var/log/app.log | wc -l
```

---

## Acceptance Criteria Mapping

| AC | Description | Implementation | Test Case |
|----|-------------|----------------|-----------|
| AC1 | Successful creation flow | Phase 6 (Main Action) | Integration test 1 |
| AC2 | Loading state | Frontend (separate) | Manual test |
| AC3 | Vector storage | Phase 6 (Pinecone) | Unit test: happy path |
| AC4 | VAPI KB creation | Phase 6 (VAPI KB) | Unit test: KB linking |
| AC5 | Rollback on failure | Phase 4 (Rollback) | Unit test: rollback suite |
| AC6 | Multi-tenant isolation | Phase 2 (Validation) | Integration test 2 |
| AC7 | Namespace uniqueness | Phase 2 (Validation) | Unit test: namespace |
| AC8 | File size validation | Phase 2 (Validation) | Unit test: validation |
| AC9 | File type validation | Phase 2 (Validation) | Unit test: validation |
| AC10 | Empty file handling | Phase 2 (Validation) | Unit test: validation |

---

## Questions for Code Review

1. Is the rollback order correct? (DB → KB → File → Pinecone)
2. Are all error scenarios handled with appropriate error codes?
3. Is the namespace generation cryptographically secure?
4. Are RLS policies correctly enforced in the PostgreSQL function?
5. Is the 5-minute timeout sufficient for 50MB files?
6. Should VAPI KB creation be blocking or continue on failure?
7. Are the performance benchmarks realistic?
8. Is the logging strategy sufficient for debugging?
9. Are the unit test cases comprehensive?
10. Is the migration rollback strategy safe?

---

**Estimated Implementation Time**: 2-3 days
**Estimated Testing Time**: 1 day
**Estimated Deployment Time**: 1 day
**Total**: 4-5 days

**Last Updated**: 2025-10-02
**Maintainer**: Architecture Team
