import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface WaitingRoomProps {
  roomId: string | null;
  onLeave: () => void;
  onStartGame: () => void;
}

export default function WaitingRoom({ roomId, onLeave, onStartGame }: WaitingRoomProps) {
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const isExiting = useRef(false); // 🚀 [ADD] 중복 퇴장 및 의도치 않은 삭제 방지 🚀

  useEffect(() => {
  if (!roomId) return;
  
  const fetchParticipants = async () => {
    const { data } = await supabase
      .from('room_participants')
      .select('*, profiles(display_name)') 
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });
    
    // 🚀 [보완] 데이터가 있을 때만 업데이트하고, 만약 내가 없으면 잠시 후 재시도
    if (data && data.length > 0) {
      setParticipants(data);
    }
  };

  const initRoom = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    setRoomInfo(room);
    
    // 🚀 [수정] 방 정보를 가져온 후 약간의 시차를 두고 참가자를 불러옵니다.
    setTimeout(fetchParticipants, 200); 
  };

  initRoom();

  const channel = supabase.channel(`room_${roomId}`)
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'rooms', 
      filter: `id=eq.${roomId}` 
    }, (payload) => {
      setRoomInfo(payload.new);
      if (payload.new.status === 'playing') onStartGame();
    })
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'room_participants', 
      filter: `room_id=eq.${roomId}` 
    }, () => {
      // 🚀 [수정] 참가자 변경 이벤트가 올 때도 아주 약간의 지연을 줍니다. (트리거 완료 대기)
      setTimeout(fetchParticipants, 100);
    })
    .subscribe();

    // ✨ [START] 언마운트 시 클린업 (중요!) ✨
    return () => {
      // 이 화면을 완전히 떠날 때만 DB에서 나를 제거합니다.
      if (!isExiting.current && roomId) {
        const leaveRoom = async () => {
           const { data: { user } } = await supabase.auth.getUser();
           if (user) {
             await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', user.id);
           }
        };
        leaveRoom();
      }
      supabase.removeChannel(channel);
    };
    // ✨ [END] ✨
  }, [roomId, onLeave, onStartGame]);


const handleManualExit = async () => {
  if (isExiting.current || !currentUserId || !roomId) return;
  isExiting.current = true;

  try {
    // 🚀 [중요] 'room_participants'에서 나를 지우는 것이 핵심입니다.
    // 그러면 DB 트리거가 감지해서 방 인원수를 줄이고, 0명이면 방을 삭제합니다.
    await supabase.from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', currentUserId);
      
    console.log("퇴장 성공");
  } catch (error) {
    console.error("퇴장 오류:", error);
  } finally {
    onLeave();
  }
};



  const handleStart = async () => {
    if (!roomId) return;
    await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId);
  };

  const isCreator = roomInfo?.creator_id === currentUserId;

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center py-10 px-4 animate-in fade-in">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#FF9900] leading-none mb-2">Lobby</h2>
        <p className="text-zinc-500 text-[10px] font-black uppercase italic">{roomInfo?.name || 'Loading...'}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full mb-12">
        {[...Array(roomInfo?.max_players || 2)].map((_, i) => {
          const p = participants[i];
          const isHost = roomInfo?.creator_id === p?.user_id;
          return (
            <div key={i} className={`aspect-square rounded-[40px] border-2 flex flex-col items-center justify-center p-5 transition-all 
                ${p ? (isHost ? 'bg-zinc-900 border-[#FF9900]' : 'bg-zinc-900 border-zinc-700') : 'bg-transparent border-zinc-800 border-dashed opacity-30'}`}>
              {p ? (
                <>
                  <div className={`w-14 h-14 rounded-2xl mb-3 flex items-center justify-center border font-black text-xl italic ${isHost ? 'bg-zinc-800 border-[#FF9900] text-[#FF9900]' : 'bg-zinc-700 border-zinc-600 text-zinc-400'}`}>
                    {p.profiles?.display_name?.[0] || '?'}
                  </div>
                  <span className="text-[11px] font-black text-white tracking-tighter line-clamp-1">{p.profiles?.display_name}</span>
                  <span className={`text-[8px] font-bold uppercase mt-1 px-2 py-0.5 rounded-full ${isHost ? 'bg-[#FF9900] text-black' : 'text-zinc-500'}`}>
                    {isHost ? 'Host' : 'Ready'}
                  </span>
                </>
              ) : (
                <span className="text-[9px] text-zinc-800 font-bold uppercase">Waiting</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full space-y-3">
        {isCreator ? (
          <button onClick={handleStart} disabled={participants.length < 2} className="w-full h-16 bg-white text-black font-black uppercase rounded-2xl text-lg shadow-xl active:scale-95 disabled:opacity-30">Start Game</button>
        ) : (
          <div className="w-full h-16 flex items-center justify-center bg-zinc-900 rounded-2xl text-zinc-500 font-black uppercase italic border border-zinc-800 animate-pulse">Wait for Host</div>
        )}
        <button onClick={handleManualExit} className="w-full h-12 text-zinc-600 font-bold uppercase tracking-widest text-[10px] hover:text-[#FF9900]">Exit Lobby</button>
      </div>
    </div>
  );
}