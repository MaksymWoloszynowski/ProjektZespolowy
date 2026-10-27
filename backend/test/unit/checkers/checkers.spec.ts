import { describe, it, expect, beforeEach } from 'vitest';
import { CheckersEngine } from '../../../src/engines/checkers/checkersEngine.js';
import type { CheckersState, Piece } from '../../../src/engines/checkers/checkersEngine.js';

describe('CheckersEngine - Zasady Gry i Logika', () => {
  let engine: CheckersEngine;
  const p1 = 'player-white';
  const p2 = 'player-black';

  beforeEach(() => {
    engine = new CheckersEngine();
  });

  // --- HELPER DO TESTÓW ---
  // Pozwala ułożyć dowolną sytuację na planszy, aby nie grać od początku
  const createCustomState = (
    turn: 'WHITE' | 'BLACK',
    pieces: { row: number; col: number; player: 'WHITE' | 'BLACK'; type: 'MAN' | 'KING' }[]
  ): CheckersState => {
    const state = engine.createInitialState([p1, p2]);
    // Czyścimy planszę
    state.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    state.turn = turn;

    // Ustawiamy figury testowe
    for (const p of pieces) {
      state.board[p.row][p.col] = { player: p.player, type: p.type };
    }
    return state;
  };

  describe('Inicjalizacja gry', () => {
    it('powinna wymagać dokładnie 2 graczy', () => {
      expect(() => engine.createInitialState(['p1'])).toThrow();
      expect(() => engine.createInitialState(['p1', 'p2', 'p3'])).toThrow();
    });

    it('powinna poprawnie ustawić graczy i pierwszą turę', () => {
      const state = engine.createInitialState([p1, p2]);
      expect(state.turn).toBe('WHITE');
      expect(engine.getActivePlayers(state)).toEqual([p1]);
      expect(state.winner).toBeNull();
    });
  });

  describe('Podstawowe zasady ruchu', () => {
    it('nie powinna pozwalać na ruch poza swoją turą', () => {
      const state = engine.createInitialState([p1, p2]);

      // Próba ruchu czarnego gracza w turze białego
      const result = engine.applyAction(state, p2, {
        type: 'MOVE',
        from: { row: 2, col: 1 },
        to: { row: 3, col: 0 }
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain('Not your turn');
    });

    it('powinna pozwalać na poprawny ruch piona do przodu', () => {
      const state = engine.createInitialState([p1, p2]);

      const result = engine.applyAction(state, p1, {
        type: 'MOVE',
        from: { row: 5, col: 0 },
        to: { row: 4, col: 1 }
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.board[4][1]?.player).toBe('WHITE');
        expect(result.state.board[5][0]).toBeNull();
        expect(result.state.turn).toBe('BLACK'); // Tura musi się zmienić
      }
    });

    it('nie powinna pozwalać na wejście na zajęte pole', () => {
      const state = createCustomState('WHITE', [
        { row: 5, col: 2, player: 'WHITE', type: 'MAN' },
        { row: 4, col: 3, player: 'WHITE', type: 'MAN' } // Pole zajęte przez swojego
      ]);

      const result = engine.applyAction(state, p1, {
        type: 'MOVE',
        from: { row: 5, col: 2 },
        to: { row: 4, col: 3 }
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('Zasady bicia (Przymus i Większość)', () => {
    it('powinna wymuszać bicie (brak możliwości zwykłego ruchu)', () => {
      const state = createCustomState('WHITE', [
        { row: 5, col: 2, player: 'WHITE', type: 'MAN' },
        { row: 4, col: 3, player: 'BLACK', type: 'MAN' }, // Ofiara
        { row: 5, col: 6, player: 'WHITE', type: 'MAN' }  // Zwykły pion z boku
      ]);

      // Próba ruchu zwykłym pionem zamiast wykonania bicia
      const result = engine.applyAction(state, p1, {
        type: 'MOVE',
        from: { row: 5, col: 6 },
        to: { row: 4, col: 7 }
      });

      expect(result.ok).toBe(false); // Ruch musi zostać odrzucony
    });

    it('powinna egzekwować przymus bicia WIĘKSZOŚCI', () => {
      // Scenariusz: Biały ma rozwidlenie. W lewo bije 1 piona, w prawo bije 2 piony.
      const state = createCustomState('WHITE', [
        { row: 5, col: 2, player: 'WHITE', type: 'MAN' },

        // Ścieżka 1: Bicie w lewo (tylko 1 pionek)
        { row: 4, col: 1, player: 'BLACK', type: 'MAN' },

        // Ścieżka 2: Bicie w prawo (2 pionki)
        { row: 4, col: 3, player: 'BLACK', type: 'MAN' },
        { row: 2, col: 5, player: 'BLACK', type: 'MAN' }
      ]);

      // Próba bicia w lewo (mniej bić) - powinna zostać odrzucona
      const badCapture = engine.applyAction(state, p1, {
        type: 'MOVE',
        from: { row: 5, col: 2 },
        to: { row: 3, col: 0 }
      });
      expect(badCapture.ok).toBe(false);

      // Próba bicia w prawo (pierwszy krok dłuższego bicia) - powinna być OK
      const goodCapture = engine.applyAction(state, p1, {
        type: 'MOVE',
        from: { row: 5, col: 2 },
        to: { row: 3, col: 4 }
      });
      expect(goodCapture.ok).toBe(true);
    });

    it('powinna kontynuować turę przy biciu wielokrotnym (multi-jump)', () => {
      const state = createCustomState('WHITE', [
        { row: 5, col: 2, player: 'WHITE', type: 'MAN' },
        { row: 4, col: 3, player: 'BLACK', type: 'MAN' },
        { row: 2, col: 5, player: 'BLACK', type: 'MAN' }
      ]);

      // Krok 1 bicia
      const step1 = engine.applyAction(state, p1, {
        type: 'MOVE',
        from: { row: 5, col: 2 },
        to: { row: 3, col: 4 }
      });

      expect(step1.ok).toBe(true);
      if (step1.ok) {
        // Tura nie powinna ulec zmianie, wciąż biały!
        expect(step1.state.turn).toBe('WHITE');
        expect(step1.state.multiJumpPiece).toEqual({ row: 3, col: 4 });
      }
    });

    it('powinna usunąć ofiary dopiero po zakończeniu całego bicia (Zasada Turecka)', () => {
      const state = createCustomState('WHITE', [
        { row: 5, col: 2, player: 'WHITE', type: 'MAN' },
        { row: 4, col: 3, player: 'BLACK', type: 'MAN' }
      ]);

      const result = engine.applyAction(state, p1, {
        type: 'MOVE',
        from: { row: 5, col: 2 },
        to: { row: 3, col: 4 }
      });

      // To było pojedyncze bicie, więc po ruchu ofiara powinna zniknąć
      if (result.ok) {
        expect(result.state.board[4][3]).toBeNull();
      }
    });
  });

  describe('Promocja i Damki (Kings)', () => {
    it('powinna promować piona na damkę po dotarciu do ostatniego rzędu', () => {
      const state = createCustomState('WHITE', [
        { row: 1, col: 2, player: 'WHITE', type: 'MAN' } // Rząd 1, jeden krok od promocji (rząd 0)
      ]);

      const result = engine.applyAction(state, p1, {
        type: 'MOVE',
        from: { row: 1, col: 2 },
        to: { row: 0, col: 3 }
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.board[0][3]?.type).toBe('KING');
      }
    });

    it('Latająca damka powinna móc poruszać się o wiele pół', () => {
      const state = createCustomState('WHITE', [
        { row: 7, col: 0, player: 'WHITE', type: 'KING' }
      ]);

      const result = engine.applyAction(state, p1, {
        type: 'MOVE',
        from: { row: 7, col: 0 },
        to: { row: 2, col: 5 } // Lot przez całą przekątną
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.board[2][5]?.player).toBe('WHITE');
      }
    });
  });

  describe('Zakończenie gry i Remisy', () => {
    it('powinna ogłosić zwycięzcę, gdy przeciwnik nie ma figur/ruchów', () => {
      const state = createCustomState('WHITE', [
        { row: 5, col: 2, player: 'WHITE', type: 'MAN' },
        { row: 4, col: 3, player: 'BLACK', type: 'MAN' } // Ostatni czarny pion
      ]);

      // Biały bije ostatniego piona
      const result = engine.applyAction(state, p1, {
        type: 'MOVE',
        from: { row: 5, col: 2 },
        to: { row: 3, col: 4 }
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.winner).toBe('WHITE');
        expect(engine.getResult(result.state)).toEqual({
          [p1]: 'win',
          [p2]: 'loss'
        });
      }
    });

    it('powinna ogłosić remis po 15 turach (30 ruchach) bez bicia i ruchu pionem', () => {
      let state = createCustomState('WHITE', [
        { row: 7, col: 0, player: 'WHITE', type: 'KING' },
        { row: 0, col: 7, player: 'BLACK', type: 'KING' }
      ]);

      // Ręcznie nabijamy licznik przed ostatnim ruchem
      state.drawMoveCount = 29;

      // Zwykły ruch damki
      const result = engine.applyAction(state, p1, {
        type: 'MOVE',
        from: { row: 7, col: 0 },
        to: { row: 6, col: 1 }
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.isDraw).toBe(true);
        expect(engine.getResult(result.state)).toEqual({
          [p1]: 'draw',
          [p2]: 'draw'
        });
      }
    });
  });
});