import type {PlayerId, GameEngine,GameResult, ActionResult} from "../engine";
// --- DOMENA WARCABÓW ---

export type PlayerColor = 'WHITE' | 'BLACK';
export type PieceType = 'MAN' | 'KING';

export interface Position {
    row: number;
    col: number;
}

export interface Piece {
    player: PlayerColor;
    type: PieceType;
}

export interface CheckersState {
    players: Record<PlayerColor, PlayerId>;
    board: (Piece | null)[][];
    turn: PlayerColor;

    winner: PlayerColor | null;
    isDraw: boolean;

    multiJumpPiece: Position | null;
    deadPieces: Position[];
    drawMoveCount: number;
    positionHistory: Record<string, number>;
}

export interface CheckersAction {
    type: 'MOVE';
    from: Position;
    to: Position;
}

export type CheckersView = CheckersState;

// --- WEWNĘTRZNE TYPY I BEZPIECZNE METODY DOSTĘPU ---

interface InternalMove {
    from: Position;
    to: Position;
    capturedPieces: Position[];
}

const BOARD_SIZE = 8;
const DIAGONALS: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function isOutOfBounds(row: number, col: number): boolean {
    return row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE;
}

// BEZPIECZNE ODCZYTYWANIE PIONKA (zabezpiecza przed TS 2532)
function getPiece(state: CheckersState, row: number, col: number): Piece | null {
    if (isOutOfBounds(row, col)) return null;
    const rowArr = state.board[row];
    return rowArr ? (rowArr[col] ?? null) : null;
}

// BEZPIECZNE ZAPISYWANIE PIONKA (zabezpiecza przed TS 2532)
function setPiece(state: CheckersState, row: number, col: number, piece: Piece | null): void {
    if (isOutOfBounds(row, col)) return;
    const rowArr = state.board[row];
    if (rowArr) {
        rowArr[col] = piece;
    }
}

function cloneState(state: CheckersState): CheckersState {
    return {
        ...state,
        players: { ...state.players },
        board: state.board.map(row => row.map(piece => (piece ? { ...piece } : null))),
        multiJumpPiece: state.multiJumpPiece ? { ...state.multiJumpPiece } : null,
        deadPieces: state.deadPieces.map(p => ({ ...p })),
        positionHistory: { ...state.positionHistory },
    };
}

function getBoardSnapshot(state: CheckersState): string {
    let snapshot = state.turn[0] + '|';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if ((r + c) % 2 !== 0) {
                const piece = getPiece(state, r, c);
                if (piece) {
                    snapshot += `${r}${c}${piece.player[0]}${piece.type[0]}-`;
                }
            }
        }
    }
    return snapshot;
}

function getRegularMovesForPiece(state: CheckersState, pos: Position): InternalMove[] {
    const piece = getPiece(state, pos.row, pos.col);
    if (!piece || piece.player !== state.turn) return [];

    const moves: InternalMove[] = [];
    const allowedDiagonals = piece.type === 'KING' ? DIAGONALS :
        (piece.player === 'WHITE' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);

    for (const [dr, dc] of allowedDiagonals) {
        let r = pos.row + dr!;
        let c = pos.col + dc!;

        while (!isOutOfBounds(r, c)) {
            if (getPiece(state, r, c) !== null) break;

            moves.push({ from: pos, to: { row: r, col: c }, capturedPieces: [] });

            if (piece.type === 'MAN') break;
            r += dr!;
            c += dc!;
        }
    }
    return moves;
}

function getCapturesForPiece(state: CheckersState, pos: Position, currentDead: Position[]): InternalMove[] {
    const piece = getPiece(state, pos.row, pos.col);
    if (!piece || piece.player !== state.turn) return [];

    const captures: InternalMove[] = [];

    for (const [dr, dc] of DIAGONALS) {
        if (piece.type === 'KING') {
            let r = pos.row + dr;
            let c = pos.col + dc;
            let foundOpponent: Position | null = null;

            while (!isOutOfBounds(r, c)) {
                const isDead = currentDead.some(dp => dp.row === r && dp.col === c);
                const currentTarget = getPiece(state, r, c);

                if (currentTarget) {
                    if (currentTarget.player === piece.player) break;
                    if (isDead) break;
                    if (foundOpponent) break;
                    foundOpponent = { row: r, col: c };
                } else if (foundOpponent) {
                    captures.push({ from: pos, to: { row: r, col: c }, capturedPieces: [foundOpponent] });
                }
                r += dr;
                c += dc;
            }
        } else {
            const jumpR = pos.row + (dr * 2);
            const jumpC = pos.col + (dc * 2);
            const midR = pos.row + dr;
            const midC = pos.col + dc;

            if (!isOutOfBounds(jumpR, jumpC)) {
                const isMidDead = currentDead.some(dp => dp.row === midR && dp.col === midC);
                const midPiece = getPiece(state, midR, midC);
                const jumpSquare = getPiece(state, jumpR, jumpC);

                if (midPiece && midPiece.player !== piece.player && !isMidDead && jumpSquare === null) {
                    captures.push({
                        from: pos,
                        to: { row: jumpR, col: jumpC },
                        capturedPieces: [{ row: midR, col: midC }]
                    });
                }
            }
        }
    }
    return captures;
}

function getMaxCaptureDepth(state: CheckersState, currentPos: Position, currentDead: Position[]): number {
    const piece = getPiece(state, currentPos.row, currentPos.col);
    if (!piece) return 0;

    const captures = getCapturesForPiece(state, currentPos, currentDead);
    if (captures.length === 0) return 0;

    let max = 0;
    for (const cap of captures) {
        setPiece(state, currentPos.row, currentPos.col, null);
        setPiece(state, cap.to.row, cap.to.col, piece);

        const newDead = [...currentDead, ...cap.capturedPieces];
        const depth = 1 + getMaxCaptureDepth(state, cap.to, newDead);
        if (depth > max) max = depth;

        setPiece(state, cap.to.row, cap.to.col, null);
        setPiece(state, currentPos.row, currentPos.col, piece);
    }
    return max;
}

function getAllValidMoves(state: CheckersState): InternalMove[] {
    if (state.winner || state.isDraw) return [];

    // Użycie lokalnej zmiennej chroni przed błędem undefined na multiJumpPiece
    const mjp = state.multiJumpPiece;
    if (mjp) {
        const maxDepth = getMaxCaptureDepth(state, mjp, state.deadPieces);
        const captures = getCapturesForPiece(state, mjp, state.deadPieces);

        return captures.filter(cap => {
            const piece = getPiece(state, mjp.row, mjp.col);
            if (!piece) return false; // Type Guard

            setPiece(state, mjp.row, mjp.col, null);
            setPiece(state, cap.to.row, cap.to.col, piece);

            const newDead = [...state.deadPieces, ...cap.capturedPieces];
            const depth = 1 + getMaxCaptureDepth(state, cap.to, newDead);

            setPiece(state, cap.to.row, cap.to.col, null);
            setPiece(state, mjp.row, mjp.col, piece);

            return depth === maxDepth;
        });
    }

    const allRegularMoves: InternalMove[] = [];
    let globalMaxCaptureDepth = 0;
    let bestCaptures: InternalMove[] = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = getPiece(state, r, c);

            if (piece && piece.player === state.turn) {
                const pos = { row: r, col: c };
                const depth = getMaxCaptureDepth(state, pos, []);

                if (depth > globalMaxCaptureDepth) {
                    globalMaxCaptureDepth = depth;
                    bestCaptures = [];
                }

                if (depth > 0 && depth === globalMaxCaptureDepth) {
                    const captures = getCapturesForPiece(state, pos, []);
                    for (const cap of captures) {
                        setPiece(state, pos.row, pos.col, null);
                        setPiece(state, cap.to.row, cap.to.col, piece);

                        const newDead = [...cap.capturedPieces];
                        const capDepth = 1 + getMaxCaptureDepth(state, cap.to, newDead);

                        setPiece(state, cap.to.row, cap.to.col, null);
                        setPiece(state, pos.row, pos.col, piece);

                        if (capDepth === globalMaxCaptureDepth) bestCaptures.push(cap);
                    }
                } else if (globalMaxCaptureDepth === 0) {
                    allRegularMoves.push(...getRegularMovesForPiece(state, pos));
                }
            }
        }
    }

    return globalMaxCaptureDepth > 0 ? bestCaptures : allRegularMoves;
}

// --- GŁÓWNY SILNIK (ZGODNY Z KONTRAKTEM) ---

export class CheckersEngine implements GameEngine<CheckersState, CheckersAction, CheckersView> {
    public readonly minPlayers = 2;
    public readonly maxPlayers = 2;

    public createInitialState(players: PlayerId[]): CheckersState {
        if (players.length !== 2) throw new Error("Checkers requires exactly 2 players");

        const board: (Piece | null)[][] = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if ((row + col) % 2 !== 0) {
                    if (row < 3) board[row]![col] = { player: 'BLACK', type: 'MAN' };
                    else if (row > 4) board[row]![col] = { player: 'WHITE', type: 'MAN' };
                }
            }
        }

        const initialState: CheckersState = {
            players: { WHITE: players[0]!, BLACK: players[1]! },
            board,
            turn: 'WHITE',
            winner: null,
            isDraw: false,
            multiJumpPiece: null,
            deadPieces: [],
            drawMoveCount: 0,
            positionHistory: {},
        };

        initialState.positionHistory[getBoardSnapshot(initialState)] = 1;
        return initialState;
    }

    public getActivePlayers(state: CheckersState): PlayerId[] {
        if (state.winner || state.isDraw) return [];
        return [state.players[state.turn]];
    }

    public applyAction(state: CheckersState, playerId: PlayerId, action: CheckersAction): ActionResult<CheckersState> {
        if (state.winner || state.isDraw) {
            return { ok: false, reason: "Game is already over" };
        }

        if (state.players[state.turn] !== playerId) {
            return { ok: false, reason: "Not your turn" };
        }

        if (action.type !== 'MOVE') {
            return { ok: false, reason: "Unknown action type" };
        }

        const validMoves = getAllValidMoves(state);
        const matchedMove = validMoves.find(m =>
            m.from.row === action.from.row && m.from.col === action.from.col &&
            m.to.row === action.to.row && m.to.col === action.to.col
        );

        if (!matchedMove) {
            return { ok: false, reason: "Invalid move (violates rules or capture priority)" };
        }

        const nextState = cloneState(state);

        // Używamy Type Guarda-jeśli pionka fizycznie nie ma (coś poszło nie tak), bezpiecznie odrzucamy akcję
        const piece = getPiece(nextState, matchedMove.from.row, matchedMove.from.col);
        if (!piece) {
            return { ok: false, reason: "Origin piece not found" };
        }

        const isCapture = matchedMove.capturedPieces.length > 0;

        if (isCapture || piece.type === 'MAN') {
            nextState.drawMoveCount = 0;
            nextState.positionHistory = {};
        } else {
            nextState.drawMoveCount++;
        }

        // Bezpieczne przestawienie figury
        setPiece(nextState, matchedMove.to.row, matchedMove.to.col, piece);
        setPiece(nextState, matchedMove.from.row, matchedMove.from.col, null);

        if (isCapture) {
            nextState.deadPieces.push(...matchedMove.capturedPieces);
            nextState.multiJumpPiece = matchedMove.to;

            const furtherMoves = getAllValidMoves(nextState);
            if (furtherMoves.length > 0) {
                return { ok: true, state: nextState };
            }
        }

        // --- ZAKOŃCZENIE TURY ---
        nextState.multiJumpPiece = null;

        if (piece.type === 'MAN') {
            const promotionRow = piece.player === 'WHITE' ? 0 : BOARD_SIZE - 1;
            if (matchedMove.to.row === promotionRow) {
                piece.type = 'KING';
            }
        }

        // Bezpieczne usuwanie ofiar
        for (const dead of nextState.deadPieces) {
            setPiece(nextState, dead.row, dead.col, null);
        }
        nextState.deadPieces = [];

        nextState.turn = nextState.turn === 'WHITE' ? 'BLACK' : 'WHITE';

        if (nextState.drawMoveCount >= 30) {
            nextState.isDraw = true;
        } else {
            const availableNextMoves = getAllValidMoves(nextState);
            if (availableNextMoves.length === 0) {
                nextState.winner = state.turn;
            } else {
                const snapshot = getBoardSnapshot(nextState);
                const count = (nextState.positionHistory[snapshot] || 0) + 1;
                nextState.positionHistory[snapshot] = count;

                if (count >= 3) nextState.isDraw = true;
            }
        }

        return { ok: true, state: nextState };
    }

    public onTurnTimeout(state: CheckersState): CheckersState {
        const nextState = cloneState(state);
        nextState.winner = state.turn === 'WHITE' ? 'BLACK' : 'WHITE';
        return nextState;
    }

    public getPlayerView(state: CheckersState, playerId: PlayerId): CheckersView {
        return state;
    }

    public getResult(state: CheckersState): GameResult | null {
        if (state.winner) {
            const winnerId = state.players[state.winner];
            const loserColor = state.winner === 'WHITE' ? 'BLACK' : 'WHITE';
            const loserId = state.players[loserColor];

            return {
                [winnerId]: 'win',
                [loserId]: 'loss'
            };
        }

        if (state.isDraw) {
            return {
                [state.players.WHITE]: 'draw',
                [state.players.BLACK]: 'draw'
            };
        }

        return null;
    }
}