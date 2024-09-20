import { Dispatch, SetStateAction, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  HelpCircle,
  Loader2,
  Play,
  Save,
  Speech,
  StopCircle,
} from "lucide-react";
import { MultiSelect } from "../../common/MultiSelect";
import { ModalDeleteAssistantVoice } from "./ModalDeleteAssistantVoice";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { Assistant } from "@/interfaces/intelliaa";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import Vapi from "@vapi-ai/web";
import { MultiSelectVoice } from "../../common/MultiSelectVoice";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AssistantSettingsProps {
  assistant: Assistant;
  temperatureState: number;
  setTemperatureState: Dispatch<SetStateAction<number>>;
  maxTokens: number;
  setMaxTokens: Dispatch<SetStateAction<number>>;
  promptState: string;
  setPromptState: Dispatch<SetStateAction<string>>;
  isChangeOptions: boolean;
  setIsChangeOptions: Dispatch<SetStateAction<boolean>>;
  documents: { name: string; id_vapi_doc: string }[];
  selectedDocuments: string[];
  setSelectedDocuments: Dispatch<SetStateAction<string[]>>;
  loadingAssistant: boolean;
  loadingActiveWs: boolean;
  handleSaveAssistant: (e: React.FormEvent) => Promise<void>;
  welcomeMessage: string;
  setWelcomeMessage: Dispatch<SetStateAction<string>>;
  voiceAssistant: any[];
  setVoiceAssistant: Dispatch<SetStateAction<any[]>>;
  handleTestAssistantVoice: () => Promise<void>;
  recordCall: boolean;
  setRecordCall: Dispatch<SetStateAction<boolean>>;
  detectEmotion: boolean;
  setDetectEmotion: Dispatch<SetStateAction<boolean>>;
  backgroundOffice: boolean;
  setBackgroundOffice: Dispatch<SetStateAction<boolean>>;
  welcomeMessageAssistant: string;
  setWelcomeMessageAssistant: Dispatch<SetStateAction<string>>;
  voiceAssistantSelected: string;
  setVoiceAssistantSelected: Dispatch<SetStateAction<string>>;
  endCallMessage: string;
  setEndCallMessage: Dispatch<SetStateAction<string>>;
  voicemailMessage: string;
  setVoicemailMessage: Dispatch<SetStateAction<string>>;
  endCallPhrases: string[];
  setEndCallPhrases: Dispatch<SetStateAction<string[]>>;
  bdDocs: any[];
}

const api_key_vapi = process.env.NEXT_PUBLIC_VAPI_KEY || "";
const vapi = new Vapi(api_key_vapi);

export default function AssistantSettings({
  assistant,
  temperatureState,
  setTemperatureState,
  maxTokens,
  setMaxTokens,
  promptState,
  setPromptState,
  welcomeMessage,
  setWelcomeMessage,
  voiceAssistant,
  setVoiceAssistant,
  handleTestAssistantVoice,
  isChangeOptions,
  setIsChangeOptions,
  documents,
  selectedDocuments,
  setSelectedDocuments,
  loadingAssistant,
  loadingActiveWs,
  handleSaveAssistant,
  recordCall,
  setRecordCall,
  detectEmotion,
  setDetectEmotion,
  backgroundOffice,
  setBackgroundOffice,
  voiceAssistantSelected,
  setVoiceAssistantSelected,
  endCallMessage,
  setEndCallMessage,
  voicemailMessage,
  setVoicemailMessage,
  endCallPhrases,
  setEndCallPhrases,
}: AssistantSettingsProps) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
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

  useEffect(() => {
    vapi.on("call-start", () => {
      setConnecting(false);
      setConnected(true);
    });

    vapi.on("call-end", () => {
      setConnecting(false);
      setConnected(false);
    });

    vapi.on("error", (e) => {
      console.error(e);
      setConnecting(false);
    });
  }, []);

  const handleCallAssistant = async () => {
    setConnecting(true);
    try {
      await vapi.start(assistant.voice_assistant_id);
    } catch (error) {
      console.error("Error starting the call: ", error);
      setConnecting(false);
    }
  };

  const handleStopCallAssistant = async () => {
    try {
      await vapi.stop();
    } catch (error) {
      console.error("Error stopping the call: ", error);
    }
  };

  return (
    <Card className='flex flex-col w-[100%] text-muted-foreground bg-[#242322]/80 border-gray-700 shadow-[inset_0_0_20px_rgba(20,184,166,0.2)]  overflow-y-auto'>
      <div className='flex justify-end gap-2 items-center pt-6 mr-2'>
        {!connected && (
          <Button onClick={handleCallAssistant} disabled={connecting}>
            {connecting ? (
              <Loader2 size={17} className='animate-spin text-white mr-2' />
            ) : (
              <Speech size={17} className='mr-2' />
            )}
            Iniciar llamada
          </Button>
        )}
        {connected && (
          <Button variant='destructive' onClick={handleStopCallAssistant}>
            <StopCircle size={17} className='mr-2' />
            Terminar llamada
          </Button>
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
        <ModalDeleteAssistantVoice
          id_assistant={assistant.id}
          voice_assistant_id={assistant.voice_assistant_id}
        />
      </div>
      <div className='flex py-6'>
        <CardContent className='w-[70%]'>
          <div className='flex flex-col py-4 overflow-y-auto'>
            <div className='flex flex-col mb-4'>
              <Label htmlFor='prompt' className='mb-2'>
                <span className='flex items-center gap-1'>
                  Mensaje de bienvenida.
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
                          Ingrese un mensaje de bienvenida para el asistente de
                          voz. Este mensaje debe proporcionar el contexto
                          adecuado, ya sea para una llamada saliente iniciada
                          por el asistente o para cuando el asistente reciba una
                          llamada.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </Label>
              <Input
                name='prompt'
                placeholder='Mensaje de bienvenida'
                className='mx-1 w-[95%]'
                onChange={(e) => {
                  setWelcomeMessage(e.target.value);
                  setIsChangeOptions(true);
                }}
                value={welcomeMessage}
              />
            </div>
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
                className='mx-1 w-[95%] max-h-[500px] min-h-[150px]'
                onChange={(e) => {
                  setPromptState(e.target.value);
                  setIsChangeOptions(true);
                }}
                value={promptState}
              />
            </div>
            <div className='flex flex-col mt-4 p-1'>
              <Label htmlFor='endCallMessage' className='mb-2'>
                <span className='flex items-center gap-1'>
                  Mensaje de fin de llamada
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
                          Ingrese un mensaje de despedida para el asistente de
                          voz. Este mensaje se mostrará al finalizar una
                          llamada.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </Label>
              <Textarea
                name='endCallMessage'
                placeholder='Mensaje de fin de llamada'
                className='mx-1 w-[95%]'
                onChange={(e) => {
                  setEndCallMessage(e.target.value);
                  setIsChangeOptions(true);
                }}
                value={endCallMessage}
              />
            </div>
            <div className='flex flex-col mt-4 p-1'>
              <Label htmlFor='voicemailMessage' className='mb-2'>
                <span className='flex items-center gap-1'>
                  Mensaje de buzón de voz
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
                          Ingrese un mensaje para el buzón de voz del asistente.
                          Este mensaje se mostrará cuando el asistente no pueda
                          responder a una llamada.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </Label>
              <Textarea
                name='voicemailMessage'
                placeholder='Mensaje de buzón de voz'
                className='mx-1 w-[95%]'
                onChange={(e) => {
                  setVoicemailMessage(e.target.value);
                  setIsChangeOptions(true);
                }}
                value={voicemailMessage}
              />
            </div>
          </div>
        </CardContent>
        <CardContent className='w-[30%] px-2'>
          <div className='flex flex-col py-4'>
            <div className='flex flex-col mb-4 p-1'>
              <Label htmlFor='temperature' className='mb-2'>
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
                          creatividad de las respuestas del asistente. Valores
                          más bajos producen respuestas más conservadoras y
                          precisas, mientras que valores más altos generan
                          respuestas más variadas y creativas.
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
                onValueChange={([value]) => {
                  setTemperatureState(value);
                  setIsChangeOptions(true);
                }}
                value={[temperatureState]}
              />
            </div>
            <div className='flex flex-col mb-4 p-1'>
              <Label htmlFor='maxTokens' className='mb-2'>
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
                          Defina el número máximo de tokens (palabras y
                          fragmentos de palabras) que el asistente puede usar en
                          su respuesta. Un número mayor permite respuestas más
                          largas y detalladas, mientras que un número menor
                          limita la longitud de la respuesta.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </Label>
              <Slider
                className='mx-1 w-[95%]'
                name='tokens'
                max={500}
                step={1}
                onValueChange={([value]) => {
                  setMaxTokens(value);
                  setIsChangeOptions(true);
                }}
                value={[maxTokens]}
              />
            </div>
            <div className='flex flex-col mb-4 p-1'>
              <Label htmlFor='documents' className='mb-2'>
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
              <MultiSelectVoice
                options={documents}
                onValueChange={(value) => {
                  setSelectedDocuments(value);
                  setIsChangeOptions(true);
                }}
                defaultValue={selectedDocuments}
                placeholder='Seleccionar documentos'
                variant='inverted'
                animation={2}
                maxCount={3}
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
            <div className='flex items-center space-x-2 p-1'>
              <Switch
                id='detect-emotion'
                checked={detectEmotion}
                onCheckedChange={(checked) => {
                  setDetectEmotion(checked);
                  setIsChangeOptions(true);
                }}
              />
              <Label htmlFor='detect-emotion' className='mb-2'>
                <span className='flex items-center gap-1'>
                  Detectar emociones
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
                          Habilite esta opción para que el asistente pueda
                          detectar emociones en las interacciones.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </Label>
            </div>
            <div className='flex items-center space-x-2 p-1 mt-2'>
              <Switch
                id='background-office'
                checked={backgroundOffice}
                onCheckedChange={(checked) => {
                  setBackgroundOffice(checked);
                  setIsChangeOptions(true);
                }}
              />
              <Label htmlFor='background-office' className='mb-2'>
                <span className='flex items-center gap-1'>
                  Sonido de fondo de oficina
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
                          Habilite esta opción para añadir sonido de fondo de
                          oficina durante las llamadas.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </Label>
            </div>
            <div className='flex items-center space-x-2 p-1 mt-2'>
              <Switch
                id='record-call'
                checked={recordCall}
                onCheckedChange={(checked) => {
                  setRecordCall(checked);
                  setIsChangeOptions(true);
                }}
              />
              <Label htmlFor='record-call' className='mb-2'>
                <span className='flex items-center gap-1'>
                  Grabar llamadas
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
                          Habilite esta opción para grabar las llamadas
                          realizadas por el asistente.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </Label>
            </div>
            <div className='flex flex-col mt-4 p-1'>
              <Label htmlFor='endCallPhrases' className='mb-2'>
                <span className='flex items-center gap-1'>
                  Frases de fin de llamada
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
                          Ingrese una o varias frases que el asistente puede
                          utilizar al finalizar una llamada.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </Label>
              <Textarea
                name='endCallPhrases'
                placeholder='Frases de fin de llamada'
                className='mx-1 w-[95%]'
                onChange={(e) => {
                  setEndCallPhrases(e.target.value.split("\n"));
                  setIsChangeOptions(true);
                }}
                value={endCallPhrases.join("\n")}
              />
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
