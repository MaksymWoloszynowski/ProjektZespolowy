import type { Position, SelectedPiece } from "./types"

type TileProps = {
    position: Position
    selected: SelectedPiece | null
    children: React.ReactNode;
}

export default function Tile({position, selected, children}: TileProps) {

    function isSelected(r: number, c: number): boolean {
        return selected !== null && selected.position.row === r && selected.position.column === c;
    }

    return (
        <div className={["tile", isSelected(position.row, position.column) && "selectedTile" ].join(" ")} style={{backgroundColor: (position.row + position.column) % 2 === 0 ? 'Beige' : 'SaddleBrown'}}>
            {children}
        </div>
    )
}