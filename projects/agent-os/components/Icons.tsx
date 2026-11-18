// Ícones SVG decorativos (os botões que os usam levam aria-label).
import type { ReactNode } from "react";

function Svg({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const IconTeam = () => (
  <Svg>
    <circle cx="5" cy="12" r="2.5" />
    <circle cx="19" cy="5" r="2.5" />
    <circle cx="19" cy="19" r="2.5" />
    <path d="M7.3 11 16.8 6M7.3 13l9.5 5" />
  </Svg>
);
export const IconTasks = () => (
  <Svg>
    <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
  </Svg>
);
export const IconFolder = () => (
  <Svg>
    <path d="M3 7h7l2 2h9v10H3z" />
  </Svg>
);
export const IconMemory = () => (
  <Svg>
    <path d="M12 3a6 6 0 0 0-6 6c0 4 6 12 6 12s6-8 6-12a6 6 0 0 0-6-6z" />
    <circle cx="12" cy="9" r="2" />
  </Svg>
);
export const IconFeed = () => (
  <Svg>
    <path d="M4 5h16M4 10h16M4 15h10M4 20h7" />
  </Svg>
);
export const IconSessions = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconPlus = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMinus = () => (
  <Svg>
    <path d="M5 12h14" />
  </Svg>
);
export const IconReset = () => (
  <Svg>
    <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5" />
  </Svg>
);
export const IconClose = () => (
  <Svg>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
