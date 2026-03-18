/**
 * 작업 완료 Mutation Hook (React Query)
 * - 작업 완료 API 호출
 * - 성공 시 작업 목록 캐시 무효화 → 자동 리페칭
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeWork } from '../../services/apiService';
import { WorkCompleteData } from '../../types';
import { logWorkComplete, logDebug } from '../../services/logService';

export const useCompleteWork = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (completeData: WorkCompleteData) => completeWork(completeData),
    onSuccess: (result, variables) => {
      // 작업 목록 캐시 무효화 → 자동 리페칭
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });

      console.log('[useCompleteWork] 작업 완료 성공 - 작업 목록 캐시 무효화');
      logWorkComplete(variables.WRK_ID || '');
      return result;
    },
    onError: (error, variables) => {
      console.error('[useCompleteWork] 작업 완료 실패:', error);
      logDebug({
        LOG_LEVEL: 'ERROR',
        API_PATH: '/work/complete',
        API_METHOD: 'POST',
        PAGE_VIEW: 'WorkComplete',
        ERROR_MSG: `WRK_ID=${variables.WRK_ID || ''} ${error instanceof Error ? error.message : String(error)}`,
        STACK_TRACE: error instanceof Error ? error.stack : undefined,
      });
    },
  });
};
