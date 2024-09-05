"use client";

import { Button } from "@/components/ui/button";
import { usePersonalAccount } from "@usebasejump/next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import Avvvatars from "avvvatars-react";
import { logout } from "@/app/auth/actions";

export default function UserAccountButton({ path }: any) {
  const { data: personalAccount } = usePersonalAccount();

  const safePath = path.accountSlug || "defaultPath";
  console.log("safePath", safePath);
  console.log(path);

  const handleLogout = () => {
    logout().then(() => {
      localStorage.removeItem('intelliaa-organitation');
    }).catch((error) => {
      console.error('Error al cerrar sesión:', error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost'>
          <Avvvatars style='shape' value={personalAccount?.name ?? ""} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56' align='end' forceMount>
        <DropdownMenuLabel className='font-normal'>
          <div className='flex flex-col space-y-1'>
            <p className='text-sm font-medium leading-none'>
              {personalAccount?.name}
            </p>
            <p className='text-xs leading-none text-muted-foreground'>
              {personalAccount?.metadata?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {/* <DropdownMenuItem asChild>
            <Link href='/dashboard'>My Account</Link>
          </DropdownMenuItem> */}
          <DropdownMenuItem asChild className=' cursor-pointer'>
            <Link href={`/${path}/settings`}>Configuración</Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
