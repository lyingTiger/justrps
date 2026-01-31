import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface MultiplayPageProps {
  selectedMode: string;
  onBack: () => void;
  onJoin: (roomId: string) => void;
}

export default function MultiplayPage({ selectedMode, onBack, onJoin }: MultiplayPageProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    fetchRooms();

    // 🚀 [START] 실시간 방 목록 구독 (DELETE 포함) 🚀
    const channel = supabase.channel('lobby_rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms(); // 생성, 수정, 삭제 발생 시 목록 갱신
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchRooms = async () => {
    // 대기 중인(waiting) 방만 가져오기
    const { data } = await supabase.from('rooms').select('*').eq('status', 'waiting').order('created_at', { ascending: false });
    if (data) setRooms(data);
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. 방 생성
    const { data: room, error: roomError } = await supabase.from('rooms').insert({
      name: newRoomName,
      creator_id: user.id,
      mode: selectedMode,
      max_players: 4,
      status: 'waiting',
      seed: Math.random()
    }).select().single();

    if (room) {
      // 2. 참여자 목록에 방장 추가
      await supabase.from('room_participants').insert({ room_id: room.id, user_id: user.id });
      onJoin(room.id);
    }
  };

  return (
    <div className="w-full max-w-[340px] flex flex-col py-10 px-4 animate-in fade-in">
      <div className="flex justify-between items-end mb-10">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">Lobby</h2>
        <button onClick={onBack} className="text-zinc-500 text-[10px] font-bold uppercase underline pb-1">Back</button>
      </div>

      <div className="space-y-3 mb-8">
        {rooms.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
            <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest">No Rooms Available</p>
          </div>
        ) : (
          rooms.map(room => (
            <button 
              key={room.id}
              onClick={() => onJoin(room.id)}
              className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-[28px] flex justify-between items-center hover:border-[#FF9900] transition-all group"
            >
              <div className="text-left">
                <p className="text-white font-black italic uppercase text-sm group-hover:text-[#FF9900] transition-colors">{room.name}</p>
                <p className="text-zinc-500 text-[9px] font-bold uppercase mt-1">{room.mode}</p>
              </div>
              <div className="text-right">
                <p className="text-[#FF9900] font-mono font-bold text-sm">{room.current_players} / {room.max_players}</p>
                <p className="text-zinc-600 text-[8px] font-bold uppercase tracking-tighter">Players</p>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="mt-auto space-y-4">
        {isCreating ? (
          <div className="space-y-3 animate-in slide-in-from-bottom-5">
            <input 
              autoFocus
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Enter Room Name..."
              className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 text-white outline-none focus:border-[#FF9900] transition-all font-bold text-sm"
            />
            <div className="flex gap-2">
              <button onClick={() => setIsCreating(false)} className="flex-1 h-14 bg-zinc-900 text-zinc-500 font-black uppercase rounded-2xl text-xs">Cancel</button>
              <button onClick={handleCreateRoom} className="flex-[2] h-14 bg-[#FF9900] text-black font-black uppercase rounded-2xl text-xs shadow-lg shadow-orange-500/20">Create & Enter</button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setIsCreating(true)}
            className="w-full h-16 bg-white text-black font-black uppercase rounded-2xl text-lg shadow-xl active:scale-95 transition-all"
          >
            Create New Room
          </button>
        )}
      </div>
    </div>
  );
}
// 🚀 [END] 실시간 방 목록 구독 🚀