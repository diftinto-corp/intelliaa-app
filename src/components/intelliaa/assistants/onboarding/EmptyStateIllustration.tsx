import { Bot, Phone, MessageSquare } from "lucide-react";

/**
 * Empty State Illustration Component
 *
 * Displays an animated illustration for the onboarding experience.
 * Features:
 * - Large Bot icon with gradient background
 * - Accent icons (Phone, MessageSquare) positioned around the main icon
 * - Gradient glow effect with blur and subtle pulse animation
 * - Fully responsive design
 *
 * This is a Server Component (no interactivity needed).
 */
export function EmptyStateIllustration() {
  return (
    <div className="flex justify-center">
      <div className="relative">
        {/* Gradient Glow Background with Pulse Animation */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/30 rounded-full blur-3xl animate-pulse" />

        {/* Main Icon Container */}
        <div className="relative bg-gradient-to-br from-primary to-accent p-8 rounded-3xl shadow-2xl">
          <Bot className="h-20 w-20 text-primary-foreground" />
        </div>

        {/* Accent Icons - Phone (Top Right) */}
        <div className="absolute -top-2 -right-2 bg-background border-2 border-primary/20 p-3 rounded-xl shadow-lg">
          <Phone className="h-6 w-6 text-primary" />
        </div>

        {/* Accent Icons - MessageSquare (Bottom Left) */}
        <div className="absolute -bottom-2 -left-2 bg-background border-2 border-accent/20 p-3 rounded-xl shadow-lg">
          <MessageSquare className="h-6 w-6 text-accent" />
        </div>
      </div>
    </div>
  );
}
