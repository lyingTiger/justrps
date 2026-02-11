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

  // ------------------------------------------------------------------
  // 💉 [상태 관리] 유저 데이터, 게임 뷰, 시스템 상태 변수 정의
  // ------------------------------------------------------------------
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userNickname, setUserNickname] = useState(localStorage.getItem('cached_nickname') || 'Loading...');
  const [userCoins, setUserCoins] = useState(parseInt(localStorage.getItem('cached_coins') || '0'));
  const [showResultModal, setShowResultModal] = useState(false);
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [visitorStats, setVisitorStats] = useState({ today: 0, total: 0 });
  const lastFetchedId = useRef<string | null>(null);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);

  // ------------------------------------------------------------------
  // 💉 [다국어 지원] 언어 상태 설정 및 번역 헬퍼 함수 (t)
  // ------------------------------------------------------------------
  const [lang, setLang] = useState<'en' | 'ko'>(
    (localStorage.getItem('app_lang') as 'en' | 'ko') || 'en'
  );

  const handleLanguageChange = (newLang: 'en' | 'ko') => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang); 
  };

  const t = (view: keyof typeof translations['en'], key: string) => {
    // @ts-ignore
    return translations[lang][view]?.[key] || key;
  };

  // ------------------------------------------------------------------
  // 💉 [팝업 시스템] 인게임 메시지 알림창 상태 정의
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 💉 [게임 엔진 제어] 뷰 전환, 라운드, 통계 데이터 관리
  // ------------------------------------------------------------------
  const [view, setView] = useState<'lobby' | 'modeSelect' | 'battle' | 'settings' | 'ranking' | 'shop' | 'multiplay' | 'waitingRoom' | 'tutorial' | 'multiBattle' | 'info'>('lobby');  
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null); 
  const [selectedOption, setSelectedOption] = useState<string>('DRAW MODE');
  const [round, setRound] = useState(1);
  const [gameKey, setGameKey] = useState(Date.now());

  const [stats, setStats] = useState({ 
    total_games: parseInt(localStorage.getItem('cached_total_games') || '0'), 
    multi_win_rate: parseInt(localStorage.getItem('cached_win_rate') || '0'), 
    best_rank: parseInt(localStorage.getItem('cached_best_rank') || '0'), 
    best_mode: localStorage.getItem('cached_best_mode') || '' 
  });

  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);

  // ------------------------------------------------------------------
  // 💉 [인증 & 광고] 로그인 폼, 결과 데이터, 광고 제어 상태
  // ------------------------------------------------------------------
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
  const startBufferRef = useRef<AudioBuffer | null>(null);
  const [canClickPopup, setCanClickPopup] = useState(false);

  // ------------------------------------------------------------------
  // 💉 [유저 상태 초기화] 로그아웃 시 클라이언트 상태 청소
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 💉 [공유 기능] Web Share API 및 클립보드 복사 로직
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 💉 [데이터 로드] Supabase 프로필 및 통계 로드 (자가 치유 기능 포함)
  // ------------------------------------------------------------------
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



  // ------------------------------------------------------------------
  // 💉 [내비게이션] 뷰 변경 시 스크롤 위치 초기화
  // ------------------------------------------------------------------
  useEffect(() => {
  // 브라우저의 기본 스크롤 복원 기능을 끄고 즉시 상단으로 이동시킵니다.
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }
  
  // 0ms 타임아웃을 주어 렌더링이 완료된 직후에 실행되도록 보장합니다.
  const timer = setTimeout(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, 0);

  return () => clearTimeout(timer);
}, [view]);



  // ------------------------------------------------------------------
  // 💉 [보안] 10분 미활동 시 자동 로그아웃 감시 로직
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isLoggedIn) return;

    let timer: NodeJS.Timeout;
    const LIMIT = 10 * 60 * 1000; // 10분

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        console.log("💤 장시간 미활동으로 로그아웃됩니다.");
        handleLogout();
      }, LIMIT);
    };

    // 💉 모바일 유저를 위한 touchstart 및 좀 더 포괄적인 감시를 위해 document에 등록
    const events = ['mousemove', 'click', 'keydown', 'touchstart', 'scroll'];
    
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    resetTimer(); // 초기 실행

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [isLoggedIn]);




  // ------------------------------------------------------------------
  // 💉 [UI 인터랙션] 팝업 오픈 시 버튼 클릭 지연 (실수 방지)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (msgPopup.isOpen) {
      setCanClickPopup(false); 
      const timer = setTimeout(() => { setCanClickPopup(true); }, 500); 
      return () => clearTimeout(timer);
    }
  }, [msgPopup.isOpen]);

  // ------------------------------------------------------------------
  // 💉 [라이프사이클] 초기 로드: 통계 업데이트 및 Auth 상태 감지 시작
  // ------------------------------------------------------------------
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
            playStartSound();
        }
        if (lastFetchedId.current === userId) return;
        lastFetchedId.current = userId;
        fetchUserData(userId); 
      }
    });
    return () => { subscription.unsubscribe(); };
  }, [currentUserId]);

  // ------------------------------------------------------------------
  // 💉 [유저 기능] 닉네임 변경 및 DB 업데이트 핸들러
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 💉 [인증 로직] 이메일/비밀번호 로그인 및 회원가입 제출
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 💉 [히스토리 제어] 뒤로 가기 버튼 감지 및 뷰 전환 동기화
  // ------------------------------------------------------------------
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



  // ------------------------------------------------------------------
  // 💉 [오디오 제어] 효과음 파일 사전 로드 및 오디오 컨텍스트 준비
  // ------------------------------------------------------------------
  useEffect(() => {
    const initAudio = async () => {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
      try {
        // 1. 클릭 사운드 로드
        const response = await fetch('/sound/mouseClick.mp3');
        const arrayBuffer = await response.arrayBuffer();
        clickBufferRef.current = await audioCtxRef.current.decodeAudioData(arrayBuffer);
        // 2. 💉 시작 사운드 로드 추가
        const startRes = await fetch('/sound/startSound.mp3');
        const startData = await startRes.arrayBuffer();
        startBufferRef.current = await audioCtxRef.current.decodeAudioData(startData);
      } catch (e) {
        console.error("Audio Load Error:", e);
      }
    };
    initAudio();
  }, []);


  // ------------------------------------------------------------------
  // 💉 [오디오 시스템] 시작 사운드 재생 함수 정의
  // ------------------------------------------------------------------
  const playStartSound = () => {
    if (isMuted || !audioCtxRef.current || !startBufferRef.current) return;
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

    const source = audioCtxRef.current.createBufferSource();
    const gainNode = audioCtxRef.current.createGain();

    source.buffer = startBufferRef.current;
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);
    source.start(0);
  };



  // ------------------------------------------------------------------
  // 💉 [인증] 구글 계정 간편 로그인 핸들러
  // ------------------------------------------------------------------
  const handleGoogleLogin = async () => {
    try { await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin, queryParams: { access_type: 'offline', prompt: 'consent' } } });
    } catch (error: any) { console.error(error.message); }
  };

  // ------------------------------------------------------------------
  // 💉 [세션 종료] 로그아웃 및 로컬 캐시 전체 삭제
  // ------------------------------------------------------------------
  const handleLogout = () => {
    localStorage.clear();
    supabase.auth.signOut().catch(err => console.warn(err));
    resetUserState();
    setTimeout(() => { window.location.reload(); }, 100);
  };

  // ------------------------------------------------------------------
  // 💉 [내비게이션] 메뉴 이동 전 세션 유효성 강제 검사
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 💉 [게임 초기화] 라운드 및 소요 시간 세팅 초기화
  // ------------------------------------------------------------------
  const resetGameSession = (startTime = 0) => {
    if (startTime === 0) setRound(1);
    setSessionStartTime(startTime);
    setSessionCoins(0);
    setContinueCount(3);
    setGameKey(Date.now());
  };

  // ------------------------------------------------------------------
  // 💉 [오디오] 버튼 클릭 사운드 재생
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 💉 [광고 제어] 게임 3판마다 전면 광고 호출 로직
  // ------------------------------------------------------------------
  const showInterstitialAd = () => {
    if (adFreeUntil) {
      const now = new Date();
      const expiryDate = new Date(adFreeUntil);
      if (now < expiryDate) return; 
    }
    console.log("🎬 Interstitial Ad Logic...");
  };



  
  // ------------------------------------------------------------------
  // 💉 [게임 로직] 결과 처리 및 신기록 DB 업서트 핸들러
  // ------------------------------------------------------------------
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



  // ------------------------------------------------------------------
  // 💉 [플레이 로직] 최고 기록 지점부터 시작 (코인 차감 or 광고 시청)
  // ------------------------------------------------------------------
  const handlePlayFromBest = async () => {
    if (!currentUserId) return;
    const { data: record } = await supabase.from('mode_records').select('best_round, best_time').eq('user_id', currentUserId)
                                            .eq('mode', selectedOption).maybeSingle();
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

  // ------------------------------------------------------------------
  // 💉 [광고 로직] 보상형 광고 시청 완료 후 이어하기 처리 핸들러
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 💉 [인증 화면] 로그인하지 않은 유저에게 노출되는 시작 페이지
  // ------------------------------------------------------------------
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-start justify-center pt-20">
        <div className="w-full max-w-[320px]">
          <h1 className="text-5xl font-black mb-8 text-center italic tracking-tighter uppercase">
            <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
          </h1>


          


          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input type="email" placeholder={t('main', 'email_placeholder')} value={email} onChange={(e) => setEmail(e.target.value)} 
            className="mt-10 w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />
            
            {isSignUpMode && <input type="text" placeholder={t('main', 'nickname_placeholder')} value={username} onChange={(e) => setUsername(e.target.value)} 
            className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />}
            
            <input type="password" placeholder={t('main', 'password_placeholder')} value={password} onChange={(e) => setPassword(e.target.value)} 
            className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />

            <button 
              type="submit" 
              onClick={() => playClickSound()} // 💉 사운드 추가
              className="mt-4 w-full h-12 bg-[#FF9900] text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all shadow-[0_5px_15px_rgba(255,153,0,0.3)]"
            >
              {loading ? t('main', 'loading_wait') : (isSignUpMode ? t('main', 'join_btn') : t('main','login_btn'))}
            </button>
          </form>

          <div className="flex items-center gap-2 my-2"></div>
          <button 
            type="button" 
            onClick={() => { playClickSound(); handleGoogleLogin(); }} // 💉 사운드 추가
            className="w-full h-12 bg-white text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M23.52 12.29C23.52 11.43 23.45 10.61 23.31 9.82H12V14.45H18.45C18.17 15.93 17.31 17.18 16.03 18.04V21.03H19.9C22.16 18.95 23.52 15.89 23.52 12.29Z" fill="#4285F4"/><path d="M12 24C15.24 24 17.96 22.92 19.9 21.03L16.03 18.04C14.95 18.76 13.58 19.18 12 19.18C8.88 19.18 6.23 17.07 5.29 14.25H1.31V17.34C3.26 21.21 7.29 24 12 24Z" fill="#34A853"/><path d="M5.29 14.25C5.05 13.53 4.92 12.77 4.92 12C4.92 11.23 5.05 10.47 5.29 9.75V6.66H1.31C0.47 8.33 0 10.11 0 12C0 13.89 0.47 15.67 1.31 17.34L5.29 14.25Z" fill="#FBBC05"/><path d="M12 4.82C13.76 4.82 15.34 5.43 16.58 6.61L20.01 3.17C17.95 1.25 15.24 0 12 0C7.29 0 3.26 2.79 1.31 6.66L5.29 9.75C6.23 6.93 8.88 4.82 12 4.82Z" fill="#EA4335"/>
            </svg>
            {t('main', 'google_login')}
          </button>
          
          <button 
            type="button" 
            onClick={() => { playClickSound(); setIsSignUpMode(!isSignUpMode); }} // 💉 사운드 추가
            className="w-full text-base text-zinc-400 hover:text-[#FF9900] text-center font-bold mt-4 uppercase"
          >
            {isSignUpMode ? t('main', 'back_to_login') : t('main', 'create_acc')}
          </button>

          {/* 💉 언어 설정 파트 (수정됨) */}
          <div className="flex flex-col items-center mt-12">
            {/* 1. 국기 이미지 버튼 그룹 */}
            <div className="flex justify-center gap-10">
              <button 
                onClick={() => { playClickSound(); handleLanguageChange('en'); }} 
                // 선택 여부에 따라 투명도 조절 (기존 로직 유지)
                className={`transition-all active:scale-90 ${lang === 'en' ? 'opacity-100 scale-110' : 'opacity-30 hover:opacity-70'}`}
              >
                {/* 💉 이모지 대신 이미지 사용 (public/images/ 폴더에 파일 필요) */}
                <img src="/images/eng.png" alt="English" className="w-9 h-9 object-contain drop-shadow-lg" />
              </button>
              <button 
                onClick={() => { playClickSound(); handleLanguageChange('ko'); }} 
                className={`transition-all active:scale-90 ${lang === 'ko' ? 'opacity-100 scale-110' : 'opacity-30 hover:opacity-70'}`}
              >
                <img src="/images/kor.png" alt="Korean" className="w-9 h-9 object-contain drop-shadow-lg" />
              </button>
            </div>

            {/* 2. 텍스트 라벨 버튼 그룹 */}
            <div className="flex justify-center gap-10 mt-2">

              <button 
                onClick={() => { playClickSound(); handleLanguageChange('en'); }}
                // 💉 선택된 언어는 주황색, 아니면 회색으로 스타일 조건부 적용
                className={`-ml-3 text-xs font-black uppercase tracking-[0.2em] transition-colors ${
                  lang === 'en' ? 'text-[#FF9900] drop-shadow-[0_0_5px_rgba(255,153,0,0.5)]' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                english
              </button>

              <button 
                onClick={() => { playClickSound(); handleLanguageChange('ko'); }}
                className={`-ml-4 text-xs font-black uppercase tracking-[0.2em] transition-colors ${
                  lang === 'ko' ? 'text-[#FF9900] drop-shadow-[0_0_5px_rgba(255,153,0,0.5)]' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                한국어
              </button>
            </div>
          </div>

        </div>
        
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 💉 [메인 앱 화면] 로그인 후 노출되는 코어 레이아웃 (헤더 + 메인 + 오버레이)
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans" onClick={() => { setIsUserMenuOpen(false); setIsSettingsMenuOpen(false); }}>
      
      {/* 💉 상단 헤더 섹션 (로고, 설정, 재화 표시) */}
      <header className="w-full border-b border-zinc-800 bg-black sticky top-0 z-50">
        {/* 내부 콘텐츠를 감싸는 600px 정렬용 div 추가 */}
        <div className="max-w-[800px] w-full mx-auto p-6 flex justify-between items-center">
          
          {/* [좌측] 로고 및 시스템 설정 영역 */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); playClickSound(); setIsSettingsMenuOpen(!isSettingsMenuOpen); }}
                className="w-5 h-5 flex items-center justify-center transition-transform active:scale-90 -ml-2"
              >
                <img src="/images/menu.png" alt="Settings" className={`w-full h-full object-contain transition-opacity ${isSettingsMenuOpen ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`} />
              </button>
              {isSettingsMenuOpen && (
                <div className="absolute left-0 mt-3 w-30 bg-zinc-900 border border-zinc-800 rounded-lg py-0 z-[100] shadow-2xl">
                  <button onClick={() => { playClickSound(); setView('settings'); }} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold uppercase">{t('settings', 'language')}</button>
                  <button onClick={() => { playClickSound(); setView('info'); }} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold uppercase text-zinc-300 hover:text-white">{t('settings', 'game_info')}</button>
                </div>
              )}
            </div>

            <h2 className="ml-2 text-2xl font-bold tracking-tighter cursor-pointer uppercase italic" onClick={() => { playClickSound(); setView('lobby'); }}>
              <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
            </h2>
          </div>

          {/* [우측] 유저 정보 및 재화 영역 */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); playClickSound(); setIsUserMenuOpen(!isUserMenuOpen); }} className="font-bold text-sm tracking-tight text-zinc-300 hover:text-white transition-colors">
                {userNickname.length > 10 ? userNickname.substring(0, 10) + '...' : userNickname} 
              </button>
              {isUserMenuOpen && (
                <div className="absolute left-0 mt-2 w-24 bg-zinc-900 border border-zinc-800 rounded-lg py-0 z-[100] shadow-2xl">
                  <button onClick={() => { playClickSound(); handleLogout(); }} className="w-full text-left px-4 py-2 text-xs text-red-500 font-bold hover:bg-zinc-800 uppercase">Logout</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 ml-1">
              <img src="/images/coin.png" alt="coin" className="w-4 h-4 object-contain" />
              <span className="text-[#FF9900] font-bold text-sm tracking-tighter font-mono">{userCoins.toLocaleString()}</span>
            </div>
          </div>

        </div> {/* 중앙 정렬 div 끝 */}
      </header>

      {/* 💉 메인 메인 콘텐츠 렌더링 영역 */}
      <main className="flex-1 flex flex-col items-center justify-start p-0">
        {view === 'settings' && (
          <SettingsPage 
            userNickname={userNickname} setUserNickname={setUserNickname} onSaveNickname={(nick: string) => handleSaveNickname(nick)} 
            volume={volume} setVolume={setVolume} isMuted={isMuted} setIsMuted={setIsMuted} 
            onBack={() => setView('lobby')} playClickSound={playClickSound} currentLang={lang} onLangChange={handleLanguageChange} 
            t={(key: string) => t('settings', key)} 
          />
        )}

        {view === 'info' && <InfoPage onBack={() => { playClickSound(); setView('lobby'); }} todayCount={visitorStats.today} totalCount={visitorStats.total} />}
        
        {view === 'lobby' && (
          <div className="w-full max-w-[360px] flex flex-col items-center mt-4 space-y-3 px-4">
              <div className="w-full flex justify-end mb-0">
                <button 
                  onClick={() => { playClickSound(); handleShare(); }} // 💉 사운드 추가
                  className="px-4 py-1 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl hover:bg-[#ffcc33] hover:text-black active:scale-95 transition-all border border-zinc-700 active:bg-[#ffcc33] active:text-black"
                >
                  {t('lobby', 'btn_share')}
                </button>
              </div>
             <div className="flex gap-3 mb-12 mt-10 ">
               {['rock', 'paper', 'scissor'].map(img => <div key={img} className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl"><img src={`/images/${img}.png`} className="w-full h-full object-cover" /></div>)}
             </div>
             <div className="w-full flex flex-col gap-3">
                 <button onClick={() => { playClickSound(); handleLobbyNavigation('tutorial'); }} className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95">
                   {t('lobby', 'btn_tutorial')}
                 </button>
                 <button onClick={() => { playClickSound(); handleLobbyNavigation('ranking'); }} className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95">
                   {t('lobby', 'btn_ranking')}
                 </button>
                 <button onClick={() => { playClickSound(); handleLobbyNavigation('shop'); }} className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95">
                   {t('lobby', 'btn_inventory')}
                 </button>
                 <button onClick={() => { playClickSound(); handleLobbyNavigation('modeSelect'); }} className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95">
                   {t('lobby', 'btn_play')}
                 </button>
             </div>

             {/* 💉 스탯 정보 표시 영역 */}
             <div className="mt-10 p-6 rounded-3xl  shadow-xl w-full text-center">
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

        {view === 'modeSelect' && (
          <div className="w-full max-w-[360px] flex flex-col items-center mt-4 gap-3 px-4">
            <div className="w-full flex justify-end mb-0">
              <button 
                onClick={() => { playClickSound(); setView('lobby'); }} // 💉 사운드 추가
                className="px-4 py-1 bg-zinc-900 text-white text-[10px] font-black uppercase border border-zinc-800 rounded-[10px] transition-all hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
              >
                {t('modeSelect', 'btn_back')}
              </button>
            </div>
            <p className="w-full text-left text-base font-black text-[#ffcc33] uppercase ml-1">{t('modeSelect', 'title_select_mode')}</p>
            <div className="flex flex-col gap-3 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 w-full mt-0">
              {['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE'].map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-[14px] font-bold">
                  <input type="radio" checked={selectedOption === opt} onChange={() => { playClickSound(); setSelectedOption(opt); }} className="accent-[#FF9900]" />
                  <span className={selectedOption === opt ? 'text-[#FF9900]' : 'text-zinc-500'}>
                    {t('modeSelect', `mode_${opt.split(' ')[0].toLowerCase()}`)}
                  </span>
                </label>
              ))}
            </div>
            <p className="w-full text-left text-base font-black text-[#ffcc33] uppercase ml-1 mt-4">{t('modeSelect', 'title_start_with')}</p>
            <button 
              onClick={() => { playClickSound(); resetGameSession(); setView('battle'); }} 
              className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#3399cc] hover:text-black hover:border-[#3399cc] hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] active:bg-[#3399cc] active:text-black active:border-[#3399cc] active:scale-95"
            >
              {t('modeSelect', 'btn_single')}
            </button>
            <button 
              onClick={() => { playClickSound(); setView('multiplay'); }} 
              className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#66cc33] hover:text-black hover:border-[#66cc33] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#66cc33] active:text-black active:border-[#66cc33] active:scale-95"
            >
              {t('modeSelect', 'btn_multi')}
            </button>
            <button 
              onClick={() => { playClickSound(); handlePlayFromBest(); }} 
              className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800  hover:bg-[#ff3366] hover:text-black hover:border-[#ff3366] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#ff3366] active:text-black active:border-[#ff3366] active:scale-95"
            >
              {t('modeSelect', 'btn_play_from_best')}
            </button>
          </div>
        )}

        {view === 'multiplay' && 
          <MultiplayPage 
          selectedMode={selectedOption} 
          onBack={() => { playClickSound(); setView('modeSelect'); }} 
          onJoin={(roomId) => { playClickSound(); setCurrentRoomId(roomId); setView('waitingRoom'); }} 
          playClickSound={playClickSound}
          t={(key: string) => t('multiplay', key)}
          // 🔥 [핵심 추가] 게임 내 팝업을 띄우기 위한 함수 전달
          onShowPopup={(title: string, desc: string) => {
            setMsgPopup({ isOpen: true, title, desc, onConfirm: null });
          }}
        />}

        {view === 'waitingRoom' && currentRoomId && 
          <WaitingRoom roomId={currentRoomId} 
          onLeave={() => { playClickSound(); setCurrentRoomId(null); setView('multiplay'); }} 
          onStartGame={() => { playClickSound(); setView('multiBattle'); }} />}

        {view === 'multiBattle' && currentRoomId && 
          <MultiGameEngine roomId={currentRoomId} 
          userNickname={userNickname} playClickSound={playClickSound} 
          onEarnCoin={() => setUserCoins(prev => prev + 1)} 
          onGameOver={() => { if (currentUserId) fetchUserData(currentUserId); setView('waitingRoom'); }} 
          onBackToLobby={() => { if (currentUserId) fetchUserData(currentUserId); setCurrentRoomId(null); setView('lobby'); }} />}

        {view === 'tutorial' && 
          <TutorialPage onBack={() => { playClickSound(); setView('lobby'); }} />}

        {view === 'battle' && 
          <GameEngine key={gameKey} round={round} mode={selectedOption} playClickSound={playClickSound} initialTime={sessionStartTime} 
          onEarnCoin={() => { setUserCoins(c => c + 1); setSessionCoins(s => s + 1); }} 
          onRoundClear={(next) => setRound(next)} 
          onGameOver={handleGameOver} isModalOpen={showResultModal} t={(key: string) => t('game', key)} />}

        {view === 'ranking' && 
          <RankingPage onBack={() => { playClickSound(); setView('lobby'); }} 
          playClickSound={playClickSound} userNickname={userNickname} t={(key) => t('ranking', key)} />}

        {view === 'shop' && 
        <ShopPage onBack={() => { playClickSound(); setView('lobby'); }} 
        userCoins={userCoins} currentUserId={currentUserId} 
        onUpdateCoins={(newAmount) => { setUserCoins(newAmount); localStorage.setItem('cached_coins', newAmount.toString()); }} />} 
             
      </main>

      {/* 💉 오버레이 모달 및 시스템 팝업 렌더링 */}
      <AdOverlay isOpen={showAdOverlay} onClose={() => { setShowAdOverlay(false); setPendingBestRound(null); }} onReward={handleAdContinueSuccess} />
      <ResultModal isOpen={showResultModal} mode={selectedOption} round={resultData.round} time={resultData.time} earnedCoins={resultData.coins} userCoins={userCoins} isNewRecord={resultData.isNewRecord} continueCount={continueCount} continueCost={CONTINUE_COST} onContinue={() => { if(userCoins >= CONTINUE_COST) { setUserCoins(c => c - CONTINUE_COST); setContinueCount(prev => prev - 1); setShowResultModal(false); } }} onRetry={() => { setShowResultModal(false); setRound(1); resetGameSession(0); setView('battle'); }} onLobby={() => { setShowResultModal(false); resetGameSession(); setView('modeSelect'); }} onShop={() => { setShowResultModal(false); setView('shop'); }} onWatchAd={() => setShowAdOverlay(true)} t={(key: string) => t('resultModal', key)}/>

      {msgPopup.isOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[280px] bg-zinc-900 border-2 border-[#FF9900] rounded-[40px] p-8 flex flex-col items-center text-center shadow-[0_0_50px_rgba(255,153,0,0.2)] animate-in zoom-in-95 duration-200">
            <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-3">{msgPopup.title}</h3>
            {(msgPopup.title === t('popup', 'msg_continue_title') || msgPopup.title === t('popup', 'msg_ad_start_title')) && (
              <p className="text-base font-bold text-zinc-500 uppercase tracking-tight mb-6">{t('popup', 'msg_best_record_info')}</p>
            )}
            <div className="flex items-center justify-center gap-3 mb-10">
              {msgPopup.title === t('popup', 'msg_continue_title') && <img src="/images/coin.png" alt="coin" className="w-6 h-6 object-contain" />}
              <p className="text-2xl text-white font-black italic uppercase tracking-tighter whitespace-pre-line">{msgPopup.desc}</p>
            </div>
            <div className="flex gap-3 w-full">
              {msgPopup.onConfirm && (
                <button 
                  onClick={() => { if(canClickPopup) { playClickSound(); msgPopup.onConfirm?.(); } }} // 💉 사운드 추가
                  disabled={!canClickPopup} 
                  className={`flex-1 h-10 rounded-2xl font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 
                    ${canClickPopup ? "hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95" : "opacity-50 cursor-not-allowed"}`}
                >
                  {t('settings', 'confirm')}
                </button>
              )}
              <button 
                onClick={() => { if(canClickPopup) { playClickSound(); setMsgPopup(prev => ({ ...prev, isOpen: false, onConfirm: null })); } }} // 💉 사운드 추가
                disabled={!canClickPopup} 
                className={`flex-1 h-10 rounded-2xl font-bold text-lg uppercase tracking-widest transition-all bg-zinc-700 text-white border border-zinc-500
                   ${msgPopup.onConfirm ? "flex-1 bg-zinc-900 text-white" : "w-full bg-[#FF9900] text-black"} 
                  ${canClickPopup ? "hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95" : "opacity-50 cursor-not-allowed"}`}
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