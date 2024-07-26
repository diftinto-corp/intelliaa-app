"use client";

import {
  BadgeAlertIcon,
  BellIcon,
  CheckIcon,
  ClipboardIcon,
  FileTextIcon,
  GaugeIcon,
  MessageCircleIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { GetAllAssistants } from "@/lib/actions/intelliaa/assistants";
import { getAllPdf_Doc } from "@/lib/actions/intelliaa/documents";
import { getReportsWs } from "@/lib/actions/intelliaa/reports";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import { usePathname, useRouter } from "next/navigation";
import { PieChartAssistants } from "@/components/intelliaa/common/dashboard/PieChartAssistants";
import { set } from "date-fns";
import { ChartChats } from "@/components/intelliaa/common/dashboard/ChartChats";
import { usePersonalAccount } from "@usebasejump/next";

export default function HomePage() {
  const pathname = usePathname();
  const path = pathname.split("/")[1];
  const router = useRouter();

  const [assistants, setAssistants] = useState<any[] | { message: string }>([]);
  const [documents, setDocuments] = useState<any[] | { message: string }>([]);
  const [conversations, setConversations] = useState<
    any[] | { message: string }
  >([]);

  const { data: personalAccount } = usePersonalAccount();

  useEffect(() => {
    const fetchAssistants = async () => {
      const account = await getAccount();
      const account_id = account.account_id;
      const data = await GetAllAssistants(account_id);
      if (!data) {
        return;
      }
      setAssistants(data);
    };

    const fetchDocuments = async () => {
      const account = await getAccount();
      const account_id = account.account_id;
      const data = await getAllPdf_Doc(account_id);
      if (!data) {
        return;
      }

      setDocuments(data);
    };

    const fetchReportsWs = async () => {
      const account = await getAccount();
      const account_id = account.account_id;
      const data = await getReportsWs(account_id);
      if (!data) {
        return;
      }

      setConversations(data);
    };

    fetchAssistants();
    fetchDocuments();
    fetchReportsWs();
  }, []);

  const handleAddDocument = () => {
    router.push(`/${path}/documents`); // Redirige a la página de agregar documento
  };

  return (
    <div className='flex-1 p-6'>
      <section className='bg-slate-50 dark:bg-foreground p-6 md:p-10 rounded-sm'>
        <div className=' flex flex-col'>
          <h1 className='text-3xl font-bold mb-2 text-muted-foreground'>
            ¡Bienvenido de vuelta, {personalAccount?.name}!
          </h1>
          <p className='text-muted-foreground dark:text-muted-foreground mb-6'>
            Aquí hay una breve descripción general de tus asistentes de voz AI.
          </p>
          <div className='flex flex-row gap-4 w-full'>
            {/* <Card>
                <CardHeader>
                  <CardTitle className='text-muted-foreground'>
                    Active Assistants
                  </CardTitle>
                  <UsersIcon className='h-6 w-6 text-muted-foreground dark:text-gray-400' />
                </CardHeader>
                <CardContent>
                  <div className='text-4xl font-bold text-muted-foreground'>
                    {Array.isArray(assistants) ? assistants.length : 0}
                  </div>
                  <p className='text-gray-500 dark:text-gray-400 text-sm'>
                    +2 since last week
                  </p>
                </CardContent>
              </Card> */}
            {Array.isArray(assistants) && (
              <PieChartAssistants assistants={assistants} />
            )}
            {/* <Card>
                <CardHeader>
                  <CardTitle className='text-muted-foreground'>
                    Conversations
                  </CardTitle>
                  <MessageCircleIcon className='h-6 w-6 text-muted-foreground dark:text-gray-400' />
                </CardHeader>
                <CardContent>
                  <div className='text-4xl font-bold text-muted-foreground'>
                    {Array.isArray(conversations) ? conversations.length : 0}
                  </div>
                  <p className='text-gray-500 dark:text-gray-400 text-sm'>
                    +15% this month
                  </p>
                </CardContent>
              </Card> */}
            {/* <Card>
                <CardHeader>
                  <CardTitle className='text-muted-foreground'>
                    Training Progress
                  </CardTitle>
                  <GaugeIcon className='h-6 w-6 text-muted-foreground dark:text-gray-400' />
                </CardHeader>
                <CardContent>
                  <div className='text-4xl text-muted-foreground font-bold'>
                    72%
                  </div>
                  <p className='text-gray-500 dark:text-gray-400 text-sm'>
                    +5% this week
                  </p>
                </CardContent>
              </Card> */}
            {/* <Card>
                <CardHeader>
                  <CardTitle className='text-muted-foreground'>
                    Accuracy
                  </CardTitle>
                  <ClipboardIcon className='h-6 w-6 text-muted-foreground dark:text-gray-400' />
                </CardHeader>
                <CardContent>
                  <div className='text-4xl text-muted-foreground font-bold'>
                    89%
                  </div>
                  <p className='text-gray-500 dark:text-gray-400 text-sm'>
                    +2% this month
                  </p>
                </CardContent>
              </Card> */}
            <ChartChats />
          </div>
        </div>
      </section>
      <section className='p-6 md:p-10'>
        <div className=''>
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-2xl font-bold text-muted-foreground'>
              Gestión de Asistente
            </h2>
            {/* <Button onClick={() => setIsCreateModalOpen(true)}>
                <PlusIcon className='mr-2 h-4 w-4' />
                Create New Assistant
              </Button> */}
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {Array.isArray(assistants) && assistants.length > 0 ? (
              assistants.map((assistant, index) => (
                <Card key={assistant.id}>
                  <CardHeader>
                    <div className='flex items-center gap-2'>
                      <Avatar>
                        <AvatarFallback className=' text-primary font-semibold'>
                          <FaWhatsapp className='text-2xl font-semibold' />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className='font-medium text-primary'>
                          {assistant.name}
                        </p>
                        <p className='text-gray-500 dark:text-gray-400 text-sm'>
                          Active
                        </p>
                      </div>
                    </div>
                    {/* <Button variant='ghost' size='icon'>
                      <FlipVerticalIcon className='h-5 w-5 text-gray-500 dark:text-gray-400' />
                    </Button> */}
                  </CardHeader>
                  <CardContent>
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <p className='text-gray-500 dark:text-gray-400 text-sm'>
                          Documentos
                        </p>
                        <p>{assistant.type_assistant}</p>
                      </div>
                      {/* <div>
                        <p className='text-gray-500 dark:text-gray-400 text-sm'>
                          Accuracy
                        </p>
                        <p>92%</p>
                      </div>
                      <div>
                        <p className='text-gray-500 dark:text-gray-400 text-sm'>
                          Training Progress
                        </p>
                        <p>85%</p>
                      </div>
                      <div>
                        <p className='text-gray-500 dark:text-gray-400 text-sm'>
                          Language
                        </p>
                        <p>English</p>
                      </div> */}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className='flex'>
                <h3>
                  No se encontraron asistentes. Por favor, cree un nuevo
                  asistente para comenzar.
                </h3>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className='bg-slate-50 dark:bg-foreground p-6 md:p-10 rounded-sm'>
        <div className=''>
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-2xl font-bold text-muted-foreground'>
              Documentos
            </h2>
            <Button onClick={handleAddDocument}>
              <UploadIcon className='mr-2 h-4 w-4' />
              Subir documento
            </Button>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {Array.isArray(documents) && documents.length > 0 ? (
              documents.map((document) => (
                <Card>
                  <CardHeader>
                    <div className='flex items-center gap-2'>
                      <FileTextIcon className='h-6 w-6 text-gray-500 dark:text-gray-400' />
                      <div>
                        <p className='font-medium'>{document.name}</p>
                        <p className='text' />
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            ) : (
              <div className='flex'>
                <h3>
                  No se encontraron documentos. Por favor, suba un documento
                  para comenzar.
                </h3>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
