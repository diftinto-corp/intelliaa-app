"use client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import React from "react";

interface ChatHistoryProps {
  chatHistory: any;
  setRegisterSelected: (chat: any) => void;
  containerStyle?: React.CSSProperties;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  chatHistory,
  setRegisterSelected,
  containerStyle = {},
}) => {
  const handleSelectRegister = (chat: any) => {
    setRegisterSelected(chat);
  };

  return (
    <ScrollArea
      className='rounded-md border p-4 bg-foreground'
      style={{
        ...containerStyle,
        maxHeight: "400px", // Limita la altura del contenedor
        overflowY: "auto", // Añade la barra de desplazamiento vertical
      }}>
      {chatHistory.map((chat: any, index: number) => (
        <div
          key={index}
          className='flex flex-col cursor-pointer hover:bg-background rounded-lg p-2'
          onClick={() => handleSelectRegister(chat)}>
          <div className='flex flex-col max-w-[95%] self-end bg-green-200 dark:bg-teal-900 rounded-lg rounded-br-none text-muted-foreground dark:text-white p-2 mb-4'>
            {chat.is_audio ? (
              <Badge
                variant='outline'
                className='bg-purple-400 text-white mr-2 mb-2 w-fit'>
                Audio
              </Badge>
            ) : (
              <Badge
                variant='outline'
                className='bg-cyan-600 text-white mr-2 mb-2 w-fit'>
                Texto
              </Badge>
            )}
            {chat.question}
          </div>
          <div
            className={`max-w-[85%] self-start bg-green-200 dark:bg-teal-900 rounded-lg rounded-br-none text-muted-foreground dark:text-white p-2 mb-4
                ${chat.isNoAnswer ? "text-red-500" : ""}
                `}>
            {chat.answer}
          </div>
        </div>
      ))}
    </ScrollArea>
  );
};

export default ChatHistory;
