"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, Loader2, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import ModalAddQa from "./ModalAddQa";
import ChatWsComponent from "./Chat";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import { Assistant } from "@/interfaces/intelliaa";
import { deleteDocuments, deleteQa } from "@/lib/actions/intelliaa/qa";
import { createClient } from "@/lib/supabase/client";
import ModalEditQa from "./ModalEditQa";
import { MultiSelect } from "../../common/MultiSelect";
import { getAllPdf_Doc } from "@/lib/actions/intelliaa/documents";
import {
  activateWs,
  updateAssistant,
} from "@/lib/actions/intelliaa/assistants";
import {
  activeWsService,
  createWsChatbotService,
} from "@/lib/actions/intelliaa/railway";
import ModalQr from "./ModalQr";
import { ModalDeleteAssistant } from "./ModalDeleteAssistant";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";

export default function TabAssistant({
  assistant,
  setAssistant,
  qaList,
  setQaList,
}: {
  assistant: Assistant;
  setAssistant: any;
  qaList: Array<{
    id: string;
    question: string;
    answer: string;
    id_document: string;
    namespace: string;
  }>;
  setQaList: any;
}) {
  if (!assistant) return null;
  const [temperatureState, setTemperatureState] = useState(
    assistant?.temperature || 0
  );
  const [maxTokens, setMaxTokens] = useState(assistant.token || 0);
  const [promptState, setPromptState] = useState(assistant.prompt || "");
  const [isWhatsappActivated, setIsWhatsappActivated] = useState(false);
  const [KeywordTransfer, setKeywordTransfer] = useState(
    assistant.keyword_transfer_ws || ""
  );
  const [NumberTransfer, setNumberTransfer] = useState(
    assistant.number_transfer_ws || ""
  );
  const [isChangeOptions, setIsChangeOptions] = useState(false);
  const [qaDocs, setQaDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<
    { name: string; s3_key: string; id_document: string; namespace: string }[]
  >([]);
  const [selectedDocuments, setSelectedDocuments] = useState<
    { name: string; s3_key: string; id_document: string; namespace: string }[]
  >([]);
  const [bdDocs, setBdDocs] = useState(assistant?.docs_keys || []);
  const [loadingAssistant, setLoadingAssistant] = useState(false);
  const [loadingActiveWs, setLoadingActiveWs] = useState(false);
  const [errorMessageNumberTransfer, setErrorMessageNumberTransfer] =
    useState("");

  const supabase = createClient();

  useEffect(() => {
    // Supongamos que obtienes los documentos de la base de datos y los asignas a la variable "documentos"
    const getDocuments: any = async () => {
      const account = await getAccount();
      const account_id = account.account_id;
      const data: any = await getAllPdf_Doc(account_id);
      setSelectedDocuments(bdDocs);

      if (data.length > 0) {
        const newDocuments = data.map((doc: any) => ({
          name: doc?.name,
          s3_key: doc?.s3_key,
          namespace: assistant?.namespace,
        }));
        setDocuments(newDocuments);
      }
    };
    getDocuments();
  }, []);

  useEffect(() => {
    const fetchAssistant = async () => {
      const account = await getAccount();
      const account_id = account.account_id;

      setTemperatureState(assistant.temperature || 0);
      setMaxTokens(assistant.token || 0);
      setPromptState(assistant.prompt || "");
      setIsWhatsappActivated(assistant.activated_whatsApp);
      setLoadingActiveWs(assistant.is_deploying_ws);
      setKeywordTransfer(assistant.keyword_transfer_ws || "");
      setNumberTransfer(assistant.number_transfer_ws || "");
      setSelectedDocuments(assistant.docs_keys || []);
      setBdDocs(assistant.docs_keys || []);
      // setQaDocs(qa as any);
      setIsChangeOptions(false);
      setLoading(false);
    };

    fetchAssistant();
  }, [assistant]);

  useEffect(() => {
    const channel = supabase
      .channel("assistant_docs_update")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "assistants",
        },
        (payload: any) => {
          setLoadingActiveWs(payload.new.is_deploying_ws);
          setIsWhatsappActivated(payload.new.activated_whatsApp);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setLoadingActiveWs, loadingActiveWs]);

  useEffect(() => {
    const channel = supabase
      .channel("qa_docs_update")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "qa_docs",
        },
        (payload: any) => {
          setQaList(
            qaList.map((doc) => (doc.id === payload.new.id ? payload.new : doc))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qaList]);

  useEffect(() => {
    const channel = supabase
      .channel("qa_docs_delete")
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "qa_docs",
        },
        (payload: any) => {
          setQaList(qaList.filter((doc) => doc.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qaList]);

  useEffect(() => {
    const channel = supabase
      .channel("qa_docs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "qa_docs",
        },
        (payload: any) => {
          setQaList([...qaList, payload.new as any]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qaDocs]);

  // Manejadores de eventos para detectar cambios
  const handlePromptChange = (e: any) => {
    setPromptState(e.target.value);
    setIsChangeOptions(true);
  };

  const handleTemperatureChange = ([value]: any) => {
    setTemperatureState(value);
    setIsChangeOptions(true);
  };

  const handleMaxTokensChange = ([value]: any) => {
    setMaxTokens(value);
    setIsChangeOptions(true);
  };

  const handleKeywordTransferChange = (e: any) => {
    setKeywordTransfer(e.target.value);
    setIsChangeOptions(true);
  };

  const handleNumberTransferChange = (e: any) => {
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
  };

  const handleValueChange = (
    value: {
      name: string;
      s3_key: string;
      id_document: string;
      namespace: string;
    }[]
  ) => {
    setSelectedDocuments(value);
    setIsChangeOptions(true);
  };

  const handleActivateWhatsapp = async () => {
    setLoadingActiveWs(true);
    const account = await getAccount();
    const account_id = account.account_id;

    const data = await activeWsService(
      assistant.id,
      assistant.namespace,
      KeywordTransfer
    );

    // const data = await createWsChatbotService(
    //   assistant.id,
    //   assistant.namespace,
    //   KeywordTransfer
    // );

    const url = `${data?.url}/qr.png`;

    const newassistant = await activateWs(
      assistant.id,
      data?.serviceId,
      url,
      KeywordTransfer
    );

    setAssistant(newassistant);
  };

  const handleDeleteQa = async (
    id: string,
    document_id: string,
    namespace: string
  ) => {
    setLoading(true);

    const account = await getAccount();
    const account_id = account.account_id;

    await deleteDocuments(document_id, namespace);
    await deleteQa(account_id, id);

    setLoading(false);
  };

  const handleSaveAssistant = async (e: any) => {
    e.preventDefault();
    setLoadingAssistant(true);
    const account = await getAccount();
    const account_id = account.account_id;

    const data = {
      temperature: temperatureState,
      token: maxTokens,
      prompt: promptState,
      docs_keys: selectedDocuments.map((doc) => ({
        name: doc.name,
        s3_key: doc.s3_key,
        namespace: assistant.namespace,
        id_document: Math.random().toString(36).substr(2, 9),
      })),
      keyword_transfer_ws: KeywordTransfer,
      number_transfer_ws: NumberTransfer,
      namespace: assistant.namespace,
    };

    const newBdDocs = await updateAssistant(
      account_id,
      assistant.id,
      data,
      bdDocs
    );
    setBdDocs(newBdDocs as any);
    setLoadingAssistant(false);
    setIsChangeOptions(false);
  };

  return (
    <Tabs defaultValue='settings' className='w-full '>
      <TabsList className='grid w-full grid-cols-2'>
        <TabsTrigger
          className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'
          value='settings'>
          Configuración
        </TabsTrigger>
        <TabsTrigger
          className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'
          value='questions_&_answares'>
          Preguntas y Respuestas
        </TabsTrigger>
      </TabsList>
      <TabsContent value='settings'>
        <div className='flex w-full gap-2 min-h-[68vh] max-h-[68vh] 2xl:min-h-[73vh] 2xl:max-h-[73vh] '>
          <ChatWsComponent assistant={assistant} />
          <Card className='w-[50%] py-6'>
            <CardContent>
              <div className='flex justify-end gap-2 items-center'>
                {!isWhatsappActivated ? (
                  <Button
                    disabled={loadingActiveWs}
                    onClick={handleActivateWhatsapp}>
                    {loadingActiveWs ? (
                      <Loader2
                        size={17}
                        className='animate-spin text-white mr-2'
                      />
                    ) : (
                      <>
                        <Upload size={17} className='mr-2' />
                      </>
                    )}
                    Publicar en Whatsapp
                  </Button>
                ) : (
                  <ModalQr assistant={assistant} setOpenModal={setOpen} />
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
                    onClick={(e) => handleSaveAssistant(e)}>
                    {loadingAssistant ? (
                      <>
                        <Loader2
                          size={17}
                          className='animate-spin text-white mr-2'
                        />
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
              <div className='flex flex-col py-4 overflow-y-auto'>
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
                              Ingrese aquí el mensaje o pregunta que desea
                              enviar al asistente. Este será el punto de partida
                              para generar una respuesta basada en inteligencia
                              artificial.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </span>
                  </Label>
                  <Textarea
                    name='prompt'
                    placeholder='Prompt'
                    className='mx-1 w-[95%]'
                    onChange={handlePromptChange}
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
                              Ajuste el valor de la temperatura para controlar
                              la creatividad de las respuestas del asistente.
                              Valores más bajos producen respuestas más
                              conservadoras y precisas, mientras que valores más
                              altos generan respuestas más variadas y creativas.
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
                    onValueChange={handleTemperatureChange}
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
                              Defina el número máximo de tokens (palabras y
                              fragmentos de palabras) que el asistente puede
                              usar en su respuesta. Un número mayor permite
                              respuestas más largas y detalladas, mientras que
                              un número menor limita la longitud de la
                              respuesta.
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
                    defaultValue={[assistant.token]}
                    onValueChange={handleMaxTokensChange}
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
                              subidos para entrenar al asistente. Esto permitirá
                              que el asistente aprenda y genere respuestas
                              basadas en el contenido de los documentos
                              seleccionados.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </span>
                  </Label>
                  <MultiSelect
                    options={documents}
                    onValueChange={handleValueChange as any}
                    defaultValue={selectedDocuments as any}
                    placeholder='Seleccionar documentos'
                    variant='inverted'
                    animation={2}
                    maxCount={3}
                    setIsChangeOptions={(change: boolean) =>
                      console.log("Options changed:", change)
                    }
                  />
                </div>
                <div className='flex flex-col'>
                  <p className='mb-4 text-lg font-semibold'>
                    Opciones de Whatsapp
                  </p>
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
                              Ingrese una palabra clave que el usuario del chat
                              puede usar para transferir la conversación a un
                              asistente humano. Esta palabra clave activará la
                              transferencia automática cuando sea detectada en
                              el chat. Nota: esta palabra no se podrá editar
                              después de publicar el asistente en WhatsApp.
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
                    onChange={handleKeywordTransferChange}
                    {...(isWhatsappActivated && { disabled: true })}
                  />
                </div>
                <div className='flex flex-col mb-4'>
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
                              Ingrese un número telefónico de WhatsApp al cual
                              se pueda transferir la conversación con el
                              cliente. Asegúrese de que el número cumpla con el
                              formato 1XXX XXXXXXX, donde el 1 es el código de
                              país.
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
                    onChange={handleNumberTransferChange}
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
        </div>
      </TabsContent>
      <TabsContent value='questions_&_answares'>
        {qaList.length === 0 ? (
          <div className='flex flex-col justify-center w-full gap-2 min-h-[68vh] max-h-[68vh] 2xl:min-h-[73vh] 2xl:max-h-[73vh]'>
            <div className='flex w-[40%] flex-col self-center justify-center items-center text-muted-foreground'>
              <p>Todavía no has creado una Pregunta y Respuesta.</p>
              <p>Haz clic en el botón de abajo para agregar un nuevo QA.</p>
              <ModalAddQa assistant={assistant} />
            </div>
          </div>
        ) : (
          <div className='flex flex-col justify-start w-full gap-2 min-h-[68vh] max-h-[68vh] 2xl:min-h-[73vh] 2xl:max-h-[73vh]'>
            <div className='flex w-full justify-end gap-2'>
              <ModalAddQa assistant={assistant} />
            </div>
            <div className='flex flex-wrap w-full justify-start gap-4 overflow-y-auto max-h-[60vh] mt-2 ml-4'>
              {qaList.map((qa) => (
                <Card key={qa.id} className='w-[48%]'>
                  <CardHeader>
                    <CardTitle>{qa.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{qa.answer}</CardDescription>
                  </CardContent>
                  <CardFooter className=' flex justify-between w-full '>
                    <Button
                      variant='outline'
                      size='icon'
                      type='submit'
                      onClick={() =>
                        handleDeleteQa(qa.id, qa.id_document, qa.namespace)
                      }>
                      {loading ? (
                        <Loader2 className=' animate-spin h-4 w-4 text-red-500' />
                      ) : (
                        <Trash2 className='h-4 w-4 text-red-500' />
                      )}
                    </Button>
                    <ModalEditQa
                      qa={qa}
                      setOpenModal={setOpen}
                      assistant={assistant}
                    />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
