# INT-44: Integrate Evolution API for WhatsApp Instance Management

**Epic**: INT-43 - WhatsApp Evolution API Migration
**Priority**: P0 - Must Have
**Estimate**: 8-13 points (XL)
**Labels**: backend, whatsapp, evolution-api, infrastructure

## User Story

As an IntelliAA platform administrator, I want to integrate Evolution API for WhatsApp instance management, so that we can deploy WhatsApp assistants faster, cheaper, and with better reliability than Railway/Buildship.

## Acceptance Criteria

### AC1: Evolution API Instance Creation
**Given** a user creates a new WhatsApp assistant
**When** deployment is initiated
**Then** system creates Evolution API instance, generates unique instance name, and returns instance ID within 10 seconds

### AC2: QR Code Generation and Display
**Given** an Evolution API instance is created
**When** requesting QR code
**Then** system generates QR code within 5 seconds and displays it with auto-refresh every 30 seconds until scanned

### AC3: Real-Time Connection Status
**Given** a WhatsApp instance exists
**When** viewing instance status
**Then** system displays real-time connection status (connecting, connected, disconnected) using webhooks

### AC4: Instance Lifecycle Management
**Given** I want to manage WhatsApp instances
**When** using the admin panel
**Then** I can: create, restart, logout, delete instances with confirmation dialogs

### AC5: Multi-Tenant Instance Isolation
**Given** multiple accounts using WhatsApp assistants
**When** instances are created
**Then** each account's instances are completely isolated with unique API keys and namespaces

### AC6: Webhook Event Handling
**Given** Evolution API sends webhook events (connection, message, status)
**When** webhook is received
**Then** system processes event, updates database, and triggers relevant UI updates within 1 second

### AC7: Error Handling and Retry Logic
**Given** Evolution API is temporarily unavailable
**When** instance creation fails
**Then** system retries 3 times with exponential backoff and alerts user if all retries fail

## Technical Notes

### Evolution API Integration
```typescript
// src/services/evolutionApiService.ts
import axios from 'axios';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

export class EvolutionApiService {
  private client = axios.create({
    baseURL: EVOLUTION_API_URL,
    headers: {
      'apikey': EVOLUTION_API_KEY,
    },
  });

  async createInstance(instanceName: string) {
    const response = await this.client.post('/instance/create', {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });

    return {
      instanceId: response.data.instance.instanceId,
      instanceName: response.data.instance.instanceName,
      status: response.data.instance.status,
    };
  }

  async getQRCode(instanceName: string) {
    const response = await this.client.get(`/instance/connect/${instanceName}`);
    return {
      qrCode: response.data.code, // base64 QR code
      count: response.data.count,
    };
  }

  async getInstanceStatus(instanceName: string) {
    const response = await this.client.get(`/instance/connectionState/${instanceName}`);
    return {
      state: response.data.state, // 'open', 'close', 'connecting'
      statusReason: response.data.statusReason,
    };
  }

  async deleteInstance(instanceName: string) {
    await this.client.delete(`/instance/delete/${instanceName}`);
  }

  async logoutInstance(instanceName: string) {
    await this.client.delete(`/instance/logout/${instanceName}`);
  }

  async restartInstance(instanceName: string) {
    await this.client.put(`/instance/restart/${instanceName}`);
  }
}
```

### Database Schema Updates
```sql
-- Update assistants table for Evolution API
ALTER TABLE assistants 
  DROP COLUMN IF EXISTS service_id_rw,
  DROP COLUMN IF EXISTS is_deploying_ws,
  DROP COLUMN IF EXISTS qr_url,
  ADD COLUMN IF NOT EXISTS evolution_instance_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS evolution_instance_name VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS evolution_status VARCHAR(50) DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS evolution_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS evolution_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evolution_last_webhook_at TIMESTAMPTZ;

-- Create Evolution API events log
CREATE TABLE evolution_api_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name VARCHAR(100),
  event_type VARCHAR(50), -- 'connection.update', 'messages.upsert', 'qr.updated'
  event_data JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_evolution_instance_name ON assistants(evolution_instance_name);
CREATE INDEX idx_evolution_events_processed ON evolution_api_events(processed, created_at);
```

### API Route for Instance Management
```typescript
// src/app/api/whatsapp/evolution/create/route.ts
export async function POST(request: Request) {
  const { assistantId } = await request.json();
  const supabase = await createClient();

  // Get assistant
  const { data: assistant } = await supabase
    .from('assistants')
    .select('*')
    .eq('id', assistantId)
    .single();

  // Generate unique instance name
  const instanceName = `wa_${assistant.account_id}_${assistant.namespace}`;

  // Create Evolution API instance
  const evolutionService = new EvolutionApiService();
  
  try {
    const instance = await evolutionService.createInstance(instanceName);

    // Update assistant with instance info
    await supabase
      .from('assistants')
      .update({
        evolution_instance_id: instance.instanceId,
        evolution_instance_name: instanceName,
        evolution_status: 'connecting',
      })
      .eq('id', assistantId);

    // Get QR code
    const qrData = await evolutionService.getQRCode(instanceName);

    return NextResponse.json({
      success: true,
      instanceName,
      qrCode: qrData.qrCode,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create Evolution API instance' },
      { status: 500 }
    );
  }
}
```

### Webhook Handler
```typescript
// src/app/api/webhooks/evolution-api/route.ts
export async function POST(request: Request) {
  const event = await request.json();
  const supabase = await createClient();

  // Log event
  await supabase.from('evolution_api_events').insert({
    instance_name: event.instance,
    event_type: event.event,
    event_data: event.data,
  });

  // Handle connection updates
  if (event.event === 'connection.update') {
    const status = event.data.state === 'open' ? 'connected' : 'disconnected';
    
    await supabase
      .from('assistants')
      .update({
        evolution_status: status,
        evolution_connected_at: status === 'connected' ? new Date().toISOString() : null,
        evolution_last_webhook_at: new Date().toISOString(),
      })
      .eq('evolution_instance_name', event.instance);
  }

  // Handle QR code updates
  if (event.event === 'qr.updated') {
    await supabase
      .from('assistants')
      .update({
        evolution_qr_code: event.data.qrcode,
      })
      .eq('evolution_instance_name', event.instance);
  }

  return NextResponse.json({ received: true });
}
```

### Frontend QR Code Display
```typescript
// src/components/intelliaa/assistants/whatsapp/EvolutionQRCode.tsx
export function EvolutionQRCode({ assistantId }) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    // Subscribe to real-time updates
    const supabase = createClient();
    const channel = supabase
      .channel(`assistant:${assistantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assistants',
          filter: `id=eq.${assistantId}`,
        },
        (payload) => {
          setStatus(payload.new.evolution_status);
          setQrCode(payload.new.evolution_qr_code);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assistantId]);

  if (status === 'connected') {
    return (
      <Alert>
        <Check className="h-4 w-4" />
        <AlertTitle>WhatsApp Connected</AlertTitle>
        <AlertDescription>
          Your assistant is ready to receive messages
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect WhatsApp</CardTitle>
        <CardDescription>
          Scan this QR code with WhatsApp on your phone
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {qrCode ? (
          <QRCodeSVG value={qrCode} size={256} />
        ) : (
          <Loader2 className="w-16 h-16 animate-spin" />
        )}
        <p className="text-sm text-muted-foreground mt-4">
          QR code refreshes automatically every 30 seconds
        </p>
      </CardContent>
    </Card>
  );
}
```

## Definition of Done

- [ ] Evolution API service class created
- [ ] Instance creation API route implemented
- [ ] QR code generation and display working
- [ ] Real-time status updates via webhooks functional
- [ ] Instance lifecycle management (create, restart, logout, delete) working
- [ ] Multi-tenant isolation verified
- [ ] Webhook handler processing all event types
- [ ] Error handling and retry logic implemented
- [ ] Database schema updated and migrated
- [ ] Frontend QR code component created
- [ ] Real-time Supabase subscriptions working
- [ ] Testing completed with multiple instances
- [ ] Documentation created for Evolution API setup
- [ ] Code reviewed and merged

## Dependencies

- Evolution API deployed and accessible
- Evolution API key configured
- Webhook URL configured in Evolution API
- Database migrations applied

## Related Stories

- **Blocks**: INT-45 (Vercel AI SDK needs instance)
- **Blocks**: INT-46 (Migration needs Evolution API)
- **Replaces**: Railway/Buildship integration
