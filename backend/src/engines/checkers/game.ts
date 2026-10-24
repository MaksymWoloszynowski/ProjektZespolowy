import type { Position, Move, Player } from './types';
import Board = require('./board');

class Game {
    public board: Board;
    public currentPlayer: Player;

    // Zmienne stanu gry
    public winner: Player | null = null;
    public isDraw: boolean = false;

    // Zmienne bicia wielokrotnego i remisów
    public multiJumpPiece: Position | null = null;
    public deadPieces: Position[] = []; // Martwe pionki (Zasada Turecka)
    public drawMoveCount: number = 0;   // Licznik do remisu (zasada 15 tur damkami)

    private readonly DIAGONALS: [number, number][] = [
        [-1, -1], [-1, 1], // Do góry (przód dla białych)
        [1, -1], [1, 1]    // W dół (przód dla czarnych)
    ];

    constructor() {
        this.board = new Board();
        this.currentPlayer = 'WHITE'; // Białe zaczynają
    }

    public switchTurn(): void {
        this.currentPlayer = this.currentPlayer === 'WHITE' ? 'BLACK' : 'WHITE';
    }

    private checkEndConditions(): void {
        // Remis z powodu braku postępu (30 ruchów = 15 pełnych tur)
        if (this.drawMoveCount >= 30) {
            this.isDraw = true;
            return;
        }

        // Wygrana z powodu zablokowania lub braku pionków
        const availableMoves = this.getAllValidMoves();
        if (availableMoves.length === 0) {
            this.winner = this.currentPlayer === 'WHITE' ? 'BLACK' : 'WHITE';
        }
    }

    public getAllValidMoves(): Move[] {
        if (this.winner || this.isDraw) return [];

        if (this.multiJumpPiece) {
            return this.getCapturesForPiece(this.multiJumpPiece);
        }

        const allCaptures: Move[] = [];
        const allRegularMoves: Move[] = [];

        for (let r = 0; r < this.board.size; r++) {
            for (let c = 0; c < this.board.size; c++) {
                const pos = { row: r, col: c };
                const piece = this.board.getPiece(pos);

                if (piece && piece.player === this.currentPlayer) {
                    allCaptures.push(...this.getCapturesForPiece(pos));
                    allRegularMoves.push(...this.getRegularMovesForPiece(pos));
                }
            }
        }

        // Przymus bicia-wariant rosyjski (dowolne bicie, byle do końca)
        if (allCaptures.length > 0) {
            return allCaptures;
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

        // Resetowanie lub inkrementowanie licznika remisów
        if (isCapture || piece.type === 'MAN') {
            this.drawMoveCount = 0;
        } else {
            this.drawMoveCount++;
        }

        this.board.movePiece(move.from, move.to);

        // ZASADA TURECKA: Zapisujemy pionki jako martwe, ale nie ściągamy ich z planszy
        if (isCapture) {
            this.deadPieces.push(...move.capturedPieces);
        }

        // Promocja na damkę w locie (pozwala od razu bić dalej do tyłu/przodu)
        if (piece.type === 'MAN') {
            const promotionRow = piece.player === 'WHITE' ? 0 : this.board.size - 1;
            if (move.to.row === promotionRow) {
                piece.promoteToKing();
            }
        }

        // Bicie wielokrotne
        if (isCapture) {
            const furtherCaptures = this.getCapturesForPiece(move.to);
            if (furtherCaptures.length > 0) {
                this.multiJumpPiece = move.to;
                return true;
            }
        }

        // === KONIEC TURY ===
        this.multiJumpPiece = null;

        // ZASADA TURECKA: Dopiero teraz fizycznie usuwamy ofiary z planszy
        for (const dead of this.deadPieces) {
            this.board.setPiece(dead, null);
        }
        this.deadPieces = [];

        this.switchTurn();
        this.checkEndConditions();

        return true;
    }

    public getCapturesForPiece(pos: Position): Move[] {
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
                    // ZAKAZ PODWÓJNEGO BICIA: Sprawdzamy czy cel to martwy pionek
                    const isDead = this.deadPieces.some(dp => dp.row === r && dp.col === c);
                    const currentTarget = this.board.getPiece(targetPos);

                    if (currentTarget) {
                        if (currentTarget.player === piece.player) break;
                        if (isDead) break; // Martwy pionek blokuje lot damki na tej linii
                        if (foundOpponent) break; // Dwa obce pionki z rzędu

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
                const jumpR = pos.row + dr * 2;
                const jumpC = pos.col + dc * 2;
                const midR = pos.row + dr;
                const midC = pos.col + dc;

                if (!this.board.isOutOfBounds({ row: jumpR, col: jumpC })) {
                    const isMidDead = this.deadPieces.some(dp => dp.row === midR && dp.col === midC);
                    const midPiece = this.board.getPiece({ row: midR, col: midC });
                    const jumpSquare = this.board.getPiece({ row: jumpR, col: jumpC });

                    // Bicie dozwolone jeśli ofiara jest żywa i cel to puste pole
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

export = Game;