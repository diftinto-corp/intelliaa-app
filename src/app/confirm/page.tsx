
import ConfirmationHandler from "@/components/intelliaa/ConfirmationHandler";
import { redirect } from "next/navigation";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: { org:string  };
}) {


  console.log(searchParams);

  if (!searchParams.org) {
    redirect("/");
  }



  return (
    <div className='max-w-md mx-auto w-full my-12'>
      <ConfirmationHandler />
    </div>
  );
}


