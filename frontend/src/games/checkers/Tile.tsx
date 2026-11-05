import { useState } from "react"
import type { Position, PieceType } from "./types"

type TileProps = {
    position: Position
    selected: PieceType | null
    handleMove: (toPosition: Position) => void
    children: React.ReactNode;
}

export default function Tile({position, selected, handleMove, children}: TileProps) {

    const [hovered, setHovered] = useState<boolean>(false)

    function isSelected(r: number, c: number): boolean {
        return selected !== null && selected.position.row === r && selected.position.column === c;
    }

    function isValidMovePosition(): boolean {
        return selected !== null && (selected.position.column !== position.column || selected.position.row !== position.row) && (position.column + position.row) % 2 == 1
    }

    function handleClick(): void {
        if (isValidMovePosition()) {
            handleMove(position)
        }
    }

    return (
        <div onClick={handleClick} 
            onMouseEnter={() => {
                setHovered(true)
            }} 
            onMouseLeave={() => setHovered(false)} 
            className={["tile", isSelected(position.row, position.column) && "selectedTile", isValidMovePosition() && hovered && "highlightedTile" ].join(" ")} 
            style={{backgroundColor: (position.row + position.column) % 2 === 0 ? 'Beige' : 'SaddleBrown'}}>
            {children}
        </div>
    )
}