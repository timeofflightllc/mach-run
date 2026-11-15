import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { PointBoard } from "./board";

export const pointBoardFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PointBoard> => {
    const { loadPointBoard } = await import("./board.server");
    return loadPointBoard(context.userId);
  });
