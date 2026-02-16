import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface MultiplayPageProps {
  selectedMode: string;
  onBack: () => void;
  onJoin: (roomId: string) => void;
  playClickSound: () => void;
  t: (key: string) => string;
  onShowPopup: (title: string, desc: string) => void; // 팝업 제어 함수
  setCurrentRoomMode: (mode: 'normal' | 'item') => void;

  isItemMode: boolean;               
  setIsItemMode: (val: boolean) => void; 
}

export default function MultiplayPage({ 
  selectedMode, 
  onBack, 
  onJoin, 
  playClickSound, t, 
  onShowPopup, 
  setCurrentRoomMode, 
  isItemMode, 
  setIsItemMode 
}: MultiplayPageProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [searchName, setSearchName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);

  const [showPassModal, setShowPassModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [passInput, setPassInput] = useState('');

  // ------------------------------------------------------------------
  // 💉 [라이프사이클] 방 목록 동기화
  // ------------------------------------------------------------------
  useEffect(() => {
    fetchRooms();
    const subscription = supabase.channel('lobby_v4_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        setTimeout(fetchRooms, 100); 
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, []);

  // ------------------------------------------------------------------
  // 💉 [데이터 패칭] 방 목록 로드
  // ------------------------------------------------------------------
  const fetchRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false });
    if (data) setRooms(data);
  };
  
  // ------------------------------------------------------------------
  // 💉 [입장 로직] 인원/비번 체크 및 안내창 연동
  // ------------------------------------------------------------------
  const handleJoinAttempt = (room: any) => {
    if (room.current_players >= room.max_players) {
      // 💉 시스템 alert 대신 게임 내 팝업 사용
      onShowPopup(t('title_active_rooms'), t('msg_room_full'));
      return;
    }
    if (room.password) {
      setSelectedRoom(room);
      setShowPassModal(true);
    } else {
      executeJoin(room.id);
    }
  };

  // ------------------------------------------------------------------
  // 💉 [데이터 업데이트] 참여 정보 기록
  // ------------------------------------------------------------------
  const executeJoin = async (roomId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('room_participants').insert({ room_id: roomId, user_id: user.id });
    if (!error) onJoin(roomId);
    else {
      // 💉 시스템 alert 대신 게임 내 팝업 사용
      onShowPopup(t('btn_join'), t('msg_join_failed'));
    }
  };

  // ------------------------------------------------------------------
  // 💉 [방 생성] 룸 개설 로직
  // ------------------------------------------------------------------
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. 방 생성
    const { data: room, error: roomError } = await supabase.from('rooms').insert({
      name: newRoomName,
      password: password || null,
      max_players: maxPlayers,
      current_players: 1, // 방장은 일단 1명으로 시작
      mode: selectedMode,
      is_item_mode: isItemMode, 
      creator_id: user.id,
      status: 'waiting',
      seed: Math.random()
    }).select().single();

    if (roomError || !room) {
      onShowPopup(t('btn_create'), t('msg_create_failed'));
      return;
    }

    // 2. 💉 방장을 참여자 명단에 등록 (await로 완료 보장)
    const { error: partError } = await supabase.from('room_participants')
      .insert({ room_id: room.id, user_id: user.id });

    if (partError) {
      onShowPopup(t('btn_create'), "참여자 등록 실패");
      return;
    }

    // 3. 앱 상태 동기화 및 뷰 전환
    if (typeof setCurrentRoomMode === 'function') {
      setCurrentRoomMode(room.is_item_mode ? 'item' : 'normal');
    }
    
    // 💉 모든 DB 작업이 확실히 끝난 후 입장 시킵니다.
    onJoin(room.id);
  };


  // ------------------------------------------------------------------
  // 💉 [빠른 시작] 랜덤 입장 로직 및 커스텀 안내창 적용
  // ------------------------------------------------------------------
  const handleQuickMatch = () => {
    const publicRooms = rooms.filter(r => !r.password && r.current_players < r.max_players);
    if (publicRooms.length > 0) {
      const randomRoom = publicRooms[Math.floor(Math.random() * publicRooms.length)];
      executeJoin(randomRoom.id);
    } else {
      // 🔥 게임 내 안내창(onShowPopup) 호출
      onShowPopup(t('btn_quick_match'), t('msg_no_public_rooms'));
    }
  };

  const filteredRooms = rooms.filter(r => r.name.toLowerCase().includes(searchName.toLowerCase()));

  // ------------------------------------------------------------------
  // 💉 [렌더링] UI 레이아웃
  // ------------------------------------------------------------------
  return (
    <div className="w-full max-w-[360px] flex flex-col items-center mt-4 gap-3 px-4">
      <div className="w-full flex justify-end mb-0">
        <button 
          onClick={() => { playClickSound(); onBack(); }} 
          className="px-4 py-1 bg-zinc-900 text-white text-[10px] font-black uppercase border border-zinc-800 rounded-[10px] transition-all hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
        >
          {t('btn_back')}
        </button>
      </div>

      <div className="w-full space-y-3 mb-2 bg-zinc-900/30 p-3 rounded-[12px] border border-zinc-400/50">
        <div className="flex gap-2">
          <input 
            type="text" 
            autoComplete="one-time-code" 
            placeholder={t('search_placeholder')} 
            value={newRoomName}
            onChange={(e) => { setNewRoomName(e.target.value); setSearchName(e.target.value); }}
            className="flex-1 h-12 bg-black border border-zinc-800 rounded-2xl px-4 text-xs text-white outline-none focus:border-[#FF9900] font-bold" 
          />
          <button onClick={() => { playClickSound(); handleCreateRoom(); }} className="px-6 bg-zinc-800 text-white font-black uppercase rounded-2xl text-xs active:scale-95 transition-all hover:bg-[#ff9933] hover:text-black">
            {t('btn_create')}
          </button>
        </div>
        
        <div className="flex gap-2">
          <input 
            type="password" 
            autoComplete="one-time-code" 
            placeholder={t('pass_placeholder')} 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 h-11 bg-black border border-zinc-800 rounded-2xl px-4 text-xs text-white outline-none focus:border-[#FF9900] font-bold" 
          />
          <div className="flex items-center gap-1 bg-black border border-zinc-800 rounded-2xl px-2">
            {[2, 3, 4].map(n => (
              <button key={n} onClick={() => { playClickSound(); setMaxPlayers(n); }} className={`w-7 h-7 text-[10px] font-black rounded-lg transition-all ${maxPlayers === n ? 'bg-[#FF9900] text-black' : 'text-white'}`}>{n}P</button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 flex items-center justify-around bg-black border border-zinc-800 rounded-2xl h-11 px-2">
            <button 
              onClick={() => { playClickSound(); setIsItemMode(true); }} 
              className={`flex-1 h-7 text-xs font-black rounded-lg transition-all ${isItemMode ? 'bg-[#FF9900] text-black' : 'text-zinc-500'}`}
            >
              {t('item_game')}
            </button>
            <button 
              onClick={() => { playClickSound(); setIsItemMode(false); }} 
              className={`flex-1 h-7 text-xs font-black rounded-lg transition-all ${!isItemMode ? 'bg-[#FF9900] text-black' : 'text-zinc-500'}`}
            >
              {t('no_item')}
            </button>
          </div>
        </div>

        <button 
          onClick={() => { playClickSound(); handleQuickMatch(); }} 
          className="w-full h-11 bg-zinc-800 text-white font-black uppercase rounded-2xl text-xs active:scale-95 active:bg-[#ff9933] active:text-black transition-all border border-zinc-700 hover:bg-[#ff9933] hover:text-black"
        >
          {t('btn_quick_match')}
        </button>
      </div>

      <div className="w-full flex flex-col gap-2">
        <h3 className="w-full text-center text-sm font-black text-[#ffcc33] uppercase tracking-[0.2em] mb-0">
          {t('title_active_rooms')}
        </h3>
        <div className="w-full h-[220px] overflow-y-auto space-y- pr-1 custom-scrollbar">
          {filteredRooms.length === 0 ? (
            <div className="w-full py-10 text-center border border-dashed border-zinc-800 rounded-[24px] opacity-20">
              <p className="text-[10px] font-black uppercase tracking-widest">{t('no_active_rooms')}</p>
            </div>
          ) : (
            filteredRooms.map(room => (
              <div key={room.id} onClick={() => { playClickSound(); handleJoinAttempt(room); }} className="w-full p-2 bg-zinc-900 border border-zinc-600 rounded-[12px] flex justify-between items-center cursor-pointer hover:border-[#FF9900] group transition-all active:scale-[0.98]">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="ml-2 font-black text-sm italic text-white ">{room.name}</span>
                    {room.password && <span className="text-[10px] opacity-40">🔒</span>}
                    {room.is_item_mode && <span className="text-[10px] text-[#FF9900] font-black">🎁</span>}
                  </div>
                  <span className="ml-2 text-sm text-zinc-500 font-black uppercase tracking-tighter ">{room.mode}</span>
                </div>
                
                <div className="flex flex-col items-end gap-1">
                  {room.status === 'playing' ? (
                    <span className="mr-2 text-[8px] font-black text-red-500 border border-red-500/50 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                      {t('status_playing')}
                    </span>
                  ) : (
                    <span className="mr-2 text-[8px] font-black text-green-500 border border-green-500/50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {t('status_waiting')}
                    </span>
                  )}
                  <span className="mr-2 text-white font-mono font-black text-sm italic">{room.current_players}/{room.max_players}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 💉 비밀번호 모달 섹션 */}
      {showPassModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-[280px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-[#FF9900] text-xs font-black uppercase tracking-widest text-center mb-4 italic">{t('title_private_room')}</h3>
            <input 
              type="password" 
              placeholder={t('pass_modal_placeholder')} 
              autoFocus 
              value={passInput} 
              onChange={(e) => setPassInput(e.target.value)} 
              className="w-full h-12 bg-black border border-zinc-800 rounded-2xl px-4 text-center text-sm text-white outline-none focus:border-[#FF9900] mb-4 font-bold" 
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { playClickSound(); setShowPassModal(false); setPassInput(''); }} className="h-12 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl">
                {t('btn_cancel')}
              </button>
              <button 
                onClick={() => { 
                  playClickSound();
                  if (passInput === selectedRoom.password) { executeJoin(selectedRoom.id); setShowPassModal(false); } 
                  else { 
                    // 💉 시스템 alert 대신 게임 내 팝업 사용
                    onShowPopup(t('title_private_room'), t('msg_wrong_pass'));
                    setPassInput(''); 
                  } 
                }} 
                className="h-12 bg-[#FF9900] text-black text-[10px] font-black uppercase rounded-xl"
              >
                {t('btn_join')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}