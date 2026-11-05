
type GameWindowProps = {
    gameName: string,
    thumbnailName: string
}

export default function GameWindow({gameName, thumbnailName}: GameWindowProps) {

    return (
        <div className="game_window">
            <img src={thumbnailName.length === 0 ? "no_game_tmp.png" : thumbnailName} alt="notLoaded" />
            <p>{gameName}</p>
        </div>
    )
}