import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import GameEngine from './GameEngine';
import SettingsPage from './SettingsPage';
import RankingPage from './RankingPage';
import ResultModal from './ResultModal';
import MultiplayPage from './MultiplayPage';
import TutorialPage from './TutorialPage';
import WaitingRoom from './WaitingRoom'; 
import MultiGameEngine from './MultiGameEngine'; 

export default function App() {
  // --- 1. 상태 관리 ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // 🛠️ [START] currentUserId 상태 정의 🛠️
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // 🛠️ [END] 🛠️

  const [view, setView] = useState<'lobby' | 'modeSelect' | 'battle' | 'settings' | 'ranking' | 'shop' | 'multiplay' | 'waitingRoom' | 'tutorial' | 'multiBattle'>('lobby');
  const [round, setRound] = useState(1);
  const [selectedOption, setSelectedOption] = useState<string>('DRAW MODE');

  const [userNickname, setUserNickname] = useState('Loading...');
  const [userCoins, setUserCoins] = useState(0); 
  const [sessionCoins, setSessionCoins] = useState(0); 
  const [stats, setStats] = useState({ total_games: 0, multi_win_rate: 0, best_rank: 0, best_mode: '' });
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);

  const [showResultModal, setShowResultModal] = useState(false);
  const [resultData, setResultData] = useState({ round: 0, time: 0, coins: 0, isNewRecord: false });
  const [continueCount, setContinueCount] = useState(3);
  const CONTINUE_COST = 50;

  const [gameKey, setGameKey] = useState(Date.now());
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "just RPS";
  }, []);

  const playClickSound = () => {
    const audio = new Audio('/sound/mouseClick.mp3');
    audio.volume = isMuted ? 0 : volume;
    audio.play().catch(() => {});
  };

  const fetchUserData = async (userId: string) => {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profile) {
      setUserNickname(profile.display_name || 'Player');
      setUserCoins(profile.coins || 0);
      
      const { data: statsData } = await supabase.rpc('get_user_stats', { target_user_id: userId });
      
      const winRate = profile.multi_games > 0 
        ? Math.round((profile.multi_score / profile.multi_games) * 100) 
        : 0;

      setStats({
        total_games: statsData?.[0]?.total_games || 0,
        multi_win_rate: winRate,
        best_rank: statsData?.[0]?.best_rank || 0,
        best_mode: statsData?.[0]?.best_mode || ''
      });
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) alert(error.message);
  };

  const handleSaveNickname = async (newNickname: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ display_name: newNickname }).eq('id', user.id);
    if (!error) {
      setUserNickname(newNickname);
      alert("닉네임이 변경되었습니다!");
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
        // ✨ [START] 로그인 시 ID 저장 ✨
        setCurrentUserId(data.user.id);
        // ✨ [END] ✨
        fetchUserData(data.user.id);
      }
    };
    checkUser();
  }, [view]);

  const handleGameOver = async (finalRound: number, entryTime: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: record } = await supabase.from('mode_records').select('*').eq('user_id', user.id).eq('mode', selectedOption).maybeSingle();
    const isNewRecord = !record || finalRound > record.best_round || (finalRound === record.best_round && entryTime < record.best_time);

    if (isNewRecord) {
      await supabase.from('mode_records').upsert({ 
        user_id: user.id, mode: selectedOption, best_round: finalRound, best_time: entryTime, updated_at: new Date().toISOString() 
      }, { onConflict: 'user_id, mode' });
    }

    await Promise.all([
      supabase.from('game_logs').insert({ user_id: user.id, mode: selectedOption, reached_round: finalRound, play_time: entryTime }),
      sessionCoins > 0 ? supabase.rpc('add_coins_batch', { row_id: user.id, amount: sessionCoins }) : Promise.resolve()
    ]);

    setResultData({ round: finalRound, time: entryTime, coins: sessionCoins, isNewRecord: isNewRecord });
    setShowResultModal(true);
  };

  const handleContinue = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || userCoins < CONTINUE_COST || continueCount <= 0) return;

    const { error } = await supabase.rpc('add_coins_batch', { row_id: user.id, amount: -CONTINUE_COST });
    if (!error) {
      setUserCoins(prev => prev - CONTINUE_COST);
      setContinueCount(prev => prev - 1);
      setShowResultModal(false); 
    }
  };

  const resetGameSession = () => {
    setRound(1);
    setSessionCoins(0);
    setContinueCount(3);
    setGameKey(Date.now());
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setView('lobby');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isSignUpMode) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: username } } });
      if (data?.user) {
        await supabase.from('profiles').insert({ id: data.user.id, display_name: username, coins: 0 });
        alert("가입 확인 메일을 보냈습니다!");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (data.user) {
        setIsLoggedIn(true);
        fetchUserData(data.user.id);
      }
    }
    setLoading(false);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-[320px]">
          <h1 className="text-5xl font-black text-[#FF9900] mb-8 text-center italic tracking-tighter uppercase">just RPS</h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none" required />
            {isSignUpMode && <input type="text" placeholder="Nickname" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none" required />}
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none" required />
            <button type="submit" className="w-full h-14 bg-[#FF9900] text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all">
              {loading ? 'Wait...' : (isSignUpMode ? 'Join Now' : 'Log In')}
            </button>
          </form>

          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-[1px] bg-zinc-800"></div>
              <span className="text-zinc-600 text-[10px] font-bold uppercase">OR</span>
              <div className="flex-1 h-[1px] bg-zinc-800"></div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="w-full h-14 bg-zinc-900 text-white border border-zinc-800 font-bold rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-zinc-800"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="google" />
              <span>Continue with Google</span>
            </button>
          </div>

          <button type="button" onClick={() => setIsSignUpMode(!isSignUpMode)} className="w-full text-xs text-zinc-500 text-center underline font-bold mt-4">
            {isSignUpMode ? "이미 계정이 있으신가요? 로그인" : "처음이신가요? 회원가입"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans" onClick={() => setIsUserMenuOpen(false)}>
      <header className="w-full p-6 flex justify-between items-center border-b border-zinc-800 bg-black sticky top-0 z-50">
        <h2 className="text-2xl font-bold text-[#FF9900] tracking-tighter cursor-pointer uppercase italic" onClick={() => setView('lobby')}>just RPS</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            {/* ✨ [UPDATE] 닉네임 대소문자 유지 ✨ */}
            <button onClick={(e) => { e.stopPropagation(); setIsUserMenuOpen(!isUserMenuOpen); }} className="text-sm font-bold hover:text-[#FF9900] transition-colors flex items-center gap-1 tracking-tighter">
              {userNickname} <span className="text-[10px] opacity-50">▼</span>
            </button>
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-lg py-1 z-[100] shadow-2xl overflow-hidden">
                <button onClick={() => setView('settings')} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold uppercase">Settings</button>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-xs text-red-500 font-bold hover:bg-zinc-800 uppercase">Logout</button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
            <img src="/images/coin.png" alt="coin" className="w-4 h-4 object-contain" />
            <span className="text-[#FF9900] font-bold text-sm tracking-tighter font-mono">{userCoins.toLocaleString()}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-0">
        {view === 'settings' && (
          <SettingsPage 
            userNickname={userNickname} setUserNickname={setUserNickname} onSaveNickname={handleSaveNickname} 
            volume={volume} setVolume={setVolume} isMuted={isMuted} setIsMuted={setIsMuted} onBack={() => setView('lobby')} 
          />
        )}
        
        {view === 'lobby' && (
          <div className="w-full max-w-[320px] flex flex-col items-center mt-16 space-y-3 px-4">
             <div className="flex gap-3 mb-12">
               {['rock', 'paper', 'scissor'].map(img => <div key={img} className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl"><img src={`/images/${img}.png`} className="w-full h-full object-cover" /></div>)}
             </div>
             <button onClick={() => { resetGameSession(); setView('modeSelect'); }} className="w-full h-14 rounded-md font-bold text-lg bg-[#FF9900] text-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_0_20_rgba(255,153,0,0.2)]">Play</button>
             <button onClick={() => setView('shop')} className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase hover:bg-zinc-800">Shop</button>
             <button onClick={() => setView('ranking')} className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase hover:bg-zinc-800">Best Records</button>
             <button onClick={() => setView('tutorial')} className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase hover:bg-zinc-800">Tutorial</button>

             <div className="mt-16 p-6 rounded-3xl bg-zinc-900/20 border border-zinc-800/50 backdrop-blur-sm shadow-xl w-full flex flex-col items-center">
                <div className="grid grid-cols-3 w-full mb-1">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold text-center">Total Play</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold text-center">Win Rate</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold text-center">Best Rank</p>
                </div>
                <div className="grid grid-cols-3 w-full mb-1 items-center">
                  <p className="text-2xl font-bold font-mono text-white text-center">{stats.total_games}</p>
                  <p className="text-2xl font-bold font-mono text-green-400 text-center">{stats.multi_win_rate > 0 ? `${stats.multi_win_rate}%` : '-'}</p>
                  <p className="text-2xl font-bold font-mono text-[#FF9900] text-center">#{stats.best_rank > 0 ? stats.best_rank : '-'}</p>
                </div>
                <div className="grid grid-cols-3 w-full">
                  <div /><div />
                  <p className="text-[10px] text-white uppercase font-bold text-center">{stats.best_mode?.split(' ')[0]}</p>
                </div>
             </div>
          </div>
        )}

        {view === 'modeSelect' && (
          <div className="w-full max-w-[320px] flex flex-col items-center mt-16 gap-3 px-4">
            <button onClick={() => { resetGameSession(); setView('battle'); }} className="w-full h-14 rounded-md font-bold text-lg bg-[#FF9900] text-black uppercase active:scale-95 transition-all shadow-[0_0_20px_rgba(255,153,0,0.2)]">Single Play</button>
            <button onClick={() => setView('multiplay')} className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase hover:bg-zinc-800">Multi Play</button>
            <h3 className="text-[#FF9900] text-[10px] font-bold text-center mt-6 uppercase tracking-widest italic">Select Mode</h3>
            <div className="grid grid-cols-2 gap-2 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 w-full shadow-inner">
              {['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE'].map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-[10px] font-bold">
                  <input type="radio" checked={selectedOption === opt} onChange={() => setSelectedOption(opt)} className="accent-[#FF9900]" />
                  <span className={selectedOption === opt ? 'text-[#FF9900]' : 'text-zinc-500 uppercase'}>{opt}</span>
                </label>
              ))}
            </div>
            <button onClick={() => setView('lobby')} className="text-[10px] text-zinc-600 underline uppercase mt-8 font-bold">Back to Lobby</button>
          </div>
        )}

        {view === 'multiplay' && (
          <MultiplayPage 
            selectedMode={selectedOption} 
            onBack={() => setView('modeSelect')} 
            onJoin={(roomId: string) => { setCurrentRoomId(roomId); setView('waitingRoom'); }}
          />
        )}

        {view === 'waitingRoom' && (
          <WaitingRoom 
            roomId={currentRoomId} 
            onLeave={() => setView('multiplay')}
            onStartGame={() => setView('multiBattle')} 
          />
        )}

        {view === 'multiBattle' && currentRoomId && (
          <MultiGameEngine 
            roomId={currentRoomId}
            userNickname={userNickname}
            playClickSound={playClickSound}
            onGameOver={(finalRound, rank) => {
              if (currentUserId) fetchUserData(currentUserId); 
              setView('lobby'); 
            }}
            onBackToLobby={() => setView('lobby')}
          />
        )}

        {view === 'tutorial' && <TutorialPage onBack={() => setView('lobby')} />}

        {view === 'battle' && (
          <GameEngine 
            key={gameKey} round={round} mode={selectedOption} playClickSound={playClickSound} 
            onEarnCoin={handleEarnCoin} onRoundClear={(next) => setRound(next)} 
            onGameOver={handleGameOver} isModalOpen={showResultModal} 
          />
        )}

        {view === 'ranking' && <RankingPage onBack={() => setView('lobby')} playClickSound={playClickSound} />}
        {view === 'shop' && <div className="p-20 text-white font-bold uppercase text-center animate-pulse">Shop coming soon...<button onClick={() => setView('lobby')} className="block mx-auto mt-4 text-xs underline">Back</button></div>}
      </main>

      <ResultModal 
        isOpen={showResultModal} mode={selectedOption} round={resultData.round} time={resultData.time}
        earnedCoins={resultData.coins} userCoins={userCoins} isNewRecord={resultData.isNewRecord}
        continueCount={continueCount} continueCost={CONTINUE_COST} onContinue={handleContinue}
        onRetry={() => { playClickSound(); setShowResultModal(false); resetGameSession(); setView('battle'); }}
        onLobby={() => { playClickSound(); setShowResultModal(false); resetGameSession(); setView('lobby'); }}
        onShop={() => { playClickSound(); setShowResultModal(false); setView('shop'); }}
      />
    </div>
  );
}