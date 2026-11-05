import { useEffect, useState } from "react";
import Board from "./Board";
import './checkers.css'
import type { PieceType, BoardType, Position } from "./types"

export default function CheckersSite() {

    
    const [selected, setSelected] = useState<PieceType | null>(null);

    // const [selectedMoves, setSelectedMoves] = useState<Position | null>(null);


    function createBoard(): BoardType {
        const board = Array.from({length: 8}, () => Array(8).fill(null))

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 == 1) {
                    board[row][col] = {color: "white", type: "normal", position: {row: row, column: col}}
                }

            }
        }

        for (let row = 5; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 == 1) {
                    board[row][col] = {color: "black", type: "normal", position: {row: row, column: col}}
                }

            }
        }


        return board


    }

    // function checkMoves(p: PieceType): void {
    //     legalMoves: Position[] = []

    //     switch (p.type) {
    //         case "normal":
    //             switch (p.color) {
    //                 case "white":

    //             }
    //         break;


    //     }


    // }

    // checkMoves będzie jeszcze do zmiany, narazie jest implementowany w ramach testu funkcjonalności

    function handleMove(toPosition: Position): void {

        if ((toPosition.column + toPosition.row) % 2 === 0) {
            return
        }

        const newBoardData: BoardType = boardData
        const movedPiece: PieceType | null = selected

        if (movedPiece === null) {
            return
        }
        
        newBoardData[movedPiece.position.row][movedPiece.position.column] = null

        movedPiece.position = toPosition

        newBoardData[toPosition.row][toPosition.column] = movedPiece

        setBoardData(newBoardData)
        setSelected(null)



    }
    
    const [boardData, setBoardData] = useState<BoardType>([])
    // useEffect, fetchuje informacje o planszy
    useEffect(() => {
        setBoardData(createBoard())
    }, [])

    return (
        <>
            <Board boardArray={boardData} selected={selected} setSelected={setSelected} handleMove={handleMove} />
        </>
    )
}