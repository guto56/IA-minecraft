let warmed = false;

/** Pré-carrega o motor e a conversa quando o usuário mostra intenção (foco no campo, hover num exemplo). */
export function warmEngine() {
  if (warmed) return;
  warmed = true;
  void import('../engine');
  void import('../components/Messages');
}
