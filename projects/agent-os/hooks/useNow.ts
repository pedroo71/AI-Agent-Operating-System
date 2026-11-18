"use client";

import { useEffect, useState } from "react";

/** Relógio partilhado: devolve Date.now() atualizado a cada `ms`. Começa a 0 até montar (evita erros de hidratação). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
