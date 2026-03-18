import React, { useEffect, useRef, useState, useCallback } from 'react';

// html5-qrcode types (v2.3.8)
declare class Html5Qrcode {
  constructor(elementId: string, config?: {
    formatsToSupport?: number[];
    useBarCodeDetectorIfSupported?: boolean;
    verbose?: boolean;
  });
  start(
    cameraIdOrConfig: any,
    config: any,
    onSuccess: (decodedText: string, result: any) => void,
    onError?: (errorMessage: string) => void
  ): Promise<void>;
  stop(): Promise<void>;
  clear(): void;
  scanFile(file: File, showImage?: boolean): Promise<string>;
  static getCameras(): Promise<Array<{ id: string; label: string }>>;
}

// html5-qrcode format enum values
const QR_FORMATS = {
  CODE_128: 5,
  CODE_39: 3,
  CODE_93: 4,
  CODABAR: 2,
  EAN_13: 0,
  EAN_8: 1,
  ITF: 7,
  UPC_A: 11,
  UPC_E: 12,
};

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  isMultiScanMode?: boolean;
  scanCount?: number;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onClose, onScan, isMultiScanMode = false, scanCount = 0 }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const isScanningRef = useRef(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 });

  // 화면 회전 잠금 (세로 모드 고정)
  useEffect(() => {
    if (!isOpen) return;
    const lockOrientation = async () => {
      try {
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('portrait');
        }
      } catch (e) {}
    };
    lockOrientation();
    return () => {
      try {
        if (screen.orientation && (screen.orientation as any).unlock) {
          (screen.orientation as any).unlock();
        }
      } catch (e) {}
    };
  }, [isOpen]);

  // Load html5-qrcode dynamically
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsScanning(false);
    setIsLoading(true);
    setTorchOn(false);
    setTorchSupported(false);
    setZoomSupported(false);
    
    const loadScript = async () => {
      if ((window as any).Html5Qrcode) {
        await initScanner();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.async = true;
      script.onload = () => { initScanner(); };
      script.onerror = () => { setIsLoading(false); setError('스캐너 라이브러리를 로드할 수 없습니다'); };
      document.body.appendChild(script);
    };

    // 10초 타임아웃 (ref로 최신 상태 확인)
    const timeout = setTimeout(() => {
      if (!isScanningRef.current) {
        setIsLoading(false);
        setError('CAMERA_FAILED');
      }
    }, 10000);

    loadScript();
    return () => { clearTimeout(timeout); stopScanner(); };
  }, [isOpen]);

  const initScanner = async () => {
    try {
      setError(null);
      const Html5QrcodeClass = (window as any).Html5Qrcode;
      if (!Html5QrcodeClass) {
        setIsLoading(false);
        setError('Html5Qrcode not loaded');
        return;
      }
      await startScanner();
    } catch (err: any) {
      console.error('[BarcodeScanner] Camera init error:', err);
      setIsLoading(false);
      setError('카메라 초기화 실패: ' + (err.message || err));
    }
  };

  const startScanner = async () => {
    const Html5QrcodeClass = (window as any).Html5Qrcode;
    if (!Html5QrcodeClass) return;

    // Stop existing scanner
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
      trackRef.current = null;
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const scannerConfig = {
      formatsToSupport: [
        QR_FORMATS.CODE_128,
        QR_FORMATS.CODE_39,
        QR_FORMATS.CODE_93,
        QR_FORMATS.CODABAR,
        QR_FORMATS.EAN_13,
        QR_FORMATS.EAN_8,
        QR_FORMATS.ITF,
        QR_FORMATS.UPC_A,
        QR_FORMATS.UPC_E,
      ],
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    };

    const qrConfig = {
      fps: 30,
      qrbox: { width: 350, height: 120 },
      disableFlip: true,
      aspectRatio: 16 / 9,
    };

    const onSuccess = (decodedText: string) => {
      console.log('[BarcodeScanner] Scanned:', decodedText);
      if (navigator.vibrate) { navigator.vibrate([50, 30, 50]); }
      onScan(decodedText);
      if (!isMultiScanMode) { handleClose(); }
    };

    // 3단계 fallback 시도
    const attempts = [
      // 1단계: 후면카메라 4K 최고해상도
      { facingMode: { exact: 'environment' }, width: { ideal: 3840, min: 1920 }, height: { ideal: 2160, min: 1080 } },
      // 2단계: 후면카메라 FHD
      { facingMode: { exact: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      // 3단계: 후면카메라 기본
      { facingMode: 'environment' },
      // 4단계: 아무 카메라
      true,
    ];

    for (let i = 0; i < attempts.length; i++) {
      try {
        console.log('[BarcodeScanner] Attempt', i + 1, JSON.stringify(attempts[i]));
        scannerRef.current = new Html5QrcodeClass('barcode-reader', scannerConfig);

        await scannerRef.current.start(
          attempts[i],
          qrConfig,
          onSuccess,
          () => {}
        );

        // 성공! 카메라 기능 설정
        try {
          const videoEl = document.querySelector('#barcode-reader video') as HTMLVideoElement;
          if (videoEl && videoEl.srcObject) {
            const track = (videoEl.srcObject as MediaStream).getVideoTracks()[0];
            if (track) {
              trackRef.current = track;
              const caps = track.getCapabilities() as any;
              const settings = track.getSettings() as any;
              console.log('[BarcodeScanner] Camera:', settings.width + 'x' + settings.height);

              const advConstraints: any[] = [];
              // 연속 자동 포커스
              if (caps.focusMode && caps.focusMode.includes('continuous')) {
                advConstraints.push({ focusMode: 'continuous' });
              }
              // 줌 (바코드 인식 최적: 2.5x)
              if (caps.zoom) {
                setZoomSupported(true);
                setZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
                const initZoom = Math.min(2.5, caps.zoom.max);
                advConstraints.push({ zoom: initZoom });
                setZoomLevel(initZoom);
              }
              // 플래시
              if (caps.torch) {
                setTorchSupported(true);
              }
              // 노출 모드: 연속 자동
              if (caps.exposureMode && caps.exposureMode.includes('continuous')) {
                advConstraints.push({ exposureMode: 'continuous' });
              }
              // 화이트밸런스: 자동
              if (caps.whiteBalanceMode && caps.whiteBalanceMode.includes('continuous')) {
                advConstraints.push({ whiteBalanceMode: 'continuous' });
              }
              if (advConstraints.length > 0) {
                await track.applyConstraints({ advanced: advConstraints });
              }
            }
          }
        } catch (e) {
          console.log('[BarcodeScanner] Camera enhancement not supported:', e);
        }

        isScanningRef.current = true;
        setIsScanning(true);
        setIsLoading(false);
        setError(null);
        console.log('[BarcodeScanner] Started successfully on attempt', i + 1);
        return; // 성공 → 종료
      } catch (err: any) {
        console.error('[BarcodeScanner] Attempt', i + 1, 'failed:', err.name, err.message);
        // 실패 → scanner cleanup 후 다음 시도
        if (scannerRef.current) {
          try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch (e) {}
          scannerRef.current = null;
        }
      }
    }

    // 모든 시도 실패
    setIsLoading(false);
    setError('CAMERA_FAILED');
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }
    trackRef.current = null;
    isScanningRef.current = false;
    setIsScanning(false);
    setTorchOn(false);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  // Torch toggle
  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch (e) {
      console.warn('[BarcodeScanner] Torch toggle failed:', e);
    }
  }, [torchOn]);

  // Zoom control
  const handleZoom = useCallback(async (newZoom: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(zoomRange.min, Math.min(zoomRange.max, newZoom));
    try {
      await track.applyConstraints({ advanced: [{ zoom: clamped } as any] });
      setZoomLevel(clamped);
    } catch (e) {
      console.warn('[BarcodeScanner] Zoom failed:', e);
    }
  }, [zoomRange]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black barcode-scanner-container z-[999999]">
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        {isMultiScanMode ? (
          <div className="px-3 py-1.5 bg-blue-500 text-white text-sm font-bold rounded-full">
            {scanCount}건
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {/* Torch button */}
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`p-2.5 rounded-full transition-all ${torchOn ? 'bg-yellow-400 shadow-lg shadow-yellow-400/30' : 'bg-white/20 active:bg-white/30'}`}
            >
              {torchOn ? (
                <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5l-1 3h2l-1-3zm0 20l1-3h-2l1 3zM5.64 7.05L7.05 5.64 4.93 3.52 3.52 4.93l2.12 2.12zM18.36 16.95l-1.41 1.41 2.12 2.12 1.41-1.41-2.12-2.12zM2 13h3v-2H2v2zm17 0h3v-2h-3v2zM5.64 16.95l-2.12 2.12 1.41 1.41 2.12-2.12-1.41-1.41zM18.36 7.05l2.12-2.12-1.41-1.41-2.12 2.12 1.41 1.41z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              )}
            </button>
          )}

          {/* Close/Search button */}
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors active:scale-95 flex items-center gap-2"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-white font-medium text-sm">조회하기</span>
          </button>
        </div>
      </div>

      {/* Scanner area */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: '60px', bottom: '180px' }}>
        <div id="barcode-reader" className="w-full max-w-md mx-4"></div>
      </div>

      {/* Loading indicator */}
      {isLoading && !isScanning && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-white text-sm font-medium">카메라 준비 중...</p>
          </div>
        </div>
      )}

      {/* Scan overlay - 1D barcode shape (wide + thin) */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-[350px] h-[120px] relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
            <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scan"></div>
          </div>
        </div>
      )}

      {/* Zoom controls (right side) */}
      {zoomSupported && isScanning && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1">
          <button
            onClick={() => handleZoom(Math.min(zoomLevel + 0.5, zoomRange.max))}
            className="w-9 h-9 rounded-full bg-white/20 active:bg-white/40 flex items-center justify-center"
          >
            <span className="text-white text-lg font-bold">+</span>
          </button>
          <div className="bg-white/10 rounded-full px-2 py-0.5">
            <span className="text-white text-xs font-medium">{zoomLevel.toFixed(1)}x</span>
          </div>
          <button
            onClick={() => handleZoom(Math.max(zoomLevel - 0.5, zoomRange.min))}
            className="w-9 h-9 rounded-full bg-white/20 active:bg-white/40 flex items-center justify-center"
          >
            <span className="text-white text-lg font-bold">-</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-black/80 px-4 pt-3 z-20"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}
      >
        {error ? (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-3">
            <p className="text-orange-300 text-sm text-center font-bold mb-3">
              카메라를 사용할 수 없습니다
            </p>
            <div className="bg-white/10 rounded-lg p-2 mb-2">
              <p className="text-white/70 text-xs">브라우저 설정에서 카메라 권한을 허용 후 새로고침 해주세요</p>
            </div>
            <button
              onClick={() => { window.location.reload(); }}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              새로고침
            </button>
          </div>
        ) : (
          <div className="text-center mb-3">
            <p className="text-white/80 text-sm mb-1">
              장비 바코드를 프레임 안에 맞춰주세요
            </p>
            <p className="text-white/50 text-xs">
              {isMultiScanMode
                ? '연속 스캔 모드 - 여러 장비를 계속 스캔하세요'
                : '자동 인식 중'}
            </p>
          </div>
        )}

        <button
          onClick={handleClose}
          className="w-full py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-semibold transition-colors active:scale-[0.98] border border-gray-500"
        >
          수동 입력
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
        #barcode-reader__scan_region > div {
          border: none !important;
          box-shadow: none !important;
        }
        #qr-shaded-region {
          border: none !important;
        }
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
        @media screen and (orientation: landscape) {
          .barcode-scanner-container {
            transform: rotate(-90deg);
            transform-origin: left top;
            width: 100vh !important;
            height: 100vw !important;
            position: fixed !important;
            top: 100% !important;
            left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BarcodeScanner;
