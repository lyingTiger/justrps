import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; 

export default function App() {
  // ==========================================
  // 1. 상태 관리 (States)
  // ==========================================
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false); 
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false); // 닉네임 메뉴 상태
  const [isCoinMenuOpen, setIsCoinMenuOpen] = useState(false); // 코인 메뉴 상태
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [userNickname, setUserNickname] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);

  // ==========================================
  // 2. 사운드 시스템 (Sound System)
  // ==========================================
  const playSound = (path: string) => {
    const audio = new Audio(path);
    audio.volume = isMuted ? 0 : volume;
    audio.play().catch(() => {});
  };
  const playClickSound = () => playSound('/sound/mouseClick.mp3');
  const playStartSound = () => playSound('/sound/startSound.mp3');

  const increaseVolume = () => { 
    playClickSound(); 
    setVolume(prev => Math.min(prev + 0.1, 1.0)); 
    if (isMuted) setIsMuted(false); 
  };
  const decreaseVolume = () => { 
    playClickSound(); 
    setVolume(prev => Math.max(prev - 0.1, 0.0)); 
  };

  // ==========================================
  // 3. 인증 및 사용자 로직 (Auth Logic)
  // ==========================================
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setIsLoggedIn(true);
        setUserNickname(data.user.user_metadata.display_name || 'Player');
      }
    };
    checkUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();
    setLoading(true);

    if (isSignUpMode) {
      if (!username) return alert("닉네임을 입력해주세요.");
      const { error } = await supabase.auth.signUp({
        email, password, options: { data: { display_name: username } }
      });
      if (error) alert(error.message);
      else alert("가입 확인 메일을 보냈습니다!");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
      else {
        playStartSound();
        setIsLoggedIn(true);
        setUserNickname(data.user?.user_metadata.display_name || 'Player');
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    playClickSound();
    setIsUserMenuOpen(false);
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  };

  // ==========================================
  // 4. 로비 화면 렌더링 (Lobby View)
  // ==========================================
  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col font-sans" onClick={() => { setIsUserMenuOpen(false); setIsCoinMenuOpen(false); }}>
        
        {/* [파트 A] 상단 헤더 섹션 */}
        <header className="w-full p-6 flex justify-between items-center border-b border-zinc-800 bg-black/50 backdrop-blur-md sticky top-0 z-50" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-bold text-[#FF9900] tracking-tighter cursor-default">just RPS</h2>
            
            {/* 볼륨 컨트롤러 */}
            <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
              <button 
                onClick={() => { playClickSound(); setIsMuted(!isMuted); }} 
                className={`text-[10px] font-bold w-8 text-left transition-colors ${isMuted ? 'text-zinc-600' : 'text-white'}`}
              >
                VOL.
              </button>
              <div className="flex items-center gap-2 border-l border-zinc-800 pl-2">
                <button onClick={decreaseVolume} className="w-5 h-5 flex items-center justify-center bg-zinc-800 rounded hover:bg-zinc-700 text-[10px] text-white">-</button>
                <span className="text-[11px] font-mono w-9 text-center text-white font-medium">
                  {isMuted ? '0' : Math.round(volume * 100)}%
                </span>
                <button onClick={increaseVolume} className="w-5 h-5 flex items-center justify-center bg-zinc-800 rounded hover:bg-zinc-700 text-[10px] text-white">+</button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* 닉네임 드롭다운: 설정, 로그아웃 */}
            <div className="relative">
              <button 
                onClick={() => { playClickSound(); setIsUserMenuOpen(!isUserMenuOpen); setIsCoinMenuOpen(false); }}
                className="flex items-center gap-2 bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800 hover:bg-zinc-800 transition-colors"
              >
                <span className="text-sm font-medium">{userNickname}</span>
                <span className="text-[10px] text-zinc-500">▼</span>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 z-[100]">
                  <button onClick={() => { playClickSound(); setIsUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800">설정</button>
                  <div className="border-t border-zinc-800 my-1" />
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-zinc-800 font-bold">로그아웃</button>
                </div>
              )}
            </div>

            {/* 코인 드롭다운: 코인 충전 */}
            <div className="relative">
              <button 
                onClick={() => { playClickSound(); setIsCoinMenuOpen(!isCoinMenuOpen); setIsUserMenuOpen(false); }}
                className="flex items-center gap-1.5 bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800 hover:bg-zinc-800 transition-colors"
              >
                <img src="/images/coin.png" alt="coin" className="w-4 h-4" />
                <span className="text-sm font-bold text-[#FF9900]">1,250</span>
                <span className="text-[10px] text-zinc-500 ml-1">▼</span>
              </button>

              {isCoinMenuOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 z-[100]">
                  <button onClick={() => { playClickSound(); setIsCoinMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800">코인 충전</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* [파트 B] 메인 로비 콘텐츠 */}
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="flex gap-3 mb-12">
            {['rock', 'paper', 'scissor'].map((img) => (
              <div key={img} className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800 overflow-hidden shadow-xl shadow-orange-900/10">
                <img src={`/images/${img}.png`} alt={img} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          <div className="w-full max-w-[320px] space-y-3">
            {['PLAY', 'SHOP', 'BEST RECORDS', 'TUTORIAL'].map((text) => (
              <button 
                key={text} 
                onClick={playClickSound} 
                className={`w-full h-14 rounded-md font-bold text-lg tracking-widest transition-all active:scale-95 ${
                  text === 'PLAY' ? 'bg-[#FF9900] text-black hover:bg-[#FF8000]' : 'bg-zinc-900 text-white border border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="mt-16 p-6 rounded-3xl bg-zinc-900/20 border border-zinc-800/50 flex gap-10 backdrop-blur-sm">
            <div className="text-center"><p className="text-[10px] text-zinc-500 uppercase mb-1">Total Games</p><p className="text-2xl font-bold">42</p></div>
            <div className="text-center"><p className="text-[10px] text-zinc-500 uppercase mb-1">Win Rate</p><p className="text-2xl font-bold text-green-400">67%</p></div>
            <div className="text-center"><p className="text-[10px] text-zinc-500 uppercase mb-1">Rank</p><p className="text-2xl font-bold text-[#FF9900]">#156</p></div>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // 5. 로그인/회원가입 화면 렌더링 (Auth View)
  // ==========================================
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-[320px]">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-[#FF9900] mb-6 tracking-tighter border-b-2 border-[#FF9900]/20 pb-4">just RPS</h1>
          <p className="text-[#FF9900]/60 text-[10px] font-mono tracking-widest uppercase">System v1.1.1</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white focus:outline-none focus:border-[#FF9900] transition-colors" required />
          {isSignUpMode && (
            <input type="text" placeholder="Nickname" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white focus:outline-none focus:border-[#FF9900] transition-colors" required />
          )}
          <div className="space-y-1.5">
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white focus:outline-none focus:border-[#FF9900] transition-colors" required />
          </div>
          <div className="flex items-center gap-2 py-2">
            <input type="checkbox" id="rem" checked={rememberMe} onChange={(e) => { playClickSound(); setRememberMe(e.target.checked); }} className="accent-[#FF9900]" />
            <label htmlFor="rem" className="text-xs text-zinc-500 cursor-pointer hover:text-white transition-colors">접속 정보 기억하기</label>
          </div>
          <button type="submit" className="w-full h-14 bg-[#FF9900] text-black font-black text-lg rounded-xl hover:bg-[#FF8000] transition-all active:scale-95 shadow-lg shadow-orange-900/20 uppercase tracking-widest">
            {loading ? 'WAIT...' : (isSignUpMode ? 'Join Now' : 'Log In')}
          </button>
          <button 
            type="button" 
            onClick={() => { playClickSound(); setIsSignUpMode(!isSignUpMode); }} 
            className="w-full text-xs text-zinc-500 hover:text-[#FF9900] transition-colors mt-2 text-center"
          >
            {isSignUpMode ? "이미 계정이 있으신가요?" : "신규 플레이어이신가요?"} <span className="underline font-bold ml-1">{isSignUpMode ? "로그인하기" : "회원가입"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}