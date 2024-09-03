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
          className='flex flex-col cursor-pointer hover:bg-background p-2'
          onClick={() => handleSelectRegister(chat)}>
          <div className='flex flex-row max-w-[85%] self-end bg-teal-900 text-muted-foreground rounded-lg rounded-br-none p-2 mb-4'>
            {chat.is_audio ? (
              <Badge variant='outline' className='bg-cyan-600 text-white mr-2'>
                Audio
              </Badge>
            ) : (
              <Badge
                variant='outline'
                className='bg-indigo-600 text-white mr-2'>
                Texto
              </Badge>
            )}
            {chat.question}
          </div>
          <div
            className={`max-w-[85%] self-start bg-teal-800 rounded-lg text-muted-foreground rounded-bl-none p-2 mb-4
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
