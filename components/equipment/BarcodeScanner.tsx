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
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onClose, onScan }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');

  // Load html5-qrcode dynamically
  useEffect(() => {
    if (!isOpen) return;

    const loadScript = async () => {
      // Check if already loaded
      if ((window as any).Html5Qrcode) {
        initScanner();
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
      const Html5QrcodeClass = (window as any).Html5Qrcode;
      if (!Html5QrcodeClass) {
        setError('Html5Qrcode not loaded');
        return;
      }

      // Get available cameras
      const devices = await Html5QrcodeClass.getCameras();
      setCameras(devices);

      if (devices.length === 0) {
        setError('카메라를 찾을 수 없습니다.');
        return;
      }

      // Prefer back camera for mobile
      const backCamera = devices.find((d: any) =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      );
      const cameraId = backCamera?.id || devices[0].id;
      setSelectedCamera(cameraId);

      // Start scanning
      startScanner(cameraId);
    } catch (err: any) {
      console.error('Camera init error:', err);
      setError('카메라 접근 권한이 필요합니다.');
    }
  };

  const startScanner = async (cameraId?: string) => {
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
      }

      // Create new scanner
      scannerRef.current = new Html5QrcodeClass('barcode-reader');

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.777778, // 16:9
      };

      const cameraConfig = cameraId
        ? cameraId
        : { facingMode: 'environment' }; // Back camera

      await scannerRef.current.start(
        cameraConfig,
        config,
        (decodedText: string) => {
          console.log('Barcode scanned:', decodedText);
          // Vibrate on success (mobile)
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          onScan(decodedText);
          handleClose();
        },
        (errorMessage: string) => {
          // Ignore scan errors (continuous scanning)
        }
      );

      setIsScanning(true);
      setError(null);
    } catch (err: any) {
      console.error('Scanner start error:', err);
      setError('카메라를 시작할 수 없습니다. 권한을 확인해주세요.');
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

  const handleCameraChange = (cameraId: string) => {
    setSelectedCamera(cameraId);
    startScanner(cameraId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">바코드 스캔</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Camera selector */}
        {cameras.length > 1 && (
          <div className="mt-3">
            <select
              value={selectedCamera}
              onChange={(e) => handleCameraChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/10 text-white border border-white/20 rounded-lg"
            >
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id} className="text-black">
                  {camera.label || `Camera ${camera.id}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Scanner area */}
      <div className="h-full flex items-center justify-center">
        <div id="barcode-reader" className="w-full max-w-lg"></div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-6">
        {error ? (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
            <p className="text-red-200 text-sm text-center">{error}</p>
            <button
              onClick={() => initScanner()}
              className="w-full mt-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-white/80 text-sm mb-2">
              장비 바코드를 화면 중앙에 맞춰주세요
            </p>
            <p className="text-white/50 text-xs">
              S/N 바코드가 자동으로 인식됩니다
            </p>
          </div>
        )}

        {/* Manual input button */}
        <button
          onClick={handleClose}
          className="w-full mt-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
        >
          수동 입력으로 돌아가기
        </button>
      </div>

      {/* Scan overlay */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-40 relative">
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>

            {/* Scan line animation */}
            <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan"></div>
          </div>
        </div>
      )}

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
        }
        #barcode-reader video {
          border-radius: 12px !important;
        }
        #barcode-reader__scan_region {
          background: transparent !important;
        }
        #barcode-reader__dashboard_section {
          display: none !important;
        }
        #barcode-reader__status_span {
          display: none !important;
        }
      `}</style>
    </div>
  );
};

export default BarcodeScanner;
