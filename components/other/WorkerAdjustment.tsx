import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Calendar, Clock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { WorkOrder, WorkOrderType } from '../../types';
import Select from '../ui/Select';
import LoadingSpinner from '../common/LoadingSpinner';

interface WorkerAdjustmentProps {
  workDirection: WorkOrder;
  onBack: () => void;
  onSave: (data: AdjustmentData) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface AdjustmentData {
  WRK_DRCTN_ID: string;
  NEW_SCHEDULED_DATE: string;
  NEW_SCHEDULED_TIME: string;
  NEW_WORKER_ID: string;
  NEW_WORKER_NAME: string;
  ADJUSTMENT_REASON: string;
  CHG_UID: string;
}

interface Worker {
  id: string;
  name: string;
  team?: string;
  area?: string;
  phone?: string;
}

// Mock worker data - Replace with actual API call
const mockWorkers: Worker[] = [
  { id: 'W001', name: '김철수', team: '1팀', area: '강남구', phone: '010-1234-5678' },
  { id: 'W002', name: '이영희', team: '1팀', area: '서초구', phone: '010-2345-6789' },
  { id: 'W003', name: '박민수', team: '2팀', area: '강남구', phone: '010-3456-7890' },
  { id: 'W004', name: '최지은', team: '2팀', area: '송파구', phone: '010-4567-8901' },
  { id: 'W005', name: '정대호', team: '3팀', area: '강동구', phone: '010-5678-9012' },
  { id: 'W006', name: '강미영', team: '3팀', area: '서초구', phone: '010-6789-0123' },
  { id: 'W007', name: '윤성호', team: '1팀', area: '강남구', phone: '010-7890-1234' },
  { id: 'W008', name: '조현아', team: '2팀', area: '송파구', phone: '010-8901-2345' },
];

const WorkerAdjustment: React.FC<WorkerAdjustmentProps> = ({
  workDirection,
  onBack,
  onSave,
  showToast
}) => {
  // Form state
  const [newDate, setNewDate] = useState('');
  const [newHour, setNewHour] = useState('09');
  const [newMinute, setNewMinute] = useState('00');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWorkerSearch, setShowWorkerSearch] = useState(false);
  const [filteredWorkers, setFilteredWorkers] = useState<Worker[]>(mockWorkers);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const searchRef = useRef<HTMLDivElement>(null);

  // Initialize date and time from current schedule
  useEffect(() => {
    const scheduleDate = new Date(workDirection.scheduledAt);
    setNewDate(scheduleDate.toISOString().split('T')[0]);
    setNewHour(String(scheduleDate.getHours()).padStart(2, '0'));
    setNewMinute(String(scheduleDate.getMinutes()).padStart(2, '0'));
  }, [workDirection.scheduledAt]);

  // Filter workers based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredWorkers(mockWorkers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = mockWorkers.filter(
        (worker) =>
          worker.name.toLowerCase().includes(query) ||
          worker.id.toLowerCase().includes(query) ||
          worker.team?.toLowerCase().includes(query) ||
          worker.area?.toLowerCase().includes(query)
      );
      setFilteredWorkers(filtered);
    }
  }, [searchQuery]);

  // Close worker search on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowWorkerSearch(false);
      }
    };

    if (showWorkerSearch) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showWorkerSearch]);

  // Real-time validation
  useEffect(() => {
    const newErrors: { [key: string]: string } = {};

    // Date validation
    if (newDate) {
      const selectedDate = new Date(newDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        newErrors.date = '과거 날짜는 선택할 수 없습니다.';
      }
    }

    // Reason validation
    if (adjustmentReason.trim().length > 0 && adjustmentReason.trim().length < 10) {
      newErrors.reason = '변경 사유는 최소 10자 이상 입력해주세요.';
    }

    setErrors(newErrors);
  }, [newDate, adjustmentReason]);

  // Generate hour options
  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: String(i).padStart(2, '0'),
    label: `${String(i).padStart(2, '0')}시`
  }));

  // Generate minute options (in 10-minute intervals)
  const minuteOptions = Array.from({ length: 6 }, (_, i) => ({
    value: String(i * 10).padStart(2, '0'),
    label: `${String(i * 10).padStart(2, '0')}분`
  }));

  const handleWorkerSelect = (worker: Worker) => {
    setSelectedWorker(worker);
    setShowWorkerSearch(false);
    setSearchQuery('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!newDate) {
      if (showToast) showToast('새로운 날짜를 선택해주세요.', 'error');
      return;
    }

    if (!selectedWorker) {
      if (showToast) showToast('새로운 작업자를 선택해주세요.', 'error');
      return;
    }

    if (adjustmentReason.trim().length < 10) {
      if (showToast) showToast('변경 사유를 10자 이상 입력해주세요.', 'error');
      return;
    }

    if (Object.keys(errors).length > 0) {
      if (showToast) showToast('입력 항목을 확인해주세요.', 'error');
      return;
    }

    // Check if anything actually changed
    const originalDate = new Date(workDirection.scheduledAt);
    const newDateTime = new Date(`${newDate}T${newHour}:${newMinute}`);

    const dateChanged = originalDate.getTime() !== newDateTime.getTime();
    const workerChanged = true; // In real app, compare with current worker ID

    if (!dateChanged && !workerChanged) {
      if (showToast) showToast('변경된 내용이 없습니다.', 'warning');
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = () => {
    setIsSubmitting(true);
    setShowConfirmDialog(false);

    const adjustmentData: AdjustmentData = {
      WRK_DRCTN_ID: workDirection.id,
      NEW_SCHEDULED_DATE: newDate.replace(/-/g, ''),
      NEW_SCHEDULED_TIME: `${newHour}${newMinute}`,
      NEW_WORKER_ID: selectedWorker!.id,
      NEW_WORKER_NAME: selectedWorker!.name,
      ADJUSTMENT_REASON: adjustmentReason.trim(),
      CHG_UID: '' // Should be filled with actual user ID
    };

    console.log('🔍 일정 조정 전송 데이터:', adjustmentData);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      if (showToast) showToast('일정이 성공적으로 조정되었습니다.', 'success');
      onSave(adjustmentData);
      onBack();
    }, 1000);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">작업 일정 조정</h1>
            <p className="text-sm text-blue-100 mt-0.5">일정 변경 및 작업자 재배정</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 pb-24">
        {/* Current Info Card */}
        <div className="bg-white rounded-xl shadow-md p-5 mb-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-800">현재 작업 정보</h2>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">작지서 ID</span>
              <span className="text-sm font-mono font-semibold text-gray-900">
                {workDirection.id}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">고객명</span>
              <span className="text-sm font-semibold text-gray-900">
                {workDirection.customer.name}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">작업 유형</span>
              <span className="text-sm font-semibold text-blue-600">
                {workDirection.typeDisplay}
              </span>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-800">현재 일정</span>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {formatDate(workDirection.scheduledAt)}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {formatTime(workDirection.scheduledAt)}
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-green-600" />
                <span className="text-xs font-semibold text-green-800">현재 작업자</span>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                미지정 (신규 배정 필요)
              </div>
            </div>
          </div>
        </div>

        {/* Adjustment Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date and Time Section */}
          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-800">새로운 일정</h3>
            </div>

            {/* Date Picker */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                날짜 선택 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errors.date && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.date}
                </p>
              )}
            </div>

            {/* Time Picker */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  시간 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={newHour}
                  onValueChange={setNewHour}
                  options={hourOptions}
                  placeholder="시간 선택"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  분 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={newMinute}
                  onValueChange={setNewMinute}
                  options={minuteOptions}
                  placeholder="분 선택"
                  required
                />
              </div>
            </div>

            {/* Preview */}
            {newDate && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-blue-600 font-semibold mb-1">선택된 일정</div>
                <div className="text-sm font-semibold text-gray-900">
                  {formatDate(newDate)} {newHour}:{newMinute}
                </div>
              </div>
            )}
          </div>

          {/* Worker Selection Section */}
          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
              <User className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-800">작업자 배정</h3>
            </div>

            {/* Worker Search */}
            <div className="mb-4 relative" ref={searchRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                작업자 검색 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={selectedWorker ? selectedWorker.name : searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedWorker(null);
                    setShowWorkerSearch(true);
                  }}
                  onFocus={() => setShowWorkerSearch(true)}
                  placeholder="이름, 사번, 팀, 지역으로 검색"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Search Results Dropdown */}
              {showWorkerSearch && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-20">
                  {filteredWorkers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">검색 결과가 없습니다.</p>
                    </div>
                  ) : (
                    filteredWorkers.map((worker) => (
                      <button
                        key={worker.id}
                        type="button"
                        onClick={() => handleWorkerSelect(worker)}
                        className="w-full p-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {worker.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {worker.id} | {worker.team} | {worker.area}
                            </div>
                          </div>
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected Worker Display */}
            {selectedWorker && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {selectedWorker.name}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {selectedWorker.id} | {selectedWorker.team} | {selectedWorker.area}
                      </div>
                      {selectedWorker.phone && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {selectedWorker.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWorker(null);
                      setSearchQuery('');
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reason Section */}
          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-800">변경 사유</h3>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                변경 사유 입력 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="일정 변경 또는 작업자 재배정 사유를 상세히 입력해주세요. (최소 10자)"
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-y transition-colors ${
                  errors.reason ? 'border-red-500' : 'border-gray-300'
                }`}
                maxLength={500}
                required
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">
                  {adjustmentReason.length}/500자
                </p>
                <p className="text-xs text-blue-600">
                  (최소 10자 필수)
                </p>
              </div>
              {errors.reason && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.reason}
                </p>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 px-6 py-4 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors shadow-lg"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !newDate ||
                !selectedWorker ||
                adjustmentReason.trim().length < 10 ||
                Object.keys(errors).length > 0
              }
              className={`flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-lg ${
                isSubmitting ||
                !newDate ||
                !selectedWorker ||
                adjustmentReason.trim().length < 10 ||
                Object.keys(errors).length > 0
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              {isSubmitting ? '저장 중...' : '일정 조정 저장'}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white p-6 rounded-t-2xl">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <CheckCircle className="w-6 h-6" />
                일정 조정 확인
              </h3>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">
                아래 내용으로 작업 일정을 조정하시겠습니까?
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-6">
                <div>
                  <div className="text-xs text-gray-500 mb-1">새로운 일정</div>
                  <div className="font-semibold text-gray-900">
                    {formatDate(newDate)} {newHour}:{newMinute}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">배정 작업자</div>
                  <div className="font-semibold text-gray-900">
                    {selectedWorker?.name} ({selectedWorker?.id})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">변경 사유</div>
                  <div className="text-sm text-gray-700 line-clamp-3">
                    {adjustmentReason}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-lg font-semibold transition-all"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isSubmitting && (
        <LoadingSpinner
          fullScreen
          size="large"
          message="일정을 조정하는 중입니다..."
        />
      )}
    </div>
  );
};

export default WorkerAdjustment;
