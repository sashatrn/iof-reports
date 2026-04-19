import fs from "fs";
import http from "http";
import net from "net";
import path from "path";
import { Logger } from "pino";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendFile(response: http.ServerResponse, filePath: string): void {
  if (!fs.existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const extension = path.extname(filePath);
  const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";

  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(fs.readFileSync(filePath));
}

export type WatchHttpServer = {
  server: http.Server;
  close: () => Promise<void>;
};

export function startWatchHttpServer(
  outputDir: string,
  port: number,
  logger: Logger,
): WatchHttpServer {
  const routes: Record<string, string> = {
    "/": "viewer.html",
    "/viewer": "viewer.html",
    "/viewer.html": "viewer.html",
    "/report": "report.html",
    "/report.html": "report.html",
    "/report-pdf": "report.pdf.html",
    "/report.pdf.html": "report.pdf.html",
    "/meta": "meta.json",
    "/meta.json": "meta.json",
  };

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const fileName = routes[requestUrl.pathname];

    if (!fileName) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    sendFile(response, path.join(outputDir, fileName));
  });
  const sockets = new Set<net.Socket>();

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  server.on("error", (error) => {
    logger.error({ err: error, port }, "Watch HTTP server failed");
  });

  server.listen(port, "127.0.0.1", () => {
    logger.info(
      {
        url: `http://127.0.0.1:${port}/viewer`,
        reportUrl: `http://127.0.0.1:${port}/report`,
        metaUrl: `http://127.0.0.1:${port}/meta`,
      },
      "Watch HTTP server started",
    );
  });

  return {
    server,
    close: () =>
      new Promise<void>((resolve, reject) => {
        for (const socket of sockets) {
          socket.destroy();
        }

        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}
