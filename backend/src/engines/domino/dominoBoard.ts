import DominoPiece from "./dominoPiece.js";

// Typ dla stron dołożenia klocka
export type PlacementSide = 'left' | 'right' | 'top' | 'bottom';

class DominoBoard {
    private grid: Map<string, DominoPiece> = new Map();

    // Wartości na 4 końcach planszy (null oznacza, że dany kierunek jest zamknięty/pusty)
    private leftValue: number | null = null;
    private rightValue: number | null = null;
    private topValue: number | null = null;
    private bottomValue: number | null = null;

    // Koordynaty następnego wolnego miejsca dla każdego kierunku
    private leftCoord: { x: number; y: number } | null = null;
    private rightCoord: { x: number; y: number } | null = null;
    private topCoord: { x: number; y: number } | null = null;
    private bottomCoord: { x: number; y: number } | null = null;

    public reset(): void {
        this.grid.clear();
        this.leftValue = null;
        this.rightValue = null;
        this.topValue = null;
        this.bottomValue = null;
        this.leftCoord = null;
        this.rightCoord = null;
        this.topCoord = null;
        this.bottomCoord = null;
    }

    public getLeftValue(): number | null {
        return this.leftValue;
    }

    public getRightValue(): number | null {
        return this.rightValue;
    }

    public getTopValue(): number | null {
        return this.topValue;
    }

    public getBottomValue(): number | null {
        return this.bottomValue;
    }

    public isEmpty(): boolean {
        return this.grid.size === 0;
    }

    // 1. Kładzie pierwszy klocek na środku planszy (0,0)
    public placeFirstPiece(piece: DominoPiece): void {
        const [p1, p2] = piece.getPips();

        // Zapisujemy na środku
        this.grid.set("0,0", piece);

        // Otwieramy lewą i prawą stronę
        this.leftValue = p1;
        this.rightValue = p2;
        this.leftCoord = { x: -1, y: 0 };
        this.rightCoord = { x: 1, y: 0 };

        // Jeśli to dubel, aktywujemy Spinnera i otwieramy też GÓRĘ i DÓŁ
        if (piece.isDouble()) {
            this.topValue = p1;
            this.bottomValue = p1;
            this.topCoord = { x: 0, y: -1 };
            this.bottomCoord = { x: 0, y: 1 };
        }
    }

    // 2. Zwraca tablicę stron, do których można dołożyć dany klocek
    public getValidPlacements(piece: DominoPiece): PlacementSide[] {
        const validSides: PlacementSide[] = [];

        // Gdy plansza jest pusta, pierwszy klocek kładziemy na środku (strona 'left' jako domyślny punkt wejścia)
        if (this.grid.size === 0) {
            return ['left'];
        }

        if (this.leftValue !== null && piece.hasValue(this.leftValue)) validSides.push('left');
        if (this.rightValue !== null && piece.hasValue(this.rightValue)) validSides.push('right');
        if (this.topValue !== null && piece.hasValue(this.topValue)) validSides.push('top');
        if (this.bottomValue !== null && piece.hasValue(this.bottomValue)) validSides.push('bottom');

        return validSides;
    }

    // 3. Dokłada klocek do LEWEGO końca
    public playOnLeftEnd(piece: DominoPiece): void {
        if (this.leftValue === null || this.leftCoord === null) return;

        const [p1, _] = piece.getPips();

        // Jeśli p1 pasuje do lewego końca, to p2 przylega do planszy, a p1 po odwróceniu staje się nowym lewym końcem
        if (p1 === this.leftValue) {
            piece.flip();
        }

        this.leftValue = piece.getPips()[0];

        const posKey = `${this.leftCoord.x},${this.leftCoord.y}`;
        this.grid.set(posKey, piece);

        this.leftCoord.x -= 1;
    }

    // 4. Dokłada klocek do PRAWEGO końca
    public playOnRightEnd(piece: DominoPiece): void {
        if (this.rightValue === null || this.rightCoord === null) return;

        const [_, p2] = piece.getPips();

        // Jeśli p2 pasuje do prawego końca, obracamy, by p1 przylegało do planszy, a p2 było nowym prawym końcem
        if (p2 === this.rightValue) {
            piece.flip();
        }

        this.rightValue = piece.getPips()[1];

        const posKey = `${this.rightCoord.x},${this.rightCoord.y}`;
        this.grid.set(posKey, piece);

        this.rightCoord.x += 1;
    }

    // 5. Dokłada klocek do GÓRNEGO końca (Spinner)
    public playOnTopEnd(piece: DominoPiece): void {
        if (this.topValue === null || this.topCoord === null) return;

        const [p1, _] = piece.getPips();
        if (p1 === this.topValue) piece.flip();

        this.topValue = piece.getPips()[0];

        this.grid.set(`${this.topCoord.x},${this.topCoord.y}`, piece);
        this.topCoord.y -= 1;
    }

    // 6. Dokłada klocek do DOLNEGO końca (Spinner)
    public playOnBottomEnd(piece: DominoPiece): void {
        if (this.bottomValue === null || this.bottomCoord === null) return;

        const [_, p2] = piece.getPips();
        if (p2 === this.bottomValue) piece.flip();

        this.bottomValue = piece.getPips()[1];

        this.grid.set(`${this.bottomCoord.x},${this.bottomCoord.y}`, piece);
        this.bottomCoord.y += 1;
    }
}

export default DominoBoard;
