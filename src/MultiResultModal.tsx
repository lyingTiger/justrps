import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface MultiResultModalProps {
  isOpen: boolean;
  roomId: string;
  currentUserId: string | null;
  onBackToRoom: () => void | Promise<void>;
  onBackToLobby: () => void;
  sessionCoins: number;          
  sessionItems: { stop: number; switch: number; gray: number; heal: number }; // 💉 [필수 추가]
  onSaveRewards: () => Promise<void>; 
  playClickSound: () => void;    
  configs: any;
}

export default function MultiResultModal({ 
  isOpen, roomId, currentUserId, onBackToRoom, onBackToLobby,
  sessionCoins, sessionItems, // 💉 [필수 추가] 파라미터에서 꺼내기
  onSaveRewards, playClickSound, configs
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

      // 💉 판정 로직 개선: 라운드 내림차순 -> 시간 오름차순
      const sorted = participants.sort((a, b) => {
        // 1순위: 도달한 라운드가 높은 사람이 상위권
        if (b.current_round !== a.current_round) {
          return (b.current_round || 0) - (a.current_round || 0);
        }
        // 2순위: 라운드가 같다면 플레이 타임이 짧은 사람이 상위권
        return (a.play_time || 0) - (b.play_time || 0);
      });

      const totalPlayers = sorted.length;
      const processedResults = sorted.map((p, index) => {
        const rank = index + 1;
        const bonusUnit = configs?.multi_rank_bonus_unit || 10;
        const bonus = Math.max(0, (totalPlayers - rank) * bonusUnit);

        return {
          ...p,
          rank,
          bonus_coins: bonus,
          total_reward: (p.earned_coins || 0) + bonus
        };
      });

      setResults(processedResults);
      setLoading(false);
    };

    fetchResults();
  }, [isOpen, roomId, currentUserId, configs.multi_rank_bonus_unit]);

  if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
        <div className="w-full max-w-[360px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl flex flex-col items-center">
          
          <div className="mb-6 text-center">
              <h2 className="text-3xl font-black text-[#FF9900] italic uppercase tracking-tighter">Play Result</h2>
          </div>

          {/* 💉 렌더링 영역 최적화: 이중 div 구조를 하나로 합침 */}
          <div className="w-full mb-8 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
            {loading ? (
              <div className="text-center text-zinc-500 text-xs py-10 italic uppercase animate-pulse">
                  Calculating Results...
              </div>
            ) : (
              <div className="w-full space-y-3">
                {results.map((p) => {
                  const isMe = p.user_id === currentUserId;
                  const hasItems = isMe && Object.values(sessionItems).some(count => count > 0);

                  return (
                    <div 
                      key={p.user_id} 
                      className={`w-full p-4 rounded-[24px] border transition-all ${
                        isMe ? 'border-[#FF9900] bg-[#FF9900]/5 shadow-[0_0_20px_rgba(255,153,0,0.1)]' : 'border-zinc-800 bg-zinc-900/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black italic ${
                            isMe ? 'bg-[#FF9900] text-black' : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            {p.rank}
                          </div>
                          <span className={`text-sm font-black uppercase tracking-tight ${isMe ? 'text-white' : 'text-zinc-500'}`}>
                            {p.profiles?.display_name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <img src="/images/coin.png" alt="coin" className="w-4 h-4 object-contain" />
                          <span className={`font-mono font-bold text-lg ${isMe ? 'text-[#FF9900]' : 'text-zinc-400'}`}>
                            +{isMe ? sessionCoins : (p.earned_coins || 0)}
                          </span>
                        </div>
                      </div>

                      {/* 아이템 획득 영역 (내 기록 아래에만 표시) */}
                      {hasItems && (
                        <div className="mt-3 pt-3 border-t border-white/5 flex justify-start gap-3">
                          {sessionItems.stop > 0 && (
                            <div className="relative">
                              <img src="/images/itemStop3sec.png" className="w-8 h-8 object-contain" alt="stop" />
                              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black min-w-[14px] h-3.5 rounded-full flex items-center justify-center border border-zinc-900 px-0.5">
                                {sessionItems.stop}
                              </span>
                            </div>
                          )}
                          {sessionItems.switch > 0 && (
                            <div className="relative">
                              <img src="/images/itemSwitchBtn.png" className="w-8 h-8 object-contain" alt="switch" />
                              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black min-w-[14px] h-3.5 rounded-full flex items-center justify-center border border-zinc-900 px-0.5">
                                {sessionItems.switch}
                              </span>
                            </div>
                          )}
                          {sessionItems.gray > 0 && (
                            <div className="relative">
                              <img src="/images/itemColor.png" className="w-8 h-8 object-contain" alt="color" />
                              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black min-w-[14px] h-3.5 rounded-full flex items-center justify-center border border-zinc-900 px-0.5">
                                {sessionItems.gray}
                              </span>
                            </div>
                          )}
                          {sessionItems.heal > 0 && (
                            <div className="relative">
                              <img src="/images/itemHeal.png" className="w-8 h-8 object-contain" alt="heal" />
                              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black min-w-[14px] h-3.5 rounded-full flex items-center justify-center border border-zinc-900 px-0.5">
                                {sessionItems.heal}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
              <button 
                  onClick={async () => { 
                    playClickSound(); 
                    await onSaveRewards(); 
                    onBackToLobby(); 
                  }}
                  className="h-14 bg-zinc-800 border border-zinc-600 text-white font-black text-sm rounded-2xl uppercase hover:bg-[#ff9933] hover:text-black active:scale-95 transition-all"
              >
                  Exit
              </button>
              <button 
                  onClick={async () => { 
                    playClickSound(); 
                    await onSaveRewards(); 
                    onBackToRoom(); 
                  }}
                  className="h-14 bg-zinc-800 border border-zinc-600 text-white font-black text-sm rounded-2xl uppercase hover:bg-[#ff9933] hover:text-black active:scale-95 transition-all"
              >
                  Back to Room
              </button>
          </div>
        </div>
      </div>
    );
  }