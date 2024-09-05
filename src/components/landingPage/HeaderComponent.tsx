"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const SCROLL_BOUNDARY = 120;

export function HeaderComponent({ session }: any) {
  const [slug, setSlug] = useState<string | Record<string, unknown>>('{}');
  const [isSessionValid, setIsSessionValid] = useState(false);

  console.log(isSessionValid, slug);

  console.log(session);

  console.log(isSessionValid);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedPath = localStorage.getItem("intelliaa-organitation");
      if (storedPath) {
        try {
          const parsedPath = JSON.parse(storedPath);
          setSlug(parsedPath);
        } catch (error) {
          console.error("Error parsing stored path:", error);
          setSlug({});
        }
      } else {
        setSlug({});
      }
    }
  }, []);

  useEffect(() => {
    // Verificar si la sesión es válida usando session.session
    if (session && session.session && session.session.user) {
      const currentTime = new Date().getTime();
      let expiresAt = new Date(session.session.expires_at).getTime();
      // Convertir expiresAt a milisegundos si está en segundos
      if (expiresAt < 1000000000000) {
        // Esto asume que si es menor a un valor razonable para milisegundos, está en segundos
        expiresAt *= 1000;
      }
      setIsSessionValid(currentTime < expiresAt);
    } else {
      setIsSessionValid(false);
    }
  }, [session]);

  const [scrollY, setScrollY] = useState(0);
  const fixedNavRef = useRef<HTMLElement>(null);
  const { theme } = useTheme();

  const getBreakpoint = (width: number) => {
    if (width < 640) return "xs";
    if (width < 768) return "sm";
    if (width < 1024) return "md";
    if (width < 1280) return "lg";
    if (width < 1536) return "xl";
    return "2xl";
  };

  const [breakpoint, setBreakpoint] = useState("xl");

  useEffect(() => {
    const handleResize = () => {
      setBreakpoint(getBreakpoint(window.innerWidth));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const active =
    scrollY >= SCROLL_BOUNDARY ||
    breakpoint === "xs" ||
    breakpoint === "sm" ||
    breakpoint === "md";

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header
      ref={fixedNavRef}
      className='mx-auto flex w-full max-w-5xl items-center justify-between bg-transparent px-10 py-7 dark:bg-transparent'>
      <div className='hidden z-50 flex-row items-center justify-center gap-2 lg:flex'>
        <a href='#' className='flex h-12 w-36 '>
          <img src='/Logo-Intelliaa-Dark.svg' className='h-full w-full' />
        </a>
      </div>
      <div className='fixed inset-x-0 top-8 z-40 flex items-center justify-center '>
        <motion.div
          initial={{ x: 0 }}
          animate={{
            boxShadow: active
              ? theme === "dark"
                ? "0 0 0 1px rgba(255,255,255,.08), 0 1px 2px -1px rgba(255,255,255,.08), 0 2px 4px rgba(255,255,255,.04)"
                : "0 0 0 1px rgba(17,24,28,.08), 0 1px 2px -1px rgba(17,24,28,.08), 0 2px 4px rgba(17,24,28,.04)"
              : "none",
          }}
          transition={{
            ease: "linear",
            duration: 0.05,
            delay: 0.05,
          }}
          className={cn(
            "supports-backdrop-blur:bg-white/90 mx-4 flex w-full items-center justify-center overflow-hidden rounded-full bg-white bg-white/40 px-3 py-2.5 backdrop-blur-md transition-all dark:bg-black/20 lg:w-auto lg:p-1.5 lg:py-2"
          )}>
          <ul className='flex h-full w-full flex-row justify-between gap-6 lg:flex-row lg:justify-start lg:gap-1 text-muted-foreground'>
            <li className='flex items-center justify-center px-2 py-0.5'>
              <a href='#' className='flex h-8 w-8 lg:hidden'>
                <img src='/logoAG_Black.svg' className='h-full w-full' />
              </a>
              <a href='#' className='hidden lg:flex'>
                Inicio
              </a>
            </li>
            <li className='hidden items-center justify-center px-2 py-0.5 lg:flex'>
              <a href='#'>Característica</a>
            </li>
            <li className='hidden items-center justify-center px-2 py-0.5 lg:flex'>
              <a href='#'>Precios</a>
            </li>
            <li className='hidden items-center justify-center px-2 py-0.5 lg:flex'>
              <a href='#'>Contacto</a>
            </li>
            <AnimatePresence>
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: active ? "auto" : 0,
                }}
                transition={{
                  ease: "easeOut",
                  duration: 0.25,
                  delay: 0.05,
                }}>
                <AnimatePresence>
                  {active && (
                    <motion.a
                      initial={{ x: "125%" }}
                      animate={{ x: "0" }}
                      exit={{
                        x: "125%",
                        transition: { ease: "easeOut", duration: 2.2 },
                      }}
                      transition={{ ease: "easeOut", duration: 0.5 }}
                      className='relative inline-flex w-fit shrink-0 items-center justify-center gap-x-1.5 overflow-hidden whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-white outline-none dark:bg-primary dark:text-black'>
                      Empieza Ahora
                    </motion.a>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </ul>
        </motion.div>
      </div>

      <div className='relative z-50 hidden w-fit items-center justify-center gap-x-1.5 overflow-hidden rounded-lg bg-primary px-3 py-1.5 text-white outline-none dark:bg-primary dark:text-black lg:inline-flex '>
        {isSessionValid && slug && Object.keys(slug).length > 0 ? (
          <Link href={`/${slug}`}>
            <span>Dashboard</span>
          </Link>
        ) : (
          <Link href='/auth' className='cursor-pointer'>
            Comienza Ahora
          </Link>
        )}
      </div>
    </header>
  );
}
