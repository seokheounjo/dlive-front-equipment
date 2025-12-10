import React, { useEffect, useState } from 'react';
import { WorkOrder } from '../../types';
import { Crown, Star } from 'lucide-react';

interface VipCounterProps {
  workOrders: WorkOrder[];
  className?: string;
}

const VipCounter: React.FC<VipCounterProps> = ({ workOrders, className = "" }) => {
  const vipCount = workOrders.filter(order => order.customer.isVip).length;
  const vvipCount = workOrders.filter(order => order.customer.vipLevel === 'VVIP').length;
  const totalVipCount = vipCount + vvipCount;

  // 애니메이션을 위한 카운팅 상태
  const [animatedVipCount, setAnimatedVipCount] = useState(0);
  const [animatedVvipCount, setAnimatedVvipCount] = useState(0);
  const [animatedTotalCount, setAnimatedTotalCount] = useState(0);

  // 숫자 카운팅 애니메이션
  useEffect(() => {
    const duration = 800; // 800ms
    const steps = 30;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setAnimatedVipCount(Math.floor(vipCount * progress));
      setAnimatedVvipCount(Math.floor(vvipCount * progress));
      setAnimatedTotalCount(Math.floor(totalVipCount * progress));

      if (currentStep >= steps) {
        clearInterval(timer);
        setAnimatedVipCount(vipCount);
        setAnimatedVvipCount(vvipCount);
        setAnimatedTotalCount(totalVipCount);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [vipCount, vvipCount, totalVipCount]);

  if (totalVipCount === 0) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* VVIP 카운터 */}
      {vvipCount > 0 && (
        <div className="flex items-center bg-yellow-50 text-yellow-700 px-3 py-2 rounded-lg text-sm font-semibold border border-yellow-200 shadow-sm">
          <Crown className="w-4 h-4 mr-2" />
          <span>VVIP {animatedVvipCount}건</span>
        </div>
      )}

      {/* VIP 카운터 */}
      {vipCount > 0 && (
        <div className="flex items-center bg-purple-50 text-purple-700 px-3 py-2 rounded-lg text-sm font-semibold border border-purple-200 shadow-sm">
          <Crown className="w-4 h-4 mr-2" />
          <span>VIP {animatedVipCount}건</span>
        </div>
      )}

      {/* 전체 VIP 카운터 */}
      {totalVipCount > 1 && (
        <div className="flex items-center bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-semibold border border-blue-200 shadow-sm">
          <Star className="w-4 h-4 mr-2" />
          <span>총 {animatedTotalCount}건</span>
        </div>
      )}
    </div>
  );
};

export default VipCounter;

