import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface MultiResultModalProps {
  isOpen: boolean;
  roomId: string;
  currentUserId: string | null;
  onBackToRoom: () => void | Promise<void>; // 💉 handleBackToRoom이 async이므로 Promise 허용
  onBackToLobby: () => void;
  // 💉 [신규 추가] 에러 해결을 위한 필수 속성들
  sessionCoins: number;          
  onSaveRewards: () => Promise<void>; 
  playClickSound: () => void;    
}

export default function MultiResultModal({ 
  isOpen, 
  roomId, 
  currentUserId, 
  onBackToRoom, 
  onBackToLobby,
  sessionCoins,   // 💉 Props 추가
  onSaveRewards,  // 💉 Props 추가
  playClickSound  // 💉 Props 추가
}: MultiResultModalProps) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !roomId) return;

    const fetchResults = async () => {
      const { data: participants } = await supabase
        .from('room_participants')
        .select('*, profiles(display_name)')
        .eq('room_id', roomId);

      if (!participants) return;

      const sorted = participants.sort((a, b) => {
        if (b.current_round !== a.current_round) return b.current_round - a.current_round;
        return a.play_time - b.play_time;
      });

      const totalPlayers = sorted.length;
      const processedResults = sorted.map((p, index) => {
        const rank = index + 1;
        const bonus = Math.max(0, (totalPlayers - rank) * 10);
        return {
          ...p,
          rank,
          bonus_coins: bonus,
          total_reward: (p.earned_coins || 0) + bonus
        };
      });

      setResults(processedResults);
      setLoading(false);

      // -------------------------------------------------------
      // 💉 [삭제] 이 부분의 자동 코인 지급 로직(increment_coin)을 제거했습니다.
      // 이제 아래 버튼 클릭 시 onSaveRewards()를 통해 일괄 저장됩니다.
      // -------------------------------------------------------
    };

    fetchResults();
  }, [isOpen, roomId, currentUserId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
      <div className="w-full max-w-[360px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl flex flex-col items-center">
        
        {/* 헤더 및 랭킹 리스트 UI (기존과 동일) */}
        <div className="mb-6 text-center">
            <h2 className="text-3xl font-black text-[#FF9900] italic uppercase tracking-tighter">Play Result</h2>
        </div>

        <div className="w-full space-y-3 mb-8 max-h-[400px] overflow-y-auto pr-1">
          {loading ? (
             <div className="text-center text-zinc-500 text-xs py-10">Calculating...</div>
          ) : (
             results.map((p) => {
               const isMe = p.user_id === currentUserId;
               return (
                 <div key={p.user_id} className={`w-full p-3 rounded-2xl border ${isMe ? 'border-zinc-600' : 'border-zinc-800'} bg-zinc-900/50 flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center">
                        <span className="text-xl font-black italic text-zinc-400">{p.rank}</span>
                      </div>
                      <span className={`text-base font-black uppercase ${isMe ? 'text-white' : 'text-zinc-400'}`}>{p.profiles?.display_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <img src="/images/coin.png" alt="coin" className="w-3 h-3 object-contain" />
                        <span className="text-white font-black text-sm">+{isMe ? sessionCoins : p.earned_coins}</span>
                    </div>
                 </div>
               );
             })
          )}
        </div>

        {/* 💉 버튼 영역: 클릭 시 소리를 내고 코인을 서버에 저장한 후 이동 */}
        <div className="grid grid-cols-2 gap-3 w-full">
            <button 
                onClick={async () => { 
                  playClickSound(); 
                  await onSaveRewards(); // 💉 퇴장 시 코인 저장
                  onBackToLobby(); 
                }}
                className="h-14 bg-zinc-800 text-white font-black text-sm rounded-2xl uppercase hover:bg-[#ff9933] active:scale-95 transition-all"
            >
                Exit
            </button>
            <button 
                onClick={async () => { 
                  playClickSound(); 
                  await onSaveRewards(); // 💉 방 복귀 시 코인 저장
                  onBackToRoom(); 
                }}
                className="h-14 bg-zinc-800 text-white font-black text-sm rounded-2xl uppercase hover:bg-[#ff9933] active:scale-95 transition-all"
            >
                Back to Room
            </button>
        </div>

      </div>
    </div>
  );
}