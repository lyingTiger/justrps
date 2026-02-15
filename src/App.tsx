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
import AdLoadingOverlay from './AdLoadingOverlay';
import InfoPage from './InfoPage';
import { useState, useEffect, useRef } from 'react';
import { translations } from './constants/translations'; 

interface UserItems {
  stop: number;
  switch: number;
  color: number;
  heal: number;
}

export default function App() {

  // ------------------------------------------------------------------
  // 💉 [신규] 개발자 인증 상태 정의
  // ------------------------------------------------------------------
  const [isDevAuthorized, setIsDevAuthorized] = useState(false);
  const [tempCode, setTempCode] = useState('');

  {/* ------------------------------------------------------------------
            ✨ 여기까지 개발자 인증코드- 차후 삭제
  ------------------------------------------------------------------ */}




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
  const [showAdLoading, setShowAdLoading] = useState(false);

  // App 컴포넌트 내부 상태 선언
  const [userItems, setUserItems] = useState<UserItems>({ stop: 0, switch: 0, color: 0, heal: 0 });
  const [sessionItems, setSessionItems] = useState<UserItems>({ stop: 0, switch: 0, color: 0, heal: 0 });


  // 1. 비밀번호 변경 핸들러
  const handleChangePassword = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;

    // Supabase의 비밀번호 재설정 이메일 발송 기능을 활용합니다.
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      setMsgPopup({ isOpen: true, title: "Error", desc: "요청 실패:\n잠시 후 다시 시도해주세요.", onConfirm: null });
    } else {
      setMsgPopup({ isOpen: true, title: "Success", desc: "비밀번호 재설정 이메일이\n발송되었습니다.", onConfirm: null });
    }
  };

  // 2. 회원 탈퇴 핸들러
  const handleDeleteAccount = () => {
    setMsgPopup({
      isOpen: true,
      title: "DANGER",
      desc: "정말 탈퇴하시겠습니까?\n모든 기록과 재화가\n영구적으로 삭제됩니다.",
      onConfirm: async () => {
        if (!currentUserId) return;
        
        // 💉 외과적 데이터 삭제: 프로필 데이터 먼저 삭제
        await supabase.from('profiles').delete().eq('id', currentUserId);
        
        // 실제 Auth 계정 삭제는 보안상 Edge Function을 권장하지만, 
        // 여기서는 우선 로그아웃 후 초기화 처리로 진행합니다.
        await supabase.auth.signOut();
        window.location.reload(); 
      }
    });
  };



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
  const [selectedOption, setSelectedOption] = useState<string>(
    localStorage.getItem('last_played_mode') || 'DRAW MODE'
  );
  const [round, setRound] = useState(1);
  const [gameKey, setGameKey] = useState(Date.now());

  const [stats, setStats] = useState({ 
    total_games: parseInt(localStorage.getItem('cached_total_games') || '0'), 
    multi_win_rate: parseInt(localStorage.getItem('cached_win_rate') || '0'), 
    best_rank: parseInt(localStorage.getItem('cached_best_rank') || '0'), 
    best_mode: localStorage.getItem('cached_best_mode') || '' 
  });

  // ------------------------------------------------------------------
  // 💉 [수정] 오디오 설정 상태: 저장된 값이 있으면 불러오고, 없으면 기본값 사용
  // ------------------------------------------------------------------
  const [volume, setVolume] = useState(
    parseFloat(localStorage.getItem('app_volume') || '0.5')
  );
  const [isMuted, setIsMuted] = useState(
    localStorage.getItem('app_isMuted') === 'true'
  );

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


  // 세션 보상 저장 함수 (아이템 포함)
  const saveSessionRewards = async () => {
    // 코인이나 아이템 중 하나라도 획득한 게 있을 때만 실행
    const hasItemRewards = Object.values(sessionItems).some(v => v > 0);
    if (sessionCoins <= 0 && !hasItemRewards) return;

    try {
      // 코인 저장 (기존 RPC 유지)
      if (sessionCoins > 0) {
        await supabase.rpc('increment_coin', { amount: sessionCoins });
      }

      // 아이템 저장 (1단계에서 만든 RPC 호출)
      if (hasItemRewards) {
        await supabase.rpc('update_user_items', {
          target_user_id: currentUserId,
          stop_inc: sessionItems.stop,
          switch_inc: sessionItems.switch,
          color_inc: sessionItems.color,
          heal_inc: sessionItems.heal
        });
      }
      
      console.log(`✅ 보상 저장 완료: 코인 ${sessionCoins}, 아이템 저장됨`);
      
      // UI 및 상태 갱신
      if (currentUserId) fetchUserData(currentUserId); 
      setSessionCoins(0);
      setSessionItems({ stop: 0, switch: 0, color: 0, heal: 0 }); // 💉 아이템 세션 초기화
    } catch (e) {
      console.error("보상 저장 중 오류 발생:", e);
    }
  };



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
  // 💉 [방 관리] DB 방 퇴장 처리 헬퍼 함수 (자동 로그아웃/로고 클릭용)
  // ------------------------------------------------------------------
  const leaveCurrentRoom = async () => {
    if (!currentRoomId || !currentUserId) return;
    try {
      await supabase.from('room_participants').delete().eq('room_id', currentRoomId).eq('user_id', currentUserId);
      setCurrentRoomId(null);
    } catch (e) {
      console.error("자동 퇴장 처리 중 오류:", e);
    }
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

      // 💉 DB에서 가져온 아이템 보유량을 상태값에 저장합니다.
      setUserItems({
        stop: profile.item_stop || 0,
        switch: profile.item_switch || 0,
        color: profile.item_color || 0,
        heal: profile.item_heal || 0
      });


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


  // 💉 아이템 획득 확률 계산 함수 (2%)
  const rollForItem = () => {
    const isHit = Math.random() < 1; // 2% 확률 (0.02)
    if (!isHit) return null;

    const itemTypes: (keyof UserItems)[] = ['stop', 'switch', 'color', 'heal'];
    const randomIndex = Math.floor(Math.random() * itemTypes.length);
    return itemTypes[randomIndex];
  };



  // ------------------------------------------------------------------
  // 💉 [수정 완료] 보안 시스템: 독립된 useEffect로 완벽 분리
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDevKey = 
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u');

      if (isDevKey) {
        e.preventDefault();
        e.stopPropagation();
        console.log("🛠️ DevTools access is restricted."); 
        return false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // 🏁 최초 1회만 실행


  // ------------------------------------------------------------------
  // 💉 [수정] 히스토리 제어: 뒤로 가기 제스처 시 의도치 않은 이동 방지
  // ------------------------------------------------------------------
  useEffect(() => {
  // 1. 히스토리 스택 쌓기
  // 로비에서도 pushState를 사용하여 뒤로 가기 제스처를 '낚아챌' 수 있는 지점을 만듭니다.
    window.history.pushState({ view }, '', '');

    const handlePopState = async (event: PopStateEvent) => {
        // [A] 결과창 모달이 열려있는 경우 (싱글 모드)
        if (showResultModal) {
          setShowResultModal(false);
          resetGameSession();
          setView('modeSelect');
          return;
        }

        // [B] 현재 뷰에 따른 커스텀 뒤로 가기 액션
        switch (view) {
          case 'lobby':
            // 💉 [수정] 로비에서 뒤로 가기 시 새로고침 실행
            console.log("🔄 Lobby swipe detected: Refreshing page...");
            window.location.reload();
            break;

          case 'modeSelect':
            // 셀렉트 모드 -> 로비
            setView('lobby');
            break;

          case 'multiplay':
            // 멀티플레이 페이지 -> 셀렉트 모드
            setView('modeSelect');
            break;

          case 'waitingRoom':
            // 웨이팅룸 -> 방 퇴장 후 멀티플레이 페이지
            playClickSound();
            await leaveCurrentRoom();
            setView('multiplay');
            break;

          case 'multiBattle':
            // 멀티 게임 중/결과창 -> 방(waitingRoom)으로 복귀
            if (currentUserId) fetchUserData(currentUserId);
            setView('waitingRoom'); 
            break;

          case 'battle':
            // 싱글 게임 중 -> 셀렉트 모드
            setView('modeSelect');
            break;

          default:
            if (event.state && event.state.view) {
              setView(event.state.view);
            } else {
              setView('lobby');
            }
            break;
        }
      };

      // 이벤트 리스너 등록
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
  }, [view, showResultModal, currentRoomId, currentUserId]);



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




    // 💉 [교체 1] 방문자 통계 관리: 중복 방지 로직 포함
    useEffect(() => {
      const handleStats = async () => {
        // 1. 로비 진입 시 + 로그인된 경우에만 방문자 수 증가 시도
        // (DB의 increment_visitor 함수가 오늘 방문 여부를 체크해 중복을 막습니다)
        if (view === 'lobby' && isLoggedIn) {
          await supabase.rpc('increment_visitor');
        }

        // 2. 로비나 정보 페이지일 때 최신 통계 데이터를 가져옴
        if (view === 'lobby' || view === 'info') {
          const { data } = await supabase
            .from('site_stats')
            .select('today_count, total_count')
            .eq('id', 'global')
            .maybeSingle();
            
          if (data) setVisitorStats({ today: data.today_count, total: data.total_count });
        }
      };

      handleStats();
    }, [view, isLoggedIn]); // 💉 isLoggedIn을 추가하여 로그인 직후 카운트가 반영되게 함


    // 💉 [교체 2] 인증 및 초기 설정 (방문자 로직 분리됨)
    useEffect(() => {
      document.title = "just RPS";

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
  // 💉 [수정] 새로운 효과음을 위한 Ref 추가
  // ------------------------------------------------------------------
  const tockBufferRef = useRef<AudioBuffer | null>(null);     // 정답 (tock.mp3)
  const whickBufferRef = useRef<AudioBuffer | null>(null);    // 라운드 클리어 (whick.mp3)
  const beepBufferRef = useRef<AudioBuffer | null>(null);     // 게임오버 (beepbeep.mp3)



  // ------------------------------------------------------------------
  // 💉 [수정] 오디오 컨텍스트 준비 및 파일 사전 로드 (initAudio 업데이트)
  // ------------------------------------------------------------------
  useEffect(() => {
    const initAudio = async () => {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
      try {
        // 1. 기존 클릭/시작 사운드 로드
        const [clickRes, startRes, tockRes, whickRes, beepRes] = await Promise.all([
          fetch('/sound/mouseClick.mp3'),
          fetch('/sound/startSound.mp3'),
          fetch('/sound/tock.mp3'),
          fetch('/sound/whick.mp3'),
          fetch('/sound/beepbeep.mp3')
        ]);

        const buffers = await Promise.all([
          clickRes.arrayBuffer(),
          startRes.arrayBuffer(),
          tockRes.arrayBuffer(),
          whickRes.arrayBuffer(),
          beepRes.arrayBuffer()
        ]);

        clickBufferRef.current = await audioCtxRef.current.decodeAudioData(buffers[0]);
        startBufferRef.current = await audioCtxRef.current.decodeAudioData(buffers[1]);
        tockBufferRef.current = await audioCtxRef.current.decodeAudioData(buffers[2]);
        whickBufferRef.current = await audioCtxRef.current.decodeAudioData(buffers[3]);
        beepBufferRef.current = await audioCtxRef.current.decodeAudioData(buffers[4]);
      } catch (e) {
        console.error("Audio Load Error:", e);
      }
    };
    initAudio();
  }, []);

  // ------------------------------------------------------------------
  // 💉 [신규] 효과음 재생 유틸리티 함수들 정의
  // ------------------------------------------------------------------
  const playSound = (buffer: AudioBuffer | null) => {
    if (isMuted || !audioCtxRef.current || !buffer) return;
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    const source = audioCtxRef.current.createBufferSource();
    const gainNode = audioCtxRef.current.createGain();
    source.buffer = buffer;
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);
    source.start(0);
  };

  const playTockSound = () => playSound(tockBufferRef.current);
  const playWhickSound = () => playSound(whickBufferRef.current);
  const playBeepSound = () => playSound(beepBufferRef.current);


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
  // 💉 [신규] 카카오 계정 간편 로그인 핸들러 (handleGoogleLogin 아래에 추가)
  // ------------------------------------------------------------------
  const handleKakaoLogin = async () => {
    try {
      // 💉 Supabase에 설정한 Kakao Provider를 호출합니다.
      await supabase.auth.signInWithOAuth({ 
        provider: 'kakao', 
        options: { 
          redirectTo: window.location.origin, // 로그인 완료 후 현재 도메인으로 복귀
          queryParams: { access_type: 'offline', prompt: 'consent' } 
        } 
      });
    } catch (error: any) { 
      console.error("Kakao Login Error:", error.message); 
    }
  };



  // ------------------------------------------------------------------
  // 💉 [세션 종료] 로그아웃 및 로컬 캐시 전체 삭제
  // ------------------------------------------------------------------
  const handleLogout = async () => {
    if (currentRoomId) await leaveCurrentRoom();
    // 💉 [백업] 삭제 전 보존해야 할 설정값들을 수집합니다.
    const savedLang = localStorage.getItem('app_lang');
    const savedVol = volume.toString();
    const savedMute = isMuted.toString();
    const savedMode = localStorage.getItem('last_played_mode');
    // const currentLang = localStorage.getItem('app_lang');
    localStorage.clear();

    // 💉 [복구] 챙겨두었던 설정값들만 다시 저장합니다.
    if (savedLang) localStorage.setItem('app_lang', savedLang);
    localStorage.setItem('app_volume', savedVol);
    localStorage.setItem('app_isMuted', savedMute);
    if (savedMode) localStorage.setItem('last_played_mode', savedMode);

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
      // 1. 신기록 체크 및 업데이트 로직
      const { data: record, error: fetchError } = await supabase.from('mode_records').select('*').eq('user_id', currentUserId).eq('mode', selectedOption).maybeSingle();
      if (fetchError) throw fetchError;
      const isNewRecord = !record || finalRound > record.best_round || (finalRound === record.best_round && entryTime < record.best_time);
      if (isNewRecord) {
        setResultData(prev => ({ ...prev, isNewRecord: true }));
        await supabase.from('mode_records').upsert({ user_id: currentUserId, mode: selectedOption, best_round: finalRound, best_time: entryTime, updated_at: new Date().toISOString() }, { onConflict: 'user_id, mode' });
      }

      // 2. 게임 로그 기록
      await supabase.from('game_logs').insert({ user_id: currentUserId, mode: selectedOption, reached_round: finalRound, play_time: entryTime });
    } catch (err) { console.error(err); } finally {
      const newPlayCount = playCount + 1;
      setPlayCount(newPlayCount);
      if (newPlayCount >= 3) { showInterstitialAd(); setPlayCount(0); }
    }

    const newPlayCount = playCount + 1;
    setPlayCount(newPlayCount);

    // 💉 5판이 되었을 때 광고 시퀀스 시작
    if (newPlayCount >= 5 && !adFreeUntil) { // 광고 제거 상품 미구매 시
      setShowAdLoading(true); // 1. 로딩 오버레이 먼저 표시
      setPlayCount(0); // 카운트 초기화

      // 1.5초 뒤에 실제 광고 오버레이로 교체
      setTimeout(() => {
        setShowAdLoading(false);
        setShowAdOverlay(true); 
      }, 1500);
    } else {
      // 5판이 안 됐을 때는 바로 결과창
      setShowResultModal(true);
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


  const handleAdExited = () => {
    setMsgPopup({
      isOpen: true,
      title: "WAIT!",
      desc: "지금 종료하면\n획득한 코인과 아이템을\n모두 잃게 됩니다.",
      onConfirm: () => {
        // 유저가 알겠다고 하면 코인 버리고 로비로 이동
        setSessionCoins(0);
        setView('lobby');
      }
      // 취소(cancel) 버튼을 누르면 광고 화면으로 다시 복귀하는 흐름
    });
  };



  // ------------------------------------------------------------------
  // 💉 [인증 화면] 로그인하지 않은 유저에게 노출되는 시작 페이지
  // ------------------------------------------------------------------
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-start justify-center pt-20">

      {/* ------------------------------------------------------------------
            ✨ [신규] 개발자 코드 입력 팝업 (인증 전 노출)
           ------------------------------------------------------------------ */}
          {!isDevAuthorized && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
              <div className="w-full max-w-[300px] bg-zinc-900 border-2 border-[#FF9900] rounded-[30px] p-8 text-center shadow-[0_0_50px_rgba(255,153,0,0.3)]">
                <h3 className="text-xl font-black text-white italic uppercase mb-4 tracking-tighter">
                  Developer Access
                </h3>
                <p className="text-sm font-bold text-zinc-400 mb-6 break-keep">
                  아직 개발중입니다.<br/>개발자로부터 받은 코드를 입력하십시오.
                </p>
                <input 
                  type="password" 
                  value={tempCode}
                  onChange={(e) => setTempCode(e.target.value)}
                  placeholder="Code"
                  className="w-full h-12 bg-black border border-zinc-800 rounded-xl px-4 text-center text-white font-black text-xl outline-none focus:border-[#FF9900] transition-all mb-4"
                />
                <button 
                  onClick={() => {
                    if (tempCode === '2026') {
                      playClickSound();
                      setIsDevAuthorized(true);
                    } else {
                      alert('코드가 일치하지 않습니다.');
                      setTempCode('');
                    }
                  }}
                  className="w-full h-12 bg-[#FF9900] text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all"
                >
                  확인
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------
            ✨ 여기까지 개발자 인증코드- 차후 삭제
           ------------------------------------------------------------------ */}



        <div className="w-full max-w-[320px]">
          <h1 className="text-5xl font-black mb-8 text-center italic tracking-tighter uppercase">
            <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
          </h1>


          


          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input type="email" placeholder={t('main', 'email_placeholder')} value={email} onChange={(e) => setEmail(e.target.value)} 
            className="mt-10 w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />
            
            {isSignUpMode && <input type="text" placeholder={t('main', 'nickname_placeholder')} value={username} onChange={(e) => setUsername(e.target.value)} 
            className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />}
            
            <input type="password" placeholder={t('main', 'password_placeholder')} value={password} onChange={(e) => setPassword(e.target.value)} 
            className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold -mt-2" required />

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
            className="w-full h-12 bg-white text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all flex items-center justify-center gap-3 -mt-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M23.52 12.29C23.52 11.43 23.45 10.61 23.31 9.82H12V14.45H18.45C18.17 15.93 17.31 17.18 16.03 18.04V21.03H19.9C22.16 18.95 23.52 15.89 23.52 12.29Z" fill="#4285F4"/><path d="M12 24C15.24 24 17.96 22.92 19.9 21.03L16.03 18.04C14.95 18.76 13.58 19.18 12 19.18C8.88 19.18 6.23 17.07 5.29 14.25H1.31V17.34C3.26 21.21 7.29 24 12 24Z" fill="#34A853"/><path d="M5.29 14.25C5.05 13.53 4.92 12.77 4.92 12C4.92 11.23 5.05 10.47 5.29 9.75V6.66H1.31C0.47 8.33 0 10.11 0 12C0 13.89 0.47 15.67 1.31 17.34L5.29 14.25Z" fill="#FBBC05"/><path d="M12 4.82C13.76 4.82 15.34 5.43 16.58 6.61L20.01 3.17C17.95 1.25 15.24 0 12 0C7.29 0 3.26 2.79 1.31 6.66L5.29 9.75C6.23 6.93 8.88 4.82 12 4.82Z" fill="#EA4335"/>
            </svg>
            {t('main', 'google_login')}
          </button>
          

          {/* ------------------------------------------------------------------
          💉 [신규] 카카오 로그인 버튼 추가 
          ------------------------------------------------------------------ */}
          <button 
            type="button" 
            onClick={() => { playClickSound(); handleKakaoLogin(); }} 
            className="w-full h-12 bg-[#FEE500] text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all flex items-center justify-center gap-3 mt-2"
          >
            {/* 💉 카카오 로고 이미지가 없다면 아래 SVG 코드를 사용하세요 */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.558 1.707 4.8 4.315 6.091l-1.098 4.035c-.05.184.158.337.311.233l4.752-3.214c.54.079 1.1.121 1.72.121 4.97 0 9-3.186 9-7.115S16.97 3 12 3z"/>
            </svg>
            {/* 💉 translations에 'kakao_login' 항목을 추가해야 번역이 적용됩니다. */}
            {t('main', 'kakao_login')}
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
    // 💉 [수정] 메인 앱 화면: 드래그 방지(select-none) 및 모바일 최적화 스타일 추가
    // ------------------------------------------------------------------
    <div 
    
      className="min-h-[100dvh] bg-black text-white flex flex-col font-sans select-none overflow-x-hidden" 
       onContextMenu={(e) => e.preventDefault()}
      style={{ 
        WebkitUserSelect: 'none',    /* Safari/Chrome 드래그 방지 */
        WebkitTouchCallout: 'none', /* 모바일 롱프레스 메뉴(복사 등) 방지 */
        userSelect: 'none',          /* 표준 드래그 방지 */
        touchAction: 'manipulation'  /* 더블탭 줌 지연 방지 (게임성 향상) */
      }}
      onClick={() => { setIsUserMenuOpen(false); setIsSettingsMenuOpen(false); }}
    >
      
      
      {/* 💉 상단 헤더 섹션 (로고, 설정, 재화 표시) */}
      {!(view === 'battle' || view === 'multiBattle') && (
      <header className="w-full border-b border-zinc-800 bg-black sticky top-0 z-50 flex-none animate-in fade-in duration-300">
        <div className="max-w-[800px] w-full mx-auto p-6 flex justify-between items-center">
          
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

            <h2 className="ml-2 text-2xl font-bold tracking-tighter cursor-pointer uppercase italic" onClick={() => { playClickSound(); if(currentRoomId) leaveCurrentRoom(); setView('lobby'); }}>
              <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
            </h2>
          </div>

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
        </div>
      </header>
      )}

      {/* 💉 메인 메인 콘텐츠 렌더링 영역 */}
     {/* 💉 [수정] 메인 영역: min-h-[100dvh]를 주어 푸터를 아래로 밀어냄 */}
      <main className={`flex-1 flex flex-col items-center justify-start p-0 min-h-[100dvh] ${
        (view === 'battle' || view === 'multiBattle') ? 'overflow-hidden' : ''
        }`}>

        {view === 'settings' && (
          <SettingsPage 
            userNickname={userNickname} setUserNickname={setUserNickname} onSaveNickname={(nick: string) => handleSaveNickname(nick)} 
            volume={volume} setVolume={setVolume} isMuted={isMuted} setIsMuted={setIsMuted} 
            onBack={() => setView('lobby')} playClickSound={playClickSound} currentLang={lang} onLangChange={handleLanguageChange} 
            t={(key: string) => t('settings', key)} 
            onChangePassword={handleChangePassword} 
            onDeleteAccount={handleDeleteAccount}   
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
               {['rock', 'paper', 'scissor'].map(img => <div key={img} className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800  shadow-xl"><img src={`/images/${img}.png`} className="w-full h-full object-cover" /></div>)}
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
                  <input type="radio" checked={selectedOption === opt} onChange={() => { playClickSound(); setSelectedOption(opt); localStorage.setItem('last_played_mode', opt);}} className="accent-[#FF9900]" />
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
          onLeave={async () => { playClickSound(); await leaveCurrentRoom(); setView('multiplay'); }} 
          onStartGame={() => { playClickSound(); setView('multiBattle'); }} />}


        {/* 멀티플레이 게임 엔진 */}
        {view === 'multiBattle' && currentRoomId && 
          <MultiGameEngine 
            roomId={currentRoomId} 
            userNickname={userNickname} 
            sessionCoins={sessionCoins} 
            sessionItems={sessionItems}
            playClickSound={playClickSound} 
            playBeepSound={playBeepSound}
            onSaveRewards={saveSessionRewards}
            onEarnCoin={() => setSessionCoins(prev => prev + 1)} // 💉 수정: 세션 코인만 증가

            // 💉 [추가] 멀티플레이 라운드 클리어 시 아이템 주사위 굴리기
            onRoundClear={() => {
              const newItem = rollForItem(); // 2% 확률 계산 함수 (아까 만든 것)
              if (newItem) {
                setSessionItems(prev => ({ ...prev, [newItem]: prev[newItem] + 1 }));
                console.log(`🎁 멀티플레이 아이템 획득: ${newItem}`);
              }
            }}

            onGameOver={() => { if (currentUserId) fetchUserData(currentUserId); setView('waitingRoom'); }} 
            onBackToLobby={async () => {
              playClickSound();
              await saveSessionRewards(); // 💉 추가: 나가기 전 저장
              if (currentUserId) fetchUserData(currentUserId); 
              if (currentRoomId) leaveCurrentRoom();
              setView('multiplay'); 
            }} 
          />
        }

        {view === 'tutorial' && 
          <TutorialPage onBack={() => { playClickSound(); setView('lobby'); }} />}

        {view === 'battle' && 
          <GameEngine 
            key={gameKey} 
            round={round} 
            mode={selectedOption} 
            initialTime={sessionStartTime} 
            
            // 💉 추가된 세션 코인 값 (UI 표시용)
            sessionCoins={sessionCoins} 
            
            playClickSound={playClickSound}
            playTockSound={playTockSound}
            playWhickSound={playWhickSound}
            playBeepSound={playBeepSound}
            
            // 💉 즉시 서버에 저장하지 않고, 세션 상태값만 올림
            onEarnCoin={() => setSessionCoins(prev => prev + 1)} 
            

            onRoundClear={(next) => { 
              playWhickSound(); 
              setRound(next);
              
              // 💉 라운드 클리어 시 2% 확률로 아이템 획득 시도
              const newItem = rollForItem();
              if (newItem) {
                setSessionItems(prev => ({ ...prev, [newItem]: prev[newItem] + 1 }));
                console.log(`🎁 아이템 획득: ${newItem}`);
              }
            }}


            onGameOver={(r, t) => { playBeepSound(); handleGameOver(r, t); }}
            
            // 💉 로고 클릭 시 로비로 가기 전 서버에 저장
            onBackToLobby={async () => {
              await saveSessionRewards(); 
              setView('lobby');
            }}
            
            isModalOpen={showResultModal} 
            t={(key: string) => t('game', key)} 
          />
        }

        {view === 'ranking' && 
          <RankingPage onBack={() => { playClickSound(); setView('lobby'); }} 
          playClickSound={playClickSound} userNickname={userNickname} t={(key) => t('ranking', key)} />}

        {view === 'shop' && 
        <ShopPage onBack={() => { playClickSound(); setView('lobby'); }} 
        userCoins={userCoins} currentUserId={currentUserId} 
        onUpdateCoins={(newAmount) => { setUserCoins(newAmount); localStorage.setItem('cached_coins', newAmount.toString()); }} />} 
              
      </main>



      {/* 💉 [신규] 웹 전용 푸터: 게임 중에는 숨기고, 평소에는 스크롤해야 보임 */}
      {!(view === 'battle' || view === 'multiBattle') && (
        <footer className="w-full py-16 bg-black border-t border-zinc-900 flex flex-col items-center justify-center gap-3 flex-none">
          <div className="max-w-[360px] w-full text-center px-6">
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              © 2026 just RPS. All Rights Reserved.
            </p>
            <div className="flex justify-center gap-6 text-zinc-500 text-[9px] font-bold uppercase tracking-widest mb-6">
              <button className="hover:text-white transition-colors">Terms</button>
              <button className="hover:text-white transition-colors">Privacy</button>
              <button className="hover:text-white transition-colors">Contact</button>
            </div>
            <p className="text-zinc-800 text-[8px] font-mono tracking-tighter opacity-50">
              Powered by Treasure Factory
            </p>
          </div>
        </footer>
      )}



      {/* 💉 오버레이 모달 및 시스템 팝업 렌더링 */}
      <AdOverlay 
        isOpen={showAdOverlay} 
        onClose={handleAdExited} // 아까 만든 경고 팝업 로직 연결
        onReward={handleAdContinueSuccess} 
      />

      <AdLoadingOverlay isOpen={showAdLoading} />


      <ResultModal 
        isOpen={showResultModal} 
        mode={selectedOption} 
        round={resultData.round} 
        time={resultData.time} 
        earnedCoins={sessionCoins}
        sessionItems={sessionItems} // 💉 기존 resultData.coins 대신 현재 세션 코인 전달
        userCoins={userCoins} 
        isNewRecord={resultData.isNewRecord} 
        continueCount={continueCount} 
        continueCost={CONTINUE_COST} 
        
        // 💉 [신규 추가] 잃어버린 도구들을 여기서 쥐어줍니다.
        playClickSound={playClickSound}
        onSaveRewards={saveSessionRewards} 
        
        onContinue={() => { 
          if(userCoins >= CONTINUE_COST) { 
            setUserCoins(c => c - CONTINUE_COST); 
            setContinueCount(prev => prev - 1); 
            setShowResultModal(false); 
          } 
        }} 
        onRetry={() => { 
          setShowResultModal(false); 
          setRound(1); 
          resetGameSession(0); 
          setView('battle'); 
        }} 
        onLobby={() => { 
          setShowResultModal(false); 
          resetGameSession(); 
          setView('modeSelect'); 
        }} 
        onShop={() => { 
          setShowResultModal(false); 
          setView('shop'); 
        }} 
        onWatchAd={() => setShowAdOverlay(true)} 
        t={(key: string) => t('resultModal', key)}
      />


      {/* 1. 팝업 활성화 여부 확인: msgPopup.isOpen이 true일 때만 렌더링 시작 */}
      {msgPopup.isOpen && (

        /* 2. 전체 화면 배경(Overlay): 화면을 꽉 채우고 뒷배경을 어둡고 흐리게(blur) 처리 */
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          
          {/* 3. 모달 본체: 너비 제한(280px), 브랜드 컬러(주황) 테두리, 둥근 모서리, 부드러운 줌 애니메이션 */}
          <div className="w-full max-w-[280px] bg-zinc-900 border-2 border-[#FF9900] rounded-[40px] p-8 flex flex-col items-center text-center shadow-[0_0_50px_rgba(255,153,0,0.2)] animate-in zoom-in-95 duration-200">
            
            {/* 4. 제목(Title): 크고 굵은 이탤릭체로 강조 */}
            <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-3">{msgPopup.title}</h3>
            
            {/* 5. 부가 정보: '이어하기'나 '광고' 관련 팝업일 때만 보조 텍스트 출력 */}
            {(msgPopup.title === t('popup', 'msg_continue_title') || msgPopup.title === t('popup', 'msg_ad_start_title')) && (
              <p className="text-base font-bold text-zinc-500 uppercase tracking-tight mb-6">{t('popup', 'msg_best_record_info')}</p>
            )}
            
            {/* 6. 메인 설명(Description): 줄바꿈(\n)을 지원하며, 이어하기 시 코인 아이콘을 함께 표시 */}
            <div className="flex items-center justify-center gap-3 mb-10">
              {msgPopup.title === t('popup', 'msg_continue_title') && <img src="/images/coin.png" alt="coin" className="w-6 h-6 object-contain" />}
              <p className="text-2xl text-zinc-300 font-black italic uppercase tracking-tighter whitespace-pre-line">{msgPopup.desc}</p>
            </div>

            {/* 7. 하단 버튼 영역: 확인/취소 버튼 배치 */}
            <div className="flex gap-3 w-full">
              
              {/* [왼쪽 버튼]: msgPopup.onConfirm(확인 후 실행할 함수)이 있을 때만 나타남 */}
              {msgPopup.onConfirm && (
                <button 
                  onClick={() => { if(canClickPopup) { playClickSound(); msgPopup.onConfirm?.(); } }} 
                  disabled={!canClickPopup} // 광클 방지 상태일 때 비활성화
                  className={`flex-1 h-10 rounded-2xl font-bold text-lg uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-600 
                    ${canClickPopup ? "hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95" : "opacity-50 cursor-not-allowed"}`}
                >
                  {t('settings', 'confirm')}
                </button>
              )}
              
              {/* [오른쪽 버튼]: 팝업을 닫거나 취소하는 기본 버튼. 확인 버튼 유무에 따라 스타일(색상, 너비)이 바뀜 */}
              <button 
                onClick={() => { if(canClickPopup) { playClickSound(); setMsgPopup(prev => ({ ...prev, isOpen: false, onConfirm: null })); } }} 
                disabled={!canClickPopup} 
                className={`flex-1 h-10 rounded-2xl font-bold text-lg uppercase tracking-widest transition-all border border-zinc-600
                  ${msgPopup.onConfirm ? "bg-zinc-800 text-white" : "w-full bg-[#FF9900] text-black"} 
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