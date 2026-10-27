import type { Position, Move, Player } from './types';
import Board from './board';

class Game {
    public board: Board;
    public currentPlayer: Player;

    public winner: Player | null = null;
    public isDraw: boolean = false;

    public multiJumpPiece: Position | null = null;
    public deadPieces: Position[] = [];
    public drawMoveCount: number = 0;

    // NOWE: Historia pozycji do remisu przez powtórzenie
    public positionHistory: Map<string, number> = new Map();

    private readonly DIAGONALS: [number, number][] = [
        [-1, -1], [-1, 1],
        [1, -1], [1, 1]
    ];

    constructor() {
        this.board = new Board();
        this.currentPlayer = 'WHITE';

        // Zapisujemy stan początkowy (choć i tak zostanie wyczyszczony po 1. ruchu)
        this.positionHistory.set(this.getBoardSnapshot(), 1);
    }

    // NOWE: Funkcja tworząca unikalny podpis (hash) obecnego stanu planszy
    private getBoardSnapshot(): string {
        // Zaczynamy od gracza, którego jest kolej (W lub B)
        let snapshot = this.currentPlayer[0] + '|';
        for (let r = 0; r < this.board.size; r++) {
            for (let c = 0; c < this.board.size; c++) {
                // Sprawdzamy tylko czarne pola
                if ((r + c) % 2 !== 0) {
                    const piece = this.board.getPiece({ row: r, col: c });
                    if (piece) {
                        // Tworzymy krótki zapis, np. "52WM-" (Rząd 5, Kolumna 2, White, Man)
                        snapshot += `${r}${c}${piece.player[0]}${piece.type[0]}-`;
                    }
                }
            }
        }
        return snapshot;
    }

    public switchTurn(): void {
        this.currentPlayer = this.currentPlayer === 'WHITE' ? 'BLACK' : 'WHITE';
    }

    private checkEndConditions(): void {
        if (this.drawMoveCount >= 30) {
            this.isDraw = true;
            return;
        }

        const availableMoves = this.getAllValidMoves();
        if (availableMoves.length === 0) {
            this.winner = this.currentPlayer === 'WHITE' ? 'BLACK' : 'WHITE';
            return; // Zakończ od razu, jeśli jest wygrana
        }

        // NOWE: Remis przez trzykrotne powtórzenie pozycji
        const snapshot = this.getBoardSnapshot();
        const count = (this.positionHistory.get(snapshot) || 0) + 1;
        this.positionHistory.set(snapshot, count);

        if (count >= 3) {
            this.isDraw = true;
        }
    }

    private getMaxCaptureDepth(currentPos: Position, currentDead: Position[]): number {
        const piece = this.board.getPiece(currentPos);
        if (!piece) return 0;

        const captures = this.getCapturesForPiece(currentPos, currentDead);
        if (captures.length === 0) return 0;

        let max = 0;
        for (const cap of captures) {
            this.board.setPiece(currentPos, null);
            this.board.setPiece(cap.to, piece);

            const newDead = [...currentDead, ...cap.capturedPieces];
            const depth = 1 + this.getMaxCaptureDepth(cap.to, newDead);
            if (depth > max) max = depth;

            this.board.setPiece(cap.to, null);
            this.board.setPiece(currentPos, piece);
        }
        return max;
    }

    public getAllValidMoves(): Move[] {
        if (this.winner || this.isDraw) return [];

        if (this.multiJumpPiece) {
            const maxDepth = this.getMaxCaptureDepth(this.multiJumpPiece, this.deadPieces);
            const captures = this.getCapturesForPiece(this.multiJumpPiece, this.deadPieces);

            return captures.filter(cap => {
                const piece = this.board.getPiece(this.multiJumpPiece!);
                this.board.setPiece(this.multiJumpPiece!, null);
                this.board.setPiece(cap.to, piece);

                const newDead = [...this.deadPieces, ...cap.capturedPieces];
                const depth = 1 + this.getMaxCaptureDepth(cap.to, newDead);

                this.board.setPiece(cap.to, null);
                this.board.setPiece(this.multiJumpPiece!, piece);

                return depth === maxDepth;
            });
        }

        const allRegularMoves: Move[] = [];
        let globalMaxCaptureDepth = 0;
        let bestCaptures: Move[] = [];

        for (let r = 0; r < this.board.size; r++) {
            for (let c = 0; c < this.board.size; c++) {
                const pos = { row: r, col: c };
                const piece = this.board.getPiece(pos);

                if (piece && piece.player === this.currentPlayer) {
                    const depth = this.getMaxCaptureDepth(pos, []);

                    if (depth > globalMaxCaptureDepth) {
                        globalMaxCaptureDepth = depth;
                        bestCaptures = [];
                    }

                    if (depth > 0 && depth === globalMaxCaptureDepth) {
                        const captures = this.getCapturesForPiece(pos, []);
                        for (const cap of captures) {
                            this.board.setPiece(pos, null);
                            this.board.setPiece(cap.to, piece);

                            const newDead = [...cap.capturedPieces];
                            const capDepth = 1 + this.getMaxCaptureDepth(cap.to, newDead);

                            this.board.setPiece(cap.to, null);
                            this.board.setPiece(pos, piece);

                            if (capDepth === globalMaxCaptureDepth) {
                                bestCaptures.push(cap);
                            }
                        }
                    } else if (globalMaxCaptureDepth === 0) {
                        allRegularMoves.push(...this.getRegularMovesForPiece(pos));
                    }
                }
            }
        }

        if (globalMaxCaptureDepth > 0) {
            return bestCaptures;
        }

        return allRegularMoves;
    }

    public makeMove(move: Move): boolean {
        const validMoves = this.getAllValidMoves();
        const isValid = validMoves.some(m =>
            m.from.row === move.from.row && m.from.col === move.from.col &&
            m.to.row === move.to.row && m.to.col === move.to.col
        );

        if (!isValid) return false;

        const piece = this.board.getPiece(move.from);
        if (!piece) return false;

        const isCapture = move.capturedPieces.length > 0;

        // NOWE: Rozbudowany reset przy ruchach nieodwracalnych
        if (isCapture || piece.type === 'MAN') {
            this.drawMoveCount = 0;
            this.positionHistory.clear(); // Ruch nieodwracalny, czyścimy historię!
        } else {
            this.drawMoveCount++;
        }

        this.board.movePiece(move.from, move.to);

        if (isCapture) {
            this.deadPieces.push(...move.capturedPieces);

            this.multiJumpPiece = move.to;
            const validNext = this.getAllValidMoves();

            if (validNext.length > 0) {
                return true;
            }
        }

        // === KONIEC TURY ===
        this.multiJumpPiece = null;

        if (piece.type === 'MAN') {
            const promotionRow = piece.player === 'WHITE' ? 0 : this.board.size - 1;
            if (move.to.row === promotionRow) {
                piece.promoteToKing();
            }
        }

        for (const dead of this.deadPieces) {
            this.board.setPiece(dead, null);
        }
        this.deadPieces = [];

        this.switchTurn();
        this.checkEndConditions();

        return true;
    }

    public getCapturesForPiece(pos: Position, currentDead: Position[] = this.deadPieces): Move[] {
        const piece = this.board.getPiece(pos);
        if (!piece || piece.player !== this.currentPlayer) return [];

        const captures: Move[] = [];

        for (const [dr, dc] of this.DIAGONALS) {
            if (piece.isKing()) {
                let r = pos.row + dr;
                let c = pos.col + dc;
                let foundOpponent: Position | null = null;

                while (!this.board.isOutOfBounds({ row: r, col: c })) {
                    const targetPos = { row: r, col: c };
                    const isDead = currentDead.some(dp => dp.row === r && dp.col === c);
                    const currentTarget = this.board.getPiece(targetPos);

                    if (currentTarget) {
                        if (currentTarget.player === piece.player) break;
                        if (isDead) break;
                        if (foundOpponent) break;

                        foundOpponent = targetPos;
                    } else if (foundOpponent) {
                        captures.push({
                            from: pos,
                            to: targetPos,
                            capturedPieces: [foundOpponent]
                        });
                    }
                    r += dr;
                    c += dc;
                }
            } else {
                const jumpR = pos.row + (dr * 2);
                const jumpC = pos.col + (dc * 2);
                const midR = pos.row + dr;
                const midC = pos.col + dc;

                if (!this.board.isOutOfBounds({ row: jumpR, col: jumpC })) {
                    const isMidDead = currentDead.some(dp => dp.row === midR && dp.col === midC);
                    const midPiece = this.board.getPiece({ row: midR, col: midC });
                    const jumpSquare = this.board.getPiece({ row: jumpR, col: jumpC });

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

    public getRegularMovesForPiece(pos: Position): Move[] {
        const piece = this.board.getPiece(pos);
        if (!piece || piece.player !== this.currentPlayer) return [];

        const moves: Move[] = [];
        const allowedDiagonals: [number, number][] = piece.isKing() ? this.DIAGONALS :
            (piece.player === 'WHITE' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);

        for (const [dr, dc] of allowedDiagonals) {
            let r = pos.row + dr;
            let c = pos.col + dc;

            while (!this.board.isOutOfBounds({ row: r, col: c })) {
                if (this.board.getPiece({ row: r, col: c }) !== null) {
                    break;
                }

                moves.push({
                    from: pos,
                    to: { row: r, col: c },
                    capturedPieces: []
                });

                if (!piece.isKing()) break;
                r += dr;
                c += dc;
            }
        }
        return moves;
    }
}

export default Game;