"use client";

import { useState, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Pause,
  Rewind,
  FastForward,
  Volume2,
  Download,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { getReportsVoice } from "@/lib/actions/intelliaa/reports";
import AudioPlayer from "./AudioPlayer";

type CallRecord = {
  id: string;
  type: string;
  ended_reason: string;
  customer_assistant: string;
  assistant_name: string;
  assistant_number: string;
  duration_minutes: string;
  recording_url?: string;
  transcript?: string;
  summary?: string;
  created_at: string;
};

const formatTranscription = (transcription: string) => {
  const lines = transcription.split("\n").filter((line) => line.trim() !== "");
  return lines.map((line, index) => {
    const [speaker, ...messageParts] = line.split(":");
    const message = messageParts.join(":").trim();
    const isUser = speaker.trim() === "User";
    return (
      <div key={index} className='mb-6'>
        <span
          className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mb-2 ${
            isUser ? "bg-cyan-600 text-white" : "bg-indigo-600 text-white"
          }`}>
          {speaker.trim()}
        </span>
        <div
          className={`p-3 rounded-lg ${
            isUser ? "bg-[#182426] text-white" : "bg-[#182426] text-white"
          }`}>
          <p>{message}</p>
        </div>
      </div>
    );
  });
};

export default function ReportsVoice() {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];

  const [isOpen, setIsOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<CallRecord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const recordsPerPage = 10;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);


  useEffect(() => {
    const getCalls = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      const account_id = team_account.account_id as string;

      const calls = await getReportsVoice(account_id);

      if (calls && !("message" in calls)) {
        // Invertir los registros para que los más recientes sean los primeros
        setCallRecords(calls.reverse() as CallRecord[]);
      } else {
        console.error("Error fetching call records:", calls.message);
      }
    };
    getCalls();
  }, [accountSlug]);

  const handleRowClick = (record: CallRecord) => {
    setSelectedRecord(record);
    setIsOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  };

  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = callRecords.slice(
    indexOfFirstRecord,
    indexOfLastRecord
  );

  console.log(currentRecords);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedRecord?.recording_url && audioRef.current) {
      audioRef.current.src = selectedRecord.recording_url;
      audioRef.current.load();
      setCurrentTime(0);
      setDuration(0);
      setWaveform([]);

      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      fetch(selectedRecord.recording_url)
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
        .then((audioBuffer) => {
          const channelData = audioBuffer.getChannelData(0);
          const sampleSize = Math.floor(channelData.length / 100);
          const samples = [];
          for (let i = 0; i < 100; i++) {
            const startIndex = i * sampleSize;
            const endIndex = (i + 1) * sampleSize;
            const slice = channelData.slice(startIndex, endIndex);
            const max = Math.max(...Array.from(slice).map(Math.abs)); // Convert Float32Array to Array
            samples.push(max);
          }
          setWaveform(samples);
        })
        .catch((error) => console.error("Error processing audio:", error));
    }
  }, [selectedRecord]);

  useEffect(() => {
    if (canvasRef.current && waveform.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(59, 130, 246, 0.5)";
        const barWidth = canvas.width / waveform.length;
        waveform.forEach((sample, index) => {
          const height = sample * canvas.height;
          const x = index * barWidth;
          const y = (canvas.height - height) / 2;
          ctx.fillRect(x, y, barWidth, height);
        });
      }
    }
  }, [waveform]);
  return (
    <div className='flex flex-col mx-auto w-[100%] p-4 min-h-[75vh]'>
      {callRecords.length > 0 ? (
        <>
          <div className='flex-grow'>
            <Table>
              <TableHeader>
                <TableRow className='bg-foreground'>
                  <TableHead className='text-primary'>
                    Fecha de la llamada
                  </TableHead>
                  <TableHead className='text-primary'>Tipo</TableHead>
                  <TableHead className='text-primary'>
                    Causa de finalización
                  </TableHead>
                  <TableHead className='text-primary'>
                    Número del cliente
                  </TableHead>
                  <TableHead className='text-primary'>Asistente</TableHead>
                  <TableHead className='text-primary'>
                    Número del asistente
                  </TableHead>
                  <TableHead className='text-primary'>Duración</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    onClick={() => handleRowClick(record)}
                    className='cursor-pointer text-muted-foreground hover:bg-muted hover:text-white'>
                    <TableCell>
                      {new Date(record.created_at)
                        .toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                        .replace(",", "")}
                    </TableCell>
                    <TableCell>{record.type}</TableCell>
                    <TableCell>{record.ended_reason}</TableCell>
                    <TableCell>{record.customer_assistant}</TableCell>
                    <TableCell>{record.assistant_name}</TableCell>
                    <TableCell>{record.assistant_number}</TableCell>
                    <TableCell>
                      {parseFloat(record.duration_minutes).toFixed(2)} min
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className='mt-auto'>
            <div className='flex justify-center space-x-2 mt-4'>
              {Array.from(
                { length: Math.ceil(callRecords.length / recordsPerPage) },
                (_, i) => (
                  <Button
                    key={i + 1}
                    onClick={() => paginate(i + 1)}
                    className={currentPage === i + 1 ? "bg-background border border-primary rounded-md text-primary" : " bg-background border border-muted-foreground rounded-md text-muted-foreground"}>
                    {i + 1}
                  </Button>
                )
              )}
            </div>
          </div>
        </>
      ) : (
        <div className='flex items-center justify-center h-full'>
          <p className='text-muted-foreground'>
            Aún no hay registros de llamadas.
          </p>
        </div>
      )}
      <Sheet open={isOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side='right' className='w-[400px] sm:w-[540px]'>
          <SheetHeader>
            <SheetTitle className='text-primary'>
              {selectedRecord?.assistant_name}
            </SheetTitle>
            <SheetDescription>
              Número del cliente: {selectedRecord?.customer_assistant}
              <br />
              Número del asistente: {selectedRecord?.assistant_number}
            </SheetDescription>
          </SheetHeader>
          <Tabs defaultValue='audio-transcript' className='w-full mt-6'>
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger
                value='audio-transcript'
                className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'>
                Audio y Transcripción
              </TabsTrigger>
              <TabsTrigger
                value='analysis'
                className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'>
                Análisis
              </TabsTrigger>
            </TabsList>
            <TabsContent value='audio-transcript' className='mt-6 space-y-4'>
              {selectedRecord?.recording_url && (
                <AudioPlayer url={selectedRecord.recording_url} />
              )}
              <div>
                <h3 className='font-semibold mb-2 text-muted-foreground'>
                  Transcripción:
                </h3>
                <ScrollArea className='h-[400px] w-full rounded-md border p-4'>
                  {selectedRecord?.transcript ? (
                    formatTranscription(selectedRecord.transcript)
                  ) : (
                    <p className='text-sm text-muted-foreground'>
                      No hay transcripción disponible.
                    </p>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
            <TabsContent value='analysis' className='mt-6'>
              <h3 className='font-semibold mb-2 text-muted-foreground'>
                Análisis de la llamada:
              </h3>
              <p className='text-sm text-muted-foreground'>
                {selectedRecord?.summary || "No hay análisis disponible."}
              </p>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
