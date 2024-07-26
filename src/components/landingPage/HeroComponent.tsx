"use client";

import { cn } from "@/lib/utils";
import { BorderBeam } from "@/components/magicui/border-beam";
import { motion, useInView } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useRef } from "react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Particles from "@/components/magicui/particles";

export function HeroComponent() {
  const { theme } = useTheme();
  const [color, setColor] = useState("#ffffff");

  useEffect(() => {
    setColor(theme === "dark" ? "#ffffff" : "#000000");
  }, [theme]);

  const fadeInRef = useRef(null);
  const fadeInInView = useInView(fadeInRef, {
    once: true,
  });

  const fadeUpVariants = {
    initial: {
      opacity: 0,
      y: 24,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
  };

  return (
    <section id='hero'>
      <div className='relative h-full overflow-hidden py-14'>
        <div className='container z-10 flex flex-col'>
          <div className='mt-20 grid grid-cols-1'>
            <Particles
              className='absolute inset-0'
              quantity={100}
              ease={80}
              color={color}
              refresh
            />
            <div className='flex flex-col items-center gap-6 pb-8 text-center'>
              <motion.h1
                ref={fadeInRef}
                className='text-balance bg-gradient-to-br from-black from-30% to-black/60 bg-clip-text py-6 text-5xl font-medium leading-none tracking-tighter text-transparent dark:from-white dark:to-white/40 sm:text-6xl md:text-7xl lg:text-8xl'
                animate={fadeInInView ? "animate" : "initial"}
                variants={fadeUpVariants}
                initial={false}
                transition={{
                  duration: 0.6,
                  delay: 0.1,
                  ease: [0.21, 0.47, 0.32, 0.98],
                  type: "spring",
                }}>
                Descubre el Futuro <br /> de la Atención al Cliente con IA{" "}
                <br />
              </motion.h1>

              <motion.p
                className='text-balance text-lg tracking-tight text-gray-400 md:text-xl'
                animate={fadeInInView ? "animate" : "initial"}
                variants={fadeUpVariants}
                initial={false}
                transition={{
                  duration: 0.6,
                  delay: 0.2,
                  ease: [0.21, 0.47, 0.32, 0.98],
                  type: "spring",
                }}>
                Mejora la experiencia de tus clientes y optimiza tu equipo con
                nuestra IA avanzada, diseñada para brindar asistencia inmediata
                y precisa.
              </motion.p>

              <motion.div
                animate={fadeInInView ? "animate" : "initial"}
                variants={fadeUpVariants}
                className='flex flex-col gap-4 lg:flex-row'
                initial={false}
                transition={{
                  duration: 0.6,
                  delay: 0.3,
                  ease: [0.21, 0.47, 0.32, 0.98],
                  type: "spring",
                }}>
                <a
                  href='#'
                  className={cn(
                    // colors
                    "bg-black  text-white shadow hover:bg-black/90 dark:bg-primary dark:text-black dark:hover:bg-primary/90",

                    // layout
                    "group relative inline-flex h-9 w-full items-center justify-center gap-2 overflow-hidden whitespace-pre rounded-md px-4 py-2 text-base font-semibold tracking-tighter focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 md:flex",

                    // animation
                    "transform-gpu ring-offset-current transition-all duration-300 ease-out hover:ring-2 hover:ring-primary hover:ring-offset-2"
                  )}>
                  Comienza ahora
                  <ChevronRight className='size-4 translate-x-0 transition-all duration-300 ease-out group-hover:translate-x-1' />
                </a>
              </motion.div>
            </div>
          </div>

          <motion.div
            animate={fadeInInView ? "animate" : "initial"}
            variants={fadeUpVariants}
            initial={false}
            transition={{
              duration: 1.4,
              delay: 0.4,
              ease: [0.21, 0.47, 0.32, 0.98],
              type: "spring",
            }}
            className='relative mt-24 h-full w-full rounded-xl after:absolute after:inset-0 after:z-10 after:[background:linear-gradient(to_top,#fff_30%,transparent)] dark:after:[background:linear-gradient(to_top,#1C1917_30%,transparent)]'>
            <div
              className={cn(
                "absolute inset-0 bottom-1/2 h-full w-[60%] left-56 transform-gpu [filter:blur(120px)]",

                // light styles
                "[background-image:linear-gradient(to_bottom,#ffaa40,transparent_30%)]",

                // dark styles
                "dark:[background-image:linear-gradient(to_bottom,#0d9488,transparent_20%)]"
              )}
            />

            <img
              src='/dashboard-light.png'
              className='relative block h-full w-full rounded-xl border dark:hidden'
            />
            <img
              src='/Intellia-screen.svg'
              className='relative hidden h-full w-full rounded-xl border dark:block'
            />
            {/* <video
              autoPlay
              loop
              muted
              src="demo.mp4"
              className="h-auto w-full"
            /> */}

            <BorderBeam size={150} />
            <BorderBeam size={150} delay={7} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
