"use client";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getReportsWs } from "@/lib/actions/intelliaa/reports";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useAccounts } from "@usebasejump/next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Eye } from "lucide-react";
import ModalEditRegister from "./ModalEditRegister";
import { Input } from "@/components/ui/input";
import { Search } from "../../common/inputSearch";

export function ReportWsComponent() {
  const { data } = useAccounts();
  const account_id = data?.[1]?.account_id ?? "";

  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<any[] | { message: string }>([]);

  useEffect(() => {
    const fetchReports = async () => {
      if (
        !account_id ||
        !account_id.match(
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
        )
      ) {
        console.error("Invalid UUID");
        setReports([{ message: "Invalid UUID" }]);
        return;
      }

      setLoading(true);
      const data = await getReportsWs(account_id);
      setReports(data);
      setLoading(false);
    };

    fetchReports();
  }, [account_id]);

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
          setReports((prevReports) => {
            if (Array.isArray(prevReports)) {
              return [newReport, ...prevReports];
            }
            return prevReports;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reports]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("report_ws")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "report_ws",
        },
        (payload: any) => {
          const { new: newReport } = payload.record;
          setReports((prevReports) => {
            if (Array.isArray(prevReports)) {
              return [newReport, ...prevReports];
            }
            return prevReports;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reports]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("report_ws")
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "report_ws",
        },
        (payload: any) => {
          const { old: oldReport } = payload.record;
          setReports((prevReports) => {
            if (Array.isArray(prevReports)) {
              return prevReports.filter((report) => report.id !== oldReport.id);
            }
            return prevReports;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reports]);

  return (
    <div className='flex flex-col bg-background rounded-md w-[100%] p-6'>
      <div className='flex mb-4 '>
        <Search
          placeholder='Buscar Número'
          className='bg-transparent text-muted-foreground'
        />
      </div>
      <Table className='overflow-hidden'>
        <TableCaption></TableCaption>
        <TableHeader>
          <TableRow className='bg-foreground'>
            <TableHead className='text-primary'>Número</TableHead>
            <TableHead className='text-primary'>Asistente</TableHead>
            <TableHead className='text-primary'>Pregunta</TableHead>
            <TableHead className='text-primary'>Respuesta</TableHead>
            <TableHead className='text-primary'>Respondidas</TableHead>
            <TableHead className='text-primary'>No respondidas</TableHead>
            <TableHead className='text-primary'>Tipo</TableHead>
            <TableHead className='text-primary'></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.isArray(reports) && reports.length > 0 ? (
            reports.map((register) => {
              const chatHistory = register.chat_history;
              const lastChat =
                chatHistory && chatHistory.length > 0
                  ? chatHistory[chatHistory.length - 1]
                  : null;
              return (
                <TableRow key={register.id}>
                  <TableCell className='font-medium text-primary'>
                    {register.user_number}
                  </TableCell>
                  <TableCell>{register.assistant_name}</TableCell>
                  <TableCell>{lastChat?.question}</TableCell>
                  <TableCell className=' max-w-[300px] '>
                    {lastChat?.answer}
                  </TableCell>
                  <TableCell>{register.answers}</TableCell>
                  <TableCell className='text-red-500'>
                    {register.wrong_answers}
                  </TableCell>
                  <TableCell>
                    {lastChat?.is_audio ? (
                      <Badge
                        variant='outline'
                        className='bg-violet-400 text-white'>
                        Audio
                      </Badge>
                    ) : (
                      <Badge
                        variant='outline'
                        className='bg-cyan-400 text-white'>
                        Texto
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <ModalEditRegister
                      setOpenModal={() => {}}
                      register={register}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={8}
                className='text-center text-muted-foreground'>
                {loading ? "Cargando..." : "Aún no hay registros que mostrar"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
