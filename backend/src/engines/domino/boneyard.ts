import DominoPiece from "./dominoPiece.js";

class Boneyard {

    private readonly dominoPieces: DominoPiece[];

    constructor() {
        this.dominoPieces = this.generatePieces();
    }

    private generatePieces(): DominoPiece[] {
        let pieces: DominoPiece[] = [];

        for (let i = 0; i < 7; i++) {
            for (let j = 0; j <= i; j++) {
                if (i === j) {
                    let piece: DominoPiece = new DominoPiece([i,j], "vertical");
                    pieces.push(piece);
                }
                else {
                    let piece: DominoPiece = new DominoPiece([i,j], "horizontal");
                    pieces.push(piece);
                }
            }
        }
        return pieces
    }

    public getPieces(): DominoPiece[] {
        return this.dominoPieces;
    }


    public shuffle(): void {
        for (let i = this.dominoPieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.dominoPieces[i], this.dominoPieces[j]] = [this.dominoPieces[j], this.dominoPieces[i]];
        }
    }

    public drawPiece(): DominoPiece | undefined {
        return this.dominoPieces.pop();
    }

    public isEmpty(): boolean {
        return this.dominoPieces.length === 0;
    }

    public getRemainingCount(): number {
        return this.dominoPieces.length;
    }

}

export default Boneyard;