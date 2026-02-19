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
  // 💉 개발자 인증 상태 정의
  // ------------------------------------------------------------------

  // const [isDevAuthorized, setIsDevAuthorized] = useState(false);
  // const [tempCode, setTempCode] = useState('');

  {/* ------------------------------------------------------------------
            ✨ 여기까지 개발자 인증코드- 차후 삭제
  ------------------------------------------------------------------ */}




  // ------------------------------------------------------------------
  // 💉 [상태 관리] 유저 데이터, 게임 뷰, 시스템 상태 변수 정의
  // ------------------------------------------------------------------
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRoomMode, setCurrentRoomMode] = useState<string>('DRAW MODE');
  const [userNickname, setUserNickname] = useState(localStorage.getItem('cached_nickname') || 'Loading...');
  const [userCoins, setUserCoins] = useState(parseInt(localStorage.getItem('cached_coins') || '0'));
  const [showResultModal, setShowResultModal] = useState(false);
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [visitorStats, setVisitorStats] = useState({ today: 0, total: 0 });
  const lastFetchedId = useRef<string | null>(null);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [showAdLoading, setShowAdLoading] = useState(false);
  const hasCheckedDailyRef = useRef(false); // 💉 일일 보상 체크 여부

  // 💉 방 만들기 아이템전 설정 저장용 상태
  const [isItemMode, setIsItemMode] = useState<boolean>(false);
  
  // App 컴포넌트 내부 상태 선언
  const [userItems, setUserItems] = useState<UserItems>({ stop: 0, switch: 0, color: 0, heal: 0 });
  const [sessionItems, setSessionItems] = useState<UserItems>({ stop: 0, switch: 0, color: 0, heal: 0 });

  const lastActivityTimeRef = useRef(Date.now()); // 💉 마지막 활동 시각 타임스탬프

  // 💉 [상태 추가] 이어하기 횟수 관리용
  const [loadCount, setLoadCount] = useState(0);


  // 비밀번호 변경 핸들러
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



  // 회원 탈퇴 핸들러
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
  //const [view, setView] = useState<'lobby' | 'modeSelect' | 'battle' | 'settings' | 'ranking' | 'shop' | 'multiplay' | 'waitingRoom' | 'tutorial' | 'multiBattle' | 'info'>('lobby');  
  const [view, setView] = useState<'lobby' | 'modeSelect' | 'battle' | 'settings' | 'ranking' | 'shop' | 'multiplay' | 'waitingRoom' | 'tutorial' | 'multiBattle' | 'info' | 'terms' | 'privacy'>('lobby');

  
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null); 
  // 💉 [신규 추가] 현재 방에 참여 중인 유저들의 목록을 저장합니다.
  const [participants, setParticipants] = useState<any[]>([]);
  
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
  // 💉 방 참가자 명단을 가져오고 실시간으로 업데이트하는 로직
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!currentRoomId) return;

    // 1. 초기 명단 불러오기
    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', currentRoomId);
      
      if (data) setParticipants(data);
    };

    fetchParticipants();

    // 2. 실시간 변화 감지 (누군가 라운드를 올리거나 아이템을 썼을 때)
    const channel = supabase
      .channel(`room_sync_${currentRoomId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'room_participants', 
        filter: `room_id=eq.${currentRoomId}` 
      }, (payload) => {
        // 💉 변화가 생기면 명단을 다시 불러와 participants 상태를 갱신합니다.
        fetchParticipants();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentRoomId]);



  // ------------------------------------------------------------------
  // 💉 오디오 설정 상태: 저장된 값이 있으면 불러오고, 없으면 기본값 사용
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
      text: lang === 'ko' ? '기억해, 보 보 가위 바위 보...\n기억력 & 순발력 대결! \n\n자신의 한계를 극복하고, \n친구들과 대결해 보세요!' : 'Remember, RPS!\nGenius playground!\n\nOvercome your limits,\nand battle your friends!',
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



  // 💉 아이템 모드 설정 변경 시 Supabase(profiles)에 자동 저장하는 로직
  useEffect(() => {
      const saveUserPreferences = async () => {
          if (!currentUserId) return;

          await supabase
              .from('profiles')
              .update({
                  last_selected_option: selectedOption,
                  last_is_item_mode: isItemMode
              })
              .eq('id', currentUserId);
      };

      saveUserPreferences();
  }, [selectedOption, isItemMode, currentUserId]);



  // ------------------------------------------------------------------
  // 💉 [데이터 로드] Supabase 프로필 및 통계 로드 (자가 치유 기능 포함)
  // ------------------------------------------------------------------
  const fetchUserData = async (userId: string) => {
    if (!userId) return;
    try {
      let { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      
      // 🎁 [A] 신규 가입자: 프로필 생성 및 '가입 선물' 지급
      if (!profile && !error) {
        const { data: { session } } = await supabase.auth.getSession();
        const rawName = session?.user?.user_metadata?.full_name || 'Player';
        const googleName = rawName.substring(0, 15);

        const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({ 
          id: userId, 
          display_name: googleName, 
          coins: 300,     // 💰 가입 선물: 300 코인
          item_stop: 3,   // 🎁 가입 선물: 아이템 3개씩
          item_switch: 3,
          item_color: 3,
          item_heal: 3,
          // 💉 중요: 가입 날짜를 '과거'나 '공백'으로 넣어야 바로 아래 일일 보상 로직이 작동합니다.
          last_login_date: '1900-01-01' 
        }).select().single();

        if (!insertError && newProfile) {
          profile = newProfile;
          
          // ✨ 가입 축하 팝업 (가입 선물 내용 명시)
          setMsgPopup({
            isOpen: true,
            title: lang === 'ko' ? "환영합니다!" : "WELCOME!",
            desc: lang === 'ko' 
              ? `가입 선물\n+300코인\n공격 아이템 3세트` 
              : `Signup Gift\n+300 Coins\nattack item 3 sets`,
          });
        }
      }

      if (error || !profile) return;

      // 📅 [B] 일일 보상 체크 (기존 로직 유지하되 신규 가입자도 포함됨)
      const today = new Date().toISOString().split('T')[0];
      const lastLogin = profile.last_login_date;

      // 가입 날짜가 1900-01-01이므로, 신규 가입자도 무조건 이 조건문을 통과하게 됩니다.
      if (!hasCheckedDailyRef.current && lastLogin !== today) {
        hasCheckedDailyRef.current = true;

        setMsgPopup({
          isOpen: true,
          title: lang === 'ko' ? "일일 접속 보상" : "DAILY GIFT",
          desc: lang === 'ko' ? "공격 아이템 1세트" : "Attack Item Set",
          onConfirm: async () => {
            // 일일 보상: 아이템 +1씩 추가
            await supabase.rpc('update_user_items', {
              target_user_id: userId,
              stop_inc: 1, switch_inc: 1, color_inc: 1, heal_inc: 0
            });

            // 오늘 날짜로 갱신하여 중복 수령 방지
            await supabase.from('profiles').update({ last_login_date: today }).eq('id', userId);
            
            // 최종 데이터 새로고침
            await fetchUserData(userId);
            setMsgPopup(prev => ({ ...prev, isOpen: false, onConfirm: null }));
          }
        });
      }
      

      
      const newName = profile.display_name || 'Player';
      const newCoins = profile.coins || 0;
      setUserNickname(newName);
      setUserCoins(newCoins);
      setLoadCount(profile.load_count || 0);
      setAdFreeUntil(profile.ad_free_until);

      // 💉 DB에서 마지막으로 선택했던 모드 설정을 가져와 상태에 주입합니다.
      if (typeof setSelectedOption === 'function') {
        const savedMode = profile.last_selected_option;
        const validModes = ['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE'];
        
        // 저장된 값이 없거나, 유효한 리스트에 없는 값(예: 'normal')이면 'DRAW MODE' 선택
        if (!savedMode || !validModes.includes(savedMode)) {
          setSelectedOption('DRAW MODE');
        } else {
          setSelectedOption(savedMode);
        }
      }


      if (typeof setIsItemMode === 'function') {
        setIsItemMode(profile.last_is_item_mode ?? false);
      }

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
    const isHit = Math.random() < 0.02; // 2% 확률 (0.02)
    if (!isHit) return null;

    const itemTypes: (keyof UserItems)[] = ['stop', 'switch', 'color', 'heal'];
    const randomIndex = Math.floor(Math.random() * itemTypes.length);
    return itemTypes[randomIndex];
  };



  // ------------------------------------------------------------------
  // 💉 보안 시스템: 독립된 useEffect로 완벽 분리
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
  // 💉 히스토리 제어: 뒤로 가기 제스처 시 의도치 않은 이동 방지
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
            // 💉 로비에서 뒤로 가기 시 새로고침 실행
            console.log("🔄 Lobby swipe detected: Refreshing page...");
            handleLeaveAllRooms();
            window.location.reload();
            break;

          case 'modeSelect':
            // 셀렉트 모드 -> 로비
            setView('lobby');
            break;

          case 'multiplay':
            // 멀티플레이 페이지 -> 셀렉트 모드
            handleLeaveAllRooms();
            setView('modeSelect');
            break;

          case 'waitingRoom':
            // 웨이팅룸 -> 방 퇴장 후 멀티플레이 페이지
            handleLeaveAllRooms();
            setView('multiplay');
            break;

          case 'multiBattle':
            // 멀티 게임 중/결과창 -> 방(waitingRoom)으로 복귀
            // if (currentUserId) fetchUserData(currentUserId);
            // setView('waitingRoom'); 
           
            setView('multiplay');
            handleLeaveAllRooms();

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

    // 💉 [핵심 함수] 실제 시차를 계산하여 로그아웃 여부 판정
    const checkTimeout = () => {
      const now = Date.now();
      const gap = now - lastActivityTimeRef.current;

      if (gap >= LIMIT) {
        console.log(`💤 [보안] ${Math.round(gap / 1000)}초간 활동이 없어 로그아웃됩니다.`);
        handleLogout();
        return true;
      }
      return false;
    };

    const resetTimer = () => {
      // 💉 사용자가 움직이면 현재 시각을 타임스탬프에 박아넣습니다.
      lastActivityTimeRef.current = Date.now(); 

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        checkTimeout(); // 10분 뒤에 시차 체크 실행
      }, LIMIT);
    };

    // 💉 [복귀 감지] 백그라운드(모바일 홈 화면 등)에서 돌아온 순간 실행
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("📱 앱 복귀 감지: 시차를 확인합니다.");
        checkTimeout(); // 돌아온 즉시 "나 없는 동안 10분 지났나?" 확인
      }
    };

    const events = ['mousemove', 'click', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => document.addEventListener(event, resetTimer));
    
    // 💉 브라우저 탭 활성화 상태 변경 이벤트 리스너 추가
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resetTimer(); // 초기 실행

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(event => document.removeEventListener(event, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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


  // 💉 방문자 통계 관리: 중복 방지 로직 포함
  useEffect(() => {
    const handleStats = async () => {
      // 1. 로비 진입 시 유저 ID를 전달하여 중복 체크 로직 실행
      if (view === 'lobby' && isLoggedIn && currentUserId) {
        // 💉 target_user_id 인자를 추가하여 호출합니다.
        await supabase.rpc('increment_visitor', { target_user_id: currentUserId });
      }

      // 2. 최신 통계 가져오기 (기존 코드 유지)
      const { data } = await supabase
        .from('site_stats')
        .select('today_count, total_count')
        .eq('id', 'global')
        .maybeSingle();
        
      if (data) {
        setVisitorStats({ today: data.today_count, total: data.total_count });
      }
    };

    handleStats();
  }, [view, isLoggedIn, currentUserId]); // currentUserId가 생겼을 때도 실행되도록 의존성 추가


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
  


  // 💉 멀티플레이 페이지에서 뒤로가기(스와이프) 시 모드 선택 화면으로 이동
  useEffect(() => {
    if (view === 'multiplay') {
      // 1. 현재 히스토리에 가짜 지점을 하나 밀어넣어 '뒤로가기'가 가능하게 만듭니다.
      window.history.pushState(null, '', window.location.href);

      const handlePopState = () => {
        // 2. 사용자가 스와이프(뒤로가기)를 하면 'modeSelect'로 뷰를 전환합니다.
        setView('modeSelect');
      };

      // 브라우저 뒤로가기 이벤트 감시 시작
      window.addEventListener('popstate', handlePopState);

      return () => {
        // 3. 멀티플레이 페이지를 벗어나면 감시를 중단합니다 (메모리 누수 방지)
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [view, setView]);



  // ------------------------------------------------------------------
  // 💉 새로운 효과음을 위한 Ref 추가
  // ------------------------------------------------------------------
  const tockBufferRef = useRef<AudioBuffer | null>(null);     // 정답 (tock.mp3)
  const whickBufferRef = useRef<AudioBuffer | null>(null);    // 라운드 클리어 (whick.mp3)
  const beepBufferRef = useRef<AudioBuffer | null>(null);     // 게임오버 (beepbeep.mp3)



  // ------------------------------------------------------------------
  // 💉 오디오 컨텍스트 준비 및 파일 사전 로드 (initAudio 업데이트)
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
  // 💉 효과음 재생 유틸리티 함수들 정의
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
    const playIceSound = () => {
    try {
      const audio = new Audio('/sounds/beepbeep.mp3');
      audio.volume = 0.5; // 너무 클 수 있으니 조절
      audio.play().catch(e => console.log("사운드 재생 차단됨:", e));
    } catch (e) {
      console.error("사운드 파일 로드 실패:", e);
    }
  };



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
  // 💉 [카카오 계정 간편 로그인 핸들러 (handleGoogleLogin 아래에 추가)
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
  // 💉 모든 방에서 나가기
  // ------------------------------------------------------------------
  const handleLeaveAllRooms = async () => {
    if (currentUserId) {
      try {
        await supabase
          .from('room_participants')
          .delete()
          .eq('user_id', currentUserId);
        
        console.log("🧹 모든 방에서 퇴장 처리가 완료되었습니다.");
      } catch (e) {
        console.error("방 퇴장 처리 중 오류 발생:", e);
      }
    }
  }



  // ------------------------------------------------------------------
  // 💉 [세션 종료] 로그아웃 및 로컬 캐시 전체 삭제
  // ------------------------------------------------------------------
  const handleLogout = async () => {

    // if (currentRoomId) await leaveCurrentRoom();
    // 💉 현재 유저 ID가 있다면 DB의 모든 참여 목록 삭제
    // if (currentUserId) {
    //   try {
    //     await supabase
    //       .from('room_participants')
    //       .delete()
    //       .eq('user_id', currentUserId);
        
    //     console.log("🧹 모든 방에서 퇴장 처리가 완료되었습니다.");
    //   } catch (e) {
    //     console.error("방 퇴장 처리 중 오류 발생:", e);
    //   }
    // }
    handleLeaveAllRooms(); // 💉 방 퇴장 로직을 별도의 함수로 분리하여 재사용


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
  // 💉 [플레이 로직] 저장된 기록에서 이어하기 (비용 점증 로직 포함)
  // ------------------------------------------------------------------
  const handleLoadGame = async () => {
    if (!currentUserId) return;
    
    // 1. 저장된 데이터 확인
    const { data: save } = await supabase
      .from('game_saves')
      .select('*')
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (!save) {
      setMsgPopup({ 
        isOpen: true, 
        title: "NOTICE", 
        desc: lang === 'ko' ? "저장된 기록이 없습니다." : "NO SAVED DATA" 
      });
      return;
    }

    // 2. 비용 계산 (0, 100, 200...)
    const cost = loadCount * 100;

    if (userCoins < cost) {
      setMsgPopup({ 
        isOpen: true, 
        title: "NOT ENOUGH COINS", 
        desc: lang === 'ko' ? `${cost} 코인이 필요합니다.` : `Need ${cost} Coins` 
      });
      return;
    }

    // 3. 확인 팝업
    setMsgPopup({
      isOpen: true,
      title: t('popup', 'msg_save_load_title'), // 💉 [수정] 전용 타이틀로 변경
      desc: cost === 0 
        ? t('popup', 'msg_save_load_free') 
        : t('popup', 'msg_save_load_cost').replace('{{cost}}', cost.toString()),
      onConfirm: async () => {
        // 코인 차감 및 카운트 증가
        if (cost > 0) {
          await supabase.rpc('add_coins_batch', { row_id: currentUserId, amount: -cost });
          setUserCoins(prev => prev - cost);
        }
        
        // DB 카운트 업데이트
        await supabase.from('profiles').update({ load_count: loadCount + 1 }).eq('id', currentUserId);
        
        // 게임 세팅 및 시작
        setSelectedOption(save.mode);
        setRound(save.round);
        resetGameSession(save.entry_time);
        setView('battle');
        
        // 로컬 데이터 갱신
        fetchUserData(currentUserId);
        setMsgPopup(prev => ({ ...prev, isOpen: false, onConfirm: null }));
      }
    });
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
            ✨ 개발자 코드 입력 팝업 (인증 전 노출)
           ------------------------------------------------------------------ */}


          {/* {!isDevAuthorized && (
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
          )} */}

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
          💉 카카오 로그인 버튼 추가 
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



  return (
    // 💉 메인 앱 화면: 드래그 방지(select-none) 및 모바일 최적화 스타일 추가
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
                  <button onClick={() => { handleLeaveAllRooms(); playClickSound(); setView('settings'); }} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold uppercase">{t('settings', 'language')}</button>
                  <button onClick={() => { handleLeaveAllRooms();  playClickSound(); setView('info'); }} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold uppercase text-zinc-300 hover:text-white">{t('settings', 'game_info')}</button>
                </div>
              )}
            </div>

            {/* 로고 영역 */}
            <h2 className="ml-2 text-2xl font-bold tracking-tighter cursor-pointer uppercase italic leading-none" 
                onClick={() => { handleLeaveAllRooms(); playClickSound(); if(currentRoomId) leaveCurrentRoom(); setView('lobby'); }}>
              <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
            </h2>

            {/* 💉 방문자 통계 영역: 구분선 제거 및 로고 바닥 라인에 맞춤 */}
            <div className="ml-3 pb-0.5 select-none leading-none mt-2">
              <span className="text-[10px] text-zinc-500 font-mono font-bold tracking-tighter">
                {visitorStats.today.toLocaleString()} / {visitorStats.total.toLocaleString()}
              </span>
            </div>
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
     
      <main className={`flex-1 flex flex-col items-center justify-start p-0 min-h-0 h-full pb-10 ${
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


        


        {view === 'lobby' && (
          <div className="w-full max-w-[360px] flex flex-col items-center mt-4 space-y-3 px-4 pb-10">
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
                 <button onClick={() => { handleLeaveAllRooms(); playClickSound(); handleLobbyNavigation('tutorial'); }} className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95">
                   {t('lobby', 'btn_tutorial')}
                 </button>
                 <button onClick={() => { handleLeaveAllRooms(); playClickSound(); handleLobbyNavigation('ranking'); }} className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95">
                   {t('lobby', 'btn_ranking')}
                 </button>
                 <button onClick={() => { handleLeaveAllRooms(); playClickSound(); handleLobbyNavigation('shop'); }} className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95">
                   {t('lobby', 'btn_inventory')}
                 </button>
                 <button onClick={() => { handleLeaveAllRooms(); playClickSound(); handleLobbyNavigation('modeSelect'); }} className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95">
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
          <div className="w-full max-w-[360px] flex flex-col items-center mt-4 gap-3 px-4 pb-15">
            <div className="w-full flex justify-end mb-0">
              <button 
                onClick={() => { handleLeaveAllRooms(); playClickSound(); setView('lobby'); }} // 💉 사운드 추가
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

            <p className="w-full text-left text-base font-black text-[#ffcc33] uppercase ml-1 mt-4">
              {t('modeSelect', 'title_start_with')}
            </p>

            <button 
              onClick={() => { handleLeaveAllRooms(); playClickSound(); resetGameSession(); setView('battle'); }} 
              className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-600 hover:bg-[#3399cc] hover:text-black hover:border-[#3399cc] hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] active:bg-[#3399cc] active:text-black active:border-[#3399cc] active:scale-95"
            >
              {t('modeSelect', 'btn_single')}
            </button>

            <button 
              onClick={() => { handleLeaveAllRooms(); playClickSound(); setView('multiplay'); }} 
              className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-600 hover:bg-[#66cc33] hover:text-black hover:border-[#66cc33] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#66cc33] active:text-black active:border-[#66cc33] active:scale-95"
            >
              {t('modeSelect', 'btn_multi')}
            </button>

            <button 
              onClick={() => { handleLeaveAllRooms(); playClickSound(); handlePlayFromBest(); }} 
              className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-600  hover:bg-[#ff3366] hover:text-black hover:border-[#ff3366] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#ff3366] active:text-black active:border-[#ff3366] active:scale-95"
            >
              {t('modeSelect', 'btn_play_from_best')}
            </button>

            <button 
              onClick={() => { handleLeaveAllRooms(); playClickSound(); handleLoadGame(); }} 
              className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-600 hover:bg-[#ff9933] hover:text-black hover:border-[#ff9933] hover:shadow-[0_0_15px_rgba(255,51,102,0.4)] active:bg-[#ff9933] active:text-black active:scale-95"
            >
              {/* 번역 파일에 btn_play_from_save 키가 없다면 아래 텍스트가 나옵니다. */}
              {t('modeSelect', 'btn_play_from_save')}
            </button>
          </div>
        )}

        {view === 'multiplay' && 
          <MultiplayPage 
          setCurrentRoomMode={setCurrentRoomMode}

          isItemMode={isItemMode}           // 💉 현재 값 전달
          setIsItemMode={setIsItemMode}     // 💉 값을 바꾸는 함수 전달

          selectedMode={selectedOption} 
          onBack={() => { playClickSound(); setView('modeSelect'); }} 

          // 💉 [수술 시작] 기존 한 줄을 아래와 같이 async 블록으로 확장합니다.
          onJoin={async (roomId) => { 
            playClickSound(); 

            // 1. Supabase에서 해당 방의 아이템 모드 여부를 확인합니다.
            const { data: room } = await supabase
              .from('rooms')
              .select('is_item_mode')
              .eq('id', roomId)
              .single();

            if (room) {
              // 2. 방 정보를 바탕으로 현재 모드 저장
              // (App.tsx 상단에 setCurrentRoomMode가 정의되어 있어야 합니다)
              setCurrentRoomMode(room.is_item_mode ? 'item' : 'normal');
            }

            setCurrentRoomId(roomId); 
            setView('waitingRoom'); 
          }}

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
            isItemMatch={currentRoomMode === 'item' || currentRoomMode === 'ITEM'} 
            userItems={userItems || { stop: 0, switch: 0, color: 0, heal: 0 }}
            


            // 💉 아이템 사용 시 실제 차감 로직
            onUseItem={async (itemType) => {
              // 🔍 [디버깅 로그 추가] 현재 인식하고 있는 참가자 명단 확인
              console.log("🛠️ 아이템 발사 시도. 현재 인식된 참가자 수:", participants?.length);
              console.table(participants?.map(p => ({ ID: p.user_id, Round: p.current_round })));

              if (!currentUserId || !currentRoomId || !participants || participants.length < 2) {
                // 💉 참가자가 2명 미만이면 공격 로직을 타지 않도록 되어 있습니다.
                console.warn("⚠️ 공격 중단: 상대방이 명단에 없거나 혼자 있습니다.");
                
                // 만약 힐(Heal) 아이템이라면 혼자여도 작동해야 하므로 분기 처리
                if (itemType === 'heal') {
                  console.log("🩹 힐 아이템은 혼자여도 사용 가능합니다.");
                  // ... 힐 로직 실행
                }
                return; 
              }

              // 1. 즉시 로컬 UI 차감 (취소 불가)
              setUserItems(prev => ({
                ...prev,
                [itemType]: Math.max(0, prev[itemType as keyof UserItems] - 1)
            }));
            
            try {
              // 2. DB 차감 (RPC 호출) 
              const { error: rpcError } = await supabase.rpc('update_user_items', {
                target_user_id: currentUserId,
                stop_inc: itemType === 'stop' ? -1 : 0,
                switch_inc: itemType === 'switch' ? -1 : 0,
                color_inc: itemType === 'color' ? -1 : 0,
                heal_inc: itemType === 'heal' ? -1 : 0
              });

              if (rpcError) throw rpcError;

              // 🔥 [핵심 타겟팅 로직]
              if (itemType !== 'heal') {
                // 1등 찾기 (가장 높은 라운드)
                const sorted = [...participants].sort((a, b) => (b.current_round || 0) - (a.current_round || 0));
                const leaderId = sorted[0]?.user_id;
                const isMeLeader = leaderId === currentUserId;

                console.log(`🎯 타겟 분석 - 내 ID: ${currentUserId}, 1등 ID: ${leaderId}, 나는 1등?: ${isMeLeader}`);

                let query = supabase.from('room_participants').update({ 
                  effect_type: itemType, 
                  effect_at: new Date().toISOString() 
                }).eq('room_id', currentRoomId);

                // 타겟 분기
                if (isMeLeader) {
                  query = query.neq('user_id', currentUserId); // 나 빼고 모두
                  console.log("📢 1등의 광역 공격 발사!");
                } else {
                  query = query.eq('user_id', leaderId); // 1등만 저격
                  console.log(`🎯 추격자의 저격 공격 발사! (대상: ${leaderId})`);
                }

                const { error: updateError, data } = await query.select();
                if (updateError) console.error("📡 DB 업데이트 실패:", updateError);
                else console.log("✅ DB 업데이트 성공 (수정된 행):", data);
              }
            } catch (e) {
              console.error("🏥 아이템 처리 중 오류 발생:", e);
            }
          }}


            playIceSound={playIceSound}
            playClickSound={playClickSound} 
            playBeepSound={playBeepSound}
            onSaveRewards={saveSessionRewards}
            onEarnCoin={() => setSessionCoins(prev => prev + 1)} // 💉 수정: 세션 코인만 증가

            // 💉 멀티플레이 라운드 클리어 시 아이템 주사위 굴리기
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
              await saveSessionRewards(); 
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



        {/* 💉 ShopPage 호출부 수정 */}
        {view === 'shop' && 
          <ShopPage 
            onBack={() => { playClickSound(); setView('lobby'); }} 
            userCoins={userCoins} 
            userItems={userItems} // ✨ [추가] 보유 아이템 정보 전달
            currentUserId={currentUserId} 
            onUpdateCoins={(newAmount) => { 
              setUserCoins(newAmount); 
              localStorage.setItem('cached_coins', newAmount.toString()); 
            }}
            // ✨ [신규] 아이템 구매 처리 함수
            onPurchaseItem={async (type, amount) => {
              if (!currentUserId) return;
              try {
                // DB의 아이템 수량 업데이트 (우리가 만든 RPC 호출)
                await supabase.rpc('update_user_items', {
                  target_user_id: currentUserId,
                  stop_inc: (type === 'all' || type === 'stop') ? amount : 0,
                  switch_inc: (type === 'all' || type === 'switch') ? amount : 0,
                  color_inc: (type === 'all' || type === 'color') ? amount : 0,
                  heal_inc: (type === 'all' || type === 'heal') ? amount : 0
                });

                // 구매 후 최신 유저 데이터 다시 불러오기
                await fetchUserData(currentUserId);
                
                // 팝업창보다는 게임 내 알림 시스템이 있다면 그것을 사용하는 것이 좋지만, 
                // 우선은 동작 확인을 위해 간단한 안내를 띄웁니다.
                console.log(`🎁 ${type} 아이템 ${amount}개 구매 완료!`);
              } catch (e) {
                console.error("구매 처리 중 오류:", e);
              }
            }}
          />
        }


        {view === 'info' && <InfoPage onBack={() => { playClickSound(); setView('lobby'); }} />}
        

        {/* 이용약관 및 개인정보처리방침 공용 렌더링 (코드 중복 방지를 위해 하나의 구조로 처리 가능) */}
        {(view === 'terms' || view === 'privacy') && (
          <div className="w-full max-w-[340px] flex flex-col items-center mt-6 px-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="w-full flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-[#FF9900] italic uppercase tracking-tighter">
                {t('legal', view === 'terms' ? 'terms_title' : 'privacy_title')}
              </h2>
              <button 
                onClick={() => { playClickSound(); setView('lobby'); }}
                className="px-4 py-1 bg-zinc-900 text-white text-[10px] font-black uppercase border border-zinc-800 rounded-[10px] hover:bg-zinc-800 transition-all"
              >
                {t('modeSelect', 'btn_back')}
              </button>
            </div>

            <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-[24px] p-5 h-[50vh] overflow-y-auto custom-scrollbar">
              <p className="text-zinc-400 text-[11px] leading-relaxed whitespace-pre-line font-medium">
                {t('legal', view === 'terms' ? 'terms_content' : 'privacy_content')}
              </p>
            </div>
            
            <p className="mt-4 text-zinc-600 text-[9px] font-bold uppercase tracking-widest italic">
              Last Updated: 2026.02.18
            </p>
          </div>
        )}
              
      </main>



      {/* 💉 [신규] 웹 전용 푸터: 게임 중에는 숨기고, 평소에는 스크롤해야 보임 */}
      {!(view === 'battle' || view === 'multiBattle') && (
        <footer className="w-full py-10 bg-black border-t border-zinc-800 flex flex-col items-center justify-center gap-3 flex-none">
          <div className="max-w-[360px] w-full text-center px-6">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              © 2026 just RPS. All Rights Reserved.
            </p>
            {/* 💉 버튼에 setView 연결 */}
            <div className="flex justify-center gap-6 text-zinc-500 font-bold uppercase tracking-widest mb-4">
              <button onClick={() => { playClickSound(); setView('terms'); }} className="text-[12px] hover:text-white transition-colors">
                {t('footer', 'terms') || 'Terms'}
              </button>
              <button onClick={() => { playClickSound(); setView('privacy'); }} className="text-[12px] hover:text-white transition-colors">
                {t('footer', 'privacy') || 'Privacy'}
              </button>
              <button onClick={() => { playClickSound(); setView('info'); }} className="text-[12px] hover:text-white transition-colors">
                {t('footer', 'contact') || 'Contact'}
              </button>
            </div>
            <p className="text-zinc-500 text-[12px] font-mono tracking-tighter opacity-100">
              Powered by 2H soft
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
            <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-3">
              {msgPopup.title}
            </h3>
            
            {/* 5. 부가 정보: '이어하기'나 '광고' 관련 팝업일 때만 보조 텍스트 출력 */}
            {(msgPopup.title === t('popup', 'msg_continue_title') || msgPopup.title === t('popup', 'msg_ad_start_title')) && (
              <p className="text-base font-bold text-zinc-500 uppercase tracking-tight mb-6">
                {t('popup', 'msg_best_record_info')}
              </p>
            )}

            {/* 💉 [신규] 세이브 로드 팝업일 때만 출력되는 보조 문구 */}
            {msgPopup.title === t('popup', 'msg_save_load_title') && (
              <p className="text-base font-bold text-zinc-500 uppercase tracking-tight mb-6 whitespace-pre-line">
                {t('popup', 'load_game_info')}
              </p>
            )}
            
            {/* 6. 메인 설명(Description) 및 아이콘 */}
            <div className="flex items-center justify-center gap-3 mb-10">
              {/* 조건 1: 최고기록 이어하기 아이콘 */}
              {msgPopup.title === t('popup', 'msg_continue_title') && (
                <img src="/images/coin.png" alt="coin" className="w-6 h-6 object-contain" />
              )}
              
              {/* 조건 2: 세이브 로드인데 유료(무료가 아님)일 때만 아이콘 노출 */}
              {msgPopup.title === t('popup', 'msg_save_load_title') && 
              !msgPopup.desc.includes(t('popup', 'msg_save_load_free')) && (
                <img src="/images/coin.png" alt="coin" className="w-6 h-6 object-contain" />
              )}

              <p className="text-2xl text-zinc-300 font-black italic uppercase tracking-tighter whitespace-pre-line">
                {msgPopup.desc}
              </p>
            </div>

            {/* 7. 하단 버튼 영역: 확인/취소 버튼 배치 */}
            <div className="flex gap-3 w-full">
              
              {/* [왼쪽 버튼]: '확인' 버튼 - 취소 버튼이 필요 없는 팝업에서는 숨깁니다. */}
              {msgPopup.onConfirm && 
              msgPopup.title !== (lang === 'ko' ? "오늘의 출석 보상" : "DAILY GIFT") && (
                <button 
                  onClick={() => { if(canClickPopup) { playClickSound(); msgPopup.onConfirm?.(); } }} 
                  disabled={!canClickPopup}
                  className={`flex-1 h-10 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-600 
                    ${canClickPopup ? "hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900]" : "opacity-50"}`}
                >
                  {t('settings', 'confirm')}
                </button>
              )}
              
              {/* [오른쪽 버튼]: 
                  1. 일반 팝업: '확인' (onConfirm 없음)
                  2. 일일 보상/가입 선물: '확인' (onConfirm 로직을 여기에 직접 연결)
                  3. 선택 팝업: '취소' (onConfirm이 있고 일반 제목인 경우)
              */}
              <button 
                onClick={() => { 
                  if(canClickPopup) { 
                    playClickSound(); 
                    // 💉 수술: 일일 보상 제목일 경우 닫기 버튼이 곧 '수령 확인' 버튼 역할을 수행하게 함
                    if (msgPopup.title === (lang === 'ko' ? "오늘의 출석 보상" : "DAILY GIFT")) {
                      msgPopup.onConfirm?.(); 
                    } else {
                      setMsgPopup(prev => ({ ...prev, isOpen: false, onConfirm: null })); 
                    }
                  } 
                }} 
                disabled={!canClickPopup} 
                className={`flex-1 h-10 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all border border-zinc-600
                  ${(msgPopup.onConfirm && msgPopup.title !== (lang === 'ko' ? "오늘의 출석 보상" : "DAILY GIFT")) 
                    ? "bg-zinc-800 text-white" // 일반 선택 팝업의 경우 '취소' 스타일
                    : "w-full bg-[#FF9900] text-black" // 보상/가입 선물의 경우 '단독 확인' 스타일
                  } 
                  ${canClickPopup ? "hover:opacity-90 active:scale-95" : "opacity-50"}`}
              >
                {/* 제목에 따라 '취소' 대신 '확인' 출력 */}
                {(msgPopup.onConfirm && msgPopup.title !== (lang === 'ko' ? "오늘의 출석 보상" : "DAILY GIFT")) 
                  ? t('settings', 'cancel') 
                  : t('settings', 'confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}