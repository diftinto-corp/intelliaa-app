import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for Voice Assistant settings form
 *
 * Matches the exact layout of AssistantSettings (Voice) to prevent layout shift.
 * Displays during initial load while fetching assistant data.
 *
 * Layout:
 * - Two-column layout on large screens (70% / 30%)
 * - Full width on mobile
 * - All skeletons match actual component dimensions
 *
 * @example
 * ```tsx
 * {loading ? (
 *   <VoiceAssistantFormSkeleton />
 * ) : (
 *   <AssistantSettings {...props} />
 * )}
 * ```
 */
export function VoiceAssistantFormSkeleton() {
  return (
    <Card className="flex flex-col w-[100%] text-muted-foreground dark:bg-[#242322]/80 dark:border-gray-700 dark:shadow-[inset_0_0_20px_rgba(20,184,166,0.2)] overflow-y-auto">
      {/* Header with buttons */}
      <div className="flex justify-end gap-2 items-center pt-6 mr-2">
        <Skeleton className="h-10 w-[150px]" /> {/* Iniciar llamada button */}
        <Skeleton className="h-10 w-[120px]" /> {/* Guardar button */}
        <Skeleton className="h-10 w-10" /> {/* Delete button */}
      </div>

      <div className="flex flex-col lg:flex-row py-6 gap-4">
        {/* Main content area (70%) */}
        <CardContent className="w-full lg:w-[70%] space-y-6">
          {/* Prompt field */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[80px]" /> {/* Label */}
            <Skeleton className="h-[150px] w-full" /> {/* Textarea */}
          </div>

          {/* Temperature slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-[100px]" /> {/* Label */}
              <Skeleton className="h-4 w-[40px]" /> {/* Value */}
            </div>
            <Skeleton className="h-6 w-full" /> {/* Slider */}
          </div>

          {/* Max tokens slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-[120px]" /> {/* Label */}
              <Skeleton className="h-4 w-[40px]" /> {/* Value */}
            </div>
            <Skeleton className="h-6 w-full" /> {/* Slider */}
          </div>

          {/* Welcome message */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[150px]" /> {/* Label */}
            <Skeleton className="h-[100px] w-full" /> {/* Textarea */}
          </div>

          {/* End call message */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[180px]" /> {/* Label */}
            <Skeleton className="h-[100px] w-full" /> {/* Textarea */}
          </div>

          {/* Voicemail message */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px]" /> {/* Label */}
            <Skeleton className="h-[100px] w-full" /> {/* Textarea */}
          </div>

          {/* End call phrases */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[150px]" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* MultiSelect */}
          </div>
        </CardContent>

        {/* Sidebar area (30%) */}
        <CardContent className="w-full lg:w-[30%] space-y-6">
          {/* Voice selection */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[100px]" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Select */}
          </div>

          {/* Audio preview */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[120px]" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Play button */}
          </div>

          {/* Document storage */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[150px]" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Select */}
          </div>

          {/* Toggle switches */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-[120px]" /> {/* Label */}
              <Skeleton className="h-6 w-11" /> {/* Switch */}
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-[140px]" />
              <Skeleton className="h-6 w-11" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-[160px]" />
              <Skeleton className="h-6 w-11" />
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

/**
 * Skeleton loader for WhatsApp Assistant settings form
 *
 * Matches the exact layout of AssistantSettings (WhatsApp).
 * Single column layout with chat preview on the right.
 *
 * @example
 * ```tsx
 * {loading ? (
 *   <WhatsAppAssistantFormSkeleton />
 * ) : (
 *   <AssistantSettings {...props} />
 * )}
 * ```
 */
export function WhatsAppAssistantFormSkeleton() {
  return (
    <Card className="w-[60%] text-muted-foreground pt-6 dark:bg-[#242322]/80 dark:border-gray-700 dark:shadow-[inset_0_0_20px_rgba(20,184,166,0.2)] overflow-y-auto">
      <CardContent>
        {/* Header with buttons */}
        <div className="flex justify-end gap-2 items-center mb-6">
          <Skeleton className="h-10 w-[180px]" /> {/* Publicar/Ver QR button */}
          <Skeleton className="h-10 w-[120px]" /> {/* Guardar button */}
          <Skeleton className="h-10 w-10" /> {/* Delete button */}
        </div>

        {/* Form fields */}
        <div className="space-y-6">
          {/* Prompt field */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[80px]" /> {/* Label */}
            <Skeleton className="h-[150px] w-full" /> {/* Textarea */}
          </div>

          {/* Temperature slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-[100px]" /> {/* Label */}
              <Skeleton className="h-4 w-[40px]" /> {/* Value */}
            </div>
            <Skeleton className="h-6 w-full" /> {/* Slider */}
          </div>

          {/* Max tokens slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-[120px]" /> {/* Label */}
              <Skeleton className="h-4 w-[40px]" /> {/* Value */}
            </div>
            <Skeleton className="h-6 w-full" /> {/* Slider */}
          </div>

          {/* Voice assistant selection */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[140px]" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Select */}
          </div>

          {/* Audio preview */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[120px]" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Play button */}
          </div>

          {/* Keyword transfer */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[180px]" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Input */}
          </div>

          {/* Number transfer */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px]" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Input */}
          </div>

          {/* Document storage assignment */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[180px]" /> {/* Label */}
            <Skeleton className="h-[200px] w-full" /> {/* AssignStorageSection */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact skeleton for assistant list items
 * Used while loading the list of assistants
 *
 * @example
 * ```tsx
 * {loadingAssistants ? (
 *   <>
 *     <AssistantListItemSkeleton />
 *     <AssistantListItemSkeleton />
 *     <AssistantListItemSkeleton />
 *   </>
 * ) : (
 *   assistants.map(a => <AssistantListItem key={a.id} {...a} />)
 * )}
 * ```
 */
export function AssistantListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border-b">
      <Skeleton className="h-10 w-10 rounded-full" /> {/* Avatar */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-[150px]" /> {/* Name */}
        <Skeleton className="h-3 w-[100px]" /> {/* Type/Status */}
      </div>
      <Skeleton className="h-8 w-8 rounded" /> {/* Action button */}
    </div>
  );
}

/**
 * Full page skeleton for assistants page
 * Shows skeleton for both list and detail panel
 *
 * @example
 * ```tsx
 * {initialLoading ? (
 *   <AssistantsPageSkeleton />
 * ) : (
 *   <AssistantsContent {...props} />
 * )}
 * ```
 */
export function AssistantsPageSkeleton() {
  return (
    <div className="flex h-full gap-4 p-4">
      {/* List panel */}
      <div className="w-[400px] space-y-2">
        <Skeleton className="h-10 w-full mb-4" /> {/* Search bar */}
        <AssistantListItemSkeleton />
        <AssistantListItemSkeleton />
        <AssistantListItemSkeleton />
        <AssistantListItemSkeleton />
        <AssistantListItemSkeleton />
      </div>

      {/* Detail panel */}
      <div className="flex-1">
        <VoiceAssistantFormSkeleton />
      </div>
    </div>
  );
}
