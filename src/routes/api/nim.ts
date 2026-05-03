import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/nim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("x-api-key");
        const baseUrl = request.headers.get("x-base-url") || "https://integrate.api.nvidia.com/v1";
        if (!apiKey) return new Response("Missing API key", { status: 400 });
        const body = await request.text();
        const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            Accept: "text/event-stream",
          },
          body,
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
