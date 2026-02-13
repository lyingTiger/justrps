import { createClient } from '@supabase/supabase-js';

// 💉 하드코딩된 문자열 대신 환경 변수를 사용하도록 교체
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);