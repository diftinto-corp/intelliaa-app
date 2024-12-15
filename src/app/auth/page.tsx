"use client";

import { LoginForm } from "@/components/intelliaa/auth/LoginForm";
import { RegisterForm } from "@/components/intelliaa/auth/RegisterForm";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useTheme } from "next-themes";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);
  const { theme } = useTheme();

  const toggleForm = () => {
    setIsLogin(!isLogin);
  };

  return (
    <>
      <div className='flex items-center justify-center w-full p-4'>
        <div className='flex self-start w-full'>
          <Link href='/'>
            <Image
              src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
              alt='Image'
              width='150'
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
