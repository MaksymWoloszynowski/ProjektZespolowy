import { useEffect, useState } from "react"
import type { PieceType } from "./types"

type PieceProps = {
    piece: PieceType
    selected: PieceType | null
    setSelected: React.Dispatch<React.SetStateAction<PieceType | null>>
}

export default function Piece({piece, selected, setSelected}: PieceProps) {

    const [image, setImage] = useState<string>("checkers/white_piece.png")

    useEffect(() => {
        if (piece.color === "white" && piece.type === "normal") {
            setImage("checkers/white_piece.png")
        } else if (piece.color === "black" && piece.type === "normal") {
            setImage("checkers/black_piece.png")
        } else if (piece.color === "white" && piece.type === "king") {
            setImage("checkers/white_king.png")
        } else if (piece.color === "black" && piece.type === "king") {
            setImage("checkers/black_king.png")
        }

    }, [])

    function isSelected(r: number, c: number): boolean {
        return selected !== null && selected.position.row === r && selected.position.column === c;
    }

    function selectPiece(): void {
        if (isSelected(piece.position.row, piece.position.column)) {
            setSelected(null)
            return
        }
        setSelected(piece)
    }


    return (
        <img onClick={selectPiece} className={["piece", isSelected(piece.position.row, piece.position.column) && "selectedPiece" ].join(" ")} src={image} alt="Piece"></img>
    )
}