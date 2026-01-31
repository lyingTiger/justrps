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

  // 비밀번호 확인용 상태
  const [showPassModal, setShowPassModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [passInput, setPassInput] = useState('');

  // 🚀 [START] 실시간 동기화: INSERT, UPDATE, DELETE 모두 감시 🚀
  useEffect(() => {
    fetchRooms();

    const subscription = supabase.channel('lobby_v4_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        setTimeout(fetchRooms, 100); // DB 트리거 처리를 위한 미세한 간격
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

const fetchRooms = async () => {
  const { data } = await supabase
    .from('rooms')
    .select('*')
    .eq('status', 'waiting')
    // .gt('current_players', 0) // 👈 이 줄이 있으면 인원수 갱신 전까지 방이 안 보입니다. 과감히 지우세요!
    .order('created_at', { ascending: false });
  if (data) setRooms(data);
};
  

  // 방 입장 시도 (비밀번호 체크 포함)
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
    const { error } = await supabase.from('room_participants').insert({ room_id: roomId, user_id: user.id });
    if (!error) onJoin(roomId);
    else alert("방 입장에 실패했습니다.");
  };

  // 🛠️ [복구] 방 생성 로직 🛠️
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      alert("방 이름을 입력해주세요!");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

const { data: room } = await supabase.from('rooms').insert({
    name: newRoomName,
    password: password || null,
    max_players: maxPlayers,
    current_players: 1, // 👈 0 대신 1로 시작하면 리스트에서 즉시 보입니다.
    mode: selectedMode,
    creator_id: user.id,
    status: 'waiting',
    seed: Math.random()
  }).select().single();

  if (room) {
  // 🚀 [중요] await를 붙여서 참가가 확실히 완료된 후 화면을 넘깁니다.
  await supabase.from('room_participants').insert({ 
    room_id: room.id, 
    user_id: user.id 
  });
  
  onJoin(room.id);
}   
};

  // 🛠️ [복구] 랜덤 입장 (Quick Match) 🛠️
  const handleQuickMatch = () => {
    const publicRooms = rooms.filter(r => !r.password && r.current_players < r.max_players);
    if (publicRooms.length > 0) {
      const randomRoom = publicRooms[Math.floor(Math.random() * publicRooms.length)];
      executeJoin(randomRoom.id);
    } else {
      alert("입장 가능한 공개 방이 없습니다.");
    }
  };

  const filteredRooms = rooms.filter(r => r.name.toLowerCase().includes(searchName.toLowerCase()));

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center mt-6 px-4 animate-in fade-in relative">
      <div className="w-full flex justify-between items-end mb-6">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#FF9900]">Multi</h2>
        <button onClick={onBack} className="text-zinc-500 text-[10px] font-bold uppercase underline pb-1">Back</button>
      </div>

      {/* 🛠️ [UI 복구] 방 생성 및 옵션 영역 🛠️ */}
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
          {/* 비밀번호 입력 필드 */}
          <input 
            type="password" 
            placeholder="PASSWORD (OPTIONAL)" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 h-11 bg-black border border-zinc-800 rounded-2xl px-4 text-[10px] text-white outline-none focus:border-[#FF9900] font-bold" 
          />
          {/* 최대 인원수 선택 영역 */}
          <div className="flex items-center gap-1 bg-black border border-zinc-800 rounded-2xl px-2">
            {[2, 3, 4].map(n => (
              <button key={n} onClick={() => setMaxPlayers(n)} className={`w-7 h-7 text-[10px] font-black rounded-lg transition-all ${maxPlayers === n ? 'bg-[#FF9900] text-black' : 'text-zinc-700'}`}>{n}P</button>
            ))}
          </div>
        </div>

        {/* 🛠️ [UI 복구] 퀵 매치 버튼 🛠️ */}
        <button 
          onClick={handleQuickMatch}
          className="w-full h-11 bg-zinc-800 text-white font-black uppercase rounded-2xl text-[10px] active:scale-95 transition-all border border-zinc-700 hover:bg-zinc-700"
        >
          Quick Match (Random Join)
        </button>
      </div>

      {/* 🛠️ [UI 복구] 방 목록 영역 🛠️ */}
      <div className="w-full flex flex-col gap-2">
        <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1 ml-2">Active Rooms</h3>
        <div className="w-full h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {filteredRooms.length === 0 ? (
            <div className="w-full py-10 text-center border border-dashed border-zinc-800 rounded-[24px] opacity-20">
              <p className="text-[10px] font-black uppercase tracking-widest">No Active Sessions</p>
            </div>
          ) : (
            filteredRooms.map(room => (
              <div key={room.id} onClick={() => handleJoinAttempt(room)} className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-[24px] flex justify-between items-center cursor-pointer hover:border-[#FF9900] group transition-all active:scale-[0.98]">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    {/* 대소문자 그대로 출력 */}
                    <span className="font-black text-sm italic text-white group-hover:text-[#FF9900]">{room.name}</span>
                    {room.password && <span className="text-[10px] opacity-40">🔒</span>}
                  </div>
                  <span className="text-[9px] text-zinc-600 font-black uppercase tracking-tighter">{room.mode}</span>
                </div>
                <div className="text-right">
                  <span className="text-[#FF9900] font-mono font-black text-sm italic">{room.current_players}/{room.max_players}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 🛠️ [UI 복구] 비밀번호 확인 모달 🛠️ */}
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
              className="w-full h-12 bg-black border border-zinc-800 rounded-2xl px-4 text-center text-sm text-white outline-none focus:border-[#FF9900] mb-4 font-bold" 
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setShowPassModal(false); setPassInput(''); }} className="h-12 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl">Cancel</button>
              <button 
                onClick={() => { 
                  if (passInput === selectedRoom.password) { executeJoin(selectedRoom.id); setShowPassModal(false); } 
                  else { alert("비밀번호가 틀렸습니다."); setPassInput(''); } 
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