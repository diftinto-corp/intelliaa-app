"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  NavSideBarComponent,
  NavSideBarResponsiveComponent,
} from "@/components/intelliaa/nav/NavSideBarComponent";
import useScreenSize from "@/lib/hooks/render-screen";
import UserAccountBtn from "./UserAccountBtn";

interface DashboardProps {
  accountSlug: any;
  children: React.ReactNode;
}

export default function Dashboard({ accountSlug, children }: DashboardProps) {
  const isSmallScreen = useScreenSize();
  const router = useRouter();

  useEffect(() => {
    if (isSmallScreen) {
      router.push("/unsupported"); // Redirige si es una pantalla pequeña
    }
  }, [isSmallScreen, router]);
  return (
    <div className='grid h-screen md:relative w-screen md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] overflow-x-auto '>
      <div className='hidden md:fixed md:w-[20%] lg:w-[15%] h-screen border-r  md:block'>
        <div className='flex h-full max-h-screen flex-col gap-2'>
          <div className='flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6'>
            <Link href='/' className='flex items-center gap-2 font-semibold'>
              <Image
                src='/Logo-Intelliaa-Dark.svg'
                alt='AgentMaster'
                width={150}
                height={25}
              />
              {/* <span className=''>Intelliaa</span> */}
            </Link>
            <Button
              variant='outline'
              size='icon'
              className='ml-auto h-8 w-8 text-muted-foreground'>
              <Bell className='h-4 w-4' />
              <span className='sr-only'>Toggle notifications</span>
            </Button>
          </div>
          <div className='flex-1'>
            <NavSideBarComponent path={accountSlug} />
          </div>
          <div className='mt-auto p-4'>
            {/* <Card x-chunk='dashboard-02-chunk-0'>
              <CardHeader className='p-2 pt-0 md:p-4'>
                <CardTitle>Upgrade to Pro</CardTitle>
                <CardDescription>
                  Unlock all features and get unlimited access to our support
                  team.
                </CardDescription>
              </CardHeader>
              <CardContent className='p-2 pt-0 md:p-4 md:pt-0'>
                <Button size='sm' className='w-full'>
                  Upgrade
                </Button>
              </CardContent>
            </Card> */}
          </div>
        </div>
      </div>
      <div className='flex flex-col md:w-[80%] lg:w-[85%]'>
        <header className='flex md:fixed z-50 md:w-[80%] lg:w-[85%] right-0 h-14 items-center bg-background border-b px-4 lg:h-[60px] lg:px-6 overflow-hidden'>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant='outline'
                size='icon'
                className='shrink-0 md:hidden'>
                <Menu className='h-5 w-5' />
                <span className='sr-only'>Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side='left' className='flex flex-col'>
              <NavSideBarResponsiveComponent path={accountSlug} />
              <div className='mt-auto'>
                {/* <Card>
                  <CardHeader>
                    <CardTitle>Upgrade to Pro</CardTitle>
                    <CardDescription>
                      Unlock all features and get unlimited access to our
                      support team.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size='sm' className='w-full'>
                      Upgrade
                    </Button>
                  </CardContent>
                </Card> */}
              </div>
            </SheetContent>
          </Sheet>
          <div className='w-full flex-1'></div>
          <UserAccountBtn path={accountSlug} />
        </header>
        <main className='flex md:absolute bg-foreground md:w-[80%] lg:w-[85%] mt-14 lg:mt-[60px]  right-0 flex-col'>
          {children}
        </main>
      </div>
    </div>
  );
}
