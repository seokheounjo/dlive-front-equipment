import React, { useEffect, useRef, useState } from 'react';

// html5-qrcode types
declare class Html5Qrcode {
  constructor(elementId: string);
  start(
    cameraIdOrConfig: string | { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number } | number; aspectRatio?: number },
    onSuccess: (decodedText: string, result: any) => void,
    onError?: (errorMessage: string) => void
  ): Promise<void>;
  stop(): Promise<void>;
  clear(): void;
  static getCameras(): Promise<Array<{ id: string; label: string }>>;
}

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  isMultiScanMode?: boolean;
  scanCount?: number;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onClose, onScan, isMultiScanMode = false, scanCount = 0 }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // 화면 회전 잠금 (세로 모드 고정)
  useEffect(() => {
    if (!isOpen) return;

    const lockOrientation = async () => {
      try {
        // Screen Orientation API
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('portrait');
        }
      } catch (e) {
        // 지원하지 않는 브라우저는 무시
        console.log('Screen orientation lock not supported');
      }
    };

    lockOrientation();

    return () => {
      // 스캐너 닫을 때 회전 잠금 해제
      try {
        if (screen.orientation && (screen.orientation as any).unlock) {
          (screen.orientation as any).unlock();
        }
      } catch (e) {
        // 무시
      }
    };
  }, [isOpen]);

  // Load html5-qrcode dynamically
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setIsScanning(false);

    const loadScript = async () => {
      // Check if already loaded
      if ((window as any).Html5Qrcode) {
        await initScanner();
        return;
      }

      // Load script dynamically
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.async = true;
      script.onload = () => {
        initScanner();
      };
      script.onerror = () => {
        setError('바코드 스캐너를 로드할 수 없습니다.');
      };
      document.body.appendChild(script);
    };

    loadScript();

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const initScanner = async () => {
    try {
      setError(null);
      const Html5QrcodeClass = (window as any).Html5Qrcode;
      if (!Html5QrcodeClass) {
        setError('Html5Qrcode not loaded');
        return;
      }

      // Start scanning with back camera only
      await startScanner();
    } catch (err: any) {
      console.error('Camera init error:', err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        setError('카메라 접근 권한이 필요합니다.\n설정에서 카메라 권한을 허용해주세요.');
      } else if (err.message?.includes('secure context') || err.message?.includes('https')) {
        setError('카메라는 HTTPS 또는 localhost에서만 사용 가능합니다.\n\n수동으로 S/N을 입력해주세요.');
      } else {
        setError('카메라를 초기화할 수 없습니다:\n' + (err.message || err));
      }
    }
  };

  const startScanner = async () => {
    try {
      const Html5QrcodeClass = (window as any).Html5Qrcode;
      if (!Html5QrcodeClass) return;

      // Stop existing scanner
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (e) {
          // Ignore
        }
        scannerRef.current = null;
      }

      // Wait for DOM element
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create new scanner
      scannerRef.current = new Html5QrcodeClass('barcode-reader');

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.777778, // 16:9
      };

      await scannerRef.current.start(
        { facingMode: 'environment' }, // Back camera only
        config,
        (decodedText: string) => {
          console.log('Barcode scanned:', decodedText);
          // Vibrate on success (mobile)
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          onScan(decodedText);
          // Multi-scan mode: keep scanner open
          if (!isMultiScanMode) {
            handleClose();
          }
        },
        (errorMessage: string) => {
          // Ignore scan errors (continuous scanning)
        }
      );

      setIsScanning(true);
      setError(null);
    } catch (err: any) {
      console.error('Scanner start error:', err);
      setError('카메라를 시작할 수 없습니다.\n' + (err.message || '권한을 확인해주세요.'));
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // Ignore
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);

    // Stop any existing scanner
    await stopScanner();

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 300));

    // Try to reinitialize
    await initScanner();
    setIsRetrying(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black"
      style={{ zIndex: 99999 }}
    >
      {/* X 닫기 버튼만 (우상단 플로팅) */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-30 p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors active:scale-95"
        style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 스캔 카운터 (복수 스캔 모드) */}
      {isMultiScanMode && (
        <div
          className="absolute top-4 left-4 z-30 px-3 py-2 bg-blue-500 text-white text-sm font-bold rounded-full"
          style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
        >
          {scanCount}건
        </div>
      )}

      {/* Scanner area - 전체 화면 */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: '60px', bottom: '160px' }}>
        <div id="barcode-reader" className="w-full max-w-md mx-4"></div>
      </div>

      {/* Scan overlay */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-40 relative">
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>

            {/* Scan line animation */}
            <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scan"></div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-black/80 px-4 pt-3 z-20"
        style={{ paddingBottom: '10px' }}
      >
        {error ? (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-3">
            <p className="text-red-200 text-sm text-center whitespace-pre-line">{error}</p>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full mt-3 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              {isRetrying ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  권한 요청 중...
                </>
              ) : (
                '다시 시도'
              )}
            </button>
          </div>
        ) : (
          <div className="text-center mb-3">
            <p className="text-white/80 text-sm mb-1">
              장비 바코드를 화면 중앙에 맞춰주세요
            </p>
            <p className="text-white/50 text-xs">
              {isMultiScanMode
                ? '연속 스캔 모드 - 여러 장비를 계속 스캔하세요'
                : 'S/N 바코드가 자동으로 인식됩니다'}
            </p>
          </div>
        )}

        {/* Manual input button */}
        <button
          onClick={handleClose}
          className="w-full py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-colors active:scale-[0.98]"
        >
          수동 입력으로 돌아가기
        </button>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 10%; }
          50% { top: 85%; }
          100% { top: 10%; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
        #barcode-reader {
          border: none !important;
          background: transparent !important;
          width: 100% !important;
        }
        #barcode-reader video {
          width: 100% !important;
          height: auto !important;
          object-fit: cover !important;
        }
        #barcode-reader__scan_region {
          background: transparent !important;
          min-height: 300px !important;
        }
        #barcode-reader__scan_region img {
          display: none !important;
        }
        #barcode-reader__scan_region br {
          display: none !important;
        }
        /* Hide the qrbox border */
        #barcode-reader__scan_region > div {
          border: none !important;
          box-shadow: none !important;
        }
        #qr-shaded-region {
          border: none !important;
        }
        /* Hide all library UI elements */
        #barcode-reader__dashboard,
        #barcode-reader__dashboard_section,
        #barcode-reader__dashboard_section_swaplink,
        #barcode-reader__dashboard_section_csr,
        #barcode-reader__status_span,
        #barcode-reader__header_message,
        #barcode-reader img[alt="Info icon"],
        #barcode-reader a {
          display: none !important;
        }
        #barcode-reader > div:last-child {
          display: none !important;
        }
      `}</style>
    </div>
  );
};

export default BarcodeScanner;
