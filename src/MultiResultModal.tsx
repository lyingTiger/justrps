import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface MultiResultModalProps {
  isOpen: boolean;
  roomId: string;
  currentUserId: string | null;
  onBackToRoom: () => void;
  onBackToLobby: () => void;
}

export default function MultiResultModal({ isOpen, roomId, currentUserId, onBackToRoom, onBackToLobby }: MultiResultModalProps) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const bonusProcessedRef = useRef(false); // 보너스 중복 지급 방지

  useEffect(() => {
    if (!isOpen || !roomId) return;

    const fetchResults = async () => {
      // 1. 모든 참가자 데이터 가져오기
      const { data: participants } = await supabase
        .from('room_participants')
        .select('*, profiles(display_name)')
        .eq('room_id', roomId);

      if (!participants) return;

      // 2. 순위 산정 로직
      // 기준 1: 라운드 높은 순 (내림차순)
      // 기준 2: 플레이 타임 짧은 순 (오름차순)
      const sorted = participants.sort((a, b) => {
        if (b.current_round !== a.current_round) {
          return b.current_round - a.current_round;
        }
        return a.play_time - b.play_time;
      });

      // 3. 결과 데이터 가공 및 보너스 계산
      const totalPlayers = sorted.length;
      
      const processedResults = sorted.map((p, index) => {
        // 등수는 index + 1
        const rank = index + 1;
        
        // 💰 보너스 코인 계산 (꼴찌는 0, 한 등수 위마다 +10)
        // 공식: (전체인원 - 내등수) * 10
        // 예: 4명 중 1등 -> (4-1)*10 = 30코인
        // 예: 4명 중 4등 -> (4-4)*10 = 0코인
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

      // 4. 🔥 [중요] 내 몫의 보너스 코인 지급 (단 한 번만 실행)
      if (currentUserId && !bonusProcessedRef.current) {
        const myResult = processedResults.find((r) => r.user_id === currentUserId);
        if (myResult && myResult.bonus_coins > 0) {
           console.log(`🎁 보너스 지급: ${myResult.bonus_coins} 코인`);
           // 보너스만 추가 지급 (게임 중 획득분은 이미 지급됨)
           await supabase.rpc('increment_coin', { amount: myResult.bonus_coins });
           bonusProcessedRef.current = true;
        }
      }
    };

    fetchResults();
  }, [isOpen, roomId, currentUserId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
      <div className="w-full max-w-[360px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl flex flex-col items-center">
        
        {/* 헤더 */}
        <div className="mb-6 text-center">
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                Battle Result
            </h2>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                Final Ranking
            </p>
        </div>

        {/* 랭킹 리스트 */}
        <div className="w-full space-y-3 mb-8 max-h-[400px] overflow-y-auto pr-1">
          {loading ? (
             <div className="text-center text-zinc-500 text-xs py-10 animate-pulse">Calculating Results...</div>
          ) : (
             results.map((p) => {
               const isMe = p.user_id === currentUserId;
               // 1,2,3등 색상 처리
               const rankColor = p.rank === 1 ? 'text-yellow-400' : p.rank === 2 ? 'text-zinc-300' : p.rank === 3 ? 'text-amber-600' : 'text-zinc-600';
               const rankBorder = p.rank === 1 ? 'border-yellow-400/50' : isMe ? 'border-zinc-600' : 'border-zinc-800';

               return (
                 <div key={p.user_id} className={`w-full p-3 rounded-2xl border ${rankBorder} bg-zinc-900/50 flex items-center justify-between relative overflow-hidden`}>
                    {isMe && <div className="absolute inset-0 bg-white/5 pointer-events-none" />}
                    
                    <div className="flex items-center gap-3">
                        <span className={`text-2xl font-black italic w-6 text-center ${rankColor}`}>{p.rank}</span>
                        <div className="flex flex-col">
                            <span className={`text-xs font-bold uppercase ${isMe ? 'text-white' : 'text-zinc-400'}`}>
                                {p.profiles?.display_name}
                            </span>
                            <span className="text-[10px] text-zinc-600 font-mono">
                                Round {p.current_round} / {p.play_time.toFixed(2)}s
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1">
                            <span className="text-yellow-400 text-xs">🪙</span>
                            <span className="text-white font-black text-sm">+{p.total_reward}</span>
                        </div>
                        {p.bonus_coins > 0 && (
                            <span className="text-[9px] font-bold text-[#FF9900] animate-pulse">
                                (Bonus +{p.bonus_coins})
                            </span>
                        )}
                    </div>
                 </div>
               );
             })
          )}
        </div>

        {/* 버튼 영역 */}
        <div className="w-full flex gap-3">
            <button 
                onClick={onBackToLobby}
                className="flex-1 h-12 rounded-xl bg-zinc-800 text-zinc-400 font-black uppercase text-xs hover:bg-zinc-700 hover:text-white transition-all"
            >
                To Lobby
            </button>
            <button 
                onClick={onBackToRoom}
                className="flex-1 h-12 rounded-xl bg-[#FF9900] text-black font-black uppercase text-xs shadow-lg active:scale-95 transition-all"
            >
                Back to Room
            </button>
        </div>

      </div>
    </div>
  );
}