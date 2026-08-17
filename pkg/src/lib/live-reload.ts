/**
 * live-reload.ts — Injected client-side live-reload script.
 *
 * Appended to HTML pages in dev mode. Connects to the SSE endpoint
 * and reloads the page on transpilation or hot asset updates.
 * Shuts down permanently on connection failure to keep the console clean.
 */

export const LIVE_RELOAD_SCRIPT = `
<script>
  (function() {
    var wasConnected = false;
    var source;
    var retryCount = 0;
    var maxRetries = 5;
    var retryTimeout = null;

    function connect() {
      if (source) return;
      source = new EventSource("/bascik-live-reload");
      source.onmessage = function(e) {
        if (e.data === 'reload') {
          window.location.reload();
        } else if (e.data === 'connected') {
          retryCount = 0;
          if (wasConnected) {
            window.location.reload();
          }
          wasConnected = true;
        }
      };
      source.onerror = function() {
        source.close();
        source = null;
        if (retryCount < maxRetries) {
          var delay = Math.pow(2, retryCount) * 1000;
          retryCount++;
          if (retryTimeout) clearTimeout(retryTimeout);
          retryTimeout = setTimeout(connect, delay);
        }
      };
    }
    function instantConnect() {
      retryCount = 0;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (!source) {
        connect();
      }
    }
    window.addEventListener('focus', instantConnect);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') instantConnect();
    });
    window.addEventListener('beforeunload', function() {
      if (retryTimeout) clearTimeout(retryTimeout);
      if (source) source.close();
    });
    connect();
  })();
</script>
`;
