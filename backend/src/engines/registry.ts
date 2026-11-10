import type { GameEngine } from './engine.js';
import { CheckersEngine } from './checkers/checkersEngine.js';

// the registry only has to hand out engines by id, so it stays loosely typed
export type AnyEngine = GameEngine<any, any, any>;

// add each new game's engine here
const engines: AnyEngine[] = [new CheckersEngine()];

export const allEngines = (): readonly AnyEngine[] => engines;

export const getEngine = (id: string): AnyEngine | undefined =>
  engines.find((e) => e.id === id);
