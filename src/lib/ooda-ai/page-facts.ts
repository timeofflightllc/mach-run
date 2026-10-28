export type MachBackFact = {
  survived: number;
  total: number;
  stocks: number;
};

let fact: MachBackFact | null = null;
let owner = 0;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function readMachBackFact(): MachBackFact | null {
  return fact;
}

export function subscribeMachBackFact(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** One Mach Back card. A later run replaces it. Unmount clears only its own result. */
export function claimMachBackSlot() {
  const id = nextId++;
  return {
    set(next: MachBackFact | null) {
      if (next == null && owner !== id) return;
      fact = next;
      owner = next == null ? 0 : id;
      emit();
    },
    release() {
      if (owner !== id) return;
      fact = null;
      owner = 0;
      emit();
    },
  };
}
