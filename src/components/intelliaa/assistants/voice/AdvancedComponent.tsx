"use client";
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
import ModalAddQa from "./ModalAddQa";
import {
  Copy,
  HelpCircle,
  Loader2,
  PhoneCall,
  Save,
  Trash2,
} from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import EmbedCodeBlock from "./EmbedCodeBlock";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Assistant } from "@/interfaces/intelliaa";
import { set } from "date-fns";

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
  const [number, setNumber] = useState<NumbersActive>({} as NumbersActive);
  const [numberTransfer, setNumberTransfer] = useState<string>("");
  const [loadingSave, setLoadingSave] = useState(false);
  const [numberToCall, setNumberToCall] = useState<string>("");
  const [loadingCall, setLoadingCall] = useState(false);

  const embedCode = `

  <script defer="defer" src="https://diftinto-corp.github.io/ctc_out_intelliaa/static/js/main.js"></script>
  <int-widget 
    id_number_vapi= "${number.id_number_vapi || ""}"
    voice_assistant_id= "${assistant.voice_assistant_id || ""}"
    btn-color="#8200d1">
  </int-widget>`;

  useEffect(() => {
    //get numbers from supabase table active_numbers
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
      setNumber(
        data[0] || {
          id: "",
          number: "",
          is_active: false,
        }
      );
      setNumberTransfer(data[0]?.number_transfer || "");
    };

    getNumber();
    getNumbers();
  }, []);

  const handleSaveNumber = async () => {
    if (!number) return;

    setLoadingSave(true);
    const supabase = createClient();

    try {
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

      console.log(data[0].number_transfer);

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
          id_number_vapi: number.id_number_vapi,
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
      <Card className='flex flex-col min-h-[70vh]'>
        <CardHeader></CardHeader>
        <CardContent>
          <CardDescription>
            <div className='flex flex-row justify-between items-center gap-4'>
              <EmbedCodeBlock code={embedCode.trim()} />
              <div className='flex flex-col w-[50%] min-h-[60vh] border rounded-sm p-4'>
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
                        const selectedNumber = numbers.find(
                          (num) => num.number === value
                        );
                        setNumber(selectedNumber || ({} as NumbersActive));
                      }}
                      value={number?.number || ""}>
                      <SelectTrigger className='w-[50%]'>
                        <SelectValue placeholder='Seleccionar Número' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Número</SelectLabel>
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
                    className='bg-primary text-white mt-2'
                    onClick={handleSaveNumber}>
                    {loadingSave ? (
                      <>
                        <Loader2 size={17} className=' animate-spin mr-2' />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save size={17} className='mr-2' />
                        Guardar
                      </>
                    )}
                  </Button>
                </div>
                <div className='border rounded-sm p-4 mt-4'>
                  <div className='flex flex-col mb-4'>
                    <Label htmlFor='prompt' className='mb-2'>
                      <span className='flex items-center gap-1'>
                        Probar llamada Saliente
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
                                Haz una llamada de prueba a un número
                                telefónico.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    </Label>
                    <div className='flex w-full'>
                      <Input
                        name='numberTransfer'
                        placeholder='+1 123 456 7890'
                        className='mx-1 w-[50%]'
                        onChange={(e) => setNumberToCall(e.target.value)}
                        value={numberToCall}
                      />
                      <Button
                        className='bg-primary text-white ml-2'
                        onClick={handleCall}>
                        {loadingCall ? (
                          <>
                            <Loader2 size={17} className=' animate-spin mr-2' />
                            Llamando...
                          </>
                        ) : (
                          <>
                            <PhoneCall size={17} className='mr-2' />
                            Llamar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardDescription>
        </CardContent>
        <CardFooter></CardFooter>
      </Card>
    </TabsContent>
  );
}
