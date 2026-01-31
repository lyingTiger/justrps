import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface RankingRecord {
  best_round: number;
  best_time: number;
  profiles: {
    display_name: string;
  };
}

interface RankingPageProps {
  onBack: () => void;
  playClickSound: () => void;
}

export default function RankingPage({ onBack, playClickSound }: RankingPageProps) {
  const [activeMode, setActiveMode] = useState('WIN MODE');
  const [rankings, setRankings] = useState<RankingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const modes = ['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE'];

  useEffect(() => {
    fetchRankings();
  }, [activeMode]);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      // 뷰(leaderboard)에서 데이터를 가져옵니다.
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('mode', activeMode)
        .order('best_round', { ascending: false })
        .order('best_time', { ascending: true })
        .limit(10);

      if (error) throw error;

      if (data) {
        const formattedData = data.map(item => ({
          best_round: item.best_round,
          best_time: item.best_time,
          profiles: { display_name: item.display_name || 'Player' }
        }));
        setRankings(formattedData as any);
      }
    } catch (err) {
      console.error("랭킹 로드 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[360px] flex flex-col items-center mt-12 animate-in fade-in duration-700">
      {/* 이미지와 동일한 HALL OF FAME 헤더 스타일 */}
      <h2 className="text-5xl font-black text-[#FF9900] italic uppercase tracking-tighter mb-10 [text-shadow:2px_2px_0_rgba(0,0,0,1)]">
        Hall of Fame
      </h2>

      {/* 모드 선택 버튼 영역 (테두리 없음, Glow 효과 적용) */}
      <div className="w-full flex justify-center flex-wrap gap-x-5 gap-y-3 mb-10 px-4">
        {modes.map((mode) => {
          const isActive = activeMode === mode;
          return (
            <button
              key={mode}
              onClick={() => { playClickSound(); setActiveMode(mode); }}
              className={`text-xs font-black uppercase tracking-widest transition-all duration-300 relative
                ${isActive 
                  ? 'text-[#FF9900] [text-shadow:0_0_12px_rgba(255,153,0,0.8)] scale-110' 
                  : 'text-zinc-600 hover:text-zinc-400'
                }`}
            >
              {mode.replace(' MODE', '')}
              {/* 활성화 시 하단에 작은 점 표시 (선택 사항) */}
              {isActive && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#FF9900] rounded-full shadow-[0_0_5px_#FF9900]"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* 리더보드 테이블 본체 (이미지 스타일 반영) */}
      <div className="w-[90%] bg-[#121212] rounded-[40px] border border-zinc-800/50 overflow-hidden shadow-2xl">
        <div className="grid grid-cols-4 px-6 py-5 border-b border-zinc-800/30 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
          <span>Rank</span>
          <span>Name</span>
          <span className="text-center">Round</span>
          <span className="text-right">Time</span>
        </div>

        <div className="max-h-[350px] overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-12 text-center text-zinc-700 font-bold uppercase italic animate-pulse">Loading...</div>
          ) : rankings.length > 0 ? (
            rankings.map((res, i) => (
              <div key={i} className="grid grid-cols-4 px-6 py-5 items-center hover:bg-white/5 transition-colors">
                <span className="text-lg">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-xs font-mono text-zinc-600 ml-1">#{i + 1}</span>}
                </span>
                <span className="text-sm font-bold text-white tracking-tight truncate">{res.profiles?.display_name}</span>
                <span className="text-center font-black text-white text-xl">{res.best_round}</span>
                <span className="text-right font-mono text-xs text-zinc-500">{res.best_time.toFixed(2)}s</span>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-zinc-800 text-xs font-bold uppercase">No records</div>
          )}
        </div>
      </div>

      {/* 하단 돌아가기 링크 */}
      <button 
        onClick={() => { playClickSound(); onBack(); }} 
        className="mt-12 text-zinc-500 font-bold text-sm border-b border-zinc-700 pb-0.5 hover:text-white hover:border-white transition-all uppercase tracking-tighter"
      >
        Back to Lobby
      </button>

      {/* 가로 스크롤바 제거를 위한 인라인 스타일 */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}