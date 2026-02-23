import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

interface SettingsProps {
  onBack: () => void;
}

const FONT_SCALE_OPTIONS = [
  { key: 'small' as const, label: '작게', size: '14px', preview: 'text-xs' },
  { key: 'medium' as const, label: '보통', size: '16px', preview: 'text-sm' },
  { key: 'large' as const, label: '크게', size: '18px', preview: 'text-base' },
  { key: 'xlarge' as const, label: '매우 크게', size: '20px', preview: 'text-lg' },
];

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { fontScale, setFontScale } = useUIStore();

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="font-bold text-base">설정</h1>
      </div>

      {/* 설정 내용 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 글자 크기 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-semibold text-sm text-gray-800 mb-3">글자 크기</h2>
          <div className="grid grid-cols-4 gap-2">
            {FONT_SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFontScale(opt.key)}
                className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg border-2 transition-all ${
                  fontScale === opt.key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <span
                  className={`font-bold mb-1 ${
                    fontScale === opt.key ? 'text-blue-600' : 'text-gray-700'
                  }`}
                  style={{ fontSize: opt.size }}
                >
                  가
                </span>
                <span className={`text-xs ${
                  fontScale === opt.key ? 'text-blue-600 font-semibold' : 'text-gray-500'
                }`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            선택 즉시 적용됩니다. 앱 전체 글자 크기가 변경됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
