import type { Position } from './types';
import Piece = require('./piece');

class Board {
    public readonly size = 8;
    private readonly grid: (Piece | null)[][];

    constructor() {
        this.grid = this.createEmptyGrid();
        this.initializePieces();
    }

    private createEmptyGrid(): (Piece | null)[][] {
        return Array.from({ length: this.size }, () =>
            Array(this.size).fill(null)
        );
    }

    private initializePieces(): void {
        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                if ((row + col) % 2 !== 0) {
                    if (row < 3) {
                        // Znak "!" informuje TS, że ten wiersz na pewno istnieje
                        this.grid[row]![col] = new Piece('BLACK');
                    } else if (row > 4) {
                        this.grid[row]![col] = new Piece('WHITE');
                    }
                }
            }
        }
    }

    public getPiece(pos: Position): Piece | null {
        if (this.isOutOfBounds(pos)) {
            return null;
        }
        // Używamy "!" na pos.row oraz zwracamy null jako fallback
        return this.grid[pos.row]![pos.col] ?? null;
    }

    public setPiece(pos: Position, piece: Piece | null): void {
        if (!this.isOutOfBounds(pos)) {
            // Używamy "!" aby wymusić zapis do tablicy
            this.grid[pos.row]![pos.col] = piece;
        }
    }

    public isOutOfBounds(pos: Position): boolean {
        return pos.row < 0 || pos.row >= this.size || pos.col < 0 || pos.col >= this.size;
    }

    public movePiece(from: Position, to: Position): void {
        const piece = this.getPiece(from);
        this.setPiece(from, null);
        this.setPiece(to, piece);
    }
}

export = Board;