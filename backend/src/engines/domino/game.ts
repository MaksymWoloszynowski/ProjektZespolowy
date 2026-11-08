import Player from "./player.js";
import Boneyard from "./boneyard.js";
import DominoBoard from "./dominoBoard.js";
import DominoPiece from "./dominoPiece.js";

type GameStatus = 'waiting' | 'playing' | 'roundOver' | 'gameOver';

class Game {

    private boneyard: Boneyard;
    private winner: Player | null;
    private players: Player[];
    private currentPlayer: Player | null;
    private pointsToWin: number;
    private dominoBoard: DominoBoard;
    private status: GameStatus = 'waiting';


    constructor(players: Player[], pointsToWin: number) {
        this.boneyard = new Boneyard();
        this.players = players;
        this.pointsToWin = pointsToWin;
        this.winner = null;
        this.currentPlayer = null;
        this.dominoBoard = new DominoBoard();
    }


    // Tasuje klocki i rozdaje każdemu graczowi początkową pulę (np. 7 klocków)
    public dealInitialPieces(): void {
        this.boneyard.shuffle();
        for (let i = 0; i < 7; i++) {
            this.players.forEach(player => {
                const piece = this.boneyard.drawPiece();
                if (piece) {
                  player.addPieceToHand(piece);
                }
            })
        }

    }

    // Sprawdza ręce graczy i ustala, kto ma najwyższy dubel (lub po prostu kto zaczyna)
    public determineFirstPlayer(): Player | null {
        const mapOfDoubles: Map<Player, DominoPiece> = new Map();

        this.players.forEach(player => {
            const hand: DominoPiece[] = player.getHand();

            const playerDoubles: DominoPiece[] = hand.filter(piece => piece.isDouble());

            const sortedDoubles = playerDoubles.sort((double1: DominoPiece, double2: DominoPiece) => {
                return double2.getPips()[0] - double1.getPips()[0];
            });

            if (sortedDoubles.length !== 0) {
                mapOfDoubles.set(player, sortedDoubles[0]);
            }
        });

        if (mapOfDoubles.size === 0) {
            // Nikt nie ma dubla. W zależności od zasad można tu zwrócić null
            // i kazać graczom dobierać z boneyarda, aż ktoś wylosuje dubla.
            return null;
        }
        else {
            // Zmienne do śledzenia gracza z absolutnie najwyższym dublem
            let startingPlayer: Player | null = null;
            let highestValue = -1;

            // Przeszukujemy naszą mapę, aby znaleźć zwycięzcę
            mapOfDoubles.forEach((piece, player) => {
                const value = piece.getPips()[0];

                if (value > highestValue) {
                    highestValue = value;
                    startingPlayer = player;
                }
            });
            return startingPlayer;
        }
    }

    // Główna funkcja wykonująca ruch gracza (położenie klocka na stole)
    public playTurn(piece: DominoPiece, side: 'left' | 'right'): void {}

    // Wywoływane, gdy gracz nie ma pasującego klocka i musi dobrać z Boneyard
    public drawFromBoneyard(player: Player): boolean {
        const drawedPiece: DominoPiece | undefined = this.boneyard.drawPiece();

        if (!drawedPiece) {
            return false;
        }

        player.addPieceToHand(drawedPiece);
        return true;
    }

    // Przesuwa turę na kolejnego gracza w tablicy
    public nextPlayerTurn(): void {
        const indexOfCurrentPlayer: number = this.players
            .findIndex(player => player === this.currentPlayer)

        const indexOfNextPlayer: number = (indexOfCurrentPlayer + 1) % this.players.length;

        this.currentPlayer = this.players[indexOfNextPlayer];
    }

    // Sprawdza warunki zakończenia rundy (ktoś pozbył się klocków ALBO gra jest zablokowana - nikt nie ma ruchu i boneyard jest pusty)
    public checkRoundEnd(): boolean {

        // Warunek 1: Ktoś wyłożył wszystkie klocki z ręki
        const isAnyPlayerWithoutPieces: boolean = this.players
            .some(player => player.getHand().length === 0);

        if (isAnyPlayerWithoutPieces) {
            return true; // Koniec rundy!
        }

        // Warunek 2: Zablokowana gra
        // a) Sprawdzamy, czy w ogóle można jeszcze coś dobrać
        const isBoneyardEmpty: boolean = this.boneyard.isEmpty();

        // Jeśli talon nie jest pusty, to na pewno ktoś będzie mógł dobrać klocek, więc gra trwa
        if (!isBoneyardEmpty) {
            return false;
        }

        // b) Talon jest pusty. Musimy sprawdzić, czy ktokolwiek może zrobić ruch.
        // UWAGA: Wymaga dopisania getterów w klasie DominoBoard!
        const leftValue = this.dominoBoard.getLeftValue();
        const rightValue = this.dominoBoard.getRightValue();
        const topValue = this.dominoBoard.getTopValue();
        const bottomValue = this.dominoBoard.getBottomValue();

        // Metoda .some() sprawdzi, czy ISTNIEJE CHOCIAŻ JEDEN gracz, który może wykonać ruch
        const canAnyoneMove: boolean = this.players.some(player =>
            player.canMakeMove(leftValue, rightValue, topValue, bottomValue)
        );

        return !canAnyoneMove;
    }

    // Oblicza punkty z rąk przegranych i dodaje je zwycięzcy rundy
    public calculateRoundScores(): void {
        let winner: any; //Player | null = null
        let lowestPoints = Infinity;

        // 1. Szukamy gracza z najmniejszą liczbą punktów w ręce
        this.players.forEach(player => {
            const points = player.getHandPoints();
            if (points < lowestPoints) {
                lowestPoints = points;
                winner = player;
            }
            // Opcjonalnie: Jeśli dwóch ma tyle samo najmniej (remis przy blokadzie),
            // można tu dodać logikę braku punktów w rundzie, ale najprościej uznać pierwszego za wygranego.
        });

        if (!winner) return; // Zabezpieczenie (nigdy nie powinno wystąpić)

        // 2. Liczymy SUMĘ PUNKTÓW Z RĄK WSZYSTKICH GRACZY
        const totalPoints = this.players.reduce((acc, player) => acc + player.getHandPoints(), 0);

        // 3. Wynik zwycięzcy to suma wszystkich klocków MINUS jego własne klocki.
        // (Jeśli miał 0 klocków, odejmie 0. Jeśli wygrał blokadą mając 5 punktów, odejmie swoje 5).
        const winningScore = totalPoints - winner.getHandPoints();

        // 4. Dodajemy punkty
        winner.addScore(winningScore);

        console.log(`Rundę wygrywa gracz zdobywając ${winningScore} punktów!`);
    }
    // Sprawdza, czy ktoś osiągnął punktację wygrywającą grę (pointsToWin)
    public checkGameWin(): boolean {
        return this.players.some(player => player.getPoints() >= this.pointsToWin);
    }
}