/**
 * React Query 설정
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 캐시 관련 설정
      staleTime: 5 * 60 * 1000, // 5분 - 이 시간 동안은 fresh 상태
      gcTime: 10 * 60 * 1000, // 10분 - 캐시 유지 시간 (구 cacheTime)

      // 재시도 설정
      retry: 1, // 실패 시 1번만 재시도
      retryDelay: 1000, // 재시도 대기 시간 1초

      // 리페칭 설정
      refetchOnWindowFocus: false, // 윈도우 포커스 시 리페칭 비활성화 (모바일에서 불필요)
      refetchOnReconnect: true, // 재연결 시 리페칭
      refetchOnMount: true, // 마운트 시 리페칭

      // 기타
      networkMode: 'online', // 온라인일 때만 쿼리 실행
    },
    mutations: {
      // Mutation 설정
      retry: 0, // Mutation은 재시도 안 함 (사용자가 명시적으로 다시 시도해야 함)
      networkMode: 'online',
    },
  },
});
