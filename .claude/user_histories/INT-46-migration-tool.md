# INT-46: Create Migration Tool from Railway/Buildship to Evolution API

**Epic**: INT-43 - WhatsApp Evolution API Migration
**Priority**: P1 - Should Have
**Estimate**: 5-8 points (Large)
**Labels**: backend, migration, tooling

## User Story

As a platform administrator, I want an automated migration tool to transition existing WhatsApp assistants from Railway/Buildship to Evolution API, so that we can migrate all assistants with zero downtime and minimal user disruption.

## Acceptance Criteria

### AC1: Migration Pre-flight Check
**Given** I initiate migration for an assistant
**When** pre-flight check runs
**Then** system validates: assistant exists, has Railway config, Evolution API is available, and displays migration plan

### AC2: Configuration Preservation
**Given** an assistant with Railway configuration (prompt, temperature, documents)
**When** migration executes
**Then** all configuration transfers exactly to Evolution API setup with 100% data fidelity

### AC3: Zero-Downtime Migration
**Given** an active WhatsApp assistant serving users
**When** migration runs
**Then** assistant continues responding during migration, with <30s of potential delay during cutover

### AC4: Rollback on Failure
**Given** migration encounters an error
**When** failure is detected
**Then** system automatically rolls back to Railway, restores previous state, and alerts administrator

### AC5: Migration Dashboard
**Given** multiple assistants being migrated
**When** viewing admin dashboard
**Then** I see: total assistants, migration progress per assistant, success/failure status, logs

### AC6: Post-Migration Verification
**Given** migration completes successfully
**When** verification runs
**Then** system confirms: Evolution API instance connected, test message sent/received successfully, configuration matches original

### AC7: Bulk Migration Support
**Given** I want to migrate all assistants at once
**When** initiating bulk migration
**Then** system processes assistants in batches of 10, with 30-second delays between batches

## Technical Notes

### Migration Script Architecture
```typescript
// src/scripts/migrate-whatsapp-to-evolution.ts
import { createClient } from '@/lib/supabase/server';
import { EvolutionApiService } from '@/services/evolutionApiService';

interface MigrationResult {
  assistantId: string;
  status: 'success' | 'failed' | 'rolled_back';
  previousConfig: any;
  newConfig: any;
  error?: string;
}

export async function migrateAssistant(assistantId: string): Promise<MigrationResult> {
  const supabase = await createClient();
  const evolution = new EvolutionApiService();

  try {
    // 1. Pre-flight check
    const assistant = await getAssistant(assistantId);
    validateMigrationEligibility(assistant);

    // 2. Store rollback data
    const rollbackData = {
      service_id_rw: assistant.service_id_rw,
      qr_url: assistant.qr_url,
      activated_whatsApp: assistant.activated_whatsApp,
    };

    // 3. Create Evolution API instance
    const instanceName = `wa_${assistant.account_id}_${assistant.namespace}`;
    const instance = await evolution.createInstance(instanceName);

    // 4. Get QR code
    const qrData = await evolution.getQRCode(instanceName);

    // 5. Update assistant configuration
    await supabase
      .from('assistants')
      .update({
        evolution_instance_id: instance.instanceId,
        evolution_instance_name: instanceName,
        evolution_qr_code: qrData.qrCode,
        evolution_status: 'connecting',
        // Keep Railway config for rollback
        migration_rollback_data: rollbackData,
        migrated_to_evolution: true,
        migrated_at: new Date().toISOString(),
      })
      .eq('id', assistantId);

    // 6. Wait for WhatsApp connection (timeout 5 minutes)
    const connected = await waitForConnection(instanceName, 300000);

    if (!connected) {
      throw new Error('WhatsApp connection timeout');
    }

    // 7. Verify with test message
    await sendTestMessage(instanceName);

    // 8. Deactivate Railway instance (after successful verification)
    await deactivateRailwayInstance(assistant.service_id_rw);

    return {
      assistantId,
      status: 'success',
      previousConfig: rollbackData,
      newConfig: { instanceName, instanceId: instance.instanceId },
    };
  } catch (error) {
    // Rollback on failure
    await rollbackMigration(assistantId);
    
    return {
      assistantId,
      status: 'failed',
      error: error.message,
    };
  }
}

async function rollbackMigration(assistantId: string) {
  const supabase = await createClient();
  const evolution = new EvolutionApiService();

  // Get rollback data
  const { data: assistant } = await supabase
    .from('assistants')
    .select('migration_rollback_data, evolution_instance_name')
    .eq('id', assistantId)
    .single();

  // Delete Evolution instance
  if (assistant.evolution_instance_name) {
    await evolution.deleteInstance(assistant.evolution_instance_name);
  }

  // Restore Railway config
  await supabase
    .from('assistants')
    .update({
      ...assistant.migration_rollback_data,
      evolution_instance_id: null,
      evolution_instance_name: null,
      evolution_qr_code: null,
      evolution_status: null,
      migrated_to_evolution: false,
    })
    .eq('id', assistantId);
}

async function waitForConnection(instanceName: string, timeout: number): Promise<boolean> {
  const evolution = new EvolutionApiService();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await evolution.getInstanceStatus(instanceName);
    if (status.state === 'open') {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Check every 5 seconds
  }

  return false;
}
```

### Bulk Migration
```typescript
export async function migrateBulk(assistantIds?: string[]) {
  const supabase = await createClient();

  // Get all Railway assistants if no IDs provided
  if (!assistantIds) {
    const { data } = await supabase
      .from('assistants')
      .select('id')
      .not('service_id_rw', 'is', null)
      .is('migrated_to_evolution', null);
    
    assistantIds = data.map((a) => a.id);
  }

  const results: MigrationResult[] = [];
  const batchSize = 10;

  // Process in batches
  for (let i = 0; i < assistantIds.length; i += batchSize) {
    const batch = assistantIds.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map((id) => migrateAssistant(id))
    );

    results.push(...batchResults);

    // Update dashboard
    await updateMigrationDashboard(results);

    // Delay between batches
    if (i + batchSize < assistantIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }

  return results;
}
```

### Migration Dashboard Component
```typescript
// src/components/admin/MigrationDashboard.tsx
export function MigrationDashboard() {
  const [migrations, setMigrations] = useState<MigrationResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const stats = useMemo(() => ({
    total: migrations.length,
    success: migrations.filter((m) => m.status === 'success').length,
    failed: migrations.filter((m) => m.status === 'failed').length,
    rolledBack: migrations.filter((m) => m.status === 'rolled_back').length,
  }), [migrations]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Success" value={stats.success} className="text-green-600" />
        <StatCard label="Failed" value={stats.failed} className="text-red-600" />
        <StatCard label="Rolled Back" value={stats.rolledBack} className="text-yellow-600" />
      </div>

      <div className="flex gap-4">
        <Button
          onClick={startMigration}
          disabled={isRunning}
        >
          {isRunning ? 'Migration Running...' : 'Start Migration'}
        </Button>
        <Button variant="outline" onClick={downloadLogs}>
          Download Logs
        </Button>
      </div>

      <DataTable
        columns={migrationColumns}
        data={migrations}
      />
    </div>
  );
}
```

### Database Schema
```sql
ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS migrated_to_evolution BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS migration_rollback_data JSONB;

CREATE TABLE migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID REFERENCES assistants(id),
  migration_type VARCHAR(50), -- 'railway_to_evolution'
  status VARCHAR(20),
  error_message TEXT,
  previous_config JSONB,
  new_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Definition of Done

- [ ] Migration script created with rollback capability
- [ ] Pre-flight validation implemented
- [ ] Configuration preservation verified (100% fidelity)
- [ ] Zero-downtime migration tested
- [ ] Automatic rollback on failure working
- [ ] Migration dashboard UI created
- [ ] Post-migration verification implemented
- [ ] Bulk migration with batching functional
- [ ] Test migration completed on staging with 20+ assistants
- [ ] Migration logs captured and downloadable
- [ ] Documentation created for migration process
- [ ] Runbook created for troubleshooting
- [ ] Code reviewed and approved

## Dependencies

- **Requires**: INT-44 (Evolution API integration)
- **Requires**: INT-45 (Vercel AI SDK for message handling)
- Railway API access for deactivation
- Admin dashboard infrastructure

## Related Stories

- **Depends on**: INT-44, INT-45
- **Completes**: Railway/Buildship sunset
- **Enables**: Cost reduction and performance improvement
