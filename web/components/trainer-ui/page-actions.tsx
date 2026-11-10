import React, { createContext, useContext } from "react";
import { createPortal } from "react-dom";
export const TrainerHeaderActionContext = createContext<HTMLElement | null>(
  null,
);
/** Place each screen's action inside the shared header, with normal document flow. */
export function HeaderAction({ children }: { children: React.ReactNode }) {
  const target = useContext(TrainerHeaderActionContext);
  return target ? createPortal(children, target) : <>{children}</>;
}
