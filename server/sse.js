// Server-sent events: stream progress to the browser over a POST response.
export function openStream(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const controller = new AbortController();
  // Keep proxies from closing a quiet connection while Claude is working.
  const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 15000);
  res.on("close", () => {
    clearInterval(heartbeat);
    controller.abort();
  });
  return {
    signal: controller.signal,
    send(event, data) {
      if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    },
  };
}
