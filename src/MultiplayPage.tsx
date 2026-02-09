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
  const [isItemMode, setIsItemMode] = useState(false); // 아이템 모드 상태 (기본: No Item)

  // 비밀번호 확인용 상태
  const [showPassModal, setShowPassModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [passInput, setPassInput] = useState('');



  useEffect(() => {
    fetchRooms();

    const subscription = supabase.channel('lobby_v4_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        setTimeout(fetchRooms, 100); 
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);



  const fetchRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .in('status', ['waiting', 'playing'])
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
    const { error } = await supabase.from('room_participants').insert({ room_id: roomId, user_id: user.id });
    if (!error) onJoin(roomId);
    else alert("방 입장에 실패했습니다.");
  };



  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: room, error: roomError } = await supabase.from('rooms').insert({
      name: newRoomName,
      password: password || null,
      max_players: maxPlayers,
      current_players: 1,
      mode: selectedMode,
      is_item_mode: isItemMode, 
      creator_id: user.id,
      status: 'waiting',
      seed: Math.random()
    }).select().single();

    if (!room || roomError) {
      alert("방 생성 실패: " + (roomError?.message || "Unknown error"));
      return;
    }

    if (room) {
      await supabase.from('room_participants').insert({ 
        room_id: room.id, 
        user_id: user.id 
      });
      onJoin(room.id);
    }
  };



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
    <div className="w-full max-w-[360px] flex flex-col items-center mt-4 gap-3 px-4">
      <div className="w-full flex justify-end mb-0">
        
        
        <button 
          onClick={onBack} 
          className="px-4 py-1 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl hover:bg-zinc-700 active:scale-95 transition-all border border-zinc-700"
        >
          Back
        </button>
      </div>

      <div className="w-full space-y-3 mb-2 bg-zinc-900/30 p-3 rounded-[12px] border border-zinc-400/50">
        <div className="flex gap-2">
          <input 
            type="text" 
            autoComplete="one-time-code" // 또는 "new-password", "one-time-code"
            placeholder="ROOM NAME / SEARCH" 
            value={newRoomName}
            onChange={(e) => { setNewRoomName(e.target.value); setSearchName(e.target.value); }}
            className="flex-1 h-12 bg-black border border-zinc-800 rounded-2xl px-4 text-xs text-white outline-none focus:border-[#FF9900] font-bold" 
          />
          <button onClick={handleCreateRoom} className="px-6 bg-zinc-800 text-white font-black uppercase rounded-2xl text-xs active:scale-95 transition-all hover:bg-[#ff9933] hover:text-black">Creat</button>
        </div>
        
        <div className="flex gap-2">
          <input 
            type="password" 
            autoComplete="one-time-code" // 또는 "new-password", "one-time-code"
            placeholder="PASSWORD (OPTION)" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 h-11 bg-black border border-zinc-800 rounded-2xl px-4 text-xs text-white outline-none focus:border-[#FF9900] font-bold" 
          />
          <div className="flex items-center gap-1 bg-black border border-zinc-800 rounded-2xl px-2">
            {/* 🔻 [수정 2] 비활성 상태일 때 text-zinc-700 -> text-white로 변경 */}
            {[2, 3, 4].map(n => (
              <button key={n} onClick={() => setMaxPlayers(n)} className={`w-7 h-7 text-[10px] font-black rounded-lg transition-all ${maxPlayers === n ? 'bg-[#FF9900] text-black' : 'text-white'}`}>{n}P</button>
            ))}
          </div>
        </div>


{/* 💉 [추가] 아이템 모드 선택 섹션 */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center justify-around bg-black border border-zinc-800 rounded-2xl h-11 px-2">
            <button 
              onClick={() => setIsItemMode(true)} 
              className={`flex-1 h-7 text-xs font-black rounded-lg transition-all ${isItemMode ? 'bg-[#FF9900] text-black' : 'text-zinc-500'}`}
            >
              ITEM GAME
            </button>
            <button 
              onClick={() => setIsItemMode(false)} 
              className={`flex-1 h-7 text-xs font-black rounded-lg transition-all ${!isItemMode ? 'bg-[#FF9900] text-black' : 'text-zinc-500'}`}
            >
              NO ITEM
            </button>
          </div>
        </div>


        {/* 🔻 [수정 3] 버튼 텍스트 'random join'으로 변경 */}
        <button 
          onClick={handleQuickMatch}
          className="w-full h-11 bg-zinc-800 text-white font-black uppercase rounded-2xl text-xs active:scale-95 active:bg-[#ff9933] active:text-black transition-all border border-zinc-700 hover:bg-[#ff9933] hover:text-black"
        >
          random join
        </button>
      </div>


      <div className="w-full flex flex-col gap-2">
        {/* 🔻 [수정 4] 텍스트 중앙 정렬 (ml-2 제거하고 text-center w-full 추가) */}
        <h3 className="w-full text-center text-sm font-black text-[#ffcc33] uppercase tracking-[0.2em] mb-0">Active Rooms</h3>
        <div className="w-full h-[220px] overflow-y-auto space-y- pr-1 custom-scrollbar">
          {filteredRooms.length === 0 ? (
            <div className="w-full py-10 text-center border border-dashed border-zinc-800 rounded-[24px] opacity-20">
              <p className="text-[10px] font-black uppercase tracking-widest">No Active Sessions</p>
            </div>
          ) : (
            filteredRooms.map(room => (
              <div key={room.id} onClick={() => handleJoinAttempt(room)} className="w-full p-2 bg-zinc-900 border border-zinc-600 rounded-[12px] flex justify-between items-center cursor-pointer hover:border-[#FF9900] group transition-all active:scale-[0.98]">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="ml-2 font-black text-sm italic text-white ">{room.name}</span>
                    {room.password && <span className="text-[10px] opacity-40">🔒</span>}
                    {/* 아이템전 표시 아이콘/라벨 */}
                    {room.is_item_mode && <span className="text-[10px] text-[#FF9900] font-black">🎁</span>}
                  </div>
                  <span className="ml-2 text-sm text-zinc-500 font-black uppercase tracking-tighter ">{room.mode}</span>
                </div>
                
                <div className="flex flex-col items-end gap-1">
                  {room.status === 'playing' ? (
                    <span className="mr-2 text-[8px] font-black text-red-500 border border-red-500/50 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                      Playing
                    </span>
                  ) : (
                    <span className="mr-2 text-[8px] font-black text-green-500 border border-green-500/50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Waiting
                    </span>
                  )}
                  <span className="mr-2 text-white font-mono font-black text-sm italic">{room.current_players}/{room.max_players}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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