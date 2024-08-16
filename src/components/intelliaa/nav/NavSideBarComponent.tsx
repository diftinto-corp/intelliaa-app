"use client";

import {
  Home,
  Bot,
  FileBox,
  PhoneForwarded,
  CodeXmlIcon,
  Package2,
  FileBarChart2,
  Hash,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function NavSideBarComponent({ path }: any) {
  const pathName = usePathname();

  const safePath = path || "defaultPath";

  const sidebarItems = [
    { name: "Inicio", url: `/${safePath}`, Icon: Home },
    { name: "Asistente", url: `/${safePath}/assistants`, Icon: Bot },
    { name: "Documentos", url: `/${safePath}/documents`, Icon: FileBox },
    { name: "Reportes", url: `/${safePath}/reports`, Icon: FileBarChart2 },
    { name: "Números", url: `/${safePath}/numbers`, Icon: Hash },
    // { name: "Herramientas", url: `/${path}/tools`, Icon: CodeXmlIcon },
  ];

  return (
    <nav className='grid items-start pt-6 text-sm font-medium lg:px-4'>
      {sidebarItems.map(({ name, url, Icon }) => (
        <Link
          key={name}
          href={url}
          className={
            (pathName === url
              ? " bg-teal-900 text-primary "
              : "text-muted-foreground") +
            " flex items-center gap-4 rounded-sm px-3 py-2 hover:bg-teal-900 hover:text-primary mb-2"
          }>
          <Icon className='h-4 w-4' />
          {name}
        </Link>
      ))}
    </nav>
  );
}

function NavSideBarResponsiveComponent({ path }: any) {
  const safePath = path.accountSlug || "defaultPath";
  const sidebarItems = [
    { name: "Inicio", url: `/${safePath}`, Icon: Home },
    { name: "Asistentes", url: `/${safePath}/assistants`, Icon: Bot },
    { name: "Documentos", url: `/${safePath}/documents`, Icon: FileBox },
    { name: "Llamadas", url: `/${safePath}/reports`, Icon: PhoneForwarded },
    { name: "Numeros", url: `/${safePath}/numbers`, Icon: Hash },
  ];

  return (
    <nav className='grid gap-2 text-lg font-medium pt-6'>
      <Link href='#' className='flex items-center gap-2 text-lg font-semibold'>
        <Package2 className='h-6 w-6' />
        <span className='sr-only'>Intelliaa Template</span>
      </Link>
      {sidebarItems.map(({ name, url, Icon }) => (
        <Link
          key={name}
          href={url}
          className={
            (safePath === url
              ? "bg-white text-primary"
              : "text-muted-foreground") +
            " mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 hover:text-foreground mb-2"
          }>
          <Icon className='h-5 w-5' />
          {name}
        </Link>
      ))}
    </nav>
  );
}

export { NavSideBarComponent, NavSideBarResponsiveComponent };
