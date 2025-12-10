import React, { useState } from 'react';
import { WorkOrder, Equipment } from '../../types';
import { Camera, Trash2, X, QrCode, Check, AlertCircle, Wifi, Tv, Settings, Package } from 'lucide-react';
import Select from '../ui/Select';
import '../../styles/buttons.css';

interface EquipmentInstallationProps {
  workOrder: WorkOrder;
  onBack: () => void;
  onSave: (data: EquipmentInstallationData) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface EquipmentInstallationData {
  installations: EquipmentInstallationItem[];
  notes: string;
}

interface EquipmentInstallationItem {
  equipmentType: string;
  itemMidCd: string;
  serialNumber: string;
  modelNumber: string;
  macAddress?: string;
  installLocation: string;
  conditionNotes: string;
  photos: string[];
  testResults: {
    signalStrength?: string;
    connectivity?: string;
    speedTest?: string;
  };
  status: 'assigned' | 'installed' | 'returned';
  customerConfirmed: boolean;
}

const EquipmentInstallation: React.FC<EquipmentInstallationProps> = ({
  workOrder,
  onBack,
  onSave,
  showToast,
}) => {
  const [installations, setInstallations] = useState<EquipmentInstallationItem[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [currentForm, setCurrentForm] = useState<EquipmentInstallationItem>({
    equipmentType: '',
    itemMidCd: '',
    serialNumber: '',
    modelNumber: '',
    macAddress: '',
    installLocation: '',
    conditionNotes: '',
    photos: [],
    testResults: {},
    status: 'assigned',
    customerConfirmed: false,
  });
  const [globalNotes, setGlobalNotes] = useState('');

  // Equipment type configuration
  const equipmentTypes = [
    { code: '04', name: '모뎀', color: 'bg-blue-100 text-blue-800', icon: Wifi },
    { code: '05', name: '셋톱박스', color: 'bg-purple-100 text-purple-800', icon: Tv },
    { code: '07', name: '특수장비', color: 'bg-orange-100 text-orange-800', icon: Settings },
    { code: '03', name: '추가장비', color: 'bg-green-100 text-green-800', icon: Package },
  ];

  const getEquipmentTypeInfo = (code: string) => {
    return equipmentTypes.find(et => et.code === code) || { code, name: '기타', color: 'bg-gray-100 text-gray-800', icon: Package };
  };

  const handleStartInstallation = (typeCode: string) => {
    const typeInfo = getEquipmentTypeInfo(typeCode);
    setCurrentForm({
      equipmentType: typeInfo.name,
      itemMidCd: typeCode,
      serialNumber: '',
      modelNumber: '',
      macAddress: typeCode === '04' ? '' : undefined, // MAC address only for modems
      installLocation: '',
      conditionNotes: '',
      photos: [],
      testResults: {},
      status: 'assigned',
      customerConfirmed: false,
    });
    setSelectedEquipment(typeCode);
    setShowForm(true);
  };

  const handleBarcodeScanner = () => {
    // Placeholder for barcode scanner integration
    showToast?.('바코드 스캐너 기능은 준비 중입니다. 수동으로 입력해주세요.', 'info');
    // TODO: Integrate actual barcode scanner
  };

  const handlePhotoCapture = () => {
    // Placeholder for camera integration
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const photoUrl = reader.result as string;
          setCurrentForm(prev => ({
            ...prev,
            photos: [...prev.photos, photoUrl],
          }));
          showToast?.('사진이 추가되었습니다.', 'success');
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleDeletePhoto = (index: number) => {
    setCurrentForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
    showToast?.('사진이 삭제되었습니다.', 'success');
  };

  const validateForm = (): boolean => {
    if (!currentForm.serialNumber.trim()) {
      showToast?.('시리얼 번호를 입력해주세요.', 'error');
      return false;
    }
    if (!currentForm.modelNumber.trim()) {
      showToast?.('모델명을 입력해주세요.', 'error');
      return false;
    }
    if (currentForm.itemMidCd === '04' && !currentForm.macAddress?.trim()) {
      showToast?.('모뎀은 MAC 주소를 입력해야 합니다.', 'error');
      return false;
    }
    if (!currentForm.installLocation.trim()) {
      showToast?.('설치 위치를 입력해주세요.', 'error');
      return false;
    }
    return true;
  };

  const handleSaveInstallation = () => {
    if (!validateForm()) return;

    const newInstallation = {
      ...currentForm,
      status: 'installed' as const,
    };

    setInstallations(prev => [...prev, newInstallation]);
    showToast?.(`${currentForm.equipmentType} 설치가 저장되었습니다.`, 'success');
    setShowForm(false);
    setSelectedEquipment('');
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setSelectedEquipment('');
  };

  const handleFinalSave = () => {
    if (installations.length === 0) {
      showToast?.('최소 1개 이상의 장비를 설치해주세요.', 'error');
      return;
    }

    const allConfirmed = installations.every(inst => inst.customerConfirmed);
    if (!allConfirmed) {
      showToast?.('모든 장비의 고객 확인을 완료해주세요.', 'warning');
      return;
    }

    onSave({
      installations,
      notes: globalNotes,
    });
    showToast?.('장비 설치 정보가 저장되었습니다.', 'success');
  };

  const toggleCustomerConfirmation = (index: number) => {
    setInstallations(prev =>
      prev.map((inst, i) =>
        i === index ? { ...inst, customerConfirmed: !inst.customerConfirmed } : inst
      )
    );
  };

  const getInstalledCount = (typeCode: string) => {
    return installations.filter(inst => inst.itemMidCd === typeCode).length;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={onBack} className="mr-3 hover:bg-blue-700 p-2 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-lg font-bold">장비 설치</h1>
              <p className="text-sm text-blue-100">{workOrder.customer.name} - {workOrder.customer.address}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Equipment Type Selection */}
        {!showForm && (
          <>
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="inline-block w-1 h-6 bg-blue-600 mr-3 rounded"></span>
                장비 선택
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {equipmentTypes.map((type) => {
                  const installedCount = getInstalledCount(type.code);
                  return (
                    <button
                      key={type.code}
                      onClick={() => handleStartInstallation(type.code)}
                      className="relative bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-lg transition-all"
                    >
                      <div className="text-center">
                        <div className="text-3xl mb-2 flex justify-center"><type.icon size={32} className="text-gray-600" /></div>
                        <div className="font-semibold text-gray-800">{type.name}</div>
                        <div className="text-xs text-gray-500 mt-1">코드: {type.code}</div>
                        {installedCount > 0 && (
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                            {installedCount}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Installed Equipment List */}
            {installations.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Check className="w-5 h-5 text-green-600 mr-2" />
                  설치 완료 장비 ({installations.length})
                </h2>
                <div className="space-y-3">
                  {installations.map((inst, index) => {
                    const typeInfo = getEquipmentTypeInfo(inst.itemMidCd);
                    return (
                      <div key={index} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            <span className="mr-2"><typeInfo.icon size={24} className="text-gray-600" /></span>
                            <div>
                              <div className="font-semibold text-gray-800">{inst.equipmentType}</div>
                              <div className="text-xs text-gray-500">S/N: {inst.serialNumber}</div>
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${typeInfo.color}`}>
                            설치완료
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1 mt-2">
                          <div>모델: {inst.modelNumber}</div>
                          {inst.macAddress && <div>MAC: {inst.macAddress}</div>}
                          <div>위치: {inst.installLocation}</div>
                          {inst.photos.length > 0 && (
                            <div className="flex items-center text-blue-600">
                              <Camera className="w-4 h-4 mr-1" />
                              사진 {inst.photos.length}장
                            </div>
                          )}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={inst.customerConfirmed}
                              onChange={() => toggleCustomerConfirmation(index)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">고객 확인 완료</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Global Notes */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="inline-block w-1 h-6 bg-blue-600 mr-3 rounded"></span>
                설치 종합 메모
              </h2>
              <textarea
                value={globalNotes}
                onChange={(e) => setGlobalNotes(e.target.value)}
                placeholder="전체 설치 작업에 대한 특이사항, 고객 요청사항 등을 기록하세요..."
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
              />
            </div>

            {/* Final Save Button */}
            {installations.length > 0 && (
              <button
                onClick={handleFinalSave}
                className="btn btn-lg btn-primary w-full flex items-center justify-center shadow-lg"
              >
                <Check className="w-5 h-5 mr-2" />
                설치 완료 ({installations.length}개 장비)
              </button>
            )}
          </>
        )}

        {/* Installation Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                {(() => { const TypeIcon = getEquipmentTypeInfo(selectedEquipment).icon; return <span className="mr-2"><TypeIcon size={24} className="text-gray-600" /></span>; })()}
                {currentForm.equipmentType} 설치
              </h2>
              <button
                onClick={handleCancelForm}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Serial Number Input with Barcode Scanner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시리얼 번호 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentForm.serialNumber}
                  onChange={(e) => setCurrentForm(prev => ({ ...prev, serialNumber: e.target.value }))}
                  placeholder="시리얼 번호 입력"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleBarcodeScanner}
                  className="btn btn-primary flex items-center"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Model Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                모델명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={currentForm.modelNumber}
                onChange={(e) => setCurrentForm(prev => ({ ...prev, modelNumber: e.target.value }))}
                placeholder="모델명 입력"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* MAC Address (for modems only) */}
            {currentForm.itemMidCd === '04' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MAC 주소 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentForm.macAddress || ''}
                  onChange={(e) => setCurrentForm(prev => ({ ...prev, macAddress: e.target.value }))}
                  placeholder="00:00:00:00:00:00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Installation Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설치 위치 <span className="text-red-500">*</span>
              </label>
              <Select
                value={currentForm.installLocation}
                onValueChange={(val) => setCurrentForm(prev => ({ ...prev, installLocation: val }))}
                options={[
                  { value: '', label: '선택하세요' },
                  { value: '거실', label: '거실' },
                  { value: '안방', label: '안방' },
                  { value: '작은방', label: '작은방' },
                  { value: '서재', label: '서재' },
                  { value: '주방', label: '주방' },
                  { value: '현관', label: '현관' },
                  { value: '기타', label: '기타' },
                ]}
                placeholder="설치 위치 선택"
              />
            </div>

            {/* Test Results */}
            <div className="border border-gray-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">테스트 결과</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">신호 강도</label>
                  <input
                    type="text"
                    value={currentForm.testResults.signalStrength || ''}
                    onChange={(e) => setCurrentForm(prev => ({
                      ...prev,
                      testResults: { ...prev.testResults, signalStrength: e.target.value }
                    }))}
                    placeholder="예: 우수, 양호, 보통"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">연결성</label>
                  <input
                    type="text"
                    value={currentForm.testResults.connectivity || ''}
                    onChange={(e) => setCurrentForm(prev => ({
                      ...prev,
                      testResults: { ...prev.testResults, connectivity: e.target.value }
                    }))}
                    placeholder="예: 정상"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">속도 테스트</label>
                  <input
                    type="text"
                    value={currentForm.testResults.speedTest || ''}
                    onChange={(e) => setCurrentForm(prev => ({
                      ...prev,
                      testResults: { ...prev.testResults, speedTest: e.target.value }
                    }))}
                    placeholder="예: 100Mbps"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Equipment Condition Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                장비 상태 및 특이사항
              </label>
              <textarea
                value={currentForm.conditionNotes}
                onChange={(e) => setCurrentForm(prev => ({ ...prev, conditionNotes: e.target.value }))}
                placeholder="장비 상태, 케이블 배선 경로, 특이사항 등을 기록하세요..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설치 사진 (선택사항)
              </label>
              <button
                onClick={handlePhotoCapture}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center"
              >
                <Camera className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">사진 촬영하기</span>
              </button>

              {/* Photo Preview */}
              {currentForm.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {currentForm.photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={photo}
                        alt={`설치 사진 ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => handleDeletePhoto(index)}
                        className="btn-danger absolute top-1 right-1 p-1 rounded-full"
                        style={{ minHeight: 'auto' }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-semibold mb-1">설치 시 확인사항</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>장비 시리얼 번호 정확히 입력</li>
                  <li>신호 강도 및 연결 상태 테스트</li>
                  <li>고객에게 사용법 안내</li>
                  <li>케이블 정리 및 안전 확인</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <button
                onClick={handleCancelForm}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveInstallation}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center"
              >
                <Check className="w-5 h-5 mr-2" />
                저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentInstallation;
