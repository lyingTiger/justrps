import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface MultiplayPageProps {
  selectedMode: string;
  onBack: () => void;
  onJoin: (roomId: string) => void;
}

export default function MultiplayPage({ selectedMode, onBack, onJoin }: MultiplayPageProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [searchName, setSearchName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);

  const [showPassModal, setShowPassModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [passInput, setPassInput] = useState('');

  // 🚀 [START] 실시간 방 목록 동기화 로직 🚀
  useEffect(() => {
    fetchRooms();

    // 'rooms' 테이블의 모든 변화(INSERT, UPDATE, DELETE)를 구독합니다.
    const subscription = supabase.channel('lobby_room_updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms' }, 
        (payload) => {
          console.log("Realtime Update:", payload);
          fetchRooms(); // 변화가 감지되면 목록을 새로고침합니다.
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(subscription); 
    };
  }, []);
  // 🚀 [END] 실시간 방 목록 동기화 로직 🚀

  const fetchRooms = async () => {
    // 대기 중인(waiting) 방만 가져오며, 최신순으로 정렬합니다.
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });
    if (data) setRooms(data);
  };

  const handleJoinAttempt = (room: any) => {
    if (room.current_players >= room.max_players) {
      alert("방이 가득 찼습니다!");
      return;
    }
    if (room.password) {
      setSelectedRoom(room);
      setShowPassModal(true);
    } else {
      executeJoin(room.id);
    }
  };

  const executeJoin = async (roomId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 참여자 테이블에 추가 (이 작업은 DB 트리거를 통해 rooms의 인원수를 변경시킵니다)
    const { error: partError } = await supabase
      .from('room_participants')
      .insert({ room_id: roomId, user_id: user.id });

    if (!partError) {
      onJoin(roomId);
    } else {
      console.error("Join Error:", partError);
      alert("방 입장에 실패했습니다.");
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      alert("방 이름을 입력해주세요!");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }

    // ✨ [START] 방 생성 및 자동 참여 로직 ✨
    const { data: roomData, error: roomError } = await supabase.from('rooms').insert({
      name: newRoomName,
      password: password || null,
      max_players: maxPlayers,
      current_players: 0, // 트리거가 자동으로 1로 올려줄 것이므로 0으로 시작하거나 생략 가능
      mode: selectedMode,
      creator_id: user.id,
      status: 'waiting',
      seed: Math.random() // 멀티플레이 동기화를 위한 랜덤 시드 생성
    }).select().single();

    if (roomError) {
      console.error("Room Creation Error:", roomError);
      alert("방 생성에 실패했습니다.");
      return;
    }

    if (roomData) {
      await supabase.from('room_participants').insert({
        room_id: roomData.id,
        user_id: user.id
      });
      onJoin(roomData.id);
    }
    // ✨ [END] 방 생성 및 자동 참여 로직 ✨
  };

  // 🛠️ [START] 닉네임/방이름 대소문자 유지 🛠️
  // 검색 시에는 대소문자를 구분하지 않도록 처리합니다.
  const filteredRooms = rooms.filter(r => r.name.toLowerCase().includes(searchName.toLowerCase()));
  // 🛠 [END] 닉네임/방이름 대소문자 유지 🛠️

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center mt-6 px-4 animate-in fade-in duration-500 relative">
      <div className="w-full flex justify-between items-end mb-6">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#FF9900]">Multi</h2>
        <button onClick={onBack} className="text-zinc-500 text-[10px] font-bold uppercase underline pb-1">Back</button>
      </div>

      {/* 방 생성 및 검색 UI */}
      <div className="w-full space-y-3 mb-8 bg-zinc-900/30 p-4 rounded-[32px] border border-zinc-800/50">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="ROOM NAME / SEARCH" 
            value={newRoomName}
            onChange={(e) => { setNewRoomName(e.target.value); setSearchName(e.target.value); }}
            className="flex-1 h-12 bg-black border border-zinc-800 rounded-2xl px-4 text-xs text-white outline-none focus:border-[#FF9900] font-bold" 
          />
          <button onClick={handleCreateRoom} className="px-6 bg-[#FF9900] text-black font-black uppercase rounded-2xl text-xs active:scale-95 transition-all shadow-[0_5px_15px_rgba(255,153,0,0.3)]">Create</button>
        </div>
        <div className="flex gap-2">
          <input 
            type="password" 
            placeholder="PASSWORD (OPTIONAL)" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 h-11 bg-black border border-zinc-800 rounded-2xl px-4 text-[10px] text-white outline-none focus:border-[#FF9900] font-bold" 
          />
          <div className="flex items-center gap-1 bg-black border border-zinc-800 rounded-2xl px-2">
            {[2, 3, 4].map(n => (
              <button key={n} onClick={() => setMaxPlayers(n)} className={`w-7 h-7 text-[10px] font-black rounded-lg transition-all ${maxPlayers === n ? 'bg-[#FF9900] text-black' : 'text-zinc-700'}`}>{n}P</button>
            ))}
          </div>
        </div>
        <button 
          onClick={() => {
            const pubRooms = rooms.filter(r => !r.password);
            if(pubRooms.length > 0) handleJoinAttempt(pubRooms[Math.floor(Math.random()*pubRooms.length)]);
            else alert("No public rooms.");
          }}
          className="w-full h-11 bg-zinc-800 text-white font-black uppercase rounded-2xl text-[10px] active:scale-95 transition-all border border-zinc-700 hover:bg-zinc-700"
        >
          Quick Match (Random)
        </button>
      </div>

      {/* 방 목록 리스트 */}
      <div className="w-full flex flex-col gap-2">
        <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1 ml-2">Active Rooms</h3>
        <div className="w-full h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {filteredRooms.map(room => (
            <div key={room.id} onClick={() => handleJoinAttempt(room)} className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-[24px] flex justify-between items-center cursor-pointer hover:border-[#FF9900] group transition-all active:scale-[0.98]">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  {/* 🛠️ [UPDATE] 방 이름 대소문자 구분 유지: uppercase 제거 🛠️ */}
                  <span className="font-black text-sm italic text-white group-hover:text-[#FF9900]">{room.name}</span>
                  {room.password && <span className="text-[10px] opacity-40">🔒</span>}
                </div>
                <span className="text-[9px] text-zinc-600 font-black uppercase tracking-tighter">{room.mode}</span>
              </div>
              <div className="text-right">
                <span className="text-[#FF9900] font-mono font-black text-sm italic">{room.current_players}/{room.max_players}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 비밀번호 모달 */}
      {showPassModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-[280px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-[#FF9900] text-xs font-black uppercase tracking-widest text-center mb-4 italic">Private Room</h3>
            <input 
              type="password" 
              placeholder="ENTER PASSWORD" 
              autoFocus
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              className="w-full h-12 bg-black border border-zinc-800 rounded-2xl px-4 text-center text-sm text-white outline-none focus:border-[#FF9900] mb-4"
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setShowPassModal(false); setPassInput(''); }} className="h-12 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl">Cancel</button>
              <button 
                onClick={() => {
                  if (passInput === selectedRoom.password) { executeJoin(selectedRoom.id); setShowPassModal(false); }
                  else { alert("Incorrect Password"); setPassInput(''); }
                }} 
                className="h-12 bg-[#FF9900] text-black text-[10px] font-black uppercase rounded-xl"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}