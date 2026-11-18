package net.ringofbeakers.game;

import android.app.Activity;
import android.content.res.AssetFileDescriptor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.util.HashMap;
import java.util.Map;

/** Runs the bundled HTML game full screen in a WebView, served from the APK's assets. */
public class MainActivity extends Activity {
    // Assets are served from an https origin so localStorage (the save slots) behaves as on the web.
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/game/index.html";

    // Injected at the top of the game's <head> (only inside the app, the game files are untouched).
    // It keeps hold of every AudioContext (sound effects, bird calls) and every <audio> element (the
    // recorded music) the game plays, so the app can silence them while in the background. While the
    // app is paused, play() is held back and remembered; on return, whatever was playing plays on.
    private static final String PAUSE_HOOK = "<script>(function(){"
            + "var ctxs=[],media=new Set(),paused=false,wasCtx=[],wasMedia=[];"
            + "function wrap(C){if(!C)return C;function W(a,b){var c=arguments.length>1?new C(a,b):arguments.length?new C(a):new C();"
            + "ctxs.push(c);if(paused&&c.suspend)c.suspend();return c;}W.prototype=C.prototype;return W;}"
            + "if(window.AudioContext)window.AudioContext=wrap(window.AudioContext);"
            + "if(window.webkitAudioContext)window.webkitAudioContext=wrap(window.webkitAudioContext);"
            + "var M=window.HTMLMediaElement&&HTMLMediaElement.prototype,play=M&&M.play;"
            + "function live(el){return !!el.getAttribute('src')&&!el.error;}"
            + "if(play)M.play=function(){media.add(this);"
            + "if(paused){if(wasMedia.indexOf(this)<0)wasMedia.push(this);return Promise.resolve();}"
            + "return play.apply(this,arguments);};"
            + "window.__rbAppPause=function(){if(paused)return;paused=true;"
            + "try{if(window.RB&&RB.game&&RB.game.save)RB.game.save();}catch(e){}"
            + "wasCtx=ctxs.filter(function(c){return c.state==='running';});"
            + "ctxs.forEach(function(c){try{c.suspend();}catch(e){}});"
            + "wasMedia=[];media.forEach(function(el){if(!live(el)){media.delete(el);return;}"
            + "if(!el.paused){wasMedia.push(el);try{el.pause();}catch(e){}}});};"
            + "window.__rbAppResume=function(){if(!paused)return;paused=false;"
            + "wasCtx.forEach(function(c){try{c.resume();}catch(e){}});wasCtx=[];"
            + "wasMedia.forEach(function(el){if(live(el)&&el.paused){var p=play.call(el);if(p&&p.catch)p.catch(function(){});}});wasMedia=[];};"
            + "})();</script>";

    private WebView web;
    private boolean paused;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);

        // The base WebChromeClient shows the native dialogs for window.prompt/confirm/alert
        // (used for renaming birds and for save export/import).
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return serve(req.getUrl(), req.getRequestHeaders());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri u = Uri.parse(url);
                String p = u.getPath();
                if (HOST.equals(u.getHost()) && p != null && p.startsWith("/game/")) return false;
                // "All games" points at the web collection's menu, which is not in the APK: close the app instead.
                finish();
                return true;
            }
        });

        setContentView(web);
        hideBars();
        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    private WebResourceResponse serve(Uri uri, Map<String, String> reqHeaders) {
        if (!HOST.equals(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || !path.startsWith("/game/") || path.contains("..")) return notFound();
        String rel = path.substring(1); // "game/..."
        if (rel.endsWith("/")) rel += "index.html";
        String type = mime(rel);
        String enc = type.startsWith("text/") || rel.endsWith(".js") ? "utf-8" : null;
        try {
            if (rel.equals("game/index.html")) return new WebResourceResponse(type, enc, withPauseHook(getAssets().open(rel)));
            // Files stored uncompressed in the APK (the music) can be read from any byte, so <audio> gets
            // the byte ranges it asks for: it needs them to know a track's length, to seek and to loop.
            AssetFileDescriptor fd;
            try {
                fd = getAssets().openFd(rel);
            } catch (IOException compressed) {
                return new WebResourceResponse(type, enc, getAssets().open(rel));
            }
            long len = fd.getLength();
            Map<String, String> h = new HashMap<String, String>();
            h.put("Accept-Ranges", "bytes");
            long[] r = parseRange(header(reqHeaders, "Range"), len);
            if (r == null) {
                h.put("Content-Length", String.valueOf(len));
                return new WebResourceResponse(type, enc, 200, "OK", h, fd.createInputStream());
            }
            if (r.length == 0) {
                fd.close();
                h.put("Content-Range", "bytes */" + len);
                return new WebResourceResponse(type, enc, 416, "Range Not Satisfiable", h, new ByteArrayInputStream(new byte[0]));
            }
            InputStream in = fd.createInputStream();
            for (long left = r[0]; left > 0; ) {
                long n = in.skip(left);
                if (n <= 0) throw new IOException("short asset");
                left -= n;
            }
            long count = r[1] - r[0] + 1;
            h.put("Content-Range", "bytes " + r[0] + "-" + r[1] + "/" + len);
            h.put("Content-Length", String.valueOf(count));
            return new WebResourceResponse(type, enc, 206, "Partial Content", h, new Limited(in, count));
        } catch (IOException e) {
            return notFound();
        }
    }

    private static String header(Map<String, String> headers, String name) {
        if (headers == null) return null;
        for (Map.Entry<String, String> e : headers.entrySet()) {
            if (e.getKey() != null && e.getKey().equalsIgnoreCase(name)) return e.getValue();
        }
        return null;
    }

    /**
     * A single "bytes=a-b" / "bytes=a-" / "bytes=-n" range: {first, last} (inclusive), clamped to the file.
     * null means "send the whole file" (no header, or one this does not handle); an empty array means
     * the range lies outside the file (416).
     */
    static long[] parseRange(String value, long len) {
        if (value == null) return null;
        value = value.trim();
        if (!value.startsWith("bytes=") || value.indexOf(',') >= 0) return null;
        String spec = value.substring(6).trim();
        int dash = spec.indexOf('-');
        if (dash < 0) return null;
        try {
            String a = spec.substring(0, dash).trim(), b = spec.substring(dash + 1).trim();
            long first, last;
            if (a.isEmpty()) {
                if (b.isEmpty()) return null;
                long n = Long.parseLong(b);
                if (n <= 0 || len == 0) return new long[0];
                first = Math.max(0, len - n);
                last = len - 1;
            } else {
                first = Long.parseLong(a);
                last = b.isEmpty() ? len - 1 : Math.min(Long.parseLong(b), len - 1);
                if (first < 0) return null;
                if (first >= len || first > last) return new long[0];
            }
            return new long[] { first, last };
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Passes on at most {@code left} bytes of the stream underneath. */
    static final class Limited extends FilterInputStream {
        private long left;

        Limited(InputStream in, long left) {
            super(in);
            this.left = left;
        }

        @Override
        public int read() throws IOException {
            if (left <= 0) return -1;
            int c = super.read();
            if (c >= 0) left--;
            return c;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (left <= 0) return -1;
            int n = super.read(b, off, (int) Math.min(len, left));
            if (n > 0) left -= n;
            return n;
        }

        @Override
        public long skip(long n) throws IOException {
            long s = super.skip(Math.min(n, left));
            if (s > 0) left -= s;
            return s;
        }

        @Override
        public int available() throws IOException {
            return (int) Math.min(super.available(), left);
        }

        @Override
        public boolean markSupported() {
            return false;
        }
    }

    private static InputStream withPauseHook(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        for (int n; (n = in.read(chunk)) > 0; ) buf.write(chunk, 0, n);
        in.close();
        Charset utf8 = Charset.forName("UTF-8");
        String html = new String(buf.toByteArray(), utf8);
        int head = html.toLowerCase().indexOf("<head>");
        html = head >= 0 ? html.substring(0, head + 6) + PAUSE_HOOK + html.substring(head + 6) : PAUSE_HOOK + html;
        return new ByteArrayInputStream(html.getBytes(utf8));
    }

    private static WebResourceResponse notFound() {
        WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", null);
        r.setStatusCodeAndReasonPhrase(404, "Not Found");
        return r;
    }

    private static String mime(String p) {
        String l = p.toLowerCase();
        if (l.endsWith(".html") || l.endsWith(".htm")) return "text/html";
        if (l.endsWith(".js")) return "application/javascript";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".json")) return "application/json";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg";
        if (l.endsWith(".svg")) return "image/svg+xml";
        if (l.endsWith(".mp3")) return "audio/mpeg";
        if (l.endsWith(".ogg")) return "audio/ogg";
        if (l.endsWith(".wav")) return "audio/wav";
        if (l.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    @SuppressWarnings("deprecation")
    private void hideBars() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    // Back acts as Escape inside the game (closes windows, leaves sites); on the title screen it exits.
    private static final String BACK_JS =
            "(function(){try{var g=window.RB&&RB.game,u=window.RB&&RB.ui;"
            + "if(g&&g.name==='title'&&!(u&&u.modals&&u.modals.length))return 'exit';"
            + "var o={key:'Escape',code:'Escape',bubbles:true};"
            + "window.dispatchEvent(new KeyboardEvent('keydown',o));"
            + "setTimeout(function(){window.dispatchEvent(new KeyboardEvent('keyup',o));},80);"
            + "return 'ok';}catch(e){return 'exit';}})()";

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript(BACK_JS, new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (v != null && v.contains("exit")) finish();
            }
        });
    }

    // Leaving the app (home button, app switcher, screen off, a call) freezes the game where it is:
    // it saves, its sound is suspended, then every JavaScript timer and animation frame stops.
    // Coming back carries on from the same moment (the game caps each frame's step, so no time jumps).
    @Override
    protected void onPause() {
        super.onPause();
        paused = true;
        web.evaluateJavascript("window.__rbAppPause&&window.__rbAppPause()", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (paused && web != null) web.pauseTimers();
            }
        });
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        paused = false;
        web.resumeTimers();
        web.onResume();
        web.evaluateJavascript("window.__rbAppResume&&window.__rbAppResume()", null);
        hideBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
