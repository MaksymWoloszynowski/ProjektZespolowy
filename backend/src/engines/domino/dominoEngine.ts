import type {
  PlayerId,
  GameEngine,
  GameResult,
  ActionResult,
} from '../engine.js';
import type { PlacementSide } from './dominoBoard.js';

export type DominoPips = [number, number];

export interface BoardPiece {
  pips: DominoPips;
  x: number;
  y: number;
}

export interface DominoState {
  players: PlayerId[];
  currentPlayer: PlayerId;
  hands: Record<PlayerId, DominoPips[]>;
  scores: Record<PlayerId, number>;
  pointsToWin: number;

  boneyard: DominoPips[];
  board: {
    pieces: BoardPiece[];
    leftValue: number | null;
    rightValue: number | null;
    topValue: number | null;
    bottomValue: number | null;
    leftCoord: { x: number; y: number } | null;
    rightCoord: { x: number; y: number } | null;
    topCoord: { x: number; y: number } | null;
    bottomCoord: { x: number; y: number } | null;
    hasSpinner: boolean;
  };

  status: 'playing' | 'roundOver' | 'gameOver';
  winner: PlayerId | null;
  consecutivePasses: number;
  roundMustStartWithDouble: boolean;
}

export type DominoAction =
  | { type: 'PLAY'; piece: DominoPips; side: PlacementSide }
  | { type: 'DRAW' }
  | { type: 'PASS' };

export interface DominoView {
  players: PlayerId[];
  currentPlayer: PlayerId;
  myHand: DominoPips[];
  handCounts: Record<PlayerId, number>;
  scores: Record<PlayerId, number>;
  pointsToWin: number;
  boneyardCount: number;
  board: {
    pieces: BoardPiece[];
    leftValue: number | null;
    rightValue: number | null;
    topValue: number | null;
    bottomValue: number | null;
    hasSpinner: boolean;
  };
  status: 'playing' | 'roundOver' | 'gameOver';
  winner: PlayerId | null;
}

function pipsEqual(p1: DominoPips, p2: DominoPips): boolean {
  return (p1[0] === p2[0] && p1[1] === p2[1]) || (p1[0] === p2[1] && p1[1] === p2[0]);
}

function generateBoneyard(): DominoPips[] {
  const pieces: DominoPips[] = [];
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j <= i; j++) {
      pieces.push([j, i]);
    }
  }
  return pieces;
}

function shufflePieces(pieces: DominoPips[]): DominoPips[] {
  const shuffled = [...pieces];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

function cloneState(state: DominoState): DominoState {
  const hands: Record<PlayerId, DominoPips[]> = {};
  for (const p of state.players) {
    hands[p] = state.hands[p] ? state.hands[p]!.map(piece => [piece[0], piece[1]] as DominoPips) : [];
  }

  return {
    ...state,
    players: [...state.players],
    hands,
    scores: { ...state.scores },
    boneyard: state.boneyard.map(p => [p[0], p[1]] as DominoPips),
    board: {
      ...state.board,
      pieces: state.board.pieces.map(bp => ({
        pips: [bp.pips[0], bp.pips[1]] as DominoPips,
        x: bp.x,
        y: bp.y,
      })),
      leftCoord: state.board.leftCoord ? { ...state.board.leftCoord } : null,
      rightCoord: state.board.rightCoord ? { ...state.board.rightCoord } : null,
      topCoord: state.board.topCoord ? { ...state.board.topCoord } : null,
      bottomCoord: state.board.bottomCoord ? { ...state.board.bottomCoord } : null,
    },
  };
}

function canPieceMatch(piece: DominoPips, value: number | null): boolean {
  if (value === null) return false;
  return piece[0] === value || piece[1] === value;
}

function playerCanMove(state: DominoState, playerId: PlayerId): boolean {
  const hand = state.hands[playerId];
  if (!hand || hand.length === 0) return false;

  const { leftValue, rightValue, topValue, bottomValue } = state.board;

  // Pusta plansza
  if (leftValue === null && rightValue === null && topValue === null && bottomValue === null) {
    if (state.roundMustStartWithDouble) {
      return hand.some(p => p[0] === p[1]);
    }
    return hand.length > 0;
  }

  return hand.some(piece =>
    canPieceMatch(piece, leftValue) ||
    canPieceMatch(piece, rightValue) ||
    canPieceMatch(piece, topValue) ||
    canPieceMatch(piece, bottomValue)
  );
}

export class DominoEngine implements GameEngine<
  DominoState,
  DominoAction,
  DominoView
> {
  public readonly id = 'domino';
  public readonly name = 'Domino';
  public readonly usesElo = true;
  public readonly minPlayers = 2;
  public readonly maxPlayers = 4;

  public createInitialState(players: PlayerId[]): DominoState {
    if (players.length < this.minPlayers || players.length > this.maxPlayers) {
      throw new Error(`Domino requires between ${this.minPlayers} and ${this.maxPlayers} players`);
    }

    const scores: Record<PlayerId, number> = {};
    for (const p of players) {
      scores[p] = 0;
    }

    const state: DominoState = {
      players: [...players],
      currentPlayer: players[0]!,
      hands: {},
      scores,
      pointsToWin: 100,
      boneyard: [],
      board: {
        pieces: [],
        leftValue: null,
        rightValue: null,
        topValue: null,
        bottomValue: null,
        leftCoord: null,
        rightCoord: null,
        topCoord: null,
        bottomCoord: null,
        hasSpinner: false,
      },
      status: 'playing',
      winner: null,
      consecutivePasses: 0,
      roundMustStartWithDouble: false,
    };

    return this.initNewRound(state);
  }

  private initNewRound(state: DominoState): DominoState {
    const nextState = cloneState(state);
    const boneyard = shufflePieces(generateBoneyard());
    const hands: Record<PlayerId, DominoPips[]> = {};
    const piecesPerPlayer = nextState.players.length === 2 ? 7 : 5;

    for (const p of nextState.players) {
      hands[p] = [];
      for (let i = 0; i < piecesPerPlayer; i++) {
        const piece = boneyard.pop();
        if (piece) {
          hands[p]!.push(piece);
        }
      }
    }

    nextState.hands = hands;
    nextState.boneyard = boneyard;
    nextState.board = {
      pieces: [],
      leftValue: null,
      rightValue: null,
      topValue: null,
      bottomValue: null,
      leftCoord: null,
      rightCoord: null,
      topCoord: null,
      bottomCoord: null,
      hasSpinner: false,
    };
    nextState.consecutivePasses = 0;
    nextState.status = 'playing';

    // Określenie pierwszego gracza
    let bestDoublePlayer: PlayerId | null = null;
    let highestDoubleVal = -1;

    for (const p of nextState.players) {
      for (const piece of nextState.hands[p]!) {
        if (piece[0] === piece[1] && piece[0] > highestDoubleVal) {
          highestDoubleVal = piece[0];
          bestDoublePlayer = p;
        }
      }
    }

    if (bestDoublePlayer) {
      nextState.roundMustStartWithDouble = true;
      nextState.currentPlayer = bestDoublePlayer;
    } else {
      nextState.roundMustStartWithDouble = false;
      let bestPlayer: PlayerId | null = null;
      let highestWeight = -1;

      for (const p of nextState.players) {
        for (const piece of nextState.hands[p]!) {
          const weight = piece[0] + piece[1];
          if (weight > highestWeight) {
            highestWeight = weight;
            bestPlayer = p;
          }
        }
      }

      nextState.currentPlayer = bestPlayer ?? nextState.players[0]!;
    }

    return nextState;
  }

  public getActivePlayers(state: DominoState): PlayerId[] {
    if (state.status === 'gameOver') return [];
    return [state.currentPlayer];
  }

  public applyAction(
    state: DominoState,
    playerId: PlayerId,
    action: DominoAction,
  ): ActionResult<DominoState> {
    if (state.status === 'gameOver') {
      return { ok: false, reason: 'Game is already over' };
    }

    if (state.currentPlayer !== playerId) {
      return { ok: false, reason: 'Not your turn' };
    }

    const nextState = cloneState(state);

    if (action.type === 'PLAY') {
      return this.handlePlayAction(nextState, playerId, action.piece, action.side);
    }

    if (action.type === 'DRAW') {
      return this.handleDrawAction(nextState, playerId);
    }

    if (action.type === 'PASS') {
      return this.handlePassAction(nextState, playerId);
    }

    return { ok: false, reason: 'Unknown action type' };
  }

  private handlePlayAction(
    state: DominoState,
    playerId: PlayerId,
    piece: DominoPips,
    side: PlacementSide
  ): ActionResult<DominoState> {
    const playerHand = state.hands[playerId];
    if (!playerHand) {
      return { ok: false, reason: 'Player hand not found' };
    }

    const pieceIndex = playerHand.findIndex(p => pipsEqual(p, piece));
    if (pieceIndex === -1) {
      return { ok: false, reason: 'Player does not possess this piece' };
    }

    const actualPiece = playerHand[pieceIndex]!;
    const isDouble = actualPiece[0] === actualPiece[1];

    // Pierwszy ruch na pustej planszy
    if (state.board.pieces.length === 0) {
      if (state.roundMustStartWithDouble && !isDouble) {
        return { ok: false, reason: 'First move in this round must be a double' };
      }

      playerHand.splice(pieceIndex, 1);

      state.board.pieces.push({
        pips: [actualPiece[0], actualPiece[1]],
        x: 0,
        y: 0,
      });

      state.board.leftValue = actualPiece[0];
      state.board.rightValue = actualPiece[1];
      state.board.leftCoord = { x: -1, y: 0 };
      state.board.rightCoord = { x: 1, y: 0 };

      if (isDouble) {
        state.board.hasSpinner = true;
        state.board.topValue = actualPiece[0];
        state.board.bottomValue = actualPiece[1];
        state.board.topCoord = { x: 0, y: -1 };
        state.board.bottomCoord = { x: 0, y: 1 };
      }

      state.consecutivePasses = 0;
      this.checkEndAndAdvance(state);
      return { ok: true, state };
    }

    // Dołożenie do istniejącej planszy
    let targetValue: number | null = null;
    let targetCoord: { x: number; y: number } | null = null;

    if (side === 'left') {
      targetValue = state.board.leftValue;
      targetCoord = state.board.leftCoord;
    } else if (side === 'right') {
      targetValue = state.board.rightValue;
      targetCoord = state.board.rightCoord;
    } else if (side === 'top') {
      targetValue = state.board.topValue;
      targetCoord = state.board.topCoord;
    } else if (side === 'bottom') {
      targetValue = state.board.bottomValue;
      targetCoord = state.board.bottomCoord;
    }

    if (targetValue === null || targetCoord === null) {
      return { ok: false, reason: `Side '${side}' is not open for placement` };
    }

    if (!canPieceMatch(actualPiece, targetValue)) {
      return { ok: false, reason: `Piece [${actualPiece}] does not match target value ${targetValue}` };
    }

    playerHand.splice(pieceIndex, 1);

    // Obrót i dopasowanie
    let orientedPiece: DominoPips = [actualPiece[0], actualPiece[1]];
    if (side === 'left') {
      if (orientedPiece[0] === targetValue) {
        orientedPiece = [orientedPiece[1], orientedPiece[0]];
      }
      state.board.leftValue = orientedPiece[0];
      state.board.pieces.push({ pips: orientedPiece, x: targetCoord.x, y: targetCoord.y });
      state.board.leftCoord = { x: targetCoord.x - 1, y: targetCoord.y };
    } else if (side === 'right') {
      if (orientedPiece[1] === targetValue) {
        orientedPiece = [orientedPiece[1], orientedPiece[0]];
      }
      state.board.rightValue = orientedPiece[1];
      state.board.pieces.push({ pips: orientedPiece, x: targetCoord.x, y: targetCoord.y });
      state.board.rightCoord = { x: targetCoord.x + 1, y: targetCoord.y };
    } else if (side === 'top') {
      if (orientedPiece[0] === targetValue) {
        orientedPiece = [orientedPiece[1], orientedPiece[0]];
      }
      state.board.topValue = orientedPiece[0];
      state.board.pieces.push({ pips: orientedPiece, x: targetCoord.x, y: targetCoord.y });
      state.board.topCoord = { x: targetCoord.x, y: targetCoord.y - 1 };
    } else if (side === 'bottom') {
      if (orientedPiece[1] === targetValue) {
        orientedPiece = [orientedPiece[1], orientedPiece[0]];
      }
      state.board.bottomValue = orientedPiece[1];
      state.board.pieces.push({ pips: orientedPiece, x: targetCoord.x, y: targetCoord.y });
      state.board.bottomCoord = { x: targetCoord.x, y: targetCoord.y + 1 };
    }

    state.consecutivePasses = 0;
    this.checkEndAndAdvance(state);
    return { ok: true, state };
  }

  private handleDrawAction(state: DominoState, playerId: PlayerId): ActionResult<DominoState> {
    if (playerCanMove(state, playerId)) {
      return { ok: false, reason: 'Cannot draw when you have a valid move' };
    }

    if (state.boneyard.length === 0) {
      return { ok: false, reason: 'Boneyard is empty' };
    }

    const piece = state.boneyard.pop()!;
    state.hands[playerId]!.push(piece);

    return { ok: true, state };
  }

  private handlePassAction(state: DominoState, playerId: PlayerId): ActionResult<DominoState> {
    if (playerCanMove(state, playerId)) {
      return { ok: false, reason: 'Cannot pass when you have a valid move' };
    }

    if (state.boneyard.length > 0) {
      return { ok: false, reason: 'Must draw from boneyard instead of passing' };
    }

    state.consecutivePasses++;

    const isRoundEnd =
      state.consecutivePasses >= state.players.length ||
      !state.players.some(p => playerCanMove(state, p));

    if (isRoundEnd) {
      this.resolveRoundEnd(state);
    } else {
      this.advanceTurn(state);
    }

    return { ok: true, state };
  }

  private checkEndAndAdvance(state: DominoState): void {
    const someoneWonHand = state.players.some(p => state.hands[p]!.length === 0);
    const lockedGame =
      state.boneyard.length === 0 &&
      !state.players.some(p => playerCanMove(state, p));

    if (someoneWonHand || lockedGame) {
      this.resolveRoundEnd(state);
    } else {
      this.advanceTurn(state);
    }
  }

  private advanceTurn(state: DominoState): void {
    const currentIndex = state.players.indexOf(state.currentPlayer);
    const nextIndex = (currentIndex + 1) % state.players.length;
    state.currentPlayer = state.players[nextIndex]!;
  }

  private resolveRoundEnd(state: DominoState): void {
    let minPoints = Infinity;
    const playerPoints: Record<PlayerId, number> = {};

    for (const p of state.players) {
      const sum = state.hands[p]!.reduce((acc, pc) => acc + pc[0] + pc[1], 0);
      playerPoints[p] = sum;
      if (sum < minPoints) {
        minPoints = sum;
      }
    }

    const bestPlayers = state.players.filter(p => playerPoints[p] === minPoints);

    // Jeśli jeden zwycięzca rundy, dodaj punkty
    if (bestPlayers.length === 1) {
      const roundWinner = bestPlayers[0]!;
      let gainedPoints = 0;
      for (const p of state.players) {
        if (p !== roundWinner) {
          gainedPoints += playerPoints[p]!;
        }
      }
      state.scores[roundWinner] = (state.scores[roundWinner] || 0) + gainedPoints;
    }

    // Sprawdzamy wygraną całej gry
    let gameWinner: PlayerId | null = null;
    let maxScore = -1;

    for (const p of state.players) {
      const currentScore = state.scores[p] || 0;
      if (currentScore >= state.pointsToWin && currentScore > maxScore) {
        maxScore = currentScore;
        gameWinner = p;
      }
    }

    if (gameWinner) {
      state.status = 'gameOver';
      state.winner = gameWinner;
    } else {
      state.status = 'roundOver';
    }
  }

  public onTurnTimeout(state: DominoState): DominoState {
    if (state.status === 'gameOver') return state;

    const nextState = cloneState(state);
    const currentIdx = nextState.players.indexOf(nextState.currentPlayer);
    // Timeout gracza powoduje przyznanie wygranej następnemu graczowi
    const otherPlayer = nextState.players[(currentIdx + 1) % nextState.players.length]!;
    nextState.status = 'gameOver';
    nextState.winner = otherPlayer;
    return nextState;
  }

  public getPlayerView(state: DominoState, playerId: PlayerId): DominoView {
    const handCounts: Record<PlayerId, number> = {};
    for (const p of state.players) {
      handCounts[p] = state.hands[p] ? state.hands[p]!.length : 0;
    }

    return {
      players: [...state.players],
      currentPlayer: state.currentPlayer,
      myHand: state.hands[playerId] ? state.hands[playerId]!.map(p => [p[0], p[1]]) : [],
      handCounts,
      scores: { ...state.scores },
      pointsToWin: state.pointsToWin,
      boneyardCount: state.boneyard.length,
      board: {
        pieces: state.board.pieces.map(bp => ({
          pips: [bp.pips[0], bp.pips[1]],
          x: bp.x,
          y: bp.y,
        })),
        leftValue: state.board.leftValue,
        rightValue: state.board.rightValue,
        topValue: state.board.topValue,
        bottomValue: state.board.bottomValue,
        hasSpinner: state.board.hasSpinner,
      },
      status: state.status,
      winner: state.winner,
    };
  }

  public getResult(state: DominoState): GameResult | null {
    if (state.status !== 'gameOver' || !state.winner) {
      return null;
    }

    const result: GameResult = {};
    for (const p of state.players) {
      result[p] = p === state.winner ? 'win' : 'loss';
    }
    return result;
  }
}

export default DominoEngine;
