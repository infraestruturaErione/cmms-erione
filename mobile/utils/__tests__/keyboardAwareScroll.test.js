import { computeScrollToRevealCard, computeScrollToRevealInput } from '../keyboardAwareScroll';

// Area visivel de 400 (altura da lista ja descontado o teclado, via adjustResize).
const base = { scrollY: 0, viewportHeight: 400, cardHeight: 200 };

describe('computeScrollToRevealCard', () => {
  it('nao rola quando o card ja esta inteiro visivel (evita salto)', () => {
    expect(computeScrollToRevealCard({ ...base, cardY: 50 })).toBeNull();
  });

  it('sobe o minimo necessario quando o teclado cobre o rodape do card', () => {
    // card ocupa 300..500, area visivel 0..400 -> precisa subir ate 512-400 = 112
    expect(computeScrollToRevealCard({ ...base, cardY: 300 })).toBe(112);
  });

  it('desce ate o topo do card quando ele ficou acima da area visivel', () => {
    expect(
      computeScrollToRevealCard({ ...base, cardY: 100, scrollY: 300 })
    ).toBe(88);
  });

  it('alinha pelo topo quando o card e maior que a area visivel', () => {
    // enunciado + campo ficam no topo do card; notas/fotos continuam rolaveis
    expect(
      computeScrollToRevealCard({
        ...base,
        cardY: 600,
        cardHeight: 700,
        scrollY: 0
      })
    ).toBe(588);
  });

  it('nao devolve rolagem negativa no primeiro card', () => {
    expect(computeScrollToRevealCard({ ...base, cardY: 4, scrollY: 40 })).toBe(
      0
    );
  });

  it('nao rola se o card alto ja esta alinhado pelo topo', () => {
    expect(
      computeScrollToRevealCard({
        ...base,
        cardY: 112,
        cardHeight: 700,
        scrollY: 100
      })
    ).toBeNull();
  });

  it('ignora medidas ainda nao disponiveis', () => {
    expect(
      computeScrollToRevealCard({ ...base, cardY: 300, viewportHeight: 0 })
    ).toBeNull();
    expect(
      computeScrollToRevealCard({ ...base, cardY: 300, cardHeight: 0 })
    ).toBeNull();
  });

  it('respeita uma margem customizada', () => {
    expect(
      computeScrollToRevealCard({ ...base, cardY: 300, margin: 40 })
    ).toBe(140);
  });

  // Teclado abrindo: a mesma posicao passa a precisar de rolagem quando a area encolhe.
  it('reage a area visivel menor depois que o teclado abre', () => {
    // card ocupa 150..350: cabe inteiro em 400, mas nao em 300 (teclado aberto)
    const card = { ...base, cardY: 150 };

    expect(computeScrollToRevealCard(card)).toBeNull();
    expect(computeScrollToRevealCard({ ...card, viewportHeight: 300 })).toBe(
      62
    );
  });
});

describe('computeScrollToRevealInput with window measurements', () => {
  const viewport = { viewportTop: 80, viewportBottom: 380, scrollY: 0 };

  it('moves the last focused input above the resized keyboard, not the whole card', () => {
    expect(computeScrollToRevealInput({ ...viewport, inputTop: 350, inputBottom: 405 })).toBe(37);
  });

  it('does not jump when switching between already visible questions', () => {
    expect(computeScrollToRevealInput({ ...viewport, inputTop: 150, inputBottom: 205 })).toBeNull();
  });

  it('rechecks a growing multiline field using its current window geometry', () => {
    expect(computeScrollToRevealInput({ ...viewport, inputTop: 250, inputBottom: 340 })).toBeNull();
    expect(computeScrollToRevealInput({ ...viewport, inputTop: 250, inputBottom: 390 })).toBe(22);
  });

  it('aligns an input taller than the viewport at the top', () => {
    expect(computeScrollToRevealInput({ ...viewport, inputTop: 190, inputBottom: 600 })).toBe(98);
  });
});
