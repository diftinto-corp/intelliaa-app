# INT-40: Migrate VAPI Configuration to Latest API Version

**Epic**: INT-39 - Voice Assistant VAPI Integration Modernization
**Priority**: P0 - Must Have
**Estimate**: 8-13 points (XL)
**Labels**: backend, migration, vapi, voice

## User Story

As a platform administrator, I want to automatically migrate all existing voice assistants to the latest VAPI API version, so that we can leverage new features and ensure continued compatibility.

## Acceptance Criteria

### AC1: API Version Detection
**Given** an existing voice assistant configuration
**When** the migration script analyzes the assistant
**Then** it correctly identifies the current VAPI API version in use

### AC2: Configuration Mapping
**Given** a voice assistant using deprecated VAPI fields
**When** migrating to the new API
**Then** all configuration maps correctly to new field names/structure with zero data loss

### AC3: Backward Compatibility Mode
**Given** a migration is in progress
**When** an assistant is being accessed
**Then** the system reads from both old and new config fields to ensure zero downtime

### AC4: Rollback Capability
**Given** a migration fails or causes issues
**When** rollback is triggered
**Then** all assistants revert to previous VAPI configuration within 5 minutes

### AC5: Migration Progress Dashboard
**Given** migration is running
**When** viewing the admin dashboard
**Then** I see: total assistants, migrated count, failed count, estimated completion time

### AC6: Failed Migration Alerts
**Given** an assistant migration fails
**When** the failure occurs
**Then** system logs detailed error, alerts admin via email, and continues with next assistant

### AC7: Validation Testing
**Given** all assistants are migrated
**When** validation runs
**Then** 100% of assistants pass VAPI API validation and can make/receive test calls

## Technical Notes

### VAPI API Changes (v1 → v2)
```typescript
// Old VAPI v1 structure
interface VAPIv1Config {
  voiceId: string;
  voice: string;
  voiceSpeed: number;
  firstMessage: string;
  systemPrompt: string;
  model: 'gpt-3.5-turbo' | 'gpt-4';
  temperature: number;
}

// New VAPI v2 structure
interface VAPIv2Config {
  voice: {
    provider: 'elevenlabs' | '11labs' | 'azure';
    voiceId: string;
    speed?: number;
    stability?: number;
    clarity?: number;
  };
  model: {
    provider: 'openai' | 'anthropic';
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt: string;
  };
  firstMessage?: string;
  endCallMessage?: string;
  voicemailMessage?: string;
}
```

### Migration Script
```typescript
// src/scripts/migrate-vapi-v1-to-v2.ts
export async function migrateVAPIConfiguration() {
  const supabase = createClient();
  
  // Get all voice assistants with old config
  const { data: assistants } = await supabase
    .from('voice_assistant')
    .select('*')
    .is('vapi_v2_config', null);

  const results = {
    total: assistants.length,
    migrated: 0,
    failed: 0,
    errors: [],
  };

  for (const assistant of assistants) {
    try {
      const v2Config = mapV1ToV2(assistant);
      
      // Validate with VAPI API
      await validateVAPIConfig(v2Config);

      // Update database with new config (keep old for rollback)
      await supabase
        .from('voice_assistant')
        .update({
          vapi_v2_config: v2Config,
          vapi_migration_date: new Date().toISOString(),
          vapi_version: 'v2',
        })
        .eq('id', assistant.id);

      results.migrated++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        assistant_id: assistant.id,
        error: error.message,
      });
      
      // Alert admin
      await sendMigrationErrorAlert(assistant.id, error);
    }

    // Update progress
    await updateMigrationProgress(results);
  }

  return results;
}

function mapV1ToV2(v1Assistant: any): VAPIv2Config {
  return {
    voice: {
      provider: 'elevenlabs',
      voiceId: v1Assistant.voiceId || v1Assistant.voice,
      speed: v1Assistant.voiceSpeed,
    },
    model: {
      provider: 'openai',
      model: v1Assistant.model || 'gpt-3.5-turbo',
      temperature: v1Assistant.temperature,
      systemPrompt: v1Assistant.systemPrompt,
    },
    firstMessage: v1Assistant.firstMessage,
  };
}
```

### Database Schema Changes
```sql
-- Add v2 config columns to voice_assistant table
ALTER TABLE voice_assistant 
  ADD COLUMN IF NOT EXISTS vapi_v2_config JSONB,
  ADD COLUMN IF NOT EXISTS vapi_version VARCHAR(10) DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS vapi_migration_date TIMESTAMPTZ;

-- Create migration log table
CREATE TABLE vapi_migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID REFERENCES voice_assistant(id),
  migration_status VARCHAR(20), -- 'pending', 'success', 'failed', 'rolled_back'
  v1_config JSONB,
  v2_config JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Rollback Implementation
```typescript
export async function rollbackVAPIMigration(assistantId?: string) {
  const supabase = createClient();
  
  const query = supabase
    .from('voice_assistant')
    .update({
      vapi_v2_config: null,
      vapi_version: 'v1',
    });

  if (assistantId) {
    await query.eq('id', assistantId);
  } else {
    await query.not('vapi_v2_config', 'is', null);
  }

  // Log rollback
  await supabase.from('vapi_migration_log').insert({
    assistant_id: assistantId,
    migration_status: 'rolled_back',
  });
}
```

### Feature Flags
```typescript
// Use feature flag to gradually enable v2 API
export function getVAPIConfig(assistant: VoiceAssistant) {
  const useV2 = process.env.NEXT_PUBLIC_VAPI_V2_ENABLED === 'true';
  
  if (useV2 && assistant.vapi_v2_config) {
    return assistant.vapi_v2_config;
  }
  
  // Fallback to v1 config
  return mapAssistantToV1Config(assistant);
}
```

## Definition of Done

- [ ] Migration script created and tested
- [ ] API version detection working
- [ ] Configuration mapping validated (all fields)
- [ ] Backward compatibility implemented
- [ ] Rollback mechanism tested successfully
- [ ] Migration dashboard UI created
- [ ] Email alerts configured for failures
- [ ] Test migration completed on staging with 100+ assistants
- [ ] VAPI API validation passing for all migrated assistants
- [ ] Documentation created for migration process
- [ ] Runbook created for emergency rollback
- [ ] Code reviewed and approved
- [ ] Production migration scheduled and communicated

## Dependencies

- VAPI API v2 documentation and access
- voice_assistant table schema
- Email notification system
- Feature flag infrastructure

## Related Stories

- **Blocks**: INT-41 (Voice catalog needs v2 API)
- **Blocks**: INT-42 (Transfer rules use v2 structure)
- **Related**: INT-44 (Similar migration pattern for Evolution API)
