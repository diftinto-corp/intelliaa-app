import { LucideIcon, Phone, MessageSquare, Bot } from "lucide-react";

/**
 * Assistant Type Card Data Structure
 *
 * Defines the structure for displaying assistant type cards in the onboarding experience.
 * Each type has specific features, availability status, and creation flow.
 */
export interface AssistantTypeCardData {
  id: "voice" | "whatsapp" | "web";
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  badge?: "Popular" | "New" | "Próximamente";
  available: boolean;
  creationFlow: "vapi" | "direct" | "disabled";
}

/**
 * Assistant Types Configuration
 *
 * Defines the three types of assistants available in the platform:
 * - Voice: VAPI-powered phone conversation assistants
 * - WhatsApp: Messaging automation assistants
 * - Web: Website chat widget (coming soon)
 *
 * All content is in Spanish to match the platform's primary language.
 */
export const ASSISTANT_TYPES: AssistantTypeCardData[] = [
  {
    id: "voice",
    title: "Asistente de Voz",
    description: "Conversaciones telefónicas naturales con IA",
    icon: Phone,
    features: [
      "Síntesis de voz natural (ElevenLabs)",
      "Soporte en español",
      "Reconocimiento de emociones",
      "Transcripción en tiempo real",
      "Enrutamiento de llamadas",
    ],
    badge: "Popular",
    available: true,
    creationFlow: "vapi",
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    description: "Mensajería automatizada 24/7",
    icon: MessageSquare,
    features: [
      "Respuestas automáticas 24/7",
      "Conversaciones multiusuario",
      "Envío de archivos multimedia",
      "Despliegue con código QR",
      "Analíticas de mensajes",
    ],
    available: true,
    creationFlow: "direct",
  },
  {
    id: "web",
    title: "Chat Web",
    description: "Widget de chat para tu sitio web",
    icon: Bot,
    features: [
      "Apariencia personalizable",
      "Integración con base de conocimiento",
      "Soporte multiidioma",
      "Panel de analíticas",
      "Código de inserción",
    ],
    badge: "Próximamente",
    available: false,
    creationFlow: "disabled",
  },
];

/**
 * Type guard to check if an assistant type is available
 */
export function isAssistantTypeAvailable(
  type: AssistantTypeCardData
): boolean {
  return type.available;
}

/**
 * Get assistant type by ID
 */
export function getAssistantType(
  id: "voice" | "whatsapp" | "web"
): AssistantTypeCardData | undefined {
  return ASSISTANT_TYPES.find((type) => type.id === id);
}
