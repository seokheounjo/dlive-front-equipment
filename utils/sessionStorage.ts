/**
 * 화면 전환 시에도 상태를 유지하기 위한 세션 스토리지 유틸
 */

const SESSION_KEYS = {
  WORK_FILTERS: 'dlive_work_filters',
  WORK_SELECTED_ORDER: 'dlive_work_selected_order',
  WORK_SELECTED_DIRECTION: 'dlive_work_selected_direction',
  WORK_FORM_DATA: 'dlive_work_form_data',
  ACTIVE_TAB: 'dlive_active_tab',
  ACTIVE_VIEW: 'dlive_active_view',
  LGU_CONSTRUCTION_FORM: 'dlive_lgu_construction_form',
  LGU_NETWORK_FAULT_FORM: 'dlive_lgu_network_fault_form',
  SIGNAL_HISTORY_FILTERS: 'dlive_signal_history_filters',
  WORK_RESULT_SIGNAL_FILTERS: 'dlive_work_result_signal_filters',
  WORK_PROCESS_STEP: 'dlive_work_process_step',
  WORK_PROCESS_EQUIPMENT: 'dlive_work_process_equipment',
} as const;

/**
 * 세션 데이터 저장
 */
export const saveSession = <T>(key: string, data: T): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (error) {
    console.error('세션 저장 실패:', error);
  }
};

/**
 * 세션 데이터 불러오기
 */
export const loadSession = <T>(key: string): T | null => {
  try {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }
    return null;
  } catch (error) {
    console.error('세션 불러오기 실패:', error);
    return null;
  }
};

/**
 * 세션 데이터 삭제
 */
export const clearSession = (key: string): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error('세션 삭제 실패:', error);
  }
};

/**
 * 모든 세션 데이터 삭제
 * - SESSION_KEYS에 정의된 키들
 * - Zustand persist 저장소 (dlive-*)
 * - 작업완료 임시저장 (work_complete_draft_*)
 */
export const clearAllSessions = (): void => {
  try {
    if (typeof window !== 'undefined') {
      // 1. SESSION_KEYS에 정의된 키들 삭제
      Object.values(SESSION_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });

      // 2. Zustand persist 저장소 삭제
      const zustandKeys = [
        'dlive-work-equipment-storage',  // 작업별 장비 상태
        'dlive-work-process-storage',    // 작업 프로세스 상태
        'dlive-equipment-storage',       // 장비 필터
        'dlive-ui-storage',              // UI 상태
      ];
      zustandKeys.forEach(key => {
        localStorage.removeItem(key);
      });

      // 3. 작업 관련 임시저장 삭제 (work_complete_draft_*, equipment_draft_*)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('work_complete_draft_') || key.startsWith('equipment_draft_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      console.log('[clearAllSessions] 삭제 완료:', {
        sessionKeys: Object.values(SESSION_KEYS).length,
        zustandKeys: zustandKeys.length,
        draftKeys: keysToRemove.length
      });
    }
  } catch (error) {
    console.error('전체 세션 삭제 실패:', error);
  }
};

export { SESSION_KEYS };

