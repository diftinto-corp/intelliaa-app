"use client";

import Image from "next/image";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import useScreenSize from "@/lib/hooks/render-screen";
import { cn } from "@/lib/utils";
import GridPattern from "@/components/magicui/grid-pattern";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isSmallScreen = useScreenSize();
  const router = useRouter();

  useEffect(() => {
    if (isSmallScreen) {
      router.push("/unsupported"); // Redirige si es una pantalla pequeña
    }
  }, [isSmallScreen, router]);
  return (
    <div className='w-full lg:grid lg:min-h-[600px] lg:grid-cols-2 xl:min-h-[100vh]'>
      <div className='flex flex-col items-center py-2'>{children}</div>
      <div className='flex bg-[#182426] p-6 w-full justify-end items-start '>
        <GridPattern
          width={30}
          height={30}
          x={-1}
          y={-1}
          strokeDasharray={"4 2"}
          className={cn(
            "[mask-image:radial-gradient(300px_circle_at_center,white,transparent)]"
          )}
        />
      </div>
    </div>
  );
}
