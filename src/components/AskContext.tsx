import { createContext, useContext } from 'react';

/** Permite que qualquer card faça uma nova pergunta (ex.: clicar num ingrediente). */
export const AskContext = createContext<(question: string, image?: string) => void>(() => {});
export const useAsk = () => useContext(AskContext);
