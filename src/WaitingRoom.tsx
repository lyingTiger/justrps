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
  const isExiting = useRef(false);

  useEffect(() => {
    if (!roomId) return;
    
    // 유저 정보 가져오기
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    fetchUser();

    // 참가자 목록 가져오기 (약간의 지연 처리로 DB 트리거 완료 대기)
    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('room_participants')
        .select('*, profiles(display_name)') 
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
      
      // 데이터가 있으면 업데이트
      if (data) setParticipants(data);
    };

    // 방 정보 초기화
    const initRoom = async () => {
      const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      setRoomInfo(room);
      // 방 정보를 가져온 후 참가자 목록 로드 (0.2초 지연)
      setTimeout(fetchParticipants, 200); 
    };

    initRoom();

    // 🚀 [실시간 구독]
    const channel = supabase.channel(`room_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        setRoomInfo(payload.new);
        if (payload.new.status === 'playing') onStartGame();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => {
        // 누군가 방을 삭제했거나(오류 등), 방장이 나가서 방이 터진 경우 로비로 이동
        if (!isExiting.current) onLeave(); 
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, () => {
        // 참가자가 들어오거나 나갈 때 목록 갱신 (0.1초 지연)
        setTimeout(fetchParticipants, 100);
      })
      .subscribe();

    // ✨ [수정된 클린업] ✨
    return () => {
      // ⚠️ React Strict Mode 때문에 여기서 자동으로 나가기(delete)를 하면 안 됩니다!
      // 오직 채널 구독만 해제합니다.
      supabase.removeChannel(channel);
    };
  }, [roomId, onLeave, onStartGame]);

  // 🚪 [수동 퇴장] 버튼 클릭 시에만 실행
  const handleManualExit = async () => {
    if (isExiting.current || !currentUserId || !roomId) return;
    isExiting.current = true; // 중복 클릭 방지
    
    try {
      // 🚀 [단순화] 참가자 명단에서 나를 지우기만 하면 됩니다.
      // (DB 트리거가 인원수 감소, 방장 위임, 빈 방 삭제를 자동으로 처리합니다)
      await supabase.from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', currentUserId);
        
    } catch (error) {
      console.error("퇴장 처리 중 오류:", error);
    } finally {
      onLeave(); // 로비 화면으로 이동
    }
  };

  const handleStart = async () => {
    if (!roomId) return;
    await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId);
  };

  // 현재 내가 방장인지 확인 (참가자 리스트가 로딩 중일 때도 creator_id로 1차 확인)
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
          
          // 🚀 [UI 보정] 데이터가 로딩 중이어도 내가 방장이면 첫 칸에 내 모습 미리 보여주기 (Blinking 방지)
          // 참가자 목록이 비어있고(로딩중), 내가 방장이고, 첫 번째 칸(i===0)이라면 나라고 가정함
          const isTemporaryMe = i === 0 && participants.length === 0 && isCreator;
          
          const displayUser = p || (isTemporaryMe ? { user_id: currentUserId, profiles: { display_name: 'Me' } } : null);
          const isHostUser = roomInfo?.creator_id === displayUser?.user_id;

          return (
            <div key={i} className={`aspect-square rounded-[40px] border-2 flex flex-col items-center justify-center p-5 transition-all 
                ${displayUser ? (isHostUser ? 'bg-zinc-900 border-[#FF9900]' : 'bg-zinc-900 border-zinc-700') : 'bg-transparent border-zinc-800 border-dashed opacity-30'}`}>
              {displayUser ? (
                <>
                  <div className={`w-14 h-14 rounded-2xl mb-3 flex items-center justify-center border font-black text-xl italic ${isHostUser ? 'bg-zinc-800 border-[#FF9900] text-[#FF9900]' : 'bg-zinc-700 border-zinc-600 text-zinc-400'}`}>
                    {displayUser.profiles?.display_name?.[0] || '?'}
                  </div>
                  <span className="text-[11px] font-black text-white tracking-tighter line-clamp-1">{displayUser.profiles?.display_name}</span>
                  <span className={`text-[8px] font-bold uppercase mt-1 px-2 py-0.5 rounded-full ${isHostUser ? 'bg-[#FF9900] text-black' : 'text-zinc-500'}`}>
                    {isHostUser ? 'Host' : 'Ready'}
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
          // 방장: 시작 버튼 활성화 (2명 이상일 때만)
          // 테스트를 위해 혼자서도 시작하고 싶다면 disabled 조건을 (participants.length < 1)로 바꾸세요.
          <button onClick={handleStart} disabled={participants.length < 2} className="w-full h-16 bg-white text-black font-black uppercase rounded-2xl text-lg shadow-xl active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all">Start Game</button>
        ) : (
          // 일반 참가자: 대기 메시지
          <div className="w-full h-16 flex items-center justify-center bg-zinc-900 rounded-2xl text-zinc-500 font-black uppercase italic border border-zinc-800 animate-pulse">Wait for Host</div>
        )}
        <button onClick={handleManualExit} className="w-full h-12 text-zinc-600 font-bold uppercase tracking-widest text-[10px] hover:text-[#FF9900] transition-colors">Exit Lobby</button>
      </div>
    </div>
  );
}