import DominoPiece from "./dominoPiece.js";

class Player {
    private id: string;
    private name: string;
    private hand: DominoPiece[];
    private points: number;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
        this.hand = [];
        this.points = 0;
    }

    public getId(): string {
        return this.id;
    }

    public getName(): string {
        return this.name;
    }

    public getHand(): DominoPiece[] {
        return this.hand;
    }

    public getPoints(): number {
        return this.points;
    }

    public clearHand(): void {
        this.hand = [];
    }

    // Dodaje dobrany klocek do ręki gracza
    public addPieceToHand(piece: DominoPiece): void {
        this.hand.push(piece);
    }

    // Sprawdza, czy gracz posiada dany klocek w ręce
    public hasPiece(piece: DominoPiece): boolean {
        return this.hand.some(p => p.equals(piece));
    }

    // Usuwa i zwraca klocek z ręki gracza (gdy gracz go kładzie na stół)
    public removePieceFromHand(piece: DominoPiece): DominoPiece | null {
        const index = this.hand.findIndex(p => p.equals(piece));

        if (index === -1) {
            return null;
        }

        const removed = this.hand.splice(index, 1)[0];
        return removed ?? null;
    }

    // Zwraca sumę oczek (pipsów) wszystkich klocków w ręce
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
        bottomValue: number | null,
        mustBeDoubleOnEmptyBoard: boolean = false
    ): boolean {
        // Plansza jest całkowicie pusta
        if (leftValue === null && rightValue === null && topValue === null && bottomValue === null) {
            if (mustBeDoubleOnEmptyBoard) {
                return this.hand.some(p => p.isDouble());
            }
            return this.hand.length > 0;
        }

        // Szukamy klocka, który pasuje do jakiegokolwiek otwartego końca
        return this.hand.some(piece => {
            const matchesLeft = leftValue !== null && piece.hasValue(leftValue);
            const matchesRight = rightValue !== null && piece.hasValue(rightValue);
            const matchesTop = topValue !== null && piece.hasValue(topValue);
            const matchesBottom = bottomValue !== null && piece.hasValue(bottomValue);

            return matchesLeft || matchesRight || matchesTop || matchesBottom;
        });
    }

    // Dodaje punkty do ogólnego wyniku gracza po wygranej rundzie
    public addScore(pointsToAdd: number): void {
        this.points += pointsToAdd;
    }
}

export default Player;
