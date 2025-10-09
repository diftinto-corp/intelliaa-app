"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { AssistantListItem } from "./AssistantListItem";
import { AssistantListSkeleton } from "./AssistantListSkeleton";
import { CreateAssistantButton } from "./CreateAssistantButton";
import type { AssistantListItem as AssistantListItemType } from "@/lib/actions/intelliaa/assistants-server";
import type { AssistantTemplate } from "@/interfaces/intelliaa";

interface AssistantsMasterPanelProps {
  assistants: AssistantListItemType[];
  selectedId: string | null;
  onSelectAssistant: (assistantId: string) => void;
  templates: AssistantTemplate[];
  isLoading?: boolean;
}

/**
 * Master panel component - Shows list of assistants
 * Includes keyboard navigation support
 */
export function AssistantsMasterPanel({
  assistants,
  selectedId,
  onSelectAssistant,
  templates,
  isLoading = false,
}: AssistantsMasterPanelProps) {
  if (isLoading) {
    return (
      <div className="w-full md:w-[45%] lg:w-[400px] border-r">
        <div className="p-4">
          <AssistantListSkeleton count={8} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:w-[45%] lg:w-[400px] border-r flex flex-col h-full">
      {/* Header with Create Button */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Asistentes</h2>
            <p className="text-sm text-muted-foreground">
              {assistants.length} {assistants.length === 1 ? "asistente" : "asistentes"}
            </p>
          </div>
        </div>

        {/* Create Assistant Button */}
        <CreateAssistantButton templates={templates} className="w-full" />
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div
          className="p-4 space-y-2"
          role="listbox"
          aria-label="Assistants list"
          onKeyDown={(e) => {
            // Keyboard navigation: Arrow up/down
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const currentIndex = selectedId
                ? assistants.findIndex((a) => a.id === selectedId)
                : -1;

              let nextIndex: number;
              if (e.key === "ArrowDown") {
                nextIndex =
                  currentIndex < assistants.length - 1 ? currentIndex + 1 : 0;
              } else {
                nextIndex =
                  currentIndex > 0 ? currentIndex - 1 : assistants.length - 1;
              }

              const nextAssistant = assistants[nextIndex];
              if (nextAssistant) {
                onSelectAssistant(nextAssistant.id);
              }
            }
          }}
        >
          {assistants.map((assistant) => (
            <AssistantListItem
              key={assistant.id}
              assistant={assistant}
              isSelected={selectedId === assistant.id}
              onClick={() => onSelectAssistant(assistant.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
