import { readFile } from "node:fs/promises";
import http2 from "node:http2"
import { mem } from "./mem.js";
import { BascikConfig } from "./config.js";

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

      console.log(`serving: ${origin}${headers[":path"]}`);

      //console.debug({ path: headers[":path"] })

      const page = mem.getPage(headers[":path"])

      if (!page) {
        // The developer did not configure a pages/404.html page.
        stream.respond({ ":status": 404 });
        return stream.end("Not Found");
      }

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