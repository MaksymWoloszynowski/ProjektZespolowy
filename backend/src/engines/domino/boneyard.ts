import DominoPiece from "./dominoPiece.js";

class Boneyard {
    private dominoPieces: DominoPiece[];

    constructor() {
        this.dominoPieces = this.generatePieces();
    }

    public reset(): void {
        this.dominoPieces = this.generatePieces();
    }

    private generatePieces(): DominoPiece[] {
        const pieces: DominoPiece[] = [];

        for (let i = 0; i < 7; i++) {
            for (let j = 0; j <= i; j++) {
                pieces.push(new DominoPiece([j, i]));
            }
        }
        return pieces;
    }

    public shuffle(): void {
        for (let i = this.dominoPieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = this.dominoPieces[i]!;
            this.dominoPieces[i] = this.dominoPieces[j]!;
            this.dominoPieces[j] = temp;
        }
    }

    public drawPiece(): DominoPiece | undefined {
        return this.dominoPieces.pop();
    }

    public isEmpty(): boolean {
        return this.dominoPieces.length === 0;
    }
}

export default Boneyard;
