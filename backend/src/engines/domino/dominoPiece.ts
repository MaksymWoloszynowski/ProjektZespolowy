class DominoPiece {
    private readonly pips: [number, number];

    constructor(pips: [number, number]) {
        this.pips = [pips[0], pips[1]];
    }

    // Zwraca kopię oczek domina, zabezpieczając przed zewnętrzną mutacją
    public getPips(): [number, number] {
        return [this.pips[0], this.pips[1]];
    }

    // Odwraca klocka (np. z [3, 5] na [5, 3]) jeśli jest to potrzebne przy dokładaniu
    public flip(): void {
        const temp: number = this.pips[0];
        this.pips[0] = this.pips[1];
        this.pips[1] = temp;
    }

    // Sprawdza, czy klocek jest dublem (np. [6, 6])
    public isDouble(): boolean {
        return this.pips[0] === this.pips[1];
    }

    // Sprawdza, czy klocek posiada daną wartość na jednym ze swoich końców
    public hasValue(value: number): boolean {
        return this.pips[0] === value || this.pips[1] === value;
    }

    // Sprawdza równość klocków bez względu na kolejność oczek ([3, 5] == [5, 3])
    public equals(other: DominoPiece): boolean {
        const [o1, o2] = other.getPips();
        return (this.pips[0] === o1 && this.pips[1] === o2) ||
               (this.pips[0] === o2 && this.pips[1] === o1);
    }

    // Suma oczek (waga klocka)
    public getWeight(): number {
        return this.pips[0] + this.pips[1];
    }
}

export default DominoPiece;
