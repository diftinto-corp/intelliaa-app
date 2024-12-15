"use client";
import { TabsNumber } from "@/components/intelliaa/assistants/numbers/TabNumbers";
import {
  listActiveNumbers,
  listAvailableNumbers,
  listVoiceCountry,
} from "@/lib/actions/intelliaa/twilio";
import { useEffect, useState } from "react";

//TODO: Agregar renderizado condicional con loading

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);

  if (loading) {
    return (
      <div className='flex flex-col h-[92vh] items-center p-6'>
        <div className='flex flex-col bg-background justify-center w-full h-[92vh] rounded-sm'></div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-[92vh] items-center p-6'>
      <div className='flex flex-col bg-background items-center w-full h-[92vh] rounded-sm  p-4 '>
        <div className='flex flex-col w-[100%] mb-4'>
          <h1 className='text-2xl font-semibold text-primary self-start mb-10'>
            Números telefónicos
          </h1>
          <TabsNumber />
        </div>
      </div>
    </div>
  );
}
