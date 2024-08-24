"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Assistant } from "@/interfaces/intelliaa";
import { Loader2, Save } from "lucide-react";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { usePathname } from "next/navigation";

const FormSchema = z.object({
  assistant: z.string({
    required_error: "Por favor, selecciona un asistente.",
  }),
});

interface ActiveNumber {
  number: string;
  country: string;
  type: string;
  id_assistant: string;
  name_assistant: string;
  id_number_vapi: string;
}

export function FormAssignAssistantToNumber({
  number,
  assistants,
  setOpen,
}: {
  number: ActiveNumber;
  assistants: Assistant[];
  setOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const path = pathname.split("/")[1];
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      assistant: number.id_assistant || "",
    },
  });

  const { handleSubmit, setValue, watch } = form;

  const idAssistant = watch("assistant");

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    console.log("Form data:", data);

    const accounbySlugt = await getAccountBySlug(null, path);
    const account_id = accounbySlugt.account_id;

    // Check if 'no_assistant' was selected
    const isNoAssistantSelected = data.assistant === "no_assistant";

    // Determine the values to send based on whether 'no_assistant' is selected
    const id_assistant = isNoAssistantSelected ? "" : data.assistant;
    const vapi_id_assistant = isNoAssistantSelected
      ? null
      : assistants.find((assistant) => assistant.id === data.assistant)
          ?.voice_assistant_id || null;
    const name_assistant = isNoAssistantSelected
      ? ""
      : assistants.find((assistant) => assistant.id === data.assistant)?.name ||
        "";

    setLoading(true);
    try {
      const res = await fetch("/api/update-assistant-number", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_assistant,
          vapi_id_assistant,
          name_assistant,
          id_number_vapi: number.id_number_vapi,
          account_id: account_id,
        }),
      });

      if (!res.ok) {
        console.error(`HTTP error! status: ${res.status}`);
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const result = await res.json();
      console.log("Assistant assigned:", result);
    } catch (error) {
      console.error("Error assigning assistant:", error);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
        <FormField
          control={form.control}
          name='assistant'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='text-muted-foreground'>
                Selecciona Asistente
              </FormLabel>
              <Select
                {...field}
                onValueChange={(value) => {
                  console.log("Selected value:", value);
                  setValue("assistant", value); // Update the form state with the selected value
                }}
                value={idAssistant}>
                <FormControl>
                  <SelectTrigger className='text-muted-foreground'>
                    <SelectValue placeholder='Selecciona un asistente' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='no_assistant'>Ningún asistente</SelectItem>
                  {assistants.map((assistant) => (
                    <SelectItem key={assistant.id} value={assistant.id}>
                      {assistant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Selecciona el asistente que deseas asignar a este número:{" "}
                {number.number}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit' disabled={loading}>
          {loading ? (
            <Loader2 size={17} className=' animate-spin mr-2' />
          ) : (
            <Save size={17} className='mr-2' />
          )}
          Asignar a {number.number}
        </Button>
      </form>
    </Form>
  );
}
