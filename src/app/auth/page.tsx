import { FormAuth } from "@/components/intelliaa/auth/FormAuth";

import Image from "next/image";
import Link from "next/link";

export default function pagePage() {
  return (
    <>
      <div className='flex items-center justify-center w-full p-4'>
        <div className='flex self-start w-full'>
          <Link href='/'>
            <Image
              src='/Logo-Intelliaa-Dark.svg'
              alt='Image'
              width='180'
              height='60'
              className=''
            />
          </Link>
        </div>
      </div>

      <FormAuth />
    </>
  );
}
