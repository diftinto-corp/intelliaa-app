import { HeaderComponent } from "@/components/landingPage/HeaderComponent";
import { HeroComponent } from "@/components/landingPage/HeroComponent";
import { createClient } from "@/lib/supabase/server";

export default async function Index() {
  const supabase = createClient();

  const { data: session } = await supabase.auth.getSession();

  return (
    <>
      <HeaderComponent session={session} />
      <HeroComponent />
    </>
  );
}
