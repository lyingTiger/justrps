import { useState, useEffect, useRef } from 'react';

// 부모(App.tsx)로부터 전달받는 데이터 규격 정의
interface GameProps {
  round: number;
  mode: string;
  onGameOver: (finalRound: number, time: number) => void;
  onRoundClear: (nextRound: number) => void;
  playClickSound: () => void;
  onEarnCoin: () => void; // [추가] 코인 획득 함수
}

export default function GameEngine({ round, mode, onGameOver, onRoundClear, playClickSound, onEarnCoin }: GameProps) {
  const [playTime, setPlayTime] = useState(0);
  const [aiSelect, setAiSelect] = useState<number[]>([]); 
  const [targetConditions, setTargetConditions] = useState<string[]>([]); // [추가] 셔플/엑스퍼트용 조건 저장
  const [questionTurn, setQuestionTurn] = useState(0);    
  const [isMemoryPhase, setIsMemoryPhase] = useState(true); 
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 라운드가 바뀔 때마다 게임 초기화 및 타이머 작동
  useEffect(() => {
    const questionNum = round + 2; 
    const newAiSelect = Array.from({ length: questionNum }, () => Math.floor(Math.random() * 3));
    setAiSelect(newAiSelect);

    // [추가] 셔플 또는 엑스퍼트 모드일 때 승/무/패 조건을 랜덤으로 섞음
    if (mode === 'SHUFFLE MODE' || mode === 'EXPERT MODE') {
      const conditions = ['WIN', 'DRAW', 'LOSE'];
      const newConditions = Array.from({ length: questionNum }, () => conditions[Math.floor(Math.random() * 3)]);
      setTargetConditions(newConditions);
    } else {
      // 일반 모드는 모드 이름에서 조건을 가져옴 (ex: "WIN MODE" -> "WIN")
      setTargetConditions(Array(questionNum).fill(mode.split(' ')[0]));
    }

    setQuestionTurn(0);
    setIsMemoryPhase(true); 

    // 0.01초 단위 정밀 타이머
    timerRef.current = setInterval(() => {
      setPlayTime(prev => prev + 0.01);
    }, 10);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [round, mode]);

  const handleSelect = (idx: number) => {
    playClickSound();
    
    const aiHand = aiSelect[questionTurn];
    const currentCondition = targetConditions[questionTurn];
    let isCorrect = false;

    // [수정] 모드별 판정 로직 (0:가위, 1:바위, 2:보)
    if (currentCondition === 'DRAW') {
      isCorrect = idx === aiHand;
    } else if (currentCondition === 'WIN') {
      isCorrect = (aiHand === 0 && idx === 1) || (aiHand === 1 && idx === 2) || (aiHand === 2 && idx === 0);
    } else if (currentCondition === 'LOSE') {
      isCorrect = (aiHand === 0 && idx === 2) || (aiHand === 1 && idx === 0) || (aiHand === 2 && idx === 1);
    }

    if (isCorrect) {
      onEarnCoin(); // [추가] 정답일 때 코인 획득 호출
      if (questionTurn + 1 === aiSelect.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        onRoundClear(round + 1);
      } else {
        setQuestionTurn(prev => prev + 1);
      }
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      onGameOver(round, playTime);
    }
  };

  return (
    <div className="w-full max-w-[320px] flex flex-col min-h-[550px] justify-start py-6 animate-in fade-in duration-500">
      
      {/* [1. 상단 섹션] */}
      <div className="w-full text-left mt-0">
        <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Round {round}</h2>
        <p className="text-zinc-500 text-[10px] font-mono tracking-tighter mt-0">Play Time: {playTime.toFixed(2)} sec</p>
      </div>

      {/* [2. 중앙 섹션] */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center mb-10">
          <p className="text-[#FF9900] text-6xl font-black tracking-tighter uppercase leading-none">
            {aiSelect.length} {mode.split(' ')[0]}
          </p>
          <p className="text-white text-2xl font-bold opacity-80 uppercase tracking-tight mt-1">
            {questionTurn} {mode.split(' ')[0]}
          </p>
        </div>

        {/* 문제 손 나열 */}
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {aiSelect.map((hand, i) => {
            const isCorrect = i < questionTurn;
            const isCurrent = i === questionTurn && !isMemoryPhase;
            const showDetails = isMemoryPhase || isCorrect;
            
            return (
              <div key={i} className="relative flex flex-col items-center">
                {/* [추가] 셔플 모드 시 조건 텍스트 표시 */}
                {(isMemoryPhase || isCurrent) && (mode === 'SHUFFLE MODE' || mode === 'EXPERT MODE') && (
                  <span className="absolute -top-5 text-[9px] font-black text-[#FF9900] animate-pulse">
                    {targetConditions[i]}
                  </span>
                )}
                
                <div 
                  className={`w-14 h-14 rounded-2xl overflow-hidden transition-all duration-300 bg-zinc-900
                    ${showDetails 
                      ? (hand === 0 ? 'shadow-[0_0_12px_rgba(236,72,153,0.7)]' : 
                         hand === 1 ? 'shadow-[0_0_12px_rgba(59,130,246,0.7)]' : 
                         'shadow-[0_0_12px_rgba(34,197,94,0.7)]')
                      : isCurrent ? 'border-2 border-[#FF9900] scale-110 shadow-lg' : 'shadow-none'
                    }`}
                >
                  {isMemoryPhase ? (
                    <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-cover" alt="hand" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {isCorrect && (
                        <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-cover opacity-40" alt="correct hand" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* [3. 하단 섹션] */}
      <div className="w-full flex justify-center mt-auto">
        {isMemoryPhase ? (
          <button 
            onClick={() => { playClickSound(); setIsMemoryPhase(false); }}
            className="text-[#FF9900] text-3xl font-black italic uppercase hover:scale-105 transition-transform animate-pulse"
          >
            OK, I got it
          </button>
        ) : (
          <div className="flex gap-4 w-full px-2">
            {['rock', 'paper', 'scissor'].map((type) => (
              <button 
                key={type} 
                onClick={() => handleSelect(type === 'scissor' ? 0 : type === 'rock' ? 1 : 2)} 
                className={`flex-1 aspect-square rounded-3xl overflow-hidden active:scale-90 transition-all bg-zinc-900
                  ${type === 'rock' ? 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 
                    type === 'paper' ? 'shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 
                    'shadow-[0_0_15px_rgba(236,72,153,0.5)]'}`}
              >
                <img src={`/images/${type}.png`} className="w-full h-full object-cover" alt={type} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}