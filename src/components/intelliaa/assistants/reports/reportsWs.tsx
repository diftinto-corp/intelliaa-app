import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { getReportsWs } from "@/lib/actions/intelliaa/reports";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import ChatHistory from "./ChatHistory";
import FormAddQaRegisterComponent from "./FormAddQaRegister";
import { GetAssistant } from "@/lib/actions/intelliaa/assistants";

type ReportWs = {
  id: string;
  user_number: string;
  assistant_name: string;
  chat_history: any[];
  answers: number;
  wrong_answers: number;
  assistant_id: string;
};

export function ReportWsComponent() {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];

  const [isOpen, setIsOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportWs | null>(null);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [reports, setReports] = useState<ReportWs[]>([]);
  const [loading, setLoading] = useState(false);
  const [account_id, setAccount_id] = useState<string>("");
  const [assistant, setAssistant] = useState<any>({});

  console.log(selectedReport);

  console.log(selectedChat);

  console.log(assistant);

  useEffect(() => {
    const getAssistant = async () => {
      if (selectedReport) {
        // Check if selectedReport is not null
        const team_account = await getAccountBySlug(null, accountSlug);
        const assistant = await GetAssistant(
          team_account.account_id,
          selectedReport.assistant_id
        );
        setAssistant(assistant);
      } else {
        console.warn("selectedReport is null");
        // Handle the case when selectedReport is null, if necessary
      }
    };
    getAssistant();
  }, [accountSlug, selectedReport]);

  useEffect(() => {
    const fetchReports = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      setAccount_id(team_account.account_id as string);

      setLoading(true);
      const data = await getReportsWs(account_id);

      if (Array.isArray(data)) {
        setReports(data);
      } else {
        console.error("Error fetching reports:", data.message);
        setReports([]);
      }
      setLoading(false);
    };

    fetchReports();
  }, [accountSlug, account_id]);

  const handleRowClick = (report: ReportWs) => {
    setSelectedReport(report);
    setIsOpen(true);
    setSelectedChat(null); // Reset selected chat when a new report is selected
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedReport(null);
      setSelectedChat(null);
    }
  };

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("report_ws")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "report_ws",
        },
        (payload: any) => {
          const { new: newReport } = payload.record;
          setReports((prevReports) => [newReport, ...prevReports]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reports]);

  return (
    <div className='flex flex-col w-[100%] p-4 min-h-[75vh]'>
      {reports.length > 0 ? (
        <>
          <div className='flex-grow'>
            <Table>
              <TableHeader>
                <TableRow className='bg-foreground'>
                  <TableHead className='text-primary'>Número</TableHead>
                  <TableHead className='text-primary'>Asistente</TableHead>
                  <TableHead className='text-primary'>Pregunta</TableHead>
                  <TableHead className='text-primary'>Respuesta</TableHead>
                  <TableHead className='text-primary'>Respondidas</TableHead>
                  <TableHead className='text-primary'>No respondidas</TableHead>
                  <TableHead className='text-primary'>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const lastChat =
                    report.chat_history[report.chat_history.length - 1];
                  return (
                    <TableRow
                      key={report.id}
                      onClick={() => handleRowClick(report)}
                      className='cursor-pointer text-muted-foreground hover:bg-muted hover:text-white'>
                      <TableCell>{report.user_number}</TableCell>
                      <TableCell>{report.assistant_name}</TableCell>
                      <TableCell>{lastChat?.question}</TableCell>
                      <TableCell className='max-w-[300px]'>
                        {lastChat?.answer}
                      </TableCell>
                      <TableCell>{report.answers}</TableCell>
                      <TableCell className='text-red-500'>
                        {report.wrong_answers}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant='outline'
                          className={
                            lastChat?.is_audio
                              ? "bg-violet-400 text-white"
                              : "bg-cyan-400 text-white"
                          }>
                          {lastChat?.is_audio ? "Audio" : "Texto"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className='flex items-center justify-center h-full'>
          <p className='text-muted-foreground'>
            {loading ? "Cargando..." : "Aún no hay registros que mostrar."}
          </p>
        </div>
      )}
      <Sheet open={isOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side='right' className='w-[400px] sm:w-[540px]'>
          <SheetHeader>
            <SheetTitle className='text-primary'>
              {selectedReport?.assistant_name}
            </SheetTitle>
            <SheetDescription>
              Número del usuario: {selectedReport?.user_number}
            </SheetDescription>
          </SheetHeader>
          <div className='w-full mt-6 space-y-4'>
            {selectedReport && (
              <>
                <div>
                  <h3 className='text-muted-foreground font-semibold'>
                    Editar Pregunta y Respuesta
                  </h3>
                  <p className='text-sm text-muted-foreground mb-4'>
                    Selecciona una pregunta y respuesta del historial de chat
                    para editarla o ingresa una nueva.
                  </p>
                  <FormAddQaRegisterComponent
                    register={selectedChat || {}} // Fallback to an empty object if no chat is selected
                    assistant={assistant || {}} // Lógica para obtener el assistant aquí
                    lastChat={selectedChat}
                  />
                </div>
                <div>
                  <h3 className='text-muted-foreground font-semibold'>
                    Historial de Chat
                  </h3>
                  <p className='text-sm text-muted-foreground mb-4'>
                    Aquí puedes ver las preguntas y respuestas previas para este
                    usuario.
                  </p>
                  <ChatHistory
                    chatHistory={selectedReport.chat_history}
                    setRegisterSelected={setSelectedChat}
                    containerStyle={{ maxWidth: "100%" }} // Limita el ancho al 90% del Sheet
                  />
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
