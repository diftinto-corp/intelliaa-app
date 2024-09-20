"use client";
import { useEffect, useState, useRef, ChangeEvent, KeyboardEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eraser, Loader2, SendHorizonal } from "lucide-react";
import { Assistant, Message, Messages } from "@/interfaces/intelliaa";
import { useAccounts } from "@usebasejump/next";
import {
  chatPrediction,
  deleteMessages,
  getMessages,
} from "@/lib/actions/intelliaa/assistants";
import { motion } from "framer-motion";
import { delData } from "@/lib/upstash/upstash";
import Markdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AssistantSession {
  sessionId: string;
  namespace: string;
}

const saveAssistantSession = (
  assistantId: string,
  session: AssistantSession
): void => {
  const sessions = JSON.parse(
    localStorage.getItem("assistantSessions") || "{}"
  );
  sessions[assistantId] = session;
  localStorage.setItem("assistantSessions", JSON.stringify(sessions));
};

const getAssistantSession = (assistantId: string): AssistantSession | null => {
  const sessions = JSON.parse(
    localStorage.getItem("assistantSessions") || "{}"
  );
  return sessions[assistantId] || null;
};

export default function ChatWsComponent({
  assistant,
}: {
  assistant: Assistant;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Messages>({ messages: [] });
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data } = useAccounts();
  const account_id = data?.[1]?.account_id ?? "";

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  useEffect(() => {
    const session = getAssistantSession(assistant.id);
    const fetchMessages = async () => {
      if (session) {
        try {
          const fetchedMessages = await getMessages(session.sessionId);
          setMessages({ messages: fetchedMessages });
        } catch (error) {
          console.error("Error:", error);
        }
      } else {
        setMessages({ messages: [] });
      }
    };

    fetchMessages();
  }, [assistant]);

  const handleChat = async () => {
    setLoading(true);

    const newMessage: Message = {
      content: input,
      role: "userMessage",
    };
    setMessages((prevMessages) => ({
      messages: [...prevMessages.messages, newMessage],
    }));

    setInput("");
    try {
      let session = getAssistantSession(assistant.id);

      if (!session) {
        const answer = await chatPrediction({
          question: input,
          overrideConfig: {
            supabaseMetadataFilter: {
              namespace: assistant.namespace,
            },
            systemMessage: `
              ${assistant.prompt}, basándote en la información proporcionada por las herramientas disponibles. Evita inventar respuestas; si desconoces la información, indica de manera literalmente: "Disculpa, pero no cuento con esa información" o "No tengo esa información".
              No utilices expresiones como "parece ser" o "supuestamente"; refleja seguridad en tus respuestas.`,
            temperature: assistant.temperature,
            maxTokens: assistant.token,
          },
        });
        session = {
          sessionId: answer.sessionId,
          namespace: assistant.namespace,
        };
        saveAssistantSession(assistant.id, session);

        const assistantMessage: Message = {
          content: answer.text,
          role: "apiMessage",
        };
        setMessages((prevMessages) => ({
          messages: [...prevMessages.messages, assistantMessage],
        }));
      } else {
        const answer = await chatPrediction({
          question: input,
          overrideConfig: {
            supabaseMetadataFilter: {
              namespace: session.namespace,
            },
            systemMessage: `${assistant.prompt}, basándote en la información proporcionada por las herramientas disponibles. Evita inventar respuestas; si desconoces la información, indica de manera literalmente: "Disculpa, pero no cuento con esa información" o "No tengo esa información".No utilices expresiones como "parece ser" o "supuestamente"; refleja seguridad en tus respuestas.`,
            temperature: assistant.temperature,
            maxTokens: assistant.token,
            sessionId: session.sessionId,
          },
        });

        const assistantMessage: Message = {
          content: answer.text,
          role: "apiMessage",
        };
        setMessages((prevMessages) => ({
          messages: [...prevMessages.messages, assistantMessage],
        }));
      }

      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
    }
  };

  const handleSubmitEnter = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim() !== "") {
      e.preventDefault();
      await handleChat();
    }
  };

  const handleSubmitClick = async (e: React.FormEvent<HTMLFormElement>) => {
    if (input.trim() !== "") {
      e.preventDefault();
      await handleChat();
    }
  };

  const handleDeleteChat = async () => {
    setLoading(true);
    const session = getAssistantSession(assistant.id);
    if (session) {
      await deleteMessages(session.sessionId);
      await delData(session.sessionId);
      const sessions = JSON.parse(
        localStorage.getItem("assistantSessions") || "{}"
      );
      delete sessions[assistant.id];
      localStorage.setItem("assistantSessions", JSON.stringify(sessions));
      setMessages({ messages: [] });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <Card className='flex flex-col text-muted-foreground bg-[#242322]/80 border-gray-700 shadow-[inset_0_0_20px_rgba(20,184,166,0.2)] overflow-hidden justify-between w-[40%]'>
      <CardContent>
        <div className='flex items-center justify-between my-5'>
          <Label htmlFor='assistant-name' className='text-lg'>
            Prueba tu asistente
          </Label>
          <Button variant='outline' size='icon' onClick={handleDeleteChat}>
            {loading ? (
              <Loader2 className='animate-spin text-red-500' />
            ) : (
              <Eraser size={17} className='text-red-500' />
            )}
          </Button>
        </div>
        <div className='flex flex-col'>
          <ScrollArea className='flex flex-col w-full min-h-[55vh] max-h-[55vh] bg-foreground rounded-lg p-4'>
            {messages?.messages?.map((message, index) => (
              <div
                key={index}
                className={`flex w-full ${
                  message.role === "userMessage"
                    ? "justify-end"
                    : "justify-start"
                }`}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1 }}
                  className={`flex flex-col p-4 m-4 max-w-[80%] ${
                    message.role === "userMessage"
                      ? "bg-teal-900 rounded-lg rounded-br-none text-white"
                      : "bg-teal-800 rounded-lg rounded-bl-none text-white"
                  }`}>

                  {message.role === "apiMessage" ? (
                    <Markdown className='text-md'>{message.content}</Markdown>
                  ) : (
                    <p className='text-md'>{message.content}</p>
                  )}
                </motion.div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </ScrollArea>
          <form
            className='flex w-full items-center space-x-2 my-5'
            onSubmit={handleSubmitClick}>
            <Input
              placeholder='Escribe tu mensaje...'
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleSubmitEnter}
              disabled={loading}
            />
            <Button
              variant='outline'
              size='icon'
              type='submit'
              disabled={input.trim() === "" || loading}>
              {loading ? (
                <Loader2 className='animate-spin mr-2 text-primary' />
              ) : (
                <SendHorizonal className='mr-2 text-primary' />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
