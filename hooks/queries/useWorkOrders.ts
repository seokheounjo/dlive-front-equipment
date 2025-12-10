/**
 * 작업 목록 조회 Custom Hook (React Query)
 * - 작업 목록을 조회하고 캐싱
 * - 자동 리페칭 및 에러 처리
 */
import { useQuery } from '@tanstack/react-query';
import { getWorkOrders } from '../../services/apiService';
import { WorkOrder } from '../../types';

interface UseWorkOrdersParams {
  startDate: string;
  endDate: string;
}

export const useWorkOrders = (params: UseWorkOrdersParams) => {
  return useQuery<WorkOrder[], Error>({
    queryKey: ['workOrders', params.startDate, params.endDate],
    queryFn: () => getWorkOrders(params),
    enabled: !!params.startDate && !!params.endDate, // 파라미터 있을 때만 호출
    staleTime: 2 * 60 * 1000, // 2분 - 작업 목록은 자주 변경될 수 있으므로 짧게
    gcTime: 5 * 60 * 1000, // 5분 캐시 유지
  });
};
