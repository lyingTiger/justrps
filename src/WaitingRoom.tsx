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
  // 🔥 [추가] 강퇴 대상 ID 저장용 (null이면 모달 닫힘)
  const [kickTargetId, setKickTargetId] = useState<string | null>(null);

  // 🔥 [추가] 강퇴 당했을 때 띄울 알림창 상태
  const [showKickedModal, setShowKickedModal] = useState(false);

  // 🔥 [추가] 실시간 구독 함수 안에서 내 아이디를 정확히 알기 위한 Ref
  const userIdRef = useRef<string | null>(null);
  
  const isExiting = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isCreatorRef = useRef(false);
  const hasJoinedRef = useRef(false);

  // 🔊 효과음 (비프음)
  const playBeep = () => {
    try {
      const audio = new Audio('/sound/beepbeep.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.error("Sound play failed:", e));
      console.log("Beep!")
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!roomId) return;
    
// 1. 내 정보 및 초기 설정
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // user가 null이 아닐 때만 실행
      if (user) {
          setCurrentUserId(user.id);
          userIdRef.current = user.id; 
      }
    };
    fetchUser();

    // 2. 데이터 가져오기 (참가자들의 current_round 포함)
    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('room_participants')
        .select('*, profiles(display_name)') 
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
      
      if (data) setParticipants(data);
    };

    const initRoom = async () => {
      const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      setRoomInfo(room);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (room && user) {
          isCreatorRef.current = (room.creator_id === user.id);
      }

      setTimeout(fetchParticipants, 200);

      // 3. 실시간 구독
      const channel = supabase.channel(`room_${roomId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user?.id }, 
        },
      });

      channel

        // 🔥 [수정] 방 상태 변경(게임 시작) 감지 - 필터 제거 및 안전한 타입 처리
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' }, (payload) => {
          
          // 1. 데이터 안전하게 꺼내기
          const newRoom = payload.new as any;
          
          // 2. 내 방 번호(roomId)와 일치하는지 확인 (필터 대신 직접 확인)
          if (newRoom.id !== roomId) return;

          // 3. 방 정보 업데이트
          setRoomInfo(newRoom);
          if (user) isCreatorRef.current = (newRoom.creator_id === user.id);

          // 4. 게임 시작 신호 감지
          // 방장이 'status'를 'playing'으로 바꿨다면 -> 나도 게임 시작!
          if (newRoom.status === 'playing') {
             console.log("🎮 Game Start Signal Received!");
             onStartGame();
          }
        })
        .on('broadcast', { event: 'alert_unready' }, (payload) => {
          if (payload.payload?.targetIds?.includes(currentUserId)) {
            playBeep();
          }
        })
        .on('presence', { event: 'leave' }, async ({ leftPresences }) => {
            if (isCreatorRef.current) {
                for (const leftUser of leftPresences) {
                    await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', leftUser.user_id);
                }
            }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
             channelRef.current = channel;
             if (user) {
                 await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
             }
          }
        });
    };

    initRoom();
    
    // 🛡️ [수정 1] 강력한 유령 방 방지 (새로고침/닫기 시 삭제)
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
        // 표준 경고 메시지 (브라우저 정책상 커스텀 메시지는 무시됨)
        e.preventDefault(); 
        
        if (currentUserId && roomId) {
            // 내가 방장이고(isCreatorRef) + 나 혼자만 남았다면(participants.length <= 1) -> 방 폭파
            // 주의: participants 상태는 클로저 때문에 최신이 아닐 수 있으므로 안전하게 조건 없이
            // "내가 방장이면 방 삭제 시도" 로직을 넣되, 트리거가 없다면 최선은 '참가자 삭제'임.
            // 여기서는 "방장이고 혼자"라는 가정하에 방 삭제를 요청함.
            
            if (isCreatorRef.current) {
                // 혼자 남은 상태에서 나가면 방 삭제
                const { count } = await supabase.from('room_participants')
                    .select('*', { count: 'exact', head: true })
                    .eq('room_id', roomId);
                
                if (count !== null && count <= 1) {
                    await supabase.from('rooms').delete().eq('id', roomId);
                } else {
                    // 남은 사람이 있으면 방장 권한 위임 로직이 필요하나, 일단 나만 나감
                    await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', currentUserId);
                }
            } else {
                // 방장이 아니면 그냥 나감
                await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', currentUserId);
            }
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 🔥 [추가] 3초마다 명단 강제 새로고침 (이벤트 놓침 방지용 안전장치)
    // 혹시라도 실시간 알림이 씹혀도, 3초 뒤에는 무조건 유저가 화면에 뜹니다.
    const refreshInterval = setInterval(() => {
        fetchParticipants();
    }, 3000);

    return () => {
      // 🔥 [추가] 나갈 때 타이머 해제
      clearInterval(refreshInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, onLeave, onStartGame]);

  // 🔥 [추가] 명단 변화 감지 센서 (강퇴 로직의 핵심)
  useEffect(() => {
    if (!currentUserId || participants.length === 0) return;

    const isMeInList = participants.some(p => p.user_id === currentUserId);

    if (isMeInList) {
      // 명단에 내 이름이 보이면 "정상 입장 상태"로 도장 쾅!
      hasJoinedRef.current = true;
    } else {
      // 내 이름이 없는데...
      if (hasJoinedRef.current && !isExiting.current) {
         setShowKickedModal(true); // 🔥 [추가] 모달 오픈!
      }
    }
  }, [participants, currentUserId]);

  // --- 핸들러 함수들 ---
  const handleManualExit = async () => {
    isExiting.current = true;
    if (currentUserId && roomId) {
       // 내가 방장이고 혼자면 방 삭제
       if (isCreator && participants.length <= 1) {
           await supabase.from('rooms').delete().eq('id', roomId);
       } else {
           await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', currentUserId);
       }
    }
    onLeave();
  };

// 1. 강퇴 버튼 클릭 시 -> 모달만 띄움
  const openKickModal = (targetUserId: string) => {
    setKickTargetId(targetUserId);
  };

  // 2. 모달에서 'Confirm' 클릭 시 -> 진짜 강퇴 실행
  const executeKick = async () => {
    if (!roomId || !kickTargetId) return;
    
    const { error } = await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', kickTargetId);

    if (error) {
        console.error("Kick failed:", error);
        alert("강퇴에 실패했습니다. (DB 권한 확인 필요)");
    }
    
    // 모달 닫기 및 타겟 초기화
    setKickTargetId(null);
  };

  const handleToggleReady = async () => {
    if (!currentUserId || !roomId) return;
    
    // 1. 현재 내 상태 찾기
    const meIndex = participants.findIndex(p => p.user_id === currentUserId);
    if (meIndex === -1) return;
    
    const me = participants[meIndex];
    const newReadyState = !me.is_ready;

    // 2. 🔥 [낙관적 업데이트] 서버 응답 기다리지 않고 화면부터 즉시 변경! (반응속도 UP)
    const nextParticipants = [...participants];
    nextParticipants[meIndex] = { ...me, is_ready: newReadyState };
    setParticipants(nextParticipants);

    // 3. 뒤에서 조용히 DB 업데이트
    const { error } = await supabase.from('room_participants')
      .update({ is_ready: newReadyState })
      .eq('room_id', roomId).eq('user_id', currentUserId);

    // 혹시 실패하면 원상복구 (롤백)
    if (error) {
        console.error("Ready update failed:", error);
        alert("레디 상태 변경 실패!");
        // 실패했으니 원래대로 되돌림
        nextParticipants[meIndex] = { ...me, is_ready: !newReadyState };
        setParticipants([...nextParticipants]);
    }
  };

    const handleStart = async () => {
    console.log("🖱️ Start Button Clicked!"); // [디버그용] 클릭 확인

    if (!roomId) {
        console.error("❌ Error: Room ID is missing");
        return;
    }

    // 1. [멀티플레이] 2명 이상일 때만 '준비 안 된 사람' 체크
    if (participants.length > 1) {
        // roomInfo가 로딩 안 됐을 수도 있으니 creator_id 체크에 안전장치 추가
        const creatorId = roomInfo?.creator_id || currentUserId; 
        const unreadyUsers = participants.filter(p => p.user_id !== creatorId && !p.is_ready);
        
        if (unreadyUsers.length > 0) {
          console.log("⚠️ Waiting for users:", unreadyUsers);
          if (channelRef.current) {
              const targetIds = unreadyUsers.map(p => p.user_id);
              await channelRef.current.send({
                type: 'broadcast',
                event: 'alert_unready',
                payload: { targetIds }
              });
          }
          return; 
        }
    }

    // 2. [공통] 게임 시작 시도
    console.log("🚀 Attempting to start game (DB Update)...");
    const randomSeed = Math.floor(Math.random() * 10000); 
    
    const { error } = await supabase
        .from('rooms')
        .update({ 
            status: 'playing', 
            seed: randomSeed 
        })
        .eq('id', roomId);

    if (error) {
        // 🔥 여기가 범인일 가능성이 높음! 에러 메시지를 alert로 띄움
        console.error("❌ DB Update Failed:", error);
        alert(`게임 시작 실패: ${error.message}`);
    } else {
        console.log("✅ DB Update Success! Starting Game...");
        // 🔥 [중요] 방장은 DB 업데이트 성공 확인 후 즉시 게임 화면으로 이동 (서버 응답 대기 X)
        onStartGame();
    }
  };

  // --- 렌더링 준비 ---
  const isCreator = roomInfo?.creator_id === currentUserId;
  // 방장 제외 전원 레디 상태인지 확인
  const isAllReady = participants.length > 1 && participants.every(p => p.user_id === roomInfo?.creator_id || p.is_ready);
  const myInfo = participants.find(p => p.user_id === currentUserId);

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center mt-6 px-4 animate-in fade-in select-none">
      {/* 상단: 방 정보 */}
      <div className="w-full flex justify-between items-end mb-6">
        <div>
           <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">
             {roomInfo?.name || "Loading..."}
           </h2>
           <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
             Code: <span className="text-[#FF9900] select-text">{roomId?.slice(0,4).toUpperCase()}</span>
           </p>
        </div>
        <button onClick={handleManualExit} className="text-zinc-500 text-[10px] font-bold uppercase underline pb-1 hover:text-white">
          Leave
        </button>
      </div>

        {/* 참가자 리스트 */}
      <div className="w-full space-y-2 mb-8">
        {participants.map((p) => {
           const isHost = p.user_id === roomInfo?.creator_id;
           const isMe = p.user_id === currentUserId;
           
           return (
             <div key={p.user_id} className={`w-full p-3 rounded-2xl border flex justify-between items-center transition-all
               ${isMe ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900 border-zinc-800'}
             `}>
               <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black italic ${isHost ? 'text-[#FF9900]' : 'text-white'}`}>
                      {p.profiles?.display_name || "Unknown"}
                    </span>
                    {isHost && <span className="text-[8px] bg-[#FF9900] text-black font-bold px-1 rounded">HOST</span>}
                    {/* 🔥 [수정 1] 'ME' 뱃지 삭제됨 */}
                  </div>
                  
                  {/* 진행 상황 표시 */}
                  {isHost && roomInfo?.status === 'playing' && (
                      <span className="text-[10px] text-green-500 font-bold uppercase animate-pulse">
                          ▶ Playing Round {p.current_round || 1}
                      </span>
                  )}
               </div>

               <div className="flex items-center gap-2">
                 {!isHost ? (
                    p.is_ready ? (
                      <span className="text-green-500 font-black text-xs uppercase">READY</span>
                    ) : (
                      <span className="text-zinc-600 font-black text-xs uppercase">WAITING</span>
                    )
                 ) : null}
                 
                 {/* 🔥 [수정 2] 강퇴 버튼: 윈도우 닫기 버튼 스타일 (빨간 사각형 + X) */}
                 {isCreator && !isMe && (
                   <button 
                     onClick={() => openKickModal(p.user_id)} 
                     className="w-5 h-5 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded shadow-md active:scale-90 transition-all ml-2"
                     title="Kick User"
                   >
                     <span className="text-[10px] font-bold leading-none pb-[1px]">✕</span>
                   </button>
                 )}
               </div>
             </div>
           );
        })}
        
        {/* 빈 자리 표시 */}
        {Array.from({ length: Math.max(0, (roomInfo?.max_players || 2) - participants.length) }).map((_, i) => (
           <div key={`empty-${i}`} className="w-full p-3 rounded-2xl border border-dashed border-zinc-800 bg-transparent flex justify-center items-center opacity-30">
              <span className="text-[10px] font-black uppercase text-zinc-500">Waiting...</span>
           </div>
        ))}
      </div>

      {/* 하단 버튼 영역 */}
      <div className="w-full mt-auto">
        {isCreator ? (
          // --- 방장 버튼 ---
          <button 
            onClick={handleStart} 
            disabled={participants.length < 1} // 1명이면 연습모드 가능
            className={`w-full h-16 text-black font-black uppercase rounded-2xl text-lg shadow-xl active:scale-95 transition-all
               ${
                 // 🔥 [수정 3] 방장 버튼 색상 로직
                 participants.length < 2 
                    ? 'bg-[#FF9900] hover:bg-[#ffad33]' // 연습 게임 (주황색)
                    : !isAllReady 
                        ? 'bg-green-600 opacity-80' // 미준비 유저 있음 (어두운 녹색, 깜빡임 X)
                        : 'bg-[#22c55e] animate-pulse hover:bg-green-400' // 전원 준비 완료 (밝은 녹색 + 깜빡임)
               }
            `}
          >
            {participants.length < 2 
                ? 'Practice Start'        // 혼자일 때
                : isAllReady 
                ? 'Start Game'          // 모두 준비됨 -> 시작 가능
                : 'Wait to Ready'       // 아직 준비 안 됨 -> 대기
            }
          </button>
        ) : (
          // --- 참가자 버튼 ---
          <button 
            onClick={handleToggleReady}
            className={`w-full h-16 font-black uppercase rounded-2xl text-lg shadow-xl active:scale-95 transition-all
              ${
                // 🔥 [수정 4] 참가자 레디 버튼 색상 로직
                myInfo?.is_ready
                   ? 'bg-[#22c55e] text-black hover:bg-green-400' // 레디 완료 (밝은 녹색, 정지)
                   : 'bg-[#4ade80]/50 text-white/80 animate-pulse hover:bg-[#4ade80]/70' // 레디 전 (연한 녹색, 깜빡임)
              }
            `}
          >
            {myInfo?.is_ready ? 'Ready!' : 'Press to Ready'}
          </button>
        )}
      </div>
      {/* 🛠️ [추가] 강퇴 확인 모달 (Custom UI) 🛠️ */}
      {kickTargetId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-[280px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 border-t-red-500/50 border-t-4">
            
            <div className="text-center mb-6">
               <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">🚨</span>
               </div>
               <h3 className="text-white text-lg font-black uppercase italic tracking-tighter">Kick User?</h3>
               <p className="text-zinc-500 text-[11px] font-bold mt-2 leading-relaxed">
                 Are you sure you want to remove <br/>
                 <span className="text-red-500">
                    {participants.find(p => p.user_id === kickTargetId)?.profiles?.display_name}
                 </span> 
                 from this room?
               </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setKickTargetId(null)} 
                className="h-12 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeKick} 
                className="h-12 bg-red-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-red-500 shadow-lg shadow-red-900/20 active:scale-95 transition-all"
              >
                Confirm Kick
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ [추가] 강퇴 당함 알림 모달 🛠️ */}
      {showKickedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-[280px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 border-t-red-500 border-t-4 text-center">
            
            <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
               <span className="text-2xl">👋</span>
            </div>
            
            <h3 className="text-white text-xl font-black uppercase italic tracking-tighter mb-2">
              Kicked Out
            </h3>
            
            <p className="text-zinc-500 text-[11px] font-bold leading-relaxed mb-6">
              You have been removed from this room <br/> by the host.
            </p>

            <button 
              onClick={onLeave} 
              className="w-full h-12 bg-zinc-800 text-white text-xs font-black uppercase rounded-2xl hover:bg-zinc-700 active:scale-95 transition-all border border-zinc-700 hover:border-zinc-500"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}