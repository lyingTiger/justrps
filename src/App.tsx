import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; 
import GameEngine from './GameEngine';

export default function App() {
  // --- 1. 상태 관리 (States) ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState<'lobby' | 'modeSelect' | 'battle'>('lobby');
  const [round, setRound] = useState(1);
  const [selectedOption, setSelectedOption] = useState<string>('DRAW MODE');
  const [isCoinMenuOpen, setIsCoinMenuOpen] = useState(false);

  // 인증 및 UI 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [userNickname, setUserNickname] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // --- 2. 시스템 로직 ---
  const playSound = (path: string) => {
    const audio = new Audio(path);
    audio.volume = isMuted ? 0 : volume;
    audio.play().catch(() => {});
  };
  const playClickSound = () => playSound('/sound/mouseClick.mp3');

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
      const { error } = await supabase.auth.signUp({ 
        email, 
        password, 
        options: { data: { display_name: username } } 
      });
      if (error) alert(error.message); else alert("가입 확인 메일을 보냈습니다!");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message); else { 
        setIsLoggedIn(true); 
        setUserNickname(data.user?.user_metadata.display_name || 'Player'); 
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    playClickSound();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setView('lobby');
    setIsUserMenuOpen(false);
  };

  // --- 3. UI 렌더링 (인증 화면) ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-[320px]">
          <h1 className="text-5xl font-black text-[#FF9900] mb-8 text-center italic border-b-2 border-[#FF9900]/20 pb-4 tracking-tighter uppercase">just RPS</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white focus:border-[#FF9900] outline-none" required />
            {isSignUpMode && <input type="text" placeholder="Nickname" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white focus:border-[#FF9900] outline-none" required />}
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white focus:border-[#FF9900] outline-none" required />
            <div className="flex items-center gap-2 py-1 ml-1">
              <input type="checkbox" id="rem" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="accent-[#FF9900]" />
              <label htmlFor="rem" className="text-[11px] text-zinc-500">접속 정보 기억하기</label>
            </div>
            <button type="submit" className="w-full h-14 bg-[#FF9900] text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all shadow-lg shadow-orange-900/20">{loading ? 'Wait...' : (isSignUpMode ? 'Join Now' : 'Log In')}</button>
            <button type="button" onClick={() => setIsSignUpMode(!isSignUpMode)} className="w-full text-xs text-zinc-500 text-center underline font-bold mt-2 hover:text-white transition-colors">{isSignUpMode ? "로그인하기" : "회원가입하기"}</button>
          </form>
        </div>
      </div>
    );
  }

  // --- 4. UI 렌더링 (메인 게임 화면) ---
  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans" onClick={() => setIsUserMenuOpen(false)}>
      {/* 헤더 섹션: 복구된 볼륨, 코인, 드롭다운 포함 */}
      <header className="w-full p-6 flex justify-between items-center border-b border-zinc-800 bg-black sticky top-0 z-50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-bold text-[#FF9900] tracking-tighter cursor-pointer uppercase" onClick={() => setView('lobby')}>just RPS</h2>
          
          {/* 볼륨 조절부 복구 */}
          <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800 text-white font-bold">
            <button onClick={() => { playClickSound(); setIsMuted(!isMuted); }} className={`text-[10px] w-8 text-left ${isMuted ? 'text-zinc-600' : 'text-white'}`}>VOL.</button>
            <div className="flex items-center gap-2 border-l border-zinc-800 pl-2">
              <button onClick={() => { playClickSound(); setVolume(prev => Math.max(prev - 0.1, 0)); }} className="w-5 h-5 flex items-center justify-center bg-zinc-800 rounded text-[10px] hover:bg-zinc-700">-</button>
              <span className="text-[11px] font-mono w-9 text-center">{isMuted ? '0' : Math.round(volume * 100)}%</span>
              <button onClick={() => { playClickSound(); setVolume(prev => Math.min(prev + 0.1, 1)); }} className="w-5 h-5 flex items-center justify-center bg-zinc-800 rounded text-[10px] hover:bg-zinc-700">+</button>
            </div>
          </div>
        </div>

       <div className="flex items-center gap-4">
            {/* [수정] 닉네임 메뉴: Settings 우선 노출 */}
            <div className="relative">
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsUserMenuOpen(!isUserMenuOpen); 
                  setIsCoinMenuOpen(false); // 코인 메뉴는 닫기
                }} 
                className="text-sm font-medium hover:text-[#FF9900] transition-colors flex items-center gap-1"
              >
                {userNickname} <span className="text-[10px] opacity-50">▼</span>
              </button>
              
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-lg py-1 z-[100] shadow-2xl">
                  <button className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold text-white">Settings</button>
                  <div className="border-t border-zinc-800 my-1"></div>
                  <button 
                    onClick={handleLogout} 
                    className="w-full text-left px-4 py-2 text-xs text-red-500 font-bold hover:bg-zinc-800"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* [수정] 코인 영역: 클릭 시 충전 메뉴 노출 */}
            <div className="relative">
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsCoinMenuOpen(!isCoinMenuOpen); 
                  setIsUserMenuOpen(false); // 유저 메뉴는 닫기
                }}
                className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800 hover:bg-zinc-800 transition-colors"
              >
                <img src="/images/coin.png" alt="coin" className="w-4 h-4 object-contain" />
                <span className="text-[#FF9900] font-bold text-sm tracking-tighter font-mono">1,250</span>
                <span className="text-[10px] opacity-50 ml-1">▼</span>
              </button>

              {isCoinMenuOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-zinc-900 border border-zinc-800 rounded-lg py-1 z-[100] shadow-2xl">
                  <button className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold text-[#FF9900]">Buy Coins</button>
                  
                </div>
              )}
            </div>
          </div>
      </header>

      {/* 중앙 메인 컨텐츠 */}
      <main className="flex-1 flex flex-col items-center justify-start p-0">
        {view === 'lobby' && (
          <div className="w-full max-w-[320px] flex flex-col items-center mt-16 space-y-3">
             <div className="flex gap-3 mb-12">
               {['rock', 'paper', 'scissor'].map(img => (
                 <div key={img} className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl shadow-orange-900/10">
                   <img src={`/images/${img}.png`} className="w-full h-full object-cover" alt={img} />
                 </div>
               ))}
             </div>
             <button onClick={() => setView('modeSelect')} className="w-full h-14 rounded-md font-bold text-lg bg-[#FF9900] text-black uppercase tracking-widest active:scale-95 transition-all">Play</button>
             <button className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase hover:bg-zinc-800">Shop</button>
             <button className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase text-xs hover:bg-zinc-800">Best Records</button>
             <button className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase font-mono text-sm tracking-tighter hover:bg-zinc-800">Tutorial</button>
          </div>
        )}

        {view === 'modeSelect' && (
          <div className="w-full max-w-[320px] flex flex-col items-center mt-16 gap-3">
            <button onClick={() => { setRound(1); setView('battle'); }} className="w-full h-14 rounded-md font-bold text-lg bg-[#FF9900] text-black uppercase active:scale-95 transition-all">Multiplay</button>
            <button onClick={() => { setRound(1); setView('battle'); }} className="w-full h-14 rounded-md font-bold text-lg bg-[#FF9900] text-black uppercase active:scale-95 transition-all">Single Play</button>
            <h3 className="text-[#FF9900] text-[10px] font-bold text-center mt-2 uppercase tracking-widest">Select Mode</h3>
            <div className="grid grid-cols-2 gap-2 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 w-full">
              {['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE'].map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-[10px] font-bold group">
                  <input type="radio" checked={selectedOption === opt} onChange={() => { playClickSound(); setSelectedOption(opt); }} className="accent-[#FF9900]" />
                  <span className={selectedOption === opt ? 'text-[#FF9900]' : 'text-zinc-500 group-hover:text-zinc-300 transition-colors uppercase'}>{opt}</span>
                </label>
              ))}
            </div>
            <button onClick={() => setView('lobby')} className="text-xs text-zinc-500 text-center underline uppercase mt-2 hover:text-white transition-colors">Back to Lobby</button>
          </div>
        )}

        {view === 'battle' && (
          <GameEngine 
            round={round} 
            mode={selectedOption} 
            playClickSound={playClickSound}
            onRoundClear={(next) => setRound(next)}
            onGameOver={(r, t) => { 
              alert(`GAME OVER\nRound: ${r}\nTime: ${t.toFixed(2)}s`); 
              setView('lobby'); 
              setRound(1);
            }}
          />
        )}

        {/* 하단 스탯 보드 */}
        {view !== 'battle' && (
          <div className="mt-16 p-6 rounded-3xl bg-zinc-900/20 border border-zinc-800/50 flex gap-10 backdrop-blur-sm shadow-xl">
            <div className="text-center"><p className="text-[10px] text-zinc-500 uppercase mb-1 font-bold tracking-tighter">Total Games</p><p className="text-2xl font-bold font-mono tracking-tighter text-white">42</p></div>
            <div className="text-center"><p className="text-[10px] text-zinc-500 uppercase mb-1 font-bold tracking-tighter">Win Rate</p><p className="text-green-400 text-2xl font-bold font-mono tracking-tighter">67%</p></div>
            <div className="text-center"><p className="text-[10px] text-zinc-500 uppercase mb-1 font-bold tracking-tighter">Rank</p><p className="text-[#FF9900] text-2xl font-bold font-mono tracking-tighter">#156</p></div>
          </div>
        )}
      </main>
    </div>
  );
}