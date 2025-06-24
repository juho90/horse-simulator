export interface Horse {
  id: number;
  name: string;
  speed: number; // m/턴
  stamina?: number;
  reaction?: number;
  [key: string]: any;
}
