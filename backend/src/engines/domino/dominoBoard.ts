import DominoPiece from "./dominoPiece.js";

// Definiujemy nowy typ dla czytelności
export type PlacementSide = 'left' | 'right' | 'top' | 'bottom';

class DominoBoard {

    private grid: Map<string, DominoPiece> = new Map();

    // Wartości na 4 końcach planszy (null oznacza, że dany kierunek jest zamknięty/pusty)
    private leftValue: number | null = null;
    private rightValue: number | null = null;
    private topValue: number | null = null;
    private bottomValue: number | null = null;

    // Koordynaty następnego wolnego miejsca dla każdego kierunku
    private leftCoord: { x: number, y: number } | null = null;
    private rightCoord: { x: number, y: number } | null = null;
    private topCoord: { x: number, y: number } | null = null;
    private bottomCoord: { x: number, y: number } | null = null;

    // Flaga sprawdzająca, czy otworzyliśmy już "spinnera" (krzyżak na pierwszym dublu)
    private hasSpinner: boolean = false;

    public getLeftValue(): number | null {
        return this.leftValue;
    }

    // Zwraca wartość oczek na prawym końcu węża
    public getRightValue(): number | null {
        return this.rightValue;
    }

    // Zwraca wartość oczek na górnym końcu węża (jeśli aktywowano spinnera)
    public getTopValue(): number | null {
        return this.topValue;
    }

    // Zwraca wartość oczek na dolnym końcu węża (jeśli aktywowano spinnera)
    public getBottomValue(): number | null {
        return this.bottomValue;
    }


    // 1. Kładzie pierwszy klocek (dubel) na środku planszy (0,0)
    public placeFirstPiece(piece: DominoPiece): void {
        const [p1, p2] = piece.getPips();

        // Zapisujemy na środku
        this.grid.set("0,0", piece);

        // Otwieramy lewą i prawą stronę
        this.leftValue = p1;
        this.rightValue = p2;
        this.leftCoord = { x: -1, y: 0 };
        this.rightCoord = { x: 1, y: 0 };

        // Jeśli to dubel, otwieramy też GÓRĘ i DÓŁ (Spinner)
        if (piece.isDouble()) {
            this.hasSpinner = true;
            this.topValue = p1;
            this.bottomValue = p1;

            // Góra to ujemne Y, dół to dodatnie Y (zależy od Twojego systemu współrzędnych)
            this.topCoord = { x: 0, y: -1 };
            this.bottomCoord = { x: 0, y: 1 };
        }
    }

    // 2. Zwraca tablicę stron, do których można dołożyć klocek
    public getValidPlacements(piece: DominoPiece): PlacementSide[] {
        const validSides: PlacementSide[] = [];

        // Plansza jest pusta - błąd logiki gry (najpierw trzeba użyć placeFirstPiece)
        if (this.grid.size === 0) return validSides;

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

        // Jeśli p1 pasuje do lewego końca, to "p2" stanie się nowym wolnym lewym końcem.
        // Jeśli klocek byłby położony odwrotnie (p1 = 3, lewy = 3), musimy go wirtualnie obrócić.
        if (p1 === this.leftValue) {
            piece.flip();
        }

        // Po ewentualnym obrocie, ZAWSZE p1 jest teraz naszym nowym lewym wolnym końcem.
        this.leftValue = piece.getPips()[0];

        // Zapisujemy klocek na wolnym koordynacie
        const posKey = `${this.leftCoord.x},${this.leftCoord.y}`;
        this.grid.set(posKey, piece);

        // Przesuwamy lewy koordynat jeszcze bardziej w lewo
        this.leftCoord.x -= 1;
    }

    // 4. Dokłada klocek do PRAWEGO końca
    public playOnRightEnd(piece: DominoPiece): void {
        if (this.rightValue === null || this.rightCoord === null) return;

        const [_, p2] = piece.getPips();

        // Po prawej stronie wąż rośnie w prawo. p1 przylega do planszy, a p2 staje się nowym końcem.
        // Jeśli p2 pasuje do planszy, obracamy klocek.
        if (p2 === this.rightValue) {
            piece.flip();
        }

        this.rightValue = piece.getPips()[1];

        const posKey = `${this.rightCoord.x},${this.rightCoord.y}`;
        this.grid.set(posKey, piece);

        // Przesuwamy prawy koordynat w prawo
        this.rightCoord.x += 1;
    }

    // --- FUNKCJE DLA GÓRY I DOŁU ---

    public playOnTopEnd(piece: DominoPiece): void {
        if (this.topValue === null || this.topCoord === null) return;

        const [p1, _] = piece.getPips();
        if (p1 === this.topValue) piece.flip();

        this.topValue = piece.getPips()[0];

        this.grid.set(`${this.topCoord.x},${this.topCoord.y}`, piece);
        this.topCoord.y -= 1; // Zmniejszamy Y, bo idziemy w górę
    }

    public playOnBottomEnd(piece: DominoPiece): void {
        if (this.bottomValue === null || this.bottomCoord === null) return;

        const [_, p2] = piece.getPips();
        if (p2 === this.bottomValue) piece.flip();

        this.bottomValue = piece.getPips()[1];

        this.grid.set(`${this.bottomCoord.x},${this.bottomCoord.y}`, piece);
        this.bottomCoord.y += 1; // Zwiększamy Y, bo idziemy w dół
    }
}

export default DominoBoard;