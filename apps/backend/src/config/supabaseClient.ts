import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or Key. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your .env file.');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
