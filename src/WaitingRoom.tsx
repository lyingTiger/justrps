import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // 🔄 [NEW] 실시간 데이터 비교를 위해 최신 방장 정보를 Ref에 담아둠 (클로저 문제 해결)
  const isCreatorRef = useRef(false);

  // 🔊 사운드 재생 함수
  const playBeep = () => {
    try {
      const audio = new Audio('/sound/beepbeep.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.error("Sound play failed:", e));
    } catch (err) {
      console.error("Audio error:", err);
    }
  };

  useEffect(() => {
    if (!roomId) return;
    
    // 1. 내 정보 가져오기
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    fetchUser();

    // 2. 참가자 목록 가져오기
    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('room_participants')
        .select('*, profiles(display_name)') 
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
      
      if (data) setParticipants(data);
    };

    // 3. 방 정보 및 실시간 구독
    const initRoom = async () => {
      const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      setRoomInfo(room);
      
      // Ref 업데이트 (나중에 Presence에서 사용)
      const { data: { user } } = await supabase.auth.getUser();
      if (room && user) {
          isCreatorRef.current = (room.creator_id === user.id);
      }

      setTimeout(fetchParticipants, 200);

      const channel = supabase.channel(`room_${roomId}`, {
        config: {
          broadcast: { self: true },
          // 📡 [핵심] Presence 기능 활성화
          presence: { key: user?.id }, 
        },
      });

      channel
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
          setRoomInfo(payload.new);
          // 방 정보가 바뀔 때마다 내가 방장인지 Ref 업데이트
          if (user) isCreatorRef.current = (payload.new.creator_id === user.id);
          if (payload.new.status === 'playing') onStartGame();
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => {
          if (!isExiting.current) onLeave(); 
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (payload.eventType === 'DELETE' && payload.old.user_id === currentUserId) {
             alert("방에서 나갔거나 추방되었습니다.");
             onLeave();
             return;
          }
          setTimeout(fetchParticipants, 100);
        })
        .on('broadcast', { event: 'alert_unready' }, (payload) => {
          if (payload.payload?.targetIds?.includes(currentUserId)) {
            playBeep();
          }
        })
        // 👻 [핵심] Presence: 누군가 연결이 끊김(새로고침/탭닫기) 감지
        .on('presence', { event: 'leave' }, async ({ leftPresences }) => {
            // 내가 방장(Host)일 때만 청소부 역할을 수행함 (중복 삭제 방지)
            if (isCreatorRef.current) {
                for (const leftUser of leftPresences) {
                    // console.log("유령 유저 감지됨, 삭제 시도:", leftUser.user_id);
                    await supabase
                        .from('room_participants')
                        .delete()
                        .eq('room_id', roomId)
                        .eq('user_id', leftUser.user_id);
                }
            }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
             channelRef.current = channel;
             // ✅ 구독 완료 시 "나 여기 있어(Track)" 신호 보냄
             if (user) {
                 await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
             }
          }
        });
    };

    initRoom();

// 🛡️ [보너스] 새로고침 시 최대한 빨리 삭제 요청을 보내는 브라우저 이벤트
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
        e.preventDefault();
        // 비동기지만 요청을 던져두고 브라우저가 닫히길 기대함
        if (currentUserId && roomId) {
            await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', currentUserId);
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, onLeave, onStartGame]);



  // 🚪 [퇴장/나가기]
  const handleManualExit = async () => {
    if (isExiting.current || !currentUserId || !roomId) return;
    isExiting.current = true;
    
    try {
      await supabase.from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', currentUserId);
    } catch (error) {
      console.error("퇴장 에러:", error);
    } finally {
      onLeave();
    }
  };

  // 🦵 [강퇴 기능] 방장 전용
  const handleKickUser = async (targetUserId: string) => {
    if (!confirm("이 플레이어를 내보내시겠습니까?\n(재입장이 불가능합니다)")) return;

    try {
      // 1. Ban 리스트에 추가 (재입장 불가 처리)
      await supabase.from('room_bans').insert({
        room_id: roomId,
        user_id: targetUserId
      });

      // 2. 참가자 목록에서 삭제 (강제 퇴장)
      await supabase.from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', targetUserId);
        
    } catch (err) {
      console.error("강퇴 실패:", err);
      alert("강퇴 처리 중 오류가 발생했습니다.");
    }
  };

  // ✅ [준비/취소] 일반 참가자 전용
  const handleToggleReady = async () => {
    if (!currentUserId || !roomId) return;
    
    // 현재 내 상태 찾기
    const me = participants.find(p => p.user_id === currentUserId);
    if (!me) return;

    // 상태 토글 DB 업데이트
    await supabase.from('room_participants')
      .update({ is_ready: !me.is_ready })
      .eq('room_id', roomId)
      .eq('user_id', currentUserId);
  };

// 🎮 [게임 시작] 방장 전용 (수정됨: 시드 랜덤화 추가)
const handleStart = async () => {
    if (!roomId || !channelRef.current) return;

    const unreadyUsers = participants.filter(p => p.user_id !== roomInfo.creator_id && !p.is_ready);
    if (unreadyUsers.length > 0) {
      const targetIds = unreadyUsers.map(p => p.user_id);
      await channelRef.current.send({
        type: 'broadcast',
        event: 'alert_unready',
        payload: { targetIds }
      });
      return; 
    }

    // 🔥 [수정] 시드를 0~1 사이 소수가 아니라, 1~10000 사이의 '큰 정수'로 생성
    // DB 컬럼이 int여도 랜덤성이 보장되도록 함
    const randomSeed = Math.floor(Math.random() * 10000); 

    await supabase.from('rooms').update({ 
        status: 'playing',
        seed: randomSeed 
    }).eq('id', roomId);
  };

  const isCreator = roomInfo?.creator_id === currentUserId;

  // [정렬 로직] 방장 1순위, 나머지 입장순
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.user_id === roomInfo?.creator_id) return -1;
    if (b.user_id === roomInfo?.creator_id) return 1;
    return 0;
  });

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center py-10 px-4 animate-in fade-in select-none">
      {/* 1. 상단: 방 이름 */}
      <div className="w-full text-center mb-8 px-4">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#FF9900] leading-tight truncate overflow-hidden whitespace-nowrap" title={roomInfo?.name}>
          {roomInfo?.name || 'Loading...'}
        </h2>
        <p className="text-zinc-500 text-[10px] font-bold uppercase mt-2">
          {participants.length} / {roomInfo?.max_players || 2} Players
        </p>
      </div>

      {/* 2. 중단: 참가자 리스트 */}
      <div className="w-full flex flex-col gap-3 mb-12 min-h-[240px]">
        {sortedParticipants.length > 0 ? (
          sortedParticipants.map((p) => {
            const isHost = p.user_id === roomInfo?.creator_id;
            const isMe = p.user_id === currentUserId;
            // 준비 완료 여부 (방장은 항상 준비된 것으로 간주)
            const isReady = isHost || p.is_ready; 

            return (
              <div 
                key={p.user_id} 
                className={`relative w-full flex items-center px-5 py-4 rounded-2xl border transition-all duration-300
                  ${isMe ? 'bg-zinc-800' : 'bg-zinc-900'}
                  ${isReady 
                    ? (isHost ? 'border-[#FF9900]/50 shadow-[0_0_15px_rgba(255,153,0,0.1)]' : 'border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.1)]') 
                    : 'border-zinc-800 opacity-80'}
                `}
              >
                {/* 2-1. 역할/준비 배지 */}
                <span className={`text-[9px] font-black uppercase tracking-wider mr-3 w-12 text-center py-1 rounded-md transition-colors
                  ${isHost 
                    ? 'bg-[#FF9900] text-black' 
                    : (isReady ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-400')}`}>
                  {isHost ? 'Host' : (isReady ? 'Ready' : 'Wait')}
                </span>

                {/* 2-2. 닉네임 */}
                <span className={`text-sm font-bold truncate flex-1 mr-2 ${isMe ? 'text-white' : 'text-zinc-400'}`}>
                  {p.profiles?.display_name || 'Unknown'} 
                </span>

                {/* 2-3. 상태 아이콘 (호스트는 펄스, 게스트는 레디 시 초록불) */}
                <div className={`w-2 h-2 rounded-full mr-2 transition-colors
                   ${isHost 
                     ? 'bg-[#FF9900] animate-pulse' 
                     : (isReady ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-zinc-700')}`} 
                ></div>

                {/* 2-4. [NEW] 강퇴 버튼 (방장만 보임, 본인 제외) */}
                {isCreator && !isHost && (
                  <button 
                    onClick={() => handleKickUser(p.user_id)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-red-900/80 text-zinc-600 hover:text-red-500 transition-colors ml-1"
                    title="Kick user"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="w-full h-14 bg-zinc-900/50 rounded-2xl animate-pulse"></div>
        )}

        {/* 빈 슬롯 표시 */}
        {[...Array(Math.max(0, (roomInfo?.max_players || 2) - participants.length))].map((_, i) => (
          <div key={`empty-${i}`} className="w-full h-[58px] rounded-2xl border border-dashed border-zinc-800 flex items-center justify-center opacity-30">
            <span className="text-[10px] uppercase font-bold text-zinc-600">Waiting...</span>
          </div>
        ))}
      </div>

      {/* 3. 하단: 버튼 영역 */}
      <div className="w-full space-y-3 mt-auto">
        {isCreator ? (
          // --- [방장] Start Game 버튼 ---
          <button 
            onClick={handleStart} 
            // 방장은 2명 이상일 때 항상 누를 수 있음 (누르면 준비 안 된 사람 체크)
            disabled={participants.length < 2} 
            className="w-full h-16 bg-white text-black font-black uppercase rounded-2xl text-lg shadow-xl active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all hover:bg-gray-100"
          >
            Start Game
          </button>
        ) : (
          // --- [게스트] Ready 버튼 ---
          <button 
            onClick={handleToggleReady}
            className={`w-full h-16 font-black uppercase rounded-2xl text-lg shadow-xl active:scale-95 transition-all
              ${participants.find(p => p.user_id === currentUserId)?.is_ready 
                ? 'bg-green-600 text-white hover:bg-green-500' // 준비 완료 상태
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' // 준비 안 된 상태
              }`}
          >
            {participants.find(p => p.user_id === currentUserId)?.is_ready ? 'Ready!' : 'Ready?'}
          </button>
        )}
        
        <button 
          onClick={handleManualExit} 
          className="w-full h-12 text-zinc-600 font-bold uppercase tracking-widest text-[14px] hover:text-[#FF9900] transition-colors"
        >
          Exit
        </button>
      </div>
    </div>
  );
}