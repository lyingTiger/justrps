import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// 랭킹 데이터 인터페이스
interface RankingRecord {
  id: string; 
  mode?: string;
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
  userNickname: string;
  t: (key: string) => string; // 💉 다국어 번역 함수
}

export default function RankingPage({ onBack, playClickSound, userNickname, t }: RankingPageProps) {
  const [activeMode, setActiveMode] = useState('WIN MODE');
  const [rankings, setRankings] = useState<RankingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // 💉 닉네임 동적 라벨 생성
  const myBestLabel = `${userNickname}${t('title_my_best')}`;
  const modes = ['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE', myBestLabel];

  // ------------------------------------------------------------------
  // 💉 [데이터] 내 유저 ID 파악
  // ------------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyUserId(user.id);
    });
  }, []);

  // ------------------------------------------------------------------
  // 💉 [데이터] 모드 변경 시 랭킹 데이터 갱신
  // ------------------------------------------------------------------
  useEffect(() => {
    fetchRankings();
  }, [activeMode, myUserId]);

  const fetchRankings = async () => {
    if (!myUserId && activeMode === myBestLabel) return;
    setLoading(true);
    
    try {
      if (activeMode === myBestLabel) {
        const { data: myAllRecords, error } = await supabase
          .from('mode_records')
          .select('*, profiles(display_name)')
          .eq('user_id', myUserId)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        setRankings((myAllRecords || []).map((item: any) => ({
          id: item.user_id,
          mode: item.mode.replace(' MODE', ''),
          best_round: item.best_round,
          best_time: item.best_time,
          rank: 0,
          profiles: { display_name: item.profiles?.display_name || 'Me' }
        })));
        return;
      }

      const { data: top10Data, error: top10Error } = await supabase
        .from('mode_records')
        .select('*, profiles(display_name)')
        .eq('mode', activeMode)
        .order('best_round', { ascending: false })
        .order('best_time', { ascending: true })
        .limit(10);

      if (top10Error) throw top10Error;

      let formattedRankings: RankingRecord[] = (top10Data || []).map((item: any, index) => ({
        id: item.user_id,
        best_round: item.best_round,
        best_time: item.best_time,
        rank: index + 1,
        profiles: { display_name: item.profiles?.display_name || 'Player' } 
      }));

      const isMeInTop10 = formattedRankings.some(r => r.id === myUserId);

      if (myUserId && !isMeInTop10) {
        const { data: myRecord } = await supabase
          .from('mode_records')
          .select('*, profiles(display_name)')
          .eq('mode', activeMode)
          .eq('user_id', myUserId)
          .maybeSingle();

        if (myRecord) {
          const { count } = await supabase
            .from('mode_records')
            .select('*', { count: 'exact', head: true })
            .eq('mode', activeMode)
            .or(`best_round.gt.${myRecord.best_round},and(best_round.eq.${myRecord.best_round},best_time.lt.${myRecord.best_time})`);
          
          const myRank = (count || 0) + 1;

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

  // ------------------------------------------------------------------
  // 💉 [디자인] 랭크별 스타일 결정 (내 순위 및 TOP 3)
  // ------------------------------------------------------------------
  const getRankStyle = (rank: number, isMe: boolean) => {
    if (isMe) return "text-[#FFD700] font-black bg-zinc-800/50 rounded-lg border border-[#FFD700]/30"; 
    if (rank === 1) return "text-[#FFD700] font-bold";
    if (rank === 2) return "text-[#E2E2E2] font-bold";
    if (rank === 3) return "text-[#CD7F32] font-bold";
    return "text-zinc-500 font-normal";
  };

  return (
    <div className="w-full max-w-[360px] flex flex-col items-center mt-4 animate-in fade-in duration-700 font-sans">
      
      <div className="w-full flex justify-end mb-0">
        <button 
          onClick={() => { playClickSound(); onBack(); }} 
          className="px-4 py-1 bg-zinc-900 text-white text-[10px] font-black uppercase border border-zinc-800 rounded-[10px] transition-all hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
        >
          {t('btn_back')}
        </button>
      </div>
      
      {/* 💉 모드 선택 탭 (번역된 라벨 표시) */}
      <div className="w-full flex justify-center flex-wrap gap-x-5 gap-y-5 mb-10 mt-4 px-4">
        {modes.map((mode) => {
          const isActive = activeMode === mode;
          const displayLabel = mode === myBestLabel ? mode : t(mode.replace(' MODE', '')); 

          return (
            <button
              key={mode}
              onClick={() => { playClickSound(); setActiveMode(mode); }}
              className={`text-xs font-black uppercase tracking-widest transition-all duration-300 relative
                ${isActive ? 'text-[#FF9900] [text-shadow:0_0_12px_rgba(255,153,0,0.8)] scale-110' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              {displayLabel}
              {isActive && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#FF9900] rounded-full shadow-[0_0_5px_#FF9900]"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* 💉 랭킹 리스트 영역 */}
      <div className="w-full px-2">
        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-12 text-center text-zinc-700 font-bold uppercase italic animate-pulse">{t('loading')}</div>
          ) : rankings.length > 0 ? (
            <>
              {(() => {
                const isMyBestTab = activeMode === myBestLabel;
                
                // 💉 [로직 보존] 내 기록 중 최고의 기록 인덱스 계산 (황금색 강조용)
                const overallBestIndex = isMyBestTab 
                  ? rankings.reduce((bestIdx, curr, idx, arr) => {
                      if (curr.best_round > arr[bestIdx].best_round) return idx;
                      if (curr.best_round === arr[bestIdx].best_round && curr.best_time < arr[bestIdx].best_time) return idx;
                      return bestIdx;
                    }, 0)
                  : -1;

                return rankings.map((res, i) => {
                  const isMe = myUserId && res.id === myUserId;
                  const isTopRecord = isMyBestTab && i === overallBestIndex;
                  const isFloatingUser = !isMyBestTab && i === 10;

                  return (
                    <div key={i}>
                      {isFloatingUser && <div className="text-center text-zinc-700 text-[10px] my-1">...</div>}
                      
                      <div 
                        className={isMyBestTab 
                          ? `w-full grid grid-cols-[5fr_2fr_3fr] py-2 items-center transition-colors ${isTopRecord ? 'text-[#FFD700]' : 'text-white'} font-bold`
                          : `w-full grid grid-cols-[12%_43%_20%_25%] py-2 items-center text-base transition-colors ${getRankStyle(res.rank, !!isMe)}`
                        }
                      >
                        {isMyBestTab ? (
                          <>
                            <div className="text-left text-base uppercase whitespace-nowrap pl-2">
                              {t(res.mode || '')}{t('mode_suffix')}
                            </div>
                            <div className="text-center text-base font-mono">
                              {res.best_round}{t('round_suffix')}
                            </div>
                            <div className="text-right text-base font-mono pr-2">
                              {res.best_time.toFixed(2)}{t('time_suffix')}
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-center">{res.rank}</span>
                            <span className="text-left truncate pr-2">{res.profiles?.display_name}</span>
                            <span className="text-center font-mono">{res.best_round}{t('round_suffix')}</span>
                            <span className="text-right mr-2 pl-2 font-mono text-sm">{res.best_time.toFixed(2)}{t('time_suffix')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </>
          ) : (
            <div className="p-12 text-center text-zinc-800 text-xs font-bold uppercase">{t('no_records')}</div>
          )}
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}