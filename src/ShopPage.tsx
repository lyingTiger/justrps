import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AdOverlay from './AdOverlay';

interface ShopPageProps {
  userCoins: number;
  userItems: { stop: number; switch: number; color: number; heal: number };
  onPurchaseItem: (type: string, amount: number) => Promise<void>;
  onBack: () => void;
  currentUserId: string | null;
  onUpdateCoins: (newAmount: number) => void;
  playClickSound?: () => void; // 💉 사운드 프롭 추가됨
}

export default function ShopPage({ 
  userCoins, 
  userItems, 
  onPurchaseItem, 
  onBack, 
  currentUserId,
  onUpdateCoins,
  playClickSound
}: ShopPageProps) {

  const [infoTarget, setInfoTarget] = useState<string | null>(null);

  // 💉 광고 관련 상태
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
    if (adCooldown > 0) return;
    setAdType(type);
    setIsAdOpen(true);
  };

  const handleAdReward = async () => {
    if (!currentUserId) return;
    await supabase.from('profiles').update({ last_ad_watched_at: new Date().toISOString() }).eq('id', currentUserId);
    setAdCooldown(180);

    if (adType === 'coins') {
        const bonus = 1000;
        await supabase.rpc('add_coins_batch', { row_id: currentUserId, amount: bonus });
        onUpdateCoins(userCoins + bonus);
        setRewardPopup({ isOpen: true, title: `+${bonus.toLocaleString()} COINS!`, desc: "ADDED TO YOUR WALLET.", icon: "/images/coin.png" });
    } else if (adType === 'remove_ads') {
        const duration = 50 * 60 * 60 * 1000;
        const newAdFreeUntil = new Date(Date.now() + duration).toISOString();
        await supabase.from('profiles').update({ ad_free_until: newAdFreeUntil }).eq('id', currentUserId);
        setAdFreeTimeLeft(50 * 60 * 60); 
        setRewardPopup({ isOpen: true, title: "50 Hours AD-FREE!", desc: "ENJOY PURE GAME.", icon: "/images/icon_noAd.png" });
    } else {
        await onPurchaseItem(adType, 5);
        const itemNames = { stop: 'STOP 5 sec', switch: 'SWITCH Btns', color: 'Kill COLORS', heal: 'HEAL now' };
        setRewardPopup({ isOpen: true, title: `"${itemNames[adType]}" x5`, desc: "ITEMS ADDED TO INVENTORY.", icon: `/images/item${adType.charAt(0).toUpperCase() + adType.slice(1)}${adType === 'stop' ? '3sec' : adType === 'switch' ? 'Btn' : ''}.png` });
    }
  };

  return (
    <div className="w-full max-w-[360px] flex flex-col items-center mt-4 gap-2 px-4 pb-10 select-none">
      <AdOverlay isOpen={isAdOpen} onClose={() => setIsAdOpen(false)} onReward={handleAdReward} />

      {/* 💉 [신규] 외부 클릭 감지용 투명 레이어: 인벤토리 아이템 안내창이 열려있을 때만 활성화 */}
      {infoTarget && (
        <div 
          className="fixed inset-0 z-[350] bg-transparent" 
          onClick={() => setInfoTarget(null)} 
        />
      )}

      <div className="w-full flex justify-end mb-2">
        <button onClick={onBack} className="px-4 py-1 bg-zinc-800 hover:bg-[#ff9900] text-white hover:text-black text-[10px] font-black uppercase border border-zinc-600 rounded-[10px]">Back</button>
      </div>

      <div className="w-full mb-1 ml-1 text-left">
        <span className="text-[10px] font-black text-[#ffcc33] uppercase tracking-widest italic">Inventory</span>
      </div>

      {/* 💉 1. 보유 아이템 인벤토리 (구조 정상화) */}
      <div className="w-full grid grid-cols-4 gap-2 mb-8 p-3 rounded-[12px] bg-zinc-900/50 relative">
        {[
          { id: 'stop', img: 'itemStop3sec.png', count: userItems.stop },
          { id: 'switch', img: 'itemSwitchBtn.png', count: userItems.switch },
          { id: 'gray', img: 'itemColor.png', count: userItems.color },
          { id: 'heal', img: 'itemHeal.png', count: userItems.heal }
        ].map((item) => (
          <div 
            key={item.id} 
            className="relative flex flex-col items-center cursor-pointer z-[360]"
            onClick={(e) => {
              e.stopPropagation();
              setInfoTarget(infoTarget === item.id ? null : item.id);
              if (playClickSound) playClickSound();
            }}
          >
            <img src={`/images/${item.img}`} alt={item.id} className="w-14 h-14 object-contain" />
            <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-zinc-900 px-1 shadow-lg">
              {item.count}
            </div>

            {/* 💉 안내창 UI */}
            {infoTarget === item.id && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-[400] w-40 animate-in fade-in zoom-in-95 duration-150">

                {/* 💉 h-20(80px) 또는 h-[90px] 정도로 높이를 고정하고, flex-col justify-center로 중앙 정렬합니다. */}
                  <div className="bg-zinc-900 border-2 border-[#FF9900] rounded-xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-center relative h-24 flex flex-col justify-center">

                  <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-[#FF9900]"></div>
                  <h4 className="text-[#FF9900] text-[11px] font-black uppercase mb-1">{item.id}</h4>
                  <p className="text-zinc-200 text-[10px] font-bold leading-tight whitespace-pre-line break-keep">
                    {item.id === 'stop' && "다음 라운드에서\n상대방의 시간을\n3초간 정지시킵니다."}
                    {item.id === 'switch' && "다음 라운드에서\n상대방의 버튼 위치를\n뒤바꿉니다."}
                    {item.id === 'gray' && "다음 라운드에서\n상대방의 모든 문제를\n흑백으로 만듭니다."}
                    {item.id === 'heal' && "공격당한 상태를\n즉시 회복합니다."}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="w-full mb-1 ml-1 text-left">
        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Ads for Rewards</span>
      </div>

      {/* 💉 2. 광고 그리드 영역 */}
      <div className="relative w-full mb-8">
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'stop', img: 'itemStop3sec.png', label: '+5개' },
            { id: 'switch', img: 'itemSwitchBtn.png', label: '+5개' },
            { id: 'color', img: 'itemColor.png', label: '+5개' },
            { id: 'heal', img: 'itemHeal.png', label: '+5개' },
            { id: 'remove_ads', img: 'icon_noAd.png', label: 'No Ad 50H' },
            { id: 'coins', img: 'coins.png', label: '+1,000' }
          ].map((item: any) => (
            <button 
              key={item.id}
              disabled={adCooldown > 0}
              onClick={() => { if(playClickSound) playClickSound(); startAd(item.id); }}
              className={`flex flex-col items-center py-5 border rounded-[12px] transition-all active:scale-95 shadow-lg
                ${adCooldown > 0 ? 'bg-zinc-900/50 border-zinc-800 opacity-50' : 'bg-zinc-800 border-zinc-700 hover:border-[#FF9900]'}`}
            >
              <span className="text-[12px] font-black text-[#FF9900] uppercase leading-none mb-3">{item.label}</span>
              <img src={`/images/${item.img}`} className="w-12 h-12 object-contain" alt={item.id} />
            </button>
          ))}
        </div>

        {/* 쿨타임 오버레이 */}
        {adCooldown > 0 && (
          <div className="absolute inset-0 z-10 bg-black/70 backdrop-blur-sm rounded-[12px] flex flex-col items-center justify-center border border-zinc-800 animate-in fade-in duration-300">
            <img src="/images/icon_houseglass.png" alt="cooldown" className="w-10 h-10 object-contain mb-2" />
            <span className="text-3xl font-black text-red-500 font-mono italic">{Math.floor(adCooldown / 60)}:{(adCooldown % 60).toString().padStart(2, '0')}</span>
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-1">Wait for next Ad</span>
          </div>
        )}
      </div>

      {/* 보상 팝업 */}
      {rewardPopup.isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-[280px] bg-zinc-900 border-2 border-[#FF9900] rounded-[40px] px-8 pb-8 pt-12 flex flex-col items-center text-center animate-in zoom-in-95">
            <img src={rewardPopup.icon} alt="reward" className="w-16 h-16 mb-6 object-contain animate-bounce" />
            <h3 className="text-xl font-black text-white italic uppercase mb-2">{rewardPopup.title}</h3>
            <p className="text-[11px] text-zinc-400 font-bold uppercase mb-8">{rewardPopup.desc}</p>
            <button onClick={() => setRewardPopup(prev => ({ ...prev, isOpen: false }))} className="w-full h-12 bg-[#FF9900] text-black font-black text-sm rounded-2xl uppercase">Confirm</button>
          </div>
        </div>
      )}
    </div>
  );
}