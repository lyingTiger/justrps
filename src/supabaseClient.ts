import { createClient } from '@supabase/supabase-js';

// 💉 환경 변수가 잘 로드되는지 확인하기 위한 임시 로그 (성공 후 삭제 권장)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🩺 진단: 값이 없으면 콘솔에 에러를 찍어줍니다.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("🚨 Supabase 환경 변수가 누락되었습니다! Vercel 설정을 확인하세요.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);