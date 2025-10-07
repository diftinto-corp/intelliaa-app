"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, MessageSquare, Phone, FileText, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Empty state component for assistants page
 * Shown when user has no assistants yet
 */
interface AssistantsEmptyStateProps {
  accountSlug: string;
}

export function AssistantsEmptyState({ accountSlug }: AssistantsEmptyStateProps) {
  const router = useRouter();

  const handleCreateAssistant = () => {
    // TODO: Navigate to assistant creation wizard when implemented (INT-35)
    // For now, just log
    console.log("Create assistant clicked");
    // router.push(`/${accountSlug}/assistants/new`);
  };

  return (
    <div className="flex items-center justify-center h-full p-4">
      <Card className="max-w-2xl w-full">
        <CardContent className="pt-12 pb-12 px-8 text-center space-y-8">
          {/* Gradient glow effect with Bot icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-primary to-accent p-6 rounded-2xl">
                <Bot className="h-16 w-16 text-primary-foreground" />
              </div>
            </div>
          </div>

          {/* Heading and description */}
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">
              Create Your First AI Assistant
            </h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Build intelligent voice and messaging assistants powered by AI.
              Get started in minutes with our intuitive creation wizard.
            </p>
          </div>

          {/* CTA button */}
          <Button
            onClick={handleCreateAssistant}
            size="lg"
            className="text-lg px-8 py-6 h-auto"
          >
            <Bot className="mr-2 h-5 w-5" />
            Create Assistant
          </Button>

          {/* Feature highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t">
            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-sm font-medium">Voice AI</p>
              <p className="text-xs text-muted-foreground">
                Natural phone conversations
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="p-3 bg-accent/10 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-accent-foreground" />
                </div>
              </div>
              <p className="text-sm font-medium">WhatsApp</p>
              <p className="text-xs text-muted-foreground">
                Automated messaging
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-sm font-medium">Documents</p>
              <p className="text-xs text-muted-foreground">
                Knowledge base integration
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="p-3 bg-accent/10 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-accent-foreground" />
                </div>
              </div>
              <p className="text-sm font-medium">Analytics</p>
              <p className="text-xs text-muted-foreground">
                Detailed reporting
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
