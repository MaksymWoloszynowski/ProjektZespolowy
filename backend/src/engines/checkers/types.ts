export type Player = 'WHITE' | 'BLACK';
export type PieceType = 'MAN' | 'KING';

export interface Position {
    row: number;
    col: number;
}

export interface Move {
    from: Position;
    to: Position;
    capturedPieces: Position[];
}