import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AdOverlay from './AdOverlay';

interface ShopPageProps {
  onBack: () => void;
  userCoins: number;
  currentUserId: string | null;
  onUpdateCoins: (newAmount: number) => void; // 코인 갱신용 함수
}

export default function ShopPage({ onBack, userCoins, currentUserId, onUpdateCoins }: ShopPageProps) {
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [adCooldown, setAdCooldown] = useState(0); // 남은 쿨타임 (초)

  // 1. 페이지 진입 시 DB에서 마지막 광고 시간 확인
  useEffect(() => {
    checkAdCooldown();
    const interval = setInterval(() => {
      setAdCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const checkAdCooldown = async () => {
    if (!currentUserId) return;
    const { data } = await supabase.from('profiles').select('last_ad_watched_at').eq('id', currentUserId).single();
    
    if (data?.last_ad_watched_at) {
      const lastTime = new Date(data.last_ad_watched_at).getTime();
      const now = Date.now();
      const diff = Math.floor((now - lastTime) / 1000);
      const cooldownTime = 180; // 3분 쿨타임
      
      if (diff < cooldownTime) {
        setAdCooldown(cooldownTime - diff);
      } else {
        setAdCooldown(0);
      }
    }
  };

  const handleAdReward = async () => {
    if (!currentUserId) return;

    // 1. 코인 지급
    const bonus = 100;
    await supabase.rpc('add_coins_batch', { row_id: currentUserId, amount: bonus });
    
    // 2. 광고 시청 시간 기록
    await supabase.from('profiles').update({ last_ad_watched_at: new Date().toISOString() }).eq('id', currentUserId);

    // 3. UI 업데이트
    onUpdateCoins(userCoins + bonus);
    setAdCooldown(180); // 3분 리셋
    alert(`광고 보상으로 ${bonus} 코인을 획득했습니다!`);
  };

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center mt-6 px-4 animate-in fade-in">
      <AdOverlay isOpen={isAdOpen} onClose={() => setIsAdOpen(false)} onReward={handleAdReward} />

      <div className="w-full flex justify-between items-center mb-8">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#FF9900]">Shop</h2>
        <button onClick={onBack} className="px-4 py-2 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl hover:bg-zinc-700 active:scale-95 transition-all border border-zinc-700">Back</button>
      </div>

      <div className="w-full space-y-4">
        {/* 광고 보고 코인 얻기 카드 */}
        <div className="w-full p-5 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center text-center shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#FF9900]" />
          
          <img src="/images/coin.png" alt="coin" className="w-16 h-16 object-contain mb-2 drop-shadow-[0_0_15px_rgba(255,153,0,0.4)]" />
          <h3 className="text-xl font-black text-white italic uppercase mb-1">Free Coins</h3>
          <p className="text-xs text-zinc-500 font-bold uppercase mb-4">Watch Ad & Get +100 Coins</p>

          <button 
            disabled={adCooldown > 0}
            onClick={() => setIsAdOpen(true)}
            className={`w-full h-12 rounded-2xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2
              ${adCooldown > 0 
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                : 'bg-[#FF9900] text-black shadow-[0_4px_15px_rgba(255,153,0,0.4)] active:scale-95 hover:bg-[#ffad33]'
              }`}
          >
            {adCooldown > 0 ? (
               `Wait ${Math.floor(adCooldown / 60)}:${(adCooldown % 60).toString().padStart(2, '0')}`
            ) : (
               <><span>▶</span> Watch Ad</>
            )}
          </button>
        </div>

        {/* 광고 제거 카드 (준비중) */}
        <div className="w-full p-5 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center text-center opacity-50 relative">
           <div className="absolute inset-0 flex items-center justify-center z-10">
             <span className="bg-black/80 text-white text-xs font-black px-3 py-1 rounded-full border border-zinc-700">COMING SOON</span>
           </div>
           <h3 className="text-xl font-black text-white italic uppercase mb-1">Remove Ads</h3>
           <p className="text-xs text-zinc-500 font-bold uppercase mb-4">No Interstitial Ads for 30m</p>
           <button className="w-full h-12 bg-zinc-800 text-zinc-600 rounded-2xl font-black text-sm uppercase">Watch Ad</button>
        </div>
      </div>
    </div>
  );
}