import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface WaitingRoomProps {
  roomId: string | null;
  onLeave: () => void;
}

export default function WaitingRoom({ roomId, onLeave }: WaitingRoomProps) {
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  useEffect(() => {
    if (!roomId) return;
    
    // 1. 방 정보 및 초기 참여자 가져오기
    const initRoom = async () => {
      const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      setRoomInfo(room);
      
      const { data: parts } = await supabase.from('room_participants').select('*, profiles(display_name)').eq('room_id', roomId);
      if (parts) setParticipants(parts);
    };

    initRoom();

    // 2. 실시간 구독 (참여자 변경 감지)
    const channel = supabase.channel(`room_${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, () => {
        // 인원 변경 시 다시 데이터 로드
        supabase.from('room_participants').select('*, profiles(display_name)').eq('room_id', roomId).then(({ data }) => {
           if (data) setParticipants(data);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center mt-10 px-4 animate-in fade-in duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#FF9900] leading-none mb-2">Waiting</h2>
        <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em]">{roomInfo?.name || 'Loading...'}</p>
      </div>

      {/* 4인 슬롯 레이아웃 */}
      <div className="grid grid-cols-2 gap-3 w-full mb-10">
        {[...Array(roomInfo?.max_players || 2)].map((_, i) => {
          const p = participants[i];
          return (
            <div key={i} className={`aspect-square rounded-[32px] border-2 flex flex-col items-center justify-center p-4 transition-all duration-500 ${p ? 'bg-zinc-900 border-[#FF9900] shadow-[0_0_20px_rgba(255,153,0,0.1)]' : 'bg-transparent border-zinc-800 border-dashed opacity-30'}`}>
              {p ? (
                <>
                  <div className="w-12 h-12 bg-[#FF9900] rounded-full mb-2 flex items-center justify-center text-black font-black text-xl italic uppercase leading-none">
                    {p.profiles?.display_name[0]}
                  </div>
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter text-center line-clamp-1">{p.profiles?.display_name}</span>
                  <span className="text-[8px] text-[#FF9900] font-bold uppercase mt-1">Ready</span>
                </>
              ) : (
                <span className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest animate-pulse">Waiting...</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full space-y-3">
        <button className="w-full h-16 bg-white text-black font-black uppercase rounded-2xl text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50">Start Session</button>
        <button onClick={onLeave} className="w-full h-12 bg-zinc-900 text-zinc-500 font-bold uppercase rounded-xl text-[10px] hover:text-red-500 transition-colors">Exit Lobby</button>
      </div>
    </div>
  );
}