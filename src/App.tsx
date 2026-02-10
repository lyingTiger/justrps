import { supabase } from './supabaseClient';
import GameEngine from './GameEngine';
import SettingsPage from './SettingsPage';
import RankingPage from './RankingPage';
import ResultModal from './ResultModal';
import MultiplayPage from './MultiplayPage';
import TutorialPage from './TutorialPage';
import WaitingRoom from './WaitingRoom'; 
import MultiGameEngine from './MultiGameEngine'; 
import ShopPage from './ShopPage';
import AdOverlay from './AdOverlay';
import InfoPage from './InfoPage';
import { useState, useEffect, useRef } from 'react';
import { translations } from './constants/translations'; 

export default function App() {
  // --- 1. 유저 및 세션 상태 ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userNickname, setUserNickname] = useState(localStorage.getItem('cached_nickname') || 'Loading...');
  const [userCoins, setUserCoins] = useState(parseInt(localStorage.getItem('cached_coins') || '0'));
  const [showResultModal, setShowResultModal] = useState(false);
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [visitorStats, setVisitorStats] = useState({ today: 0, total: 0 });
  const lastFetchedId = useRef<string | null>(null);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);

  // 언어 상태 (기본값은 저장된 값 또는 영어)
  const [lang, setLang] = useState<'en' | 'ko'>(
    (localStorage.getItem('app_lang') as 'en' | 'ko') || 'en'
  );

  //  언어 변경 핸들러 
  const handleLanguageChange = (newLang: 'en' | 'ko') => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang); // 새로고침해도 유지되게 박제
  };

  // 💉 [수정] 번역 헬퍼 함수
  const t = (view: keyof typeof translations['en'], key: string) => {
    // @ts-ignore (타입 추론 복잡성 방지 위해 간단히 처리)
    return translations[lang][view]?.[key] || key;
  };

  // 인게임 메시지 팝업 상태 (키값을 넣으면 현재 언어에 맞는 문장 반환)
  const [msgPopup, setMsgPopup] = useState<{
    isOpen: boolean;
    title: string;
    desc: string;
    onConfirm?: (() => void) | null; 
  }>({ 
    isOpen: false, 
    title: '', 
    desc: '', 
    onConfirm: null 
  });

  // --- 2. 게임 및 뷰 제어 ---
  const [view, setView] = useState<'lobby' | 'modeSelect' | 'battle' | 'settings' | 'ranking' | 'shop' | 'multiplay' | 'waitingRoom' | 'tutorial' | 'multiBattle' | 'info'>('lobby');  
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null); 
  const [selectedOption, setSelectedOption] = useState<string>('DRAW MODE');
  const [round, setRound] = useState(1);
  const [gameKey, setGameKey] = useState(Date.now());


  // --- 3. 통계 및 설정 ---   
  const [stats, setStats] = useState({ 
    total_games: parseInt(localStorage.getItem('cached_total_games') || '0'), 
    multi_win_rate: parseInt(localStorage.getItem('cached_win_rate') || '0'), 
    best_rank: parseInt(localStorage.getItem('cached_best_rank') || '0'), 
    best_mode: localStorage.getItem('cached_best_mode') || '' 
  });

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
  const [resultData, setResultData] = useState({ round: 0, time: 0, coins: 0, isNewRecord: false });
  const [continueCount, setContinueCount] = useState(3);
  const [sessionCoins, setSessionCoins] = useState(0); 
  const CONTINUE_COST = 50;

  const [adFreeUntil, setAdFreeUntil] = useState<string | null>(null); 
  const [playCount, setPlayCount] = useState(0); 
  const [pendingBestRound, setPendingBestRound] = useState<number | null>(null); 
  const [sessionStartTime, setSessionStartTime] = useState(0); 
  const [pendingBestTime, setPendingBestTime] = useState(0);   

  const audioCtxRef = useRef<AudioContext | null>(null);
  const clickBufferRef = useRef<AudioBuffer | null>(null);
  const [canClickPopup, setCanClickPopup] = useState(false);


  const resetUserState = () => {
    setIsLoggedIn(false);         
    setCurrentUserId(null);       
    setCurrentRoomId(null);
    setUserNickname(t('lobby', 'loading_status')); 
    setUserCoins(0);
    setStats({ total_games: 0, multi_win_rate: 0, best_rank: 0, best_mode: '' });
    setEmail('');
    setPassword('');
    setView('lobby');             
    setIsUserMenuOpen(false);
  };

  const handleShare = async () => {
    const shareData = {
      title: 'just RPS',
      text: lang === 'ko' ? '기억해, 가위 바위 보!\n천재들의 놀이터! \n\n자신의 한계를 극복하고, \n친구들과 대결해 보세요!' : 'Remember, RPS!\nGenius playground!\n\nOvercome your limits,\nand battle your friends!',
      url: window.location.origin,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        const combinedText = `${shareData.url}\n\n${shareData.text}`;
        await navigator.clipboard.writeText(combinedText);
        
        setMsgPopup({
          isOpen: true,
          title: t('popup', 'msg_copy_title'), 
          desc: t('popup', 'msg_copy_desc')
        });
      }
    } catch (err) {
      console.log("Share action cancelled");
    }
  };

  const fetchUserData = async (userId: string) => {
    if (!userId) return;
    try {
      let { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!profile && !error) {
        const { data: { session } } = await supabase.auth.getSession();
        const rawName = session?.user?.user_metadata?.full_name || 'Player';
        const MAX_DB_LEN = 15;
        const googleName = rawName.length > MAX_DB_LEN ? rawName.substring(0, MAX_DB_LEN) : rawName;

        const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({ id: userId, display_name: googleName, coins: 0 }).select().single();
        if (!insertError) {
            profile = newProfile;
            setMsgPopup({
              isOpen: true,
              title: t('popup', 'msg_welcome_title'),
              desc: `Hi, ${googleName}!\n${t('popup', 'msg_welcome_desc')}`
            });
        }
      }
      if (error || !profile) {
        setUserNickname('Unknown');
        setUserCoins(0);
        return;
      }
      const newName = profile.display_name || 'Player';
      const newCoins = profile.coins || 0;
      setUserNickname(newName);
      setUserCoins(newCoins);
      setAdFreeUntil(profile.ad_free_until);
      localStorage.setItem('cached_nickname', newName);
      localStorage.setItem('cached_coins', newCoins.toString());  

      const { data: statsData, error: statsError } = await supabase.rpc('get_user_stats', { target_user_id: userId });
      if (!statsError) {
        const winRate = profile.multi_games > 0 ? Math.round((profile.multi_score / profile.multi_games) * 100) : 0;
        const newStats = { total_games: statsData?.[0]?.total_games || 0, multi_win_rate: winRate, best_rank: statsData?.[0]?.best_rank || 0, best_mode: statsData?.[0]?.best_mode || '' };
        setStats(newStats);
        localStorage.setItem('cached_total_games', newStats.total_games.toString());
        localStorage.setItem('cached_win_rate', newStats.multi_win_rate.toString());
        localStorage.setItem('cached_best_rank', newStats.best_rank.toString());
        localStorage.setItem('cached_best_mode', newStats.best_mode);
      };
    } catch (err: any) { console.error(err); }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let timer: NodeJS.Timeout;
    const LIMIT = 10 * 60 * 1000; 
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { handleLogout(); }, LIMIT);
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer(); 
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [isLoggedIn]); 

  useEffect(() => {
    if (msgPopup.isOpen) {
      setCanClickPopup(false); 
      const timer = setTimeout(() => { setCanClickPopup(true); }, 500); 
      return () => clearTimeout(timer);
    }
  }, [msgPopup.isOpen]);

  useEffect(() => {
    document.title = "just RPS";
    const handleVisitors = async () => {
      await supabase.rpc('increment_visitor');
      const { data } = await supabase.from('site_stats').select('today_count, total_count').eq('id', 'global').maybeSingle();
      if (data) setVisitorStats({ today: data.today_count, total: data.total_count });
    };
    handleVisitors();
  
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        lastFetchedId.current = null; 
        resetUserState();
      } 
      else if (session?.user) {
        const userId = session.user.id;
        if (currentUserId !== userId) {
            setCurrentUserId(userId);
            setIsLoggedIn(true);
        }
        if (lastFetchedId.current === userId) return;
        lastFetchedId.current = userId;
        fetchUserData(userId); 
      }
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  const handleSaveNickname = async (newNickname: string) => {
    if (!currentUserId) return;
    if (newNickname.length > 15) return;
    const { error } = await supabase.from('profiles').update({ display_name: newNickname }).eq('id', currentUserId);
    if (!error) { 
      setUserNickname(newNickname); 
      setMsgPopup({
        isOpen: true,
        title: t('popup', 'msg_nick_updated'),
        desc: `"${newNickname}"`
      });
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUpMode) {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: username } } });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').insert({ id: data.user.id, display_name: username, coins: 0 });
        }
        setMsgPopup({
          isOpen: true,
          title: t('popup', 'msg_welcome_title'),
          desc: t('popup', 'msg_signin_to_start')
        });
        setIsSignUpMode(false); 
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const { data: profile } = await supabase.from('profiles').select('id').eq('id', data.user.id).maybeSingle();
          if (!profile) {
            await supabase.from('profiles').insert({ id: data.user.id, display_name: 'Player', coins: 0 });
          }
        }
      }
    } catch (err: any) { alert("Error: " + err.message); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (view !== 'lobby') window.history.pushState({ view }, '', '');
    else window.history.replaceState({ view: 'lobby' }, '', '');

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) setView(event.state.view);
      else setView('lobby');
    };
    window.addEventListener('popstate', handlePopState);
    return () => { window.removeEventListener('popstate', handlePopState); };
  }, [view]);

  useEffect(() => {
    const initAudio = async () => {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
      try {
        const response = await fetch('/sound/mouseClick.mp3');
        const arrayBuffer = await response.arrayBuffer();
        clickBufferRef.current = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      } catch (e) { console.error("Audio Load Error:", e); }
    };
    initAudio();
  }, []);

  const handleGoogleLogin = async () => {
    try { await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin, queryParams: { access_type: 'offline', prompt: 'consent' } } });
    } catch (error: any) { console.error(error.message); }
  };

  const handleLogout = () => {
    localStorage.clear();
    supabase.auth.signOut().catch(err => console.warn(err));
    resetUserState();
    setTimeout(() => { window.location.reload(); }, 100);
  };

  const handleLobbyNavigation = async (targetView: 'modeSelect' | 'ranking' | 'shop' | 'tutorial') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert(t('popup', 'msg_session_expired'));
      handleLogout();
      return;
    }
    if (targetView === 'modeSelect') resetGameSession();
    setView(targetView);
  };

  const resetGameSession = (startTime = 0) => {
    if (startTime === 0) setRound(1);
    setSessionStartTime(startTime);
    setSessionCoins(0);
    setContinueCount(3);
    setGameKey(Date.now());
  };

  const playClickSound = () => {
    if (isMuted || !audioCtxRef.current || !clickBufferRef.current) return;
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    const source = audioCtxRef.current.createBufferSource();
    const gainNode = audioCtxRef.current.createGain();
    source.buffer = clickBufferRef.current;
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);
    source.start(0);
  };

  const showInterstitialAd = () => {
    if (adFreeUntil) {
      const now = new Date();
      const expiryDate = new Date(adFreeUntil);
      if (now < expiryDate) return; 
    }
    console.log("🎬 Interstitial Ad...");
  };

  const handleGameOver = async (finalRound: number, entryTime: number) => {
    setResultData({ round: finalRound, time: entryTime, coins: sessionCoins, isNewRecord: false });
    setRound(finalRound); 
    setShowResultModal(true); 
    if (!currentUserId) return;
    try {
      const { data: record, error: fetchError } = await supabase.from('mode_records').select('*').eq('user_id', currentUserId).eq('mode', selectedOption).maybeSingle();
      if (fetchError) throw fetchError;
      const isNewRecord = !record || finalRound > record.best_round || (finalRound === record.best_round && entryTime < record.best_time);
      if (isNewRecord) {
        setResultData(prev => ({ ...prev, isNewRecord: true }));
        await supabase.from('mode_records').upsert({ user_id: currentUserId, mode: selectedOption, best_round: finalRound, best_time: entryTime, updated_at: new Date().toISOString() }, { onConflict: 'user_id, mode' });
      }
      await supabase.from('game_logs').insert({ user_id: currentUserId, mode: selectedOption, reached_round: finalRound, play_time: entryTime });
      if (sessionCoins > 0) await supabase.rpc('add_coins_batch', { row_id: currentUserId, amount: sessionCoins });
      fetchUserData(currentUserId);
    } catch (err) { console.error(err); } finally {
      const newPlayCount = playCount + 1;
      setPlayCount(newPlayCount);
      if (newPlayCount >= 3) { showInterstitialAd(); setPlayCount(0); }
    }
  };

  const handlePlayFromBest = async () => {
    if (!currentUserId) return;
    const { data: record } = await supabase.from('mode_records').select('best_round, best_time').eq('user_id', currentUserId).eq('mode', selectedOption).maybeSingle();
    const bestRound = record?.best_round || 1;
    const bestTime = record?.best_time || 0;

    if (userCoins >= 100) {
      setMsgPopup({
        isOpen: true,
        title: t('popup', 'msg_continue_title'),
        desc: "-100",
        onConfirm: async () => {
          await supabase.rpc('add_coins_batch', { row_id: currentUserId, amount: -100 });
          setUserCoins(prev => prev - 100);
          setRound(bestRound);
          resetGameSession(bestTime);
          setView('battle');
          setMsgPopup(prev => ({ ...prev, isOpen: false, onConfirm: null }));
        }
      });
    } else {
      setMsgPopup({
        isOpen: true,
        title: t('popup', 'msg_ad_start_title'),
        desc: t('popup', 'msg_watch_ad'),
        onConfirm: () => {
          setPendingBestRound(bestRound);
          setPendingBestTime(bestTime);
          setShowAdOverlay(true); 
          setMsgPopup(prev => ({ ...prev, isOpen: false, onConfirm: null }));
        }
      });
    }
  };

  const handleAdContinueSuccess = () => {
    setShowAdOverlay(false);
    if (pendingBestRound !== null) {
      setRound(pendingBestRound);
      resetGameSession(pendingBestTime);
      setPendingBestRound(null);
      setPendingBestTime(0);
      setView('battle');
      return;
    }
    setContinueCount(prev => prev - 1);
    setShowResultModal(false);
  };

  // --- [인증 화면 뷰] ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-start justify-center pt-40">
        <div className="w-full max-w-[320px]">
          <h1 className="text-5xl font-black mb-8 text-center italic tracking-tighter uppercase">
            <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
          </h1>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input type="email" placeholder={t('main', 'email_placeholder')} value={email} onChange={(e) => setEmail(e.target.value)} 
            className="mt-10 w-full h-14 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />
            
            {isSignUpMode && <input type="text" placeholder={t('main', 'nickname_placeholder')} value={username} onChange={(e) => setUsername(e.target.value)} 
            className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />}
            
            <input type="password" placeholder={t('main', 'password_placeholder')} value={password} onChange={(e) => setPassword(e.target.value)} 
            className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />

            <button type="submit" className="mt-10 w-full h-14 bg-[#FF9900] text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all shadow-[0_5px_15px_rgba(255,153,0,0.3)]">
              {loading ? t('main', 'loading_wait') : (isSignUpMode ? t('main', 'join_btn') : t('main','login_btn'))}
            </button>
          </form>

          <div className="flex items-center gap-2 my-2"></div>

          <button type="button" onClick={handleGoogleLogin} className="w-full h-14 bg-white text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all flex items-center justify-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">...</svg>
            {t('main', 'google_login')}
          </button>
          
          <button type="button" onClick={() => setIsSignUpMode(!isSignUpMode)} className="w-full text-base text-zinc-400 hover:text-[#FF9900] text-center font-bold mt-4 uppercase">
            {isSignUpMode ? t('main', 'back_to_login') : t('main', 'create_acc')}
          </button>

          <div className="flex justify-center gap-8 mt-4 pt-2">
            <button onClick={() => handleLanguageChange('en')} className={`text-3xl transition-all active:scale-90 ${lang === 'en' ? 'opacity-100' : 'opacity-30 hover:opacity-50'}`}>🇺🇸</button>
            <button onClick={() => handleLanguageChange('ko')} className={`text-3xl transition-all active:scale-90 ${lang === 'ko' ? 'opacity-100' : 'opacity-30 hover:opacity-50'}`}>🇰🇷</button>
          </div>

          <div className="flex justify-center gap-0 mt-0 border-zinc-900 pt-0">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex gap-4 relative -left-2">
              <span>english</span>
              <span>한국어</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- [로그인 후 메인 화면] ---
  // --- [로그인 후 메인 화면] --- 이하의 전체 코드입니다. 디자인 복구는 물론, **계층화된 번역 시스템(t('그룹', '키'))**을 모든 구역에 정밀하게 이식했습니다. 👨‍⚕️🩺


  // --- [로그인 후 메인 화면] ---
  return (
    // 배경 클릭 시 두 메뉴가 모두 닫히도록 최상단 div에 핸들러 유지 [cite: 2026-02-01]
    <div className="min-h-screen bg-black text-white flex flex-col font-sans" onClick={() => { setIsUserMenuOpen(false); setIsSettingsMenuOpen(false); }}>
      <header className="w-full p-6 flex justify-between items-center border-b border-zinc-800 bg-black sticky top-0 z-50">
        
        {/* [좌측] 로고 및 시스템 설정 영역 */}
        <div className="flex items-center gap-1">
          <h2 className="text-2xl font-bold tracking-tighter cursor-pointer uppercase italic" onClick={() => setView('lobby')}>
            <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
          </h2>

          {/* 기어 아이콘: Settings와 Game Info 담당 */}
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsSettingsMenuOpen(!isSettingsMenuOpen); }}
              className="w-5 h-5 flex items-center justify-center transition-transform active:scale-90 ml-2"
            >
              <img 
                src="/images/icon_setting.png" 
                alt="Settings" 
                className={`w-full h-full object-contain transition-opacity ${isSettingsMenuOpen ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
              />
            </button>

            {/* 시스템 메뉴 (기어 클릭 시) */}
            {isSettingsMenuOpen && (
              <div className="absolute left-0 mt-3 w-32 bg-zinc-900 border border-zinc-800 rounded-lg py-0 z-[100] shadow-2xl">
                {/* 💉 번역 적용: settings 그룹의 language 키 */}
                <button onClick={() => setView('settings')} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold uppercase">{t('settings', 'language')}</button>
                <button onClick={() => setView('info')} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold uppercase text-zinc-300 hover:text-white">{t('settings', 'glameinfo')}</button>
              </div>
            )}
          </div>
        </div>

        {/* [우측] 계정 및 재화 영역 */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setIsUserMenuOpen(!isUserMenuOpen); }} className="font-bold text-sm tracking-tight text-zinc-300 hover:text-white transition-colors">
              {userNickname.length > 10 ? userNickname.substring(0, 10) + '...' : userNickname} 
            </button>

            {/* 계정 메뉴 (닉네임 클릭 시: 로그아웃) */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-24 bg-zinc-900 border border-zinc-800 rounded-lg py-0 z-[100] shadow-2xl">
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-xs text-red-500 font-bold hover:bg-zinc-800 uppercase">Logout</button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-1">
            <img src="/images/coin.png" alt="coin" className="w-4 h-4 object-contain" />
            <span className="text-[#FF9900] font-bold text-sm tracking-tighter font-mono">
              {userCoins.toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-0">

        {/* 세팅 페이지 뷰 전환 */}
        {view === 'settings' && (
          <SettingsPage 
            userNickname={userNickname} 
            setUserNickname={setUserNickname} 
            onSaveNickname={(nick: string) => handleSaveNickname(nick)} 
            volume={volume} 
            setVolume={setVolume} 
            isMuted={isMuted} 
            setIsMuted={setIsMuted} 
            onBack={() => setView('lobby')} 
            playClickSound={playClickSound}
            currentLang={lang} 
            onLangChange={handleLanguageChange} 
            t={(key: string) => t('settings', key)} // 💉 settings 그룹 고정 [cite: 2026-02-01]
          />
        )}

        {view === 'info' && (
          <InfoPage 
            onBack={() => setView('lobby')} 
            todayCount={visitorStats.today} 
            totalCount={visitorStats.total}
          />
        )}
        
        {view === 'lobby' && (
          <div className="w-full max-w-[360px] flex flex-col items-center mt-4 space-y-3 px-4">

              {/* 공유 버튼 영역 */}
              <div className="w-full flex justify-end mb-0">
                <button 
                  onClick={handleShare} 
                  className="px-4 py-1 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl hover:bg-[#ffcc33] hover:text-black active:scale-95 transition-all border border-zinc-700"
                >
                  {t('lobby', 'btn_share')}
                </button>
              </div>

             <div className="flex gap-3 mb-12 mt-10 ">{['rock', 'paper', 'scissor'].map(img => <div key={img} className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl"><img src={`/images/${img}.png`} className="w-full h-full object-cover" /></div>)}</div>

             <div className="w-full flex flex-col gap-3">
                 {/* 💉 복구: 로비 중앙 버튼들의 화려한 스타일과 애니메이션 복원 [cite: 2026-02-01] */}
                 <button 
                   onClick={() => handleLobbyNavigation('tutorial')} 
                   className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                 >
                   {t('lobby', 'btn_tutorial')}
                 </button>

                 <button 
                   onClick={() => handleLobbyNavigation('ranking')} 
                   className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                 >
                   {t('lobby', 'btn_ranking')}
                 </button>

                  <button 
                   onClick={() => handleLobbyNavigation('shop')} 
                   className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                 >
                   {t('lobby', 'btn_inventory')}
                 </button>

                 <button 
                   onClick={() => handleLobbyNavigation('modeSelect')} 
                   className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                 >
                   {t('lobby', 'btn_play')}
                 </button>
             </div>

             <div className="mt-10 p-6 rounded-3xl bg-zinc-900/20 border border-zinc-800/50 backdrop-blur-sm shadow-xl w-full flex flex-col items-center text-center">
                <div className="grid grid-cols-3 w-full mb-1">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">{t('lobby', 'stats_total_play')}</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">{t('lobby', 'stats_win_rate')}</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">{t('lobby', 'stats_best_rank')}</p>
                </div>
                <div className="grid grid-cols-3 w-full mb-1 items-center font-mono">
                  <p className="text-2xl font-bold">{stats.total_games}</p>
                  <p className="text-2xl font-bold text-green-400">{stats.multi_win_rate > 0 ? `${stats.multi_win_rate}%` : '-'}</p>
                  <p className="text-2xl font-bold text-[#FF9900]">#{stats.best_rank > 0 ? stats.best_rank : '-'}</p>
                </div>
                <div className="grid grid-cols-3 w-full"><div /><div /><p className="text-[10px] text-white uppercase font-bold">{stats.best_mode?.split(' ')[0]}</p></div>
             </div>
          </div>
        )}

        {/* 플레이 선택 뷰 */}
        {view === 'modeSelect' && (
          <div className="w-full max-w-[360px] flex flex-col items-center mt-4 gap-3 px-4">
            <div className="w-full flex justify-end mb-0">
              <button 
                onClick={() => setView('lobby')} 
                className="px-4 py-1 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl hover:bg-zinc-700 active:scale-95 transition-all border border-zinc-700"
              >
                {t('modeSelect', 'btn_back')}
              </button>
            </div>

            <p className="w-full text-left text-base font-black text-[#ffcc33] uppercase ml-1">{t('modeSelect', 'title_select_mode')}</p>

            <div className="flex flex-col gap-3 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 w-full mt-0">
              {['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE'].map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-[14px] font-bold">
                  <input type="radio" checked={selectedOption === opt} onChange={() => setSelectedOption(opt)} className="accent-[#FF9900]" />
                  {/* 💉 동적 키 생성 로직 적용: mode_win, mode_draw 등 [cite: 2026-02-09] */}
                  <span className={selectedOption === opt ? 'text-[#FF9900]' : 'text-zinc-500'}>
                    {t('modeSelect', `mode_${opt.split(' ')[0].toLowerCase()}`)}
                  </span>
                </label>
              ))}
            </div>

            <p className="w-full text-left text-base font-black text-[#ffcc33] uppercase ml-1 mt-4">{t('modeSelect', 'title_start_with')}</p>

            {/* 💉 복구: 플레이 시작 버튼들의 컬러 테마와 호버 효과 복원 [cite: 2026-02-01] */}
            <button 
              onClick={() => { resetGameSession(); setView('battle'); }} 
              className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#3399cc] hover:text-black hover:border-[#3399cc] hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] active:bg-[#3399cc] active:text-black active:border-[#3399cc] active:scale-95"
            >
              {t('modeSelect', 'btn_single')}
            </button>
            
            <button 
              onClick={() => setView('multiplay')} 
              className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#66cc33] hover:text-black hover:border-[#66cc33] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#66cc33] active:text-black active:border-[#66cc33] active:scale-95"
            >
              {t('modeSelect', 'btn_multi')}
            </button>
            
            <button 
              onClick={handlePlayFromBest} 
              className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800  hover:bg-[#ff3366] hover:text-black hover:border-[#ff3366] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#ff3366] active:text-black active:border-[#ff3366] active:scale-95"
            >
              {t('modeSelect', 'btn_play_from_best')}
            </button>
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
            onEarnCoin={() => setUserCoins(prev => prev + 1)} 
            onGameOver={() => { if (currentUserId) fetchUserData(currentUserId); setView('waitingRoom'); }}
            onBackToLobby={() => { if (currentUserId) fetchUserData(currentUserId); setCurrentRoomId(null); setView('lobby'); }}
          />
        )}

        {view === 'tutorial' && <TutorialPage onBack={() => setView('lobby')} />}
        
        {view === 'battle' && (
          <GameEngine 
            key={gameKey} round={round} mode={selectedOption} playClickSound={playClickSound} initialTime={sessionStartTime}
            onEarnCoin={() => { setUserCoins(c => c + 1); setSessionCoins(s => s + 1); }} 
            onRoundClear={(next) => setRound(next)} onGameOver={handleGameOver} isModalOpen={showResultModal} 
          />
        )}
        
        {view === 'ranking' && (
          <RankingPage onBack={() => setView('lobby')} playClickSound={playClickSound} userNickname={userNickname} />
        )}

        {view === 'shop' && (
          <ShopPage onBack={() => setView('lobby')} userCoins={userCoins} currentUserId={currentUserId} onUpdateCoins={(newAmount) => { setUserCoins(newAmount); localStorage.setItem('cached_coins', newAmount.toString()); }} />
        )}      
      </main>

      {/* 광고 및 모달 섹션 */}
      <AdOverlay isOpen={showAdOverlay} onClose={() => { setShowAdOverlay(false); setPendingBestRound(null); }} onReward={handleAdContinueSuccess} />

      <ResultModal 
        isOpen={showResultModal} mode={selectedOption} round={resultData.round} time={resultData.time} earnedCoins={resultData.coins} 
        userCoins={userCoins} isNewRecord={resultData.isNewRecord} continueCount={continueCount} continueCost={CONTINUE_COST} 
        onContinue={() => { if(userCoins >= CONTINUE_COST) { setUserCoins(c => c - CONTINUE_COST); setContinueCount(prev => prev - 1); setShowResultModal(false); } }} 
        onRetry={() => { setShowResultModal(false); setRound(1); resetGameSession(0); setView('battle'); }} 
        onLobby={() => { setShowResultModal(false); resetGameSession(); setView('lobby'); }} 
        onShop={() => { setShowResultModal(false); setView('shop'); }} 
        onWatchAd={() => setShowAdOverlay(true)}
      />

      {/* 인게임 메시지 팝업 번역 적용 */}
      {msgPopup.isOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[280px] bg-zinc-900 border-2 border-[#FF9900] rounded-[40px] p-8 flex flex-col items-center text-center shadow-[0_0_50px_rgba(255,153,0,0.2)] animate-in zoom-in-95 duration-200">
            
            <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-1">{msgPopup.title}</h3>
            
            {(msgPopup.title === t('popup', 'msg_continue_title') || msgPopup.title === t('popup', 'msg_ad_start_title')) && (
              <p className="text-base font-bold text-zinc-500 uppercase tracking-tight mb-6">
                {t('popup', 'msg_best_record_info')}
              </p>
            )}

            <div className="flex items-center justify-center gap-3 mb-10">
              {msgPopup.title === t('popup', 'msg_continue_title') && (
                <img src="/images/coin.png" alt="coin" className="w-6 h-6 object-contain" />
              )}
              <p className="text-2xl text-white font-black italic uppercase tracking-tighter whitespace-pre-line">
                {msgPopup.desc}
              </p>
            </div>
            
            <div className="flex gap-3 w-full">
              {msgPopup.onConfirm && (
                <button 
                  onClick={() => canClickPopup && msgPopup.onConfirm?.()}
                  disabled={!canClickPopup}
                  className={`flex-1 h-12 rounded-2xl font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 
                    ${canClickPopup ? "hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:scale-95" : "opacity-50 cursor-not-allowed"}`}
                >
                  OK
                </button>
              )}
              <button 
                onClick={() => canClickPopup && setMsgPopup(prev => ({ ...prev, isOpen: false, onConfirm: null }))}
                disabled={!canClickPopup}
                className={`h-12 font-bold text-lg rounded-2xl uppercase transition-all ${msgPopup.onConfirm ? "flex-1 bg-zinc-900 text-white" : "w-full bg-[#FF9900] text-black"} 
                  ${canClickPopup ? "hover:bg-[#FF9900] hover:text-black active:scale-95" : "opacity-50 cursor-not-allowed"}`}
              >
                {msgPopup.onConfirm ? t('settings', 'cancel') : t('settings', 'confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}