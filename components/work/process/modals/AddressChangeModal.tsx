import React, { useState, useEffect } from 'react';

interface AddressChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AddressChangeData) => void;
  currentAddress?: string;       // ADDR_ORD - Full address
  currentAddressDetail?: string; // ADDR_DTL - Detail address
  currentInstlLoc?: string;      // INSTL_LOC - Installation location
  readOnly?: boolean;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export interface AddressChangeData {
  ADDR_DTL: string;   // Detail address (input)
  INSTL_LOC: string;  // Installation location (input)
}

/**
 * Address Change Modal
 * Simplified version for mobile - shows current address and allows editing detail/location
 * Full address change with post code/building search is not available on mobile
 * Legacy: moco000m06.xml (cmwoa03p19_OnLoadCompleted -> btn_save_OnClick)
 */
export const AddressChangeModal: React.FC<AddressChangeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentAddress = '',
  currentAddressDetail = '',
  currentInstlLoc = '',
  readOnly = false,
  showToast,
}) => {
  const [addrDtl, setAddrDtl] = useState('');
  const [instlLoc, setInstlLoc] = useState('');

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAddrDtl(currentAddressDetail);
      setInstlLoc(currentInstlLoc);
    }
  }, [isOpen, currentAddressDetail, currentInstlLoc]);

  const handleSave = () => {
    if (!addrDtl.trim() && !instlLoc.trim()) {
      showToast?.('상세주소 또는 설치위치를 입력해주세요.', 'error');
      return;
    }

    onSave({
      ADDR_DTL: addrDtl.trim(),
      INSTL_LOC: instlLoc.trim(),
    });

    showToast?.('주소정보가 수정되었습니다.', 'success');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-orange-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base sm:text-lg font-bold">설치주소변경</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-4 overflow-y-auto flex-1">
          {/* Current Address (Read Only) */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-xs text-gray-500 mb-1">현재 작업주소</label>
            <p className="text-gray-900 font-medium whitespace-pre-wrap">
              {currentAddress || '주소 정보 없음'}
            </p>
          </div>

          {/* Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p>
                기본 주소 변경은 PC에서 가능합니다.
                <br />
                아래에서 상세주소와 설치위치만 수정할 수 있습니다.
              </p>
            </div>
          </div>

          {/* Detail Address (Editable) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              상세주소
            </label>
            <input
              type="text"
              value={addrDtl}
              onChange={(e) => setAddrDtl(e.target.value)}
              disabled={readOnly}
              placeholder="상세주소 입력 (예: 101동 1201호)"
              className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>

          {/* Installation Location (Editable) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              설치위치
            </label>
            <input
              type="text"
              value={instlLoc}
              onChange={(e) => setInstlLoc(e.target.value)}
              disabled={readOnly}
              placeholder="설치위치 입력 (예: 거실, 안방)"
              className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 flex gap-2 flex-shrink-0">
          {!readOnly && (
            <button
              onClick={handleSave}
              className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm sm:text-base font-semibold transition-colors"
            >
              저장
            </button>
          )}
          <button
            onClick={onClose}
            className={`${readOnly ? 'flex-1' : ''} px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm sm:text-base font-semibold transition-colors`}
          >
            {readOnly ? '확인' : '취소'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressChangeModal;
