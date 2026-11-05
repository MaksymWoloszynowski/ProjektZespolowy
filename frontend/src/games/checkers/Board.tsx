import Piece from "./Piece";
import Tile from "./Tile";

import type { BoardType, PieceType, Position } from "./types"

type BoardProps = {
    boardArray: BoardType
    selected: PieceType | null
    setSelected: React.Dispatch<React.SetStateAction<PieceType | null>>
    handleMove: (toPosition: Position) => void
}

export default function Board({boardArray, selected, setSelected, handleMove}: BoardProps) {


    return (
        <div id="board">
            {boardArray.map((row, rowIndex) => row.map((tile, colIndex) => (
                <Tile key={`${rowIndex}x${colIndex}`} position={{row: rowIndex, column: colIndex}} selected={selected} handleMove={handleMove} >
                    {tile !== null && <Piece piece={tile} selected={selected} setSelected={setSelected} />}
                </Tile>) ))}
        </div>
    )

}