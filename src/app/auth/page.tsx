"use client";

import { LoginForm } from "@/components/intelliaa/auth/LoginForm";
import { RegisterForm } from "@/components/intelliaa/auth/RegisterForm";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);

  const toggleForm = () => {
    setIsLogin(!isLogin);
  };

  return (
    <>
      <div className='flex items-center justify-center w-full p-4'>
        <div className='flex self-start w-full'>
          <Link href='/'>
            <Image
              src='/Logo-Intelliaa-Dark.svg'
              alt='Image'
              width='140'
              height='60'
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
