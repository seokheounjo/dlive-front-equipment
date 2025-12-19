import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface NoticePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

// 안전행동 규범준수 캠페인 이미지
const NOTICE_IMAGE = '/shuild.png';

// 하루동안 안보기 체크 (localStorage)
const STORAGE_KEY = 'notice_popup_dismissed';

const getDismissedDate = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const setDismissedDate = (): void => {
  try {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEY, today);
  } catch {
    // localStorage 접근 실패 시 무시
  }
};

export const shouldShowNoticePopup = (): boolean => {
  const dismissedDate = getDismissedDate();
  if (!dismissedDate) return true;

  const today = new Date().toISOString().split('T')[0];
  return dismissedDate !== today;
};

const NoticePopup: React.FC<NoticePopupProps> = ({ isOpen, onClose }) => {
  const [dontShowToday, setDontShowToday] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDontShowToday(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowToday) {
      setDismissedDate();
    }
    onClose();
  };

  // 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md">
        {/* 닫기 버튼 */}
        <button
          onClick={handleClose}
          className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all z-10"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* 이미지 컨테이너 */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white">
          <img
            src={NOTICE_IMAGE}
            alt="안전행동 규범준수 캠페인"
            className="w-full h-auto"
          />
        </div>

        {/* 하단: 하루동안 안보기 + 닫기 */}
        <div className="mt-4 flex items-center justify-between px-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowToday}
              onChange={(e) => setDontShowToday(e.target.checked)}
              className="w-4 h-4 rounded border-white/50 bg-white/20 text-blue-500 focus:ring-0"
            />
            <span className="text-sm text-white/90">오늘 하루 보지 않기</span>
          </label>
          <button
            onClick={handleClose}
            className="px-5 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-full transition-all backdrop-blur-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoticePopup;
