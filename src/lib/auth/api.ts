import { createServerFn } from "@tanstack/react-start";
import { appleConfigured } from "./apple";

export const getAuthFeatures = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      return { apple: appleConfigured() };
    } catch {
      return { apple: false };
    }
  },
);
