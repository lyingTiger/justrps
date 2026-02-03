import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface MultiGameProps {
  roomId: string;
  userNickname: string;
  playClickSound: () => void;
  onGameOver: (finalRound: number, myRank: number) => void;
  onBackToLobby: () => void;
}

export default function MultiGameEngine({ roomId, userNickname, playClickSound, onGameOver, onBackToLobby }: MultiGameProps) {
  // --- 상태 관리 ---
  const [currentRound, setCurrentRound] = useState(1);
  const [playTime, setPlayTime] = useState(0); 
  const [isCleared, setIsCleared] = useState(false); 
  const [isEliminated, setIsEliminated] = useState(false); 
  const [participants, setParticipants] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 게임 로직 관련
  const [aiSelect, setAiSelect] = useState<number[]>([]);
  const [targetConditions, setTargetConditions] = useState<string[]>([]);
  const [questionTurn, setQuestionTurn] = useState(0); // 순차 모드용
  const [isMemoryPhase, setIsMemoryPhase] = useState(true);

  // ✨ [셔플 모드용 상태 추가]
  const [solvedIndices, setSolvedIndices] = useState<number[]>([]); // 해결된 카드 인덱스
  const [satisfiedConditions, setSatisfiedConditions] = useState<string[]>([]); // 해결된 조건들

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const roundSyncRef = useRef(1);

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
        (payload) => {
           setRoomData(payload.new);
           if (payload.new.round > roundSyncRef.current) {
              startNewRound(payload.new.round, payload.new.seed, payload.new.mode);
           }
           if (payload.new.status === 'ended') finalizeGame(payload.new);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, 
        () => fetchParticipants())
      .subscribe();

    return () => { 
      if (timerRef.current) clearInterval(timerRef.current);
      supabase.removeChannel(channel); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const fetchRoomAndParticipants = async () => {
    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (room) {
        setRoomData(room);
        const safeRound = room.round || 1;
        const safeSeed = room.seed || Math.random();
        const safeMode = room.mode || 'WIN MODE';
        roundSyncRef.current = safeRound;
        startNewRound(safeRound, safeSeed, safeMode);
    }
    fetchParticipants();
  };

  const fetchParticipants = async () => {
    const { data } = await supabase.from('room_participants').select('*, profiles(display_name)').eq('room_id', roomId);
    if (data) setParticipants(data);
  };

  // --- 2. 새 라운드 시작 ---
  const startNewRound = (newRound: number, seed: number, mode: string) => {
    console.log(`Starting Round ${newRound} / Mode: ${mode}`);
    roundSyncRef.current = newRound;
    setCurrentRound(newRound);
    
    const seededRandom = (s: number) => {
      return () => {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    };

    const rng = seededRandom(seed + newRound);
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
    
    // 상태 초기화
    setQuestionTurn(0);
    setSolvedIndices([]);      // ✨ 초기화
    setSatisfiedConditions([]); // ✨ 초기화
    setIsMemoryPhase(true);
    setIsCleared(false);

    if (!isEliminated) {
        setPlayTime(0);
    }
  };

  // --- 3. 셔플 모드용 헬퍼 함수 (카운트 계산) ---
  const getCounts = (list: string[]) => {
    const counts = { WIN: 0, DRAW: 0, LOSE: 0 };
    list.forEach(c => { if (c in counts) counts[c as keyof typeof counts]++; });
    return counts;
  };

  // 현재 모드 확인
  const mode = roomData?.mode || 'WIN MODE';
  // 카운트 계산
  const totalTargetCounts = getCounts(targetConditions);
  const currentSolvedCounts = mode === 'SHUFFLE MODE' 
      ? getCounts(satisfiedConditions) 
      : getCounts(targetConditions.slice(0, questionTurn));

  // --- 4. 타이머 및 타임아웃 ---
  useEffect(() => {
    if (!isMemoryPhase && !isCleared && !isEliminated) {
      timerRef.current = setInterval(() => {
        setPlayTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isMemoryPhase, isCleared, isEliminated]);

  useEffect(() => {
    if (roomData?.first_cleared_at && !isCleared && !isEliminated) {
      const firstClearedTime = new Date(roomData.first_cleared_at).getTime();
      const checkTimeout = setInterval(() => {
        const now = new Date().getTime();
        if (now - firstClearedTime > 30000) {
          clearInterval(checkTimeout);
          handleElimination("TIMEOUT");
        }
      }, 1000);
      return () => clearInterval(checkTimeout);
    }
  }, [roomData?.first_cleared_at, isCleared, isEliminated]);

  // --- 5. 플레이어 입력 처리 (로직 분기) ---
  const handleSelect = async (idx: number) => {
    if (isEliminated || isCleared) return;
    playClickSound();

    // 🔥 [로직 1] 셔플 모드 (순서 무관, 개수 매칭)
    if (mode === 'SHUFFLE MODE') {
        let foundMatch = false;
        
        // 전체 카드를 돌면서 "내가 낸 손으로 해결 가능한 미해결 카드"가 있는지 찾음
        for (let i = 0; i < aiSelect.length; i++) {
            if (solvedIndices.includes(i)) continue; // 이미 푼 건 패스

            const hand = aiSelect[i];
            const result = idx === hand ? 'DRAW' : ((hand === 0 && idx === 1) || (hand === 1 && idx === 2) || (hand === 2 && idx === 0) ? 'WIN' : 'LOSE');
            
            const needed = totalTargetCounts[result as keyof typeof totalTargetCounts];
            const current = satisfiedConditions.filter(c => c === result).length;

            // 아직 이 조건(WIN/DRAW/LOSE)이 더 필요하다면 -> 매칭 성공!
            if (needed > current) {
                const newSolvedIndices = [...solvedIndices, i];
                const newSatisfiedConditions = [...satisfiedConditions, result];
                setSolvedIndices(newSolvedIndices);
                setSatisfiedConditions(newSatisfiedConditions);
                foundMatch = true;

                // 모든 카드를 다 풀었는지 확인
                if (newSatisfiedConditions.length === aiSelect.length) {
                    setIsCleared(true);
                    if (timerRef.current) clearInterval(timerRef.current);
                    await updateMyStatus(true, playTime, false);
                }
                break; // 하나 찾았으니 루프 종료
            }
        }

        // 아무것도 매칭되지 않음 -> 오답 -> 탈락
        if (!foundMatch) {
            handleElimination("WRONG");
        }
        return;
    }

    // 🔥 [로직 2] 일반 / 익스퍼트 모드 (순차 진행)
    const aiHand = aiSelect[questionTurn];
    const condition = targetConditions[questionTurn];
    let isCorrect = false;

    if (condition === 'DRAW') isCorrect = idx === aiHand;
    else if (condition === 'WIN') isCorrect = (aiHand === 0 && idx === 1) || (aiHand === 1 && idx === 2) || (aiHand === 2 && idx === 0);
    else if (condition === 'LOSE') isCorrect = (aiHand === 0 && idx === 2) || (aiHand === 1 && idx === 0) || (aiHand === 2 && idx === 1);

    if (isCorrect) {
      if (questionTurn + 1 === aiSelect.length) {
        setIsCleared(true);
        if (timerRef.current) clearInterval(timerRef.current);
        await updateMyStatus(true, playTime, false);
      } else {
        setQuestionTurn(prev => prev + 1);
      }
    } else {
      handleElimination("WRONG");
    }
  };

  const handleElimination = async (reason: string) => {
    setIsEliminated(true);
    if (timerRef.current) clearInterval(timerRef.current);
    await updateMyStatus(false, 9999, true); 
  };

  const updateMyStatus = async (cleared: boolean, time: number, dead: boolean) => {
    if (!currentUserId) return;
    if (cleared && !roomData.first_cleared_at) {
      await supabase.from('rooms').update({ first_cleared_at: new Date().toISOString() }).eq('id', roomId);
    }
    await supabase.from('room_participants')
      .update({ is_cleared: cleared, play_time: time, is_dead: dead })
      .eq('room_id', roomId).eq('user_id', currentUserId);
  };

  // --- 6. 방장 로직 ---
  useEffect(() => {
    if (!currentUserId || !roomData || currentUserId !== roomData.creator_id) return;
    if (participants.length === 0) return;

    const activePlayers = participants.filter(p => !p.is_dead);
    const clearedPlayers = activePlayers.filter(p => p.is_cleared);
    
    if (activePlayers.length > 0 && activePlayers.length === clearedPlayers.length) {
        if (roomData.first_cleared_at !== null) { 
           proceedToNextRound();
        }
    }
    
    const allProcessed = participants.every(p => p.is_cleared || p.is_dead);
    if (allProcessed && participants.length > 0 && roomData.first_cleared_at !== null) {
        proceedToNextRound();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]); 

  const proceedToNextRound = async () => {
     await new Promise(r => setTimeout(r, 2000));
     await supabase.from('room_participants').update({ is_cleared: false, play_time: 0 }).eq('room_id', roomId);
     await supabase.from('rooms').update({
            round: currentRound + 1,
            seed: Math.random(),
            first_cleared_at: null
        }).eq('id', roomId);
  };

  const finalizeGame = (finalRoomData: any) => {
     onGameOver(currentRound, 0); 
  };

  // --- 7. 렌더링 ---
  return (
    <div className="w-full max-w-[340px] flex flex-col items-center py-6 animate-in fade-in select-none">
      {/* 상단 정보 */}
      <div className="w-full flex justify-between items-end mb-8">
        <div>
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Round {currentRound}</h2>
          <p className="text-[#FF9900] text-xs font-black uppercase italic mt-1">
            {isEliminated ? "ELIMINATED" : isCleared ? "Waiting..." : `Time: ${playTime}s`}
          </p>
        </div>
        {roomData?.first_cleared_at && !isCleared && !isEliminated && (
          <div className="text-red-500 text-[10px] font-black uppercase animate-pulse border border-red-500/30 px-2 py-1 rounded">
            Hurry Up!
          </div>
        )}
      </div>

      {/* 타 플레이어 현황 */}
      <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 mb-8 space-y-2">
        {participants.map(p => (
          <div key={p.user_id} className="flex justify-between items-center opacity-80">
            <span className={`text-[10px] font-black uppercase flex items-center gap-1
               ${p.is_dead ? 'text-zinc-600 line-through decoration-red-500' : p.is_cleared ? 'text-green-400' : 'text-zinc-500'}`}>
               {p.is_dead && "💀"} {p.profiles?.display_name} {p.user_id === currentUserId && " (ME)"}
            </span>
            <span className={`text-xs font-mono font-bold ${p.is_dead ? 'text-red-900' : 'text-white'}`}>
              {p.is_dead ? "FAIL" : p.is_cleared ? `${Math.floor(p.play_time)}s` : "..."}
            </span>
          </div>
        ))}
      </div>

      {/* 게임 인터페이스 */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] w-full">
         {/* ✨ [UI 분기] 셔플/익스퍼트 모드는 카운트 표시, 일반 모드는 현재 조건 표시 */}
         {(mode === 'SHUFFLE MODE' || mode === 'EXPERT MODE') ? (
            <div className="text-center mb-10 select-none">
                <div className="flex justify-center gap-3 text-2xl font-black text-[#FF9900] uppercase italic tracking-tighter">
                <span>{totalTargetCounts.WIN} WIN</span><span>{totalTargetCounts.DRAW} DRAW</span><span>{totalTargetCounts.LOSE} LOSE</span>
                </div>
                <div className="flex justify-center gap-4 text-xl font-bold text-white opacity-80 uppercase tracking-tight mt-1">
                <span>{currentSolvedCounts.WIN} WIN</span><span>{currentSolvedCounts.DRAW} DRAW</span><span>{currentSolvedCounts.LOSE} LOSE</span>
                </div>
            </div>
         ) : (
            <div className="text-center mb-10">
                <p className="text-[#FF9900] text-5xl font-black tracking-tighter uppercase leading-none">
                    {isEliminated ? "GAME OVER" : targetConditions[questionTurn]}
                </p>
                <p className="text-white text-xl font-bold opacity-50 uppercase tracking-tight mt-1">
                    {isEliminated ? "Watch others play" : `${questionTurn} / ${aiSelect.length}`}
                </p>
            </div>
         )}

         {/* 카드 리스트 */}
         <div className="flex flex-wrap justify-center gap-2 mb-10">
            {aiSelect.map((hand, i) => {
               // 모드에 따라 '현재 활성화된 카드'인지 판단
               let isActive = false;
               let isSolved = false;
               
               if (mode === 'SHUFFLE MODE') {
                   isSolved = solvedIndices.includes(i);
                   isActive = !isSolved; // 안 풀린 건 다 활성
               } else {
                   isActive = (i === questionTurn);
                   isSolved = (i < questionTurn);
               }

               return (
                <div key={i} className={`w-12 h-12 rounded-2xl bg-zinc-900 border-2 transition-all 
                    ${isSolved ? 'border-transparent opacity-20' : (isActive && !isEliminated && !isCleared ? 'border-[#FF9900] shadow-[0_0_15px_#FF990044]' : 'border-zinc-700 opacity-50')}`}>
                    
                    {/* 셔플/익스퍼트: 작은 조건 표시 */}
                    {(isActive && (mode === 'SHUFFLE MODE' || mode === 'EXPERT MODE')) ? null : null} 

                    {/* 카드 이미지 */}
                    {(isMemoryPhase || isActive || isSolved || isEliminated || isCleared || mode === 'SHUFFLE MODE') && (
                        <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-contain p-2" />
                    )}
                </div>
               );
            })}
         </div>
      </div>

      {/* 조작 버튼 영역 */}
      <div className="w-full flex justify-center mt-auto">
        {isEliminated ? (
           <div className="text-zinc-500 font-bold uppercase animate-pulse">Spectating Mode...</div>
        ) : isCleared ? (
           <div className="text-green-500 font-bold uppercase animate-bounce">Round Clear!</div>
        ) : isMemoryPhase ? (
          <button onClick={() => setIsMemoryPhase(false)} className="text-[#FF9900] text-3xl font-black italic uppercase animate-pulse hover:scale-105 transition-transform">I Got It</button>
        ) : (
          <div className="flex gap-4 w-full px-2">
            {['rock', 'paper', 'scissor'].map((type) => (
              <button 
                key={type} 
                onClick={() => handleSelect(type === 'rock' ? 1 : type === 'paper' ? 2 : 0)} 
                className="flex-1 aspect-square rounded-3xl bg-zinc-900 border border-zinc-800 active:scale-90 transition-all flex items-center justify-center p-4"
              >
                <img src={`/images/${type}.png`} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}