import { create } from "zustand";
import { verifyRoomPassword } from "@/lib/crypto/vault";

interface RoomPasswordState {
  /** roomId → unlocked (in-memory, cleared on page refresh) */
  unlockedRooms: Record<string, boolean>;
  isUnlocked: (roomId: string) => boolean;
  /** Verifies the password against the stored verifier and marks the room as unlocked. */
  unlockRoom: (roomId: string, password: string, verifier: string) => Promise<boolean>;
  lockRoom: (roomId: string) => void;
}

export const useRoomPasswordStore = create<RoomPasswordState>((set, get) => ({
  unlockedRooms: {},

  isUnlocked: (roomId) => get().unlockedRooms[roomId] === true,

  unlockRoom: async (roomId, password, verifier) => {
    const ok = await verifyRoomPassword(verifier, password);
    if (ok) {
      set((s) => ({ unlockedRooms: { ...s.unlockedRooms, [roomId]: true } }));
    }
    return ok;
  },

  lockRoom: (roomId) => {
    set((s) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [roomId]: _removed, ...rest } = s.unlockedRooms;
      return { unlockedRooms: rest };
    });
  },
}));
