"use client";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { Skeleton } from "@/components/ui/skeleton";
import { ReportWsComponent } from "@/components/intelliaa/assistants/reports/reportsWs";

//TODO: Agregar renderizado condicional con loading

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

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
        <div className='flex flex-row w-[100%] mb-4'>
          <h1 className='text-2xl font-semibold text-primary self-start'>
            Informes de Whatsapp
          </h1>
        </div>
        <ReportWsComponent />
      </div>
    </div>
  );
}
