import { createContext, useContext } from 'react';

import type { ModeSetting } from './theme';

export const ModeSetterContext = createContext<(m: ModeSetting) => void>(() => {});

export function useSetMode() {
  return useContext(ModeSetterContext);
}
