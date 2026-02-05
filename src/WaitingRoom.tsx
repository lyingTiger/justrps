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
    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (room) {
        setRoomInfo(room);
        if (userIdRef.current) isCreatorRef.current = (room.creator_id === userIdRef.current);
        
        // 🔥 [핵심 수정] 방이 게임 중(playing)이라도, 내가 'Ready' 상태일 때만 따라들어감!
        if (room.status === 'playing' && userIdRef.current) {
            const { data: me } = await supabase
                .from('room_participants')
                .select('is_ready')
                .eq('room_id', roomId)
                .eq('user_id', userIdRef.current)
                .single();
            
            // "나 레디 했어?" 확인 후 진입
            if (me && me.is_ready) {
                console.log("⏰ Polling: Room is playing & I am Ready -> Joining!");
                onStartGame();
            } else {
                console.log("🛡️ Polling: Room is playing but I am NOT Ready -> Stay.");
            }
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
           
           // 🔥 [핵심 수정] DB 이벤트가 와도 'Ready' 체크 필수!
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
        // (E) 유저 이탈
        .on('presence', { event: 'leave' }, async ({ leftPresences }) => {
            if (isCreatorRef.current) {
                for (const leftUser of leftPresences) {
                    await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', leftUser.user_id);
                }
            }
        })
        .subscribe((status) => {
           if (status === 'SUBSCRIBED') {
              channelRef.current = channel;
              if (userIdRef.current) channel.track({ user_id: userIdRef.current });
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
    if (!currentUserId || participants.length === 0) return;
    const isMeInList = participants.some(p => p.user_id === currentUserId);
    if (isMeInList) {
      hasJoinedRef.current = true; 
    } else {
      if (hasJoinedRef.current && !isExiting.current) {
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
           <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">
             {roomInfo?.name || "Loading..."}
           </h2>
           <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
             Code: <span className="text-[#FF9900] select-text">{roomId?.slice(0,4).toUpperCase()}</span>
           </p>
        </div>
        <button onClick={handleManualExit} className="text-zinc-500 text-[10px] font-bold uppercase underline pb-1 hover:text-white">Leave</button>
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
           <div key={`empty-${i}`} className="w-full p-3 rounded-2xl border border-dashed border-zinc-800 bg-transparent flex justify-center items-center opacity-30"><span className="text-[10px] font-black uppercase text-zinc-500">Waiting...</span></div>
        ))}
      </div>

      <div className="w-full mt-auto">
        {isCreator ? (
          <button onClick={handleStart} disabled={participants.length < 1} className={`w-full h-16 text-black font-black uppercase rounded-2xl text-lg shadow-xl active:scale-95 transition-all ${participants.length < 2 ? 'bg-[#FF9900] hover:bg-[#ffad33]' : !isAllReady ? 'bg-green-600 opacity-80' : 'bg-[#22c55e] animate-pulse hover:bg-green-400'}`}>
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