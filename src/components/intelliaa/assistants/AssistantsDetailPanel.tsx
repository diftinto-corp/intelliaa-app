"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, MessageSquare, Calendar, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AssistantDetail } from "@/lib/actions/intelliaa/assistants-server";
import { AssistantDetailSkeleton } from "./AssistantDetailSkeleton";

interface AssistantsDetailPanelProps {
  assistant: AssistantDetail | null;
  isLoading?: boolean;
}

/**
 * Detail panel component - Shows full assistant details with tabs
 * TODO: Integrate existing components (TabAssistantVoice, AssignStorageSection, TabsReports)
 */
export function AssistantsDetailPanel({
  assistant,
  isLoading = false,
}: AssistantsDetailPanelProps) {
  if (isLoading) {
    return (
      <div className="hidden md:block md:w-[55%] lg:flex-1 p-6">
        <AssistantDetailSkeleton />
      </div>
    );
  }

  if (!assistant) {
    return (
      <div className="hidden md:flex md:w-[55%] lg:flex-1 items-center justify-center p-6">
        <div className="text-center space-y-2">
          <Bot className="h-12 w-12 text-muted-foreground/50 mx-auto" />
          <p className="text-muted-foreground">
            Select an assistant to view details
          </p>
        </div>
      </div>
    );
  }

  const {
    name,
    prompt,
    temperature,
    token,
    activated_whatsapp,
    is_deploying_ws,
    created_at,
    updated_at,
    assistants_template,
  } = assistant;

  const isWhatsApp = activated_whatsapp || is_deploying_ws;
  const isActive = activated_whatsapp;
  const isDeploying = is_deploying_ws && !activated_whatsapp;

  return (
    <div className="hidden md:block md:w-[55%] lg:flex-1 p-6 overflow-y-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant={isWhatsApp ? "default" : "secondary"}>
                  {isWhatsApp ? (
                    <>
                      <MessageSquare className="h-3 w-3 mr-1" />
                      WhatsApp
                    </>
                  ) : (
                    <>
                      <Bot className="h-3 w-3 mr-1" />
                      Voice
                    </>
                  )}
                </Badge>

                {isDeploying ? (
                  <Badge variant="outline" className="text-amber-600 border-amber-600">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Deploying
                  </Badge>
                ) : isActive ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <span className="h-2 w-2 rounded-full bg-green-500 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline">Inactive</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                Updated {formatDistanceToNow(new Date(updated_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="voice" disabled={isWhatsApp}>
              Voice
            </TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            {/* Template Info */}
            {assistants_template && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Template</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{assistants_template.name}</p>
                  {assistants_template.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {assistants_template.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* AI Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">System Prompt</label>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                    {prompt || "No prompt configured"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Temperature</label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {temperature ?? "Not set"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Max Tokens</label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {token ?? "Not set"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Voice Tab */}
          <TabsContent value="voice">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Voice Configuration</h3>
                    <p className="text-sm text-muted-foreground">
                      Voice assistant ID: {assistant.voice_assistant_id || "Not configured"}
                    </p>
                  </div>
                  {assistant.documents_vapi && assistant.documents_vapi.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">VAPI Documents</h3>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {assistant.documents_vapi.map((doc, idx) => (
                          <li key={idx}>• {doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* TODO: Full integration with TabAssistantVoice component
                       Path: src/components/intelliaa/assistants/voice/TabAssistantVoice.tsx
                       Requires: Assistant state management and voice settings UI */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Document Storage</h3>
                    <p className="text-sm text-muted-foreground">
                      Namespace: {assistant.namespace}
                    </p>
                  </div>
                  {/* TODO: Full integration with AssignStorageSection component
                       Path: src/components/assistants/AssignStorageSection.tsx
                       Requires: Document storage assignment and file upload UI */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Analytics & Reports</h3>
                    <p className="text-sm text-muted-foreground">
                      Detailed reports and analytics for this assistant will appear here.
                    </p>
                  </div>
                  {/* TODO: Full integration with TabsReports component
                       Path: src/components/intelliaa/reports/TabsReports.tsx
                       Requires: Report data fetching and visualization UI */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
