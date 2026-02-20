import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

interface WaitingRoomProps {
  roomId: string | null;
  onLeave: () => void;
  onStartGame: () => void;
}

export default function WaitingRoom({ roomId, onLeave, onStartGame }: WaitingRoomProps) {
  // --- State ---
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isGracePeriod, setIsGracePeriod] = useState(true);
  
  // 강퇴 관련 UI State
  const [kickTargetId, setKickTargetId] = useState<string | null>(null); 
  const [showKickedModal, setShowKickedModal] = useState(false);        

  // --- Refs ---
  const userIdRef = useRef<string | null>(null);     
  const isExiting = useRef(false);                   
  const hasJoinedRef = useRef(false);                
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isCreatorRef = useRef(false);

  // 🔊 효과음
  const playBeep = () => {
    try {
      const audio = new Audio('/sound/beepbeep.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.error("Sound play failed:", e));
    } catch (err) { console.error(err); }
  };

  // 🔄 1. 참가자 명단 조회
  const fetchParticipants = async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from('room_participants')
      .select('*, profiles(display_name)') 
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });
    
    if (data) setParticipants(data);
  };

  // 🔄 2. 방 상태 조회 (🔥 납치 방지 로직 적용)
  const fetchRoomStatus = async () => {
    if (!roomId) return;
    
    // maybeSingle()을 사용하여 방이 없을 경우 에러 대신 null을 받습니다.
    const { data: room, error } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
    
    if (error || !room) {
      console.warn("방을 찾을 수 없습니다.");
      onLeave();
      return;
    }

    setRoomInfo(room);
    if (userIdRef.current) isCreatorRef.current = (room.creator_id === userIdRef.current);
    
    // 🔥 [핵심] 방이 게임 중이고 내가 Ready 상태일 때만 게임 화면으로 진입
    if (room.status === 'playing' && userIdRef.current) {
      const { data: me } = await supabase
        .from('room_participants')
        .select('is_ready')
        .eq('room_id', roomId)
        .eq('user_id', userIdRef.current)
        .maybeSingle();
        
      if (me && me.is_ready) {
        console.log("⏰ Polling: Room is playing & I am Ready -> Joining!");
        isExiting.current = true;
        onStartGame();
      }
    }
  };

  // 👑 방장 권한 승계
  const leaveRoomWithSuccession = async () => {
    if (!userIdRef.current || !roomId) return;

    if (isCreatorRef.current) {
        const { data: others } = await supabase
            .from('room_participants')
            .select('*')
            .eq('room_id', roomId)
            .neq('user_id', userIdRef.current)
            .order('joined_at', { ascending: true }) 
            .limit(1);

        if (others && others.length > 0) {
            await supabase.from('rooms').update({ creator_id: others[0].user_id }).eq('id', roomId);
        } else {
            await supabase.from('rooms').delete().eq('id', roomId);
            return; 
        }
    }
    await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', userIdRef.current);
  };


  // --- Main Effect ---
  useEffect(() => {
    if (!roomId) return;

    // 1. 유예 시간(Grace Period) 가동: 방 입장/복귀 시 5초간 오프라인 판정 유예
    setIsGracePeriod(true);
    const graceTimer = setTimeout(() => setIsGracePeriod(false), 5000);

    // 2. 비동기 초기화 함수 (순서 보장)
    const initWaitingRoom = async () => {
      // [핵심] 유저 정보를 먼저 기다려서 가져옵니다.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);
      userIdRef.current = user.id;

      // 초기 상태 업데이트
      fetchRoomStatus();
      fetchParticipants();

      // [핵심] 유저 ID가 확보된 상태에서 채널을 생성합니다.
      const channel = supabase.channel(`room_${roomId}`, {
        config: { 
          broadcast: { self: true }, 
          presence: { key: user.id } // 확실하게 유저 ID 주입
        },
      });

      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, () => {
          fetchParticipants();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, async (payload) => {
          const newRoom = payload.new as any;
          setRoomInfo(newRoom);
          if (userIdRef.current) isCreatorRef.current = (newRoom.creator_id === userIdRef.current);
          
          if (newRoom.status === 'playing' && userIdRef.current) {
            const { data: me } = await supabase.from('room_participants').select('is_ready').eq('room_id', roomId).eq('user_id', userIdRef.current).single();
            if (me && me.is_ready) {
              isExiting.current = true;
              onStartGame();
            }
          }
        })
        .on('broadcast', { event: 'force_start_game' }, () => {
          isExiting.current = true;
          onStartGame();
        })
        .on('broadcast', { event: 'alert_unready' }, (payload) => {
          if (payload.payload?.targetIds?.includes(userIdRef.current)) playBeep();
        })
        .on('presence', { event: 'sync' }, () => {
          const newState = channel.presenceState();
          const connectedIds = new Set<string>();
          Object.values(newState).forEach((presences: any) => {
            presences.forEach((p: any) => { if (p.user_id) connectedIds.add(p.user_id); });
          });
          setOnlineUserIds(connectedIds);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // 유저 ID가 확실히 있으므로 track이 정상 작동합니다.
            await channel.track({ user_id: user.id, joined_at: new Date().toISOString() });
          }
        });

      channelRef.current = channel;
    };

    initWaitingRoom();

    const refreshInterval = setInterval(() => {
      fetchParticipants();
      fetchRoomStatus(); 
    }, 3000);

    const handleBeforeUnload = async () => { await leaveRoomWithSuccession(); };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(graceTimer); // 유예 타이머 클린업
      clearInterval(refreshInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [roomId]); // roomId가 바뀔 때마다 재실행


  // 💉 방에 입장(또는 복귀)한 후 5초간은 오프라인 판정을 유예합니다.
  useEffect(() => {
    setIsGracePeriod(true);
    const timer = setTimeout(() => {
      setIsGracePeriod(false);
    }, 5000); // 5초 후부터 오프라인 체크 시작
    return () => clearTimeout(timer);
  }, [roomId]); // 방에 들어올 때마다 타이머 작동


  // --- 강퇴 감지 ---
  useEffect(() => {
  if (!currentUserId || participants.length === 0) return;

  // 💉 [추가] 방 상태가 이미 게임 중(playing)이라면 강퇴 로직을 건너뜁니다.
  // (화면 전환 중 데이터 비동기화로 인한 오판 방지)
  if (roomInfo?.status === 'playing') return;

    const isMeInList = participants.some(p => p.user_id === currentUserId);
    
    if (isMeInList) {
      hasJoinedRef.current = true; 
    } else {
      // 💉 isExiting.current가 true면(게임 진입 중이면) 모달을 띄우지 않습니다.
      if (hasJoinedRef.current && !isExiting.current) {
        console.log("🚨 강퇴당함이 감지되었습니다.");
        setShowKickedModal(true); 
      }
    }
  // 💉 [수정] roomInfo?.status를 의존성 배열에 추가
  }, [participants, currentUserId, roomInfo?.status]);


  // --- Handlers ---
  const handleManualExit = async () => {
    isExiting.current = true; 
    await leaveRoomWithSuccession();
    onLeave();
  };

  const openKickModal = (targetUserId: string) => setKickTargetId(targetUserId);
  const executeKick = async () => {
    if (!roomId || !kickTargetId) return;
    const { error } = await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', kickTargetId);
    if (error) alert("강퇴 실패");
    setKickTargetId(null);
  };

  const handleToggleReady = async () => {
    if (!currentUserId || !roomId) return;
    
    // 🔥 [추가] 방이 아직 게임 중이면 레디 금지 (alert 추가)
    if (roomInfo?.status === 'playing') {
        alert("방장이 이전 게임을 정리 중입니다. 잠시만 기다려 주세요.");
        return;
    }

    const meIndex = participants.findIndex(p => p.user_id === currentUserId);
    if (meIndex === -1) return;
    const me = participants[meIndex];
    const newReadyState = !me.is_ready;

    const nextParticipants = [...participants];
    nextParticipants[meIndex] = { ...me, is_ready: newReadyState };
    setParticipants(nextParticipants);

    const { error } = await supabase.from('room_participants')
      .update({ is_ready: newReadyState })
      .eq('room_id', roomId).eq('user_id', currentUserId);

    if (error) {
        nextParticipants[meIndex] = { ...me, is_ready: !newReadyState };
        setParticipants([...nextParticipants]);
    }
  };

  const handleStart = async () => {
    if (!roomId || !roomInfo) return;
    if (participants.length > 1) {
        const creatorId = roomInfo?.creator_id || currentUserId; 
        const unreadyUsers = participants.filter(p => p.user_id !== creatorId && !p.is_ready);
        if (unreadyUsers.length > 0) {
          if (channelRef.current) {
              const targetIds = unreadyUsers.map(p => p.user_id);
              await channelRef.current.send({
                type: 'broadcast', event: 'alert_unready', payload: { targetIds }
              });
          }
          return; 
        }
    }

    const randomSeed = Math.floor(Math.random() * 10000); 

    // 1. DB 업데이트: status는 playing으로, 선두 기록은 null로 확실히 초기화!
    const { error } = await supabase.from('rooms')
      .update({ 
        status: 'playing', 
        seed: randomSeed,
        first_cleared_at: null // ✨ 게임 시작 시 무조건 비우고 시작
      })
      .eq('id', roomId);

    if (!error) {
      if (channelRef.current) {
          await channelRef.current.send({ type: 'broadcast', event: 'force_start_game', payload: {} });
      }
      isExiting.current = true; 
      onStartGame();
    }
  };


  // --- Render ---
  const isCreator = roomInfo?.creator_id === currentUserId;
  const isAllReady = participants.length > 1 && participants.every(p => p.user_id === roomInfo?.creator_id || p.is_ready);
  const myInfo = participants.find(p => p.user_id === currentUserId);

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center mt-6 px-4 animate-in fade-in select-none">
      <div className="w-full flex justify-between items-end mb-6">
        <div>
           {/* 🔻 [수정] 방 코드(UUID) <p> 태그 삭제함 */}
           <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
             {roomInfo?.name || "Loading..."}
           </h2>
        </div>
        
        {/* 🔻 [수정] Leave 버튼 디자인을 MultiplayPage의 Back 버튼과 동일하게 변경 */}
        <button 
          onClick={handleManualExit} 
          className="px-4 py-1 bg-zinc-900 text-white text-[10px] font-black uppercase border border-zinc-800 rounded-[10px] transition-all hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
        >
          Leave
        </button>
      </div>

      <div className="w-full space-y-2 mb-8">
        {participants.map((p) => {
  const isHost = p.user_id === roomInfo?.creator_id;
  const isMe = p.user_id === currentUserId;
  const isOnline = onlineUserIds.has(p.user_id); // 대기실 채널 접속 여부

  // 1. ✨ [Lobby] 최우선 순위: 실시간 신호가 있다면 무조건 로비에 있는 것입니다.
  const isInLobby = isOnline;

  // 2. ✨ [In Battle] 
  // 신호가 없는데, 아직 죽지(is_dead) 않았고 최종 클리어(is_cleared)도 안 했다면 '무조건' 배틀 중입니다.
  // (방의 status가 'waiting'으로 바뀌었어도 유저 데이터가 그대로면 아직 게임판을 안 떠난 것입니다.)
  const isStillInBattle = !isInLobby && !p.is_dead && !p.is_cleared && p.current_round >= 1;

  // 3. ✨ [Result Screen]
  // 신호가 없는데, 죽었거나 클리어했다면 결과창을 보고 있는 것입니다.
  const isInResultScreen = !isInLobby && (p.is_dead || p.is_cleared);

  // 4. ✨ [Offline] 진짜 튕김
  // 위 세 상황이 모두 아니고, 신호가 5초 이상 없을 때만 오프라인으로 판정합니다.
  const showAsOffline = !isMe && !isInLobby && !isStillInBattle && !isInResultScreen && !isGracePeriod;

  return (
    <div key={p.user_id} className={`w-full p-3 rounded-2xl border flex justify-between items-center transition-all duration-300
      ${isMe ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900 border-zinc-800'}
      ${showAsOffline ? 'border-red-500/40 bg-red-500/5' : ''} 
    `}>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-black italic ${isHost ? 'text-[#FF9900]' : 'text-white'}`}>
            {p.profiles?.display_name || "Unknown"}
          </span>
          {isHost && <span className="text-[8px] bg-[#FF9900] text-black font-bold px-1 rounded shadow-sm">HOST</span>}
          
          {/* ✨ 상태 라벨 (우선순위에 따른 렌더링) */}
          {isInLobby ? (
            <span className="text-[8px] bg-green-900/50 text-green-500 font-black px-1 rounded">LOBBY</span>
          ) : isStillInBattle ? (
            <span className="text-[8px] bg-blue-600 text-white font-black px-1 rounded animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.4)]">IN BATTLE</span>
          ) : isInResultScreen ? (
            <span className="text-[8px] bg-purple-600 text-white font-black px-1 rounded animate-pulse">RESULT SCREEN</span>
          ) : showAsOffline ? (
            <span className="text-[8px] bg-red-600 text-white font-black px-1 rounded shadow-sm">OFFLINE</span>
          ) : (
            <span className="text-[8px] bg-zinc-700 text-zinc-400 font-black px-1 rounded animate-pulse">SYNCING...</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isInLobby ? (
          // 로비에 있을 때만 READY/WAITING 표시
          <span className={`${p.is_ready ? 'text-green-500' : 'text-zinc-600'} font-black text-xs uppercase`}>
            {isHost ? 'Host' : p.is_ready ? 'READY' : 'WAITING'}
          </span>
        ) : isStillInBattle ? (
          <span className="text-blue-400 font-black text-[10px] uppercase italic">
            Round {p.current_round}
          </span>
        ) : isInResultScreen ? (
          <span className="text-purple-400 font-black text-[10px] uppercase italic">Reviewing...</span>
        ) : (
          <span className="text-red-500 font-black text-[10px] uppercase italic tracking-widest">
            {showAsOffline ? 'Disconnected' : 'Connecting...'}
          </span>
        )}
        
        {/* 강퇴 버튼: 나 이외의 모든 유저는 방장이 정리 가능 */}
        {isCreator && !isMe && (
          <button onClick={() => openKickModal(p.user_id)} className="ml-2 w-5 h-5 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-500 text-[10px] hover:bg-red-600 hover:text-white transition-colors">✕</button>
        )}
      </div>
    </div>
  );
})}


        {Array.from({ length: Math.max(0, (roomInfo?.max_players || 2) - participants.length) }).map((_, i) => (
           <div key={`empty-${i}`} className="w-full p-3 rounded-2xl border border-dashed bg-transparent flex justify-center items-center opacity-100"><span className="text-lg font-black uppercase text-[#66cc33] animate-pulse">Waiting...</span></div>
        ))}
      </div>

      <div className="w-full mt-auto">
        {isCreator ? (
          // 1. 방장인 경우: 게임 시작 버튼
          <button 
            onClick={handleStart} 
            disabled={participants.length < 1} 
            className={`w-full h-14 text-white font-black uppercase rounded-2xl border border-zinc-600 text-lg shadow-xl active:scale-95 transition-all 
              ${participants.length < 2 
                ? 'bg-zinc-800 hover:bg-[#FF9900] hover:text-black' 
                : !isAllReady 
                  ? 'bg-green-600 opacity-80' 
                  : 'bg-[#22c55e] animate-pulse hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
              }`}
          >
            {participants.length < 2 ? 'Practice Start' : isAllReady ? 'Start Game' : 'Wait to Ready'}
          </button>
        ) : (
          // 2. 일반 유저인 경우
          <div className="w-full">
            {roomInfo?.status === 'playing' ? (
              // 🚨 방장이 아직 게임 중일 때: 안내 문구 표시
              <div className="w-full py-4 text-center bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <p className="text-blue-400 font-black uppercase italic animate-pulse">
                  Host is in battle... Please wait
                </p>
              </div>
            ) : (
              // ✅ 방장이 로비에 있을 때 (waiting): 레디 버튼 표시!
              <button
                onClick={handleToggleReady}
                className={`w-full h-14 font-black uppercase rounded-2xl border text-lg shadow-xl active:scale-95 transition-all
                  ${myInfo?.is_ready 
                    ? 'bg-green-600 opacity-80' 
                    : 'bg-[#22c55e] animate-pulse hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                  }
                `}
              >
                {myInfo?.is_ready ? 'Cancel Ready' : 'Ready'}
              </button>
            )}
          </div>
        )}
      </div>

      {kickTargetId && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"><div className="w-full max-w-[280px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl border-t-red-500/50 border-t-4"><h3 className="text-white text-lg font-black text-center mb-6">Kick User?</h3><div className="grid grid-cols-2 gap-3"><button onClick={() => setKickTargetId(null)} className="h-12 bg-zinc-800 text-white font-black rounded-xl">Cancel</button><button onClick={executeKick} className="h-12 bg-red-600 text-white font-black rounded-xl">Confirm</button></div></div></div>}
      
      {showKickedModal && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"><div className="w-full max-w-[280px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl border-t-red-500 border-t-4 text-center"><h3 className="text-white text-xl font-black mb-6">Kicked Out</h3><button onClick={onLeave} className="w-full h-12 bg-zinc-800 text-white font-black rounded-2xl">Back to Lobby</button></div></div>}
    </div>
  );
}