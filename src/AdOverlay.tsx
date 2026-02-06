import React, { useState, useEffect } from 'react';

interface AdOverlayProps {
  isOpen: boolean;
  onClose: () => void;       // 중간에 닫음 (보상 X)
  onReward: () => void;      // 끝까지 다 봄 (보상 O)
}

export default function AdOverlay({ isOpen, onClose, onReward }: AdOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(5); // 5초 광고
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(5);
      setCanClose(false);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanClose(true); // 0초 되면 닫기 버튼 활성화
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center animate-in fade-in">
      <div className="absolute top-4 right-4">
        {canClose ? (
          <button 
            onClick={() => { onReward(); onClose(); }} 
            className="bg-green-500 text-white font-black px-6 py-2 rounded-full shadow-lg animate-bounce"
          >
            GET REWARD & CLOSE
          </button>
        ) : (
          <div className="text-white font-mono font-bold opacity-50">
            Reward in {timeLeft}s...
          </div>
        )}
      </div>

      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black text-[#FF9900] italic uppercase animate-pulse">
          ADVERTISEMENT
        </h2>
        <p className="text-white text-sm">This is a mock ad component.</p>
        
        {/* 광고 진행 바 */}
        <div className="w-[200px] h-2 bg-zinc-800 rounded-full overflow-hidden mt-4">
          <div 
            className="h-full bg-[#FF9900] transition-all duration-1000 ease-linear"
            style={{ width: `${((5 - timeLeft) / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* 강제 종료 버튼 (테스트용, 실제론 숨김) */}
      <button onClick={onClose} className="absolute bottom-10 text-zinc-600 text-xs underline">
        Close without Reward
      </button>
    </div>
  );
}