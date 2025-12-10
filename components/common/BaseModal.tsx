import React, { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';
import './BaseModal.css';

export type ModalSize = 'small' | 'medium' | 'large';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  subHeader?: ReactNode;
}

/**
 * BaseModal - 모든 모달의 기본 구조
 *
 * 모바일 최적화:
 * - Small: max-w-sm (384px) - 알림, 확인
 * - Medium: max-w-lg (512px) - 기본, 대부분 사용
 * - Large: max-w-2xl (672px) - 복잡한 폼
 *
 * 구조:
 * - Header: 고정 (타이틀 + 닫기 버튼)
 * - SubHeader: 선택적 (검색 조건 등)
 * - Body: 스크롤 가능
 * - Footer: 고정 (버튼 영역)
 */
const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'medium',
  children,
  footer,
  subHeader,
}) => {
  // 모달 오픈 시 백그라운드 스크롤 잠금
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = {
    small: 'modal-sm',
    medium: 'modal-md',
    large: 'modal-lg',
  }[size];

  return (
    <div className="base-modal-overlay" onClick={onClose}>
      <div
        className={`base-modal-container ${sizeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 - 고정 */}
        <div className="base-modal-header">
          <h2 className="base-modal-title">{title}</h2>
          <button
            onClick={onClose}
            className="base-modal-close-btn"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 서브헤더 - 선택적 */}
        {subHeader && (
          <div className="base-modal-subheader">
            {subHeader}
          </div>
        )}

        {/* 본문 - 스크롤 가능 */}
        <div className="base-modal-body">
          {children}
        </div>

        {/* 푸터 - 고정 (버튼 영역) */}
        {footer && (
          <div className="base-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseModal;
