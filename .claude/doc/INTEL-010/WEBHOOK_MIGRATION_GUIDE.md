# Webhook Migration Guide - INTEL-010

## Overview

After applying the RLS security migrations, external webhooks that insert/update data **must use the `service_role` key** instead of the `anon` key. This is because the new RLS policies block anonymous access for security.

## Critical Changes Required

### Environment Variables

Add the service role key to your environment:

```bash
# .env.local (server-side only - NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

⚠️ **SECURITY WARNING**: The service role key bypasses ALL RLS policies. Only use it in server-side API routes, NEVER in client-side code.

## Affected Webhooks

### 1. Railway/WhatsApp Webhook (`src/app/api/railway/route.ts`)

**Current Status**: Uses client-side Supabase client (anon key) via `wsStatusActiveUtil`
**Action Required**: Update to use service_role for any database operations

**Current Implementation** (line 18):
```typescript
const response = await wsStatusActiveUtil(service.name);
```

**If `wsStatusActiveUtil` inserts/updates `report_ws`**, update it to use service_role:

```typescript
// src/lib/supabase/service-role.ts (NEW FILE)
import { createClient } from '@supabase/supabase-js';

export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-side only
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
```

Then update webhook handler:
```typescript
// src/app/api/railway/route.ts
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { status: statusRw, service } = body;

    if (statusRw === "SUCCESS") {
      const supabase = createServiceRoleClient(); // Use service_role

      // Update assistants table
      const { error } = await supabase
        .from('assistants')
        .update({
          activated_whatsApp: true,
          is_deploying_ws: false,
        })
        .eq('namespace', service.name);

      if (error) {
        console.error('Error updating assistant:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  } catch (e) {
    console.error("Internal Server Error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

### 2. VAPI Voice Webhook (inserts to `report_voice`)

**Location**: Find webhook handler that inserts voice call reports
**Action Required**: Update to use service_role client

```typescript
// Example VAPI webhook handler
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const supabase = createServiceRoleClient(); // Use service_role

    const { error } = await supabase
      .from('report_voice')
      .insert({
        account_id: payload.account_id,
        assistant_id: payload.assistant_id,
        call_id: payload.call_id,
        recording_url: payload.recording_url,
        transcript: payload.transcript,
        summary: payload.summary,
        duration: payload.duration,
        // ... other fields
      });

    if (error) {
      console.error('Error inserting voice report:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error("Webhook error:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
```

### 3. Buildship Webhook (may update `assistants`)

**Location**: Search for Buildship webhook handlers
**Action Required**: If it updates `assistants` table, use service_role

```typescript
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function POST(req: Request) {
  const supabase = createServiceRoleClient(); // Use service_role
  // ... webhook logic
}
```

## Migration Checklist

### Pre-Migration
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to environment variables
- [ ] Create `src/lib/supabase/service-role.ts` helper file
- [ ] Identify all webhook handlers that write to database
- [ ] Test webhooks on staging environment

### Migration Steps

#### Phase 1: Update Webhook Handlers (BEFORE deploying RLS migrations)
1. [ ] Update Railway webhook handler (if it writes to DB)
2. [ ] Update VAPI webhook handler (if exists)
3. [ ] Update Buildship webhook handler (if exists)
4. [ ] Deploy webhook updates to production
5. [ ] Test webhooks with real events

#### Phase 2: Deploy RLS Migrations (AFTER webhooks updated)
1. [ ] Deploy `20251004000004_fix_report_ws_rls.sql`
2. [ ] Deploy `20251004000005_fix_report_voice_rls.sql`
3. [ ] Deploy `20251004000006_fix_assistants_rls.sql`
4. [ ] Monitor webhook success rates for 24 hours

### Post-Migration Monitoring

**Key Metrics to Watch:**
- Webhook success rate (should remain >99%)
- PostgreSQL permission denied errors (error code 42501)
- Assistant activation failures
- Voice report creation failures

**Alert Thresholds:**
- If webhook failures >5% → Rollback RLS migrations
- If permission denied errors >10/hour → Check service_role implementation

## Rollback Plan

If webhooks fail after migration:

### Quick Fix
Add temporary anon policies for webhooks (not recommended for production):

```sql
-- TEMPORARY: Allow anon inserts (security risk)
CREATE POLICY "Temp anon insert for webhooks"
  ON public.report_ws
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

### Proper Rollback
Execute rollback migrations:

```bash
psql $DATABASE_URL < supabase/migrations/rollback/rollback_fix_report_ws_rls.sql
psql $DATABASE_URL < supabase/migrations/rollback/rollback_fix_report_voice_rls.sql
psql $DATABASE_URL < supabase/migrations/rollback/rollback_fix_assistants_rls.sql
```

## Security Best Practices

### ✅ DO:
- Use `service_role` key ONLY in server-side API routes
- Validate webhook signatures before trusting data
- Log all service_role operations for audit
- Restrict service_role usage to webhook handlers only

### ❌ DON'T:
- NEVER expose `service_role` key to client-side code
- NEVER use `service_role` for regular user operations
- NEVER skip webhook signature validation when using service_role
- NEVER commit `service_role` key to version control

## Webhook Signature Validation

Since service_role bypasses RLS, validate webhook authenticity:

```typescript
// Example: Railway webhook signature validation
function validateRailwaySignature(req: Request): boolean {
  const signature = req.headers.get('x-railway-signature');
  const secret = process.env.RAILWAY_WEBHOOK_SECRET;

  // Implement HMAC signature validation
  // ... signature validation logic

  return true; // or false if invalid
}

export async function POST(req: Request) {
  // Validate webhook before using service_role
  if (!validateRailwaySignature(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Now safe to use service_role
  const supabase = createServiceRoleClient();
  // ...
}
```

## Testing Webhooks

### Manual Testing
1. Trigger webhook event (e.g., send WhatsApp message)
2. Check webhook handler logs
3. Verify database record created
4. Confirm RLS didn't block the operation

### Automated Testing
```typescript
// Example test
describe('Railway Webhook', () => {
  it('should insert report with service_role', async () => {
    const response = await fetch('/api/railway', {
      method: 'POST',
      body: JSON.stringify({
        status: 'SUCCESS',
        service: { name: 'test-namespace' }
      })
    });

    expect(response.status).toBe(200);

    // Verify database record
    const { data } = await supabase
      .from('assistants')
      .select('activated_whatsApp')
      .eq('namespace', 'test-namespace')
      .single();

    expect(data?.activated_whatsApp).toBe(true);
  });
});
```

## Support

If you encounter webhook failures after migration:
1. Check server logs for permission denied errors
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
3. Confirm webhook handlers use `createServiceRoleClient()`
4. Review RLS policies on affected tables
5. Contact support with error details

---

**Last Updated**: 2025-10-04
**Related Migrations**: INTEL-010 Phase 2
