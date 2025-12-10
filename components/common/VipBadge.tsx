import React from 'react';
import { Customer } from '../../types';
import { Crown } from 'lucide-react';

interface VipBadgeProps {
  customer: Customer;
  className?: string;
}

const VipBadge: React.FC<VipBadgeProps> = ({ customer, className = "" }) => {
  if (!customer.isVip) return null;

  const getVipStyle = () => {
    switch (customer.vipLevel) {
      case 'VVIP':
        return {
          bgColor: 'bg-gradient-to-r from-yellow-400 to-yellow-500',
          textColor: 'text-yellow-900',
          borderColor: 'border-yellow-300',
          shadow: 'shadow-yellow-200',
          label: 'VVIP'
        };
      case 'VIP':
      default:
        return {
          bgColor: 'bg-gradient-to-r from-purple-400 to-purple-500',
          textColor: 'text-purple-900',
          borderColor: 'border-purple-300',
          shadow: 'shadow-purple-200',
          label: 'VIP'
        };
    }
  };

  const vipStyle = getVipStyle();

  return (
    <div 
      className={`
        inline-flex items-center px-2 py-1 rounded-full text-xs font-bold
        ${vipStyle.bgColor} ${vipStyle.textColor} ${vipStyle.borderColor}
        border shadow-sm ${vipStyle.shadow}
        ${className}
      `}
    >
      <Crown className="w-3 h-3 mr-1" />
      {vipStyle.label}
    </div>
  );
};

export default VipBadge;

