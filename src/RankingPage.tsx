import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// 랭킹 데이터 인터페이스
interface RankingRecord {
  id: string; 
  best_round: number;
  best_time: number;
  rank: number;
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
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const modes = ['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE'];

  // 1. 내 ID 먼저 파악
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyUserId(user.id);
    });
  }, []);

  // 2. 모드가 바뀌거나 ID가 로드되면 랭킹 갱신
  useEffect(() => {
    fetchRankings();
  }, [activeMode, myUserId]);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      // [Step 1] 전체 TOP 10 가져오기 (테이블 이름 변경: leaderboard -> mode_records)
      const { data: top10Data, error: top10Error } = await supabase
        .from('mode_records') // 🔥 [수정] 실제 데이터가 저장된 테이블
        .select('*, profiles(display_name)') // 🔥 [수정] 닉네임 가져오기 위해 조인(Join)
        .eq('mode', activeMode)
        .order('best_round', { ascending: false })
        .order('best_time', { ascending: true }) // 낮은 시간이 1등
        .limit(10);

      if (top10Error) throw top10Error;

      // 데이터 포맷팅
      let formattedRankings: RankingRecord[] = (top10Data || []).map((item: any, index) => ({
        id: item.user_id, // mode_records에는 user_id가 있음
        best_round: item.best_round,
        best_time: item.best_time,
        rank: index + 1,
        // 조인된 데이터에서 닉네임 추출
        profiles: { display_name: item.profiles?.display_name || 'Player' } 
      }));

      // [Step 2] 내가 TOP 10에 없다면? 내 등수 찾아서 붙이기
      const isMeInTop10 = formattedRankings.some(r => r.id === myUserId);

      if (myUserId && !isMeInTop10) {
        // 2-1. 내 기록 가져오기
        const { data: myRecord } = await supabase
          .from('mode_records') // 🔥 [수정]
          .select('*, profiles(display_name)') // 🔥 [수정]
          .eq('mode', activeMode)
          .eq('user_id', myUserId)
          .maybeSingle();

        if (myRecord) {
          // 2-2. 내 등수 계산 (나보다 잘한 사람 수 + 1)
          // 잘한 기준: (라운드가 높거나) OR (라운드는 같은데 시간이 더 짧음)
          const { count } = await supabase
            .from('mode_records') // 🔥 [수정]
            .select('*', { count: 'exact', head: true })
            .eq('mode', activeMode)
            .or(`best_round.gt.${myRecord.best_round},and(best_round.eq.${myRecord.best_round},best_time.lt.${myRecord.best_time})`);
          
          const myRank = (count || 0) + 1;

          // 2-3. 리스트 끝에 추가
          formattedRankings.push({
            id: myRecord.user_id,
            best_round: myRecord.best_round,
            best_time: myRecord.best_time,
            rank: myRank,
            profiles: { display_name: myRecord.profiles?.display_name || 'Me' }
          });
        }
      }

      setRankings(formattedRankings);

    } catch (err: any) {
      console.error("랭킹 로드 실패:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRankStyle = (rank: number, isMe: boolean) => {
    if (isMe) return "text-[#FFD700] font-black bg-zinc-800/50 rounded-lg border border-[#FFD700]/30"; 
    
    if (rank === 1) return "text-[#FFD700] font-bold";
    if (rank === 2) return "text-[#E2E2E2] font-bold";
    if (rank === 3) return "text-[#CD7F32] font-bold";
    return "text-zinc-500 font-normal";
  };

  return (
    <div className="w-full max-w-[360px] flex flex-col items-center mt-12 animate-in fade-in duration-700 font-sans">
      <h2 className="text-5xl font-black text-[#FF9900] italic uppercase tracking-tighter mb-10 [text-shadow:2px_2px_0_rgba(0,0,0,1)]">
        rankers
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

      {/* 랭킹 리스트 */}
      <div className="w-full px-2">
        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-12 text-center text-zinc-700 font-bold uppercase italic animate-pulse">Loading...</div>
          ) : rankings.length > 0 ? (
            <>
              {rankings.map((res, i) => {
                const isMe = myUserId && res.id === myUserId;
                const isFloatingUser = i === 10; 

                return (
                  <div key={i}>
                    {isFloatingUser && (
                        <div className="text-center text-zinc-700 text-[10px] my-1">...</div>
                    )}
                    <div 
                      className={`grid grid-cols-[12%_43%_20%_25%] py-0 items-center text-lg transition-colors ${getRankStyle(res.rank, !!isMe)}`}
                    >
                      <span className="text-center">{res.rank}</span>
                      <span className="text-left truncate pr-2">
                        {res.profiles?.display_name}
                      </span>
                      <span className="text-center">{res.best_round}R</span>
                      <span className="text-left pl-2">
                        {res.best_time.toFixed(2)}s {/* 소수점 2자리로 통일 */}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
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