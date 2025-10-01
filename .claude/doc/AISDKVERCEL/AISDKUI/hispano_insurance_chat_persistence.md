# Hispano Insurance Chat Persistence Implementation

Esta documentación describe la implementación de persistencia de conversaciones para la aplicación de Hispano Insurance, siguiendo las mejores prácticas del AI SDK de Vercel.

## Arquitectura General

La implementación utiliza:
- **Frontend**: Next.js 15 con React 19 y AI SDK UI
- **Backend**: API Routes de Next.js con AI SDK Core
- **Base de datos**: PostgreSQL con Prisma ORM
- **Autenticación**: Clerk
- **IA**: OpenAI GPT-4o y GPT-4o-mini

## Estructura de Base de Datos

### Schema Prisma

```prisma
model Conversation {
  id        String   @id @default(cuid())
  title     String?
  userId    String   // Clerk user ID
  messages  Json     // UIMessage[] stored as JSON following AI SDK docs
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([createdAt])
}
```

### Decisiones de Diseño

1. **Formato UIMessage**: Se almacenan los mensajes en formato `UIMessage[]` como recomienda la documentación oficial del AI SDK
2. **JSON Storage**: Los mensajes se guardan como JSON para mantener toda la estructura incluyendo `parts`, `id`, `createdAt`
3. **Índices**: Optimización para búsquedas por usuario y fecha

## Chat Store (`lib/chat-store.ts`)

### Funciones Principales

```typescript
// Crear nueva conversación
export async function createChat(userId: string): Promise<string>

// Cargar mensajes existentes
export async function loadChat(id: string): Promise<UIMessage[]>

// Guardar conversación completa
export async function saveChat({
  chatId,
  messages,
}: {
  chatId: string;
  messages: UIMessage[];
}): Promise<void>

// Listar conversaciones del usuario
export async function listUserChats(userId: string): Promise<Array<{
  id: string;
  title: string | null;
  lastMessage: string;
  timestamp: Date;
}>>

// Generar título automático
export async function generateChatTitle(messages: UIMessage[]): Promise<string>
```

### Características de Seguridad

- **Verificación de ownership**: `verifyUserOwnsChat(chatId, userId)`
- **Validación de permisos**: Solo el propietario puede acceder/eliminar
- **Autenticación obligatoria**: Todas las operaciones requieren usuario autenticado

## Estructura de Páginas

### Redirección para Nueva Conversación

```typescript
// app/chat/page.tsx
export default function Home() {
  return <ChatPage />;
}
```

### Página Dinámica para Conversaciones Existentes

```typescript
// app/chat/[id]/page.tsx
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { userId } = await auth();

  // Verificar permisos
  const hasAccess = await verifyUserOwnsChat(id, userId);
  if (!hasAccess) notFound();

  // Cargar mensajes
  const messages = await loadChat(id);

  return <ChatInterface initialMessages={messages} chatId={id} />;
}
```

## Componente de Chat

### Configuración useChat

```typescript
// app/chat/[id]/chat-interface.tsx
const { messages, sendMessage, status } = useChat({
  id: chatId, // use the provided chat ID
  messages: initialMessages, // load initial messages from database
  transport: new DefaultChatTransport({
    api: '/api/chat',
    // Following docs lines 437-444 for sending additional data
    prepareSendMessagesRequest({ messages, id }) {
      return {
        body: {
          messages,
          chatId: id,
          model: model,
          webSearch: webSearch,
        }
      };
    },
  }),
});
```

### Lógica de Renderizado

```typescript
// Mostrar InitialConversation si no hay mensajes, sino mostrar el chat
{!hasInitialMessages && messages.length === 0 ? (
  <InitialConversation onSendMessage={handleSuggestedMessage} />
) : (
  <Conversation className="h-full">
    {/* Renderizar mensajes */}
  </Conversation>
)}
```

## API Route de Chat

### Request Handling

```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  // Parse request body following AI SDK docs (lines 276-277)
  const { messages, chatId }: { messages: UIMessage[]; chatId: string } = await req.json();

  // Verify user owns conversation
  if (chatId) {
    const hasAccess = await verifyUserOwnsChat(chatId, userId);
    if (!hasAccess) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Extract message content for classification
  const lastMessage = messages[messages.length - 1];
  const messageContent = lastMessage.parts?.find(part => part.type === 'text')?.text || '';

  // Classify query for routing
  const classification = await classifyQuery(messageContent);
  const model = selectModel(classification);
  const systemPrompt = getSystemPrompt(classification.category);
  const tools = classification.requiresTools ? getToolsForCategory(classification.category) : undefined;

  // Generate response
  const result = streamText({
    model,
    system: systemPrompt,
    messages: convertToModelMessages(messages), // Following AI SDK docs (line 281)
    tools,
  });

  // Return with persistence
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: createIdGenerator({
      prefix: 'msg',
      size: 16,
    }),
    onFinish: async ({ messages: finalMessages }) => {
      await saveChat({ chatId, messages: finalMessages });

      // Auto-generate title for new conversations
      const userMessages = finalMessages.filter(m => m.role === 'user');
      if (userMessages.length === 1) {
        const title = await generateChatTitle(finalMessages);
        await updateChatTitle(chatId, title);
      }
    }
  });
}
```

## API Endpoints para Conversaciones

### GET /api/conversations

```typescript
export async function GET() {
  const { userId } = await auth();
  const conversations = await listUserChats(userId);
  return NextResponse.json({ conversations });
}
```

### POST /api/conversations

```typescript
export async function POST() {
  const { userId } = await auth();
  const conversationId = await createChat(userId);
  return NextResponse.json({ id: conversationId });
}
```

### DELETE /api/conversations/[id]

```typescript
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const { id } = await props.params;

  const hasAccess = await verifyUserOwnsChat(id, userId);
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await deleteChat(id, userId);
  return NextResponse.json({ message: 'Conversation deleted successfully' });
}
```

## Sidebar de Conversaciones

### Carga de Conversaciones Reales

```typescript
// components/chat-sidebar.tsx
const [conversations, setConversations] = useState<Conversation[]>([]);

useEffect(() => {
  async function loadConversations() {
    const response = await fetch('/api/conversations');
    const data = await response.json();
    setConversations(data.conversations || []);
  }
  loadConversations();
}, []);
```

### Navegación

```typescript
// Links a conversaciones específicas
conversations.map((conv) => (
  <Link key={conv.id} href={`/chat/${conv.id}`}>
    <span>{conv.title || 'Nueva conversación'}</span>
    <span>{conv.lastMessage}</span>
  </Link>
))
```

## Flujo de Creación de Conversaciones

### Prevención de Conversaciones Vacías

```typescript
// app/chat/page.tsx - Solo crear al enviar primer mensaje
const createConversationIfNeeded = async () => {
  if (!chatId) {
    const response = await fetch('/api/conversations', { method: 'POST' });
    const data = await response.json();
    setChatId(data.id);
    return data.id;
  }
  return chatId;
};

const handleSubmit = async (message: PromptInputMessage) => {
  await createConversationIfNeeded(); // Solo crear cuando sea necesario
  sendMessage({ text: message.text });
};
```

## Generación Automática de Títulos

### Implementación

```typescript
export async function generateChatTitle(messages: UIMessage[]): Promise<string> {
  const contextMessages = messages.slice(0, 4);
  const conversationText = contextMessages
    .map(msg => {
      const textParts = msg.parts?.filter(part => part.type === 'text') || [];
      return `${msg.role}: ${textParts.map(part => part.text).join(' ')}`;
    })
    .join('\n');

  const { text } = await generateText({
    model: openai('gpt-4o-mini'), // Cost-effective model
    system: `Genera un título descriptivo y conciso (máximo 50 caracteres) para esta conversación de seguros de salud.
    El título debe ser en español, descriptivo pero no muy largo, sin comillas.`,
    prompt: `Conversación:\n${conversationText}`,
  });

  return text.trim().substring(0, 50);
}
```

### Trigger Automático

- Se ejecuta cuando hay exactamente 1 mensaje de usuario (primera respuesta)
- Usa GPT-4o-mini para optimizar costos
- Máximo 50 caracteres con truncado automático

## Características de Seguridad

1. **Autenticación**: Clerk en todas las operaciones
2. **Authorization**: Verificación de ownership de conversaciones
3. **Validación**: Parámetros requeridos y formatos correctos
4. **Error Handling**: Manejo apropiado de errores con status codes HTTP

## Optimizaciones de Rendimiento

1. **Índices de Base de Datos**: En `userId` y `createdAt`
2. **Server-side ID Generation**: IDs consistentes para persistencia
3. **Límite de Conversaciones**: 50 conversaciones recientes en sidebar
4. **Carga Selectiva**: Solo cargar mensajes cuando se necesitan

## Troubleshooting

### Mensajes No Se Muestran

1. Verificar que `initialMessages` se pasan correctamente
2. Comprobar que `messages` se usa en lugar de `initialMessages` en useChat
3. Validar que la condición de render sea correcta
4. Revisar logs de consola para debug

### Errores de Persistencia

1. Verificar conexión a base de datos
2. Comprobar autenticación de usuario
3. Validar permisos de conversación
4. Revisar formato de mensajes UIMessage

## Conclusiones

Esta implementación sigue fielmente la documentación oficial del AI SDK de Vercel, proporcionando:

- ✅ Persistencia completa de conversaciones
- ✅ UI idéntica a la original
- ✅ Navegación entre conversaciones
- ✅ Seguridad robusta
- ✅ Auto-generación de títulos
- ✅ Optimización de rendimiento

La arquitectura es escalable y mantenible, siguiendo las mejores prácticas establecidas por el AI SDK.