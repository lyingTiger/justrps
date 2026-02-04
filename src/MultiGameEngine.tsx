import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface MultiGameProps {
  roomId: string;
  userNickname: string;
  playClickSound: () => void;
  onGameOver: (finalRound: number, totalTime: number) => void;
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
  
  // 🔥 [수정 1] 로딩 상태 추가 (초기값 true)
  const [isLoading, setIsLoading] = useState(true);

  // 게임 로직 관련
  const [aiSelect, setAiSelect] = useState<number[]>([]);
  const [targetConditions, setTargetConditions] = useState<string[]>([]);
  const [questionTurn, setQuestionTurn] = useState(0);
  const [isMemoryPhase, setIsMemoryPhase] = useState(true);

  // 셔플/싱글 로직용 상태
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
        (payload) => {
           setRoomData(payload.new);
           if (payload.new.status === 'ended') finalizeGame(); 
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
    try {
        const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
        if (room) {
            setRoomData(room);
            const safeSeed = room.seed || 1234;
            const safeMode = room.mode || 'WIN MODE';
            
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: me } = await supabase.from('room_participants')
                    .select('current_round, is_cleared, is_dead, play_time')
                    .eq('room_id', roomId)
                    .eq('user_id', user.id)
                    .single();
                
                if (me) {
                    const savedRound = me.current_round || 1;
                    myRoundRef.current = savedRound;
                    setPlayTime(me.play_time || 0);

                    if (me.is_dead) setIsEliminated(true);
                    else startNewRound(savedRound, safeSeed, safeMode, true); 
                } else {
                    startNewRound(1, safeSeed, safeMode);
                }
            }
        }
        await fetchParticipants();
    } catch (e) {
        console.error(e);
    } finally {
        // 🔥 [수정 2] 데이터 로드 및 초기화가 다 끝난 후 로딩 해제
        setIsLoading(false); 
    }
  };

  const fetchParticipants = async () => {
    const { data } = await supabase.from('room_participants').select('*, profiles(display_name)').eq('room_id', roomId);
    if (data) setParticipants(data);
  };

  // --- 2. 새 라운드 시작 ---
  const startNewRound = (newRound: number, seed: number, mode: string, isInitialLoad = false) => {
    console.log(`Starting Round ${newRound}`);
    myRoundRef.current = newRound;
    setCurrentRound(newRound);
    
    const roundSeed = seed + newRound; 
    const seededRandom = (s: number) => {
      return () => {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
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
  const currentSolvedCounts = mode === 'SHUFFLE MODE' 
      ? getCounts(satisfiedConditions) 
      : getCounts(targetConditions.slice(0, questionTurn));

  // --- 3. 타이머 ---
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

  // 타임아웃
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

  // --- 4. 입력 처리 ---
  const handleSelect = async (idx: number) => {
    if (isEliminated || isCleared) return;
    playClickSound();

    let isRoundClear = false;

    if (mode === 'SHUFFLE MODE') {
        let foundMatch = false;
        for (let i = 0; i < aiSelect.length; i++) {
            if (solvedIndices.includes(i)) continue;
            const hand = aiSelect[i];
            const result = idx === hand ? 'DRAW' : ((hand === 0 && idx === 1) || (hand === 1 && idx === 2) || (hand === 2 && idx === 0) ? 'WIN' : 'LOSE');
            
            const needed = totalTargetCounts[result as keyof typeof totalTargetCounts];
            const current = satisfiedConditions.filter(c => c === result).length;

            if (needed > current) {
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
    }
    else {
        const aiHand = aiSelect[questionTurn];
        const condition = targetConditions[questionTurn];
        let isCorrect = false;

        if (condition === 'DRAW') isCorrect = idx === aiHand;
        else if (condition === 'WIN') isCorrect = (aiHand === 0 && idx === 1) || (aiHand === 1 && idx === 2) || (aiHand === 2 && idx === 0);
        else if (condition === 'LOSE') isCorrect = (aiHand === 0 && idx === 2) || (aiHand === 1 && idx === 0) || (aiHand === 2 && idx === 1);

        if (isCorrect) {
            if (questionTurn + 1 === aiSelect.length) isRoundClear = true;
            else setQuestionTurn(prev => prev + 1);
        } else {
            handleElimination("WRONG"); return;
        }
    }

    if (isRoundClear) {
        setIsCleared(true);
        if (timerRef.current) clearInterval(timerRef.current);
        
        const nextRound = myRoundRef.current + 1;
        await updateMyStatus(nextRound, false, playTime, false);

        setTimeout(() => {
            startNewRound(nextRound, roomData.seed || 1234, roomData.mode);
        }, 1000); 
    }
  };

  const handleElimination = async (reason: string) => {
    setIsEliminated(true);
    if (timerRef.current) clearInterval(timerRef.current);
    await updateMyStatus(myRoundRef.current, false, playTime, true); 
    saveRecordToLeaderboard(myRoundRef.current, playTime);
    setTimeout(() => finalizeGame(), 2000);
  };

  const saveRecordToLeaderboard = async (finalRound: number, totalTime: number) => {
      if (!currentUserId) return;
      try {
          await supabase.from('game_records').insert({
              user_id: currentUserId,
              round: finalRound,
              play_time: totalTime,
              mode: mode
          });
          console.log("기록 저장 성공");
      } catch (err) {
          console.error("기록 저장 실패:", err);
      }
  };

  const updateMyStatus = async (round: number, cleared: boolean, time: number, dead: boolean) => {
    if (!currentUserId) return;
    if (cleared && !roomData.first_cleared_at) {
      await supabase.from('rooms').update({ first_cleared_at: new Date().toISOString() }).eq('id', roomId);
    }
    await supabase.from('room_participants')
      .update({ 
          current_round: round, 
          is_cleared: cleared, 
          play_time: time, 
          is_dead: dead 
      })
      .eq('room_id', roomId).eq('user_id', currentUserId);
  };

  const finalizeGame = () => {
     onGameOver(myRoundRef.current, playTime); 
  };

// 🔥 [수정 3] 로딩 UI (화면 중앙 정렬 및 디자인 적용)
  if (isLoading) {
      return (
          // min-h-screen으로 화면 전체 높이를 잡고 중앙 정렬
          <div className="w-full min-h-screen flex flex-col items-center justify-center animate-in fade-in select-none">
              <div className="text-[#FF9900] text-3xl font-black uppercase italic tracking-tighter animate-pulse">
                  Loading...
              </div>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-2">
                  Preparing Game Context
              </p>
          </div>
      );
  }

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center py-6 animate-in fade-in select-none">
      
      {/* 1. 상단 정보 */}
      <div className="w-full text-left mt-0 mb-6">
        <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Round {currentRound}</h2>
        <p className="text-zinc-500 text-[14px] font-mono tracking-tighter mt-0">
          Total Time: {playTime.toFixed(2)} sec
        </p>
        
        {roomData?.first_cleared_at && !isCleared && !isEliminated && (
          <div className="text-red-500 text-[10px] font-black uppercase animate-pulse border border-red-500/30 px-2 py-1 rounded w-fit mt-2">
            Hurry Up!
          </div>
        )}
      </div>

      {/* 2. 타 플레이어 현황 */}
      <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 mb-8 space-y-2">
        <div className="text-[10px] text-zinc-600 font-bold uppercase mb-2">Other Players</div>
        {participants.filter(p => p.user_id !== currentUserId).map(p => (
          <div key={p.user_id} className="flex justify-between items-center opacity-80">
            <span className={`text-[10px] font-black uppercase flex items-center gap-1
               ${p.is_dead ? 'text-zinc-600 line-through decoration-red-500' : 'text-zinc-500'}`}>
               {p.is_dead && "💀"} {p.profiles?.display_name}
            </span>
            <span className={`text-xs font-mono font-bold ${p.is_dead ? 'text-red-900' : 'text-white'}`}>
              {p.is_dead ? "FAIL" : `Round ${p.current_round || 1}`}
            </span>
          </div>
        ))}
      </div>

      {/* 3. 게임 인터페이스 */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] w-full">
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
                <p className="text-[#FF9900] text-6xl font-black tracking-tighter uppercase leading-none">
                    {isEliminated ? "GAME OVER" : `${aiSelect.length} ${mode.split(' ')[0]}`}
                </p>
                <p className="text-white text-2xl font-bold opacity-80 uppercase tracking-tight mt-1">
                    {isEliminated ? "Watch others" : `${questionTurn} ${mode.split(' ')[0]}`}
                </p>
            </div>
         )}

         <div className="flex flex-wrap justify-center gap-3 mb-4">
            {aiSelect.map((hand, i) => {
               const isSolved = mode === 'SHUFFLE MODE' ? solvedIndices.includes(i) : i < questionTurn;
               const isCurrent = (i === questionTurn && !isMemoryPhase);
               const showDetails = isMemoryPhase || isSolved;
               
               return (
                <div key={i} className="relative flex flex-col items-center">
                    {isCurrent && mode === 'EXPERT MODE' && !isEliminated && !isCleared && (
                      <span className="absolute -top-5 text-[9px] font-black text-[#FF9900] animate-pulse">{targetConditions[i]}</span>
                    )}
                    <div className={`w-14 h-14 rounded-2xl overflow-hidden transition-all duration-300 bg-zinc-900 
                        ${showDetails 
                            ? (hand === 0 ? 'shadow-[0_0_12px_rgba(236,72,153,0.7)]' : hand === 1 ? 'shadow-[0_0_12px_rgba(59,130,246,0.7)]' : 'shadow-[0_0_12px_rgba(34,197,94,0.7)]') 
                            : (isCurrent && !isEliminated && !isCleared)
                                ? 'border-2 border-[#FF9900] shadow-[0_0_15px_rgba(255,153,0,0.5)] scale-105' 
                                : 'shadow-none'
                        }`}>
                        {isMemoryPhase ? (
                            <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                {(isSolved || isEliminated || isCleared) && (
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

      {/* 4. 버튼 영역 */}
      <div className="w-full flex justify-center mt-auto">
        {isEliminated ? (
           <div className="text-zinc-500 font-bold uppercase animate-pulse">Spectating Mode...</div>
        ) : isCleared ? (
           <div className="text-green-500 font-bold uppercase animate-bounce">Next Round!</div>
        ) : isMemoryPhase ? (
          <button onClick={() => { playClickSound(); setIsMemoryPhase(false); }} className="text-[#FF9900] text-3xl font-black italic uppercase hover:scale-105 transition-transform animate-pulse">
            OK, I got it
          </button>
        ) : (
          <div className="flex gap-4 w-full px-2">
            {['rock', 'paper', 'scissor'].map((type) => (
              <button 
                key={type} 
                onClick={() => handleSelect(type === 'rock' ? 1 : type === 'paper' ? 2 : 0)} 
                className={`flex-1 aspect-square rounded-3xl overflow-hidden active:scale-90 transition-all bg-zinc-900 
                    ${type === 'rock' ? 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' : type === 'paper' ? 'shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'shadow-[0_0_15px_rgba(236,72,153,0.5)]'}`}
              >
                <img src={`/images/${type}.png`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}