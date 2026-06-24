"use client";

import { createContext, useContext } from "react";

export type LifeMapHandlers = {
  updateArea: (id: string, data: { name?: string; satisfaction?: number }) => void;
  deleteArea: (id: string) => void;
  createValue: (areaId: string, name: string) => void;
  updateValue: (id: string, name: string) => void;
  deleteValue: (id: string) => void;
  editProject: (id: string) => void;
  deleteProject: (id: string) => void;
  disconnectValue: (projectId: string, valueId: string) => void;
  pending: boolean;
  // True while a connection is being dragged from a value — projects light up
  // to show they can be dropped onto.
  connecting: boolean;
};

const LifeMapContext = createContext<LifeMapHandlers | null>(null);

export function LifeMapProvider({
  value,
  children,
}: {
  value: LifeMapHandlers;
  children: React.ReactNode;
}) {
  return (
    <LifeMapContext.Provider value={value}>{children}</LifeMapContext.Provider>
  );
}

export function useLifeMap() {
  const ctx = useContext(LifeMapContext);
  if (!ctx) throw new Error("useLifeMap must be used inside LifeMapProvider");
  return ctx;
}
