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
    
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          setCurrentUserId(user.id);
          userIdRef.current = user.id; 
      }
    };
    fetchUser();

    fetchRoomStatus();
    fetchParticipants();

    const channel = supabase.channel(`room_${roomId}`, {
        config: { broadcast: { self: true }, presence: { key: userIdRef.current || undefined } },
    });

    channel
        // (A) 참가자 변경
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants' }, (payload) => {
           const newRecord = payload.new as any;
           const oldRecord = payload.old as any;
           if ((newRecord?.room_id || oldRecord?.room_id) !== roomId) return;
           fetchParticipants();
        })
        // (B) 방 정보 변경 (DB 이벤트)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' }, async (payload) => {
           const newRoom = payload.new as any;
           if (newRoom.id !== roomId) return;

           setRoomInfo(newRoom);
           if (userIdRef.current) isCreatorRef.current = (newRoom.creator_id === userIdRef.current);
           
           // 🔥 DB 이벤트가 와도 'Ready' 체크 필수!
           if (newRoom.status === 'playing' && userIdRef.current) {
               const { data: me } = await supabase
                   .from('room_participants')
                   .select('is_ready')
                   .eq('room_id', roomId)
                   .eq('user_id', userIdRef.current)
                   .single();
               
               if (me && me.is_ready) {
                   console.log("🎮 DB Event: Game Started & I am Ready -> Go!");
                   onStartGame();
               }
           }
        })
        // (C) 강제 시작 방송 (이건 방장이 눌러야만 오므로 신뢰 가능)
        .on('broadcast', { event: 'force_start_game' }, () => {
            console.log("⚡ Game Start via Broadcast!");
            onStartGame();
        })
        // (D) 경고음
        .on('broadcast', { event: 'alert_unready' }, (payload) => {
          if (payload.payload?.targetIds?.includes(userIdRef.current)) {
            playBeep();
          }
        })
        // (E) 유저 이탈 (유령 유저 해결 핵심 영역)
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            // 💉 [수술] 방장만 이탈자의 사후 처리를 수행합니다.
            if (!isCreatorRef.current) return; 

            console.log("👋 연결 끊김 감지, 사후 처리 시작:", leftPresences);
            
            leftPresences.forEach(async (p: any) => {
                const leftUserId = p.user_id;
                if (!leftUserId) return;

                // 🚀 비정상 종료 유저를 'is_dead' 처리하여 게임 엔진이 계속 진행되게 합니다.
                // play_time을 크게 주어 결과창 정렬 시 꼴찌로 처리되게 유도합니다.
                await supabase.from('room_participants')
                    .update({ 
                        is_dead: true, 
                        play_time: 999.99 
                    })
                    .eq('room_id', roomId)
                    .eq('user_id', leftUserId);
                
                console.log(`✅ 유령 유저(${leftUserId}) 탈락 처리 완료`);
            });
        })

        .subscribe((status) => {
           if (status === 'SUBSCRIBED') {
              channelRef.current = channel;
              // 💉 [추가] presence에 내 유저 ID를 태깅합니다.
              if (userIdRef.current) {
                channel.track({ user_id: userIdRef.current });
              }
           }
        });

    // 3초 폴링 (방 상태 & 명단)
    const refreshInterval = setInterval(() => {
        fetchParticipants();
        fetchRoomStatus(); 
    }, 3000);

    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
        e.preventDefault(); 
        await leaveRoomWithSuccession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, onLeave, onStartGame]);


  // --- 강퇴 감지 ---
  useEffect(() => {
  // 💉 내 ID가 없거나 참가자 명단이 아직 로딩 전(0명)이면 판단을 유보합니다.
  if (!currentUserId || participants.length === 0) return;

    const isMeInList = participants.some(p => p.user_id === currentUserId);
    
    if (isMeInList) {
      hasJoinedRef.current = true; 
    } else {
      // 💉 'hasJoinedRef'가 확실히 true인 상태(한번이라도 명단에 있었음)에서만 킥으로 간주
      if (hasJoinedRef.current && !isExiting.current) {
        console.log("🚨 강퇴당함이 감지되었습니다.");
        setShowKickedModal(true); 
      }
    }
  }, [participants, currentUserId]);


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

    // 1. 방송 송출
    if (channelRef.current) {
        await channelRef.current.send({ type: 'broadcast', event: 'force_start_game', payload: {} });
    }

    // 2. DB 업데이트
    const { error } = await supabase.from('rooms').update({ status: 'playing', seed: randomSeed }).eq('id', roomId);
    if (error) console.error(error);
    else onStartGame();
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
           return (
             <div key={p.user_id} className={`w-full p-3 rounded-2xl border flex justify-between items-center transition-all ${isMe ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900 border-zinc-800'}`}>
               <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black italic ${isHost ? 'text-[#FF9900]' : 'text-white'}`}>{p.profiles?.display_name || "Unknown"}</span>
                    {isHost && <span className="text-[8px] bg-[#FF9900] text-black font-bold px-1 rounded">HOST</span>}
                  </div>
                  {isHost && roomInfo?.status === 'playing' && <span className="text-[10px] text-green-500 font-bold uppercase animate-pulse">▶ Playing Round {p.current_round || 1}</span>}
               </div>
               <div className="flex items-center gap-2">
                 {!isHost ? (p.is_ready ? <span className="text-green-500 font-black text-xs uppercase">READY</span> : <span className="text-zinc-600 font-black text-xs uppercase">WAITING</span>) : null}
                 {isCreator && !isMe && <button onClick={() => openKickModal(p.user_id)} className="w-5 h-5 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded shadow-md active:scale-90 transition-all ml-2"><span className="text-[10px] font-bold leading-none pb-[1px]">✕</span></button>}
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
          <button onClick={handleStart} disabled={participants.length < 1} className={`w-full h-14 text-white font-black uppercase rounded-2xl text-lg shadow-xl active:scale-95 transition-all ${participants.length < 2 ? 'bg-zinc-900 hover:bg-[#FF9900] hover:text-black' : !isAllReady ? 'bg-green-600 opacity-80' : 'bg-[#22c55e] animate-pulse hover:bg-green-400'}`}>
            {participants.length < 2 ? 'Practice Start' : isAllReady ? 'Start Game' : 'Wait to Ready'}
          </button>
        ) : (
          <button 
            onClick={handleToggleReady} 
            // 🔥 [수정] 방이 playing 상태면 버튼 비활성화 (레디 못 박게 막음)
            disabled={!myInfo?.is_ready && roomInfo?.status === 'playing'}
            className={`w-full h-16 font-black uppercase rounded-2xl text-lg shadow-xl active:scale-95 transition-all 
                ${myInfo?.is_ready 
                    ? 'bg-[#22c55e] text-black hover:bg-green-400' 
                    : (roomInfo?.status === 'playing') 
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50' // Waiting Host
                        : 'bg-[#4ade80]/50 text-white/80 animate-pulse hover:bg-[#4ade80]/70' // Ready 가능
                }`}
          >
            {myInfo?.is_ready 
                ? 'Ready!' 
                : (roomInfo?.status === 'playing' ? 'Waiting for Host...' : 'Press to Ready')
            }
          </button>
        )}
      </div>

      {kickTargetId && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"><div className="w-full max-w-[280px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl border-t-red-500/50 border-t-4"><h3 className="text-white text-lg font-black text-center mb-6">Kick User?</h3><div className="grid grid-cols-2 gap-3"><button onClick={() => setKickTargetId(null)} className="h-12 bg-zinc-800 text-white font-black rounded-xl">Cancel</button><button onClick={executeKick} className="h-12 bg-red-600 text-white font-black rounded-xl">Confirm</button></div></div></div>}
      
      {showKickedModal && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"><div className="w-full max-w-[280px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl border-t-red-500 border-t-4 text-center"><h3 className="text-white text-xl font-black mb-6">Kicked Out</h3><button onClick={onLeave} className="w-full h-12 bg-zinc-800 text-white font-black rounded-2xl">Back to Lobby</button></div></div>}
    </div>
  );
}