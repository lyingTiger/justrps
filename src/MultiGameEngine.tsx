import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface MultiGameProps {
  roomId: string;
  userNickname: string;
  playClickSound: () => void;
  onGameOver: (finalRound: number, myRank: number) => void; // 순위 전달로 변경
  onBackToLobby: () => void;
}

export default function MultiGameEngine({ roomId, userNickname, playClickSound, onGameOver, onBackToLobby }: MultiGameProps) {
  // --- 상태 관리 ---
  const [currentRound, setCurrentRound] = useState(1);
  const [playTime, setPlayTime] = useState(0); 
  const [isCleared, setIsCleared] = useState(false); 
  const [isEliminated, setIsEliminated] = useState(false); // 탈락 여부
  const [participants, setParticipants] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 게임 로직 관련
  const [aiSelect, setAiSelect] = useState<number[]>([]);
  const [targetConditions, setTargetConditions] = useState<string[]>([]);
  const [questionTurn, setQuestionTurn] = useState(0);
  const [isMemoryPhase, setIsMemoryPhase] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const roundSyncRef = useRef(1); // 라운드 변경 감지용 Ref

  // --- 1. 초기 설정 및 유저 확인 ---
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      
      // 최초 데이터 로드
      await fetchRoomAndParticipants();
    };
    init();

// 실시간 구독: 방 정보 및 참여자 상태
    const channel = supabase.channel(`multi_game_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, 
        (payload) => {
           setRoomData(payload.new);
           // 방 라운드가 내 라운드보다 높으면 -> 새 라운드 시작
           if (payload.new.round > roundSyncRef.current) {
              // 🔥 [수정] 3번째 인자로 mode 전달 필수!
              startNewRound(payload.new.round, payload.new.seed, payload.new.mode);
           }
           // 게임 상태가 'ended'면 -> 결과창 이동
           if (payload.new.status === 'ended') {
              finalizeGame(payload.new);
           }
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

// --- 1. 데이터 로드 함수 (수정됨: 안전장치 추가) ---
  const fetchRoomAndParticipants = async () => {
    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (room) {
        setRoomData(room);
        
        // 🛡️ [핵심 수정] DB에 값이 없으면 기본값(1)을 사용하여 에러 방지
        // room.round가 undefined/null이면 1이 들어감
        const safeRound = room.round || 1;
        const safeSeed = room.seed || Math.random();
        const safeMode = room.mode || 'WIN MODE';

        // Ref 동기화
        roundSyncRef.current = safeRound;
        
        // 안전한 값으로 문제 생성 시작
        startNewRound(safeRound, safeSeed, safeMode);
    }
    fetchParticipants();
  };

  const fetchParticipants = async () => {
    const { data } = await supabase.from('room_participants').select('*, profiles(display_name)').eq('room_id', roomId);
    if (data) setParticipants(data);
  };

// --- 2. 새 라운드 시작 로직 (수정됨: mode 인자 추가) ---
  const startNewRound = (newRound: number, seed: number, mode: string) => {
    console.log(`Starting Round ${newRound} with mode ${mode}`);
    roundSyncRef.current = newRound;
    setCurrentRound(newRound);
    
    // 시드 기반 문제 생성
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
    
    // 모드에 따른 조건 생성
    const conditions = ['WIN', 'DRAW', 'LOSE'];
    let newConditions: string[] = [];
    
    // 인자로 받은 mode를 사용 (없으면 기본값)
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
    setIsMemoryPhase(true);
    setIsCleared(false);

    if (!isEliminated) {
        setPlayTime(0);
    }
  };

  // --- 3. 타이머 로직 ---
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

  // --- 4. 1등 발생 후 30초 카운트다운 (타임아웃 로직) ---
  useEffect(() => {
    // 누군가 깼고(first_cleared_at 존재), 나는 아직 못 깼고, 탈락도 안 했으면 카운트다운 체크
    if (roomData?.first_cleared_at && !isCleared && !isEliminated) {
      const firstClearedTime = new Date(roomData.first_cleared_at).getTime();
      
      const checkTimeout = setInterval(() => {
        const now = new Date().getTime();
        if (now - firstClearedTime > 30000) { // 30초 경과
          clearInterval(checkTimeout);
          handleElimination("TIMEOUT"); // 시간 초과 탈락 처리
        }
      }, 1000);
      
      return () => clearInterval(checkTimeout);
    }
  }, [roomData?.first_cleared_at, isCleared, isEliminated]);

  // --- 5. 플레이어 입력 처리 ---
  const handleSelect = async (idx: number) => {
    if (isEliminated || isCleared) return;

    const aiHand = aiSelect[questionTurn];
    const condition = targetConditions[questionTurn];
    let isCorrect = false;

    if (condition === 'DRAW') isCorrect = idx === aiHand;
    else if (condition === 'WIN') isCorrect = (aiHand === 0 && idx === 1) || (aiHand === 1 && idx === 2) || (aiHand === 2 && idx === 0);
    else if (condition === 'LOSE') isCorrect = (aiHand === 0 && idx === 2) || (aiHand === 1 && idx === 0) || (aiHand === 2 && idx === 1);

    if (isCorrect) {
      playClickSound();
      if (questionTurn + 1 === aiSelect.length) {
        // [클리어 성공]
        setIsCleared(true);
        if (timerRef.current) clearInterval(timerRef.current);
        await updateMyStatus(true, playTime, false);
      } else {
        setQuestionTurn(prev => prev + 1);
      }
    } else {
      // [틀림 - 탈락 처리]
      playClickSound(); // 삑 소리 필요하면 교체
      handleElimination("WRONG");
    }
  };

  // 탈락 처리 함수
  const handleElimination = async (reason: string) => {
    console.log(`Eliminated: ${reason}`);
    setIsEliminated(true);
    if (timerRef.current) clearInterval(timerRef.current);
    await updateMyStatus(false, 9999, true); // is_dead = true
  };

  // DB 상태 업데이트
  const updateMyStatus = async (cleared: boolean, time: number, dead: boolean) => {
    if (!currentUserId) return;

    // 1등 체크: 아무도 1등 기록이 없을 때 내가 깼으면 기록
    if (cleared && !roomData.first_cleared_at) {
      await supabase.from('rooms').update({ first_cleared_at: new Date().toISOString() }).eq('id', roomId);
    }

    // 내 상태 업데이트
    await supabase.from('room_participants')
      .update({ 
        is_cleared: cleared, 
        play_time: time,
        is_dead: dead // DB에 is_dead 컬럼 필요 (없으면 추가하거나 로직 변경)
      })
      .eq('room_id', roomId).eq('user_id', currentUserId);
  };

  // --- 6. [방장 전용] 라운드 관리 및 게임 종료 감지 ---
  useEffect(() => {
    if (!currentUserId || !roomData || currentUserId !== roomData.creator_id) return;
    if (participants.length === 0) return;

    // 모든 참가자의 상태 확인
    const activePlayers = participants.filter(p => !p.is_dead); // 살아있는 사람
    const clearedPlayers = activePlayers.filter(p => p.is_cleared); // 깬 사람
    
    // 조건 1: 살아있는 모든 사람이 깼을 때 -> 다음 라운드
    if (activePlayers.length > 0 && activePlayers.length === clearedPlayers.length) {
        // 이미 라운드 변경 중인지 체크 (중복 실행 방지)
        // first_cleared_at이 null이 아니면 "아직 이번 라운드 정리 안됨" 상태
        if (roomData.first_cleared_at !== null) { 
           proceedToNextRound();
        }
    }
    
    // 조건 2: 살아있는 사람이 0명 또는 1명(최후의 1인)일 때 -> 게임 종료
    // (단, 1라운드 시작 직후 등 초기 상태 제외)
    // 여기서는 "서바이벌" 규칙을 적용. 만약 점수 경쟁이면 로직이 다름.
    // **수정**: 일단 1등이 나올 때까지 계속하는 방식(점수제)이라면 이 부분은 스킵하고,
    // 정해진 라운드가 있거나, 타임아웃 종료 처리가 필요함.
    
    // 일단 "모두가 처리됨(성공 or 실패)" 상태면 다음 라운드 가는 로직으로 통합
    const allProcessed = participants.every(p => p.is_cleared || p.is_dead);
    if (allProcessed && participants.length > 0 && roomData.first_cleared_at !== null) {
        proceedToNextRound();
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]); // 참가자 상태가 변할 때마다 방장이 체크

  const proceedToNextRound = async () => {
     console.log("Host initiating next round...");
     // 1. 잠시 대기 (연출용 2초)
     await new Promise(r => setTimeout(r, 2000));
     
     // 2. 참가자 상태 초기화 (is_cleared = false, play_time = 0)
     // 주의: is_dead는 초기화하지 않음 (죽은 자는 말이 없다)
     // 만약 매 라운드 부활시키려면 is_dead도 false로 초기화
     await supabase.from('room_participants')
        .update({ is_cleared: false, play_time: 0 })
        .eq('room_id', roomId);

     // 3. 방 정보 업데이트 (라운드 + 1, 시드 변경, 1등기록 삭제)
     await supabase.from('rooms')
        .update({
            round: currentRound + 1,
            seed: Math.random(),
            first_cleared_at: null
        })
        .eq('id', roomId);
     
     // 이 업데이트가 발생하면 -> 실시간 구독에서 'UPDATE' 이벤트를 받고 -> startNewRound()가 실행됨
  };

  // --- 7. 최종 결과 처리 ---
  const finalizeGame = (finalRoomData: any) => {
     // 내 등수 계산 등
     onGameOver(currentRound, 0); // 점수나 등수는 DB에서 가져오거나 계산
  };

  // (렌더링 부분은 기존 디자인 유지하되, 상태값만 변경된 변수로 연결)
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
               {p.is_dead && "💀"} 
               {p.profiles?.display_name} 
               {p.user_id === currentUserId && " (ME)"}
            </span>
            <span className={`text-xs font-mono font-bold ${p.is_dead ? 'text-red-900' : 'text-white'}`}>
              {p.is_dead ? "FAIL" : p.is_cleared ? `${Math.floor(p.play_time)}s` : "..."}
            </span>
          </div>
        ))}
      </div>

      {/* 게임 인터페이스 (문제 영역) */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] w-full">
         <div className="text-center mb-10">
            <p className="text-[#FF9900] text-5xl font-black tracking-tighter uppercase leading-none">
               {isEliminated ? "GAME OVER" : targetConditions[questionTurn]}
            </p>
            <p className="text-white text-xl font-bold opacity-50 uppercase tracking-tight mt-1">
               {isEliminated ? "Watch others play" : `${questionTurn} / ${aiSelect.length}`}
            </p>
         </div>

         <div className="flex flex-wrap justify-center gap-2 mb-10">
            {aiSelect.map((hand, i) => (
               <div key={i} className={`w-12 h-12 rounded-2xl bg-zinc-900 border-2 transition-all 
                  ${(isMemoryPhase || i < questionTurn) ? 'border-zinc-700' : (i === questionTurn && !isEliminated && !isCleared ? 'border-[#FF9900] shadow-[0_0_15px_#FF990044]' : 'border-transparent opacity-20')}`}>
                  {/* 탈락했거나 깼어도 카드는 계속 보여줌 (관전) */}
                  {(isMemoryPhase || i < questionTurn || isEliminated || isCleared) && (
                    <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-contain p-2" />
                  )}
               </div>
            ))}
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