import React, { useState } from 'react';
import { checkSignal, SignalCheckResult as APISignalCheckResult } from '../../services/apiService';
import './SignalCheck.css';

interface SignalCheckProps {
  equipmentType: 'A' | 'B'; // A: 인터넷, B: TV/복합
  custId?: string;          // 계약 ID
  workId?: string;          // 작업 ID
  onComplete?: (result: SignalCheckResult) => void;
}

interface SignalCheckResult {
  checkType: 'A' | 'B';
  checkTime: string;
  status: 'success' | 'warning' | 'error';
  signalStrength?: number; // 0-100
  speedTest?: {
    download: number; // Mbps
    upload: number; // Mbps
    ping: number; // ms
  };
  deviceStatus?: {
    macAddress: string;
    connection: 'connected' | 'disconnected';
    ipAddress?: string;
  };
  tvSignal?: {
    channels: number;
    quality: number; // 0-100
    errors: number;
  };
  issues?: string[];
  notes?: string;
}

const SignalCheck: React.FC<SignalCheckProps> = ({ equipmentType, custId, workId, onComplete }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<SignalCheckResult | null>(null);
  const [manualNotes, setManualNotes] = useState('');

  // 신호 점검 시작
  const handleStartCheck = async () => {
    setIsChecking(true);
    setResult(null);

    try {
      // 실제 API 호출 - 집선 조회 (신호 점검)
      if (!custId) {
        throw new Error('계약 ID가 없습니다.');
      }

      console.log('📡 신호 점검 시작:', {
        equipmentType,
        custId,
        workId
      });

      const apiResult = await checkSignal({
        CUST_ID: custId,
        WRK_ID: workId,
        CHECK_TYPE: equipmentType,
      });

      // API 결과를 컴포넌트 형식으로 변환
      const result: SignalCheckResult = {
        checkType: apiResult.checkType,
        checkTime: apiResult.checkTime,
        status: apiResult.status,
        signalStrength: apiResult.signalStrength,
        speedTest: apiResult.speedTest,
        deviceStatus: apiResult.deviceStatus,
        tvSignal: apiResult.tvSignal,
        issues: apiResult.issues,
      };

      console.log('✅ 신호 점검 성공:', result);
      setResult(result);

      if (onComplete) {
        onComplete(result);
      }
    } catch (error: any) {
      console.error('❌ 신호 점검 오류:', error);
      const errorResult: SignalCheckResult = {
        checkType: equipmentType,
        checkTime: new Date().toLocaleString('ko-KR'),
        status: 'error',
        issues: [error.message || '신호 점검 중 오류가 발생했습니다.'],
      };
      setResult(errorResult);
    } finally {
      setIsChecking(false);
    }
  };

  // 상태에 따른 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  };

  // 상태 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return '정상';
      case 'warning':
        return '주의';
      case 'error':
        return '오류';
      default:
        return '알 수 없음';
    }
  };

  return (
    <div className="signal-check">
      <div className="check-header">
        <h4 className="check-title">
          {equipmentType === 'A' ? '인터넷 신호' : 'TV 신호'}
        </h4>
      </div>

      {!result && !isChecking && (
        <button
          className="btn-check-start"
          onClick={handleStartCheck}
        >
          점검 시작
        </button>
      )}

      {isChecking && (
        <div className="checking-state">
          <div className="spinner"></div>
          <p className="checking-text">점검 중...</p>
        </div>
      )}

      {result && !isChecking && (
        <div className="check-result">
          <div className={`result-header ${getStatusColor(result.status)}`}>
            <span className="status-badge">{getStatusText(result.status)}</span>
            <span className="result-time">{result.checkTime}</span>
          </div>

          <div className="result-content">
            {/* 신호 강도 */}
            {result.signalStrength !== undefined && (
              <div className="data-row">
                <span className="data-label">신호 강도</span>
                <div className="signal-bar">
                  <div className={`signal-fill ${result.signalStrength > 80 ? 'good' : result.signalStrength > 60 ? 'fair' : 'poor'}`}
                    style={{ width: `${result.signalStrength}%` }}>
                    <span className="signal-value">{result.signalStrength}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* 인터넷 속도 테스트 */}
            {result.speedTest && (
              <>
                <div className="data-row">
                  <span className="data-label">다운로드</span>
                  <span className="data-value">{result.speedTest.download} Mbps</span>
                </div>
                <div className="data-row">
                  <span className="data-label">업로드</span>
                  <span className="data-value">{result.speedTest.upload} Mbps</span>
                </div>
                <div className="data-row">
                  <span className="data-label">응답시간</span>
                  <span className="data-value">{result.speedTest.ping} ms</span>
                </div>
              </>
            )}

            {/* 장치 상태 */}
            {result.deviceStatus && (
              <>
                <div className="data-divider">장치 정보</div>
                <div className="data-row">
                  <span className="data-label">MAC 주소</span>
                  <span className="data-value">{result.deviceStatus.macAddress}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">연결 상태</span>
                  <span className={`status-badge-inline ${result.deviceStatus.connection}`}>
                    {result.deviceStatus.connection === 'connected' ? '연결됨' : '연결 안 됨'}
                  </span>
                </div>
                {result.deviceStatus.ipAddress && (
                  <div className="data-row">
                    <span className="data-label">IP 주소</span>
                    <span className="data-value">{result.deviceStatus.ipAddress}</span>
                  </div>
                )}
              </>
            )}

            {/* TV 신호 정보 */}
            {result.tvSignal && (
              <>
                <div className="data-divider">TV 신호</div>
                <div className="data-row">
                  <span className="data-label">수신 채널</span>
                  <span className="data-value">{result.tvSignal.channels}개</span>
                </div>
                <div className="data-row">
                  <span className="data-label">신호 품질</span>
                  <span className="data-value">{result.tvSignal.quality}%</span>
                </div>
                <div className="data-row">
                  <span className="data-label">오류</span>
                  <span className="data-value">{result.tvSignal.errors}개</span>
                </div>
              </>
            )}

            {/* 이슈 */}
            {result.issues && result.issues.length > 0 && (
              <>
                <div className="data-divider warning">문제 발견</div>
                {result.issues.map((issue, index) => (
                  <div key={index} className="issue-row">{issue}</div>
                ))}
              </>
            )}

            {/* 메모 */}
            <div className="data-divider">메모</div>
            <textarea
              className="notes-input"
              placeholder="추가 메모 입력..."
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={2}
            />
          </div>

          <button className="btn-recheck" onClick={handleStartCheck}>
            재점검
          </button>
        </div>
      )}
    </div>
  );
};

export default SignalCheck;
