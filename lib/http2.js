// HTTP/2 Server. I wanted to have fun trying this out.
// But I don't intend for the server to be coupled. Only an option you can choose to use.
// It's an option you can choose to use in development or in production.
// I think I'll probably default to using something like express for stability.
// Also no matter what http server I chose to implement
// I'll also have to duplicate the the hot reload feature that watch-http-server implements.
// To investigate that further, it injects a script tag at the end of each html body.
// At first glance, it looks like the script is using web sockets to listen to events to trigger a realod.
// That should be pretty easy to replicate.
import { readFile } from "node:fs/promises";
let http2;
try {
  http2 = await import("node:http2");
} catch (err) {
  console.error("http2 support is disabled!");
}
export const serveHttp2 = async () => {
  const hostname = "localhost";
  const port = 3000;

  const key = await readFile("localhost-privkey.pem");
  const cert = await readFile("localhost-cert.pem");

  const server = http2.createSecureServer({
    key,
    cert,
  });

  server.on("error", (err) => console.error(err));

  server.on("stream", (stream, headers) => {
    function statCheck(stat, headers) {
      headers["last-modified"] = stat.mtime.toUTCString();
    }

    function onError(err) {
      // stream.respond() can throw if the stream has been destroyed by
      // the other side.
      try {
        if (err.code === "ENOENT") {
          stream.respond({ ":status": 404 });
        } else {
          stream.respond({ ":status": 500 });
        }
      } catch (err) {
        // Perform actual error handling.
        console.error(err);
      }
      stream.end();
    }

    if (headers[":path"].split(".").length > 1) {
      stream.respond({ ":status": 404 });
      return stream.end();
    }

    const page = headers[":path"] === "/" ? "/index" : headers[":path"];
    console.log(`serving: ${page === "/index" ? "/" : page}`);
    stream.respondWithFile(
      `dist${page}.html`,
      {
        "content-type": "text/html; charset=utf-8",
        ":status": 200,
      },
      { statCheck, onError }
    );
  });

  server.listen(port, hostname, () => {
    console.log(`Server running at https://${hostname}:${port}/`);
  });
};
