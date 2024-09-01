"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportWsComponent } from "./reportsWs";
import ReportsVoice from "./ReportsVoice";

export default function TabsReports() {
  return (
    <Tabs defaultValue='reportsws' className='w-[100%]'>
      <TabsList className='grid w-full grid-cols-2'>
        <TabsTrigger
          className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'
          value='reportsws'>
          Reportes Whatsapp
        </TabsTrigger>
        <TabsTrigger
          className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'
          value='reportsvoice'>
          Reportes de llamadas
        </TabsTrigger>
      </TabsList>
      <TabsContent value='reportsws'>
        <ReportWsComponent />
      </TabsContent>
      <TabsContent value='reportsvoice'>
        <ReportsVoice />
      </TabsContent>
    </Tabs>
  );
}
