import AcceptTeamInvitation from "@/components/basejump/accept-team-invitation";
import { redirect } from "next/navigation";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {

  const params = await searchParams;
  console.log(params);

  if (!params.token) {
    redirect("/");
  }



  return (
    <div className='max-w-md mx-auto w-full my-12'>
      <AcceptTeamInvitation token={params.token} />
    </div>
  );
}
