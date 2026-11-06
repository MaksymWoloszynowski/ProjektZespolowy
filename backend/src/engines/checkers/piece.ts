import type { Player, PieceType } from './types.js';

class Piece {
  constructor(
    public player: Player,
    public type: PieceType = 'MAN',
  ) {}

  public promoteToKing(): void {
    this.type = 'KING';
  }

  public isKing(): boolean {
    return this.type === 'KING';
  }
}

export default Piece;
