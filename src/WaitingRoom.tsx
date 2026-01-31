import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!roomId) return;
    
    const initWaitingRoom = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      setRoomInfo(room);
      fetchParticipants();
    };

    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('room_participants')
        .select('*, profiles(display_name)')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true }); // [ADD] 들어온 순서대로 정렬
      if (data) setParticipants(data);
    };

    initWaitingRoom();

    // [UPDATE] 방 정보(creator_id 포함)와 참여자를 통합 구독
    const roomChannel = supabase.channel(`room_sync_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        setRoomInfo(payload.new);
        if (payload.new.status === 'playing') onStartGame();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => {
        // [ADD] 방이 삭제되면 자동으로 로비로 이동
        alert("방이 삭제되었습니다.");
        onLeave();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, () => {
        fetchParticipants();
      })
      .subscribe();

    return () => { supabase.removeChannel(roomChannel); };
  }, [roomId, onLeave, onStartGame]);

  const handleExit = async () => {
    if (!currentUserId || !roomId) return;
    // 단순히 참여자 명단에서 나를 삭제하면 DB 트리거가 나머지를 처리함
    await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', currentUserId);
    onLeave();
  };

  const handleStart = async () => {
    if (!roomId) return;
    await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId);
  };

  // 현재 유저가 새로운 방장인지 실시간 체크
  const isCreator = roomInfo?.creator_id === currentUserId;

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center py-10 px-4 animate-in fade-in duration-500">
      <div className="text-center mb-10 shrink-0">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#FF9900] leading-none mb-2">Lobby</h2>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] italic">{roomInfo?.name || 'SYNCING...'}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full mb-12">
        {[...Array(roomInfo?.max_players || 2)].map((_, i) => {
          const p = participants[i];
          const isParticipantHost = roomInfo?.creator_id === p?.user_id; // [ADD] 각 슬롯의 방장 여부 확인
          
          return (
            <div key={i} className={`aspect-square rounded-[40px] border-2 flex flex-col items-center justify-center p-5 transition-all duration-500 
                ${p ? (isParticipantHost ? 'bg-zinc-900 border-[#FF9900] shadow-[0_0_20px_#FF990033]' : 'bg-zinc-900 border-zinc-700') : 'bg-transparent border-zinc-800 border-dashed opacity-40'}`}>
              {p ? (
                <>
                  <div className={`w-14 h-14 rounded-2xl mb-3 flex items-center justify-center border font-black text-xl italic ${isParticipantHost ? 'bg-zinc-800 border-[#FF9900] text-[#FF9900]' : 'bg-zinc-700 border-zinc-600 text-zinc-400'}`}>
                    {p.profiles?.display_name?.[0]}
                  </div>
                  <span className="text-[11px] font-black text-white tracking-tighter line-clamp-1">{p.profiles?.display_name}</span>
                  <span className={`text-[8px] font-bold uppercase mt-1 px-2 py-0.5 rounded-full ${isParticipantHost ? 'bg-[#FF9900] text-black' : 'text-zinc-500'}`}>
                    {isParticipantHost ? 'Host' : 'Ready'}
                  </span>
                </>
              ) : (
                <span className="text-[9px] text-zinc-800 font-bold uppercase animate-pulse">Waiting...</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full space-y-3">
        {isCreator ? (
          <button onClick={handleStart} disabled={participants.length < 2} className="w-full h-16 bg-white text-black font-black uppercase rounded-2xl text-lg shadow-[0_0_20px_#ffffff33] active:scale-95 transition-all disabled:opacity-30">Start Session</button>
        ) : (
          <div className="w-full h-16 flex items-center justify-center bg-zinc-900 rounded-2xl text-zinc-500 font-black uppercase italic border border-zinc-800 animate-pulse">Wait for Host...</div>
        )}
        <button onClick={handleExit} className="w-full h-12 text-zinc-600 font-bold uppercase tracking-widest text-[10px] hover:text-[#FF9900] transition-colors">Exit Lobby</button>
      </div>
    </div>
  );
}