import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import MultiResultModal from './MultiResultModal'; 

interface MultiGameProps {
  roomId: string;
  userNickname: string;
  onSaveRewards: () => Promise<void>;
  playClickSound: () => void;
  playBeepSound: () => void;
  onEarnCoin: () => void;
  onRoundClear: () => void;
  onGameOver: (finalRound: number, totalTime: number) => void;
  onBackToLobby: () => void;
  sessionCoins: number;
  sessionItems: { stop: number; switch: number; color: number; heal: number };
  isItemMatch: boolean; // 💉 아이템전 여부 추가
  userItems: { stop: number; switch: number; color: number; heal: number };
  onUseItem: (itemType: string) => void; // 아이템 사용 서버 전송용
  playIceSound: () => void;
}



export default function MultiGameEngine({ 
  isItemMatch, // 💉 꺼내기
  userItems,
  onUseItem,
  roomId, 
  userNickname, 
  sessionCoins, 
  sessionItems,
  playClickSound, 
  playBeepSound, 
  playIceSound,
  onSaveRewards, 
  onEarnCoin, 
  onRoundClear,
  onGameOver, 
  onBackToLobby 
}: MultiGameProps) {


  // --- 상태 관리 ---
  const [currentRound, setCurrentRound] = useState(1);
  const [playTime, setPlayTime] = useState(0); 
  const [isCleared, setIsCleared] = useState(false); 
  const [isEliminated, setIsEliminated] = useState(false); 
  const [participants, setParticipants] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);

  const [hasAttackedThisRound, setHasAttackedThisRound] = useState(false);
  const [launchedAttackId, setLaunchedAttackId] = useState<string | null>(null);

  // 1. 기존 useState 삭제 또는 주석 처리
  // const [bufferedEffect, setBufferedEffect] = useState<string | null>(null);

  // 2. 💉 최신 값을 실시간으로 담아둘 Ref 생성
  const bufferedEffectRef = useRef<string | null>(null);

  const [isColorActive, setIsColorActive] = useState(false);

  // 칼라 공격 발동 함수
  const triggerColorEffect = () => {
    console.log("🎨 칼라 공격 발동: 문제 색상 제거!");
    setFlashingItem('color'); // 중앙에 itemColor.png 번쩍임
    setIsColorActive(true);   // 칼라 효과 활성화
    
    if (typeof playBeepSound === 'function') playBeepSound();

    setTimeout(() => {
      setFlashingItem(null);
      // 🔥 [핵심 추가] DB의 공격 신호를 삭제하여 무한 루프 방지
      // 이 작업을 안 해주면 라운드가 바뀔 때마다 리스너가 다시 칼라 공격을 감지합니다.
      supabase.from('room_participants')
        .update({ effect_type: null, effect_at: null })
        .eq('user_id', currentUserId)
        .then(({ error }) => {
          if (!error) console.log("✅ 칼라 공격 신호 처리 완료 및 DB 초기화");
        });
    }, 600);
  };


  // 이 코드는 isItemMatch나 userItems 값이 실제로 바뀔 때만 실행됩니다.
  useEffect(() => {
    console.log("✅ [아이템 모드 설정 확인]:", isItemMatch);
    console.log("📦 [현재 인벤토리]:", userItems);
  }, [isItemMatch, userItems]);


  // 1. 공격 상태 관리
  const [isFrozen, setIsFrozen] = useState(false);
  const [flashingItem, setFlashingItem] = useState<string | null>(null);
  const [freezeCount, setFreezeCount] = useState<number>(0);


  // 버튼 순서 상태 추가 (0: scissor, 1: rock, 2: paper)
  const [buttonOrder, setButtonOrder] = useState<number[]>([1, 2, 0]); // 바위, 보, 가위 순서



  useEffect(() => {
    if (!currentUserId || !roomId) return; 

    const channel = supabase.channel(`room_attacks_${roomId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'room_participants',
        filter: `user_id=eq.${currentUserId}` 
      }, (payload) => {
        const { effect_type, effect_at } = payload.new;
        if (effect_at && effect_type) {
          console.log("📥 [최신 공격 수신]:", effect_type);
          // 💉 즉시 Ref에 저장하여 함수들이 바로 읽을 수 있게 합니다.
          bufferedEffectRef.current = effect_type; 
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, currentUserId]);
    


  const triggerSwitchEffect = () => {
    console.log("🌪️ 위치 변경 공격 즉시 발동!");

    setFlashingItem('switch'); // 스위치 아이콘 3회 깜빡임

    // 버튼 순서 즉시 셔플
    setButtonOrder(prev => {
      const newOrder = [...prev];
      for (let i = newOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]];
      }
      return newOrder;
    });

    if (typeof playBeepSound === 'function') playBeepSound();

    setTimeout(() => {
      setFlashingItem(null);
      // 효과 종료 후 DB 초기화 (공통 로직)
      supabase.from('room_participants')
        .update({ effect_type: null, effect_at: null })
        .eq('user_id', currentUserId).then();
    }, 600);
  };
      

  // 💉 5초 멈춤 발동 함수
  const triggerStopEffect = () => {
    console.log("❄️ 5초 멈춤 공격 즉시 발동!"); 

    // 1. 모든 상태를 지연 없이 즉시 업데이트
    setFlashingItem('stop');      // 중앙 아이콘 깜빡임 시작
    setFreezeCount(5.00);        // 빨간색 소수점 카운트다운 즉시 시작 (버튼은 이때 사라짐)
    
    if (typeof playIceSound === 'function') playIceSound();

    // 2. 중앙 아이콘만 연출이 끝난 뒤에 슬쩍 치워줍니다.
    setTimeout(() => {
      setFlashingItem(null); 
    }, 600); 
  };

  // 💉 소수점 타이머 감시자 (10ms 단위 업데이트)
  useEffect(() => {
    if (freezeCount > 0) {
      const timer = setInterval(() => {
        setFreezeCount((prev) => {
          const nextValue = prev - 0.01;
          if (nextValue <= 0) {
            clearInterval(timer);
            // DB 초기화 로직 (기존과 동일)
            supabase.from('room_participants')
              .update({ effect_type: null, effect_at: null })
              .eq('user_id', currentUserId).then();
            return 0;
          }
          return nextValue;
        });
      }, 10); // 0.01초마다 실행
      return () => clearInterval(timer);
    }
  }, [freezeCount, currentUserId]);



  const coinRef = useRef(0);
  


  // 멀티플레이도 '라운드 진입 시간'을 기준으로 기록
  const roundEntryTimeRef = useRef(0);



  // 💉 현재 라운드에서 '사용 예약'한 아이템 상태
  const [pendingAttack, setPendingAttack] = useState<string | null>(null);
  const [pendingHeal, setPendingHeal] = useState(false);



  // 💉 아이템 클릭 시 즉시 서버로 발사하는 로직
  const handleItemClick = (type: string) => {
    // 아이템이 없으면 무시
    if (userItems[type as keyof typeof userItems] <= 0) return;

    // 🚀 공격 아이템(힐 제외)을 썼다면 이번 라운드 공격 완료 처리
    if (type !== 'heal') {
      if (hasAttackedThisRound) return; // 이미 공격했다면 중단
      setHasAttackedThisRound(true);
      setLaunchedAttackId(type); // 🔥 내가 쏜 아이템 ID 기록
    }
    
    // 🚀 [핵심] 즉시 서버 전송 및 차감 
    console.log(`🚀 ${type} 아이템 즉시 발동!`);
    onUseItem(type);

    // 💉 [추가] 시각적으로 어떤 버튼이 눌렸는지 잠시 불이 들어오게 하려면 
    // pendingAttack을 활용하거나 애니메이션을 트리거합니다.
    setPendingAttack(type); 
    setTimeout(() => setPendingAttack(null), 500);

    // 힐(Heal)인 경우 내 로컬에서 추가 연출이 필요하다면 여기에 작성
    if (type === 'heal') {
      // 💉 예: setHp(prev => prev + 1); (필요시)
    }
  };



  // 게임 로직 관련
  const [aiSelect, setAiSelect] = useState<number[]>([]);
  const [targetConditions, setTargetConditions] = useState<string[]>([]);
  const [questionTurn, setQuestionTurn] = useState(0);
  const [isMemoryPhase, setIsMemoryPhase] = useState(true);
  const [solvedIndices, setSolvedIndices] = useState<number[]>([]); 
  const [satisfiedConditions, setSatisfiedConditions] = useState<string[]>([]); 

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const myRoundRef = useRef(1);

  // --- 1. 초기 설정 ---
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      await fetchRoomAndParticipants();
    };
    init();

    const channel = supabase.channel(`multi_game_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, 
        (payload) => { setRoomData(payload.new); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, 
        () => fetchParticipants())
      .subscribe();

    return () => { 
      if (timerRef.current) clearInterval(timerRef.current);
      supabase.removeChannel(channel); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // --- 2. 게임 종료 감지 ---
  useEffect(() => {
    if (!participants || participants.length === 0) return;
    const allFinished = participants.every(p => p.is_dead || p.is_cleared);
    if ((isEliminated || isCleared) && allFinished) {
        if (!showResult) setTimeout(() => setShowResult(true), 1000);
    }
  }, [participants, isEliminated, isCleared, showResult]);


  const fetchRoomAndParticipants = async () => {
    try {
        const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
        if (room) {
            setRoomData(room);
            const safeSeed = room.seed || 1234;
            const safeMode = room.mode || 'WIN MODE';
            
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: me } = await supabase.from('room_participants')
                    .select('*')
                    .eq('room_id', roomId).eq('user_id', user.id).single();
                
                if (me) {
                    const savedRound = me.current_round || 1;
                    myRoundRef.current = savedRound;
                    
                    setPlayTime(me.play_time || 0);
                    // 재접속 시 이전 플레이 타임을 진입 시간으로 복구
                    roundEntryTimeRef.current = me.play_time || 0; 

                    if (me.is_dead) setIsEliminated(true);
                    else startNewRound(savedRound, safeSeed, safeMode, true); 
                } else {
                    startNewRound(1, safeSeed, safeMode);
                }
            }
        }
        await fetchParticipants();
    } catch (e) { console.error(e); } 
    finally { setIsLoading(false); }
  };

  const fetchParticipants = async () => {
    const { data } = await supabase.from('room_participants').select('*, profiles(display_name)').eq('room_id', roomId);
    if (data) setParticipants(data);
  };



  /*  startNewRound 함수 내부 */
  const startNewRound = (newRound: number, seed: number, mode: string, isInitialLoad = false) => {      // 🎨 라운드 시작 시 칼라 효과 초기화 (이전 판 공격 복구)
    // 칼라 효과 초기화
    setIsColorActive(false);

      // 다음 라운드가 시작될 때 뒤섞인 버튼을 다시 [가위, 바위, 보] 순으로 정렬합니다.
      setButtonOrder([1, 2, 0]);

      // 🔥 다음 라운드가 되었으므로 공격 권한 복구!
      setHasAttackedThisRound(false);

      // 🔥 새 라운드 시 기록 초기화
      setLaunchedAttackId(null); 

      // 🔥 Ref의 current 값을 확인하여 시차 없이 공격 발동!
      if (bufferedEffectRef.current === 'color') {
          console.log(`🎨 ${newRound}라운드 전환! 칼라 공격 즉시 발동.`);
          triggerColorEffect();
          bufferedEffectRef.current = null; // 사용 후 비우기
      }
    myRoundRef.current = newRound;
    setCurrentRound(newRound);
    
    // ⏱️ 라운드 시작 시점의 시간을 '진입 시간'으로 저장
    if (newRound === 1) roundEntryTimeRef.current = 0;
    else roundEntryTimeRef.current = playTime;

    const roundSeed = seed + newRound; 
    const seededRandom = (s: number) => () => {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const rng = seededRandom(roundSeed);
    const questionNum = newRound + 2;
    const newAiSelect = Array.from({ length: questionNum }, () => Math.floor(rng() * 3));
    
    const conditions = ['WIN', 'DRAW', 'LOSE'];
    let newConditions: string[] = [];
    const currentMode = mode || 'WIN MODE'; 

    if (currentMode === 'SHUFFLE MODE' || currentMode === 'EXPERT MODE') {
        newConditions = Array.from({ length: questionNum }, () => conditions[Math.floor(rng() * 3)]);
    } else {
        const target = currentMode.split(' ')[0];
        newConditions = Array(questionNum).fill(target);
    }

    setAiSelect(newAiSelect);
    setTargetConditions(newConditions);
    setQuestionTurn(0);
    setSolvedIndices([]);
    setSatisfiedConditions([]);
    setIsMemoryPhase(true);
    setIsCleared(false);
  };

  const getCounts = (list: string[]) => {
    const counts = { WIN: 0, DRAW: 0, LOSE: 0 };
    list.forEach(c => { if (c in counts) counts[c as keyof typeof counts]++; });
    return counts;
  };
  const mode = roomData?.mode || 'WIN MODE';
  const totalTargetCounts = getCounts(targetConditions);
  const currentSolvedCounts = mode === 'SHUFFLE MODE' ? getCounts(satisfiedConditions) : getCounts(targetConditions.slice(0, questionTurn));

  // 타이머
  useEffect(() => {
    if (!isCleared && !isEliminated) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setPlayTime(prev => prev + 0.01);
      }, 10);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isCleared, isEliminated]);

  // 입력 처리
  const handleSelect = async (idx: number) => {
    if (isEliminated || isCleared) return;
    playClickSound();

    let isRoundClear = false;
    let isCorrectAnswer = false;

    if (mode === 'SHUFFLE MODE') {
        let foundMatch = false;
        for (let i = 0; i < aiSelect.length; i++) {
            if (solvedIndices.includes(i)) continue;
            const hand = aiSelect[i];
            const result = idx === hand ? 'DRAW' : ((hand === 0 && idx === 1) || (hand === 1 && idx === 2) || (hand === 2 && idx === 0) ? 'WIN' : 'LOSE');
            
            const needed = totalTargetCounts[result as keyof typeof totalTargetCounts];
            const current = satisfiedConditions.filter(c => c === result).length;

            if (needed > current) {
                isCorrectAnswer = true;
                const newSolvedIndices = [...solvedIndices, i];
                const newSatisfiedConditions = [...satisfiedConditions, result];
                setSolvedIndices(newSolvedIndices);
                setSatisfiedConditions(newSatisfiedConditions);
                foundMatch = true;
                if (newSatisfiedConditions.length === aiSelect.length) isRoundClear = true;
                break;
            }
        }
        if (!foundMatch) { handleElimination("WRONG"); return; }
    } else {
        const aiHand = aiSelect[questionTurn];
        const condition = targetConditions[questionTurn];
        let isCorrect = false;
        if (condition === 'DRAW') isCorrect = idx === aiHand;
        else if (condition === 'WIN') isCorrect = (aiHand === 0 && idx === 1) || (aiHand === 1 && idx === 2) || (aiHand === 2 && idx === 0);
        else if (condition === 'LOSE') isCorrect = (aiHand === 0 && idx === 2) || (aiHand === 1 && idx === 0) || (aiHand === 2 && idx === 1);

        if (isCorrect) {
            isCorrectAnswer = true;
            if (questionTurn + 1 === aiSelect.length) isRoundClear = true;
            else setQuestionTurn(prev => prev + 1);
        } else {
            handleElimination("WRONG"); return;
        }
    }

    if (isCorrectAnswer) {
        coinRef.current += 1;
        onEarnCoin(); 
    }

    if (isRoundClear) {
        setIsCleared(true);
        onRoundClear();

        if (timerRef.current) clearInterval(timerRef.current);
        const nextRound = myRoundRef.current + 1;
        
        // 🔥 [중요] 다음 라운드 DB 저장 시, 시간을 '현재 playTime(==다음라운드 진입시간)'으로 저장
        await updateMyStatus(nextRound, false, playTime, false);
        
        setTimeout(() => {
            startNewRound(nextRound, roomData.seed || 1234, roomData.mode);
        }, 1000); 
    }
  };

  const handleElimination = async (reason: string) => {
    setIsEliminated(true);
    playBeepSound();
    if (timerRef.current) clearInterval(timerRef.current);
    
    // 탈락 기록 저장 로직...
    await updateMyStatus(myRoundRef.current, false, roundEntryTimeRef.current, true); 
    saveRecordToLeaderboard(myRoundRef.current, roundEntryTimeRef.current);
  };

  

  const saveRecordToLeaderboard = async (finalRound: number, time: number) => {
      if (!currentUserId) return;
      try {
          // 1. 기본: 멀티플레이 전적(히스토리) 저장 (기존 코드)
          await supabase.from('game_records').insert({
              user_id: currentUserId,
              round: finalRound,
              play_time: time,
              mode: mode
          });

          // 🔥 [추가] 혼자 플레이했다면(참가자 1명), 싱글 랭킹에도 도전!
          if (participants.length === 1) 
          {
               console.log("혼자 플레이했으므로 싱글 랭킹 갱신 시도...");
             
             // 내 최고 기록 확인
             const { data: record } = await supabase
                .from('mode_records')
                .select('*')
                .eq('user_id', currentUserId)
                .eq('mode', mode)
                .maybeSingle();
             
             // 신기록이면 갱신 (싱글플레이 로직과 동일)
             const isNewRecord = !record || finalRound > record.best_round || (finalRound === record.best_round && time < record.best_time);

             if (isNewRecord) {
                 await supabase.from('mode_records').upsert({ 
                    user_id: currentUserId, 
                    mode: mode, 
                    best_round: finalRound, 
                    best_time: time, 
                    updated_at: new Date().toISOString() 
                 }, { onConflict: 'user_id, mode' });
                 console.log("🎉 멀티 연습게임으로 싱글 랭킹 갱신 완료!");
             }
          } else {
              console.log(`🎮 멀티플레이 종료 (참가자: ${participants.length}명). 공격/수비 전적을 정산합니다.`);
          }

      } catch (err) { console.error("기록 저장 실패:", err); }
  };

  const updateMyStatus = async (round: number, cleared: boolean, time: number, dead: boolean) => {
    if (!currentUserId) return;
    await supabase.from('room_participants')
      .update({ 
          current_round: round, 
          is_cleared: cleared, 
          play_time: time, 
          is_dead: dead,
          earned_coins: coinRef.current 
      })
      .eq('room_id', roomId).eq('user_id', currentUserId);
  };


  const handleBackToRoom = async () => {
    if (!currentUserId || !roomId) return;
    await supabase.from('room_participants')
      .update({ 
        current_round: 1, 
        is_cleared: false, 
        is_dead: false, 
        play_time: 0, 
        earned_coins: 0,
        is_ready: false 
      })
      .eq('room_id', roomId)
      .eq('user_id', currentUserId);

    if (roomData?.creator_id === currentUserId) {
        console.log("🧹 Host resetting room status...");
        await supabase.from('rooms').update({ status: 'waiting', first_cleared_at: null }).eq('id', roomId);
    }
    onGameOver(1, 0); 
  };

  if (isLoading) return <div className="text-white text-center mt-20 animate-pulse">Loading Battle...</div>;



  /* 💉 'OK, I got it' 버튼 클릭 핸들러 */
  const handleStartSolvePhase = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    playClickSound(); 
    
    // 1. 즉시 암기 페이즈 종료 (가위바위보 버튼들이 렌더링될 준비를 함)
    setIsMemoryPhase(false); 

    // 2. 🔥 [핵심 수술] 'OK'를 누른 순간, 대기 중인 공격(Stop, Switch)이 있다면 즉시 발동!
    const pendingEffect = bufferedEffectRef.current;
    
    if (pendingEffect) {
      console.log(`🔥 OK 클릭 시점 공격 기습 발동: ${pendingEffect}`);
      
      if (pendingEffect === 'stop') {
        triggerStopEffect(); // 5초 레드 타이머 작동
      } else if (pendingEffect === 'switch') {
        triggerSwitchEffect(); // 버튼 위치 즉시 셔플
      }
      
      // 💉 발동했으므로 버퍼 비우기 (중복 발동 방지)
      bufferedEffectRef.current = null; 
    }
  };



  // 💉아이템 활성/비활성 판정 로직
  // 1. 공격 아이템: 내가 이번 라운드에 아직 공격하지 않았을 때만 활성
  const canAttack = !hasAttackedThisRound; 
  // 2. 힐 아이템: 현재 실시간으로 공격 효과(Stop/Color)가 발동 중일 때만 활성
  const isUnderAttack = freezeCount > 0 || isColorActive;
  const canHeal = isUnderAttack && userItems.heal > 0;



  return (
    <div className="w-full max-w-[360px] flex flex-col h-[100dvh] justify-start pt-6 pb-10 animate-in fade-in duration-500 overflow-hidden mx-auto">
    
      {/* 1. 헤더 영역 */}
      <div className="w-full flex justify-between items-start flex-none mb-4 px-4">
        {/* [좌측] 로고 및 획득 코인 표시 */}
        <div className="flex flex-col items-start">
          <h2 className="text-3xl font-bold tracking-tighter uppercase italic leading-none">
            <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
          </h2>
          
          {/* 💉 획득 코인이 0보다 클 때만 표시하거나, 항상 표시하여 긴장감 유도 */}
          <div className="flex items-center gap-1.5 mt-2 ml-1 ">
            <img src="/images/coin.png" alt="earned coin" className="w-4 h-4 object-contain" />
            <span className="text-white font-black text-sm font-mono">
              +{sessionCoins}
            </span>
          </div>
        </div>
        
        {/* [우측] 정보 영역 */}
        <div className="text-right flex flex-col items-end pt-0">
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">Round {currentRound}</h2>
          <p className="text-zinc-500 text-[14px] font-mono tracking-tighter mt-1 leading-none">{playTime.toFixed(2)} sec</p>
          
          {roomData?.first_cleared_at && !isCleared && !isEliminated && (
            <div className="text-red-500 text-[10px] font-black uppercase animate-pulse border border-red-500/30 px-2 py-1 rounded w-fit mt-2">Hurry Up!</div>
          )}
        </div>
      </div>

      {/* 2. 플레이어 현황판 - 멀티 전용 (고정 높이) */}
      <div className="w-full bg-zinc-900/50 rounded-3xl p-3 mb-4 flex-none space-y-2 mx-4 w-[calc(100%-32px)]">
        <div className="text-[10px] text-zinc-600 font-bold uppercase mb-2">Other Players</div>
        {participants.filter(p => p.user_id !== currentUserId).map(p => (
          <div key={p.user_id} className="flex justify-between items-center opacity-80">
            <span className={`text-[10px] font-black uppercase flex items-center gap-1 ${p.is_dead ? 'text-zinc-600 line-through decoration-red-500' : 'text-zinc-500'}`}>
              {p.is_dead && "💀"} {p.profiles?.display_name}
            </span>
            <span className={`text-xs font-mono mr-5 font-bold ${p.is_dead ? 'text-red-900' : 'text-white'}`}>
              {p.is_dead ? "FAIL" : `Round ${p.current_round || 1}`}
            </span>
          </div>
        ))}
      </div>



      {/* 3. 💉 문제 영역 확장 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col items-center justify-center min-h-0">
        {(isEliminated || isCleared) ? (
            <div className="text-center animate-in zoom-in py-10">
                {isEliminated && <div className="text-6xl mb-4">💀</div>}
                <h3 className={`text-3xl font-black uppercase italic ${isEliminated ? 'text-zinc-600' : 'text-green-500'}`}>
                    {isEliminated ? "Game over" : "Next Round!"}
                </h3>
                {isEliminated && (
                    <p className="text-zinc-500 text-xs font-bold uppercase mt-2 animate-pulse">
                        Waiting for others to finish...
                    </p>
                )}
            </div>
        ) : (
            <div className="w-full flex flex-col items-center">
                {(mode === 'SHUFFLE MODE' || mode === 'EXPERT MODE') ? (
                    <div className="text-center mb-10 select-none flex-none">
                        <div className="flex justify-center gap-3 text-2xl font-black text-[#FF9900] uppercase italic tracking-tighter">
                            <span>{totalTargetCounts.WIN} WIN</span><span>{totalTargetCounts.DRAW} DRAW</span><span>{totalTargetCounts.LOSE} LOSE</span>
                        </div>
                        <div className="flex justify-center gap-4 text-xl font-bold text-white opacity-80 uppercase tracking-tight mt-1">
                            <span>{currentSolvedCounts.WIN} WIN</span><span>{currentSolvedCounts.DRAW} DRAW</span><span>{currentSolvedCounts.LOSE} LOSE</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center mb-10 flex-none">
                        <p className="text-[#FF9900] text-6xl font-black tracking-tighter uppercase leading-none">{aiSelect.length} {mode.split(' ')[0]}</p>
                        <p className="text-white text-2xl font-bold opacity-80 uppercase tracking-tight mt-1">{questionTurn} {mode.split(' ')[0]}</p>
                    </div>
                )}

                <div className="flex flex-wrap justify-center gap-3 mb-4 w-full">
                    {aiSelect.map((hand, i) => {
                        const isSolved = mode === 'SHUFFLE MODE' ? solvedIndices.includes(i) : i < questionTurn;
                        const isCurrent = (i === questionTurn && !isMemoryPhase);
                        const showDetails = isMemoryPhase || isSolved;
                        
                        return (
                          <div key={i} className="relative flex flex-col items-center">
                              {isCurrent && mode === 'EXPERT MODE' && (
                                <span className="absolute -top-5 text-[9px] font-black text-[#FF9900] animate-pulse">{targetConditions[i]}</span>
                              )}
                              <div className={`w-14 h-14 rounded-2xl transition-all duration-300 bg-zinc-900
                                ${showDetails ? (
                                  hand === 0 ? 'shadow-none' : //[0_0_12px_rgba(236,72,153,0.7)]
                                  hand === 1 ? 'shadow-none' : //[0_0_12px_rgba(34,197,94,0.7)]
                                  'shadow-none') : //[0_0_12px_rgba(34,197,94,0.7)]
                                  isCurrent ? 'border-2 border-[#FF9900] shadow-[0_0_15px_rgba(255,153,0,0.5)] scale-105' : 'shadow-none'
                                  }`}>

                                  {isMemoryPhase ? (
                                    /* 🎨 [핵심 수술] 암기 단계 + 칼라공격 활성 시 _g 파일 호출 */
                                    <img 
                                      src={`/images/${['scissor', 'rock', 'paper'][hand]}${isColorActive ? '_g' : ''}.png`} 
                                      className="w-full h-full object-cover" 
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      {isSolved && (
                                        /* ✅ 정답을 맞춘 뒤 나오는 아이콘은 항상 원래 색상(isColorActive 무시) */
                                        <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-cover opacity-40" />
                                      )}
                                    </div>
                                  )}
                              </div>
                          </div>
                        );
                      })}
                </div>
            </div>
        )}
      </div>


      {/* 💉 아이템전일 때만 나타나는 아이템 버튼 영역 */}
      {isItemMatch && !isCleared && !isEliminated && (
        <div className="w-full px-4 mb-4 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between bg-black/60 backdrop-blur-md p-3 rounded-[24px] border border-white/10 shadow-2xl">
            
            {/* 1. 공격 아이템 그룹 (3종) */}
            <div className="flex gap-3">
              {[
                { id: 'stop', img: 'itemStop3sec.png' },
                { id: 'switch', img: 'itemSwitchBtn.png' },
                { id: 'color', img: 'itemColor.png' }
              ].map((item) => {
                const isLaunched = launchedAttackId === item.id; // 🔥 내가 이번에 쏜 아이템인가?
                const isNoStock = userItems[item.id as keyof typeof userItems] <= 0;
                const isOtherAttackActive = hasAttackedThisRound && !isLaunched; // 다른 공격이 이미 진행 중인가?
                
                // 💉 클릭 불가 조건: 개수 0 OR (이미 공격했는데 내가 쏜 게 아님)
                const isBtnDisabled = isNoStock || (hasAttackedThisRound && !isLaunched);

                return (
                  <button 
                    key={item.id}
                    onClick={() => !hasAttackedThisRound && !isNoStock && handleItemClick(item.id)}
                    disabled={isBtnDisabled}
                    className={`relative p-1 rounded-xl transition-all duration-100 
                      ${isLaunched 
                        ? 'opacity-50 scale-95 shadow-inner' // ✅ 내가 쏜 것: 컬러 유지 + 50% 투명도 + 눌림 효과
                        : (isNoStock || isOtherAttackActive)
                          ? 'grayscale opacity-50 cursor-not-allowed' // ❌ 못 쓰는 것: 회색 + 50% 투명도
                          : 'bg-zinc-800/50 opacity-100 hover:scale-125 active:rotate-12' // ✨ 사용 가능
                      }`}
                  >
                    <img src={`/images/${item.img}`} className="w-12 h-12 object-contain" alt={item.id} />
                    <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[8px] font-black min-w-[15px] h-[15px] rounded-full flex items-center justify-center border border-zinc-900 px-0.5">
                      {userItems[item.id as keyof typeof userItems]}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="w-[1px] h-6 bg-zinc-700 mx-1"></div>

            {/* 2. 치유 아이템 (1종) */}
            <button 
              onClick={() => canHeal && handleItemClick('heal')}
              disabled={!canHeal}
              className={`relative p-1 rounded-xl transition-all duration-200 
                ${!canHeal
                  ? 'grayscale opacity-50 cursor-not-allowed' // 💉 요청하신 50% 투명도 통일
                  : 'bg-green-500/20 opacity-100 hover:scale-125 active:rotate-12 ring-1 ring-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)]'}
                ${pendingHeal ? 'bg-green-500 ring-4 ring-green-400 scale-110' : ''}
              `}
            >
              <img src="/images/itemHeal.png" className="w-12 h-12 object-contain" alt="heal" />
              <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[8px] font-black min-w-[15px] h-[15px] rounded-full flex items-center justify-center border border-zinc-900 px-0.5">
                {userItems.heal}
              </div>
            </button>
          </div>
        </div>
      )}

      

      {/*  💉 하단 버튼영역 */}
      
      <div className="w-full flex justify-center mt-auto flex-none px-4 pb-6 relative z-[20]">
        
        {/* 💉 1. 아이콘 3회 깜빡임 오버레이 (가로 50% 크기) */}
        {flashingItem && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
            <img 
              src={
                flashingItem === 'stop' ? "/images/itemStop3sec.png" : 
                flashingItem === 'switch' ? "/images/itemSwitchBtn.png" : 
                flashingItem === 'color' ? "/images/itemColor.png" : ""
              }
              alt="attack effect"
              className="w-1/2 aspect-square object-contain animate-[flash_0.2s_ease-in-out_3]"
              // 🔍 이미지 로드 실패 시 로그 확인용
              onError={(e) => console.error("❌ 이미지 로드 실패:", flashingItem)}
            />
          </div>
        )}



        {(!isEliminated && !isCleared) ? (
          /* 💉 2. 멈춤 공격 카운트다운 상태일 때 (최우선 순위) */
          freezeCount > 0 ? (
            <div className="flex items-center justify-center h-24">
              <span className="text-7xl font-black text-red-600 italic drop-shadow-[0_0_20px_rgba(220,38,38,0.5)] font-mono">
                {freezeCount.toFixed(2)}
              </span>
            </div>
          ) : (
            /* 💉 3. 정상 상태 (기존 로직 보존) */
            isMemoryPhase ? (
              <button 
                onClick={handleStartSolvePhase} 
                className="w-full h-14 rounded-md font-bold uppercase transition-all text-[#ffcc33] text-4xl font-black italic hover:scale-105 transition-transform animate-pulse cursor-pointer pointer-events-auto"
              >
                OK, I got it
              </button>
            ) : (
              /* 가위바위보 버튼 영역 (60% 너비 유지) */
              <div className="flex gap-3 w-[60%] mb-2">
                {buttonOrder.map((idx) => {
                  // idx 기반 타입 매핑 (기존 handleSelect 로직과 호환)
                  const types = ['scissor', 'rock', 'paper'];
                  const type = types[idx];
                  const value = idx === 1 ? 1 : idx === 2 ? 2 : 0; // rock:1, paper:2, scissor:0

                  return (
                    <button 
                      key={type} 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (freezeCount > 0) return;
                        handleSelect(value);
                      }} 
                      className={`flex-1 aspect-square rounded-3xl active:scale-90 transition-all bg-zinc-900 pointer-events-auto ${
                        type === 'rock' ? 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 
                        type === 'paper' ? 'shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 
                        'shadow-[0_0_15px_rgba(236,72,153,0.5)]'
                      }`}
                    >
                      <img src={`/images/${type}.png`} className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )
          )
        ) : (
          null 
        )}

        {/* 💉 4. 깜빡임 애니메이션 정의 (Tailwind 커스텀 애니메이션 미설정 대비) */}
        <style>{`
          @keyframes flash {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0; transform: scale(1.1); }
          }
        `}</style>
      </div>

      <MultiResultModal 
        isOpen={showResult} 
        roomId={roomId} 
        currentUserId={currentUserId}
        sessionCoins={sessionCoins}     // 💉 App에서 받은 세션 코인 전달
        sessionItems={sessionItems}
        onSaveRewards={onSaveRewards}   // 💉 App에서 받은 저장 함수 전달
        playClickSound={playClickSound} // 💉 App에서 받은 사운드 함수 전달
        onBackToRoom={handleBackToRoom} // 💉 내부 함수 handleBackToRoom 연결
        onBackToLobby={onBackToLobby}   // 💉 App에서 받은 로비 이동 함수 연결
      />
    </div>
  );
}