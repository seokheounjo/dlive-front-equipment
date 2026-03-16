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
  static getCameras(): Promise<Array<{ id: string; label: string }>>;
}

// html5-qrcode format enum values (1D barcode only)
const QR_FORMATS = {
  CODE_128: 5,
  CODE_39: 3,
  CODE_93: 4,
  CODABAR: 2,
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
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 });
  const [engineType, setEngineType] = useState<string>('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  // 화면 회전 잠금 (세로 모드 고정)
  useEffect(() => {
    if (!isOpen) return;
    const lockOrientation = async () => {
      try {
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('portrait');
        }
      } catch (e) {
        // 지원하지 않는 브라우저는 무시
      }
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
    setTorchOn(false);
    setTorchSupported(false);
    setZoomSupported(false);
    setEngineType('');

    const loadScript = async () => {
      if ((window as any).Html5Qrcode) {
        await initScanner();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.async = true;
      script.onload = () => { initScanner(); };
      script.onerror = () => { setError('바코드 스캐너를 로드할 수 없습니다.'); };
      document.body.appendChild(script);
    };
    loadScript();
    return () => { stopScanner(); };
  }, [isOpen]);

  const initScanner = async () => {
    try {
      setError(null);
      const Html5QrcodeClass = (window as any).Html5Qrcode;
      if (!Html5QrcodeClass) {
        setError('Html5Qrcode not loaded');
        return;
      }
      await startScanner();
    } catch (err: any) {
      console.error('[BarcodeScanner] Camera init error:', err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission') || err.message?.includes('denied')) {
        setPermissionDenied(true);
        setError('PERMISSION_DENIED');
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
        } catch (e) {}
        scannerRef.current = null;
        trackRef.current = null;
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // KEY FIX 1: Format filtering + Native BarcodeDetector
      const hasNativeBD = 'BarcodeDetector' in window;
      scannerRef.current = new Html5QrcodeClass('barcode-reader', {
        formatsToSupport: [
          QR_FORMATS.CODE_128,
          QR_FORMATS.CODE_39,
          QR_FORMATS.CODE_93,
          QR_FORMATS.CODABAR,
        ],
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      setEngineType(hasNativeBD ? 'HW' : 'SW');

      // KEY FIX 2: High-res camera FROM THE START
      const videoConstraints: MediaTrackConstraints = {
        facingMode: { exact: 'environment' },
        width: { min: 1280, ideal: 1920, max: 3840 },
        height: { min: 720, ideal: 1080, max: 2160 },
      };

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 90 },
        disableFlip: true,
      };

      await scannerRef.current.start(
        videoConstraints,
        config,
        (decodedText: string) => {
          console.log('[BarcodeScanner] Scanned:', decodedText);
          if (navigator.vibrate) { navigator.vibrate([50, 30, 50]); }
          onScan(decodedText);
          if (!isMultiScanMode) { handleClose(); }
        },
        () => {}
      );

      // KEY FIX 3: Immediately apply focus + zoom + torch detection
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

            // Continuous autofocus
            if (caps.focusMode && caps.focusMode.includes('continuous')) {
              advConstraints.push({ focusMode: 'continuous' });
              console.log('[BarcodeScanner] Continuous autofocus ON');
            }

            // Default zoom 2x
            if (caps.zoom) {
              setZoomSupported(true);
              setZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
              const initZoom = Math.min(2.0, caps.zoom.max);
              advConstraints.push({ zoom: initZoom });
              setZoomLevel(initZoom);
            }

            // Torch detection
            if (caps.torch) {
              setTorchSupported(true);
            }

            if (advConstraints.length > 0) {
              await track.applyConstraints({ advanced: advConstraints });
            }
          }
        }
      } catch (e) {
        console.log('[BarcodeScanner] Camera enhancement not supported:', e);
      }

      setIsScanning(true);
      setError(null);
    } catch (err: any) {
      console.error('[BarcodeScanner] Scanner start error:', err);

      // Fallback: exact facingMode fail
      if (err.name === 'OverconstrainedError' && scannerRef.current) {
        try {
          await scannerRef.current.start(
            { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            { fps: 15, qrbox: { width: 280, height: 90 }, disableFlip: true },
            (decodedText: string) => {
              if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
              onScan(decodedText);
              if (!isMultiScanMode) handleClose();
            },
            () => {}
          );
          setIsScanning(true);
          setError(null);
          return;
        } catch (e2) {
          console.error('[BarcodeScanner] Fallback failed:', e2);
        }
      }
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission') || err.message?.includes('denied')) {
        setPermissionDenied(true);
        setError('PERMISSION_DENIED');
      } else {
        setError('카메라를 시작할 수 없습니다.\n' + (err.message || '권한을 확인해주세요.'));
      }
    }
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
    setIsScanning(false);
    setTorchOn(false);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    setPermissionDenied(false);
    await stopScanner();
    await new Promise(resolve => setTimeout(resolve, 300));
    await initScanner();
    setIsRetrying(false);
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

      {/* Scan overlay - 1D barcode shape (wide + thin) */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-[280px] h-[90px] relative">
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
            {permissionDenied ? (
              <>
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-8 h-8 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <p className="text-red-200 text-sm text-center font-semibold mb-2">
                  카메라 접근이 차단되었습니다
                </p>
                <div className="bg-black/30 rounded-lg p-3 mb-3">
                  <p className="text-white/90 text-xs font-semibold mb-1.5">권한 허용 방법:</p>
                  <div className="text-white/70 text-xs space-y-1">
                    <p>1. 주소창 왼쪽 자물쇠 아이콘 터치</p>
                    <p>2. "권한" 또는 "사이트 설정" 터치</p>
                    <p>3. 카메라 → "허용"으로 변경</p>
                    <p>4. 페이지 새로고침 후 다시 시도</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { window.location.reload(); }}
                    className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
                  >
                    새로고침
                  </button>
                  <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                  >
                    {isRetrying ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        요청 중
                      </>
                    ) : (
                      '다시 시도'
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        ) : (
          <div className="text-center mb-3">
            <p className="text-white/80 text-sm mb-1">
              장비 바코드를 프레임 안에 맞춰주세요
            </p>
            <p className="text-white/50 text-xs">
              {isMultiScanMode
                ? '연속 스캔 모드 - 여러 장비를 계속 스캔하세요'
                : `자동 인식 중${engineType ? ` (${engineType})` : ''}`}
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
