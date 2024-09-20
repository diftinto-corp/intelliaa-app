"use client";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { HelpCircle, Loader2, Play, Save, Upload } from "lucide-react";
import { MultiSelect } from "../../common/MultiSelect";
import ModalQr from "./ModalQr";
import { ModalDeleteAssistant } from "./ModalDeleteAssistant";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { Assistant } from "@/interfaces/intelliaa";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssistantSettingsProps {
  assistant: Assistant;
  temperatureState: number;
  setTemperatureState: Dispatch<SetStateAction<number>>;
  maxTokens: number;
  setMaxTokens: Dispatch<SetStateAction<number>>;
  promptState: string;
  setPromptState: Dispatch<SetStateAction<string>>;
  isWhatsappActivated: boolean;
  setIsWhatsappActivated: Dispatch<SetStateAction<boolean>>;
  KeywordTransfer: string;
  setKeywordTransfer: Dispatch<SetStateAction<string>>;
  NumberTransfer: string;
  setNumberTransfer: Dispatch<SetStateAction<string>>;
  isChangeOptions: boolean;
  setIsChangeOptions: Dispatch<SetStateAction<boolean>>;
  documents: {
    name: string;
    s3_key: string;
    id_document: string;
    namespace: string;
  }[];
  selectedDocuments: {
    name: string;
    s3_key: string;
    id_document: string;
    namespace: string;
  }[];
  setSelectedDocuments: Dispatch<
    SetStateAction<
      { name: string; s3_key: string; id_document: string; namespace: string }[]
    >
  >;
  bdDocs: any[];
  loadingAssistant: boolean;
  loadingActiveWs: boolean;
  errorMessageNumberTransfer: string;
  setErrorMessageNumberTransfer: Dispatch<SetStateAction<string>>;
  handleActivateWhatsapp: () => Promise<void>;
  handleSaveAssistant: (e: React.FormEvent) => Promise<void>;
  voiceAssistantSelected: string;
  setVoiceAssistantSelected: Dispatch<SetStateAction<string>>;
  voiceAssistant: any[];
  setVoiceAssistant: Dispatch<SetStateAction<any[]>>;
}

export default function AssistantSettings({
  assistant,
  temperatureState,
  setTemperatureState,
  maxTokens,
  setMaxTokens,
  promptState,
  setPromptState,
  isWhatsappActivated,
  setIsWhatsappActivated,
  KeywordTransfer,
  setKeywordTransfer,
  NumberTransfer,
  setNumberTransfer,
  isChangeOptions,
  setIsChangeOptions,
  documents,
  selectedDocuments,
  setSelectedDocuments,
  bdDocs,
  loadingAssistant,
  loadingActiveWs,
  errorMessageNumberTransfer,
  setErrorMessageNumberTransfer,
  handleActivateWhatsapp,
  handleSaveAssistant,
  voiceAssistantSelected,
  setVoiceAssistantSelected,
  voiceAssistant,
  setVoiceAssistant,
}: AssistantSettingsProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mp3Url, setMp3Url] = useState("");

  useEffect(() => {
    if (voiceAssistantSelected) {
      setMp3Url(`/mp3/${voiceAssistantSelected}.mp3`);
    }
  }, [voiceAssistantSelected]);

  const handlePlayAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
    }
  };

  return (
    <Card className='w-[60%] text-muted-foreground pt-6 bg-[#242322]/80 border-gray-700 shadow-[inset_0_0_20px_rgba(20,184,166,0.2)] overflow-y-auto'>
      <CardContent>
        <div className='flex justify-end gap-2 items-center'>
          {!isWhatsappActivated ? (
            <Button disabled={loadingActiveWs} onClick={handleActivateWhatsapp}>
              {loadingActiveWs ? (
                <Loader2 size={17} className='animate-spin text-white mr-2' />
              ) : (
                <>
                  <Upload size={17} className='mr-2' />
                </>
              )}
              Publicar en Whatsapp
            </Button>
          ) : (
            <ModalQr assistant={assistant} setOpenModal={() => {}} />
          )}
          <motion.div
            animate={{
              scale: isChangeOptions ? [1, 1.1, 1] : 1,
              opacity: isChangeOptions ? [1, 0.8, 1] : 1,
            }}
            transition={{
              duration: 0.6,
              repeat: isChangeOptions ? Infinity : 0,
              repeatType: "reverse",
            }}>
            <Button
              disabled={!isChangeOptions || loadingAssistant}
              onClick={handleSaveAssistant}>
              {loadingAssistant ? (
                <>
                  <Loader2 size={17} className='animate-spin text-white mr-2' />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={17} className='mr-2' />
                  Guardar
                </>
              )}
            </Button>
          </motion.div>
          <ModalDeleteAssistant
            id_assistant={assistant.id}
            namespace={assistant.namespace}
            service_id_rw={assistant.service_id_rw}
          />
        </div>
        <div className='flex flex-col'>
          <div className='flex flex-col mb-4'>
            <Label htmlFor='prompt' className='mb-2'>
              <span className='flex items-center gap-1'>
                Prompt
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
                        Ingrese aquí el mensaje o pregunta que desea enviar al
                        asistente. Este será el punto de partida para generar
                        una respuesta basada en inteligencia artificial.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </Label>
            <Textarea
              name='prompt'
              placeholder='Prompt'
              className='mx-1 w-[95%] min-h-[150px]'
              onChange={(e) => {
                setPromptState(e.target.value);
                setIsChangeOptions(true);
              }}
              value={promptState}
            />
          </div>
          <div className='flex flex-col mb-4'>
            <Label htmlFor='prompt' className='mb-2'>
              <span className='flex items-center gap-1'>
                Temperatura {temperatureState}
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
                        Ajuste el valor de la temperatura para controlar la
                        creatividad de las respuestas del asistente. Valores más
                        bajos producen respuestas más conservadoras y precisas,
                        mientras que valores más altos generan respuestas más
                        variadas y creativas.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </Label>
            <Slider
              className='mx-1 w-[95%]'
              name='temperature'
              max={1}
              step={0.1}
              defaultValue={[assistant.temperature]}
              onValueChange={([value]) => {
                setTemperatureState(value);
                setIsChangeOptions(true);
              }}
              value={[temperatureState]}
            />
          </div>
          <div className='flex flex-col mb-4'>
            <Label htmlFor='prompt' className='mb-2'>
              <span className='flex items-center gap-1'>
                Máximo de tokens {maxTokens}
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
                        Defina el número máximo de tokens (palabras y fragmentos
                        de palabras) que el asistente puede usar en su
                        respuesta. Un número mayor permite respuestas más largas
                        y detalladas, mientras que un número menor limita la
                        longitud de la respuesta.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </Label>
            <Slider
              className='mx-1 w-[95%]'
              name='tokens'
              max={1000}
              step={1}
              defaultValue={[assistant.token]}
              onValueChange={([value]) => {
                setMaxTokens(value);
                setIsChangeOptions(true);
              }}
              value={[maxTokens]}
            />
          </div>
          <div className='flex flex-col mb-4 '>
            <Label htmlFor='prompt' className='mb-2'>
              <span className='flex items-center gap-1'>
                Entrenar con documentos
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
                        Seleccione uno o varios documentos PDF previamente
                        subidos para entrenar al asistente. Esto permitirá que
                        el asistente aprenda y genere respuestas basadas en el
                        contenido de los documentos seleccionados.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </Label>
            <MultiSelect
              options={documents}
              onValueChange={(value) => {
                setSelectedDocuments(value);
                setIsChangeOptions(true);
              }}
              defaultValue={selectedDocuments as any}
              placeholder='Seleccionar documentos'
              variant='inverted'
              animation={2}
              maxCount={3}
              setIsChangeOptions={(change: any) =>
                console.log("Options changed:", change)
              }
            />
          </div>
          <div className='flex items-center mb-4'>
            <div className=''>
              <Label htmlFor='voiceAssistant' className='mb-2'>
                <span className='flex items-center gap-1'>
                  Voz del asistente
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
                          Seleccione la voz que desea usar para el asistente.
                          Puede elegir entre diferentes opciones de voces
                          disponibles para personalizar la experiencia del
                          usuario.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </Label>
              <Select
                value={voiceAssistantSelected}
                onValueChange={(value) => {
                  setVoiceAssistantSelected(value);
                  setIsChangeOptions(true);
                }}>
                <SelectTrigger className='w-[180px]'>
                  <SelectValue placeholder='Selecciona una voz' />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Voces</SelectLabel>
                    {voiceAssistant.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id_elevenlab}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handlePlayAudio}
              variant='outline'
              size='icon'
              className='ml-4 mt-4 p-2 rounded-full border-primary'>
              <Play className='text-primary' />
            </Button>
            <audio ref={audioRef} src={mp3Url} />
          </div>
          <div className='flex flex-col'>
            <p className='mb-4 text-lg font-semibold'>Opciones de Whatsapp</p>
          </div>
          <div className='flex flex-col mb-4'>
            <Label htmlFor='prompt' className='mb-2'>
              <span className='flex items-center gap-1'>
                Palabra de transferencia
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
                        Ingrese una palabra clave que el usuario del chat puede
                        usar para transferir la conversación a un asistente
                        humano. Esta palabra clave activará la transferencia
                        automática cuando sea detectada en el chat. Nota: esta
                        palabra no se podrá editar después de publicar el
                        asistente en WhatsApp.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </Label>
            <Input
              className='mx-1 w-[95%]'
              type='text'
              placeholder='TRANSFERIR'
              value={KeywordTransfer}
              onChange={(e) => {
                setKeywordTransfer(e.target.value);
                setIsChangeOptions(true);
              }}
              {...(isWhatsappActivated && { disabled: true })}
            />
          </div>
          <div className='flex flex-col'>
            <Label htmlFor='prompt' className='mb-2'>
              <span className='flex items-center gap-1'>
                Transferencia de número de Whatsapp.
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
                        Ingrese un número telefónico de WhatsApp al cual se
                        pueda transferir la conversación con el cliente.
                        Asegúrese de que el número cumpla con el formato 1XXX
                        XXXXXXX, donde el 1 es el código de país.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </Label>
            <Input
              className='mx-1 w-[95%]'
              type='text'
              placeholder='1123456789'
              value={NumberTransfer}
              onChange={(e) => {
                const value = e.target.value;
                const phoneNumberRegex = /^[0-9]{0,15}$/;

                if (phoneNumberRegex.test(value) || value === "") {
                  setNumberTransfer(value);
                  setIsChangeOptions(true);
                  setErrorMessageNumberTransfer("");
                } else {
                  setErrorMessageNumberTransfer(
                    "Please enter a valid international phone number without the " +
                      " symbol."
                  );
                }
              }}
            />
            {errorMessageNumberTransfer && (
              <p className='text-red-500 text-sm mt-2'>
                {errorMessageNumberTransfer}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
