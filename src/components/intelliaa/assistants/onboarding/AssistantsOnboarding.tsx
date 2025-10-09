import { AssistantTemplate } from "@/interfaces/intelliaa";
import { EmptyStateIllustration } from "./EmptyStateIllustration";
import { AssistantTypeCard } from "./AssistantTypeCard";
import { QuickStartButton } from "./QuickStartButton";
import { ASSISTANT_TYPES } from "./types";

interface AssistantsOnboardingProps {
  accountSlug: string;
  accountId: string;
  templates: AssistantTemplate[];
}

/**
 * Assistants Onboarding Component
 *
 * Displays the onboarding experience when a user has zero assistants.
 * This component is shown instead of the master-detail layout when
 * `assistants.length === 0`.
 *
 * Features:
 * - Empty state illustration with Bot icon
 * - Heading and description explaining the platform
 * - Three interactive assistant type cards (Voice, WhatsApp, Web)
 * - Quick Start Guide button for getting started help
 * - Fully responsive design
 * - Spanish content (platform primary language)
 *
 * Auto-Dismissal:
 * - Automatically dismissed when user creates first assistant
 * - No explicit dismiss action needed
 * - Page re-renders on navigation after creation
 *
 * This is a Server Component (no "use client" needed).
 * Child components handle interactivity as Client Components.
 */
export function AssistantsOnboarding({
  accountSlug,
  accountId,
  templates,
}: AssistantsOnboardingProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-6xl w-full space-y-12 animate-in fade-in duration-500">
        {/* Empty State Illustration */}
        <EmptyStateIllustration />

        {/* Heading & Description */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Crea tu Primer Asistente de IA
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Construye asistentes inteligentes de voz y mensajería impulsados por IA.
            Conéctate a tu base de conocimiento y despliega en minutos.
          </p>
        </div>

        {/* Assistant Type Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ASSISTANT_TYPES.map((type) => (
            <AssistantTypeCard
              key={type.id}
              type={type}
              templates={templates}
              accountSlug={accountSlug}
            />
          ))}
        </div>

        {/* Quick Start Guide */}
        <div className="text-center">
          <QuickStartButton />
        </div>
      </div>
    </div>
  );
}
