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
  // --- 1. 유저 및 세션 상태 ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userNickname, setUserNickname] = useState('Loading...');
  const [userCoins, setUserCoins] = useState(0); 

  // --- 2. 게임 및 뷰 제어 ---
  const [view, setView] = useState<'lobby' | 'modeSelect' | 'battle' | 'settings' | 'ranking' | 'shop' | 'multiplay' | 'waitingRoom' | 'tutorial' | 'multiBattle'>('lobby');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null); 
  const [selectedOption, setSelectedOption] = useState<string>('DRAW MODE');
  const [round, setRound] = useState(1);
  const [gameKey, setGameKey] = useState(Date.now());

  // --- 3. 통계 및 설정 ---
  const [stats, setStats] = useState({ total_games: 0, multi_win_rate: 0, best_rank: 0, best_mode: '' });
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);

  // --- 4. 로그인 폼 상태 ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // --- 5. 결과창 상태 ---
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultData, setResultData] = useState({ round: 0, time: 0, coins: 0, isNewRecord: false });
  const [continueCount, setContinueCount] = useState(3);
  const [sessionCoins, setSessionCoins] = useState(0); 
  const CONTINUE_COST = 50;

  // --- [시스템: 데이터 로드] ---
const fetchUserData = async (userId: string) => {
    try {
      // profiles 테이블에서 데이터 가져오기
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (profile) {
        setUserNickname(profile.display_name || 'Player');
        setUserCoins(profile.coins || 0);

        // RPC를 통한 통계 정보 로드
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
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  // 2. 인증 상태 감지 및 초기화 (핵심 수정 부분)
// 1. 인증 상태 및 프로필 생성을 담당하는 useEffect
useEffect(() => {
  document.title = "just RPS";

  // auth 상태가 변할 때마다(로그인, 로그아웃, 세션 갱신 등) 실행되는 리스너
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const user = session.user;
      
      // 🚀 프로필이 있는지 먼저 확인 (maybeSingle은 데이터가 없어도 에러를 던지지 않음)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      // 🚀 프로필이 없다면(신규 유저) 새로 생성
      if (!profile) {
        const displayName = user.user_metadata.display_name || 
                            user.user_metadata.full_name || 
                            user.email?.split('@')[0] || 'Player';
        
        await supabase.from('profiles').insert({
          id: user.id,
          display_name: displayName,
          coins: 0
        });
      }

      // 상태 업데이트 및 데이터 로드
      setCurrentUserId(user.id);
      setIsLoggedIn(true);
      fetchUserData(user.id); 
    } else {
      // 로그아웃 상태일 때 처리
      setIsLoggedIn(false);
      setCurrentUserId(null);
      setUserNickname('Loading...');
    }
  });

  // 컴포넌트가 언마운트될 때 리스너 해제 (메모리 누수 방지)
  return () => {
    subscription.unsubscribe();
  };
}, []); // 앱 실행 시 딱 한 번만 실행됨

// 2. 화면(view) 전환 시 데이터를 최신화하는 useEffect (바로 아래에 추가)
useEffect(() => {
  if (isLoggedIn && currentUserId && (view === 'lobby' || view === 'settings')) {
    fetchUserData(currentUserId);
  }
}, [view, isLoggedIn, currentUserId]);

  // --- [액션: 닉네임 저장] ---
  const handleSaveNickname = async (newNickname: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('profiles').update({ display_name: newNickname }).eq('id', currentUserId);
    if (!error) {
      setUserNickname(newNickname);
      alert("닉네임이 성공적으로 변경되었습니다.");
    }
  };

  // --- [액션: 인증 처리 (이메일)] ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUpMode) {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: username } } });
        if (error) throw error;
        if (data?.user) await supabase.from('profiles').insert({ id: data.user.id, display_name: username, coins: 0 });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) setIsLoggedIn(true);
      }
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  // 🚀 [추가] 구글 로그인 핸들러 🚀
 const handleGoogleLogin = async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // 아이폰/모바일 환경에서 팝업 차단을 피하기 위해 리다이렉트 경로를 명시
        redirectTo: window.location.origin, 
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
  } catch (error: any) {
    // 사용자가 팝업을 차단했거나 취소했을 때의 에러 처리
    console.error("Google Login Error:", error.message);
  }
};

const handleLogout = async () => {
  try {
    // 1. 멀티플레이 방 참여 중이었다면 데이터 삭제
    if (currentUserId && currentRoomId) {
      await supabase.from('room_participants')
        .delete()
        .eq('room_id', currentRoomId)
        .eq('user_id', currentUserId);
    }
    
    // 2. Supabase 세션 종료
    await supabase.auth.signOut();
  } catch (err) {
    console.error("Logout error:", err);
  } finally {
    // 3. 팝업 없이 즉시 모든 상태 초기화 및 뷰 전환
    setIsLoggedIn(false);
    setCurrentUserId(null);
    setCurrentRoomId(null);
    setUserNickname('Loading...');
    setUserCoins(0);
    
    // 4. 메인 로비(로그인 전에는 로그인 폼이 보임)로 이동
    setView('lobby');

    // 5. 로컬 세션 잔재 강제 삭제
    localStorage.removeItem('supabase.auth.token');
    
    // 6. (선택 사항) 만약 세션이 꼬이는 경우를 대비해 아예 페이지를 새로고침하고 싶다면 아래 주석 해제
    // window.location.href = "/"; 
  }
};

  const resetGameSession = () => {
    setRound(1);
    setSessionCoins(0);
    setContinueCount(3);
    setGameKey(Date.now());
  };

  const playClickSound = () => {
    const audio = new Audio('/sound/mouseClick.mp3');
    audio.volume = isMuted ? 0 : volume;
    audio.play().catch(() => {});
  };

  const handleGameOver = async (finalRound: number, entryTime: number) => {
    if (!currentUserId) return;
    const { data: record } = await supabase.from('mode_records').select('*').eq('user_id', currentUserId).eq('mode', selectedOption).maybeSingle();
    const isNewRecord = !record || finalRound > record.best_round || (finalRound === record.best_round && entryTime < record.best_time);

    if (isNewRecord) {
      await supabase.from('mode_records').upsert({ user_id: currentUserId, mode: selectedOption, best_round: finalRound, best_time: entryTime, updated_at: new Date().toISOString() }, { onConflict: 'user_id, mode' });
    }

    await Promise.all([
      supabase.from('game_logs').insert({ user_id: currentUserId, mode: selectedOption, reached_round: finalRound, play_time: entryTime }),
      sessionCoins > 0 ? supabase.rpc('add_coins_batch', { row_id: currentUserId, amount: sessionCoins }) : Promise.resolve()
    ]);

    setResultData({ round: finalRound, time: entryTime, coins: sessionCoins, isNewRecord: isNewRecord });
    setShowResultModal(true);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-[320px]">
          <h1 className="text-5xl font-black text-[#FF9900] mb-8 text-center italic tracking-tighter uppercase">just RPS</h1>
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />
            {isSignUpMode && <input type="text" placeholder="Nickname" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />}
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />
            <button type="submit" className="w-full h-14 bg-[#FF9900] text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all shadow-[0_5px_15px_rgba(255,153,0,0.3)]">
              {loading ? 'Wait...' : (isSignUpMode ? 'Join Session' : 'Access Data')}
            </button>
          </form>

          {/* 🚀 [추가] 구글 로그인 버튼 영역 🚀 */}
          <div className="flex items-center gap-2 my-4">
             <div className="h-[1px] bg-zinc-800 flex-1"></div>
             <span className="text-[10px] text-zinc-600 font-bold uppercase">or</span>
             <div className="h-[1px] bg-zinc-800 flex-1"></div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin} 
            className="w-full h-14 bg-white text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_5px_15px_rgba(255,255,255,0.1)]"
          >
            {/* Google SVG Icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23.52 12.29C23.52 11.43 23.45 10.61 23.31 9.82H12V14.45H18.45C18.17 15.93 17.31 17.18 16.03 18.04V21.03H19.9C22.16 18.95 23.52 15.89 23.52 12.29Z" fill="#4285F4"/>
              <path d="M12 24C15.24 24 17.96 22.92 19.9 21.03L16.03 18.04C14.95 18.76 13.58 19.18 12 19.18C8.88 19.18 6.23 17.07 5.29 14.25H1.31V17.34C3.26 21.21 7.29 24 12 24Z" fill="#34A853"/>
              <path d="M5.29 14.25C5.05 13.53 4.92 12.77 4.92 12C4.92 11.23 5.05 10.47 5.29 9.75V6.66H1.31C0.47 8.33 0 10.11 0 12C0 13.89 0.47 15.67 1.31 17.34L5.29 14.25Z" fill="#FBBC05"/>
              <path d="M12 4.82C13.76 4.82 15.34 5.43 16.58 6.61L20.01 3.17C17.95 1.25 15.24 0 12 0C7.29 0 3.26 2.79 1.31 6.66L5.29 9.75C6.23 6.93 8.88 4.82 12 4.82Z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
          {/* ------------------------------------- */}

          <button type="button" onClick={() => setIsSignUpMode(!isSignUpMode)} className="w-full text-xs text-zinc-500 text-center underline font-bold mt-4 uppercase hover:text-[#FF9900]">
            {isSignUpMode ? "Back to Login" : "Create Account"}
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
            {/* 🚀 [UPDATE] 닉네임 대소문자 유지 (uppercase 제거) 🚀 */}
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
            userNickname={userNickname} setUserNickname={setUserNickname} 
            onSaveNickname={(nick: string) => handleSaveNickname(nick)} 
            volume={volume} setVolume={setVolume} isMuted={isMuted} setIsMuted={setIsMuted} onBack={() => setView('lobby')} 
          />
        )}
        
        {view === 'lobby' && (
          <div className="w-full max-w-[320px] flex flex-col items-center mt-16 space-y-3 px-4">
             <div className="flex gap-3 mb-12">{['rock', 'paper', 'scissor'].map(img => <div key={img} className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl"><img src={`/images/${img}.png`} className="w-full h-full object-cover" /></div>)}</div>
             <button onClick={() => { resetGameSession(); setView('modeSelect'); }} className="w-full h-14 rounded-md font-bold text-lg bg-[#FF9900] text-black uppercase tracking-widest active:scale-95 shadow-[0_0_20px_rgba(255,153,0,0.2)]">Play</button>
             <button onClick={() => setView('shop')} className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase hover:bg-zinc-800">Shop</button>
             <button onClick={() => setView('ranking')} className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase hover:bg-zinc-800">Records</button>
             <button onClick={() => setView('tutorial')} className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase hover:bg-zinc-800">Tutorial</button>

             <div className="mt-16 p-6 rounded-3xl bg-zinc-900/20 border border-zinc-800/50 backdrop-blur-sm shadow-xl w-full flex flex-col items-center">
                <div className="grid grid-cols-3 w-full mb-1"><p className="text-[10px] text-zinc-500 uppercase font-bold text-center">Total Play</p><p className="text-[10px] text-zinc-500 uppercase font-bold text-center">Win Rate</p><p className="text-[10px] text-zinc-500 uppercase font-bold text-center">Best Rank</p></div>
                <div className="grid grid-cols-3 w-full mb-1 items-center">
                  <p className="text-2xl font-bold font-mono text-white text-center">{stats.total_games}</p>
                  <p className="text-2xl font-bold font-mono text-green-400 text-center">{stats.multi_win_rate > 0 ? `${stats.multi_win_rate}%` : '-'}</p>
                  <p className="text-2xl font-bold font-mono text-[#FF9900] text-center">#{stats.best_rank > 0 ? stats.best_rank : '-'}</p>
                </div>
                <div className="grid grid-cols-3 w-full"><div /><div /><p className="text-[10px] text-white uppercase font-bold text-center">{stats.best_mode?.split(' ')[0]}</p></div>
             </div>
          </div>
        )}

        {view === 'modeSelect' && (
          <div className="w-full max-w-[320px] flex flex-col items-center mt-16 gap-3 px-4">
            <button onClick={() => { resetGameSession(); setView('battle'); }} className="w-full h-14 rounded-md font-bold text-lg bg-[#FF9900] text-black uppercase active:scale-95 shadow-[0_5px_15px_rgba(255,153,0,0.2)]">Single Play</button>
            <button onClick={() => setView('multiplay')} className="w-full h-14 rounded-md font-bold text-lg bg-zinc-900 text-white border border-zinc-800 uppercase hover:bg-zinc-800">Multi Play</button>
            <div className="grid grid-cols-2 gap-2 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 w-full mt-6">
              {['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE'].map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-[10px] font-bold">
                  <input type="radio" checked={selectedOption === opt} onChange={() => setSelectedOption(opt)} className="accent-[#FF9900]" />
                  <span className={selectedOption === opt ? 'text-[#FF9900]' : 'text-zinc-500'}>{opt}</span>
                </label>
              ))}
            </div>
            <button onClick={() => setView('lobby')} className="text-[10px] text-zinc-600 underline uppercase mt-8 font-bold">Lobby</button>
          </div>
        )}

        {view === 'multiplay' && (
          <MultiplayPage 
            selectedMode={selectedOption} 
            onBack={() => setView('modeSelect')} 
            onJoin={(roomId) => { 
              setCurrentRoomId(roomId); 
              setView('waitingRoom'); 
            }} 
          />
        )}
        
        {view === 'waitingRoom' && currentRoomId && (
          <WaitingRoom 
            roomId={currentRoomId} 
            onLeave={() => { setCurrentRoomId(null); setView('multiplay'); }} 
            onStartGame={() => setView('multiBattle')} 
          />
        )}
        
        {view === 'multiBattle' && currentRoomId && (
          <MultiGameEngine 
            roomId={currentRoomId}
            userNickname={userNickname}
            playClickSound={playClickSound}
            onGameOver={() => { if (currentUserId) fetchUserData(currentUserId); setView('lobby'); }}
            onBackToLobby={() => setView('lobby')}
          />
        )}

        {view === 'tutorial' && <TutorialPage onBack={() => setView('lobby')} />}
        {view === 'battle' && <GameEngine key={gameKey} round={round} mode={selectedOption} playClickSound={playClickSound} onEarnCoin={() => { setUserCoins(c => c + 1); setSessionCoins(s => s + 1); }} onRoundClear={(next) => setRound(next)} onGameOver={handleGameOver} isModalOpen={showResultModal} />}
        {view === 'ranking' && <RankingPage onBack={() => setView('lobby')} playClickSound={playClickSound} />}
        {view === 'shop' && <div className="p-20 text-white font-bold uppercase text-center animate-pulse">Shop coming soon...<button onClick={() => setView('lobby')} className="block mx-auto mt-4 text-xs underline font-bold">Back</button></div>}
      </main>

      <ResultModal isOpen={showResultModal} mode={selectedOption} round={resultData.round} time={resultData.time} earnedCoins={resultData.coins} userCoins={userCoins} isNewRecord={resultData.isNewRecord} continueCount={continueCount} continueCost={CONTINUE_COST} onContinue={() => { if(userCoins >= CONTINUE_COST) { setUserCoins(c => c - CONTINUE_COST); setContinueCount(prev => prev - 1); setShowResultModal(false); } }} onRetry={() => { setShowResultModal(false); resetGameSession(); setView('battle'); }} onLobby={() => { setShowResultModal(false); resetGameSession(); setView('lobby'); }} onShop={() => { setShowResultModal(false); setView('shop'); }} />
    </div>
  );
}