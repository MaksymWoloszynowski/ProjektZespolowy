import { describe, it, expect, beforeEach } from 'vitest';
import Game from '../../../src/engines/domino/game.js';
import Player from '../../../src/engines/domino/player.js';
import DominoPiece from '../../../src/engines/domino/dominoPiece.js';
import DominoBoard from '../../../src/engines/domino/dominoBoard.js';
import DominoEngine from '../../../src/engines/domino/dominoEngine.js';

describe('Domino Domain Logic (Game, Board, Player)', () => {
  let player1: Player;
  let player2: Player;
  let game: Game;

  beforeEach(() => {
    player1 = new Player('p1', 'Alice');
    player2 = new Player('p2', 'Bob');
    game = new Game([player1, player2], 50);
  });

  describe('Inicjalizacja gry i rozdanie', () => {
    it('powinna wymagać od 2 do 4 graczy', () => {
      const singlePlayerGame = new Game([player1]);
      expect(singlePlayerGame.startGame().ok).toBe(false);

      const fivePlayerGame = new Game([
        player1,
        player2,
        new Player('p3', 'Charlie'),
        new Player('p4', 'David'),
        new Player('p5', 'Eve'),
      ]);
      expect(fivePlayerGame.startGame().ok).toBe(false);
    });

    it('powinna rozdać po 7 klocków dla 2 graczy i ustalić pierwszego gracza', () => {
      const res = game.startGame();
      expect(res.ok).toBe(true);
      expect(player1.getHand().length).toBe(7);
      expect(player2.getHand().length).toBe(7);
      expect(game.getCurrentPlayer()).not.toBeNull();
      expect(game.getStatus()).toBe('playing');
    });

    it('powinna wybrać gracza z najwyższym dublem jako rozpoczynającego', () => {
      player1.clearHand();
      player2.clearHand();

      player1.addPieceToHand(new DominoPiece([3, 3]));
      player1.addPieceToHand(new DominoPiece([1, 2]));

      player2.addPieceToHand(new DominoPiece([5, 5]));
      player2.addPieceToHand(new DominoPiece([0, 1]));

      const starting = game.determineFirstPlayer();
      expect(starting).toBe(player2);
    });

    it('powinna wybrać gracza z najcięższym klockiem, gdy żaden gracz nie ma dubla', () => {
      player1.clearHand();
      player2.clearHand();

      player1.addPieceToHand(new DominoPiece([6, 5])); // suma 11
      player2.addPieceToHand(new DominoPiece([5, 4])); // suma 9

      const starting = game.determineFirstPlayer();
      expect(starting).toBe(player1);
    });
  });

  describe('Zasady wykonywania ruchów (playTurn)', () => {
    it('nie powinna pozwalać na zagranie klocka, którego gracz nie ma w ręce', () => {
      game.startGame();
      const current = game.getCurrentPlayer()!;
      const alienPiece = new DominoPiece([6, 6]);

      // Usuwamy z ręki jeśli przypadkiem wylosował
      current.removePieceFromHand(alienPiece);

      const result = game.playTurn(alienPiece, 'left');
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('nie posiada tego klocka');
    });

    it('powinna wymusić dubel na start, jeśli runda tego wymaga', () => {
      game.startNewRound();
      player1.clearHand();
      player2.clearHand();
      player1.addPieceToHand(new DominoPiece([6, 6]));
      player1.addPieceToHand(new DominoPiece([2, 3]));
      player2.addPieceToHand(new DominoPiece([1, 1]));

      // Ustalamy pierwszego gracza po ręcznym zdefiniowaniu rąk
      const starting = game.determineFirstPlayer();
      expect(starting).toBe(player1);
      if (game.getCurrentPlayer() !== player1) {
        game.nextPlayerTurn();
      }

      // Próba zagrania zwykłego klocka zamiast dubla
      const badMove = game.playTurn(new DominoPiece([2, 3]), 'left');
      expect(badMove.ok).toBe(false);
      expect(badMove.reason).toContain('musi być dublem');

      // Prawidłowy ruch dublem
      const goodMove = game.playTurn(new DominoPiece([6, 6]), 'left');
      expect(goodMove.ok).toBe(true);
      expect(player1.hasPiece(new DominoPiece([6, 6]))).toBe(false);
      expect(game.getBoard().getLeftValue()).toBe(6);
      expect(game.getBoard().getRightValue()).toBe(6);
    });

    it('powinna poprawnie dopasowywać i odwracać klocki na planszy', () => {
      const board = new DominoBoard();
      board.placeFirstPiece(new DominoPiece([6, 6]));

      // Dołożenie [6, 4] z lewej strony
      const leftPiece = new DominoPiece([6, 4]);
      expect(board.getValidPlacements(leftPiece)).toContain('left');
      board.playOnLeftEnd(leftPiece);

      // Nowy lewy koniec to 4
      expect(board.getLeftValue()).toBe(4);

      // Dołożenie [4, 1] z lewej strony
      const nextLeft = new DominoPiece([4, 1]);
      board.playOnLeftEnd(nextLeft);
      expect(board.getLeftValue()).toBe(1);

      // Dołożenie [6, 2] z prawej strony
      const rightPiece = new DominoPiece([6, 2]);
      expect(board.getValidPlacements(rightPiece)).toContain('right');
      board.playOnRightEnd(rightPiece);
      expect(board.getRightValue()).toBe(2);
    });

    it('powinna otwierać ramiona góra/dół przy Spinnerze', () => {
      const board = new DominoBoard();
      board.placeFirstPiece(new DominoPiece([5, 5]));

      expect(board.getTopValue()).toBe(5);
      expect(board.getBottomValue()).toBe(5);

      const topPiece = new DominoPiece([5, 3]);
      expect(board.getValidPlacements(topPiece)).toContain('top');
      board.playOnTopEnd(topPiece);
      expect(board.getTopValue()).toBe(3);

      const bottomPiece = new DominoPiece([5, 2]);
      expect(board.getValidPlacements(bottomPiece)).toContain('bottom');
      board.playOnBottomEnd(bottomPiece);
      expect(board.getBottomValue()).toBe(2);
    });
  });

  describe('Dobieranie i Pasowanie (draw / pass)', () => {
    it('nie powinna pozwalać na dobieranie z talonu, gdy gracz ma legalny ruch', () => {
      game.startNewRound();
      const current = game.getCurrentPlayer()!;

      // Zapewniamy, że gracz ma ruch
      const leftVal = game.getBoard().getLeftValue();
      if (leftVal !== null) {
        current.addPieceToHand(new DominoPiece([leftVal, 1]));
      }

      const drawRes = game.drawFromBoneyard(current);
      if (current.canMakeMove(game.getBoard().getLeftValue(), game.getBoard().getRightValue(), null, null)) {
        expect(drawRes.ok).toBe(false);
        expect(drawRes.reason).toContain('nie może dobierać');
      }
    });

    it('nie powinna pozwalać na spasowanie, gdy gracz może dobrać z talonu', () => {
      game.startNewRound();
      const current = game.getCurrentPlayer()!;

      // Czyścimy rękę tak, aby nie miał ruchu
      current.clearHand();
      current.addPieceToHand(new DominoPiece([0, 0]));

      // Plansza ma wartości [5, 5]
      game.getBoard().placeFirstPiece(new DominoPiece([5, 5]));

      // Talon nie jest pusty
      expect(game.getBoneyard().isEmpty()).toBe(false);

      const passRes = game.passTurn(current);
      expect(passRes.ok).toBe(false);
      expect(passRes.reason).toContain('musi dobrać klocek');
    });

    it('powinna pozwolić na spasowanie, gdy gracz nie ma ruchu i talon jest pusty', () => {
      game.startNewRound();
      const current = game.getCurrentPlayer()!;
      const other = current === player1 ? player2 : player1;

      current.clearHand();
      current.addPieceToHand(new DominoPiece([0, 0]));

      // Drugi gracz MA ruch, więc po spasowaniu pierwszego gracza gra trwa dalej
      other.clearHand();
      other.addPieceToHand(new DominoPiece([5, 1]));

      game.getBoard().placeFirstPiece(new DominoPiece([5, 5]));

      // Opróżniamy boneyard
      while (!game.getBoneyard().isEmpty()) {
        game.getBoneyard().drawPiece();
      }

      const passRes = game.passTurn(current);
      expect(passRes.ok).toBe(true);
      // Tura powinna przejść na drugiego gracza
      expect(game.getCurrentPlayer()).toBe(other);
    });
  });

  describe('Zakończenie rundy i podliczanie punktów', () => {
    it('powinna przyznać punkty zwycięzcy, gdy wyłoży ostatni klocek', () => {
      game.startNewRound();
      player1.clearHand();
      player2.clearHand();

      // Gracz 1 ma 1 klocek pasujący
      player1.addPieceToHand(new DominoPiece([5, 2]));
      // Gracz 2 ma klocki o sumie oczek 10
      player2.addPieceToHand(new DominoPiece([4, 4])); // 8
      player2.addPieceToHand(new DominoPiece([1, 1])); // 2

      game.getBoard().placeFirstPiece(new DominoPiece([5, 5]));

      // Ustawiamy turę gracza 1
      if (game.getCurrentPlayer() !== player1) {
        game.nextPlayerTurn();
      }

      const res = game.playTurn(new DominoPiece([5, 2]), 'left');
      expect(res.ok).toBe(true);
      expect(player1.getHand().length).toBe(0);
      expect(player1.getPoints()).toBe(10);
      expect(game.getStatus()).toBe('roundOver');
    });

    it('powinna uznać remis i nie przyznawać punktów przy równej liczbie punktów w blokadzie', () => {
      game.startNewRound();
      player1.clearHand();
      player2.clearHand();

      // Obaj gracze mają po 4 punkty
      player1.addPieceToHand(new DominoPiece([2, 2])); // 4
      player2.addPieceToHand(new DominoPiece([1, 3])); // 4

      game.getBoard().placeFirstPiece(new DominoPiece([6, 6]));

      // Opróżniamy talon
      while (!game.getBoneyard().isEmpty()) {
        game.getBoneyard().drawPiece();
      }

      game.calculateRoundScores();
      expect(player1.getPoints()).toBe(0);
      expect(player2.getPoints()).toBe(0);
    });

    it('powinna ogłosić zwycięzcę gry po osiągnięciu limitu punktów', () => {
      game.startNewRound();
      player1.clearHand();
      player2.clearHand();

      player1.addPieceToHand(new DominoPiece([5, 1]));
      // Gracz 2 ma 55 punktów w ręce
      player2.addPieceToHand(new DominoPiece([6, 6]));
      player2.addPieceToHand(new DominoPiece([6, 5]));
      player2.addPieceToHand(new DominoPiece([5, 5]));
      player2.addPieceToHand(new DominoPiece([6, 4]));
      player2.addPieceToHand(new DominoPiece([4, 4]));
      player2.addPieceToHand(new DominoPiece([5, 4]));

      game.getBoard().placeFirstPiece(new DominoPiece([5, 5]));

      if (game.getCurrentPlayer() !== player1) {
        game.nextPlayerTurn();
      }

      const res = game.playTurn(new DominoPiece([5, 1]), 'left');
      expect(res.ok).toBe(true);
      expect(player1.getPoints()).toBeGreaterThanOrEqual(50);
      expect(game.getStatus()).toBe('gameOver');
      expect(game.getWinner()).toBe(player1);
    });
  });
});

describe('DominoEngine (GameEngine Contract)', () => {
  let engine: DominoEngine;
  const p1 = 'alice';
  const p2 = 'bob';

  beforeEach(() => {
    engine = new DominoEngine();
  });

  it('powinna poprawnie tworzyć stan początkowy', () => {
    const state = engine.createInitialState([p1, p2]);
    expect(state.players).toEqual([p1, p2]);
    expect(state.status).toBe('playing');
    expect(state.hands[p1]?.length).toBe(7);
    expect(state.hands[p2]?.length).toBe(7);
    expect(state.boneyard.length).toBe(14);
    expect(engine.getActivePlayers(state)).toEqual([state.currentPlayer]);
  });

  it('powinna maskować klocki przeciwników i talon w getPlayerView', () => {
    const state = engine.createInitialState([p1, p2]);
    const view1 = engine.getPlayerView(state, p1);

    expect(view1.myHand).toEqual(state.hands[p1]);
    expect(view1.handCounts[p1]).toBe(7);
    expect(view1.handCounts[p2]).toBe(7);
    expect(view1.boneyardCount).toBe(14);
    // Widok nie powinien ujawniać tablicy klocków przeciwnika
    expect((view1 as any).hands).toBeUndefined();
  });

  it('powinna wykonywać akcję PLAY zgodnie z kontraktem', () => {
    const state = engine.createInitialState([p1, p2]);
    const current = state.currentPlayer;
    const piece = state.hands[current]![0]!;

    // Jeśli start wymaga dubla, znajdź dubel
    let chosenPiece = piece;
    if (state.roundMustStartWithDouble) {
      const double = state.hands[current]!.find(p => p[0] === p[1]);
      if (double) chosenPiece = double;
    }

    const res = engine.applyAction(state, current, {
      type: 'PLAY',
      piece: chosenPiece,
      side: 'left',
    });

    if (state.roundMustStartWithDouble && chosenPiece[0] !== chosenPiece[1]) {
      expect(res.ok).toBe(false);
    } else {
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.state.hands[current]?.length).toBe(6);
        expect(res.state.board.pieces.length).toBe(1);
      }
    }
  });

  it('powinna obsłużyć onTurnTimeout przyznając wygraną przeciwnikowi', () => {
    const state = engine.createInitialState([p1, p2]);
    const timedOut = state.currentPlayer;
    const nextState = engine.onTurnTimeout(state);

    expect(nextState.status).toBe('gameOver');
    expect(nextState.winner).not.toBe(timedOut);

    const result = engine.getResult(nextState);
    expect(result).not.toBeNull();
    if (result) {
      expect(result[timedOut]).toBe('loss');
      expect(result[nextState.winner!]).toBe('win');
    }
  });
});
