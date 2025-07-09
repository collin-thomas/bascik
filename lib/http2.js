// HTTP/2 Server. I wanted to have fun trying this out.
// But I don't intend for the server to be coupled. Only an option you can choose to use.
// It's an option you can choose to use in development or in production.
// I think I'll probably default to using something like express for stability.
// Also no matter what http server I chose to implement
// I'll also have to duplicate the the hot reload feature that watch-http-server implements.
// To investigate that further, it injects a script tag at the end of each html body.
// At first glance, it looks like the script is using web sockets to listen to events to trigger a reload.
// That should be pretty easy to replicate.
import { readFile, stat } from "node:fs/promises";
import http2 from "node:http2"
import { mem } from "./mem.js";
import { BascikConfig } from "./config.js";

export const serveHttp2 = async () => {
  const hostname = "localhost";
  const port = 8443;
  const origin = `https://${hostname}:${port}`

  const key = await readFile("localhost-privkey.pem");
  const cert = await readFile("localhost-cert.pem");

  const server = http2.createSecureServer({
    key,
    cert,
  });

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
  server.on("error", (err) => console.error(err));

  const onError = (err, stream) => {
    try {
      if (err.code === "ENOENT") {
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

    console.error("Stream error:", err);
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
      onError(err, stream);
    }

    /* 
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

    const pagePath = await getFilePathToServe(headers[":path"]);
    
    stream.respondWithFile(
      `dist${pagePath}.html`,
      {
        "content-type": "text/html; charset=utf-8",
        ":status": pagePath === "/404" ? 404 : 200,
      },
      { statCheck, onError }
    ); 
    */
  });

  server.listen(port, hostname, () => {
    console.log(`Server running at ${origin}`);
  });
};

const getFilePathToServe = async (reqPath) => {
  if (reqPath === "/") return "/index";
  try {
    if ((await stat(`dist${reqPath}`)).isDirectory) return `${reqPath}/index`;
  } catch {
    // Next check if file, and if neither, 404
  }
  try {
    if ((await stat(`dist${reqPath}.html`)).isFile) return reqPath;
  } catch {
    return "/404";
  }
};
