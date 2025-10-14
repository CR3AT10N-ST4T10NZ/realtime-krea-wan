import React from "react";
import { createFalClient, fal } from "@fal-ai/client";

// Configure fal for realtime
if (typeof window !== "undefined") {
  fal.config({
    proxyUrl: "/api/fal",
  });
}

// Custom hook for FAL client
export const useFalClient = (apiKey?: string) => {
  return React.useMemo(() => {
    return createFalClient({
      credentials: apiKey ?? undefined,
      proxyUrl: "/api/fal",
    });
  }, [apiKey]);
};

// Export fal for realtime connections
export { fal };
