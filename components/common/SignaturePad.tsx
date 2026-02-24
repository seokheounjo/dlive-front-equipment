import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Trash2, Check, RotateCcw } from 'lucide-react';
import ConfirmModal, { ConfirmModalType } from './ConfirmModal';

interface SignaturePadProps {
  onSave: (signatureData: string) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  title?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  onCancel,
  width = 340,
  height = 200,
  penColor = '#000000',
  backgroundColor = '#ffffff',
  title = '서명'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: ConfirmModalType;
    message: string;
    showCancel: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, type: 'warning', message: '', showCancel: false, onConfirm: () => {} });

  // Canvas 초기화
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 배경색 설정
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 펜 설정
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [backgroundColor, penColor]);

  // 좌표 계산
  const getCoordinates = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  }, []);

  // 그리기 시작
  const startDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    lastPointRef.current = coords;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  }, [getCoordinates]);

  // 그리기
  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords || !lastPointRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
    setHasSignature(true);
  }, [isDrawing, getCoordinates]);

  // 그리기 종료
  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPointRef.current = null;
  }, []);

  // 캔버스 초기화
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, [backgroundColor]);

  // 서명 저장 (레거시 검증 로직 적용)
  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    let signatureData = canvas.toDataURL('image/png');
    // 레거시: + → %2B 치환
    signatureData = signatureData.replace(/\+/g, '%2B');

    // 레거시: 서명 식별 검증
    if (signatureData.length < 5000) {
      setModalState({
        isOpen: true,
        type: 'error',
        message: '서명하신 것이 식별이 되지 않습니다.\n다시하기 버튼을 누르시고 다시 서명해주시기 바랍니다.',
        showCancel: false,
        onConfirm: () => {}
      });
      return;
    }
    if (signatureData.length < 10000) {
      setModalState({
        isOpen: true,
        type: 'warning',
        message: '서명하신 것이 식별이 안 될 수도 있습니다.\n다시하기 버튼을 누르시고 다시 서명하기를 권장드립니다.\n\n이대로 진행하시겠습니까?',
        showCancel: true,
        onConfirm: () => onSave(signatureData)
      });
      return;
    }

    onSave(signatureData);
  }, [hasSignature, onSave]);

  const closeModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* 서명 검증 팝업 */}
      <ConfirmModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        title="서명 확인"
        message={modalState.message}
        type={modalState.type}
        showCancel={modalState.showCancel}
        confirmText={modalState.showCancel ? '진행' : '확인'}
        cancelText="다시 서명"
      />

      {/* 헤더 */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <h3 className="font-medium">{title}</h3>
        <p className="text-xs text-blue-100 mt-0.5">아래 영역에 서명해주세요</p>
      </div>

      {/* 캔버스 영역 */}
      <div className="p-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="touch-none w-full"
            style={{ maxWidth: '100%', height: 'auto', aspectRatio: `${width}/${height}` }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        {/* 안내 문구 */}
        {!hasSignature && (
          <div className="text-center mt-2 text-sm text-gray-400">
            손가락 또는 마우스로 서명하세요
          </div>
        )}
      </div>

      {/* 버튼 영역 */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={clearCanvas}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          다시 쓰기
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            취소
          </button>
        )}
        <button
          onClick={saveSignature}
          disabled={!hasSignature}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <Check className="w-4 h-4" />
          확인
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
