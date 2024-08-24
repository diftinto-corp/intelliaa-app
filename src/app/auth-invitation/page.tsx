import { FormAuthInvitation } from "@/components/intelliaa/auth/FormAuthInvitation";

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export default function pagePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {

  if (!searchParams.token) {
    redirect("/");
  }

  const token = searchParams.token;

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

      <FormAuthInvitation token={token} />
    </>
  );
}
