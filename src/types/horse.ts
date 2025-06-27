export interface Horse {
  id: number;
  name: string;
  speed: number;
  stamina?: number;
  reaction?: number;
  [key: string]: any;
}
