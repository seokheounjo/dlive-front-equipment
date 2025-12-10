/**
 * 작업 완료 Mutation Hook (React Query)
 * - 작업 완료 API 호출
 * - 성공 시 작업 목록 캐시 무효화 → 자동 리페칭
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeWork } from '../../services/apiService';
import { WorkCompleteData } from '../../types';

export const useCompleteWork = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (completeData: WorkCompleteData) => completeWork(completeData),
    onSuccess: (result) => {
      // 작업 목록 캐시 무효화 → 자동 리페칭
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });

      console.log('✅ [useCompleteWork] 작업 완료 성공 - 작업 목록 캐시 무효화');
      return result;
    },
    onError: (error) => {
      console.error('❌ [useCompleteWork] 작업 완료 실패:', error);
    },
  });
};
