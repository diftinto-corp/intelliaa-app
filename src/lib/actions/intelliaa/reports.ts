import { createClient } from "@/lib/supabase/client";

const getReportsWs = async (account_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("report_ws")
    .select("*")
    .eq("account_id", account_id);

  if (error) {
    return { message: error.message };
  }
  return data;
};

const getReportsVoice = async (account_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("report_voice")
    .select("*")
    .eq("account_id", account_id);

  if (error) {
    return { message: error.message };
  }
  return data;
};

export { getReportsWs, getReportsVoice };
