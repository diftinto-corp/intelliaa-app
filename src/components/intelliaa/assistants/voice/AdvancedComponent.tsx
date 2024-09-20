import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Assistant } from "@/interfaces/intelliaa";
import { HelpCircle } from "lucide-react";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { Save } from "lucide-react";
import { PhoneCall } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import EmbedCodeBlock from "./EmbedCodeBlock";

interface NumbersActive {
  id: string;
  number: string;
  is_active: boolean;
  id_number_vapi: string;
}

export default function AdvancedComponent({
  assistant,
}: {
  assistant: Assistant;
}) {
  const [numbers, setNumbers] = useState<NumbersActive[]>([]);
  const [number, setNumber] = useState<NumbersActive | null>(null);
  const [numberTransfer, setNumberTransfer] = useState<string>("");
  const [loadingSave, setLoadingSave] = useState(false);
  const [numberToCall, setNumberToCall] = useState<string>("");
  const [loadingCall, setLoadingCall] = useState(false);

  const embedCode = `
    <script defer="defer" src="https://diftinto-corp.github.io/ctc_out_intelliaa/static/js/main.js"></script>
    <ctc_intelliaa 
      id_number_vapi="${number?.id_number_vapi || ""}"
      voice_assistant_id="${assistant.voice_assistant_id || ""}"
      btn-color="#8200d1">
    </ctc_intelliaa>`;

  useEffect(() => {
    const getNumbers = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("active_numbers").select("*");
      if (error) {
        console.log("Error", error);
        return;
      }
      setNumbers(data);
    };

    const getNumber = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("active_numbers")
        .select("*")
        .eq("id_assistant", assistant.id);

      if (error) {
        console.log("Error", error);
        return;
      }
      setNumber(data[0] || null);
      setNumberTransfer(data[0]?.number_transfer || "");
    };

    getNumber();
    getNumbers();
  }, [assistant.id]);

  const handleSaveNumber = async () => {
    const supabase = createClient();

    setLoadingSave(true);
    try {
      if (number === null) {
        // Handle saving "Sin número"
        const { data, error } = await supabase
          .from("active_numbers")
          .update({
            id_assistant: "",
            name_assistant: "",
            is_active: false,
            number_transfer: "",
          })
          .eq("id_assistant", assistant.id)
          .select("*");

        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }

        if (!data || data.length === 0) {
          throw new Error("No data returned from Supabase");
        }

        const res = await fetch("/api/update-active-number", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id_number_vapi: data[0].id_number_vapi,
            number_transfer: "",
            voice_assistant_id: null,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const result = await res.json();
        console.log("API Response:", result);
        return result;
      } else {
        // Handle saving selected number
        const { data, error } = await supabase
          .from("active_numbers")
          .update({
            id_assistant: assistant.id,
            name_assistant: assistant.name,
            is_active: true,
            number_transfer: numberTransfer,
          })
          .eq("number", number.number)
          .select("*");

        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }

        if (!data || data.length === 0) {
          throw new Error("No data returned from Supabase");
        }

        const res = await fetch("/api/update-active-number", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id_number_vapi: data[0].id_number_vapi,
            number_transfer: data[0].number_transfer,
            voice_assistant_id: assistant.voice_assistant_id,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const result = await res.json();
        console.log("API Response:", result);
        return result;
      }
    } catch (error) {
      console.error("Error during handleSaveNumber:", error);
    } finally {
      setLoadingSave(false);
    }
  };

  const handleCall = async () => {
    setLoadingCall(true);
    try {
      const res = await fetch("/api/create-call-voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_number_vapi: number?.id_number_vapi || "",
          voice_assistant_id: assistant.voice_assistant_id,
          numberTocall: numberToCall,
        }),
      });
    } catch (error) {
      console.error("Error during handleCall:", error);
    } finally {
      setLoadingCall(false);
    }
  };

  return (
    <TabsContent value='advanced'>
      <div className='flex flex-col min-h-[70vh] p-4'> 
        <div className='flex flex-col min-h-[70vh]'>
          <div>
            <div className='flex flex-row justify-between items-center gap-4'>
              <EmbedCodeBlock code={embedCode.trim()} />
              <div className='flex flex-col bg-[#242322]/80 border-gray-700 text-muted-foreground shadow-[inset_0_0_20px_rgba(20,184,166,0.2)] w-[50%] min-h-[70vh] border rounded-sm p-4'>
                <div className='border rounded-sm p-4'>
                  <div className='flex flex-col mb-4 p-1'>
                    <Label htmlFor='documents' className='mb-2'>
                      <span className='flex items-center gap-1'>
                        Selecciona un número telefónico
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle
                                className='text-primary cursor-pointer'
                                size={14}
                              />
                            </TooltipTrigger>
                            <TooltipContent
                              side='bottom'
                              align='center'
                              className='p-4 w-[300px]'>
                              <p className='font-normal text-mute-foreground'>
                                Selecciona un número telefónico para el
                                asistente.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    </Label>
                    <Select
                      onValueChange={(value) => {
                        if (value === "sin numero") {
                          setNumber(null);
                        } else {
                          const selectedNumber = numbers.find(
                            (num) => num.number === value
                          );
                          setNumber(selectedNumber || null);
                        }
                      }}
                      value={number?.number || "sin numero"}>
                      <SelectTrigger className='w-[50%]'>
                        <SelectValue placeholder='Seleccionar Número' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Número</SelectLabel>
                          <SelectItem value='sin numero'>Sin número</SelectItem>
                          {numbers.map((num) => (
                            <SelectItem key={num.id} value={num.number}>
                              {num.number}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='flex flex-col mb-4'>
                    <Label htmlFor='prompt' className='mb-2'>
                      <span className='flex items-center gap-1'>
                        Transferir a un número telefónico
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle
                                className='text-primary cursor-pointer'
                                size={14}
                              />
                            </TooltipTrigger>
                            <TooltipContent
                              side='bottom'
                              align='center'
                              className='p-4 w-[300px]'>
                              <p className='font-normal text-mute-foreground'>
                                Ingresa el número telefónico al que se
                                transferirá la llamada.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    </Label>
                    <Input
                      name='numberTransfer'
                      placeholder='+1 123 456 7890'
                      className='mx-1 w-[50%]'
                      onChange={(e) => setNumberTransfer(e.target.value)}
                      value={numberTransfer}
                    />
                  </div>
                  <Button
                    className='bg-primary mt-2'
                    onClick={handleSaveNumber}
                    disabled={loadingSave}>
                    {loadingSave ? (
                      <>
                        <Loader2 size={17} className=' animate-spin mr-2' />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save size={17} className='mr-2' />
                        Guardar Número
                      </>
                    )}
                  </Button>
                </div>

                <div className='flex flex-col mt-4'>
                  <Label htmlFor='numberToCall' className='mb-2'>
                    <span className='flex items-center gap-1'>
                      Realizar llamada de prueba
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle
                              className='text-primary cursor-pointer'
                              size={14}
                            />
                          </TooltipTrigger>
                          <TooltipContent
                            side='bottom'
                            align='center'
                            className='p-4 w-[300px]'>
                            <p className='font-normal text-mute-foreground'>
                              Ingresa el número telefónico al que se realizará
                              la llamada de prueba.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </span>
                  </Label>
                  <div className='flex items-center gap-2'>
                    <Input
                      name='numberToCall'
                      placeholder='+1 123 456 7890'
                      className='mx-1 w-[50%]'
                      onChange={(e) => setNumberToCall(e.target.value)}
                      value={numberToCall}
                    />
                    <Button
                      className='bg-primary'
                      onClick={handleCall}
                      disabled={loadingCall}>
                      {loadingCall ? (
                        <>
                          <Loader2 size={17} className='animate-spin mr-2' />
                          Llamando...
                        </>
                      ) : (
                        <>
                          <PhoneCall size={17} className='mr-2' />
                          Realizar llamada
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </TabsContent>
  );
}
