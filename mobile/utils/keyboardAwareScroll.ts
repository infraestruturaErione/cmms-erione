export interface RevealCardInput {
  /** Posicao do card dentro do conteudo da lista (onLayout). */
  cardY: number;
  cardHeight: number;
  /** Rolagem atual da lista. */
  scrollY: number;
  /** Altura VISIVEL da lista - com adjustResize ja' vem descontado o teclado. */
  viewportHeight: number;
  margin?: number;
}

/**
 * Quanto rolar para o card focado ficar visivel acima do teclado.
 *
 * Rola o MINIMO necessario e devolve `null` quando o card ja' esta inteiro a' vista -
 * assim trocar de campo dentro da mesma tela nao provoca salto de layout.
 */
export const computeScrollToRevealCard = ({
  cardY,
  cardHeight,
  scrollY,
  viewportHeight,
  margin = 12
}: RevealCardInput): number | null => {
  if (!(viewportHeight > 0) || !(cardHeight > 0)) return null;

  const desiredTop = Math.max(0, cardY - margin);

  // Card mais alto que a area visivel (notas abertas, varias fotos): alinhar pelo topo
  // mantem enunciado + campo de resposta a' vista; o resto continua alcancavel rolando.
  if (cardHeight + margin >= viewportHeight) {
    return Math.round(desiredTop) === Math.round(scrollY) ? null : desiredTop;
  }

  // Topo cortado: desce ate' o inicio do card.
  if (cardY - margin < scrollY) return desiredTop;

  // Rodape do card coberto pelo teclado: sobe so' o suficiente.
  const cardBottom = cardY + cardHeight + margin;
  if (cardBottom > scrollY + viewportHeight) return cardBottom - viewportHeight;

  return null;
};

export const computeScrollToRevealInput = ({
  inputTop,
  inputBottom,
  viewportTop,
  viewportBottom,
  scrollY,
  margin = 12
}: {
  inputTop: number;
  inputBottom: number;
  viewportTop: number;
  viewportBottom: number;
  scrollY: number;
  margin?: number;
}): number | null => {
  if (viewportBottom <= viewportTop || inputBottom <= inputTop) return null;
  const visibleHeight = viewportBottom - viewportTop - 2 * margin;
  const delta =
    inputBottom - inputTop > visibleHeight
      ? inputTop - viewportTop - margin
      : inputBottom > viewportBottom - margin
        ? inputBottom - viewportBottom + margin
        : inputTop < viewportTop + margin
          ? inputTop - viewportTop - margin
          : 0;
  return Math.abs(delta) < 1 ? null : Math.max(0, scrollY + delta);
};
