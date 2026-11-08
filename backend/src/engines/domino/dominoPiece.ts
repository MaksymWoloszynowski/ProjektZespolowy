type Orientation = 'horizontal' | 'vertical';
class DominoPiece {

    private readonly pips: [number, number];
    private readonly orientation: Orientation;
    private isFlipped: boolean = false;


    constructor(pips: [number, number], orientation: Orientation) {
        this.pips = pips;
        this.orientation = orientation;
    }

    // getter dla oczek domina
    public getPips(): [number, number] {
        return this.pips;
    }


    // Odwraca klocka (np. z [3, 5] na [5, 3]) jeśli jest to potrzebne przy dokładaniu
    public flip(): void {
        const temp: number = this.pips[0];
        this.pips[0] = this.pips[1];
        this.pips[1] = temp;
        this.isFlipped = !this.isFlipped;
    }

    // Sprawdza, czy klocek jest dublem (np. [6, 6])
    public isDouble(): boolean {
        return this.pips[0] === this.pips[1];
    }

    // Sprawdza, czy klocek posiada daną wartość na jednym ze swoich końców
    public hasValue(value: number): boolean {
        return this.pips[0] === value || this.pips[1] === value;
    }


}

export default DominoPiece;