import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface MultiGameProps {
  roomId: string;
  userNickname: string;
  playClickSound: () => void;
  onGameOver: (finalRound: number, totalScore: number) => void;
  onBackToLobby: () => void;
}

export default function MultiGameEngine({ roomId, userNickname, playClickSound, onGameOver, onBackToLobby }: MultiGameProps) {
  // --- 상태 관리 ---
  const [round, setRound] = useState(1);
  const [playTime, setPlayTime] = useState(0); // 현재 라운드 소요 시간
  const [isCleared, setIsCleared] = useState(false); // 내가 라운드를 깼는지 여부
  const [participants, setParticipants] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 게임 로직 관련
  const [aiSelect, setAiSelect] = useState<number[]>([]);
  const [targetConditions, setTargetConditions] = useState<string[]>([]);
  const [questionTurn, setQuestionTurn] = useState(0);
  const [isMemoryPhase, setIsMemoryPhase] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- 1. 초기 설정 및 유저 확인 ---
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      fetchRoomAndParticipants();
    };
    init();

    // 실시간 구독: 방 정보 및 참여자 상태
    const channel = supabase.channel(`multi_game_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, 
        (payload) => setRoomData(payload.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, 
        () => fetchParticipants())
      .subscribe();

    return () => { 
      if (timerRef.current) clearInterval(timerRef.current);
      supabase.removeChannel(channel); 
    };
  }, [roomId]);

  const fetchRoomAndParticipants = async () => {
    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    setRoomData(room);
    fetchParticipants();
  };

  const fetchParticipants = async () => {
    const { data } = await supabase.from('room_participants').select('*, profiles(display_name)').eq('room_id', roomId);
    if (data) setParticipants(data);
  };

  // --- 2. 시드 기반 문제 생성 (모든 플레이어 동일) ---
  useEffect(() => {
    if (!roomData?.seed) return;

    // 시드 기반 난수 생성기 (Mulberry32)
    const seededRandom = (s: number) => {
      return () => {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    };

    const rng = seededRandom(roomData.seed + round); // 라운드별 시드 조합
    const questionNum = round + 2;
    const newAiSelect = Array.from({ length: questionNum }, () => Math.floor(rng() * 3));
    const conditions = ['WIN', 'DRAW', 'LOSE'];
    let newConditions: string[] = [];
    const currentMode = roomData.mode || 'WIN MODE'; // 방어 코드

    if (currentMode === 'SHUFFLE MODE' || currentMode === 'EXPERT MODE') {
        // 셔플, 익스퍼트 모드일 때는 기존처럼 랜덤 섞기
        newConditions = Array.from({ length: questionNum }, () => conditions[Math.floor(rng() * 3)]);
    } else {
        // WIN, DRAW, LOSE 모드일 때는 해당 조건으로 통일
        // 예: "DRAW MODE" -> "DRAW"만 가득 채움
        const target = currentMode.split(' ')[0];
        newConditions = Array(questionNum).fill(target);
    }

    setAiSelect(newAiSelect);
    setTargetConditions(newConditions); // 생성된 조건 적용
    setQuestionTurn(0);
    setIsMemoryPhase(true);
    setIsCleared(false);
    setPlayTime(0);
  }, [round, roomData?.seed, roomData?.mode]);

  // --- 3. 로컬 타이머 및 타임아웃 감지 ---
  useEffect(() => {
    if (!isMemoryPhase && !isCleared) {
      timerRef.current = setInterval(() => {
        setPlayTime(prev => prev + 1); // 정수 초 단위
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isMemoryPhase, isCleared]);

  // 1등 통과 후 30초 체크
  useEffect(() => {
    if (roomData?.first_cleared_at && !isCleared) {
      const firstClearedTime = new Date(roomData.first_cleared_at).getTime();
      const checkTimeout = setInterval(() => {
        const now = new Date().getTime();
        if (now - firstClearedTime > 30000) {
          clearInterval(checkTimeout);
          handleGameOverLogic(); // 30초 경과 시 탈락
        }
      }, 1000);
      return () => clearInterval(checkTimeout);
    }
  }, [roomData?.first_cleared_at, isCleared]);

  // --- 4. 게임 로직 ---
  const handleSelect = async (idx: number) => {
    const aiHand = aiSelect[questionTurn];
    const condition = targetConditions[questionTurn];
    let isCorrect = false;

    if (condition === 'DRAW') isCorrect = idx === aiHand;
    else if (condition === 'WIN') isCorrect = (aiHand === 0 && idx === 1) || (aiHand === 1 && idx === 2) || (aiHand === 2 && idx === 0);
    else if (condition === 'LOSE') isCorrect = (aiHand === 0 && idx === 2) || (aiHand === 1 && idx === 0) || (aiHand === 2 && idx === 1);

    if (isCorrect) {
      playClickSound();
      if (questionTurn + 1 === aiSelect.length) {
        // 라운드 클리어
        setIsCleared(true);
        await updateMyStatus(true, playTime);
      } else {
        setQuestionTurn(prev => prev + 1);
      }
    } else {
      handleGameOverLogic(); // 틀리면 즉시 탈락
    }
  };

  const updateMyStatus = async (cleared: boolean, time: number) => {
    if (!currentUserId) return;
    
    // 내가 1등으로 깼는지 확인하여 방 정보 업데이트
    if (cleared && !roomData.first_cleared_at) {
      await supabase.from('rooms').update({ first_cleared_at: new Date().toISOString() }).eq('id', roomId);
    }

    await supabase.from('room_participants')
      .update({ is_cleared: cleared, play_time: time })
      .eq('room_id', roomId).eq('user_id', currentUserId);
  };

  // 모든 유저 클리어 확인 시 다음 라운드 이동
  useEffect(() => {
    const allCleared = participants.length > 0 && participants.every(p => p.is_cleared);
    if (allCleared && participants.some(p => p.user_id === currentUserId && p.is_cleared)) {
      setTimeout(async () => {
        if (currentUserId === roomData?.creator_id) {
          // 방장이 다음 라운드 준비 (시드 및 1등 시간 초기화)
          await supabase.from('rooms').update({ 
            first_cleared_at: null,
            seed: Math.random() 
          }).eq('id', roomId);
        }
        setRound(prev => prev + 1);
      }, 2000);
    }
  }, [participants]);

  const handleGameOverLogic = async () => {
    // 랭킹 계산 및 승점 기록 후 GameOver 호출
    const sorted = [...participants].sort((a, b) => a.play_time - b.play_time);
    const myRank = sorted.findIndex(p => p.user_id === currentUserId) + 1;
    
    await supabase.rpc('update_multiplay_result', {
      target_user_id: currentUserId,
      final_rank: myRank,
      total_players: participants.length
    });

    onGameOver(round, myRank);
  };

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center py-6 animate-in fade-in">
      {/* 상단 정보 */}
      <div className="w-full flex justify-between items-end mb-8">
        <div>
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Round {round}</h2>
          <p className="text-[#FF9900] text-xs font-black uppercase italic mt-1">
            {isCleared ? "Clear! Waiting..." : `Time: ${playTime}s`}
          </p>
        </div>
        {roomData?.first_cleared_at && !isCleared && (
          <div className="text-red-500 text-[10px] font-black uppercase animate-pulse border border-red-500/30 px-2 py-1 rounded">
            Timeout Active!
          </div>
        )}
      </div>

      {/* 타 플레이어 현황 (이름 + 정수 시간) */}
      <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 mb-8 space-y-2">
        {participants.map(p => (
          <div key={p.user_id} className="flex justify-between items-center opacity-80">
            <span className={`text-[10px] font-black uppercase ${p.is_cleared ? 'text-green-400' : 'text-zinc-500'}`}>
              {p.profiles?.display_name} {p.user_id === currentUserId && " (ME)"}
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {p.is_cleared ? `${Math.floor(p.play_time)}s` : "PLAYING"}
            </span>
          </div>
        ))}
      </div>

      {/* 게임 인터페이스 (문제 영역) */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] w-full">
         <div className="text-center mb-10">
            <p className="text-[#FF9900] text-5xl font-black tracking-tighter uppercase leading-none">
               {targetConditions[questionTurn]}
            </p>
            <p className="text-white text-xl font-bold opacity-50 uppercase tracking-tight mt-1">
               {questionTurn} / {aiSelect.length}
            </p>
         </div>

         <div className="flex flex-wrap justify-center gap-2 mb-10">
            {aiSelect.map((hand, i) => (
               <div key={i} className={`w-12 h-12 rounded-2xl bg-zinc-900 border-2 transition-all 
                  ${i < questionTurn || isMemoryPhase ? 'border-zinc-700' : (i === questionTurn ? 'border-[#FF9900] shadow-[0_0_15px_#FF990044]' : 'border-transparent opacity-20')}`}>
                  {(isMemoryPhase || i < questionTurn) && (
                    <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-contain p-2" />
                  )}
               </div>
            ))}
         </div>
      </div>

      {/* 조작 버튼 영역 */}
      <div className="w-full flex justify-center mt-auto">
        {isMemoryPhase ? (
          <button onClick={() => setIsMemoryPhase(false)} className="text-[#FF9900] text-3xl font-black italic uppercase animate-pulse">I Got It</button>
        ) : (
          <div className="flex gap-4 w-full px-2">
            {['rock', 'paper', 'scissor'].map((type) => (
              <button 
                key={type} 
                disabled={isCleared}
                onClick={() => handleSelect(type === 'rock' ? 1 : type === 'paper' ? 2 : 0)} 
                className="flex-1 aspect-square rounded-3xl bg-zinc-900 border border-zinc-800 active:scale-90 transition-all flex items-center justify-center p-4 disabled:opacity-20"
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