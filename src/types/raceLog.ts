export interface HorseTurnState {
  turn: number;
  horses: Array<{
    id: number;
    name: string;
    x: number;
    y: number;
    [key: string]: any;
  }>;
}
