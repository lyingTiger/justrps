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

  // ------------------------------------------------------------------
  // ✨ [신규 추가] 상태 초기화 함수 (로그아웃 시 잔여 데이터 제거용)
  // ------------------------------------------------------------------
  const resetUserState = () => {
    setIsLoggedIn(false);         // 로그인 상태 해제
    setCurrentUserId(null);       // 유저 ID 초기화
    setCurrentRoomId(null);
    setUserNickname('Loading...'); 
    setUserCoins(0);
    setStats({ total_games: 0, multi_win_rate: 0, best_rank: 0, best_mode: '' });
    setEmail('');
    setPassword('');
    setView('lobby');             // 뷰를 로비로 초기화하지만 isLoggedIn이 false라 로그인창이 뜸
    setIsUserMenuOpen(false);
  };

// --- [시스템: 데이터 로드 함수 개선] ---
// --- [디버깅 강화된 데이터 로드 함수] ---
  const fetchUserData = async (userId: string) => {
    console.log(`🚀 [1] fetchUserData 시작 - ID: ${userId}`);

    if (!userId) {
      console.error("❌ [오류] userId가 없습니다. 함수를 종료합니다.");
      return;
    }

    try {
      // 1. 프로필 쿼리 시도
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // 2. 에러 발생 시 로그 출력
      if (error) {
        console.error("❌ [Supabase 에러] 프로필 조회 실패:", error.message);
        // 에러 발생 시에도 UI가 멈추지 않도록 기본값 설정
        setUserNickname('Unknown User');
        setUserCoins(0);
        return;
      }

      // 3. 데이터 수신 확인
      if (!profile) {
        console.warn("⚠️ [경고] 에러는 없지만 프로필 데이터가 null입니다. (데이터가 비어있음)");
        return;
      }

      console.log("✅ [성공] 프로필 데이터를 받았습니다:", profile);

      // 4. 상태 업데이트
      setUserNickname(profile.display_name || '익명 Player');
      setUserCoins(profile.coins || 0);

      // 5. 통계 데이터 로드 시도
      const { data: statsData, error: statsError } = await supabase.rpc('get_user_stats', { target_user_id: userId });
      
      if (statsError) {
        console.error("❌ [통계 에러] get_user_stats 함수 에러:", statsError.message);
      } else {
        console.log("✅ [성공] 통계 데이터:", statsData);
        
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

    } catch (err: any) {
      console.error("❌ [치명적 에러] 코드 실행 중 예외 발생:", err.message);
    }
  };

  // --- [수정: 로그인 및 세션 관리 로직 통합] ---
  useEffect(() => {
    document.title = "just RPS";
    
    // 초기 세션 확인 (새로고침 시 데이터 로드 보장)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log("✅ 세션 복구됨:", session.user.email);
        setCurrentUserId(session.user.id);
        setIsLoggedIn(true);
        fetchUserData(session.user.id); // 🔥 즉시 로드
      }
    });

    // Auth 상태 변경 감지 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event:", event); // 디버깅용 로그

      if (event === 'SIGNED_OUT' || !session) {
        resetUserState(); // 로그아웃 시 초기화
      } 
      else if (session?.user) {
        // 로그인 성공 또는 토큰 갱신
        const user = session.user;
        
        // 상태가 아직 업데이트 안 됐을 수 있으므로 변수값으로 직접 전달
        if (currentUserId !== user.id) {
            setCurrentUserId(user.id);
            setIsLoggedIn(true);
        }

        // 프로필 확인 및 생성 로직
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();

        if (!profile) {
          // 프로필이 없으면 생성
          const displayName = user.user_metadata.display_name || user.user_metadata.full_name || user.email?.split('@')[0] || 'Player';
          await supabase.from('profiles').insert({ id: user.id, display_name: displayName, coins: 0 });
        }
        
        // 🔥 중요: 이벤트가 발생할 때마다 데이터 최신화 (중복 호출되어도 안전함)
        fetchUserData(user.id);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // ------------------------------------------------------------------
  // 🔥 [수정 핵심 2] 데이터 로드 트리거 최적화
  // 로그인 상태이고 뷰가 로비/설정일 때만 데이터를 가져와 중복 호출 방지
  // ------------------------------------------------------------------
// [수정 코드] ▼ (setTimeout으로 미세한 딜레이 추가)
  useEffect(() => {
    if (isLoggedIn && currentUserId && (view === 'lobby' || view === 'settings')) {
      // 🚀 [수정] RLS 권한 동기화 시간을 벌기 위해 0.5초 딜레이 후 데이터 요청
      const timer = setTimeout(() => {
        fetchUserData(currentUserId);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [view, isLoggedIn, currentUserId]);


  const handleSaveNickname = async (newNickname: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('profiles').update({ display_name: newNickname }).eq('id', currentUserId);
    if (!error) { setUserNickname(newNickname); alert("닉네임이 성공적으로 변경되었습니다."); }
  };

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
      }
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin, queryParams: { access_type: 'offline', prompt: 'consent' } },
      });
    } catch (error: any) { console.error("Google Login Error:", error.message); }
  };

  // ------------------------------------------------------------------
  // 🔥 [수정 핵심 3] 로그아웃 함수 로직 변경
  // 서버 응답을 기다리기 전에 UI를 먼저 초기화(resetUserState)하여 즉각적인 반응성 확보
  // ------------------------------------------------------------------
  const handleLogout = async () => {
    // 1. UI 및 로컬 상태 먼저 초기화 (사용자 경험 향상)
    resetUserState();

    try {
      if (currentUserId && currentRoomId) {
        await supabase.from('room_participants').delete().eq('room_id', currentRoomId).eq('user_id', currentUserId);
      }
      // 2. 그 다음 실제 서버 로그아웃 요청
      await supabase.auth.signOut(); 
    } catch (err) { 
      console.error("Logout error:", err); 
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

 // --- [수정: 게임 오버 로직 개선] ---
  const handleGameOver = async (finalRound: number, entryTime: number) => {
    // 1. [UI 우선] DB 조회 전에 모달부터 띄워서 사용자에게 결과를 즉시 보여줍니다.
    // 'isNewRecord'는 일단 false로 보여주고, 아래에서 비동기로 확인 후 업데이트합니다.
    setResultData({ 
      round: finalRound, 
      time: entryTime, 
      coins: sessionCoins, 
      isNewRecord: false 
    });
    setRound(finalRound); // 배경 라운드 UI 맞춤
    setShowResultModal(true); // 🔥 모달 즉시 오픈!

    // 2. [방어 코드] 유저 ID가 없으면 DB 저장은 건너뛰되, 게임은 멈추지 않게 함
    if (!currentUserId) {
        console.warn("로그인 정보가 없어 기록이 저장되지 않습니다.");
        return;
    }

    try {
      // 3. [비동기] 최고 기록 확인 및 DB 저장 (백그라운드 처리)
      const { data: record, error } = await supabase
        .from('mode_records')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('mode', selectedOption)
        .maybeSingle();

      if (error) throw error;

      // 신기록 여부 판단
      const isNewRecord = !record || finalRound > record.best_round || (finalRound === record.best_round && entryTime < record.best_time);

      // 4. [상태 업데이트] 신기록이라면 모달 내용을 갱신해서 "NEW RECORD" 배지 표시
      if (isNewRecord) {
        setResultData(prev => ({ ...prev, isNewRecord: true })); // 모달이 떠 있는 상태에서 내용만 갱신됨
        
        await supabase.from('mode_records').upsert({ 
          user_id: currentUserId, 
          mode: selectedOption, 
          best_round: finalRound, 
          best_time: entryTime, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'user_id, mode' });
      }

      // 5. 로그 저장 및 코인 지급
      await Promise.all([
        supabase.from('game_logs').insert({ 
          user_id: currentUserId, 
          mode: selectedOption, 
          reached_round: finalRound, 
          play_time: entryTime 
        }),
        sessionCoins > 0 ? supabase.rpc('add_coins_batch', { row_id: currentUserId, amount: sessionCoins }) : Promise.resolve()
      ]);
      
      // 유저 데이터(코인 등) 최신화
      fetchUserData(currentUserId);

    } catch (err) {
      console.error("게임 결과 저장 실패:", err);
      // 에러가 나도 이미 모달은 떠 있으므로 사용자는 당황하지 않음
    }
  };

  // ------------------------------------------------------------------
  // 🔥 [화면 분기] isLoggedIn이 false면 로그인 화면을 리턴
  // resetUserState()가 호출되면 isLoggedIn이 false가 되어 이 화면이 보여야 함
  // ------------------------------------------------------------------
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
          <div className="flex items-center gap-2 my-4">
             <div className="h-[1px] bg-zinc-800 flex-1"></div>
             <span className="text-[10px] text-zinc-600 font-bold uppercase">or</span>
             <div className="h-[1px] bg-zinc-800 flex-1"></div>
          </div>
          <button type="button" onClick={handleGoogleLogin} className="w-full h-14 bg-white text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all flex items-center justify-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M23.52 12.29C23.52 11.43 23.45 10.61 23.31 9.82H12V14.45H18.45C18.17 15.93 17.31 17.18 16.03 18.04V21.03H19.9C22.16 18.95 23.52 15.89 23.52 12.29Z" fill="#4285F4"/><path d="M12 24C15.24 24 17.96 22.92 19.9 21.03L16.03 18.04C14.95 18.76 13.58 19.18 12 19.18C8.88 19.18 6.23 17.07 5.29 14.25H1.31V17.34C3.26 21.21 7.29 24 12 24Z" fill="#34A853"/><path d="M5.29 14.25C5.05 13.53 4.92 12.77 4.92 12C4.92 11.23 5.05 10.47 5.29 9.75V6.66H1.31C0.47 8.33 0 10.11 0 12C0 13.89 0.47 15.67 1.31 17.34L5.29 14.25Z" fill="#FBBC05"/><path d="M12 4.82C13.76 4.82 15.34 5.43 16.58 6.61L20.01 3.17C17.95 1.25 15.24 0 12 0C7.29 0 3.26 2.79 1.31 6.66L5.29 9.75C6.23 6.93 8.88 4.82 12 4.82Z" fill="#EA4335"/></svg>
            Sign in with Google
          </button>
          <button type="button" onClick={() => setIsSignUpMode(!isSignUpMode)} className="w-full text-xs text-zinc-500 text-center underline font-bold mt-4 uppercase">
            {isSignUpMode ? "Back to Login" : "Create Account"}
          </button>
        </div>
      </div>
    );
  }

  // --- 로그인 후 메인 화면 ---
  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans" onClick={() => setIsUserMenuOpen(false)}>
      <header className="w-full p-6 flex justify-between items-center border-b border-zinc-800 bg-black sticky top-0 z-50">
        <h2 className="text-2xl font-bold text-[#FF9900] tracking-tighter cursor-pointer uppercase italic" onClick={() => setView('lobby')}>just RPS</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setIsUserMenuOpen(!isUserMenuOpen); }} className="text-sm font-bold hover:text-[#FF9900] transition-colors flex items-center gap-1 tracking-tighter">
              {userNickname} <span className="text-[10px] opacity-50">▼</span>
            </button>
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-lg py-1 z-[100] shadow-2xl">
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

             <div className="mt-16 p-6 rounded-3xl bg-zinc-900/20 border border-zinc-800/50 backdrop-blur-sm shadow-xl w-full flex flex-col items-center text-center">
                <div className="grid grid-cols-3 w-full mb-1"><p className="text-[10px] text-zinc-500 uppercase font-bold">Total Play</p><p className="text-[10px] text-zinc-500 uppercase font-bold">Win Rate</p><p className="text-[10px] text-zinc-500 uppercase font-bold">Best Rank</p></div>
                <div className="grid grid-cols-3 w-full mb-1 items-center font-mono">
                  <p className="text-2xl font-bold">{stats.total_games}</p>
                  <p className="text-2xl font-bold text-green-400">{stats.multi_win_rate > 0 ? `${stats.multi_win_rate}%` : '-'}</p>
                  <p className="text-2xl font-bold text-[#FF9900]">#{stats.best_rank > 0 ? stats.best_rank : '-'}</p>
                </div>
                <div className="grid grid-cols-3 w-full"><div /><div /><p className="text-[10px] text-white uppercase font-bold">{stats.best_mode?.split(' ')[0]}</p></div>
             </div>
          </div>
        )}

        {view === 'modeSelect' && (
          <div className="w-full max-w-[320px] flex flex-col items-center mt-16 gap-3 px-4">
            <button onClick={() => { resetGameSession(); setView('battle'); }} className="w-full h-14 rounded-md font-bold text-lg bg-[#FF9900] text-black uppercase active:scale-95">Single Play</button>
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
          <MultiplayPage selectedMode={selectedOption} onBack={() => setView('modeSelect')} onJoin={(roomId) => { setCurrentRoomId(roomId); setView('waitingRoom'); }} />
        )}
        
        {view === 'waitingRoom' && currentRoomId && (
          <WaitingRoom roomId={currentRoomId} onLeave={() => { setCurrentRoomId(null); setView('multiplay'); }} onStartGame={() => setView('multiBattle')} />
        )}
        
        {view === 'multiBattle' && currentRoomId && (
          <MultiGameEngine 
            roomId={currentRoomId} userNickname={userNickname} playClickSound={playClickSound}
            onGameOver={() => { if (currentUserId) fetchUserData(currentUserId); setView('lobby'); }}
            onBackToLobby={() => setView('lobby')}
          />
        )}

        {view === 'tutorial' && <TutorialPage onBack={() => setView('lobby')} />}
        
        {view === 'battle' && (
          <GameEngine 
            key={gameKey} round={round} mode={selectedOption} playClickSound={playClickSound} 
            onEarnCoin={() => { setUserCoins(c => c + 1); setSessionCoins(s => s + 1); }} 
            onRoundClear={(next) => setRound(next)} onGameOver={handleGameOver} isModalOpen={showResultModal} 
          />
        )}
        
        {view === 'ranking' && <RankingPage onBack={() => setView('lobby')} playClickSound={playClickSound} />}
        {view === 'shop' && <div className="p-20 text-white font-bold uppercase text-center animate-pulse">Shop coming soon...<button onClick={() => setView('lobby')} className="block mx-auto mt-4 text-xs underline font-bold">Back</button></div>}
      </main>

      {/* 결과 모달 */}
      <ResultModal 
        isOpen={showResultModal} mode={selectedOption} round={resultData.round} time={resultData.time} earnedCoins={resultData.coins} 
        userCoins={userCoins} isNewRecord={resultData.isNewRecord} continueCount={continueCount} continueCost={CONTINUE_COST} 
        onContinue={() => { if(userCoins >= CONTINUE_COST) { setUserCoins(c => c - CONTINUE_COST); setContinueCount(prev => prev - 1); setShowResultModal(false); } }} 
        onRetry={() => { setShowResultModal(false); resetGameSession(); setView('battle'); }} 
        onLobby={() => { setShowResultModal(false); resetGameSession(); setView('lobby'); }} 
        onShop={() => { setShowResultModal(false); setView('shop'); }} 
      />
    </div>
  );
}