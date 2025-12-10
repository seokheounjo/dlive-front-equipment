import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface NoticePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

// 공지 이미지 목록
const NOTICE_IMAGES = [
  '/notice-1.png',
  '/notice-2.png',
  '/notice-3.png',
];

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dontShowToday, setDontShowToday] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // 스와이프 감지 최소 거리
  const minSwipeDistance = 50;

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
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

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : NOTICE_IMAGES.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < NOTICE_IMAGES.length - 1 ? prev + 1 : 0));
  };

  // 터치 이벤트 핸들러 (모바일 스와이프)
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
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

        {/* 이미지 슬라이더 컨테이너 */}
        <div
          className="relative rounded-2xl overflow-hidden shadow-2xl bg-black"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* 이미지 */}
          <div className="relative">
            <img
              src={NOTICE_IMAGES[currentIndex]}
              alt={`공지사항 ${currentIndex + 1}`}
              className="w-full h-auto transition-opacity duration-300"
            />

            {/* 좌측 화살표 */}
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>

            {/* 우측 화살표 */}
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* 페이지 인디케이터 (1, 2, 3) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {NOTICE_IMAGES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                  ${idx === currentIndex
                    ? 'bg-white text-gray-900 scale-110 shadow-lg'
                    : 'bg-white/30 text-white hover:bg-white/50'}
                `}
              >
                {idx + 1}
              </button>
            ))}
          </div>
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
