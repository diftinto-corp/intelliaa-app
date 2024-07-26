"use client";

import { TrendingUp } from "lucide-react";
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";

const LIMIT = 20;

const calculatePercentage = (count: number, limit: number) => {
  return (count / limit) * 100;
};

const chartConfig = {
  whatsapp: {
    label: "Whatsapp",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function PieChartAssistants({ assistants }: { assistants: any[] }) {
  const assistantsCount = assistants.length;
  const assistantsPercentage = calculatePercentage(assistantsCount, LIMIT);

  const chartData = assistants.map((assistant) => ({
    whatsapp: assistantsCount,
    fill: "var(--color-whatsapp)",
  }));

  return (
    <Card className='flex flex-col w-[30%]'>
      <CardHeader className='items-center pb-0'>
        <CardTitle>Asistentes</CardTitle>
        {/* <CardDescription>January - June 2024</CardDescription> */}
      </CardHeader>
      <CardContent className='flex-1 pb-0'>
        <ChartContainer
          config={chartConfig}
          className='mx-auto aspect-square max-h-[250px] text-muted-foreground'>
          <RadialBarChart
            data={chartData}
            endAngle={assistantsPercentage}
            innerRadius={80}
            outerRadius={140}>
            <PolarGrid
              gridType='circle'
              radialLines={false}
              stroke='none'
              className='first:fill-muted last:fill-background text-muted-foreground'
              polarRadius={[86, 74]}
            />
            <RadialBar dataKey='whatsapp' background />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor='middle'
                        dominantBaseline='middle'>
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className='fill-muted-foreground text-4xl font-bold'>
                          {assistantsCount}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className='fill-muted-foreground'>
                          Assistants
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className='flex-col gap-2 text-sm'>
        <div className='flex items-center gap-2 font-medium leading-none'>
          Cantidad de asistentes <TrendingUp className='h-4 w-4' />
        </div>
        <div className='leading-none text-muted-foreground'>
          20 asistentes para tu plan actual
        </div>
      </CardFooter>
    </Card>
  );
}
