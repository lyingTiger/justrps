import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AdOverlay from './AdOverlay';

interface ShopPageProps {
  userCoins: number;
  userItems: { stop: number; switch: number; color: number; heal: number };
  onPurchaseItem: (type: string, amount: number) => Promise<void>;
  // onClose: () => void;
  onBack: () => void;
  currentUserId: string | null;
  onUpdateCoins: (newAmount: number) => void;
}

export default function ShopPage({ 
  userCoins, 
  userItems, 
  onPurchaseItem, 
  onBack, // 💉 [수정] onClose 대신 onBack을 꺼내옵니다.
  currentUserId,
  onUpdateCoins
}: ShopPageProps) {
  // 💉 [로직 변경] 광고 시청으로 획득 가능한 모든 타입 정의
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [adType, setAdType] = useState<'stop' | 'switch' | 'color' | 'heal' | 'coins' | 'remove_ads'>('coins');
  const [adCooldown, setAdCooldown] = useState(0);
  const [adFreeTimeLeft, setAdFreeTimeLeft] = useState(0);

  const [rewardPopup, setRewardPopup] = useState<{ isOpen: boolean; title: string; desc: string; icon: string }>({
    isOpen: false, title: '', desc: '', icon: ''
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
    const { data } = await supabase.from('profiles').select('last_ad_watched_at, ad_free_until').eq('id', currentUserId).single();
    if (data) {
      if (data.last_ad_watched_at) {
        const diff = Math.floor((Date.now() - new Date(data.last_ad_watched_at).getTime()) / 1000);
        if (diff < 180) setAdCooldown(180 - diff);
      }
      if (data.ad_free_until) {
        const diff = Math.floor((new Date(data.ad_free_until).getTime() - Date.now()) / 1000);
        if (diff > 0) setAdFreeTimeLeft(diff);
      }
    }
  };

  

  const startAd = (type: typeof adType) => {
    if (adCooldown > 0) return; // 쿨타임 중 클릭 방지
    setAdType(type);
    setIsAdOpen(true);
  };



  const handleAdReward = async () => {
    if (!currentUserId) return;
    
    // 쿨타임 공통 적용 (180초)
    await supabase.from('profiles').update({ last_ad_watched_at: new Date().toISOString() }).eq('id', currentUserId);
    setAdCooldown(180);

    if (adType === 'coins') {
        const bonus = 1000; // 💉 보상량 수정: 1000개
        await supabase.rpc('add_coins_batch', { row_id: currentUserId, amount: bonus });
        onUpdateCoins(userCoins + bonus);
        setRewardPopup({ isOpen: true, title: `+${bonus} COINS!`, desc: "ADDED TO YOUR WALLET.", icon: "/images/coin.png" });
    } else if (adType === 'remove_ads') {
        const duration = 50 * 60 * 60 * 1000; // 💉 보상량 수정: 50시간
        const newAdFreeUntil = new Date(Date.now() + duration).toISOString();
        await supabase.from('profiles').update({ ad_free_until: newAdFreeUntil }).eq('id', currentUserId);
        setAdFreeTimeLeft(50 * 60 * 60); 
        setRewardPopup({ isOpen: true, title: "50H AD-FREE!", desc: "PURE GAMEPLAY SECURED.", icon: "🚫" });
    } else {
        // 💉 아이템 4종 보상 (각 5개씩)
        await onPurchaseItem(adType, 5);
        const itemNames = { stop: 'STOP', switch: 'SWITCH', color: 'COLOR', heal: 'HEAL' };
        setRewardPopup({ isOpen: true, title: `+5 ${itemNames[adType]}!`, desc: "ITEMS ADDED TO INVENTORY.", icon: `/images/item${adType.charAt(0).toUpperCase() + adType.slice(1)}${adType === 'stop' ? '3sec' : adType === 'switch' ? 'Btn' : ''}.png` });
    }
  };

  return (
    <div className="w-full max-w-[360px] flex flex-col items-center mt-4 gap-3 px-4 pb-10">
      <AdOverlay isOpen={isAdOpen} onClose={() => setIsAdOpen(false)} onReward={handleAdReward} />

      <div className="w-full flex justify-end mb-2">
        <button onClick={onBack} className="px-4 py-1 bg-zinc-900 text-white text-[10px] font-black uppercase border border-zinc-800 rounded-[10px]">Back</button>
      </div>

      {/* 💉 1. 보유 중인 아이템 텍스트 추가 */}
      <div className="w-full mb-1 ml-1 text-left">
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Items in Possession</span>
      </div>

      <div className="w-full grid grid-cols-4 gap-2 mb-6 p-3 rounded-[12px] border-2 border-[#ffcc33] bg-zinc-900/50">
        {[
          { id: 'stop', img: 'itemStop3sec.png', count: userItems.stop },
          { id: 'switch', img: 'itemSwitchBtn.png', count: userItems.switch },
          { id: 'color', img: 'itemColor.png', count: userItems.color },
          { id: 'heal', img: 'itemHeal.png', count: userItems.heal }
        ].map((item) => (
          <div key={item.id} className="relative flex flex-col items-center">
            <img src={`/images/${item.img}`} alt={item.id} className="w-12 h-12 object-contain" />
            <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-zinc-900 px-1 shadow-lg">{item.count}</div>
          </div>
        ))}
      </div>

      {/* 💉 2 & 4 & 5. 광고 시청 보상 목록 (3열 그리드 / 아이템 스타일) */}
      <div className="w-full grid grid-cols-3 gap-2 mb-8">
        {[
          { id: 'stop', img: 'itemStop3sec.png', label: '5개', sub: 'STOP' },
          { id: 'switch', img: 'itemSwitchBtn.png', label: '5개', sub: 'SWITCH' },
          { id: 'color', img: 'itemColor.png', label: '5개', sub: 'COLOR' },
          { id: 'heal', img: 'itemHeal.png', label: '5개', sub: 'HEAL' },
          { id: 'remove_ads', icon: '🚫', label: '50H', sub: 'AD-FREE' },
          { id: 'coins', img: 'coin.png', label: '1,000', sub: 'COINS' }
        ].map((item: any) => (
          <button 
            key={item.id}
            disabled={adCooldown > 0}
            onClick={() => startAd(item.id)}
            className={`flex flex-col items-center py-4 border rounded-[12px] transition-all active:scale-95 shadow-lg
              ${adCooldown > 0 ? 'bg-zinc-900/50 border-zinc-800 opacity-50 grayscale' : 'bg-zinc-800 border-zinc-700 hover:border-[#FF9900]'}`}
          >
            <span className="text-[10px] font-black text-[#FF9900] uppercase leading-none mb-2">{item.label}</span>
            {item.img ? (
                <img src={`/images/${item.img}`} className="w-8 h-8 object-contain mb-2" alt={item.id} />
            ) : (
                <div className="text-2xl mb-2">{item.icon}</div>
            )}
            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter">
                {adCooldown > 0 ? "Wait..." : "Watch Ad"}
            </span>
          </button>
        ))}
      </div>

      <div className="w-full border-t border-zinc-800/50 my-4" />

      {/* 💉 6. 영구 광고 제거 (최하단 고정) */}
      <div className="w-full p-5 bg-gradient-to-b from-zinc-800 to-zinc-900 border-2 border-[#FF9900] rounded-[32px] flex flex-col items-center shadow-[0_0_20px_rgba(255,153,0,0.2)] relative overflow-hidden">
        <div className="absolute top-2 right-4 bg-[#FF9900] text-black text-[8px] font-black px-2 py-0.5 rounded-full">BEST</div>
        <div className="text-3xl mb-2">👑</div>
        <h3 className="text-lg font-black text-white italic uppercase mb-4">Forever No Ads</h3>
        <button className="w-full h-12 bg-white text-black rounded-2xl font-black text-sm uppercase hover:bg-zinc-200 transition-all active:scale-95">
          $4.99
        </button>
      </div>

      {/* 보상 팝업 UI (기존 로직 유지) */}
      {rewardPopup.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-[280px] bg-zinc-900 border-2 border-[#FF9900] rounded-[40px] px-8 pb-8 pt-12 flex flex-col items-center text-center animate-in zoom-in-95">
            {rewardPopup.icon.startsWith('/') ? (
              <img src={rewardPopup.icon} alt="reward" className="w-16 h-16 mb-6 object-contain animate-bounce" />
            ) : (
              <div className="text-5xl mb-6">{rewardPopup.icon}</div>
            )}
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">{rewardPopup.title}</h3>
            <p className="text-[11px] text-zinc-400 font-bold uppercase mb-8">{rewardPopup.desc}</p>
            <button onClick={() => setRewardPopup(prev => ({ ...prev, isOpen: false }))} className="w-full h-12 bg-[#FF9900] text-black font-black text-sm rounded-2xl uppercase">Confirm</button>
          </div>
        </div>
      )}
    </div>
  );
}