"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { EyeIcon, EyeOffIcon } from "lucide-react";

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className='relative'>
        <Input
          type={showPassword ? "text" : "password"}
          className={`${className} pr-10`} // Asegúrate de dejar espacio para el ícono
          {...props}
          ref={ref}
        />
        <div
          className='absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer'
          onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? (
            <EyeIcon className='text-primary w-4' />
          ) : (
            <EyeOffIcon className='text-primary w-4' />
          )}
        </div>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
