# Implementación de Sidebar Widgets con Client-Side Tools

## Descripción General

Sistema de widgets interactivos del sidebar que utiliza **Client-Side Tools** del Vercel AI SDK para mostrar componentes UI generativos (Generative User Interfaces) del lado derecho del chat. La arquitectura sigue el patrón oficial del AI SDK para herramientas que requieren interacción del usuario.

## Cambios Principales (Última Actualización)

### ✨ Migración a Client-Side Tools Pattern

La implementación anterior usaba detección automática de palabras clave en los mensajes del asistente, lo cual causaba:
- **Duplicación**: El servidor ejecutaba tools y el cliente también detectaba palabras clave
- **Retraso**: El widget aparecía después de procesar el mensaje completo
- **Inconsistencia**: No siempre se activaba correctamente

**Solución implementada**: Patrón de Client-Side Tools del AI SDK
- El servidor declara tools sin función `execute`
- El cliente maneja las tools mediante `onToolCall`
- Activación directa por el modelo de IA
- Sin duplicación ni detección manual

## Arquitectura Actual

### 1. Client-Side Tools (`app/api/chat/tools/quotes-client.ts`)

```tsx
export const quoteToolsClient = {
  showQuoteForm: {
    description: 'Show an interactive quote form to collect user information',
    inputSchema: z.object({
      message: z.string(),
      prefillData: z.object({
        age: z.number().optional(),
        zipCode: z.string().optional()
      }).optional()
    })
  },

  showInsuranceCalculator: {
    description: 'Show an interactive insurance calculator widget',
    inputSchema: z.object({
      message: z.string(),
      initialValues: z.object({
        age: z.number().optional(),
        familySize: z.number().optional(),
        annualIncome: z.number().optional()
      }).optional()
    })
  },

  showQuoteComparison: {
    description: 'Show a comparison widget for multiple insurance plans',
    inputSchema: z.object({
      plans: z.array(z.enum(['bronze', 'silver', 'gold', 'platinum'])),
      userAge: z.number().optional(),
      message: z.string()
    })
  }
};
```

### 2. Manejo en el Cliente (`app/chat/page.tsx`)

```tsx
const { messages, sendMessage, status, addToolResult } = useChat({
  // ... configuración ...

  // Handle client-side tools that trigger widgets
  async onToolCall({ toolCall }) {
    if (toolCall.dynamic) return;

    // Handle quote form widget
    if (toolCall.toolName === 'showQuoteForm') {
      const input = toolCall.input as { message: string; prefillData?: any };

      // Show the quote form widget
      showQuoteForm((data) => {
        // Send result back to AI when form is completed
        addToolResult({
          tool: 'showQuoteForm',
          toolCallId: toolCall.toolCallId,
          output: {
            completed: true,
            formData: data,
            message: 'User completed the quote form'
          },
        });
      });

      // Immediately acknowledge the tool call
      addToolResult({
        tool: 'showQuoteForm',
        toolCallId: toolCall.toolCallId,
        output: { status: 'displayed', message: input.message },
      });
    }
    // Similar handlers for other tools...
  },
});
```

### 3. Contexto con Estado de Loading (`contexts/sidebar-context.tsx`)

```tsx
interface SidebarWidget {
  id: string;
  type: 'quote-form' | 'document-viewer' | 'calculator' | 'chart' | 'custom';
  title: string;
  component: ReactNode;
  data?: any;
  isLoading?: boolean; // Nuevo campo
  onClose?: () => void;
  onComplete?: (data: any) => void;
}

interface SidebarContextType {
  currentWidget: SidebarWidget | null;
  isWidgetLoading: boolean; // Estado de loading
  showWidget: (widget: SidebarWidget) => void;
  hideWidget: () => void;
  updateWidget: (updates: Partial<SidebarWidget>) => void;
  setWidgetLoading: (loading: boolean) => void;
}
```

### 4. Widget Container con Skeleton Loader (`components/chat/chat-sidebar-widget.tsx`)

```tsx
export function ChatSidebarWidget() {
  const { currentWidget, hideWidget, isWidgetLoading } = useSidebar();

  if (!currentWidget) return null;

  return (
    <div className="w-96 border-l bg-background flex flex-col">
      <Card className="h-full border-0 rounded-none">
        <CardHeader className="border-b px-4 py-3">
          {/* Header con skeleton durante loading */}
          {isWidgetLoading ? (
            <Skeleton className="h-6 w-32" />
          ) : (
            <CardTitle>{currentWidget.title}</CardTitle>
          )}
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-y-auto">
          {isWidgetLoading ? (
            <div className="p-6 space-y-4">
              {/* Skeleton del formulario */}
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            currentWidget.component
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 5. System Prompt Actualizado (`app/api/chat/routing/classifier.ts`)

```tsx
quote_generation:
  'You are a specialized insurance quote assistant for Hispano Insurance. ' +
  'You have access to tools for showing interactive forms and calculators. ' +
  'When users request a quote or want to calculate insurance costs, ALWAYS use the showQuoteForm or showInsuranceCalculator tools. ' +
  'Do not ask questions manually - use the available tools to collect information through interactive widgets. ' +
  'Available tools: showQuoteForm (for detailed quotes), showInsuranceCalculator (for quick estimates).'
```

## Flujo de Ejecución

1. **Usuario solicita cotización** → "Necesito una cotización de seguro"
2. **Clasificación del router** → Categoría: `quote_generation`
3. **Modelo con tools disponibles** → El modelo ve `showQuoteForm`, `showInsuranceCalculator`
4. **Modelo invoca tool** → Llama a `showQuoteForm` con mensaje contextual
5. **Cliente detecta tool call** → `onToolCall` se activa en el cliente
6. **Widget se muestra** →
   - Se activa loading con skeleton (300ms)
   - Se muestra el formulario/calculadora
7. **Usuario completa formulario** → Datos se envían con `addToolResult`
8. **AI recibe resultado** → Puede continuar la conversación con los datos

## Ventajas del Nuevo Sistema

### ✅ Eliminación de Duplicación
- **Antes**: Servidor ejecutaba tool + cliente detectaba palabras clave
- **Ahora**: Solo el cliente maneja la herramienta cuando el AI la invoca

### ⚡ Respuesta Inmediata
- **Antes**: Widget aparecía después de procesar todo el mensaje
- **Ahora**: Widget aparece tan pronto como el AI invoca la herramienta

### 🎯 Control Preciso
- **Antes**: Detección basada en palabras podía fallar
- **Ahora**: El AI decide exactamente cuándo mostrar el widget

### 🔄 Feedback Bidireccional
- El AI sabe cuando el widget se muestra
- El AI recibe los datos cuando el usuario completa el formulario
- Permite conversaciones contextuales basadas en los datos

## Componentes del Sistema

### Archivos Core

```
app/api/chat/
├── tools/
│   ├── quotes-client.ts     # Client-side tools (sin execute)
│   ├── quotes.ts            # Server-side tools (con execute)
│   └── index.ts             # Router de tools por categoría
└── routing/
    └── classifier.ts        # System prompts actualizados

app/chat/
└── page.tsx                 # Manejo de onToolCall

contexts/
└── sidebar-context.tsx      # Estado con loading

components/
├── ui/
│   └── skeleton.tsx         # Componente de skeleton loader
└── chat/
    ├── chat-sidebar-widget.tsx      # Container con skeleton
    ├── quote-form-widget.tsx        # Formulario multi-step
    └── insurance-calculator-widget.tsx # Calculadora interactiva

hooks/
└── use-sidebar-widgets.tsx   # Hook de utilidad
```

### Componentes UI de shadcn/ui

- `Checkbox` - Opciones de selección
- `Slider` - Controles deslizantes
- `Badge` - Etiquetas y estados
- `Skeleton` - Loading states

## Uso del Sistema

### Ejemplo de Tool Call desde el AI

```json
{
  "toolName": "showQuoteForm",
  "toolCallId": "call_abc123",
  "input": {
    "message": "Por favor completa este formulario para obtener tu cotización personalizada",
    "prefillData": {
      "age": 30,
      "zipCode": "33101"
    }
  }
}
```

### Ejemplo de Tool Result al AI

```json
{
  "tool": "showQuoteForm",
  "toolCallId": "call_abc123",
  "output": {
    "completed": true,
    "formData": {
      "age": 30,
      "zipCode": "33101",
      "county": "Miami-Dade",
      "sex": "M",
      "tobacco": false,
      "familySize": 3,
      "annualIncome": 75000
    },
    "message": "User completed the quote form"
  }
}
```

## Debugging y Monitoreo

En la consola del servidor verás:

```
================================================================================
🆕 NEW CHAT REQUEST
================================================================================
📝 User Query: Necesito una cotización de seguro de salud
🎯 Routing Classification: {
  category: 'quote_generation',
  requiresTools: true
}
🔧 Tools Enabled for Category: quote_generation
📦 Available Tools: ['showQuoteForm', 'showInsuranceCalculator']
🛠️ Tool Called: {
  name: 'showQuoteForm',
  timestamp: '2024-01-15T10:30:00Z'
}
✅ Stream finished: {
  toolsUsedCount: 1,
  toolsUsed: ['showQuoteForm']
}
```

## Mejoras Futuras Sugeridas

1. **Persistencia de Datos**: Guardar formularios parcialmente completados
2. **Validación Avanzada**: Validación en tiempo real con feedback visual
3. **Múltiples Widgets**: Soporte para mostrar múltiples widgets simultáneamente
4. **Animaciones**: Transiciones suaves entre estados
5. **Integración API Real**: Conectar con servicios reales de cotización
6. **Analytics**: Tracking de uso y completion rates de widgets

## Conclusión

La migración al patrón de Client-Side Tools del AI SDK ha resuelto los problemas de duplicación y retraso, proporcionando una experiencia de usuario más fluida y predecible. El sistema ahora es más mantenible, escalable y sigue las mejores prácticas oficiales del framework.