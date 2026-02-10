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
}



export default function RankingPage({ onBack, playClickSound, userNickname }: RankingPageProps) {
  const [activeMode, setActiveMode] = useState('WIN MODE');
  const [rankings, setRankings] = useState<RankingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  // 닉네임을 활용한 동적 라벨 생성
  const myBestLabel = `${userNickname}'s BEST`;
  // 처음 진입 시 activeMode를 'WIN MODE'로 설정하는 것은 유지하거나, 
  // 원한다면 이 동적 라벨을 기본값으로 할 수도 있습니다.



const modes = ['WIN MODE', 'DRAW MODE', 'LOSE MODE', 'SHUFFLE MODE', 'EXPERT MODE', myBestLabel];

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
    if (!myUserId && activeMode === myBestLabel) return;
    setLoading(true);
    
    try {
      // 'MY BEST' 문자열 대신 myBestLabel 변수로 체크
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

  

  // 랭크별 스타일 반환 함수 
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
          Back
        </button>
      </div>
      
      {/* 모드 선택 탭 */}
      <div className="w-full flex justify-center flex-wrap gap-x-5 gap-y-5 mb-10 mt-4 px-4">
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

      {/* 랭킹 리스트 영역 */}
      <div className="w-full px-2">
        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-12 text-center text-zinc-700 font-bold uppercase italic animate-pulse">Loading...</div>
          ) : rankings.length > 0 ? (
            <>
              {(() => {
                const isMyBestTab = activeMode === 'MY BEST';
                
                const overallBestIndex = isMyBestTab 
                  ? rankings.reduce((bestIdx, curr, idx, arr) => {
                      if (curr.best_round > arr[bestIdx].best_round) return idx;
                      if (curr.best_round === arr[bestIdx].best_round && curr.best_time < arr[bestIdx].best_time) return idx;
                      return bestIdx;
                    }, 0)
                  : -1;

                return rankings.map((res, i) => {
                const isMe = myUserId && res.id === myUserId;
                const isMyBestTab = activeMode === myBestLabel;
                
                const overallBestIndex = isMyBestTab 
                  ? rankings.reduce((bestIdx, curr, idx, arr) => {
                      if (curr.best_round > arr[bestIdx].best_round) return idx;
                      if (curr.best_round === arr[bestIdx].best_round && curr.best_time < arr[bestIdx].best_time) return idx;
                      return bestIdx;
                    }, 0)
                  : -1;
    
                const isTopRecord = isMyBestTab && i === overallBestIndex;

                  const isFloatingUser = !isMyBestTab && i === 10;

                  return (
                    <div key={i}>
                      {isFloatingUser && <div className="text-center text-zinc-700 text-[10px] my-1">...</div>}
                      
                      {/* 🔻 [수정] 내 기록들 간의 끝선을 완벽히 맞추는 5:2:3 그리드 설계 */}
                      <div 
                        className={isMyBestTab 
                          ? `w-full grid grid-cols-[5fr_2fr_3fr] py-2 items-center transition-colors ${isTopRecord ? 'text-[#FFD700]' : 'text-white'} font-bold`
                          : `w-full grid grid-cols-[12%_43%_20%_25%] py-2 items-center text-base transition-colors ${getRankStyle(res.rank, !!isMe)}`
                        }
                      >
                        {isMyBestTab ? (
                          <>
                            {/* 1. 모드 데이터 (5) - 왼쪽 끝 정렬 / base 크기 */}
                            <div className="text-left text-base uppercase whitespace-nowrap pl-2">
                              {res.mode} MODE
                            </div>
                            
                            {/* 2. 라운드 데이터 (2) - 정중앙 정렬 / base 크기 */}
                            <div className="text-center text-base font-mono">
                              {res.best_round}R
                            </div>
                            
                            {/* 3. 시간 데이터 (3) - 오른쪽 끝 정렬 / base 크기 */}
                            <div className="text-right text-base font-mono pr-2">
                              {res.best_time.toFixed(2)}s
                            </div>
                          </>
                        ) : (
                          <>
                            {/* 기존 일반 랭킹 로직 유지 */}
                            <span className="text-center">{res.rank}</span>
                            <span className="text-left truncate pr-2">{res.profiles?.display_name}</span>
                            <span className="text-center font-mono">{res.best_round}R</span>
                            <span className="text-left pl-2 font-mono text-sm">{res.best_time.toFixed(2)}s</span>
                          </>
                        )}
                      </div>


                    </div>
                  );
                });
              })()}
            </>
          ) : (
            <div className="p-12 text-center text-zinc-800 text-xs font-bold uppercase">No records</div>
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