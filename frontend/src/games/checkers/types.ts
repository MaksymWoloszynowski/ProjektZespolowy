
export type BoardType = (PieceType | null)[][];

export type PieceType = {
    color: "white" | "black"
    type: "normal" | "king"
    position: Position
}

export type Position = {
    row: number
    column: number
}
