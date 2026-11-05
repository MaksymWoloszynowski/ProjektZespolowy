import { useEffect, useState } from "react";
import Board from "./Board";
import './checkers.css'
import type { SelectedPiece, BoardType } from "./types"

export default function CheckersSite() {

    
    const [selected, setSelected] = useState<SelectedPiece | null>(null);


    function createBoard(): BoardType {
        const board = Array.from({length: 8}, () => Array(8).fill(null))

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 == 1) {
                    board[row][col] = "white"
                }

            }
        }

        for (let row = 5; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 == 1) {
                    board[row][col] = "black"
                }

            }
        }


        return board


    }

    
    const [boardData, setBoardData] = useState<BoardType>([])
    // useEffect, fetchuje informacje o planszy
    useEffect(() => {
        setBoardData(createBoard())
    }, [])

    return (
        <>
            <Board boardArray={boardData} selected={selected} setSelected={setSelected} />
        </>
    )
}