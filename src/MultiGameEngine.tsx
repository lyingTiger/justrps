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
  onSaveRewards, 
  onEarnCoin, 
  onRoundClear,
  onGameOver, 
  onBackToLobby 
}: MultiGameProps) {

  // 🔍 [디버깅용 로그] 콘솔창(F12)에서 이 값이 true인지 확인해 보세요.
  console.log("아이템전 여부:", isItemMatch);
  console.log("보유 아이템:", userItems);

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

  const coinRef = useRef(0);
  
  // 멀티플레이도 '라운드 진입 시간'을 기준으로 기록
  const roundEntryTimeRef = useRef(0);

  // 💉 현재 라운드에서 '사용 예약'한 아이템 상태
  const [pendingAttack, setPendingAttack] = useState<string | null>(null);
  const [pendingHeal, setPendingHeal] = useState(false);

  // 아이템 클릭 핸들러
  const handleItemClick = (type: string) => {
    if (userItems[type as keyof typeof userItems] <= 0) return;
    
    if (type === 'heal') {
      setPendingHeal(!pendingHeal);
    } else {
      // 공격 아이템은 하나만 선택 가능 (토글)
      setPendingAttack(prev => prev === type ? null : type);
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

  const startNewRound = (newRound: number, seed: number, mode: string, isInitialLoad = false) => {
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
          // if (participants.length === 1) 
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



      {/* 3. 💉 [수정] 문제 영역 확장 */}
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
                            <div className={`w-14 h-14 rounded-2xl  transition-all duration-300 bg-zinc-900 ${showDetails ? (hand === 0 ? 'shadow-[0_0_12px_rgba(236,72,153,0.7)]' : hand === 1 ? 'shadow-[0_0_12px_rgba(59,130,246,0.7)]' : 'shadow-[0_0_12px_rgba(34,197,94,0.7)]') : isCurrent ? 'border-2 border-[#FF9900] shadow-[0_0_15px_rgba(255,153,0,0.5)] scale-105' : 'shadow-none'}`}>
                                {isMemoryPhase ? <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">{isSolved && <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-cover opacity-40" />}</div>}
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
                ].map((item) => (
                  <button 
                    key={item.id}
                    disabled={pendingAttack !== null && pendingAttack !== item.id} // 하나 선택 시 나머지 비활성화
                    onClick={() => handleItemClick(item.id)}
                    className={`relative p-1 rounded-xl transition-all duration-200 
                      ${pendingAttack === item.id ? 'bg-[#FF9900] ring-2 ring-[#FF9900] scale-110 shadow-[0_0_15px_rgba(255,153,0,0.5)]' : 'bg-zinc-800/50 opacity-50'}
                      ${userItems[item.id as keyof typeof userItems] <= 0 ? 'grayscale opacity-20 pointer-events-none' : 'hover:opacity-100'}
                    `}
                  >
                    <img src={`/images/${item.img}`} className="w-8 h-8 object-contain" alt={item.id} />
                    <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[8px] font-black min-w-[15px] h-[15px] rounded-full flex items-center justify-center border border-zinc-900 px-0.5">
                      {userItems[item.id as keyof typeof userItems]}
                    </div>
                  </button>
                ))}
              </div>

              {/* 구분선 */}
              <div className="w-[1px] h-6 bg-zinc-700 mx-1"></div>

              {/* 2. 치유 아이템 (1종) */}
              <button 
                onClick={() => handleItemClick('heal')}
                className={`relative p-1 rounded-xl transition-all duration-200 
                  ${pendingHeal ? 'bg-green-500 ring-2 ring-green-500 scale-110 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-zinc-800/50 opacity-50'}
                  ${userItems.heal <= 0 ? 'grayscale opacity-20 pointer-events-none' : 'hover:opacity-100'}
                `}
              >
                <img src="/images/itemHeal.png" className="w-8 h-8 object-contain" alt="heal" />
                <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[8px] font-black min-w-[15px] h-[15px] rounded-full flex items-center justify-center border border-zinc-900 px-0.5">
                  {userItems.heal}
                </div>
              </button>
            </div>
          </div>
        )}



      {/* 4. 💉 [수정] 하단 버튼 영역: z-index와 pointer-events 확인 */}
      <div className="w-full flex justify-center mt-auto flex-none px-4 pb-6 relative z-[20]">
       
        {/* 💉 [수정] 첫 번째 3항 연산자의 끝에 반드시 ': null' 혹은 다른 UI가 있어야 합니다. */}
        {(!isEliminated && !isCleared) ? (
          isMemoryPhase ? (
            <button 
              onClick={(e) => { 
                e.stopPropagation(); // App.tsx 클릭 이벤트 간섭 방지
                playClickSound(); 
                setIsMemoryPhase(false); 
              }} 
              /* 💉 pointer-events-auto를 추가하여 클릭 가능 상태 강제 */
              className="w-full h-14 rounded-md font-bold uppercase transition-all text-[#ffcc33] text-4xl font-black italic uppercase hover:scale-105 transition-transform animate-pulse cursor-pointer pointer-events-auto"
            >
              OK, I got it
            </button>
          ) : (
            /* 가위바위보 버튼 영역 (60% 너비 유지) */
            <div className="flex gap-3 w-[60%] mb-2">
              {['rock', 'paper', 'scissor'].map((type) => (
                <button 
                  key={type} 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(type === 'rock' ? 1 : type === 'paper' ? 2 : 0);
                  }} 
                  className={`flex-1 aspect-square rounded-3xl  active:scale-90 transition-all bg-zinc-900 pointer-events-auto ${
                    type === 'rock' ? 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 
                    type === 'paper' ? 'shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 
                    'shadow-[0_0_15px_rgba(236,72,153,0.5)]'
                  }`}
                >
                  <img src={`/images/${type}.png`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )
        ) : (
          null 
        )}
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