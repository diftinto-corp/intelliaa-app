"use client";

import { LoginForm } from "@/components/intelliaa/auth/LoginForm";
import { RegisterForm } from "@/components/intelliaa/auth/RegisterForm";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const toggleForm = () => {
    setIsLogin(!isLogin);
  };

  // Avoid hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? (resolvedTheme || theme) : "light";

  return (
    <>
      <div className='flex items-center justify-center w-full p-4'>
        <div className='flex self-start w-full'>
          <Link href='/'>
            <Image
              src={currentTheme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
              alt='Image'
              width='130'
              height='25'
              className=''
            />
          </Link>
        </div>
      </div>

      {isLogin ? (
        <LoginForm onToggleForm={toggleForm} />
      ) : (
        <RegisterForm onToggleForm={toggleForm} />
      )}
    </>
  );
}
