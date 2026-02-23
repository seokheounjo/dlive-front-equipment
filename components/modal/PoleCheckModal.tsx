import React, { useState, useEffect } from 'react';
import Select from '../ui/Select';
import BaseModal from '../common/BaseModal';

interface PoleCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { POLE_YN: string; LAN_GB: string }) => void;
  soId?: string;
}

// 공통코드 CMWO228 기반 전주실태조사 옵션
const poleYnOptions = [
  { value: '0', label: '해당없음' },
  { value: '1', label: '위해 개소' },
  { value: '2', label: '서브탭 요청' },
  { value: '3', label: '망구조 개선' },
];

const PoleCheckModal: React.FC<PoleCheckModalProps> = ({
  isOpen,
  onClose,
  onSave,
  soId,
}) => {
  const [poleYn, setPoleYn] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPoleYn('');
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!poleYn) {
      alert('전주실태조사 항목을 선택하십시오.');
      return;
    }
    onSave({ POLE_YN: poleYn, LAN_GB: '' });
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="전주승주조사"
      size="sm"
    >
      <div className="space-y-5 p-4">
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
            전주실태조사 <span className="text-red-500">*</span>
          </label>
          <Select
            value={poleYn}
            onValueChange={setPoleYn}
            options={poleYnOptions}
            placeholder="선택"
            required
          />
        </div>
      </div>

      <div className="flex gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors text-sm sm:text-base"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors text-sm sm:text-base"
        >
          저장
        </button>
      </div>
    </BaseModal>
  );
};

export default PoleCheckModal;
