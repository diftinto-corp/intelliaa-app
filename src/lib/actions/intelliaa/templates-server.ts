"use server";

/**
 * Server-side template actions for Next.js 15 App Router
 * Provides assistant templates for onboarding and creation flows
 */

import { createClient } from "@/lib/supabase/server";
import { cache } from "react";
import type { AssistantTemplate } from "@/interfaces/intelliaa";

/**
 * Get all assistant templates
 *
 * Templates are used in:
 * - Onboarding experience (INT-33)
 * - Assistant creation modal (FormAdd)
 * - Assistant wizard (INT-35, future)
 *
 * Cached with React cache() for deduplication within single render
 *
 * @returns Array of assistant templates or error
 */
export const getAssistantTemplates = cache(
  async (): Promise<AssistantTemplate[] | { error: string }> => {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("assistants_template")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("[getAssistantTemplates] Error:", error);
        return { error: error.message };
      }

      if (!data || data.length === 0) {
        console.warn("[getAssistantTemplates] No templates found");
        return [];
      }

      return data as AssistantTemplate[];
    } catch (error) {
      console.error("[getAssistantTemplates] Exception:", error);
      return { error: "Failed to fetch assistant templates" };
    }
  }
);

/**
 * Get single assistant template by ID
 *
 * @param templateId - The template ID
 * @returns Template details or error
 */
export const getTemplateById = cache(
  async (
    templateId: string
  ): Promise<AssistantTemplate | { error: string }> => {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("assistants_template")
        .select("*")
        .eq("id", templateId)
        .single();

      if (error) {
        console.error("[getTemplateById] Error:", error);
        return { error: error.message };
      }

      if (!data) {
        return { error: "Template not found" };
      }

      return data as AssistantTemplate;
    } catch (error) {
      console.error("[getTemplateById] Exception:", error);
      return { error: "Failed to fetch template details" };
    }
  }
);
