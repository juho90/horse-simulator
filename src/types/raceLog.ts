export interface HorseTurnState {
  turn: number;
  horses: Array<{
    id: number;
    name: string;
    x: number;
    y: number;
    // 필요시 추가 정보 (예: stamina, lap 등)
    [key: string]: any;
  }>;
}
