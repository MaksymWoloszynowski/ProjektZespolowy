import Piece from "./Piece";
import Tile from "./Tile";

import type { BoardType, SelectedPiece } from "./types"

type BoardProps = {
    boardArray: BoardType
    selected: SelectedPiece | null
    setSelected: React.Dispatch<React.SetStateAction<SelectedPiece | null>>
}

export default function Board({boardArray, selected, setSelected}: BoardProps) {


    return (
        <div id="board">
            {boardArray.map((row, rowIndex) => row.map((tile, colIndex) => (
                <Tile key={`${rowIndex}x${colIndex}`} position={{row: rowIndex, column: colIndex}} selected={selected} >
                    {tile !== null && <Piece type={tile} position={{row: rowIndex, column: colIndex}} selected={selected} setSelected={setSelected} />}
                </Tile>) ))}
        </div>
    )

}