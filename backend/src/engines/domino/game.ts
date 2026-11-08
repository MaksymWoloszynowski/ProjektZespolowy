import Player from "./player.js";
import Boneyard from "./boneyard.js";
import DominoBoard, { PlacementSide } from "./dominoBoard.js";
import DominoPiece from "./dominoPiece.js";

export type GameStatus = 'waiting' | 'playing' | 'roundOver' | 'gameOver';

export interface ActionResult {
    ok: boolean;
    reason?: string;
}

class Game {
    private boneyard: Boneyard;
    private winner: Player | null;
    private players: Player[];
    private currentPlayer: Player | null;
    private pointsToWin: number;
    private dominoBoard: DominoBoard;
    private status: GameStatus = 'waiting';
    private consecutivePasses: number = 0;
    private roundFirstPieceMustBeDouble: boolean = false;

    constructor(players: Player[], pointsToWin: number = 100) {
        this.boneyard = new Boneyard();
        this.players = players;
        this.pointsToWin = pointsToWin;
        this.winner = null;
        this.currentPlayer = null;
        this.dominoBoard = new DominoBoard();
    }

    public getStatus(): GameStatus {
        return this.status;
    }

    public getCurrentPlayer(): Player | null {
        return this.currentPlayer;
    }

    public getWinner(): Player | null {
        return this.winner;
    }

    public getBoard(): DominoBoard {
        return this.dominoBoard;
    }

    public getBoneyard(): Boneyard {
        return this.boneyard;
    }

    // Inicjalizuje i rozpoczyna całą partię gry
    public startGame(): ActionResult {
        if (this.players.length < 2 || this.players.length > 4) {
            return { ok: false, reason: 'Gra w domino wymaga od 2 do 4 graczy' };
        }

        this.winner = null;
        this.startNewRound();
        return { ok: true };
    }

    // Rozpoczyna nową rundę (resetuje stół, tasuje klocki, rozdaje ręce)
    public startNewRound(): void {
        this.dominoBoard.reset();
        this.boneyard.reset();
        this.boneyard.shuffle();
        this.consecutivePasses = 0;

        for (const player of this.players) {
            player.clearHand();
        }

        this.dealInitialPieces();
        this.currentPlayer = this.determineFirstPlayer();
        this.status = 'playing';
    }

    // Tasuje klocki i rozdaje każdemu graczowi początkową pulę:
    // 2 graczy -> po 7 klocków
    // 3 lub 4 graczy -> po 5 klocków (standard w Double-Six)
    public dealInitialPieces(): void {
        const piecesPerPlayer = this.players.length === 2 ? 7 : 5;

        for (let i = 0; i < piecesPerPlayer; i++) {
            for (const player of this.players) {
                const piece = this.boneyard.drawPiece();
                if (piece) {
                    player.addPieceToHand(piece);
                }
            }
        }
    }

    // Ustala gracza rozpoczynającego:
    // 1. Gracz z najwyższym dublem ([6,6], [5,5], itd.)
    // 2. Jeśli nikt nie ma dubla -> gracz z klockiem o najwyższej sumie oczek (np. [6,5])
    public determineFirstPlayer(): Player | null {
        let bestDoublePlayer: Player | null = null;
        let highestDoubleVal = -1;

        for (const player of this.players) {
            for (const piece of player.getHand()) {
                if (piece.isDouble() && piece.getPips()[0] > highestDoubleVal) {
                    highestDoubleVal = piece.getPips()[0];
                    bestDoublePlayer = player;
                }
            }
        }

        if (bestDoublePlayer) {
            this.roundFirstPieceMustBeDouble = true;
            return bestDoublePlayer;
        }

        // Gdy żaden gracz nie posiada dubla
        this.roundFirstPieceMustBeDouble = false;
        let bestPlayer: Player | null = null;
        let highestWeight = -1;
        let highestSinglePip = -1;

        for (const player of this.players) {
            for (const piece of player.getHand()) {
                const weight = piece.getWeight();
                const maxPip = Math.max(piece.getPips()[0], piece.getPips()[1]);

                if (weight > highestWeight || (weight === highestWeight && maxPip > highestSinglePip)) {
                    highestWeight = weight;
                    highestSinglePip = maxPip;
                    bestPlayer = player;
                }
            }
        }

        return bestPlayer ?? this.players[0] ?? null;
    }

    // Główna funkcja wykonująca ruch gracza (położenie klocka na stole)
    public playTurn(piece: DominoPiece, side: PlacementSide): ActionResult {
        if (this.status !== 'playing') {
            return { ok: false, reason: 'Gra nie jest w stanie aktywnym' };
        }

        if (!this.currentPlayer) {
            return { ok: false, reason: 'Brak aktywnego gracza' };
        }

        // 1. Sprawdzamy, czy gracz faktycznie posiada ten klocek w ręce
        if (!this.currentPlayer.hasPiece(piece)) {
            return { ok: false, reason: 'Gracz nie posiada tego klocka w ręce' };
        }

        // 2. Obsługa pierwszego ruchu na pustej planszy
        if (this.dominoBoard.isEmpty()) {
            if (this.roundFirstPieceMustBeDouble && !piece.isDouble()) {
                return { ok: false, reason: 'Pierwszy ruch w tej rundzie musi być dublem' };
            }

            this.dominoBoard.placeFirstPiece(piece);
            this.currentPlayer.removePieceFromHand(piece);
            this.consecutivePasses = 0;

            if (this.checkRoundEnd()) {
                this.finishRound();
            } else {
                this.nextPlayerTurn();
            }

            return { ok: true };
        }

        // 3. Sprawdzamy poprawność dołożenia do istniejącego łańcucha
        const validMoves: PlacementSide[] = this.dominoBoard.getValidPlacements(piece);
        const isLegalMove: boolean = validMoves.includes(side);

        if (!isLegalMove) {
            return { ok: false, reason: 'Nielegalny ruch - klocek nie pasuje do wybranego końca' };
        }

        switch (side) {
            case "left":
                this.dominoBoard.playOnLeftEnd(piece);
                break;
            case "right":
                this.dominoBoard.playOnRightEnd(piece);
                break;
            case "top":
                this.dominoBoard.playOnTopEnd(piece);
                break;
            case "bottom":
                this.dominoBoard.playOnBottomEnd(piece);
                break;
        }

        // Usuwamy klocek z ręki gracza dopiero po pomyślnym położeniu
        this.currentPlayer.removePieceFromHand(piece);
        this.consecutivePasses = 0;

        if (this.checkRoundEnd()) {
            this.finishRound();
        } else {
            this.nextPlayerTurn();
        }

        return { ok: true };
    }

    // Wywoływane, gdy gracz nie ma pasującego klocka i dobiera z Boneyarda
    public drawFromBoneyard(player: Player): ActionResult {
        if (this.status !== 'playing') {
            return { ok: false, reason: 'Gra nie jest w stanie aktywnym' };
        }

        if (this.currentPlayer !== player) {
            return { ok: false, reason: 'To nie jest tura tego gracza' };
        }

        // Gracz nie może dobierać, jeśli posiada legalny ruch
        const canMove = player.canMakeMove(
            this.dominoBoard.getLeftValue(),
            this.dominoBoard.getRightValue(),
            this.dominoBoard.getTopValue(),
            this.dominoBoard.getBottomValue(),
            this.roundFirstPieceMustBeDouble
        );

        if (canMove) {
            return { ok: false, reason: 'Gracz posiada legalny ruch i nie może dobierać klocka' };
        }

        const drawnPiece: DominoPiece | undefined = this.boneyard.drawPiece();
        if (!drawnPiece) {
            return { ok: false, reason: 'Talon (boneyard) jest pusty' };
        }

        player.addPieceToHand(drawnPiece);
        return { ok: true };
    }

    // Pasowanie tury: dozwolone tylko gdy gracz nie ma ruchu i nie ma już klocków w talonie
    public passTurn(player: Player): ActionResult {
        if (this.status !== 'playing') {
            return { ok: false, reason: 'Gra nie jest w stanie aktywnym' };
        }

        if (this.currentPlayer !== player) {
            return { ok: false, reason: 'To nie jest tura tego gracza' };
        }

        const canMove = player.canMakeMove(
            this.dominoBoard.getLeftValue(),
            this.dominoBoard.getRightValue(),
            this.dominoBoard.getTopValue(),
            this.dominoBoard.getBottomValue(),
            this.roundFirstPieceMustBeDouble
        );

        if (canMove) {
            return { ok: false, reason: 'Gracz posiada legalny ruch i nie może spasować' };
        }

        if (!this.boneyard.isEmpty()) {
            return { ok: false, reason: 'Gracz musi dobrać klocek z talonu przed spasowaniem' };
        }

        this.consecutivePasses++;

        if (this.checkRoundEnd()) {
            this.finishRound();
        } else {
            this.nextPlayerTurn();
        }

        return { ok: true };
    }

    // Przesuwa turę na kolejnego gracza
    public nextPlayerTurn(): void {
        if (this.players.length === 0) return;

        const currentIndex: number = this.players.findIndex(p => p === this.currentPlayer);
        const nextIndex: number = (currentIndex + 1) % this.players.length;
        this.currentPlayer = this.players[nextIndex] ?? null;
    }

    // Sprawdza warunki zakończenia rundy
    public checkRoundEnd(): boolean {
        // 1. Ktoś wyłożył wszystkie klocki z ręki
        const someoneEmptiedHand = this.players.some(p => p.getHand().length === 0);
        if (someoneEmptiedHand) {
            return true;
        }

        // 2. Gra została zablokowana (wszyscy gracze spasowali pod rząd)
        if (this.consecutivePasses >= this.players.length) {
            return true;
        }

        // 3. Talon jest pusty i żaden gracz nie ma już żadnego możliwego ruchu
        if (this.boneyard.isEmpty()) {
            const left = this.dominoBoard.getLeftValue();
            const right = this.dominoBoard.getRightValue();
            const top = this.dominoBoard.getTopValue();
            const bottom = this.dominoBoard.getBottomValue();

            const canAnyoneMove = this.players.some(p =>
                p.canMakeMove(left, right, top, bottom, this.roundFirstPieceMustBeDouble)
            );

            if (!canAnyoneMove) {
                return true;
            }
        }

        return false;
    }

    // Zakończenie rundy i podliczenie punktów
    private finishRound(): void {
        this.calculateRoundScores();

        if (this.checkGameWin()) {
            this.status = 'gameOver';
        } else {
            this.status = 'roundOver';
        }
    }

    // Oblicza punkty z rąk przegranych i dodaje je zwycięzcy rundy
    public calculateRoundScores(): void {
        let lowestPoints = Infinity;

        // Szukamy minimalnej liczby punktów w rękach
        for (const player of this.players) {
            const points = player.getHandPoints();
            if (points < lowestPoints) {
                lowestPoints = points;
            }
        }

        // Wszyscy gracze z minimalną liczbą punktów
        const bestPlayers = this.players.filter(p => p.getHandPoints() === lowestPoints);

        // Remis przy blokadzie gry (dwóch lub więcej graczy ma tyle samo minimalnych punktów)
        if (bestPlayers.length > 1) {
            // Zgodnie z zasadami: w przypadku remisu żaden gracz nie otrzymuje punktów
            return;
        }

        const roundWinner = bestPlayers[0];
        if (!roundWinner) return;

        // Suma punktów ze wszystkich rąk minus punkty zwycięzcy
        const totalOtherPoints = this.players.reduce((acc, p) => {
            return p === roundWinner ? acc : acc + p.getHandPoints();
        }, 0);

        roundWinner.addScore(totalOtherPoints);

        // Sprawdzamy wygraną w całej partii
        const gameWinner = this.players.find(p => p.getPoints() >= this.pointsToWin);
        if (gameWinner) {
            this.winner = gameWinner;
        }
    }

    // Sprawdza, czy ktoś osiągnął punktację wygrywającą grę (pointsToWin)
    public checkGameWin(): boolean {
        const reached = this.players.some(player => player.getPoints() >= this.pointsToWin);
        if (reached) {
            let topPlayer: Player | null = null;
            let maxScore = -1;
            for (const p of this.players) {
                if (p.getPoints() > maxScore) {
                    maxScore = p.getPoints();
                    topPlayer = p;
                }
            }
            this.winner = topPlayer;
        }
        return reached;
    }
}

export default Game;
