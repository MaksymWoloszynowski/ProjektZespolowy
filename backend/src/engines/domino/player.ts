import DominoPiece from "./dominoPiece.js";

class Player {
    private id: string;
    private name: string
    private hand: DominoPiece[];
    private points: number;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
        this.hand = [];
        this.points = 0;
    }

    public getHand(): DominoPiece[] {
        return this.hand;
    }

    public getPoints(): number {
        return this.points;
    }

    // Dodaje dobrany klocek do ręki gracza
    public addPieceToHand(piece: DominoPiece): void {
        this.hand.push(piece);
    }

    // Usuwa i zwraca klocek z ręki gracza (gdy gracz go kładzie na stół)
    public removePieceFromHand(piece: DominoPiece): DominoPiece | null {

        const index = this.hand.findIndex(p => {
            const [p1, p2] = p.getPips();
            const [piece1, piece2] = piece.getPips();
            return (p1 === piece1 && p2 === piece2) || (p1 === piece2 && p2 === piece1);
        });

        if (index === -1) {
            return null;
        }

        return this.hand.splice(index, 1)[0];
    }

    // Zwraca sumę oczek (pipsów) wszystkich klocków w ręce (potrzebne do liczenia punktów na koniec rundy)
    public getHandPoints(): number {
        return this.hand.reduce((acc, piece) => {
            const [p1, p2] = piece.getPips();
            return acc + p1 + p2;
        }, 0);
    }

    // Sprawdza, czy gracz posiada jakikolwiek klocek pasujący do wartości na stole
    public canMakeMove(
        leftValue: number | null,
        rightValue: number | null,
        topValue: number | null,
        bottomValue: number | null
    ): boolean {

        // 1. Jeśli plansza jest całkowicie pusta (wszystkie końce to null),
        // gracz może wykonać ruch, o ile ma jakiekolwiek klocki w ręce.
        if (leftValue === null && rightValue === null && topValue === null && bottomValue === null) {
            return this.hand.length > 0;
        }

        // 2. Szukamy klocka, który pasuje do JAKIEGOKOLWIEK otwartego końca
        return this.hand.some(piece => {
            const matchesLeft = leftValue !== null && piece.hasValue(leftValue);
            const matchesRight = rightValue !== null && piece.hasValue(rightValue);
            const matchesTop = topValue !== null && piece.hasValue(topValue);
            const matchesBottom = bottomValue !== null && piece.hasValue(bottomValue);

            // Gracz może wykonać ruch, jeśli klocek pasuje z lewej, prawej, góry LUB dołu
            return matchesLeft || matchesRight || matchesTop || matchesBottom;
        });
    }

    // Dodaje punkty do ogólnego wyniku gracza po wygranej rundzie
    public addScore(pointstoAdd: number): void {
        this.points += pointstoAdd;
    }

}


export default Player;