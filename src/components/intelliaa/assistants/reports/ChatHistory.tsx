"use client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import React from "react";

interface ChatHistoryProps {
  chatHistory: any;
  setRegisterSelected: (chat: any) => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  chatHistory,
  setRegisterSelected,
}) => {
  const handleSelectRegister = (chat: any) => {
    setRegisterSelected(chat);
  };

  return (
    <ScrollArea className='h-[400px] w-[550px] rounded-md border p-4'>
      {chatHistory.map((chat: any, index: number) => (
        <div
          key={index}
          className='flex flex-col cursor-pointer hover:bg-gray-100 p-2'
          onClick={() => handleSelectRegister(chat)}>
          <div className='flex flex-row max-w-[85%] self-end bg-violet-200 rounded-lg rounded-br-none p-2 mb-4'>
            {chat.is_audio ? (
              <Badge
                variant='outline'
                className='bg-violet-400 text-white mr-2'>
                Audio
              </Badge>
            ) : (
              <Badge variant='outline' className='bg-cyan-400 text-white mr-2'>
                Texto
              </Badge>
            )}
            {chat.question}
          </div>
          <div
            className={`max-w-[85%] self-start bg-sky-200 rounded-lg rounded-bl-none p-2 mb-4
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
