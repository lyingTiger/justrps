import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import GameEngine from './GameEngine';
import SettingsPage from './SettingsPage';
import RankingPage from './RankingPage';

export default function App() {
  // --- 1. 상태 관리 ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState<'lobby' | 'modeSelect' | 'battle' | 'settings' | 'ranking'>('lobby');
  const [round, setRound] = useState(1);
  const [selectedOption, setSelectedOption] = useState<string>('DRAW MODE');

  const [userNickname, setUserNickname] = useState('');
  const [userCoins, setUserCoins] = useState(0); 
  const [sessionCoins, setSessionCoins] = useState(0); 
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCoinMenuOpen, setIsCoinMenuOpen] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);

  // --- 2. 시스템 로직 ---
  const playSound = (path: string) => {
    const audio = new Audio(path);
    audio.volume = isMuted ? 0 : volume;
    audio.play().catch(() => {});
  };
  const playClickSound = () => playSound('/sound/mouseClick.mp3');

  const closeMenus = () => {
    setIsUserMenuOpen(false);
    setIsCoinMenuOpen(false);
  };

  // 유저 데이터(닉네임, 코인) 불러오기
  const fetchUserData = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, coins') // display_name 컬럼 사용
      .eq('id', userId)
      .single();
    
    if (profile) {
      setUserNickname(profile.display_name || 'Player');
      setUserCoins(profile.coins || 0);
    }
  };

  // [추가] 닉네임 저장 로직
  const handleSaveNickname = async (newNickname: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // profiles 테이블의 display_name 업데이트
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: newNickname })
      .eq('id', user.id);

    if (error) {
      console.error("저장 실패:", error.message);
      alert("닉네임 저장 중 오류가 발생했습니다.");
    } else {
      setUserNickname(newNickname); // UI 상태 업데이트
      alert("닉네임이 성공적으로 변경되었습니다!");
    }
  };

  const handleEarnCoin = () => {
    setUserCoins(prev => prev + 1);
    setSessionCoins(prev => prev + 1);
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setIsLoggedIn(true);
        fetchUserData(data.user.id);
      }
    };
    checkUser();
  }, [view]);

  const handleGameOver = async (finalRound: number, finalTime: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (sessionCoins > 0) {
      await supabase.rpc('add_coins_batch', { row_id: user.id, amount: sessionCoins });
    }

    const currentMode = selectedOption;
    const { data: record } = await supabase
      .from('mode_records')
      .select('best_round, best_time')
      .eq('user_id', user.id)
      .eq('mode', currentMode)
      .single();

    const isNewRecord = !record || finalRound > record.best_round || (finalRound === record.best_round && finalTime < record.best_time);

    if (isNewRecord) {
      await supabase.from('mode_records').upsert({
        user_id: user.id,
        mode: currentMode,
        best_round: finalRound,
        best_time: finalTime,
        updated_at: new Date().toISOString()
      });
    }

    await supabase.from('game_logs').insert({ 
      user_id: user.id, 
      mode: currentMode, 
      reached_round: finalRound, 
      play_time: finalTime 
    });

    alert(`GAME OVER\nEarned Coins: ${sessionCoins}\n${isNewRecord ? 'NEW RECORD! 🎉' : ''}`);
    
    setSessionCoins(0);
    setView('lobby');
    setRound(1);
  };

  const handleLogout = async () => {
    playClickSound();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setView('lobby');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isSignUpMode) {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password, 
        options: { data: { display_name: username } } 
      });
      if (data?.user) {
        await supabase.from('profiles').insert({ 
          id: data.user.id, 
          display_name: username, 
          coins: 0 
        });
        alert("가입 확인 메일을 보냈습니다!");
      }
      if (error) alert(error.message);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message); 
      else if (data.user) {
        setIsLoggedIn(true);
        fetchUserData(data.user.id);
      }
    }
    setLoading(false);
  };

  // --- 3. 렌더링 (로그인 화면) ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-[320px]">
          <h1 className="text-5xl font-black text-[#FF9900] mb-8 text-center italic border-b-2 border-[#FF9900]/20 pb-4 tracking-tighter uppercase">just RPS</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white focus:border-[#FF9900] outline-none" required />
            {isSignUpMode && <input type="text" placeholder="Nickname" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white focus:border-[#FF9900] outline-none" required />}
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white focus:border-[#FF9900] outline-none" required />
            <button type="submit" className="w-full h-14 bg-[#FF9900] text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all">{loading ? 'Wait...' : (isSignUpMode ? 'Join Now' : 'Log In')}</button>
            <button type="button" onClick={() => setIsSignUpMode(!isSignUpMode)} className="w-full text-xs text-zinc-500 text-center underline font-bold mt-2">{isSignUpMode ? "로그인하기" : "회원가입하기"}</button>
          </form>
        </div>
      </div>
    );
  }

  // --- 4. 렌더링 (메인 화면) ---
  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans" onClick={closeMenus}>
      <header className="w-full p-6 flex justify-between items-center border-b border-zinc-800 bg-black sticky top-0 z-50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-bold text-[#FF9900] tracking-tighter cursor-pointer uppercase" onClick={() => setView('lobby')}>just RPS</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setIsUserMenuOpen(!isUserMenuOpen); setIsCoinMenuOpen(false); }} className="text-sm font-bold hover:text-[#FF9900] transition-colors flex items-center gap-1 uppercase tracking-tighter">
              {userNickname || 'Player'} <span className="text-[10px] opacity-50">▼</span>
            </button>
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-lg py-1 z-[100] shadow-2xl">
                <button onClick={() => { setView('settings'); setIsUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold">Settings</button>
                <div className="border-t border-zinc-800 my-1"></div>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-xs text-red-500 font-bold hover:bg-zinc-800">Logout</button>
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setIsCoinMenuOpen(!isCoinMenuOpen); setIsUserMenuOpen(false); }} className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800 hover:bg-zinc-800 transition-colors">
              <img src="/images/coin.png" alt="coin" className="w-4 h-4 object-contain" />
              <span className="text-[#FF9900] font-bold text-sm tracking-tighter font-mono">{userCoins.toLocaleString()}</span>
              <span className="text-[10px] opacity-50 ml-1">▼</span>
            </button>
            {isCoinMenuOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-lg py-1 z-[100] shadow-2xl text-center">
                <button className="w-full px-4 py-2 text-xs hover:bg-zinc-800 font-bold text-[#FF9900]">Buy Coins</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-0">
        {/* SettingsPage 호출 부분 */}
        {view === 'settings' && (
          <SettingsPage 
            userNickname={userNickname} 
            setUserNickname={setUserNickname} 
            onSaveNickname={handleSaveNickname} // 닉네임 저장 함수 전달
            volume={volume} 
            setVolume={setVolume} 
            isMuted={isMuted} 
            setIsMuted={setIsMuted} 
            onBack={() => setView('lobby')} 
          />
        )}

        {view === 'lobby' && (
          <div className="w-full max-w-[320px] flex flex-col items-center mt-16 space-y-3">

             <div className="flex gap-3 mb-12">
               {['rock', 'paper', 'scissor'].map(img => <div key={img} className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl shadow-orange-900/10"><img src={`/images/${img}.png`} className="w-full h-full object-cover" /></div>)}
             </div>

             <button onClick={() => { setSessionCoins(0); setView('modeSelect'); }} 
             className="w-full h-14 rounded-md font-bold text-lg bg-[#FF9900] text-black uppercase tracking-widest active:scale-95 transition-all">Play</button>

             <button className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase hover:bg-zinc-800">Shop</button>
            
             <button onClick={() => { playClickSound(); setView('ranking'); }} 
              className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase text-lg hover:bg-zinc-800">Best Records</button>

             <button className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase font-mono text-lg tracking-tighter">Tutorial</button>
          </div>
        )}

        {view === 'modeSelect' && (
          <div className="w-full max-w-[320px] flex flex-col items-center mt-16 gap-3">
            <button onClick={() => alert('Coming Soon!')} className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-700 uppercase opacity-50 cursor-not-allowed">Multiplay</button>
            <button onClick={() => { setRound(1); setView('battle'); }} className="w-full h-14 rounded-md font-bold text-lg bg-[#FF9900] text-black uppercase active:scale-95 transition-all">Single Play</button>
            <h3 className="text-[#FF9900] text-[10px] font-bold text-center mt-4 uppercase tracking-widest">Select Mode</h3>
            <div className="grid grid-cols-2 gap-2 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 w-full">
              {['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE'].map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-[10px] font-bold group">
                  <input type="radio" checked={selectedOption === opt} onChange={() => { playClickSound(); setSelectedOption(opt); }} className="accent-[#FF9900]" />
                  <span className={selectedOption === opt ? 'text-[#FF9900]' : 'text-zinc-500 uppercase'}>{opt}</span>
                </label>
              ))}
            </div>
            <button onClick={() => setView('lobby')} className="text-xs text-zinc-500 text-center underline uppercase mt-4 hover:text-white transition-colors">Back to Lobby</button>
          </div>
        )}

        {view === 'battle' && (
          <GameEngine 
            round={round} 
            mode={selectedOption} 
            playClickSound={playClickSound}
            onEarnCoin={handleEarnCoin}
            onRoundClear={(next) => setRound(next)}
            onGameOver={handleGameOver}
          />
        )}

        {(view === 'lobby' || view === 'modeSelect') && (
          <div className="mt-16 p-6 rounded-3xl bg-zinc-900/20 border border-zinc-800/50 flex gap-10 backdrop-blur-sm shadow-xl">
            <div className="text-center"><p className="text-[10px] text-zinc-500 uppercase mb-1 font-bold tracking-tighter">Total Games</p><p className="text-2xl font-bold font-mono tracking-tighter text-white">42</p></div>
            <div className="text-center"><p className="text-[10px] text-zinc-500 uppercase mb-1 font-bold tracking-tighter">Win Rate</p><p className="text-green-400 text-2xl font-bold font-mono tracking-tighter">67%</p></div>
            <div className="text-center"><p className="text-[10px] text-zinc-500 uppercase mb-1 font-bold tracking-tighter">Rank</p><p className="text-[#FF9900] text-2xl font-bold font-mono tracking-tighter">#156</p></div>
          </div>
        )}

        {view === 'ranking' && (
          <RankingPage 
            onBack={() => setView('lobby')} 
            playClickSound={playClickSound} 
          />
        )}
      </main>
    </div>
  );
}