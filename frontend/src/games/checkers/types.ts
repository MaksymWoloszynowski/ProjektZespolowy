
export type BoardType = (string | null)[][];

export type SelectedPiece = {
    type: string | null
    position: Position
}

export type Position = {
    row: number
    column: number
}