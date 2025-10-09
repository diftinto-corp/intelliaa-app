"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check } from "lucide-react";
import type { AssistantTypeCardData } from "./types";
import FormAddComponent from "@/components/intelliaa/assistants/FormAdd";
import { AssistantTemplate } from "@/interfaces/intelliaa";

interface AssistantTypeCardProps {
  type: AssistantTypeCardData;
  templates: AssistantTemplate[];
  accountSlug: string;
}

/**
 * Assistant Type Card Component
 *
 * Interactive card that displays an assistant type with its features.
 * When clicked (and available), opens a modal with the FormAdd component
 * for creating a new assistant of the selected type.
 *
 * Features:
 * - Hover effects with scale and shadow
 * - Badge display (Popular, Próximamente, etc.)
 * - Disabled state for unavailable types
 * - Modal integration with FormAdd
 * - Responsive design
 *
 * This is a Client Component ("use client") because it manages modal state.
 */
export function AssistantTypeCard({
  type,
  templates,
  accountSlug,
}: AssistantTypeCardProps) {
  const [showModal, setShowModal] = useState(false);

  const Icon = type.icon;

  const handleCardClick = () => {
    if (type.available) {
      setShowModal(true);
    }
  };

  return (
    <>
      <Card
        className={`relative overflow-hidden transition-all duration-300 ${
          type.available
            ? "cursor-pointer hover:scale-105 hover:shadow-xl"
            : "opacity-60 cursor-not-allowed"
        }`}
        onClick={handleCardClick}
      >
        {/* Badge */}
        {type.badge && (
          <div className="absolute top-4 right-4">
            <Badge
              variant={type.badge === "Próximamente" ? "secondary" : "default"}
            >
              {type.badge}
            </Badge>
          </div>
        )}

        <CardHeader>
          {/* Icon */}
          <div className="mb-4 p-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl w-fit">
            <Icon className="h-12 w-12 text-primary" />
          </div>

          <CardTitle className="text-2xl">{type.title}</CardTitle>
          <CardDescription className="text-base">
            {type.description}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Features List */}
          <ul className="space-y-2">
            {type.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>

          {/* Call to Action Text */}
          {type.available && (
            <div className="mt-6 text-sm font-medium text-primary">
              Click para crear →
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal with FormAdd Component */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-6 w-6 text-primary" />
              Crear {type.title}
            </DialogTitle>
          </DialogHeader>

          {/* FormAdd Component */}
          <FormAddComponent
            dataTemplates={{ templates }}
            setOpenModal={setShowModal}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
