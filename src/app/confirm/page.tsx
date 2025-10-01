
import ConfirmationHandler from "@/components/intelliaa/ConfirmationHandler";
import { redirect } from "next/navigation";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ org:string  }>;
}) {

  const params = await searchParams;
  console.log(params);

  if (!params.org) {
    redirect("/");
  }



  return (
    <div className='max-w-md mx-auto w-full my-12'>
      <ConfirmationHandler />
    </div>
  );
}


