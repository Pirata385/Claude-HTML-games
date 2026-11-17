package net.ringofbeakers.game;

import android.app.Activity;
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
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.Charset;

/** Runs the bundled HTML game full screen in a WebView, served from the APK's assets. */
public class MainActivity extends Activity {
    // Assets are served from an https origin so localStorage (the save slots) behaves as on the web.
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/game/index.html";

    // Injected at the top of the game's <head> (only inside the app, the game files are untouched).
    // It keeps hold of every AudioContext the game makes, so the app can mute it while in the background.
    private static final String PAUSE_HOOK = "<script>(function(){"
            + "var list=[],paused=false,was=[];"
            + "function wrap(C){if(!C)return C;function W(a,b){var c=arguments.length>1?new C(a,b):arguments.length?new C(a):new C();"
            + "list.push(c);if(paused&&c.suspend)c.suspend();return c;}W.prototype=C.prototype;return W;}"
            + "if(window.AudioContext)window.AudioContext=wrap(window.AudioContext);"
            + "if(window.webkitAudioContext)window.webkitAudioContext=wrap(window.webkitAudioContext);"
            + "window.__rbAppPause=function(){if(paused)return;paused=true;"
            + "try{if(window.RB&&RB.game&&RB.game.save)RB.game.save();}catch(e){}"
            + "was=list.filter(function(c){return c.state==='running';});"
            + "list.forEach(function(c){try{c.suspend();}catch(e){}});};"
            + "window.__rbAppResume=function(){if(!paused)return;paused=false;"
            + "was.forEach(function(c){try{c.resume();}catch(e){}});was=[];};"
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
                return serve(req.getUrl());
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

    private WebResourceResponse serve(Uri uri) {
        if (!HOST.equals(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || !path.startsWith("/game/") || path.contains("..")) return notFound();
        String rel = path.substring(1); // "game/..."
        if (rel.endsWith("/")) rel += "index.html";
        try {
            InputStream in = getAssets().open(rel);
            if (rel.equals("game/index.html")) in = withPauseHook(in);
            return new WebResourceResponse(mime(rel), mime(rel).startsWith("text/") || rel.endsWith(".js") ? "utf-8" : null, in);
        } catch (IOException e) {
            return notFound();
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
