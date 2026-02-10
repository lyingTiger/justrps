import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AdOverlay from './AdOverlay';

interface ShopPageProps {
  onBack: () => void;
  userCoins: number;
  currentUserId: string | null;
  onUpdateCoins: (newAmount: number) => void;
}

export default function ShopPage({ onBack, userCoins, currentUserId, onUpdateCoins }: ShopPageProps) {
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [adType, setAdType] = useState<'coins' | 'remove_ads'>('coins');
  const [adCooldown, setAdCooldown] = useState(0);
  const [adFreeTimeLeft, setAdFreeTimeLeft] = useState(0); // 전면 광고 제거 남은 시간

  const [rewardPopup, setRewardPopup] = useState<{ isOpen: boolean; title: string; desc: string; icon: string }>({
  isOpen: false,
  title: '',
  desc: '',
  icon: ''
});

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => {
      setAdCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setAdFreeTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from('profiles')
      .select('last_ad_watched_at, ad_free_until')
      .eq('id', currentUserId)
      .single();
    
    if (data) {
      // 1. 코인 광고 쿨타임 계산 (3분)
      if (data.last_ad_watched_at) {
        const diff = Math.floor((Date.now() - new Date(data.last_ad_watched_at).getTime()) / 1000);
        if (diff < 180) setAdCooldown(180 - diff);
      }
      // 2. 전면 광고 제거 남은 시간 계산
      if (data.ad_free_until) {
        const diff = Math.floor((new Date(data.ad_free_until).getTime() - Date.now()) / 1000);
        if (diff > 0) setAdFreeTimeLeft(diff);
      }
    }
  };

  

  const startAd = (type: 'coins' | 'remove_ads') => {
    setAdType(type);
    setIsAdOpen(true);
  };

  const handleAdReward = async () => {
    if (!currentUserId) return;

    if (adType === 'coins') {
        const bonus = 100;
        
        // 1. 코인 추가
        await supabase.rpc('add_coins_batch', { row_id: currentUserId, amount: bonus });
        
        // 🔻 [추가] 2. DB에 광고 시청 시간 기록 (이게 있어야 새로고침해도 쿨타임이 유지됩니다)
        await supabase.from('profiles').update({ last_ad_watched_at: new Date().toISOString() }).eq('id', currentUserId);
        
        // 3. 헤더 코인 수량 업데이트
        onUpdateCoins(userCoins + bonus);

        // 🔻 [추가] 4. 로컬 쿨타임 즉시 시작 (180초)
        setAdCooldown(180);
        
        // 5. 팝업 호출
        setRewardPopup({
        isOpen: true,
        title: "+100 COINS!",
        desc: "ADDED TO YOUR WALLET.",
        icon: "/images/coin.png"
        });
    } else {
        const duration = 100 * 60 * 60 * 1000; 
        const newAdFreeUntil = new Date(Date.now() + duration).toISOString();
        await supabase.from('profiles').update({ ad_free_until: newAdFreeUntil }).eq('id', currentUserId);
        setAdFreeTimeLeft(100 * 60 * 60); 

        // 🔻 [수정] 팝업 호출
        setRewardPopup({
        isOpen: true,
        title: "AD-FREE ACTIVE!",
        desc: "ENJOY 100 HOURS OF PURE GAMEPLAY.",
        icon: "🚫"
        });
    }
    };

  return (
    <div className="w-full max-w-[360px] flex flex-col items-center mt-4 gap-3 px-4">
      <AdOverlay isOpen={isAdOpen} onClose={() => setIsAdOpen(false)} onReward={handleAdReward} />

      {/* 상단 헤더 */}
      <div className="w-full flex justify-end mb-0">
        
        <button onClick={onBack} className="px-4 py-1 bg-zinc-900 text-white text-[10px] font-black uppercase border border-zinc-800 rounded-[10px] transition-all hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95">Back</button>
      </div>

      <div className="w-full space-y-4">
        {/* --- FREE REWARDS --- */}
        <div className="w-full p-5 bg-zinc-900 border border-zinc-700 rounded-[32px] flex flex-col items-center">
          <img src="/images/coin.png" alt="coin" className="w-12 h-12 mb-2" />
          <h3 className="text-lg font-black text-white italic uppercase mb-4">+100 Coins</h3>
          <button 
            disabled={adCooldown > 0}
            onClick={() => startAd('coins')}
            className={`w-full h-12 rounded-2xl font-black text-sm uppercase transition-all border
              ${adCooldown > 0 ? 'bg-zinc-900 border-zinc-800 text-zinc-600' : 'bg-zinc-800 border-zinc-700 text-white hover:border-[#FF9900]'}`}
          >
            {adCooldown > 0 ? `Wait ${Math.floor(adCooldown / 60)}:${(adCooldown % 60).toString().padStart(2, '0')}` : "Watch Ad"}
          </button>
        </div>

        <div className="w-full p-5 bg-zinc-900 border border-zinc-700 rounded-[32px] flex flex-col items-center">
          <div className="text-3xl mb-2">🚫</div>
          <h3 className="text-lg font-black text-white italic uppercase mb-4">Remove Ads for 100h</h3>
          <button 
            onClick={() => startAd('remove_ads')}
            className="w-full h-12 bg-zinc-800 border border-zinc-700 text-[#FF9900] rounded-2xl font-black text-sm uppercase hover:border-[#FF9900] transition-all"
          >
            {/* 🔻 [수정] 시간:분 형식으로 남은 시간 표시 */}
            {adFreeTimeLeft > 0 ? (
                `${Math.floor(adFreeTimeLeft / 3600)}h ${Math.floor((adFreeTimeLeft % 3600) / 60)}m Left`
            ) : "Watch Ad"}
          </button>
        </div>


        {/* 아이템 3: 영구 광고 제거 */}
        <div className="w-full p-5 bg-gradient-to-b from-zinc-800 to-zinc-900 border-2 border-[#FF9900] rounded-[32px] flex flex-col items-center shadow-[0_0_20px_rgba(255,153,0,0.2)] relative overflow-hidden">
          <div className="absolute top-2 right-4 bg-[#FF9900] text-black text-[8px] font-black px-2 py-0.5 rounded-full">BEST</div>
          <div className="text-3xl mb-2">👑</div>
          <h3 className="text-lg font-black text-white italic uppercase mb-4">Forever No Ads</h3>
          <button className="w-full h-12 bg-white text-black rounded-2xl font-black text-sm uppercase hover:bg-zinc-200 transition-all active:scale-95">
            $4.99
          </button>
        </div>

        {/* 아이템 4: 코인 번들 */}
        <div className="w-full p-5 bg-zinc-900 border border-zinc-700 rounded-[32px] flex flex-col items-center">
          <div className="flex -space-x-2 mb-2">
            <img src="/images/coin.png" className="w-8 h-8 object-contain" />
            <img src="/images/coin.png" className="w-8 h-8 object-contain mt-1" />
          </div>
          <h3 className="text-lg font-black text-white italic uppercase mb-4">5,000 Coins</h3>
           <button className="w-full h-12 bg-zinc-800 border border-zinc-700 text-white rounded-2xl font-black text-sm uppercase hover:border-white transition-all active:scale-95">
            $1.99
          </button>
        </div>
        
        {/*  인게임 보상 팝업 UI */}
        {rewardPopup.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            
            {/* 🔻 [수정] p-8 -> px-8 pb-8 pt-16 으로 변경 (위쪽 내부 여백을 확 넓혔습니다) */}
            <div className="w-full max-w-[280px] bg-zinc-900 border-2 border-[#FF9900] rounded-[40px] px-8 pb-8 pt-12 flex flex-col items-center text-center shadow-[0_0_50px_rgba(255,153,0,0.2)] animate-in zoom-in-95 duration-200">
            
            {/* 🔻 [수정] mt-2 정도로 마진을 줄여도 부모의 pt-16 덕분에 충분히 내려와 보입니다 */}
            {rewardPopup.icon.startsWith('/') ? (
                <img src={rewardPopup.icon} alt="reward" className="w-15 h-20 mt-2 mb-6 object-contain animate-bounce" />
            ) : (
                <div className="text-5xl mt-2 mb-6">{rewardPopup.icon}</div>
            )}

            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">{rewardPopup.title}</h3>
            <p className="text-[11px] text-zinc-400 font-bold uppercase leading-tight mb-8 whitespace-pre-line">{rewardPopup.desc}</p>
            
            <button 
                onClick={() => setRewardPopup(prev => ({ ...prev, isOpen: false }))}
                className="w-full h-12 bg-[#FF9900] text-black font-black text-sm rounded-2xl uppercase hover:bg-[#ffad33] active:scale-95 transition-all"
            >
                Confirm
            </button>
            </div>
        </div>
        )}
  
      </div>
    </div>
  );
}