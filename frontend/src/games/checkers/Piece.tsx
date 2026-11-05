import { useEffect, useState } from "react"
import type { Position, SelectedPiece } from "./types"

type PieceProps = {
    type: string | null
    position: Position
    selected: SelectedPiece | null
    setSelected: React.Dispatch<React.SetStateAction<SelectedPiece | null>>
}

export default function Piece({type, position, selected, setSelected}: PieceProps) {

    const [image, setImage] = useState<string>("checkers/white_piece.png")

    useEffect(() => {
        switch (type) {
            case "white":
                setImage("checkers/white_piece.png")
                break
            case "black":
                setImage("checkers/black_piece.png")
                break
            case "white_king":
                setImage("checkers/white_king.png")
                break
            case "black_king":
                setImage("checkers/black_king.png")
                break
            default:


        }

    }, [])

    function isSelected(r: number, c: number): boolean {
        return selected !== null && selected.position.row === r && selected.position.column === c;
    }

    function selectPiece(): void {
        if (selected && selected.position.column === position.column && selected.position.row === position.row) {
            setSelected(null)
            return
        }
        setSelected({type: type, position: position})
    }


    return (
        <img onClick={selectPiece} className={["piece", isSelected(position.row, position.column) && "selectedPiece" ].join(" ")} src={image} alt="Piece"></img>
    )
}