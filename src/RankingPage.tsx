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

  // 🟠 [수정: 순위별 색상 및 폰트 스타일 정의]
  const getRankStyle = (index: number) => {
    if (index === 0) return "text-[#FFD700] font-bold"; // 1등: 금색 + 볼드
    if (index === 1) return "text-[#E2E2E2] font-bold"; // 2등: 은색 + 볼드
    if (index === 2) return "text-[#CD7F32] font-bold"; // 3등: 동색 + 볼드
    return "text-zinc-500 font-normal"; // 4~10등: 연회색 + 기본체
  };

  return (
    <div className="w-full max-w-[360px] flex flex-col items-center mt-12 animate-in fade-in duration-700 font-sans">
      <h2 className="text-5xl font-black text-[#FF9900] italic uppercase tracking-tighter mb-10 [text-shadow:2px_2px_0_rgba(0,0,0,1)]">
        Hall of Fame
      </h2>

      {/* 모드 선택 탭 */}
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
              {isActive && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#FF9900] rounded-full shadow-[0_0_5px_#FF9900]"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* 🟠 [수정: 배경 및 테두리 제거된 리스트 영역] */}
      <div className="w-full px-2">
        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-12 text-center text-zinc-700 font-bold uppercase italic animate-pulse">Loading...</div>
          ) : rankings.length > 0 ? (
            rankings.map((res, i) => (
              /* 🟠 [수정: 고정 비율(%) 그리드 및 스타일 적용] */
              <div 
                key={i} 
                className={`grid grid-cols-[12%_43%_20%_25%] py-4 items-center text-lg ${getRankStyle(i)}`}
              >
                {/* 1. Rank: 가운데 정렬 */}
                <span className="text-center">{i + 1}</span>

                {/* 2. Name: 왼쪽 정렬, 최대 10자 최적화 */}
                <span className="text-left truncate pr-2">
                  {res.profiles?.display_name}
                </span>

                {/* 3. Round: 가운데 정렬 + 'R' 추가 */}
                <span className="text-center">{res.best_round}R</span>

                {/* 4. Time: 왼쪽 정렬, 소수점 1자리 */}
                <span className="text-left pl-2">
                  {res.best_time.toFixed(1)}s
                </span>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-zinc-800 text-xs font-bold uppercase">No records</div>
          )}
        </div>
      </div>

      <button 
        onClick={() => { playClickSound(); onBack(); }} 
        className="mt-12 text-zinc-500 font-bold text-sm border-b border-zinc-700 pb-0.5 hover:text-white hover:border-white transition-all uppercase tracking-tighter"
      >
        Back to Lobby
      </button>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}