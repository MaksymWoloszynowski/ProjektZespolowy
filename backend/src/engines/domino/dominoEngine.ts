import type {
  PlayerId,
  GameEngine,
  GameResult,
  ActionResult,
} from '../engine.js';

export interface DominoState {
  // TODO: Zdefiniuj stan gry
}

export interface DominoAction {
  // TODO: Zdefiniuj możliwe akcje
}

export type DominoView = DominoState;

export class DominoEngine implements GameEngine<
  DominoState,
  DominoAction,
  DominoView
> {
  public readonly minPlayers = 2;
  public readonly maxPlayers = 4;

  public createInitialState(players: PlayerId[]): DominoState {
    return {};
  }

  public getActivePlayers(state: DominoState): PlayerId[] {
    return [];
  }

  public applyAction(
    state: DominoState,
    playerId: PlayerId,
    action: DominoAction,
  ): ActionResult<DominoState> {
    return { ok: true, state };
  }

  public onTurnTimeout(state: DominoState): DominoState {
    return state;
  }

  public getPlayerView(state: DominoState, playerId: PlayerId): DominoView {
    return state;
  }

  public getResult(state: DominoState): GameResult | null {
    return null;
  }
}

export default DominoEngine;
