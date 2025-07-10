import { readFile } from "node:fs/promises";
import http2 from "node:http2"
import { mem } from "./mem.js";
import { BascikConfig } from "./config.js";
import { eventEmitter } from "./events.js";
import { getHttpPath } from "./paths.js";

export const serveHttp2 = async () => {
  const hostname = "localhost";
  const port = 8443;
  const origin = `https://${hostname}:${port}`

  const key = await readFile("localhost-privkey.pem");
  const cert = await readFile("localhost-cert.pem");

  const server = http2.createSecureServer({ key, cert, });

  /*
  ```
  | Error Type            | Use `server.on("error")` | Use `onError(err, stream)` |
  | --------------------- | ------------------------ | -------------------------- |
  | Server setup failures | x                        |                            |
  | TLS config issues     | x                        |                            |
  | Client disconnects    |                          | x                          |
  | Stream already closed |                          | x                          |
  | Runtime bugs per page |                          | x                          |
  ``` 
  */
  server.on("error", (error) => console.error(error));

  const onError = (error, stream) => {
    try {
      if (error.code === "ENOENT") {
        stream.respond({ ":status": 404 });
      } else {
        stream.respond({ ":status": 500 });
      }
    } catch (respondErr) {
      console.error("Error responding to stream:", respondErr);
    }

    try {
      stream.end();
    } catch (endErr) {
      console.error("Error ending stream:", endErr);
    }

    console.error("Stream error:", error);
  }

  server.on("stream", async (stream, headers) => {
    try {
      if (headers[":path"].split(".").length > 1) {
        stream.respond({ ":status": 404 });
        return stream.end();
      }

      const reqUrl = `${origin}${headers[":path"]}`

      if (headers[":path"] === '/bascik-live-reload') {
        // Set SSE headers
        stream.respond({
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        });

        stream.write(`data: connected\n\n`);

        const eventHandler = ({ pagePath }) => {
          const { referer } = headers
          const httpPath = getHttpPath(pagePath)
          const transpiledUrl = `${origin}${httpPath}`
          if (referer !== transpiledUrl) return
          //console.debug('SSE:', referer)
          const data = `data: reload\n\n`;
          stream.write(data);
        }

        eventEmitter.on('transpiled', eventHandler);

        //console.debug('open sse', stream.id)

        stream.on('close', () => {
          //console.debug('close sse', stream.id)
          eventEmitter.removeListener('transpiled', eventHandler);
          //console.debug('listener count:', eventEmitter.listenerCount())
        });
        return
      }

      const page = mem.getPage(headers[":path"])

      if (!page) {
        // The developer did not configure a pages/404.html page.
        stream.respond({ ":status": 404 });
        return stream.end("Not Found");
      }

      console.log(`serving: ${reqUrl}`);

      const responseHeaders = {
        'Content-Type': 'text/html; charset=utf-8',
        ':status': 200,
      };

      if (BascikConfig.cacheHttp === false) {
        responseHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate'
        responseHeaders['Pragma'] = 'no-cache'
        responseHeaders['Expires'] = '0'
      }

      const acceptEncoding = headers['accept-encoding'] || '';

      // Send compressed
      if (/\bbr\b/.test(acceptEncoding)) {
        responseHeaders['content-encoding'] = 'br';
        stream.respond(responseHeaders);
        return stream.end(page.compressedContent)
      }

      // Send uncompressed
      stream.respond(responseHeaders);
      return stream.end(page.content)

    } catch (error) {
      onError(error, stream);
    }
  });

  server.listen(port, hostname, () => {
    console.log(`Server running at ${origin}`);
  });
};