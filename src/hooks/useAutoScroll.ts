import { useCallback, useEffect, useRef, useState } from 'react';

/** Distância do fim (px) que ainda conta como "no fim da conversa". */
const NEAR_BOTTOM = 48;
/** A partir daqui aparece o botão de voltar para baixo. */
const SHOW_BUTTON = 160;

/** Folga acima da pergunta fixada no topo. */
const PIN_GAP = 16;

/**
 * Rolagem que acompanha a resposta enquanto ela é escrita.
 * - Pergunta nova: desliza até a pergunta ficar no topo e para ali (a resposta cresce embaixo dela).
 * - Setinha: acompanha a escrita até o fim, suavemente (sem saltos).
 * - O usuário sobe (roda do mouse, toque, teclado ou barra de rolagem): para de acompanhar.
 * - Voltar ao fim (rolando ou pelo botão) retoma o acompanhamento.
 */
export function useAutoScroll() {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const [showButton, setShowButton] = useState(false);
  const following = useRef(true);
  /** Segura a rolagem com a última pergunta no topo. */
  const pinned = useRef(true);
  const frame = useRef(0);
  const lastSet = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const distance = (el: HTMLElement) => el.scrollHeight - el.clientHeight - el.scrollTop;

  /** Até onde rolar: o fim, ou a posição que deixa a última pergunta no topo. */
  const targetOf = useCallback(
    (el: HTMLElement) => {
      const bottom = el.scrollHeight - el.clientHeight;
      if (!pinned.current || !content) return bottom;
      const questions = content.querySelectorAll('[data-user-message]');
      const q = questions[questions.length - 1];
      if (!q) return bottom;
      const top = q.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - PIN_GAP;
      return Math.max(0, Math.min(bottom, top));
    },
    [content],
  );

  // Laço de animação: aproxima o scroll do fim com suavização exponencial,
  // então acompanha o texto crescendo sem trancos e desacelera ao chegar.
  const run = useCallback(() => {
    if (!scroller || frame.current) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!following.current) {
        frame.current = 0;
        return;
      }
      const target = targetOf(scroller);
      const gap = target - scroller.scrollTop;
      if (Math.abs(gap) <= 0.5) {
        frame.current = 0;
        setShowButton(distance(scroller) > SHOW_BUTTON);
        return;
      }
      const next = reduced() ? target : scroller.scrollTop + gap * (1 - Math.exp(-dt / 110));
      // Garante progresso mínimo para não "travar" no último pixel.
      scroller.scrollTop = gap > 0 ? Math.min(target, Math.max(next, scroller.scrollTop + 1)) : Math.max(target, Math.min(next, scroller.scrollTop - 1));
      lastSet.current = scroller.scrollTop;
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [scroller, targetOf]);

  const stop = useCallback(() => {
    following.current = false;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  /** Nova pergunta (ou troca de conversa): leva a última pergunta ao topo e segura ali. */
  const pin = useCallback(() => {
    following.current = true;
    pinned.current = true;
    run();
  }, [run]);

  /** Setinha: acompanha a resposta até o fim. */
  const follow = useCallback(() => {
    following.current = true;
    pinned.current = false;
    setShowButton(false);
    run();
  }, [run]);

  // Conteúdo cresceu (streaming, card entrando, imagem carregando): acompanha.
  useEffect(() => {
    if (!content || !scroller) return;
    const ro = new ResizeObserver(() => {
      // Altura visível do chat: o último turno usa para a pergunta poder subir até o topo.
      scroller.style.setProperty('--chat-h', `${scroller.clientHeight}px`);
      if (following.current) run();
      setShowButton((!following.current || pinned.current) && distance(scroller) > SHOW_BUTTON);
    });
    ro.observe(content);
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [content, scroller, run]);

  // Intenção do usuário de subir: para de acompanhar na hora.
  useEffect(() => {
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) stop();
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY.current = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      // Dedo descendo = conteúdo subindo = usuário voltando para trás.
      if (touchY.current !== null && y !== undefined && y > touchY.current + 4) stop();
    };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'PageUp', 'Home'].includes(e.key) && !(e.target as HTMLElement).closest('textarea, input')) stop();
    };
    const onScroll = () => {
      const d = distance(scroller);
      const ours = lastSet.current !== null && Math.abs(scroller.scrollTop - lastSet.current) < 2;
      // Rolou por conta própria (barra, roda para baixo): solta a pergunta fixada.
      if (!ours && following.current && d > NEAR_BOTTOM) stop();
      // Desceu sozinho até o fim: retoma o automático, acompanhando até o fim.
      if (!ours && d <= NEAR_BOTTOM) {
        following.current = true;
        pinned.current = false;
      }
      setShowButton((!following.current || pinned.current) && d > SHOW_BUTTON);
    };
    scroller.addEventListener('wheel', onWheel, { passive: true });
    scroller.addEventListener('touchstart', onTouchStart, { passive: true });
    scroller.addEventListener('touchmove', onTouchMove, { passive: true });
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      scroller.removeEventListener('wheel', onWheel);
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, [scroller, stop]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return { scrollerRef: setScroller, contentRef: setContent, showButton, follow, pin };
}
