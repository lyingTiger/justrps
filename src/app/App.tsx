import { useState } from 'react';
import { supabase } from '../supabaseClient'; // 상위 폴더의 파일을 참조

// UI 컴포넌트 경로 에러 방지를 위해 HTML 기본 태그로 대체하거나 경로 수정
// 만약 에러가 계속나면 아래 Input, Button, Checkbox 임포트를 지우고 기본 태그를 쓰세요.
import { Input } from './components/ui/input'; 
import { Button } from './components/ui/button';
import { Checkbox } from './components/ui/checkbox';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // 닉네임 상태 추가
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // 로그인 로직
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      alert("로그인 실패: " + error.message);
    } else {
      alert("로그인 성공!");
      // 여기서 로비 화면으로 전환 로직 추가 예정
    }
    setLoading(false);
  };

  // 회원가입 로직
  const handleSignUp = async () => {
    if (!email || !password || !username) return alert("모든 항목을 입력해주세요.");
    if (password.length < 6) return alert("비밀번호를 6자 이상 입력해주세요."); // 프론트엔드 검증

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: username, // 유저 메타데이터에 닉네임 저장
        },
      },
    });

    if (error) {
      alert("가입 실패: " + error.message);
    } else {
      alert(`${username}님, 가입 확인 메일을 보냈습니다!`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">

      {/* 입력창들 크기 조정하려면 <div className="w-full max-w-[320px]"> 수치를 직접 입력하여 미세하게 조정 가능 */}


        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-[#FF9900] mb-4 tracking-wider">
            just RPS
          </h1>
          
          {/* 이미지로 교체된 가위바위보 아이콘 섹션 */}
          <div className="flex justify-center items-center gap-1 mb-4">
            <div className="w-20 h-20 rounded-2xl bg-black/50 flex items-center justify-center backdrop-blur-sm overflow-hidden">
              <img src="/images/rock.png" alt="Rock" className="w-full h-full object-cover" />
            </div>
            
            <div className="w-20 h-20 rounded-2xl bg-black/50 flex items-center justify-center backdrop-blur-sm overflow-hidden">
              <img src="/images/paper.png" alt="Paper" className="w-full h-full object-cover" />
            </div>

            <div className="w-20 h-20 rounded-2xl bg-black/50 flex items-center justify-center backdrop-blur-sm overflow-hidden">
              <img src="/images/scissor.png" alt="Scissors" className="w-full h-full object-cover" />
            </div>
 
          </div>

          {/* 버전 정보 추가 */}
          <p className="text-[#FF9900] text-sm mb-8">v1.1.1</p>

        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">

            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white h-12"
              required
            />

            {/* 닉네임 입력창 추가 */}
            <Input
              type="text"
              placeholder="Nickname"
              value={username}
              onChange={(e: any) => setUsername(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white h-12"
              required
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white h-12"
              required
            />
            {/* 비밀번호 가이드 메시지 */}
            <p className="text-[15px] text-zinc-500 mt-1 ml-1">
              * 비밀번호는 최소 6자 이상 입력해주세요.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked: any) => setRememberMe(checked as boolean)}
              />
              <label htmlFor="remember" className="text-sm text-white cursor-pointer">
                기억하기
              </label>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#FF9900] hover:bg-[#FF9900]/90 text-black font-bold text-lg"
          >
            {loading ? 'WAIT...' : 'LOG IN'}
          </Button>

          {/* 회원가입 버튼 */}
          <button
            type="button"
            onClick={handleSignUp}
            className="w-full mt-4 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            신규 유저이신가요? <span className="text-[#FF9900] underline">회원가입하기</span>
          </button>
        </form>

  
      </div>
    </div>
  );
}