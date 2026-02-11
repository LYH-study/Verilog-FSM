export enum NodeType {
  INITIAL = 'INITIAL',
  STATE = 'STATE',
}

export interface FSMState {
  id: string;
  label: string;
  type?: NodeType;
  description?: string;
}

export interface FSMTransition {
  source: string;
  target: string;
  condition: string;
  action?: string;
}

export interface FSMData {
  moduleName: string;
  clockSignal?: string;
  resetSignal?: string;
  states: FSMState[];
  transitions: FSMTransition[];
}

export interface ParseResult {
  success: boolean;
  data?: FSMData;
  error?: string;
}
