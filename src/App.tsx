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

  // 인게임 메시지 팝업 상태
  const [msgPopup, setMsgPopup] = useState<{
  isOpen: boolean;
  title: string;
  desc: string;
  onConfirm?: (() => void) | null; // 💉 '?' 추가로 이전 코드들과의 호환성 확보
  }>({ 
    isOpen: false, 
    title: '', 
    desc: '', 
    onConfirm: null 
  });

  // --- 2. 게임 및 뷰 제어 ---
  const [view, setView] = useState<'lobby' | 'modeSelect' | 'battle' | 'settings' | 'ranking' | 'shop' | 'multiplay' | 'waitingRoom' | 'tutorial' | 'multiBattle' | 'info'>('lobby');  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null); 
  const [selectedOption, setSelectedOption] = useState<string>('DRAW MODE');
  const [round, setRound] = useState(1);
  const [gameKey, setGameKey] = useState(Date.now());

// --- 3. 통계 및 설정 ---
  // [통계] 새로고침 시에도 저장된 데이터를 바로 보여주도록 localStorage 값 우선 사용
  const [stats, setStats] = useState({ 
    total_games: parseInt(localStorage.getItem('cached_total_games') || '0'), 
    multi_win_rate: parseInt(localStorage.getItem('cached_win_rate') || '0'), 
    best_rank: parseInt(localStorage.getItem('cached_best_rank') || '0'), 
    best_mode: localStorage.getItem('cached_best_mode') || '' 
  });

  // [복구] 지워진 볼륨 및 음소거 상태 변수 다시 추가
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

  // 🔻 [추가] 전면 광고 제어용 상태
  const [adFreeUntil, setAdFreeUntil] = useState<string | null>(null); // 광고 제거 만료 시간
  const [playCount, setPlayCount] = useState(0); // 게임 판수 카운터
  const [pendingBestRound, setPendingBestRound] = useState<number | null>(null); // 💉 추가

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
// --- [수정] 자가 치유(Self-Healing) 기능이 추가된 데이터 로드 함수 ---
  const fetchUserData = async (userId: string) => {
    console.log(`🚀 [1] fetchUserData 시작 - ID: ${userId}`);
    if (!userId) return;

    try {
      // 1. 프로필 조회 시도 (maybeSingle 사용: 데이터가 없어도 에러 안 내고 null 반환)
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // 2. [자가 치유] 데이터가 없다면? -> 즉시 생성
      if (!profile && !error) {
        console.warn("⚠️ 프로필이 없습니다. 자동으로 생성합니다.");
        
        // 🔻 세션에서 구글 메타데이터 가져오기
        // 1. [fetchUserData 내부] 구글 가입 시 15자 제한
        const { data: { session } } = await supabase.auth.getSession();
        const rawName = session?.user?.user_metadata?.full_name || 'Player';

        // 🔻 [수정] 저장 제한을 15자로 변경
        const MAX_DB_LEN = 15;
        const googleName = rawName.length > MAX_DB_LEN 
          ? rawName.substring(0, MAX_DB_LEN) 
          : rawName;

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ 
            id: userId, 
            display_name: googleName, // 👈 이제 구글 실명이 들어갑니다!
            coins: 0 
          })
          .select()
          .single();
          
        if (!insertError) {
            profile = newProfile;
            console.log(`✅ 프로필 생성 완료! (닉네임: ${googleName})`);

            setMsgPopup({
              isOpen: true,
              title: "WELCOME!",
              desc: `Hi, ${googleName}!\nENJOY JUST RPS!`
            });
        }
      }

      // 3. 여전히 실패했다면 기본값 표시 (Loading... 멈춤 해결)
      if (error || !profile) {
        console.error("❌ 데이터 로드 최종 실패. 기본값 사용.");
        setUserNickname('Unknown');
        setUserCoins(0);
        return;
      }

      console.log("✅ [성공] 데이터 로드 완료:", profile);

      // 4. 상태 업데이트
      const newName = profile.display_name || 'Player';
      const newCoins = profile.coins || 0;
      
      setUserNickname(newName);
      setUserCoins(newCoins);
      setAdFreeUntil(profile.ad_free_until);

      // 🚀 [추가] 브라우저에 데이터 박제 (새로고침 대비)
      localStorage.setItem('cached_nickname', newName);
      localStorage.setItem('cached_coins', newCoins.toString());  

  // 5. 통계 데이터 로드 시도
      const { data: statsData, error: statsError } = await supabase.rpc('get_user_stats', { target_user_id: userId });
      
      if (statsError) {
        console.error("❌ [통계 에러] get_user_stats 함수 에러:", statsError.message);
      } else {
        console.log("✅ [성공] 통계 데이터:", statsData);
        
        const winRate = profile.multi_games > 0 
          ? Math.round((profile.multi_score / profile.multi_games) * 100) 
          : 0;
        
        const newStats = {
          total_games: statsData?.[0]?.total_games || 0,
          multi_win_rate: winRate,
          best_rank: statsData?.[0]?.best_rank || 0,
          best_mode: statsData?.[0]?.best_mode || ''
        };

        setStats(newStats);

        // 🚀 [추가] 통계 데이터도 브라우저에 저장 (새로고침 대비)
        localStorage.setItem('cached_total_games', newStats.total_games.toString());
        localStorage.setItem('cached_win_rate', newStats.multi_win_rate.toString());
        localStorage.setItem('cached_best_rank', newStats.best_rank.toString());
        localStorage.setItem('cached_best_mode', newStats.best_mode);
      };

    } catch (err: any) {
      console.error(err);
    }
  };

 // ... (상단 state 선언부 생략)

  // ------------------------------------------------------------------
  // ✨ [신규] 자동 로그아웃 기능 (10분 미활동 시)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isLoggedIn) return;

    let timer: NodeJS.Timeout;
    const LIMIT = 10 * 60 * 1000; // 10분 (원하는 시간으로 조절 가능)

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.log("💤 장시간 미활동으로 자동 로그아웃됩니다.");
        handleLogout();
      }, LIMIT);
    };

    // 활동 감지 이벤트 등록
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('keydown', resetTimer);
    
    resetTimer(); // 초기화

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [isLoggedIn]); // 로그인 상태일 때만 동작

/// ------------------------------------------------------------------
// 🔥 [수정] 통합된 세션 체크 및 데이터 로드 (중복 제거 버전)
// ------------------------------------------------------------------
useEffect(() => {
  document.title = "just RPS";

  // 1. 방문자 수 업데이트 (앱 실행 시 1회만)
  const handleVisitors = async () => {
    await supabase.rpc('increment_visitor');
    const { data } = await supabase
      .from('site_stats')
      .select('today_count, total_count')
      .eq('id', 'global')
      .maybeSingle();

    if (data) {
      setVisitorStats({ today: data.today_count, total: data.total_count });
    }
  };
  handleVisitors();
  
  // 🔻 [삭제] getSession()을 통한 초기 로드 로직을 삭제합니다.
  // onAuthStateChange가 INITIAL_SESSION 이벤트를 통해 초기 로드까지 처리합니다.

  // 2. [Auth 상태 감지] 컨트롤 타워 수정
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🛠️ Auth Event:", event); 

      if (event === 'SIGNED_OUT' || !session) {
        lastFetchedId.current = null; // 로그아웃 시 초기화
        resetUserState();
      } 
      else if (session?.user) {
        const userId = session.user.id;

        // 유저 ID 상태 업데이트
        if (currentUserId !== userId) {
            setCurrentUserId(userId);
            setIsLoggedIn(true);
        }

        // 🔻 [수술] 중복 호출 방지 가드 실행
        if (lastFetchedId.current === userId) {
          console.log("⏭️ 이미 최신 데이터를 불러왔습니다. 호출을 건너뜁니다.");
          return;
        }

        console.log("📥 데이터 로드를 시작합니다...");
        lastFetchedId.current = userId;
        fetchUserData(userId); // 👈 불필요한 setTimeout은 제거해도 안전합니다.
      }
    });

  return () => { subscription.unsubscribe(); };
}, []);




  const handleSaveNickname = async (newNickname: string) => {
    if (!currentUserId) return;
    
    // 🔻 15자 초과 시 중단 (인게임 알림 로직은 추후 통합)
    if (newNickname.length > 15) {
      console.warn("닉네임은 최대 15자까지 가능합니다.");
      return;
    }

    const { error } = await supabase.from('profiles').update({ display_name: newNickname }).eq('id', currentUserId);
    if (!error) { 
      setUserNickname(newNickname); 
      // 🔻 닉네임 변경 성공 팝업
      setMsgPopup({
        isOpen: true,
        title: "NICKNAME UPDATED!",
        desc: `"${newNickname}"`
      });
    }
  };

// ---  초심자용 심플 로그인/회원가입 (역할 완전 분리) ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUpMode) {
        // [A] 회원가입 모드: "계정 만들고 -> 데이터 넣고 -> 끝"
        console.log("📝 회원가입 시도:", email);

        // 1. 계정 생성
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: username } }
        });
        if (error) throw error;

        // 2. 프로필 데이터 생성 (가입 시 1회 필수)
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            display_name: username,
            coins: 0
          });
        }

        // 가입 축하 메세지
        setMsgPopup({
          isOpen: true,
          title: "WELCOME!",
          desc: "PLEASE SIGN IN TO START!"
        });
        setIsSignUpMode(false); // 로그인 화면으로 자동 전환

      } else {
        // [B] 로그인 모드: "로그인 하고 -> 프로필 없으면 만들고 -> 끝"
        console.log("🔑 로그인 시도:", email);

        // 1. 로그인 요청
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;

        // 2. (안전장치) 프로필 없는 유령회원 방지
        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!profile) {
            console.warn("⚠️ 프로필이 없어서 자동 생성합니다.");
            await supabase.from('profiles').insert({
              id: data.user.id,
              display_name: 'Player', // 닉네임 몰라서 기본값
              coins: 0
            });
          }
        }
        
        // 성공하면 useEffect가 감지해서 자동으로 로비로 넘어감
      }
    } catch (err: any) {
      console.error("❌ 인증 에러:", err.message);
      alert("오류: " + err.message);
    } finally {
      setLoading(false);
    }
  };


  // ------------------------------------------------------------------
  // 🔄 [신규] 브라우저 뒤로 가기 인터셉트 (App-like Navigation)
  // ------------------------------------------------------------------
  useEffect(() => {
    // 1. 현재 뷰가 바뀔 때마다 브라우저 히스토리에 상태를 밀어넣습니다.
    // 로비(lobby)가 아닐 때만 히스토리를 쌓아서, 로비에서는 뒤로 가기 시 실제 종료되도록 유도할 수도 있습니다.
    if (view !== 'lobby') {
      window.history.pushState({ view }, '', '');
    } else {
      // 로비일 때는 히스토리를 초기화하거나 메인 상태를 유지합니다.
      window.history.replaceState({ view: 'lobby' }, '', '');
    }

    // 2. 사용자가 '뒤로 가기'를 눌렀을 때 실행될 함수
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        console.log("⬅️ 뒤로 가기 감지: ", event.state.view);
        setView(event.state.view); // 기록된 이전 뷰로 강제 이동
      } else {
        // 기록된 상태가 없으면 로비로 보냅니다.
        setView('lobby');
      }
    };

    // 3. 이벤트 리스너 등록
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [view]); // view가 바뀔 때마다 히스토리에 박제
  


  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin, queryParams: { access_type: 'offline', prompt: 'consent' } },
      });
    } catch (error: any) { console.error("Google Login Error:", error.message); }
  };


// --- [수정] 강력한 로그아웃 (멈춤 현상 해결) ---
  const handleLogout = () => {
    console.log("🚪 로그아웃 버튼 클릭됨!"); // 이 로그가 찍혀야 함

    // 1. 브라우저 저장소(캐시) 싹 비우기
    localStorage.clear();

    // 2. 서버에 로그아웃 요청 던지기 (응답 기다리지 않음: await 제거)
    // 서버가 죽었든 살았든 우리는 신경 쓰지 않고 나갑니다.
    supabase.auth.signOut().catch(err => console.warn("로그아웃 에러(무시):", err));

    // 3. UI 즉시 초기화
    resetUserState();

    // 4. 0.1초 뒤 강제 새로고침 (가장 확실한 방법)
    setTimeout(() => {
      console.log("🔄 브라우저 새로고침 실행");
      window.location.reload();
    }, 100);
  };

  // ------------------------------------------------------------------
  // ✨ [신규] 로비 이동 전 세션 생존 확인 (좀비 세션 방지)
  // 플레이나 랭킹 버튼을 누를 때, 실제 로그인이 유지되고 있는지 검사합니다.
  // ------------------------------------------------------------------
  const handleLobbyNavigation = async (targetView: 'modeSelect' | 'ranking' | 'shop' | 'tutorial') => {
    // 1. Supabase 서버에 "나 진짜 로그인 맞아?" 하고 물어봄
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // 2. 세션이 죽어있다면 -> 즉시 쫓아냄
      alert("세션이 만료되었습니다. 다시 로그인해 주세요.");
      handleLogout(); // 강제 로그아웃 및 새로고침 실행
      return;
    }

    // 3. 세션이 살아있으면 -> 정상적으로 이동
    if (targetView === 'modeSelect') {
      resetGameSession(); // 게임 시작 전 상태 초기화
    }
    setView(targetView);
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


  // 🔥 [신규] 전면 광고 실행 로직 (100시간 혜택 체크)
  const showInterstitialAd = () => {
    if (adFreeUntil) {
      const now = new Date();
      const expiryDate = new Date(adFreeUntil);

      if (now < expiryDate) {
        console.log("💎 100시간 광고 제거 혜택 적용 중입니다. 광고를 건너뜁니다.");
        return; 
      }
    }

    // 혜택이 없으면 광고 호출
    console.log("🎬 전면 광고(Interstitial Ad)를 호출합니다.");
    // 실제 광고 API 연동 시 이 아래에 코드를 작성합니다.
  };

  const handleGameOver = async (finalRound: number, entryTime: number) => {
    console.log(`🏁 Game Over Report: Round ${finalRound}, Time ${entryTime}`);

    // 1. UI 표시 (DB 저장 여부와 상관없이 즉시 뜸)
    setResultData({ 
      round: finalRound, 
      time: entryTime, 
      coins: sessionCoins, 
      isNewRecord: false 
    });
    setRound(finalRound); 
    setShowResultModal(true); 

    if (!currentUserId) {
        console.error("❌ 오류: 로그인 정보가 없어 기록을 저장할 수 없습니다.");
        return;
    }

    try {
      // 2. 내 최고 기록 가져오기
      const { data: record, error: fetchError } = await supabase
        .from('mode_records')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('mode', selectedOption)
        .maybeSingle();

      if (fetchError) {
          console.error("❌ 기존 기록 조회 실패 (DB 권한 확인 필요):", fetchError.message);
          throw fetchError;
      }

      // 3. 신기록인지 판별
      // 기록이 아예 없거나( !record ) 
      // 라운드가 더 높거나 ( finalRound > record.best_round )
      // 라운드는 같은데 시간이 더 짧으면 ( ... && entryTime < record.best_time )
      const isNewRecord = !record || finalRound > record.best_round || (finalRound === record.best_round && entryTime < record.best_time);

      console.log(`📊 기록 판독: 기존 ${record?.best_round || 0}R vs 현재 ${finalRound}R -> 신기록? ${isNewRecord}`);

      if (isNewRecord) {
        setResultData(prev => ({ ...prev, isNewRecord: true }));
        
        // 4. DB에 저장 (Upsert)
        const { error: upsertError } = await supabase.from('mode_records').upsert({ 
          user_id: currentUserId, 
          mode: selectedOption, 
          best_round: finalRound, 
          best_time: entryTime, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'user_id, mode' });

        if (upsertError) {
            console.error("❌ DB 저장 실패 (RLS 정책 확인):", upsertError.message);
        } else {
            console.log("✅ 신기록 DB 저장 완료!");
        }
      }

      // 5. 로그 및 코인 저장
      await supabase.from('game_logs').insert({ 
          user_id: currentUserId, 
          mode: selectedOption, 
          reached_round: finalRound, 
          play_time: entryTime 
      });
      
      if (sessionCoins > 0) {
          await supabase.rpc('add_coins_batch', { row_id: currentUserId, amount: sessionCoins });
      }
      
      fetchUserData(currentUserId);

    } catch (err) {
      console.error("🔥 치명적 에러:", err);
    } finally {
      // 🔻 [추가] 3판마다 전면 광고 실행 로직
      const newPlayCount = playCount + 1;
      setPlayCount(newPlayCount);

      if (newPlayCount >= 3) {
        showInterstitialAd();
        setPlayCount(0); // 카운트 초기화
      }
    }
  };


  // 최고 기록 시작 버튼 핸들러
  const handlePlayFromBest = async () => {
    if (!currentUserId) return;

    // 1. DB에서 해당 모드의 최고 기록 가져오기
    const { data: record } = await supabase
      .from('mode_records')
      .select('best_round')
      .eq('user_id', currentUserId)
      .eq('mode', selectedOption)
      .maybeSingle();

    const bestRound = record?.best_round || 1;

    if (userCoins >= 100) {
      setMsgPopup({
        isOpen: true,
        title: "CONTINUE?",
        desc: "-100",
        onConfirm: async () => {
          // 💸 코인 차감 (RPC 호출)
          await supabase.rpc('add_coins_batch', { row_id: currentUserId, amount: -100 });
          setUserCoins(prev => prev - 100);
          
          // 🎮 게임 시작
          setRound(bestRound);
          resetGameSession(); // 세션 초기화 (코인 등)
          setRound(bestRound); // 초기화 후 라운드 재설정
          setView('battle');
          setMsgPopup(prev => ({ ...prev, isOpen: false, onConfirm: null }));
        }
      });
    } else {
      setMsgPopup({
        isOpen: true,
        title: "AD START?",
        desc: "WATCH AD",
        onConfirm: () => {
          setPendingBestRound(bestRound);
          // 광고 시청 후 성공 시 bestRound로 시작하게 연결
          setShowAdOverlay(true); 
          setMsgPopup(prev => ({ ...prev, isOpen: false, onConfirm: null }));
        }
      });
    }
  };

  // 광고 보고 이어하기 처리
  const handleAdContinueSuccess = () => {
    setShowAdOverlay(false);

    // 💉 [추가] 최고 기록에서 시작하는 케이스 처리
    if (pendingBestRound !== null) {
      resetGameSession(); 
      setRound(pendingBestRound); // 🎯 저장된 최고 라운드로 세팅
      setPendingBestRound(null);   // 사용 후 초기화
      setView('battle');
      return;
    }

    // 기존 로직: 게임 오버 후 부활 케이스
    setContinueCount(prev => prev - 1);
    setShowResultModal(false);
  };


  // ------------------------------------------------------------------
  // 🔥 [화면 분기] isLoggedIn이 false면 로그인 화면을 리턴
  // resetUserState()가 호출되면 isLoggedIn이 false가 되어 이 화면이 보여야 함
  // ------------------------------------------------------------------
// ------------------------------------------------------------------
  // 🔥 [화면 분기] isLoggedIn이 false면 로그인 화면을 리턴
  // ------------------------------------------------------------------
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-[320px]">
          
          {/* 🔻 [수정] 로그인 화면용 큰 로고 (5xl + 중앙정렬 + 색상적용) */}
          <h1 className="text-5xl font-black mb-8 text-center italic tracking-tighter uppercase">
            <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
          </h1>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />
            {isSignUpMode && <input type="text" placeholder="Nickname" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />}
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white outline-none font-bold" required />
            <button type="submit" className="w-full h-14 bg-[#FF9900] text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all shadow-[0_5px_15px_rgba(255,153,0,0.3)]">
              {loading ? 'Wait...' : (isSignUpMode ? 'Join Session' : 'LOG IN')}
            </button>
          </form>

          <div className="flex items-center gap-2 my-4">
             <div className="h-[1px] bg-zinc-800 flex-1"></div>
             <span className="text-base text-zinc-600 font-bold uppercase">or</span>
             <div className="h-[1px] bg-zinc-800 flex-1"></div>
          </div>

          <button type="button" onClick={handleGoogleLogin} className="w-full h-14 bg-white text-black font-black text-lg rounded-xl uppercase active:scale-95 transition-all flex items-center justify-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M23.52 12.29C23.52 11.43 23.45 10.61 23.31 9.82H12V14.45H18.45C18.17 15.93 17.31 17.18 16.03 18.04V21.03H19.9C22.16 18.95 23.52 15.89 23.52 12.29Z" fill="#4285F4"/><path d="M12 24C15.24 24 17.96 22.92 19.9 21.03L16.03 18.04C14.95 18.76 13.58 19.18 12 19.18C8.88 19.18 6.23 17.07 5.29 14.25H1.31V17.34C3.26 21.21 7.29 24 12 24Z" fill="#34A853"/><path d="M5.29 14.25C5.05 13.53 4.92 12.77 4.92 12C4.92 11.23 5.05 10.47 5.29 9.75V6.66H1.31C0.47 8.33 0 10.11 0 12C0 13.89 0.47 15.67 1.31 17.34L5.29 14.25Z" fill="#FBBC05"/><path d="M12 4.82C13.76 4.82 15.34 5.43 16.58 6.61L20.01 3.17C17.95 1.25 15.24 0 12 0C7.29 0 3.26 2.79 1.31 6.66L5.29 9.75C6.23 6.93 8.88 4.82 12 4.82Z" fill="#EA4335"/></svg>
            Sign in with Google
          </button>
          
          <button type="button" onClick={() => setIsSignUpMode(!isSignUpMode)} className="w-full text-base text-zinc-500 text-center underline font-bold mt-4 uppercase">
            {isSignUpMode ? "Back to Login" : "Create Account"}
          </button>
        </div>
      </div>
    );
  }

  // --- 로그인 후 메인 화면 ---
  return (
    // 🔻 [수정] 배경 클릭 시 두 메뉴가 모두 닫히도록 최상단 div에 핸들러 유지
    <div className="min-h-screen bg-black text-white flex flex-col font-sans" onClick={() => { setIsUserMenuOpen(false); setIsSettingsMenuOpen(false); }}>
      <header className="w-full p-6 flex justify-between items-center border-b border-zinc-800 bg-black sticky top-0 z-50">
        
        {/* [좌측] 로고 및 시스템 설정 영역 */}
        <div className="flex items-center gap-1">
          <h2 className="text-2xl font-bold tracking-tighter cursor-pointer uppercase italic" onClick={() => setView('lobby')}>
            <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
          </h2>

          {/* ⚙️ [수정] 기어 아이콘: Settings와 Game Info 담당 */}
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

            {/* 📍 시스템 메뉴 (기어 클릭 시) */}
            {isSettingsMenuOpen && (
              <div className="absolute right-0 mt-3 w-26 bg-zinc-900 border border-zinc-800 rounded-lg py-0 z-[100] shadow-2xl">
                <button onClick={() => setView('settings')} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold uppercase">Settings</button>
                <button onClick={() => setView('info')} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 font-bold uppercase text-zinc-300 hover:text-white">Game Info</button>
              </div>
            )}
          </div>
        </div>

        {/* [우측] 계정 및 재화 영역 */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setIsUserMenuOpen(!isUserMenuOpen); }} className="font-bold text-sm tracking-tight text-zinc-300 hover:text-white transition-colors">
              {userNickname.length > 10 ? userNickname.substring(0, 10) + '...' : userNickname} 
              <span className="text-[10px] opacity-50 ml-1"></span>
            </button>

            {/* 📍 계정 메뉴 (닉네임 클릭 시: 로그아웃만 유지) */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-21 bg-zinc-900 border border-zinc-800 rounded-lg py-0 z-[100] shadow-2xl">
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-xs text-red-500 font-bold hover:bg-zinc-800 uppercase">Logout</button>
              </div>
            )}
          </div>

          {/* 코인 영역 (배경/테두리 삭제됨) */}
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
          <div className="w-full max-w-[320px] flex flex-col items-center mt-16 space-y-3 px-4">
             <div className="flex gap-3 mb-12">{['rock', 'paper', 'scissor'].map(img => <div key={img} className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl"><img src={`/images/${img}.png`} className="w-full h-full object-cover" /></div>)}</div>

             <div className="w-full flex flex-col gap-3">
                 <button 
                   onClick={() => handleLobbyNavigation('modeSelect')} 
                   /* 🔻 [수정] active:bg-[#FF9900] 등 active 속성 추가 (모바일 터치 대응) */
                   className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                 >
                   Play
                 </button>
                 
                 <button 
                   onClick={() => handleLobbyNavigation('shop')} 
                   className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                 >
                   Shop
                 </button>
                 
                 <button 
                   onClick={() => handleLobbyNavigation('ranking')} 
                   className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                 >
                   Rank Board
                 </button>
                 
                 <button 
                   onClick={() => handleLobbyNavigation('tutorial')} 
                   className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                 >
                   Tutorial
                 </button>
             </div>

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


      {/* 플레이 선택 뷰 */}
      {view === 'modeSelect' && (
        <div className="w-full max-w-[360px] flex flex-col items-center mt-4 gap-3 px-4">
          

          <div className="w-full flex justify-end mb-0">
            <button 
              onClick={() => setView('lobby')} 
              className="px-4 py-1 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl hover:bg-zinc-700 active:scale-95 transition-all border border-zinc-700"
            >
              back
            </button>
          </div>

          {/* 💉 [추가] 모드 선택 섹션 타이틀 */}
          <p className="w-full text-left text-base font-black text-[#ffcc33] uppercase ml-1">select mode</p>

          <div className="flex flex-col gap-3 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 w-full mt-0">
            {['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE'].map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer text-[14px] font-bold">
                <input type="radio" checked={selectedOption === opt} onChange={() => setSelectedOption(opt)} className="accent-[#FF9900]" />
                <span className={selectedOption === opt ? 'text-[#FF9900]' : 'text-zinc-500'}>{opt}</span>
              </label>
            ))}
          </div>

          {/* 💉 [추가] 플레이 방식 선택 섹션 타이틀 */}
          <p className="w-full text-left text-base font-black text-[#ffcc33] uppercase ml-1 mt-4">start with</p>

          {/* 기존 플레이 버튼들 */}
          <button onClick={() => { resetGameSession(); setView('battle'); }} className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#3399cc] hover:text-black hover:border-[#3399cc] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#3399cc] active:text-black active:border-[#3399cc] active:scale-95">Single Play</button>
          
          <button onClick={() => setView('multiplay')} className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#66cc33] hover:text-black hover:border-[#66cc33] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#66cc33] active:text-black active:border-[#66cc33] active:scale-95">Multi Play</button>
          
          <button 
            onClick={handlePlayFromBest} 
            className="w-full h-14 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#ff3366] hover:text-black hover:border-[#ff3366] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#ff3366] active:text-black active:border-[#ff3366] active:scale-95"
          >
            Play from Best
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
            roomId={currentRoomId} 
            userNickname={userNickname} 
            playClickSound={playClickSound}
            // 코인 획득 시 헤더 업데이트
            onEarnCoin={() => setUserCoins(prev => prev + 1)} 
            
            // 🔥 [수정 1] "Back to Room" 클릭 시 -> 대기실(waitingRoom)로 이동!
            onGameOver={() => { 
                if (currentUserId) fetchUserData(currentUserId); 
                setView('waitingRoom'); // 방 번호(currentRoomId)는 유지됨
            }}
            
            // 🔥 [수정 2] "To Lobby" 클릭 시 -> 메인 로비로 이동 (방 번호 삭제)
            onBackToLobby={() => { 
                if (currentUserId) fetchUserData(currentUserId);
                setCurrentRoomId(null); // 방에서 완전히 나감
                setView('lobby'); 
            }}
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
        
        {view === 'ranking' && (
          <RankingPage 
            onBack={() => setView('lobby')} 
            playClickSound={playClickSound}
            userNickname={userNickname}
          />
        )}

        {view === 'shop' && (
          <ShopPage 
            onBack={() => setView('lobby')}
            userCoins={userCoins}
            currentUserId={currentUserId}
            onUpdateCoins={(newAmount) => {
               setUserCoins(newAmount);
               // 로컬 스토리지도 동기화
               localStorage.setItem('cached_coins', newAmount.toString());
            }}
          />
        )}      </main>

      {/* 🔥 [추가] 광고 오버레이 (결과창 위에서 뜸) */}
      <AdOverlay 
        isOpen={showAdOverlay} 
        onClose={() => {
          setShowAdOverlay(false);
          setPendingBestRound(null); // 💉 예약 정보 삭제
        }} 
        onReward={handleAdContinueSuccess} 
      />

      {/* 결과 모달 */}
      <ResultModal 
        isOpen={showResultModal} mode={selectedOption} round={resultData.round} time={resultData.time} earnedCoins={resultData.coins} 
        userCoins={userCoins} isNewRecord={resultData.isNewRecord} continueCount={continueCount} continueCost={CONTINUE_COST} 
        onContinue={() => { if(userCoins >= CONTINUE_COST) { setUserCoins(c => c - CONTINUE_COST); setContinueCount(prev => prev - 1); setShowResultModal(false); } }} 
        onRetry={() => { setShowResultModal(false); resetGameSession(); setView('battle'); }} 
        onLobby={() => { setShowResultModal(false); resetGameSession(); setView('lobby'); }} 
        onShop={() => { setShowResultModal(false); setView('shop'); }} 
        onWatchAd={() => setShowAdOverlay(true)}
      />


      {/* 인게임 메시지 팝업 (Common Message Popup) */}
      {msgPopup.isOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[280px] bg-zinc-900 border-2 border-[#FF9900] rounded-[40px] p-8 flex flex-col items-center text-center shadow-[0_0_50px_rgba(255,153,0,0.2)] animate-in zoom-in-95 duration-200">
            
            {/* 타이틀 */}
            <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-1">{msgPopup.title}</h3>
            
            {/* 💉 [추가] 무엇을 시작하는지 설명하는 서브 텍스트 */}
            {(msgPopup.title === "CONTINUE?" || msgPopup.title === "AD START?") && (
              <p className="text-base font-bold text-zinc-500 uppercase tracking-tight mb-6">
                start from best record
              </p>
            )}
            

            {/* 설명 및 코인 영역 */}
            <div className="flex items-center justify-center gap-3 mb-10">
              {msgPopup.title === "CONTINUE?" && (
                <img src="/images/coin.png" alt="coin" className="w-6 h-6 object-contain" />
              )}
              <p className="text-2xl text-white font-black italic uppercase tracking-tighter">
                {msgPopup.desc}
              </p>
            </div>
            
            {/* 버튼 영역 */}
            <div className="flex gap-3 w-full">
              {msgPopup.onConfirm && (
                <button 
                  onClick={() => msgPopup.onConfirm?.()}
                  className="flex-1 h-12 rounded-2xl font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                >
                  OK
                </button>
              )}
              <button 
                onClick={() => setMsgPopup(prev => ({ ...prev, isOpen: false, onConfirm: null }))}
                className={`h-12 font-bold text-lg rounded-2xl uppercase active:scale-95 transition-all ${
                  msgPopup.onConfirm 
                    ? "flex-1 bg-zinc-900 text-white hover:bg-[#FF9900] hover:text-black" 
                    : "w-full bg-[#FF9900] text-black hover:bg-[#FF9900]"
                }`}
              >
                {msgPopup.onConfirm ? "CANCEL" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}