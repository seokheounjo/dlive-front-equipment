import React, { useEffect, useRef, useState, useCallback } from 'react';

// html5-qrcode types (v2.3.8) - fallback용
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

const QR_FORMATS = {
  CODE_128: 5, CODE_39: 3, CODE_93: 4, CODABAR: 2,
  EAN_13: 0, EAN_8: 1, ITF: 7, UPC_A: 11, UPC_E: 12,
};

// Native BarcodeDetector 지원 확인
const hasNativeBarcodeDetector = typeof (window as any).BarcodeDetector !== 'undefined';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  isMultiScanMode?: boolean;
  scanCount?: number;
}

// ============================================================
// Canvas 이미지 전처리 함수들
// ============================================================

// 그레이스케일 변환
function toGrayscale(imageData: ImageData): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(imageData.width * imageData.height);
  const d = imageData.data;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    // ITU-R BT.601 가중치 (인간 시각 최적)
    gray[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  }
  return gray;
}

// 샤프닝 (언샤프 마스크 - 바코드 엣지 강화)
function applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const copy = new Uint8ClampedArray(d);
  // 3x3 Sharpen kernel: [0,-1,0,-1,5,-1,0,-1,0]
  const strength = 1.5; // 샤프닝 강도 (1.0=기본, 1.5=강)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const val = copy[idx + c] * (4 * strength + 1)
          - copy[idx - 4 + c] * strength
          - copy[idx + 4 + c] * strength
          - copy[idx - w * 4 + c] * strength
          - copy[idx + w * 4 + c] * strength;
        d[idx + c] = Math.max(0, Math.min(255, val));
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// 대비 향상 (히스토그램 스트레칭)
function enhanceContrast(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  // min/max 찾기
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  // 스트레칭 (범위가 충분히 좁을 때만)
  const range = max - min;
  if (range < 180 && range > 10) {
    const scale = 255 / range;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, Math.max(0, (d[i] - min) * scale));
      d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - min) * scale));
      d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - min) * scale));
    }
    ctx.putImageData(imageData, 0, 0);
  }
}

// ============================================================
// BarcodeScanner 컴포넌트
// ============================================================

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onClose, onScan, isMultiScanMode = false, scanCount = 0 }) => {
  // 공통 상태
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 });
  const [cameraRes, setCameraRes] = useState('');
  const [scanMode, setScanMode] = useState<'native' | 'fallback' | ''>('');

  // Native mode refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const lastScanTimeRef = useRef(0);
  const isScanningRef = useRef(false);
  const refocusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fallback mode refs
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // 화면 회전 잠금
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

  // 메인 초기화
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsScanning(false);
    setIsLoading(true);
    setTorchOn(false);
    setTorchSupported(false);
    setZoomSupported(false);
    setCameraRes('');
    setScanMode('');

    const timeout = setTimeout(() => {
      if (!isScanningRef.current) {
        setIsLoading(false);
        setError('CAMERA_FAILED');
      }
    }, 12000);

    if (hasNativeBarcodeDetector) {
      console.log('[BarcodeScanner] Native BarcodeDetector available');
      initNativeScanner();
    } else {
      console.log('[BarcodeScanner] Fallback to html5-qrcode');
      initFallbackScanner();
    }

    return () => { clearTimeout(timeout); stopAll(); };
  }, [isOpen]);

  // ============================================================
  // Native BarcodeDetector 모드
  // ============================================================

  const initNativeScanner = async () => {
    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      // 지원 포맷 확인
      let formats: string[] = [];
      try {
        const supported = await BarcodeDetectorClass.getSupportedFormats();
        const wanted = ['code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e'];
        formats = wanted.filter((f: string) => supported.includes(f));
        console.log('[BarcodeScanner] Native formats:', formats);
      } catch (e) {
        formats = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'];
      }

      if (formats.length === 0) {
        console.log('[BarcodeScanner] No native formats, falling back');
        initFallbackScanner();
        return;
      }

      detectorRef.current = new BarcodeDetectorClass({ formats });

      // 카메라 열기
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { exact: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        // exact 실패 → 느슨한 제약
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        } catch (e2) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      // 비디오 엘리먼트 연결
      const video = videoRef.current;
      if (!video) { setError('Video element not found'); setIsLoading(false); return; }
      video.srcObject = stream;
      await video.play();

      const settings = track.getSettings() as any;
      const actualW = settings.width || video.videoWidth;
      const actualH = settings.height || video.videoHeight;
      console.log('[BarcodeScanner] Native camera:', actualW + 'x' + actualH);
      setCameraRes(actualW + 'x' + actualH);

      // 카메라 고급 설정
      await applyCameraEnhancements(track);

      // 스캔 루프 시작
      setScanMode('native');
      isScanningRef.current = true;
      setIsScanning(true);
      setIsLoading(false);
      startNativeScanLoop();

    } catch (err: any) {
      console.error('[BarcodeScanner] Native init failed:', err);
      // fallback
      initFallbackScanner();
    }
  };

  const startNativeScanLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = detectorRef.current;
    if (!video || !canvas || !detector) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const scanFrame = async () => {
      if (!isScanningRef.current) return;

      const now = performance.now();
      // 66ms 간격 = ~15fps 디코딩 (카메라는 풀 FPS 유지)
      if (now - lastScanTimeRef.current < 66) {
        rafRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      lastScanTimeRef.current = now;

      try {
        if (video.readyState >= 2) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          // 스캔 영역만 크롭 (중앙 70% 너비, 30% 높이) → 처리량 감소 + 정확도 증가
          const cropW = Math.floor(vw * 0.7);
          const cropH = Math.floor(vh * 0.3);
          const cropX = Math.floor((vw - cropW) / 2);
          const cropY = Math.floor((vh - cropH) / 2);

          canvas.width = cropW;
          canvas.height = cropH;

          // 크롭 영역 그리기
          ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

          // 이미지 전처리 파이프라인
          enhanceContrast(ctx, cropW, cropH);
          applySharpen(ctx, cropW, cropH);

          // Native BarcodeDetector로 디코딩
          const barcodes = await detector.detect(canvas);
          if (barcodes && barcodes.length > 0) {
            const text = barcodes[0].rawValue;
            if (text) {
              console.log('[BarcodeScanner] Native decoded:', text, 'format:', barcodes[0].format);
              if (navigator.vibrate) { navigator.vibrate([50, 30, 50]); }
              onScan(text);
              if (!isMultiScanMode) { handleClose(); return; }
            }
          }
        }
      } catch (e) {
        // 디코딩 에러 무시 (다음 프레임에서 재시도)
      }

      rafRef.current = requestAnimationFrame(scanFrame);
    };

    rafRef.current = requestAnimationFrame(scanFrame);
  };

  // ============================================================
  // 카메라 고급 설정 (공통)
  // ============================================================

  const applyCameraEnhancements = async (track: MediaStreamTrack) => {
    const caps = track.getCapabilities() as any;
    let hasContinuousAF = false;

    // 포커스 3단계 fallback
    if (caps.focusMode) {
      if (caps.focusMode.includes('continuous')) {
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }); } catch (e) {}
        hasContinuousAF = true;
        console.log('[BarcodeScanner] Focus: continuous AF');
      } else if (caps.focusMode.includes('single-shot')) {
        try { await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' } as any] }); } catch (e) {}
        console.log('[BarcodeScanner] Focus: single-shot');
      } else if (caps.focusMode.includes('manual') && caps.focusDistance) {
        const dist = Math.min(Math.max(0.2, caps.focusDistance.min), caps.focusDistance.max);
        try { await track.applyConstraints({ advanced: [{ focusMode: 'manual', focusDistance: dist } as any] }); } catch (e) {}
        console.log('[BarcodeScanner] Focus: manual @', dist);
      }
    }

    // 줌 1.5x
    if (caps.zoom) {
      setZoomSupported(true);
      setZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
      const z = Math.min(1.5, caps.zoom.max);
      try { await track.applyConstraints({ advanced: [{ zoom: z } as any] }); } catch (e) {}
      setZoomLevel(z);
    }

    // 플래시
    if (caps.torch) setTorchSupported(true);

    // 노출/화이트밸런스
    const extras: any[] = [];
    if (caps.exposureMode && caps.exposureMode.includes('continuous')) extras.push({ exposureMode: 'continuous' });
    if (caps.exposureCompensation) {
      const ec = Math.min(0.5, caps.exposureCompensation.max);
      if (ec > 0) extras.push({ exposureCompensation: ec });
    }
    if (caps.whiteBalanceMode && caps.whiteBalanceMode.includes('continuous')) extras.push({ whiteBalanceMode: 'continuous' });

    for (const c of extras) {
      try { await track.applyConstraints({ advanced: [c] }); } catch (e) {}
    }

    // continuous AF 미지원 시 주기적 재포커스
    if (!hasContinuousAF && caps.focusMode) {
      startPeriodicRefocus(track);
    }
  };

  const startPeriodicRefocus = (track: MediaStreamTrack) => {
    if (refocusIntervalRef.current) clearInterval(refocusIntervalRef.current);
    refocusIntervalRef.current = setInterval(async () => {
      try {
        const caps = track.getCapabilities() as any;
        if (caps.focusMode && caps.focusMode.includes('single-shot')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' } as any] });
        }
      } catch (e) {}
    }, 1500);
  };

  // ============================================================
  // Fallback: html5-qrcode
  // ============================================================

  const initFallbackScanner = async () => {
    const loadLib = async (): Promise<void> => {
      if ((window as any).Html5Qrcode) return;
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Script load failed'));
        document.body.appendChild(script);
      });
    };

    try {
      await loadLib();
      await startFallbackScanner();
    } catch (err: any) {
      setIsLoading(false);
      setError('스캐너 라이브러리를 로드할 수 없습니다');
    }
  };

  const startFallbackScanner = async () => {
    const Html5QrcodeClass = (window as any).Html5Qrcode;
    if (!Html5QrcodeClass) return;

    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch (e) {}
      scannerRef.current = null;
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const scannerConfig = {
      formatsToSupport: [
        QR_FORMATS.CODE_128, QR_FORMATS.CODE_39, QR_FORMATS.CODE_93, QR_FORMATS.CODABAR,
        QR_FORMATS.EAN_13, QR_FORMATS.EAN_8, QR_FORMATS.ITF, QR_FORMATS.UPC_A, QR_FORMATS.UPC_E,
      ],
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    };

    const qrConfig = { fps: 15, qrbox: { width: 280, height: 100 }, disableFlip: true, aspectRatio: 16 / 9 };

    const onSuccess = (decodedText: string) => {
      console.log('[BarcodeScanner] Fallback scanned:', decodedText);
      if (navigator.vibrate) { navigator.vibrate([50, 30, 50]); }
      onScan(decodedText);
      if (!isMultiScanMode) { handleClose(); }
    };

    const attempts = [
      { facingMode: { exact: 'environment' }, width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 } },
      { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      { facingMode: 'environment' },
      true,
    ];

    for (let i = 0; i < attempts.length; i++) {
      try {
        scannerRef.current = new Html5QrcodeClass('barcode-reader', scannerConfig);
        await scannerRef.current.start(attempts[i], qrConfig, onSuccess, () => {});

        // 카메라 설정
        try {
          const videoEl = document.querySelector('#barcode-reader video') as HTMLVideoElement;
          if (videoEl && videoEl.srcObject) {
            const track = (videoEl.srcObject as MediaStream).getVideoTracks()[0];
            if (track) {
              trackRef.current = track;
              const s = track.getSettings() as any;
              setCameraRes((s.width || 0) + 'x' + (s.height || 0));
              await applyCameraEnhancements(track);
            }
          }
        } catch (e) {}

        setScanMode('fallback');
        isScanningRef.current = true;
        setIsScanning(true);
        setIsLoading(false);
        setError(null);
        console.log('[BarcodeScanner] Fallback started on attempt', i + 1);
        return;
      } catch (err: any) {
        if (scannerRef.current) {
          try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch (e) {}
          scannerRef.current = null;
        }
      }
    }

    setIsLoading(false);
    setError('CAMERA_FAILED');
  };

  // ============================================================
  // 정리 및 컨트롤
  // ============================================================

  const stopAll = async () => {
    isScanningRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    if (refocusIntervalRef.current) { clearInterval(refocusIntervalRef.current); refocusIntervalRef.current = null; }
    // Native stream 정리
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    // Fallback scanner 정리
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch (e) {}
      scannerRef.current = null;
    }
    trackRef.current = null;
    detectorRef.current = null;
    setIsScanning(false);
    setTorchOn(false);
  };

  const handleClose = async () => {
    await stopAll();
    onClose();
  };

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch (e) {}
  }, [torchOn]);

  const handleZoom = useCallback(async (newZoom: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(zoomRange.min, Math.min(zoomRange.max, newZoom));
    try {
      await track.applyConstraints({ advanced: [{ zoom: clamped } as any] });
      setZoomLevel(clamped);
    } catch (e) {}
  }, [zoomRange]);

  const handleTapFocus = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      const caps = track.getCapabilities() as any;
      if (caps.focusMode && caps.focusMode.includes('single-shot')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' } as any] });
      }
    } catch (e) {}
  }, []);

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

          {isScanning && (
            <button
              onClick={handleTapFocus}
              className="p-2.5 rounded-full bg-white/20 active:bg-white/40 transition-all"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" strokeWidth={2} />
                <path strokeLinecap="round" strokeWidth={2} d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" />
              </svg>
            </button>
          )}

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

      {/* Native mode: video + hidden canvas */}
      {scanMode === 'native' && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ top: '60px', bottom: '180px' }}
          onClick={handleTapFocus}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
            style={{ filter: 'contrast(1.1) brightness(1.05)' }}
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Native mode: 초기화 전 video (숨김 → play 후 위에서 표시) */}
      {scanMode === '' && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ top: '60px', bottom: '180px' }}>
          <video ref={videoRef} className="w-full h-full object-cover opacity-0" autoPlay playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Fallback mode: html5-qrcode container */}
      {scanMode === 'fallback' && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ top: '60px', bottom: '180px' }}
          onClick={handleTapFocus}
        >
          <div id="barcode-reader" className="w-full max-w-md mx-4"></div>
        </div>
      )}

      {/* Fallback: html5-qrcode 필요 (초기화 전) */}
      {scanMode === '' && <div id="barcode-reader" className="hidden"></div>}

      {/* Loading */}
      {isLoading && !isScanning && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-white text-sm font-medium">카메라 준비 중...</p>
          </div>
        </div>
      )}

      {/* Scan overlay */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-[280px] h-[100px] relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
            <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scan"></div>
          </div>
        </div>
      )}

      {/* Zoom */}
      {zoomSupported && isScanning && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1">
          <button onClick={() => handleZoom(Math.min(zoomLevel + 0.5, zoomRange.max))}
            className="w-9 h-9 rounded-full bg-white/20 active:bg-white/40 flex items-center justify-center">
            <span className="text-white text-lg font-bold">+</span>
          </button>
          <div className="bg-white/10 rounded-full px-2 py-0.5">
            <span className="text-white text-xs font-medium">{zoomLevel.toFixed(1)}x</span>
          </div>
          <button onClick={() => handleZoom(Math.max(zoomLevel - 0.5, zoomRange.min))}
            className="w-9 h-9 rounded-full bg-white/20 active:bg-white/40 flex items-center justify-center">
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
            <button onClick={() => { window.location.reload(); }}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium">
              새로고침
            </button>
          </div>
        ) : (
          <div className="text-center mb-3">
            <p className="text-white/80 text-sm mb-1">
              바코드를 프레임 안에 맞추고 화면을 탭하세요
            </p>
            <p className="text-white/50 text-xs">
              {isMultiScanMode ? '연속 스캔 모드 - 여러 장비를 계속 스캔하세요' : '초점이 안 맞으면 화면을 탭하세요'}
            </p>
            {cameraRes && (
              <p className="text-white/30 text-xs mt-1">
                {cameraRes} {scanMode === 'native' ? '(HW)' : '(SW)'}
              </p>
            )}
          </div>
        )}

        <button onClick={handleClose}
          className="w-full py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-semibold transition-colors active:scale-[0.98] border border-gray-500">
          수동 입력
        </button>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 10%; }
          50% { top: 85%; }
          100% { top: 10%; }
        }
        .animate-scan { animation: scan 2s ease-in-out infinite; }
        #barcode-reader { border: none !important; background: transparent !important; width: 100% !important; }
        #barcode-reader video { width: 100% !important; height: auto !important; object-fit: cover !important; filter: contrast(1.15) brightness(1.05); }
        #barcode-reader__scan_region { background: transparent !important; min-height: 300px !important; }
        #barcode-reader__scan_region img { display: none !important; }
        #barcode-reader__scan_region br { display: none !important; }
        #barcode-reader__scan_region > div { border: none !important; box-shadow: none !important; }
        #qr-shaded-region { border: none !important; }
        #barcode-reader__dashboard, #barcode-reader__dashboard_section, #barcode-reader__dashboard_section_swaplink,
        #barcode-reader__dashboard_section_csr, #barcode-reader__status_span, #barcode-reader__header_message,
        #barcode-reader img[alt="Info icon"], #barcode-reader a { display: none !important; }
        #barcode-reader > div:last-child { display: none !important; }
        @media screen and (orientation: landscape) {
          .barcode-scanner-container {
            transform: rotate(-90deg); transform-origin: left top;
            width: 100vh !important; height: 100vw !important;
            position: fixed !important; top: 100% !important; left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BarcodeScanner;
