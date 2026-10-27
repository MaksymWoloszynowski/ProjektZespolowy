export type PlayerId = string;
export type PlayerOutcome = 'win' | 'loss' | 'draw';
export type GameResult = Record<PlayerId, PlayerOutcome>;
export type ActionResult<State> =
    | { ok: true; state: State }
    | { ok: false; reason: string };

export interface GameEngine<State, Action, PlayerView> {
    readonly minPlayers: number;
    readonly maxPlayers: number;
    createInitialState(players: PlayerId[]): State;
    getActivePlayers(state: State): PlayerId[];
    applyAction(state: State, playerId: PlayerId, action: Action): ActionResult<State>;
    onTurnTimeout(state: State): State;
    getPlayerView(state: State, playerId: PlayerId): PlayerView;
    getResult(state: State): GameResult | null;
}