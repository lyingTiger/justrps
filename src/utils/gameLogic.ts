// src/utils/gameLogic.ts

/**
 * 멀티플레이 승점 계산기
 * @param rank 플레이어의 최종 등수 (1~4)
 * @param total 참여한 총 인원수 (2~4)
 */
export const calculateMultiPoint = (rank: number, total: number): number => {
  if (rank === 1) return 1.0;
  if (rank === total) return 0.0; // 꼴찌는 무조건 0점

  if (total === 3 && rank === 2) return 0.5;
  if (total === 4) {
    if (rank === 2) return 0.7;
    if (rank === 3) return 0.4;
  }
  return 0;
};