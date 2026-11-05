import { Link } from "react-router";
import GameWindow from "./GameWindow";

export default function GameSelect() {


    return (
        <div id="gameSelect">
            <Link to={"/checkers"}><GameWindow gameName="Warcaby" thumbnailName="chess_tmp.png" /></Link>
            <Link to={"/game2"}><GameWindow gameName="Domino" thumbnailName="" /></Link>
            <Link to={"/game3"}><GameWindow gameName="Kalambury" thumbnailName="" /></Link>
            <Link to={"/game4"}><GameWindow gameName="Gra4" thumbnailName="" /></Link>
            <Link to={"/game5"}><GameWindow gameName="Gra5" thumbnailName="" /></Link>
            <Link to={"/game6"}><GameWindow gameName="Gra6" thumbnailName="" /></Link>
        </div>
    )
}