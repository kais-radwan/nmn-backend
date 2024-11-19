import { createClient } from "@supabase/supabase-js";
import readEnv from "./env.ts";

const url = readEnv("SUPABASE_URL") as string;
const key = readEnv("SUPABASE_KEY") as string;

const supabase = createClient(url, key);

export default supabase;
