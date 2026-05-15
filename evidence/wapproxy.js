/**
 * Wapproxy
 * Copyright (c) 2026 w3l
 * http://wapproxy.w3l.se/
 *
 * WAP Emulator Engine - Live Production Version
 * 1. State Management
 * 2. Routing
 * 3. WML Parsing (Normal -> Quirks (w/ Fix Report) -> Error Modes)
 * 4. WBMP Conversion (Robust Stride Calculation)
 * 5. Proxy Fetching
 * 6. WMLScript Transpiler & Runtime
 */

/* --- GLOBAL STATE --- */
const state = {
    wmlContext: {}, // Stores variable state ($var)
    currentUrl: null,
    referer: null, // Tracks the previous URL for URL.getReferer()
    pendingBack: false, // Flags if the next render is due to a 'back' action
    originalCharset: null // The character encoding of the currently loaded document
};

const ui = {
    form: document.getElementById('url_form'),
    input: document.getElementById('input_url'),
    content: document.getElementById('emulator_content'),
    nav: document.getElementById('emulator_nav'),
    status: document.getElementById('status_message'),

    showToast: (msg) => {
        let container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'wml-toast';
        toast.innerHTML = `
            <span class="wml-toast-msg">${msg}</span>
            <span class="wml-toast-close" onclick="this.parentElement.remove()">×</span>
        `;

        container.appendChild(toast);
    }
};

let engine;
let scriptLoader;

/* --- INITIALIZATION --- */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize WMLScript Runtime
    const lib = new WMLScriptLib();
    scriptLoader = new WMLScriptLoader(lib);
    engine = new WMLEngine(ui.content, ui.nav, ui.status);

    // Handle Form Submit (Enter key) - Triggers Browser Autocomplete
    ui.form.addEventListener('submit', (e) => {
        e.preventDefault();
        let url = ui.input.value.trim();

        // If the user types a bare domain (e.g., wapor.top), prepend http:// so it's
        // treated as an absolute URL instead of a relative path by resolveUrl()
        if (url && !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
            url = 'http://' + url;
        }

        navigateTo(url);
    });

    window.addEventListener('hashchange', handleRouting);
    if (window.location.hash) handleRouting();
});

/* --- ROUTING LOGIC --- */
function navigateTo(url, sendRefererUrl = null, acceptCharset = null) {
    // Resolve WTAI, relative links (if provided), etc.
    // Note: navigateTo usually takes an absolute URL or input from address bar.
    // If it's from address bar, it might be wtai://...
    // We should try to resolve it. But resolveUrl logic handles 'wtai://' specifically.

    // However, resolveUrl might also handle relative URLs which might be dangerous if we don't have base?
    // But input from address bar is usually absolute or intended as such.
    let resolved = resolveUrl(url); 
    if (!resolved) resolved = url; 

    // Handle Internal Actions (e.g. DTMF Toast)
    if (resolved.startsWith('wtai-action:')) {
        const dtmf = resolved.split(';')[1] || "";
        ui.status.textContent = `DTMF Sent: ${dtmf}`;
        setTimeout(() => ui.status.textContent = "Ready", 2000);
        return;
    }

    if (resolved.startsWith('mailto:') || resolved.startsWith('tel:')) {
        window.location.href = resolved;
        return;
    }

    let hash = `url=${encodeURIComponent(resolved)}`;
    if (sendRefererUrl) {
        hash += `&referer=${encodeURIComponent(sendRefererUrl)}`;
    }
    if (acceptCharset) {
        hash += `&charset=${encodeURIComponent(acceptCharset)}`;
    }
    
    window.location.hash = hash;
}

async function handleRouting() {
    const hash = window.location.hash.substring(1);

    // 1. External URL navigation
    if (hash.startsWith('url=')) {
        const params = new URLSearchParams(hash);
        let targetUrl = params.get('url');
        let sendRefererUrl = params.get('referer');
        let acceptCharset = params.get('charset');

        if (!targetUrl) return;

        if (!targetUrl.match(/^https?:\/\//i)) {
            targetUrl = 'http://' + targetUrl;
        }

        ui.content.innerHTML = '<p>Connecting...</p>';
        ui.input.value = targetUrl;

        // Optimization: If base URL matches state.currentUrl, don't fetch, just render card
        if (state.currentUrl && targetUrl.split('#')[0] === state.currentUrl.split('#')[0]) {
            state.referer = state.currentUrl; // Track referer even for internal card switches
            state.currentUrl = targetUrl; // Update state to include new hash
            const cardId = targetUrl.split('#')[1] || null;
            // Ensure we have content (should be there if currentUrl is set)
            if (document.lastWMLResponse) {
                engine.loadDeck(document.lastWMLResponse, cardId);
                ui.status.textContent = "Ready";
                return;
            }
        }

        state.referer = state.currentUrl; // Track referer
        state.currentUrl = targetUrl;
        ui.status.textContent = "Loading...";

        try {
            const cleanTarget = targetUrl.split('?')[0];

            // --- FILE HANDLERS HOOK (PRE-FETCH) ---
            // Check if we should handle this extension WITHOUT fetching text content first.
            // This is critical for binary files like images where fetching as 'text' corrupts them.
            if (typeof FileHandlers !== 'undefined') {
                const lastSlash = cleanTarget.lastIndexOf('/');
                const lastDot = cleanTarget.lastIndexOf('.');
                const ext = (lastDot > lastSlash) ? cleanTarget.substring(lastDot + 1).toLowerCase() : "";

                if (ext && FileHandlers.supports(ext)) {
                    // Start Loading UI
                    ui.status.textContent = "Loading Viewer...";

                    // For text-based formats (JAD, GCD, TXT), we still need to fetch content.
                    // For binaries (Images, JAR), we skip fetch and let the handler render an <img> tag or download link.
                    const isText = ['jad', 'gcd', 'txt'].includes(ext);
                    const isBinary = ['umd', 'thm'].includes(ext);

                    let content = null;

                    if (isText || isBinary) {
                        try {
                            content = await fetchProxy(targetUrl, isBinary ? 'arraybuffer' : 'text');
                        } catch (e) {
                            ui.content.innerHTML = `<p>Error loading file:<br>${e.message}</p>`;
                            ui.status.textContent = "Network Error";
                            return;
                        }
                    }

                    // Render
                    FileHandlers.handle(ext, content, ui.content, targetUrl);
                    ui.status.textContent = "Viewer";
                    return;
                } else if (!ext) {
                    // No recognized extension, or no extension at all (e.g. /download/00841)
                    // We need to do a HEAD request to find out what this is before breaking the XML parser
                    ui.status.textContent = "Probing file type...";
                    try {
                        const headersJson = await fetchProxy(targetUrl, 'text', 'HEAD');
                        const headers = JSON.parse(headersJson);
                        const cType = (headers.contentType || "").toLowerCase();

                        let inferredExt = headers.inferredExt || null;

                        if (inferredExt && FileHandlers.supports(inferredExt)) {
                            ui.status.textContent = "Loading Viewer...";
                            // Re-run the fetch mechanism through the handler
                            const isText = ['jad', 'gcd', 'txt'].includes(inferredExt);
                            const isBinary = ['umd', 'thm'].includes(inferredExt);

                            let content = null;
                            if (isText || isBinary) {
                                content = await fetchProxy(targetUrl, isBinary ? 'arraybuffer' : 'text');
                            }
                            FileHandlers.handle(inferredExt, content, ui.content, targetUrl);
                            ui.status.textContent = "Viewer";
                            return;
                        }
                    } catch (e) {
                        console.warn("HEAD probe failed, falling back to standard WML fetch.", e);
                    }
                }
            }

            const wmlContent = await fetchProxy(targetUrl, 'text', 'GET', null, null, acceptCharset, sendRefererUrl);
            document.lastWMLResponse = wmlContent;
            const cardId = targetUrl.split('#')[1] || null;
            engine.loadDeck(wmlContent, cardId);
        } catch (e) {
            ui.content.innerHTML = `<p>Error loading:<br>${e.message}</p>`;
            ui.status.textContent = "Network Error";
        }
        return;
    }

    // 2. Internal Card navigation
    if (document.lastWMLResponse) {
        const cardId = hash ? hash : null;
        engine.loadDeck(document.lastWMLResponse, cardId);
    }
}



// Helper: Normalize WTAI URIs to standard schemes (e.g. tel:)
// wtai://wp/mc;number -> tel:number
// wtai://wp/sd;dtmf -> tel:dtmf (best effort)
function resolveUrl(href) {
    if (!href) return "";

    // WTAI translation
    if (href.startsWith('wtai://')) {
        // wtai://wp/mc;number
        // wtai://wp/sd;dtmf
        const parts = href.split(';');
        if (parts[0] === 'wtai://wp/ap') {
            const number = decodeURIComponent(parts[1] || "");
            const name = decodeURIComponent(parts[2] || "");
            return `contact.vcard?number=${encodeURIComponent(number)}&name=${encodeURIComponent(name)}`;
        }

        if (parts[0] === 'wtai://wp/sd') {
            const dtmf = decodeURIComponent(parts[1] || "");
            return `wtai-action:sd;${encodeURIComponent(dtmf)}`;
        }

        if (parts.length > 1) {
            return `tel:${parts[1]}`;
        }
    }


    // Decode entities (e.g. &amp; -> &) before resolving, as WML attributes are XML
    // This is crucial if the href comes from getAttribute() which returns the raw value in some parsers?
    // Actually getAttribute returns decoded value usually. 
    // But let's be safe against double-encoding or specific WML quirks.

    // NOTE: We want to resolve '#' hashes to full URLs so the address bar stays consistent check
    // if (href.startsWith('#')) return href; // OLD LOGIC

    if (href.startsWith('http')) return href;

    try {
        if (state.currentUrl) {
            return new URL(href, state.currentUrl).href;
        }
        // Fallback if no current URL (shouldn't happen in app flow)
        return href;
    } catch (e) {
        return href;
    }
}

async function fetchProxy(targetUrl, responseType = 'text', method = 'GET', postBody = null, enctype = null, acceptCharset = null, sendRefererUrl = null) {
    const proxyPath = 'proxy.php';

    try {
        const formData = new FormData();
        formData.append('url', targetUrl);
        
        if (sendRefererUrl) {
            formData.append('referer', sendRefererUrl);
        }

        if (window.siteState && window.siteState.userAgent) {
            formData.append('user_agent', window.siteState.userAgent);
        }

        // Pass method and body if needed
        if (method === 'POST') {
            formData.append('method', 'POST');
            if (enctype) {
                formData.append('enctype', enctype);
            }
            if (acceptCharset) {
                formData.append('accept_charset', acceptCharset);
            }
            if (postBody) {
                formData.append('post_body', postBody);
            }
        } else if (method === 'HEAD') {
            formData.append('method', 'HEAD');
        }

        const response = await fetch(proxyPath, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error(`Proxy: ${response.status}`);

        // Extract original charset from headers if present
        const origCharset = response.headers.get('x-wap-original-charset');
        if (origCharset) {
            state.originalCharset = origCharset;
        }

        if (responseType === 'arraybuffer') {
            return await response.arrayBuffer();
        } else {
            return await response.text();
        }

    } catch (error) {
        console.error("Fetch failed:", error);
        throw error;
    }
}

/* --- WMLSCRIPT STANDARD LIBRARY (Polyfills) --- */
class WMLScriptLib {
    constructor() {
        // --- WMLBrowser ---
        this.WMLBrowser = {
            getVar: (name) => state.wmlContext[name] || "",
            setVar: (name, value) => {
                state.wmlContext[name] = value;
                return true;
            },
            go: (url) => {
                const resolved = resolveUrl(url);
                if (resolved.startsWith('#')) {
                    window.location.hash = resolved.substring(1);
                } else {
                    navigateTo(resolved);
                }
            },
            prev: () => {
                state.pendingBack = true;
                window.history.back();
            },
            next: () => {
                window.history.forward();
            },
            refresh: () => {
                engine.loadDeck(document.lastWMLResponse, engine.currentCardId);
            },
            getCurrentCard: () => engine.currentCardId,
            newContext: () => {
                state.wmlContext = {};
                return "";
            }
        };

        // --- Dialogs ---
        this.Dialogs = {
            alert: (msg) => {
                window.alert(msg);
                return "";
            },
            confirm: (msg, okBtn, cancelBtn) => {
                return window.confirm(msg);
            },
            prompt: (msg, def) => {
                return window.prompt(msg, def);
            }
        };

        // --- String ---
        this.String = {
            length: (s) => String(s).length,
            isEmpty: (s) => !s || String(s).length === 0,
            charAt: (s, index) => String(s).charAt(index),
            subString: (s, start, length) => String(s).substr(start, length),
            find: (s, sub) => String(s).indexOf(sub),
            toString: (v) => String(v),
            format: (fmt, val) => {
                // WAP-194 Section 9.4.8: String.format(format, value)
                // Spec: %[width][.precision]type — only ONE specifier per string.
                // Types: d (integer), f (float), s (string). No %e/%E in WAP-194.
                // The leftmost specifier is replaced; all subsequent ones become "".
                if (!fmt) return String(val);
                let firstDone = false;
                return String(fmt).replace(
                    /%-?[0-9]*(?:\.[0-9]+)?[dfs]/g,
                    (spec) => {
                        if (firstDone) return ''; // Subsequent specifiers → empty string
                        firstDone = true;

                        const leftJustify = spec[1] === '-';
                        const inner = leftJustify ? spec.slice(2) : spec.slice(1);
                        const dotIdx = inner.indexOf('.');
                        const type = inner[inner.length - 1];
                        const widthStr = dotIdx === -1 ? inner.slice(0, -1) : inner.slice(0, dotIdx);
                        const precStr = dotIdx === -1 ? '' : inner.slice(dotIdx + 1, -1);
                        const width = widthStr ? parseInt(widthStr, 10) : 0;
                        const prec = precStr ? parseInt(precStr, 10) : -1;

                        let result;
                        const num = Number(val);
                        switch (type) {
                            case 'd':
                                result = String(Math.trunc(isNaN(num) ? 0 : num));
                                break;
                            case 'f':
                                result = (isNaN(num) ? 0 : num).toFixed(prec >= 0 ? prec : 6);
                                break;
                            case 's':
                                result = String(val);
                                if (prec >= 0 && result.length > prec) result = result.slice(0, prec);
                                break;
                        }

                        // Apply width padding
                        if (width > result.length) {
                            const pad = ' '.repeat(width - result.length);
                            result = leftJustify ? result + pad : pad + result;
                        }
                        return result;
                    }
                );
            },
            trim: (s) => String(s).trim(),
            compare: (s1, s2) => String(s1).localeCompare(String(s2)),
            replace: (s, oldSub, newSub) => String(s).split(oldSub).join(newSub),
            elements: (s, sep) => {
                if (!s) return 0;
                const delimiter = sep || " ";
                return String(s).split(delimiter).length;
            },
            elementAt: (s, index, sep) => {
                if (!s) return "";
                const delimiter = sep || " ";
                const arr = String(s).split(delimiter);
                return (index >= 0 && index < arr.length) ? arr[index] : "";
            },
            squeeze: (s) => String(s).replace(/\s+/g, ' '),
            // escapeString/unescapeString moved to URL lib per standard
            deleteAt: (s, index, sep) => { // Alias for removeAt in some specs, treating as removeAt logic
                if (!s) return "";
                const delimiter = sep || " ";
                const arr = String(s).split(delimiter);
                if (index >= 0 && index < arr.length) arr.splice(index, 1);
                return arr.join(delimiter);
            },
            removeAt: (s, index, sep) => {
                if (!s) return "";
                const delimiter = sep || " ";
                const arr = String(s).split(delimiter);
                if (index >= 0 && index < arr.length) arr.splice(index, 1);
                return arr.join(delimiter);
            },
            insertAt: (s, elem, index, sep) => {
                const delimiter = sep || " ";
                const arr = s ? String(s).split(delimiter) : [];
                if (index < 0) index = 0;
                if (index > arr.length) index = arr.length;
                arr.splice(index, 0, elem);
                return arr.join(delimiter);
            },
            replaceAt: (s, elem, index, sep) => {
                const delimiter = sep || " ";
                const arr = s ? String(s).split(delimiter) : [];
                if (index >= 0 && index < arr.length) arr[index] = elem;
                return arr.join(delimiter);
            }
        };

        // --- URL ---
        // Helper to parse absolute or relative URLs
        const parseUrl = (u) => {
            try {
                return new URL(u);
            } catch (e) {
                try {
                    return new URL(u, "http://wame-dummy.local/");
                } catch (e2) {
                    return null;
                }
            }
        };

        this.URL = {


            isValid: (u) => {
                // WML URL validation is loose; basically assumes it *can* be parsed
                if (!u) return false;
                try {
                    // Check if absolute
                    new URL(u);
                    return true;
                } catch (e) {
                    // Check if valid relative (e.g., path/file.wml)
                    try {
                        new URL(u, "http://dummy");
                        return true;
                    } catch (e2) {
                        return false;
                    }
                }
            },
            getScheme: (u) => {
                try {
                    const url = new URL(u);
                    return url.protocol.replace(':', '');
                } catch (e) { return ""; }
            },
            getHost: (u) => {
                try {
                    const url = new URL(u);
                    return url.hostname;
                } catch (e) { return ""; }
            },
            getPort: (u) => {
                try {
                    const url = new URL(u);
                    return url.port;
                } catch (e) { return ""; }
            },
            getPath: (u) => {
                // Supports relative URLs
                const url = parseUrl(u);
                return url ? url.pathname : "";
            },
            getParameters: (u) => {
                // Returns parameters inside the last path segment (e.g. /path;a=1;b=2 -> a=1;b=2)
                if (!u) return "";
                // Remove fragment and query first
                let clean = u.split('#')[0].split('?')[0];
                const lastSemi = clean.lastIndexOf(';');
                const lastSlash = clean.lastIndexOf('/');

                // Ensure ; is after the last /
                if (lastSemi !== -1 && lastSemi > lastSlash) {
                    return clean.substring(lastSemi + 1);
                }
                return "";
            },
            getQuery: (u) => {
                // Supports relative URLs
                const url = parseUrl(u);
                return url && url.search ? url.search.substring(1) : "";
            },
            getFragment: (u) => {
                // Supports relative URLs
                const url = parseUrl(u);
                // Note: when parsing relative with dummy base, hash is preserved
                return url && url.hash ? url.hash.substring(1) : "";
            },
            getBase: (u) => {
                // Returns absolute URL without fragment and last path segment
                try {
                    const url = new URL(u);
                    const path = url.pathname;
                    const lastSlash = path.lastIndexOf('/');
                    if (lastSlash === -1) return url.origin; // e.g. http://site.com
                    return url.origin + path.substring(0, lastSlash + 1);
                } catch (e) {
                    // For relative, spec behavior is undefined/implementation dependent or empty
                    return "";
                }
            },
            resolve: (base, rel) => { try { return new URL(rel, base).href; } catch (e) { return ""; } },
            escapeString: (s) => encodeURIComponent(String(s)),
            unescapeString: (s) => decodeURIComponent(String(s)),
            loadString: (u, type) => {
                // Synchronous XHR (deprecated but functional in all major browsers).
                // WMLScript loadString() is a blocking call by spec — sync XHR is the
                // correct fit here without requiring a full async/await transpiler rewrite.
                try {
                    const proxyUrl = `proxy.php?url=${encodeURIComponent(resolveUrl(u))}`;
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', proxyUrl, false); // false = synchronous
                    xhr.send();
                    return xhr.status === 200 ? xhr.responseText : '';
                } catch (e) {
                    console.warn('URL.loadString() failed:', e);
                    return ''; // spec: return invalid on network error
                }
            },
            getReferer: () => state.referer || "", // Returns the previous URL
        };


        // --- Lang ---
        this.Lang = {
            parseInt: (v) => parseInt(v, 10),
            parseFloat: (v) => parseFloat(v),
            isInt: (v) => Number.isInteger(Number(v)),
            isFloat: (v) => !Number.isNaN(parseFloat(v)) && Number.isFinite(parseFloat(v)),
            maxInt: () => 2147483647,
            minInt: () => -2147483648,
            float: (v) => parseFloat(v),
            exit: (val) => { throw { type: 'exit', value: val }; },
            random: (n) => Math.floor(Math.random() * n),
            abs: (v) => Math.abs(v),
            min: (a, b) => Math.min(a, b),
            max: (a, b) => Math.max(a, b),
            abort: (msg) => { throw { type: 'exit', value: msg }; },
            seed: (n) => 0, // JS Math.random isn't seedable by default
            characterSet: () => 1000 // UTF-8 (MIBEnum approximation)
        };

        // --- Float ---
        this.Float = {
            int: (f) => Math.floor(f),
            floor: (f) => Math.floor(f),
            ceil: (f) => Math.ceil(f),
            pow: (x, y) => Math.pow(x, y),
            round: (f) => Math.round(f),
            sqrt: (f) => Math.sqrt(f),
            squareroot: (f) => Math.sqrt(f),
            parseFloat: (s) => parseFloat(s),
            maxFloat: () => 3.40282347e+38,
            minFloat: () => 1.17549435e-38
        };

        // --- WTAPublic ---
        this.WTAPublic = {
            makeCall: (number) => {
                console.log("WTAPublic.makeCall", number);
                if (number) {
                    // Use window.location.href to trigger native handler via browser
                    // This bypasses the proxy if it starts with tel:
                    window.location.href = `tel:${number}`;
                }
                return "";
            },
            sendDTMF: (sequence) => {
                if (sequence) {
                    if (ui.showToast) ui.showToast(`DTMF: <span class="toast-user-select-all">${sequence}</span>`);
                }
                return "";
            }
        };
    }
}

/* --- WMLSCRIPT LOADER & TRANSPILER --- */
// ============================================================================
// WMLScript Tokenizer & Transpiler
// ============================================================================

class WMLScriptTokenizer {
    constructor(source) {
        this.source = source;
        this.cursor = 0;
        this.length = source.length;
        this.tokens = [];
        this.line = 1;

        // JS Reserved words that must be renamed if used as identifiers
        // We prefix them with 'ws_' to avoid conflicts.
        this.jsReserved = new Set([
            "async", "await", "break", "case", "catch", "class", "const", "continue",
            "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
            "finally", "for", "function", "if", "import", "in", "instanceof", "let",
            "new", "return", "static", "super", "switch", "this", "throw", "try",
            "typeof", "var", "void", "while", "with", "yield",
            "implements", "interface", "package", "private", "protected", "public"
        ]);
        // WMLScript specific usage
        // 'access', 'http', 'meta', 'use' are pragmas, handled separately
        // 'div', 'mod' are operators
        // 'typeof', 'isvalid' are operators
    }

    tokenize() {
        while (this.cursor < this.length) {
            const char = this.peek();

            if (this.isWhitespace(char)) {
                this.consumeWhitespace();
            } else if (char === '/' && this.peek(1) === '/') {
                this.consumeSingleLineComment();
            } else if (char === '/' && this.peek(1) === '*') {
                this.consumeMultiLineComment();
            } else if (char === '"' || char === "'") {
                this.consumeString(char);
            } else if (this.isDigit(char)) {
                this.consumeNumber();
            } else if (this.isIdentStart(char)) {
                this.consumeIndentifier();
            } else {
                this.consumePunctuationOrOp();
            }
        }
        return this.tokens;
    }

    // --- Consumers ---

    consumeWhitespace() {
        let val = "";
        while (this.cursor < this.length && this.isWhitespace(this.peek())) {
            const c = this.advance();
            val += c;
            if (c === '\n') this.line++;
        }
        this.tokens.push({ type: 'Whitespace', value: val });
    }

    consumeSingleLineComment() {
        let val = "//";
        this.advance(); this.advance(); // //
        while (this.cursor < this.length && this.peek() !== '\n') {
            val += this.advance();
        }
        this.tokens.push({ type: 'Comment', value: val });
    }

    consumeMultiLineComment() {
        let val = "/*";
        this.advance(); this.advance(); // /*
        while (this.cursor < this.length) {
            if (this.peek() === '*' && this.peek(1) === '/') {
                val += "*/";
                this.advance(); this.advance();
                break;
            }
            const c = this.advance();
            val += c;
            if (c === '\n') this.line++;
        }
        this.tokens.push({ type: 'Comment', value: val });
    }

    consumeString(quote) {
        let val = quote;
        this.advance(); // quote
        while (this.cursor < this.length) {
            const c = this.advance();
            val += c;
            if (c === '\\') { // Escape
                if (this.cursor < this.length) val += this.advance();
            } else if (c === quote) {
                break;
            }
            if (c === '\n') this.line++;
        }
        this.tokens.push({ type: 'String', value: val });
    }

    consumeNumber() {
        let val = "";
        while (this.cursor < this.length && (this.isDigit(this.peek()) || this.peek() === '.')) {
            val += this.advance();
        }
        // Handle malformed hex/octal? JS handles standard formats.
        this.tokens.push({ type: 'Number', value: val });
    }

    consumeIndentifier() {
        let val = "";
        while (this.cursor < this.length && this.isIdentChar(this.peek())) {
            val += this.advance();
        }

        // Check for WMLScript special keywords
        if (val === 'div') {
            if (this.peek() === '=') {
                this.advance();
                this.tokens.push({ type: 'Operator', value: 'div=' });
                return;
            }
            this.tokens.push({ type: 'Operator', value: 'div' });
        } else if (val === 'mod') {
            if (this.peek() === '=') {
                this.advance();
                this.tokens.push({ type: 'Operator', value: 'mod=' });
                return;
            }
            this.tokens.push({ type: 'Operator', value: 'mod' });
        } else if (val === 'typeof') {
            this.tokens.push({ type: 'Keyword', value: 'typeof' });
        } else if (val === 'isvalid') {
            this.tokens.push({ type: 'Keyword', value: 'isvalid' });
        } else if (['var', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue', 'extern', 'use', 'access', 'meta'].includes(val)) {
            this.tokens.push({ type: 'Keyword', value: val });
        } else {
            this.tokens.push({ type: 'Identifier', value: val });
        }
    }

    consumePunctuationOrOp() {
        const c = this.advance();
        // Check for 2-char ops: <= >= == != && || << >> ++ -- += -= *= /=
        // WMLScript: same as JS mostly.
        const next = this.peek();
        const two = c + next;
        const three = c + next + this.peek(1);

        if (['<<=', '>>=', '>>>'].includes(three)) {
            this.advance(); this.advance();
            this.tokens.push({ type: 'Operator', value: three });
            return;
        }

        if (['<=', '>=', '==', '!=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>'].includes(two)) {
            this.advance();
            this.tokens.push({ type: 'Operator', value: two });
            return;
        }

        this.tokens.push({ type: 'Punctuation', value: c });
    }

    // --- Helpers ---
    peek(offset = 0) { return this.source[this.cursor + offset] || ''; }
    advance() { return this.source[this.cursor++] || ''; }

    isWhitespace(c) { return /\s/.test(c); }
    isDigit(c) { return /[0-9]/.test(c); }
    isIdentStart(c) { return /[a-zA-Z_]/.test(c); }
    isIdentChar(c) { return /[a-zA-Z0-9_]/.test(c); }
}

class WMLScriptTranspiler {
    constructor(tokens, siteState) {
        this.tokens = tokens;
        this.siteState = siteState;
        this.output = "";
        this.cursor = 0;
    }

    transpile() {
        // Renaming map for checking JS reserved collisions
        // We do this on the fly: IF token is Identifier AND Value is JS_Reserved -> rename
        // BUT we must safeguard property access (obj.await is fine).

        while (this.cursor < this.tokens.length) {
            const token = this.tokens[this.cursor];
            const prev = this.tokens[this.cursor - 1];

            if (token.type === 'Whitespace' || token.type === 'Comment') {
                // Preserve layout
                this.output += token.value;
                this.cursor++;
                continue;
            }

            // Pragma handling
            // remove 'use url ...;' , 'access ...;', 'meta ...;'
            // Identify by Indentifier/Keyword at start or after 'use'
            if ((token.type === 'Identifier' || token.type === 'Keyword') && (token.value === 'access' || token.value === 'meta')) {
                this.skipStatement();
                continue;
            }
            if ((token.type === 'Identifier' || token.type === 'Keyword') && token.value === 'use') {
                // Cleanest way: check next token
                const next = this.peekIgnoreWhitespace();
                if (next && next.value === 'url') {
                    this.skipStatement();
                    continue;
                }
            }

            // Function Declaration
            if ((token.type === 'Identifier' || token.type === 'Keyword') && token.value === 'extern') {
                const next = this.peekIgnoreWhitespace();
                if (next && next.value === 'function') {
                    // Replace 'extern function' with 'function'
                    this.output += 'function';
                    // Consume 'extern' (current)
                    this.cursor++;
                    // Consume intervening whitespace
                    this.consumeWhitespaceToOutput();
                    // Consume 'function'
                    this.cursor++;
                    continue;
                }
            }

            // Operator Replacements
            if (token.type === 'Operator') {
                if (token.value === 'div') { this.output += '/'; this.cursor++; continue; }
                if (token.value === 'div=') { this.output += '/='; this.cursor++; continue; }
                if (token.value === 'mod') { this.output += '%'; this.cursor++; continue; }
                if (token.value === 'mod=') { this.output += '%='; this.cursor++; continue; }
            }

            // typeof / isvalid
            if (token.type === 'Keyword' && (token.value === 'typeof' || token.value === 'isvalid')) {
                const helper = token.value === 'typeof' ? 'checkType' : 'checkValid';
                this.output += helper + '(';
                this.cursor++;

                // Parse operand
                // We need to smart-consume the next "Expression Term"
                this.consumeExpressionTerm();

                this.output += ')';
                continue;
            }

            // Identifier Renaming (WS Prefixing)
            // We prefix ALL identifiers with 'ws_' to avoid collisions with JS reserved words and standard objects
            // UNLESS it is a property access (preceded by '.')
            if (token.type === 'Identifier') {
                const effectivePrev = this.findPreviousEffective();

                // Literals: true, false, invalid (WMLScript)
                if (token.value === 'true' || token.value === 'false') {
                    this.output += token.value;
                    this.cursor++;
                    continue;
                }

                if (token.value === 'invalid') {
                    this.output += 'ws_invalid';
                    this.cursor++;
                    continue;
                }

                // Property access: obj.func() -> do not rename 'func'
                if (effectivePrev && effectivePrev.value === '.') {
                    this.output += token.value;
                    this.cursor++;
                    continue;
                }

                // STRICT MODE: Check for WMLScript Reserved Words
                // If enabled, we throw an error if a reserved word is used as a variable/function name.
                // This prevents "permissive" WMLScript that uses words like 'agent' or 'url' as vars.
                if (this.siteState && this.siteState.breakScriptOnReservedWords) {
                    if (this.isWmlReserved(token.value)) {
                        throw new Error(`WMLScript Error: '${token.value}' is a reserved word.`);
                    }
                }

                // Rename to safe namespace
                this.output += 'ws_' + token.value;
                this.cursor++;
                continue;
            }

            // Default
            this.output += token.value;
            this.cursor++;
        }
        return this.output;
    }

    // --- Helpers ---

    skipStatement() {
        // Consume tokens until ';'
        while (this.cursor < this.tokens.length) {
            const t = this.tokens[this.cursor++];
            if (t.value === ';') break;
        }
    }

    peekIgnoreWhitespace(offset = 0) {
        // Find Nth non-whitespace starting from NEXT token
        let steps = 0;
        for (let j = this.cursor + 1; j < this.tokens.length; j++) {
            if (this.tokens[j].type !== 'Whitespace' && this.tokens[j].type !== 'Comment') {
                if (steps === offset) return this.tokens[j];
                steps++;
            }
        }
        return null;
    }

    consumeWhitespaceToOutput() {
        while (this.cursor < this.tokens.length &&
            (this.tokens[this.cursor].type === 'Whitespace' || this.tokens[this.cursor].type === 'Comment')) {
            this.output += this.tokens[this.cursor++].value;
        }
    }

    findPreviousEffective() {
        for (let i = this.cursor - 1; i >= 0; i--) {
            if (this.tokens[i].type !== 'Whitespace' && this.tokens[i].type !== 'Comment') {
                return this.tokens[i];
            }
        }
        return null;
    }



    isWmlReserved(word) {
        // WMLScript Reserved Words (Standard + Extensions)
        // Using these as identifiers is illegal in standard WMLScript.
        const reserved = [
            "access", "agent", "break", "continue", "div", "div=", "domain", "else", "equ",
            "extern", "for", "function", "header", "http", "if", "in", "invalid", "isvalid",
            "meta", "mod", "mod=", "name", "path", "return", "typeof", "url", "use", "var",
            "while", "with",
            // Future reserved words / extensions often reserved:
            "delete", "null", "true", "false", "void", "to", "int", "float"
        ];
        // Note: div, mod, typeof, isvalid usually come in as operators/keywords, 
        // but if they appear as Identifiers (e.g. var div = 1), this catches them.
        return reserved.includes(word);
    }

    // Heuristic: Consume one "Expression Term" for typeof/isvalid
    // This is tricky. 
    // Cases:
    // typeof(x) -> consume ( ... )
    // typeof x -> consume x
    // typeof x.y -> consume x.y
    // typeof x() -> consume x ( )
    // typeof x[0] -> consume x [ 0 ]
    // typeof 123 -> consume 123
    // typeof "str" -> consume "str"
    // typeof +1 -> consume + 1 (Unary) -- Recursion?
    consumeExpressionTerm() {
        this.consumeWhitespaceToOutput();
        const start = this.tokens[this.cursor];

        // 1. Parenthesized group
        if (start.value === '(') {
            this.consumeGroup('(', ')');
            this.consumeMemberTail(); // Handle (expr).foo
            return;
        }

        // 2. Unary op? +, -, !, ~, ++, --
        if (['+', '-', '!', '~', '++', '--'].includes(start.value)) {
            // Output op
            this.output += start.value;
            this.cursor++;
            // Recurse
            this.consumeExpressionTerm();
            return;
        }

        // 3. Atom (Identifier, Literal)
        if (start.type === 'Identifier' || start.type === 'Number' || start.type === 'String' || start.type === 'Keyword') {
            // Handle substitution for atom itself
            if (start.type === 'Identifier') {
                const effectivePrev = this.findPreviousEffective();

                // Literals
                if (start.value === 'true' || start.value === 'false') {
                    this.output += start.value;
                    this.cursor++;
                    this.consumeMemberTail();
                    return;
                }

                if (start.value === 'invalid') {
                    this.output += 'ws_invalid';
                    this.cursor++;
                    this.consumeMemberTail();
                    return;
                }

                // Property access
                if (effectivePrev && effectivePrev.value === '.') {
                    this.output += start.value;
                } else {
                    // Strict Mode check
                    if (this.siteState && this.siteState.breakScriptOnReservedWords) {
                        if (this.isWmlReserved(start.value)) {
                            throw new Error(`WMLScript Error: '${start.value}' is a reserved word.`);
                        }
                    }
                    this.output += 'ws_' + start.value;
                }
            } else {
                this.output += start.value;
            }
            this.cursor++;

            // 4. Member / Call tail
            // x.y, x[y], x() repeatedly
            this.consumeMemberTail();
            return;
        }

        // Fallback
        this.output += "/*ParseError*/";
    }

    consumeMemberTail() {
        while (this.cursor < this.tokens.length) {
            const wsStart = this.cursor; // Helper to rollback parsing if needed? No, just peek.

            // Check whitespace buffer
            let peekIdx = this.cursor;
            while (peekIdx < this.tokens.length && (this.tokens[peekIdx].type === 'Whitespace' || this.tokens[peekIdx].type === 'Comment')) {
                peekIdx++;
            }
            if (peekIdx >= this.tokens.length) return;

            const next = this.tokens[peekIdx];

            if (next.value === '.') {
                this.consumeWhitespaceToOutput(); // Flush WS
                this.output += '.';
                this.cursor++; // .
                this.consumeWhitespaceToOutput();
                // Expect Identifier
                if (this.tokens[this.cursor].type === 'Identifier') {
                    this.output += this.tokens[this.cursor].value; // Dont rename property
                    this.cursor++;
                }
            } else if (next.value === '[') {
                this.consumeWhitespaceToOutput();
                this.consumeGroup('[', ']');
            } else if (next.value === '(') {
                this.consumeWhitespaceToOutput();
                this.consumeGroup('(', ')');
            } else {
                break; // End of term
            }
        }
    }

    consumeGroup(openChar, closeChar) {
        // Output open
        this.output += openChar;
        this.cursor++;

        let depth = 1;
        while (this.cursor < this.tokens.length && depth > 0) {
            const token = this.tokens[this.cursor];

            // Nested groups
            if (token.value === openChar) depth++;
            if (token.value === closeChar) depth--;

            if (depth === 0) {
                this.output += closeChar;
                this.cursor++;
                break;
            }

            // Handle internal logic (renaming vars inside!)
            // We can treat internal stream as normal code flow?
            // Yes, duplicate main loop logic logic here?
            // Actually, simply calling a "process single token" helper would be best.
            // But we need to handle "recurse into typeof"

            // Simplified: Identifier renaming + standard copy
            // Identifier Renaming (WS Prefixing)
            // We prefix ALL identifiers with 'ws_' to avoid collisions with JS reserved words and standard objects
            // UNLESS it is a property access (preceded by '.')
            if (token.type === 'Identifier') {
                const effectivePrev = this.findPreviousEffective();

                // Literals: true, false, invalid (WMLScript)
                if (token.value === 'true' || token.value === 'false') {
                    this.output += token.value;
                    this.cursor++;
                    continue;
                }

                if (token.value === 'invalid') {
                    this.output += 'ws_invalid';
                    this.cursor++;
                    continue;
                }

                // Property access: obj.func() -> do not rename 'func'
                if (effectivePrev && effectivePrev.value === '.') {
                    this.output += token.value;
                    this.cursor++;
                    continue;
                }

                // STRICT MODE: Check for WMLScript Reserved Words
                if (this.siteState && this.siteState.breakScriptOnReservedWords) {
                    if (this.isWmlReserved(token.value)) {
                        throw new Error(`WMLScript Error: '${token.value}' is a reserved word.`);
                    }
                }

                // Rename to safe namespace
                this.output += 'ws_' + token.value;
                this.cursor++;
                continue;
            } else if (token.type === 'Operator' && token.value === 'div') {
                this.output += '/'; this.cursor++;
            } else if (token.value === 'typeof' || token.value === 'isvalid') {
                // Recurse handling for nested typeof!
                // Reset 'depth' logic is tricky if we branch out.
                // Ideally, we just call the main loop logic recursively?
                // But loop is iterative.

                // QUICK FIX: Handle operators, but for 'typeof' inside parens, 
                // we just fall back to regex?? No, that defeats the purpose.

                // Let's call the logic:
                const helper = token.value === 'typeof' ? 'checkType' : 'checkValid';
                this.output += helper + '(';
                this.cursor++;
                this.consumeExpressionTerm();
                this.output += ')';
            } else {
                this.output += token.value;
                this.cursor++;
            }
        }
    }
}
// ============================================================================
// WMLScript Loader
// ============================================================================

class WMLScriptLoader {
    constructor(lib) {
        this.lib = lib;
    }

    async execute(scriptRef) {
        const parts = scriptRef.split('#');
        const scriptUrl = parts[0];
        const callSig = parts[1];

        if (!scriptUrl || !callSig) return;

        try {
            ui.status.textContent = "Fetching Script...";
            const rawSource = await fetchProxy(resolveUrl(scriptUrl), 'text');

            ui.status.textContent = "Executing Script...";

            // --- ACCESS CONTROL CHECK ---
            if (siteState && siteState.enableAccessControl) {
                const accessMatch = rawSource.match(/access\s+domain\s+["']([^"']+)["']\s*(?:path\s+["']([^"']+)["'])?\s*;/i);
                if (accessMatch) {
                    const allowedDomain = accessMatch[1];
                    const allowedPath = accessMatch[2] || "/";
                    const referer = state.currentUrl || "";

                    let authorized = false;
                    try {
                        const refUrl = new URL(referer);
                        const refHost = refUrl.hostname;
                        const refPath = refUrl.pathname;
                        const domainOk = refHost === allowedDomain || refHost.endsWith('.' + allowedDomain);
                        const pathOk = refPath.startsWith(allowedPath);
                        if (domainOk && pathOk) authorized = true;
                        else console.warn(`WMLScript Access Denied. Caller: ${referer}, Required: ${allowedDomain} ${allowedPath}`);
                    } catch (e) {
                        console.warn("Could not parse referer for access control", e);
                    }

                    if (!authorized) {
                        ui.status.textContent = "Error: Access Denied";
                        console.error("WMLScript Access Denied by pragma");
                        return; // ABORT EXECUTION
                    }
                }
            }

            const jsCode = this.transpile(rawSource);
            // Store for debug dump buttons
            document.lastWMLScriptSource = rawSource;
            document.lastWMLScriptJsCode = jsCode;

            // Note: We inject libraries with 'ws_' prefix to match the transpiler's output
            const sandbox = new Function(
                'ws_WMLBrowser', 'ws_Dialogs', 'ws_String', 'ws_URL', 'ws_Lang', 'ws_Float', 'ws_WTAPublic', 'ws_invalid', 'checkType', 'checkValid',
                jsCode + `\nreturn { ${this.getExports(rawSource)} };`
            );

            // Helpers for typeof / isvalid
            const checkType = (v) => {
                if (Number.isNaN(v)) return 4; // Invalid
                if (typeof v === 'boolean') return 3;
                if (typeof v === 'number') {
                    if (Number.isInteger(v)) return 0; // Integer
                    return 1; // Float
                }
                if (typeof v === 'string') return 2;
                return 4; // Unknown -> Invalid
            };

            const checkValid = (v) => !Number.isNaN(v);

            const module = sandbox(
                this.lib.WMLBrowser,
                this.lib.Dialogs,
                this.lib.String,
                this.lib.URL,
                this.lib.Lang,
                this.lib.Float,
                this.lib.WTAPublic,
                Number.NaN,
                checkType,
                checkValid
            );

            // Transpiled functions are also prefixed with ws_ in getExports
            const match = callSig.match(/([a-zA-Z0-9_]+)\((.*)\)/);
            if (match) {
                const funcName = 'ws_' + match[1]; // Target function is prefixed
                const argsStr = match[2];
                const args = this.parseArgs(argsStr);

                if (module[funcName]) {
                    module[funcName].apply(null, args);
                    ui.status.textContent = "Script OK";

                    if (engine) {
                        engine.loadDeck(document.lastWMLResponse, engine.currentCardId, true);
                    }

                } else {
                    console.error("Function not found:", funcName);
                    ui.status.textContent = "Script Error: Func not found";
                }
            }

        } catch (e) {
            console.error("WMLScript Error:", e);
            if (e.type === 'exit') {
                console.log("Script exited with:", e.value);
            } else {
                ui.status.textContent = `Script Error: ${e.message}`;
            }
        }
    }

    transpile(source) {
        // 1. Tokenize
        const tokenizer = new WMLScriptTokenizer(source);
        const tokens = tokenizer.tokenize();

        // 2. Transpile
        const transpiler = new WMLScriptTranspiler(tokens, siteState);
        let code = transpiler.transpile();

        return code;
    }

    getExports(source) {
        const exports = [];
        // extern function foo(a,b)
        // With tokenizer it's robust, but simple regex is usually fine for exports list unless obfuscated
        // But our transpiler RENEAMES function foo -> function ws_foo
        // So we must export: foo: ws_foo
        const regex = /extern\s+function\s+([a-zA-Z0-9_]+)/g;
        let match;
        while ((match = regex.exec(source)) !== null) {
            const originalName = match[1];
            exports.push(`'ws_${originalName}': ws_${originalName}`);
        }
        return exports.join(', ');
    }
    parseArgs(argsStr) {
        if (!argsStr || argsStr.trim() === "") return [];
        try {
            // URL decode to handle spaces (%20) or other encoded chars from fragments
            const decodedArgs = decodeURIComponent(argsStr);
            return eval(`[${decodedArgs}]`);
        } catch (e) {
            return [];
        }
    }
}

/* --- WML ENGINE CLASS --- */
class WMLEngine {
    constructor(contentContainer, navContainer, statusContainer) {
        this.contentContainer = contentContainer;
        this.navContainer = navContainer;
        this.statusContainer = statusContainer;
        this.parser = new DOMParser();
        this.currentCardId = null;
        this.timerId = null;
        this.timerStartTime = null;
        this.timerVarName = null;
        this.timerDurationMs = 0;
    }

    loadDeck(wmlString, cardId = null, isRefresh = false) {
        // Reset Meta Info immediately to avoid leaking state on fatal parse errors
        if (typeof siteState !== 'undefined' && typeof siteState.updateMetaInfo === 'function') {
            siteState.updateMetaInfo([]);
        }

        if (this.timerId) {
            // Save remaining time to variable if name was provided
            if (this.timerVarName && this.timerStartTime) {
                const elapsedMs = Date.now() - this.timerStartTime;
                let remainingDeciseconds = Math.ceil((this.timerDurationMs - elapsedMs) / 100);
                if (remainingDeciseconds < 0) remainingDeciseconds = 0;
                
                // Only save if it hadn't already hit zero and navigated
                if (remainingDeciseconds > 0) {
                    state.wmlContext[this.timerVarName] = remainingDeciseconds.toString();
                    console.log(`Timer interrupted. Saved ${remainingDeciseconds} to ${this.timerVarName}`);
                }
            }

            clearTimeout(this.timerId);
            this.timerId = null;
            this.timerStartTime = null;
            this.timerVarName = null;
            this.timerDurationMs = 0;
        }

        // Clear Page-Level Image Cache to prevent memory leaks but allow reusing images within the same page
        if (this.wbmpCache) this.wbmpCache.clear();
        else this.wbmpCache = new Map();

        // --- MODE 1: NORMAL (Strict XML) ---
        let xmlDoc = this.parser.parseFromString(wmlString, "text/xml");
        let parseError = xmlDoc.getElementsByTagName("parsererror");

        if (parseError.length === 0) {
            this.statusContainer.textContent = "Ready";
            this.renderDeck(xmlDoc, cardId, isRefresh);
            return;
        }

        // Capture strict error for reporting
        const strictErrorText = parseError[0].textContent;

        // --- MODE 2: QUIRKS (Auto-fix) ---
        console.warn("Strict parsing failed. Attempting Quirks Mode...");
        const fixedWml = this.applyQuirks(wmlString);

        xmlDoc = this.parser.parseFromString(fixedWml, "text/xml");
        parseError = xmlDoc.getElementsByTagName("parsererror");

        if (parseError.length === 0) {
            // Success in Quirks Mode -> Report what we fixed
            const shortError = strictErrorText.split('\n')[0].substring(0, 100);
            this.statusContainer.textContent = `Quirks mode\nFixed: ${shortError}`;

            this.renderDeck(xmlDoc, cardId, isRefresh);
            return;
        }

        // --- MODE 3: DOMParser + QUIRKS (Auto-fix) ---
        console.warn("Quirks Mode failed. Attempting DOMParser...");
        let reserializedWml = this.applyDOMParserHTML(fixedWml);

        xmlDoc = this.parser.parseFromString(reserializedWml, "text/xml");
        parseError = xmlDoc.getElementsByTagName("parsererror");

        if (parseError.length === 0) {
            // Success with DOMParser -> Report what we fixed
            const shortError = strictErrorText.split('\n')[0].substring(0, 100);
            this.statusContainer.textContent = `Quirks mode + DOMParser\nFixed: ${shortError}`;

            this.renderDeck(xmlDoc, cardId, isRefresh);
            return;
        }

        // --- MODE 4: ERROR (Show Source & details) ---
        console.error("Quirks parsing failed. Entering Error Mode.");
        this.renderErrorMode(wmlString, parseError[0]);
    }

    applyQuirks(wmlString) {
        let fixed = wmlString;

        // 0. Fix Encoding Issues (UTF-16LE / UCS-2)
        // Some sites (e.g. mobilmenetrend.hu) serve UTF-16LE without proper headers,
        // causing fetch() to read it as a binary string with nulls and a BOM.
        // We detect the BOM (ÿþ = \u00FF\u00FE or \uFFFE in some contexts) and strip nulls.
        if (fixed.startsWith('\u00FF\u00FE') || fixed.startsWith('\uFFFE')) {
            console.warn("Detected UTF-16LE BOM. Recovering bytes and decoding...");

            // 1. Recover raw bytes from the "Latin-1" (or similar) decoded string
            // We assume fetch() preserved bytes 0x00-0xFF as chars U+0000-U+00FF
            const bytes = new Uint8Array(fixed.length);
            for (let i = 0; i < fixed.length; i++) {
                bytes[i] = fixed.charCodeAt(i) & 0xFF;
            }

            // 2. Decode properly as UTF-16LE
            try {
                const decoder = new TextDecoder('utf-16le');
                fixed = decoder.decode(bytes);
                console.log("UTF-16LE conversion successful.");
            } catch (e) {
                console.error("UTF-16LE conversion failed:", e);
                // Fallback to previous naive strip if decoder fails (unlikely in modern browsers)
                fixed = fixed.replace(/\u0000/g, '');
            }
        }

        fixed = fixed.trim(); // Fix leading/trailing whitespace (e.g. before <?xml declaration)

        // Strip garbage before <?xml ... ?> (e.g. https://mobilmenetrend.hu/index.wml)
        const xmlStart = fixed.indexOf('<?xml');
        if (xmlStart > 0) {
            fixed = fixed.substring(xmlStart);
        }
        // Fix <br> without matching </br>
        fixed = fixed.replace(/<br>(?!<\/br>)/gi, "<br/>");
        // Fix unescaped ampersands
        fixed = fixed.replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#[0-9]+|#[xX][0-9a-fA-F]+);)/g, "&amp;");

        // Fix <p/> used as </p> (Common WML error)
        fixed = fixed.replace(/<p\/>/gi, "</p>");

        // Fix common undefined entities in legacy WML (HTML entities)
        fixed = fixed.replace(/&nbsp;/g, "&#160;");

        // Strip garbage after </wml> (Common issue with tracking scripts or ad injections on legacy proxies)
        // Uses case-insensitive match for the closing tag
        // Fixes: http://wap.allaboutsymbian.com/exnew/index.php
        const wmlEndIndex = fixed.search(/<\/wml>/i);
        if (wmlEndIndex !== -1) {
            fixed = fixed.substring(0, wmlEndIndex + 6); // +6 for length of </wml>
        } else {
            // Missing closing tag? Append it.
            // Fixes: https://www.private-zone.ch/WAP/links.wml
            fixed += "\n</wml>";
        }

        return fixed;
    }

    applyDOMParserHTML(wmlString) {
        // 1. HTML Parsing
        const htmlDoc = new DOMParser().parseFromString(wmlString, "text/html");

        // 2. Obtain the elements
        const htmlWml = htmlDoc.querySelector("wml");
        if (!htmlWml) return wmlString; // Fallback if no <wml> tag found

        // 3. Namespace Sanitation & Deep Clone
        const xmlDoc = document.implementation.createDocument(null, "wml", null);
        const xmlWml = xmlDoc.documentElement;

        const cloneNode = (htmlNode, xmlParent) => {
            Array.from(htmlNode.childNodes).forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const newEl = xmlDoc.createElement(child.tagName.toLowerCase());
                    Array.from(child.attributes).forEach(attr => {
                        newEl.setAttribute(attr.name.toLowerCase(), attr.value);
                    });
                    xmlParent.appendChild(newEl);
                    cloneNode(child, newEl);
                } else if (child.nodeType === Node.TEXT_NODE) {
                    xmlParent.appendChild(xmlDoc.createTextNode(child.textContent));
                } else if (child.nodeType === Node.CDATA_SECTION_NODE) {
                    xmlParent.appendChild(xmlDoc.createCDATASection(child.textContent));
                }
            });
        };

        cloneNode(htmlWml, xmlWml);

        // 4. Header Preservation
        let header = "";
        const xmlMatch = wmlString.match(/^<\?xml[^>]+>/i);
        if (xmlMatch) header += xmlMatch[0] + "\n";

        const doctypeMatch = wmlString.match(/<!DOCTYPE[^>]+>/i);
        if (doctypeMatch) header += doctypeMatch[0] + "\n";

        // 5. Serialize
        const reserialized = new XMLSerializer().serializeToString(xmlDoc);
        return header + reserialized;
    }

    renderErrorMode(rawWml, parserErrorNode) {
        this.contentContainer.innerHTML = '';
        this.navContainer.innerHTML = '';

        const pre = document.createElement('div');
        pre.textContent = rawWml;
        pre.style.fontSize = "10px";
        pre.style.fontFamily = "monospace";
        pre.style.whiteSpace = "pre-wrap"; // Preserve formatting for source code
        this.contentContainer.appendChild(pre);

        const errorText = parserErrorNode.textContent || "Unknown parsing error";
        this.statusContainer.textContent = `Error: Invalid WML/XML response\n\n${errorText}`;
    }

    renderDeck(xmlDoc, cardId, isRefresh = false) {
        try {
            let card;
            if (cardId) {
                card = xmlDoc.querySelector(`card[id="${cardId}"]`);
            }
            if (!card) {
                card = xmlDoc.getElementsByTagName('card')[0];
            }

            if (!card) throw new Error("No cards found.");

            this.renderCard(card, xmlDoc, isRefresh);
        } catch (e) {
            this.contentContainer.innerHTML = `<p>Error rendering deck:<br/>${e.message}</p>`;
        }
    }

    renderCard(card, xmlDoc, isRefresh = false) {
        this.currentCardId = card.getAttribute('id');

        if (this.timerId) {
            // Save remaining time to variable if name was provided
            if (this.timerVarName && this.timerStartTime) {
                const elapsedMs = Date.now() - this.timerStartTime;
                let remainingDeciseconds = Math.ceil((this.timerDurationMs - elapsedMs) / 100);
                if (remainingDeciseconds < 0) remainingDeciseconds = 0;
                
                // Only save if it hadn't already hit zero and navigated
                if (remainingDeciseconds > 0) {
                    state.wmlContext[this.timerVarName] = remainingDeciseconds.toString();
                    console.log(`Timer interrupted. Saved ${remainingDeciseconds} to ${this.timerVarName}`);
                }
            }

            clearTimeout(this.timerId);
            this.timerId = null;
            this.timerStartTime = null;
            this.timerVarName = null;
            this.timerDurationMs = 0;
        }
        // --- ACCESS CONTROL AND META INFO ---
        if (siteState) {
            const head = xmlDoc.getElementsByTagName('head')[0];
            let accessNodes = [];
            let foruaMetaTags = [];
            
            if (head) {
                accessNodes = Array.from(head.getElementsByTagName('access'));
                
                // Extract any meta tags meant for the user agent
                const metaNodes = Array.from(head.getElementsByTagName('meta'));
                metaNodes.forEach(node => {
                    if (node.getAttribute('forua') === 'true') {
                        // Reconstruct a clean representation of the tag
                        const name = node.getAttribute('name');
                        const httpEquiv = node.getAttribute('http-equiv');
                        const content = node.getAttribute('content');
                        const scheme = node.getAttribute('scheme');
                        
                        let tagStr = `<meta`;
                        if (name) tagStr += ` name="${name}"`;
                        if (httpEquiv) tagStr += ` http-equiv="${httpEquiv}"`;
                        if (content) tagStr += ` content="${content}"`;
                        if (scheme) tagStr += ` scheme="${scheme}"`;
                        tagStr += ` forua="true" />`;
                        
                        foruaMetaTags.push(tagStr);
                    }
                });
            }
            
            // Dispatch to UI
            if (typeof siteState.updateMetaInfo === 'function') {
                siteState.updateMetaInfo(foruaMetaTags);
            }

            if (siteState.enableAccessControl && accessNodes.length > 0) {
                // Determine implicit domain/path from the deck's URL
                let implicitDomain = '';
                let implicitPath = '/';
                try {
                    const deckUrl = new URL(state.currentUrl);
                    implicitDomain = deckUrl.hostname;
                    implicitPath = deckUrl.pathname;
                    // Path should be the directory, without the filename
                    const lastSlashIndex = implicitPath.lastIndexOf('/');
                    if (lastSlashIndex !== -1) {
                        implicitPath = implicitPath.substring(0, lastSlashIndex + 1);
                    }
                } catch (e) {
                    console.warn("Could not parse currentUrl for implicit access control fallback.");
                }

                // Check all access nodes
                let accessGranted = false;
                for (let i = 0; i < accessNodes.length; i++) {
                    const access = accessNodes[i];
                    const domain = access.getAttribute('domain') || implicitDomain;
                    // WML spec says path defaults to '/' if omitted, but sometimes it is treated as the document's path.
                    // We will use the document's directory path as the fallback to be safe and logical.
                    const path = access.getAttribute('path') || implicitPath;

                    let refererUrl = null;
                    try {
                        // The referer might be empty if we just started
                        if (state.referer) {
                            refererUrl = new URL(state.referer);
                        }
                    } catch (e) {
                        // Invalid referer
                    }

                    if (refererUrl) {
                        // Domain match (suffix match)
                        // A referer domain must suffix-match the target domain
                        // e.g., target 'google.com' matches 'google.com' and 'www.google.com'
                        const refDomain = refererUrl.hostname;
                        const domainMatch = refDomain === domain || refDomain.endsWith('.' + domain);

                        // Path match (prefix match)
                        // A referer path must prefix-match the target path
                        // e.g., target '/foo' matches '/foo', '/foobar', '/foo/bar'
                        const refPath = refererUrl.pathname;
                        // According to WAP-191-WML-20000219-a section 11.3.1
                        // The path attribute specifies the root-relative path that must be a prefix of the URL
                        const pathMatch = refPath.startsWith(path);

                        if (domainMatch && pathMatch) {
                            accessGranted = true;
                            break;
                        }
                    } else {
                        // If there is an access tag but NO referer, 
                        // WML requires access to be denied unless the domains inherently signify trusting the client?
                        // Generally, access is denied if referer doesn't match attributes.
                        // We strictly deny.
                    }
                }

                if (!accessGranted) {
                    console.warn(`WML Access Control Error: Referer '${state.referer}' does not meet requirements.`);
                    this.contentContainer.innerHTML = `
                        <div style="padding: 10px; color: red; text-align: center;">
                            <h2>Access Denied</h2>
                            <p>This deck has restricted access.</p>
                        </div>
                    `;
                    this.navContainer.innerHTML = '';

                    const btn = document.createElement('button');
                    btn.textContent = 'Back';
                    btn.onclick = () => window.history.back();
                    this.navContainer.appendChild(btn);

                    document.title = `Access Denied - [wapproxy.w3l.se]`;
                    return; // Abort further rendering
                }
            }
        }

        // --- NEW CONTEXT SUPPORT ---
        if (card.getAttribute('newcontext') === 'true') {
            state.wmlContext = {};
        }

        this.contentContainer.innerHTML = '';
        this.navContainer.innerHTML = '';

        // --- TITLE UPDATE ---
        const cardTitle = card.getAttribute('title') || 'Untitled';
        let fullLocation = state.currentUrl;
        if (this.currentCardId) {
            fullLocation += '#' + this.currentCardId;
        }
        document.title = `${cardTitle} - ${fullLocation} [wapproxy.w3l.se]`;

        this.handleTimer(card);

        // --- SOFTKEY & EVENT HANDLING ---
        // Collect softkeys from Template + Card
        let allDoTags = [];

        // 1. Template
        const deckTemplate = xmlDoc.getElementsByTagName('template')[0];
        if (deckTemplate) {
            const templateDos = Array.from(deckTemplate.childNodes).filter(n => n.nodeName === 'do');
            allDoTags = allDoTags.concat(templateDos);

            if (!isRefresh) {
                const eventType = state.pendingBack ? 'onenterbackward' : 'onenterforward';
                const nav = this.handleOnevent(deckTemplate, eventType);
                if (nav) {
                    state.pendingBack = false;
                    return;
                }
            }
        }

        // 2. Card
        // 2. Card
        // Use querySelectorAll to find <do> tags even if they are nested (e.g. inside <p>)
        const cardDos = Array.from(card.querySelectorAll('do'));
        allDoTags = allDoTags.concat(cardDos);

        // Render merged softkeys
        this.renderSoftkeys(allDoTags); // Pass array directly
        if (!isRefresh) {
            const eventType = state.pendingBack ? 'onenterbackward' : 'onenterforward';

            // 1. Check for attribute-based events on the card itself (e.g. <card onenterforward="...">)
            // These take precedence or differ slightly? Spec says they are equivalent to <onevent> <go href="...">
            // We handle them first.
            const dataAttr = state.pendingBack ? card.getAttribute('onenterbackward') : card.getAttribute('onenterforward');
            if (dataAttr) {
                // It's a URL to navigate to (effectively a GO task)
                // We fake a GO task execution by calling handleNavigation directly?
                // Or better, just navigate.
                console.log("Triggering card attribute event:", eventType, dataAttr);

                // Allow a brief timeout so the card renders first? 
                // Spec says "The event occurs... when the user enters the card". 
                // Usually these are immediate redirects.
                // We use processSetVar/etc logic? No, it's just a URL.
                // But we need to support variables in the URL!
                const finalUrl = this.interpolate(dataAttr);
                this.handleNavigation(finalUrl);
                return; // Stop rendering
            }

            // 2. Check for <onevent> elements
            const nav = this.handleOnevent(card, eventType);

            // If we handled a back event, or just a normal entry, consume the flag
            state.pendingBack = false;

            if (nav) return;
        }

        this._collectedLangs = siteState.enableTranslation ? new Set() : null;

        Array.from(card.childNodes).forEach(node => {
            const htmlNode = this.mapNodeToHTML(node);
            if (htmlNode) this.contentContainer.appendChild(htmlNode);
        });

        // --- Single Action Enter Key Submit ---
        const inputs = this.contentContainer.querySelectorAll('input');
        if (inputs.length > 0) {
            const navButtons = Array.from(this.navContainer.querySelectorAll('button:not(.options-close)'));
            const contentLinks = Array.from(this.contentContainer.querySelectorAll('a'));
            
            // Collect all top-level Actions
            let allNavElements = [...navButtons, ...contentLinks];
            
            // Exclude "Options" menu button itself if it exists, since it's just a toggle 
            // (but wait, if there are 4+ softkeys, there are 2 buttons + Options wrapper... making it 3 buttons, which is > 1 anyway so it safely fails).
            
            if (allNavElements.length === 1) {
                const targetEl = allNavElements[0];
                const enterIconUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>';
                
                inputs.forEach(input => {
                    if (inputs.length === 1) {
                        input.style.backgroundImage = `url('${enterIconUrl}')`;
                        input.style.backgroundRepeat = 'no-repeat';
                        input.style.backgroundPosition = 'right 5px center';
                        input.style.backgroundSize = '16px';
                        input.style.paddingRight = '25px';
                    }

                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            // Force blur to trigger any pending 'input' or 'change' events immediately 
                            // before navigation clicks, ensuring WML contexts are fully updated.
                            input.blur(); 
                            targetEl.click();
                        }
                    });
                });
            }
        }

        // Translation: build expectedInputLanguages and notify site.js
        if (siteState.enableTranslation) {
            const langHints = new Set();
            try {
                const hostname = new URL(state.currentUrl).hostname;
                const parts = hostname.split('.');
                const tld = parts[parts.length - 1];
                if (typeof ccTLD2BCP47 === 'function') {
                    const tldLangs = ccTLD2BCP47(tld);
                    if (tldLangs) tldLangs.forEach(l => langHints.add(l));
                }
            } catch (e) {}
            this._collectedLangs.forEach(l => langHints.add(l));

            const eventDetail = langHints.size > 0 ? { expectedInputLanguages: [...langHints] } : {};
            setTimeout(() => document.dispatchEvent(new CustomEvent('wmlrendered', { detail: eventDetail })), 0);
        }
    }

    handleTimer(card) {
        if (this.timerId) {
             clearTimeout(this.timerId);
             this.timerId = null;
             this.timerStartTime = null;
             this.timerVarName = null;
             this.timerDurationMs = 0;
        }

        const onTimerUrl = card.getAttribute('ontimer');
        const onTimerEvent = Array.from(card.childNodes).find(n => n.nodeName === 'onevent' && n.getAttribute('type') === 'ontimer');

        // Need either the shorthand attribute or a <onevent type="ontimer"> element
        if (!onTimerUrl && !onTimerEvent) return;

        const timerTag = card.getElementsByTagName('timer')[0];
        if (timerTag) {
            const name = timerTag.getAttribute('name');
            let value = timerTag.getAttribute('value');
            
            // Priority 1: WML Context Variable
            if (name && state.wmlContext[name]) {
                 const ctxVal = parseInt(state.wmlContext[name], 10);
                 if (!isNaN(ctxVal) && ctxVal >= 0) {
                     value = ctxVal;
                 }
            }

            if (value !== null && value !== undefined) {
                const ms = parseInt(value, 10) * 100; // 1 unit = 0.1 sec
                console.log(`Timer set: ${ms}ms -> ${onTimerUrl || '<onevent>'}`);
                
                this.timerDurationMs = ms;
                this.timerStartTime = Date.now();
                if (name) {
                    this.timerVarName = name;
                    // Initialize if empty to avoid jumping from undefined to saved
                    if (state.wmlContext[name] === undefined) {
                        state.wmlContext[name] = value.toString();
                    }
                }

                this.timerId = setTimeout(() => {
                    // Mark variable as completed
                    if (this.timerVarName) {
                        state.wmlContext[this.timerVarName] = "0";
                    }
                    this.timerId = null;
                    this.timerStartTime = null;
                    this.timerVarName = null;
                    this.timerDurationMs = 0;
                    
                    if (onTimerUrl) {
                        // Shorthand: ontimer="url" attribute on <card>
                        this.handleNavigation(onTimerUrl);
                    } else {
                        // Full form: <onevent type="ontimer"><go href="..."/></onevent>
                        this.handleOnevent(card, 'ontimer');
                    }
                }, ms);
            }
        }
    }

    handleOnevent(parentElement, type) {
        // Find <onevent type="...">
        const events = Array.from(parentElement.childNodes).filter(n => n.nodeName === 'onevent' && n.getAttribute('type') === type);
        let navigated = false;
        events.forEach(evt => {
            if (this.executeTask(evt)) navigated = true;
        });
        return navigated;
    }

    renderSoftkeys(doTags) {
        // doTags is now an Array of <do> elements
        // Sort: items with optional="true" or "optional" go to the end
        doTags.sort((a, b) => {
            const aOpt = a.getAttribute('optional') === 'true' || a.getAttribute('optional') === 'optional';
            const bOpt = b.getAttribute('optional') === 'true' || b.getAttribute('optional') === 'optional';
            if (aOpt && !bOpt) return 1;
            if (!aOpt && bOpt) return -1;
            return 0;
        });

        this.navContainer.innerHTML = '';

        if (doTags.length <= 3) {
            doTags.forEach(doTag => {
                const label = doTag.getAttribute('label') || doTag.getAttribute('type');
                const btn = document.createElement('button');
                btn.textContent = label;
                const isOptional = doTag.getAttribute('optional') === 'true' || doTag.getAttribute('optional') === 'optional';
                if (isOptional) btn.classList.add('do-has-optional');
                btn.onclick = () => this.executeTask(doTag);
                this.navContainer.appendChild(btn);
            });
        } else {
            // Show first 2 softkeys
            for (let i = 0; i < 2; i++) {
                const doTag = doTags[i];
                const label = doTag.getAttribute('label') || doTag.getAttribute('type');
                const btn = document.createElement('button');
                btn.textContent = label;
                const isOptional = doTag.getAttribute('optional') === 'true' || doTag.getAttribute('optional') === 'optional';
                if (isOptional) btn.classList.add('do-has-optional');
                btn.onclick = () => this.executeTask(doTag);
                this.navContainer.appendChild(btn);
            }

            // Options Button
            const optionsBtn = document.createElement('button');
            optionsBtn.textContent = "Options \u22EE";
            optionsBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent clicking through
                const existing = document.querySelector('.options-menu');
                if (existing) {
                    existing.remove();
                    return;
                }
                // Pass the REMAINING tags (index 2+) to the menu
                this.showOptionsMenu(doTags.slice(2));
            };
            this.navContainer.appendChild(optionsBtn);
        }
    }

    showOptionsMenu(items) {
        // Remove existing menu if any
        const existing = document.querySelector('.options-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'options-menu';

        // Header
        const header = document.createElement('div');
        header.className = 'options-menu-header';
        header.innerHTML = '<span>Options</span> <span class="options-close">&times;</span>';

        // Close handler
        header.querySelector('.options-close').onclick = () => menu.remove();

        // List
        const list = document.createElement('div');
        list.className = 'options-menu-list';

        items.forEach(item => {
            const label = item.getAttribute('label') || item.getAttribute('type');
            const btn = document.createElement('button');
            btn.className = 'options-menu-item';
            const isOptional = item.getAttribute('optional') === 'true' || item.getAttribute('optional') === 'optional';
            if (isOptional) btn.classList.add('do-has-optional');
            btn.textContent = label;
            btn.onclick = () => {
                this.executeTask(item);
                menu.remove();
            };
            list.appendChild(btn);
        });

        menu.appendChild(header);
        menu.appendChild(list);

        // Append to phone case or body? Phone case is safer for positioning relative to screen
        // But .phone-case has position relative? Let's check style.css.
        // .phone-case doesn't say relative, but it's a flex container. 
        // We'll append to document.body and position absolute?
        // Actually, style.css puts .options-menu at bottom: 60px; right: 20px;
        // This likely assumes a positioned parent. Let's assume .phone-case should be parent.
        const phoneCase = document.querySelector('.phone-case');
        if (phoneCase) {
            // Ensure phone-case is relative so absolute positioning works
            if (getComputedStyle(phoneCase).position === 'static') {
                phoneCase.style.position = 'relative';
            }
            phoneCase.appendChild(menu);
        } else {
            document.body.appendChild(menu);
        }

        // Close on outside click
        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== menu) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        // Add timeout to avoid immediate close from the button click bubbling
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    processSetVar(containerElement) {
        const setvars = Array.from(containerElement.getElementsByTagName('setvar'));
        setvars.forEach(sv => {
            const name = sv.getAttribute('name');
            const value = sv.getAttribute('value');
            if (name && value !== null) {
                state.wmlContext[name] = this.interpolate(value);
            }
        });
    }

    executeTask(containerElement) {
        const go = containerElement.querySelector('go');
        const prev = containerElement.querySelector('prev');
        const refresh = containerElement.querySelector('refresh');
        const noop = containerElement.querySelector('noop');

        if (go) {
            const href = go.getAttribute('href');
            let method = (go.getAttribute('method') || 'get').toUpperCase();
            let enctype = (go.getAttribute('enctype') || 'application/x-www-form-urlencoded').toLowerCase();
            let acceptCharset = go.getAttribute('accept-charset') || null;

            if (!acceptCharset || acceptCharset.toLowerCase() === 'unknown') {
                acceptCharset = state.originalCharset || null;
            }

            let sendReferer = (go.getAttribute('sendreferer') || 'false').toLowerCase() === 'true';
            let sendRefererUrl = sendReferer ? (state.currentUrl ? state.currentUrl.split('#')[0] : null) : null;

            // --- NEW CONTEXT SUPPORT ---
            if (go.getAttribute('newcontext') === 'true') {
                state.wmlContext = {};
            }

            // Handle <postfield>
            let postData = null;
            const postfields = Array.from(go.getElementsByTagName('postfield'));

            if (postfields.length > 0) {
                if (method === 'POST' && enctype === 'multipart/form-data') {
                    const fields = [];
                    postfields.forEach(pf => {
                        const name = pf.getAttribute('name');
                        const value = pf.getAttribute('value');
                        if (name) {
                            fields.push({ name: name, value: this.interpolate(value || "") });
                        }
                    });
                    postData = JSON.stringify(fields);
                } else {
                    const params = new URLSearchParams();
                    postfields.forEach(pf => {
                        const name = pf.getAttribute('name');
                        const value = pf.getAttribute('value');
                        if (name) {
                            // resolve variables in value
                            const resolvedVal = this.interpolate(value || "");
                            params.append(name, resolvedVal);
                        }
                    });
                    postData = params.toString();
                }
            }

            // If GET, append to URL
            let finalUrl = href;
            if (method === 'GET' && postData) {
                const separator = href.includes('?') ? '&' : '?';
                finalUrl = href + separator + postData;
                postData = null; // Clear postData so we don't send it as body
            }

            this.processSetVar(go);
            this.handleNavigation(finalUrl, method, postData, enctype, acceptCharset, sendRefererUrl);
            return true;

        } else if (prev) {
            this.processSetVar(prev);
            state.pendingBack = true;
            window.history.back();
            return true;
        } else if (refresh) {
            this.processSetVar(refresh);
            // Update variables if setvar exists (simplified, usually inside refresh/go/prev)
            // For Phase 1 we stick to just reloading current deck/card
            this.loadDeck(document.lastWMLResponse, this.currentCardId, true);
            return true;
        }
        return false;
    }

    handleNavigation(href, method = 'GET', postBody = null, enctype = null, acceptCharset = null, sendRefererUrl = null) {
        const interpolated = this.interpolate(href);
        const resolved = resolveUrl(interpolated);

        if (resolved.match(/\.wmlsc?#/)) {
            scriptLoader.execute(resolved);
            return;
        }

        // Logic split removed: resolveUrl now ensures we have a full URL (or a simple hash if things failed)
        // Checks if it starts with # are only relevant if resolveUrl failed to attach base.
        if (resolved.startsWith('#')) {
            // Fallback for when state.currentUrl is missing? 
            window.location.hash = resolved.substring(1);
        } else {
            // Use special hash format for POST or standard for GET
            // Note: Since we use hash routing, we can't easily "bookmark" a POST state
            // For now, we manually trigger the fetch logic if it's a POST
            if (method === 'POST') {
                // Manually trigger external load without changing hash solely?
                // Or encode method in hash? 
                // Let's call pure internal logic for POST to avoid hash complexity or 
                // just do it directly:
                this.loadExternal(resolved, method, postBody, enctype, acceptCharset, sendRefererUrl);
            } else {
                navigateTo(resolved, sendRefererUrl, acceptCharset);
            }
        }
    }

    async loadExternal(url, method = 'GET', postBody = null, enctype = null, acceptCharset = null, sendRefererUrl = null) {
        ui.content.innerHTML = '<p>Sending...</p>';
        ui.status.textContent = "Loading...";

        // Update URL bar for visual feedback
        ui.input.value = url;
        state.currentUrl = url;

        try {
            const wmlContent = await fetchProxy(url, 'text', method, postBody, enctype, acceptCharset, sendRefererUrl);
            document.lastWMLResponse = wmlContent;

            // If it was a POST, we might want to update the hash to reflect we are "at" this URL
            // but effectively we "lost" the state if we refresh. That's standard web behavior.
            window.history.pushState(null, null, `#url=${encodeURIComponent(url)}`);

            const cardId = url.split('#')[1] || null;
            this.loadDeck(wmlContent, cardId);
        } catch (e) {
            ui.content.innerHTML = `<p>Error loading:<br>${e.message}</p>`;
            ui.status.textContent = "Network Error";
        }
    }

    setupMarquee(container, content) {
        let marqueeInterval;
        const speed = 30; // pixels per second
        const pauseEnd = 2000; // ms
        const pauseStart = 500; // ms

        const startMarquee = () => {
            const containerWidth = container.clientWidth;
            // For inline element in nowrap container, scrollWidth/offsetWidth should cover full text
            const contentWidth = content.offsetWidth > content.scrollWidth ? content.offsetWidth : content.scrollWidth;

            if (contentWidth <= containerWidth) return; // No need to scroll

            // Remove ellipsis
            container.classList.add('scrolling');

            const distance = contentWidth - containerWidth;
            const duration = distance / speed;

            // Reset
            content.style.transition = 'none';
            content.style.transform = 'translateX(0)';

            // Force reflow
            void content.offsetWidth;

            // Start sequence
            setTimeout(() => {
                if (!container.matches(':hover') && !container.matches(':focus-within')) return;

                content.style.transition = `transform ${duration}s linear`;
                content.style.transform = `translateX(-${distance}px)`;

                // When done, pause then reset
                const totalTime = (duration * 1000) + pauseEnd;

                // Clear any existing interval to prevent overlap
                if (marqueeInterval) clearInterval(marqueeInterval);

                marqueeInterval = setInterval(() => {
                    // Check if still hovering
                    if (!container.matches(':hover') && !container.matches(':focus-within')) {
                        stopMarquee();
                        return;
                    }

                    // Reset to start (snap)
                    content.style.transition = 'none';
                    content.style.transform = 'translateX(0)';

                    // Wait pauseStart then scroll again
                    setTimeout(() => {
                        if (!container.matches(':hover')) return;
                        content.style.transition = `transform ${duration}s linear`;
                        content.style.transform = `translateX(-${distance}px)`;
                    }, pauseStart);

                }, totalTime + pauseStart); // Loop time

            }, pauseStart);
        };

        const stopMarquee = () => {
            if (marqueeInterval) clearInterval(marqueeInterval);
            marqueeInterval = null;
            content.style.transition = 'none';
            content.style.transform = 'translateX(0)';
            container.classList.remove('scrolling');
        };

        container.addEventListener('mouseenter', startMarquee);
        container.addEventListener('mouseleave', stopMarquee);
        container.addEventListener('focusin', startMarquee);
        container.addEventListener('focusout', stopMarquee);
    }

    mapNodeToHTML(xmlNode) {
        if (xmlNode.nodeType === 3) {
            // WML/HTML whitespace handling: collapse whitespace to single space
            // Do NOT trim, as we need to preserve spaces between elements (e.g. </a> <a>)
            let text = xmlNode.nodeValue.replace(/\s+/g, ' ');

            // Fix: If text is ONLY a space, check parents? 
            // Better: If we are not in a 'pre' tag (which we don't track context for here easily without passing parent),
            // we should be careful. 
            // In typical HTML, whitespace between block elements is ignored.
            // But we treat everything as 'span' if not specific tag.
            // If the text is JUST " ", it often gets wrapped in a span, causing issues like <span> </span> inside <table>.

            // Heuristic: If it's just a space and we have no special context, we might skip it?
            // But that breaks "Word <bold>Word</bold> Word".
            // The real issue is that mapNodeToHTML wraps raw text in a <span>.

            // Fix for Tables: Don't wrap pure whitespace in spans if the parent is a table/tr?
            // We don't have parent info here.

            // Compromise: If it's pure whitespace, return a raw TextNode? 
            // But our mapNodeToHTML expects to return an HTMLElement usually?
            // RenderCard appends it: `this.contentContainer.appendChild(htmlNode);`
            // AppendChild works with TextNodes.

            if (!text || text === ' ') {
                // Return a raw text node instead of a span for single spaces
                // This prevents illegal <span> children inside <table>/<tr> sequences
                return document.createTextNode(text);
            }

            const span = document.createElement('span');
            span.textContent = this.interpolate(text);
            return span;
        }

        if (xmlNode.nodeType === 1) {
            const tagName = xmlNode.nodeName.toLowerCase();
            let htmlEl = null;

            switch (tagName) {
                // --- Text Formatting ---
                case 'p':
                    htmlEl = document.createElement('p');
                    const align = xmlNode.getAttribute('align');
                    if (align) htmlEl.style.textAlign = align;
                    const mode = xmlNode.getAttribute('mode');
                    if (mode && mode.toLowerCase() === 'nowrap') {
                        htmlEl.className = 'wml-nowrap-container';
                        htmlEl._useMarqueeWrapper = true;
                    } else if (mode && mode.toLowerCase() === 'wrap') {
                        htmlEl.style.whiteSpace = 'normal';
                    }
                    break;
                case 'br':
                    htmlEl = document.createElement('br');
                    break;
                case 'font':
                    htmlEl = document.createElement('span');
                    if (window.siteState && window.siteState.enableVendorSpecific) {
                        console.warn("Rendering non-standard tag <font>");
                        const color = xmlNode.getAttribute('color');
                        if (color) {
                            htmlEl.style.color = color;
                        }
                    }
                    break;
                case 'hr':
                    if (window.siteState && window.siteState.enableVendorSpecific) {
                        console.warn("Rendering non-standard tag <hr/>");
                        htmlEl = document.createElement('hr');
                    }
                    break;
                case 'b': case 'strong':
                    htmlEl = document.createElement('strong');
                    break;
                case 'i': case 'em':
                    htmlEl = document.createElement('em');
                    break;
                case 'u':
                    htmlEl = document.createElement('u');
                    break;
                case 'big':
                    htmlEl = document.createElement('big');
                    break;
                case 'small':
                    htmlEl = document.createElement('small');
                    break;
                case 'pre':
                    htmlEl = document.createElement('pre');
                    htmlEl.style.whiteSpace = "pre-wrap";
                    break;

                // --- Tables ---
                case 'table':
                    htmlEl = document.createElement('table');
                    htmlEl.style.width = "100%";
                    const tableTitle = xmlNode.getAttribute('title');
                    if (tableTitle) {
                        const caption = document.createElement('caption');
                        caption.textContent = tableTitle;
                        htmlEl.appendChild(caption);
                    }
                    const tableAlign = xmlNode.getAttribute('align'); // e.g., "LCR"
                    break;
                case 'tr':
                    htmlEl = document.createElement('tr');
                    const trAlign = xmlNode.getAttribute('align');
                    if (trAlign) {
                        // WML uses 'L', 'C', 'R' often, but standard HTML values too
                        if (trAlign.toUpperCase() === 'C') htmlEl.style.textAlign = 'center';
                        else if (trAlign.toUpperCase() === 'R') htmlEl.style.textAlign = 'right';
                        else if (trAlign.toUpperCase() === 'L') htmlEl.style.textAlign = 'left';
                        else htmlEl.style.textAlign = trAlign;
                    }
                    break;
                case 'td':
                    htmlEl = document.createElement('td');
                    const tdAlign = xmlNode.getAttribute('align');
                    if (tdAlign) {
                        if (tdAlign.toUpperCase() === 'C') htmlEl.style.textAlign = 'center';
                        else if (tdAlign.toUpperCase() === 'R') htmlEl.style.textAlign = 'right';
                        else if (tdAlign.toUpperCase() === 'L') htmlEl.style.textAlign = 'left';
                        else htmlEl.style.textAlign = tdAlign;
                    }
                    break;

                // --- Forms & Grouping ---
                case 'fieldset':
                    htmlEl = document.createElement('fieldset');
                    const title = xmlNode.getAttribute('title');
                    if (title) {
                        const legend = document.createElement('legend');
                        legend.textContent = title;
                        htmlEl.appendChild(legend);
                    }
                    break;

                // --- Interaction ---
                case 'a':
                case 'anchor':
                    htmlEl = document.createElement('a');
                    if (tagName === 'a') {
                        const href = xmlNode.getAttribute('href');
                        const finalHref = this.interpolate(href);
                        const title = xmlNode.getAttribute('title');

                        if (title) {
                            htmlEl.title = title;
                        }

                        // Decide if this link should be handled natively by the browser
                        // 1. Protocols: mailto, tel
                        // 2. Binaries: jar, zip, etc (to allow downloads)
                        // 3. Explicit targets: target="_blank" (to allow new tabs)
                        // Note: audio extensions (mp3, mid, wav, etc.) are intentionally NOT
                        // listed here — they are handled by renderSound via normal proxy navigation.
                        const isBinary = finalHref.match(/\.(cod|sis|sisx|cab|exe|zip)$/i);
                        const targetAttr = xmlNode.getAttribute('target');
                        const isNative = finalHref.startsWith('mailto:') || finalHref.startsWith('tel:') || isBinary || targetAttr;

                        // Always resolve the href against the WML document URL so relative
                        // paths work correctly regardless of which branch handles them.
                        const resolved = resolveUrl(finalHref);

                        if (isNative) {
                            htmlEl.href = resolved;
                            if (targetAttr) htmlEl.target = targetAttr;
                        } else {
                            htmlEl.href = resolved;
                        }

                        htmlEl.onclick = (e) => {
                            if (isNative) {
                                // Allow default behavior (open mail client / download / new tab)
                                return;
                            }

                            e.preventDefault();
                            this.handleNavigation(href);
                        };
                        const a_accesskey = xmlNode.getAttribute('accesskey');
                        if (a_accesskey) htmlEl.accessKey = a_accesskey;

                        const a_tabindex = xmlNode.getAttribute('tabindex');
                        if (a_tabindex) htmlEl.tabIndex = parseInt(a_tabindex, 10);
                    } else {
                        htmlEl.style.cursor = "pointer";
                        const title = xmlNode.getAttribute('title');

                        // Try to find destination for tooltip & status bar
                        const goTag = xmlNode.querySelector('go');
                        if (goTag && goTag.getAttribute('href')) {
                            const rawDest = this.interpolate(goTag.getAttribute('href'));
                            const dest = resolveUrl(rawDest);

                            if (title) {
                                htmlEl.title = title;
                            }
                            // Else: no title, browser shows nothing or just href in status bar. 
                            // We don't need to force it.
                            // Set href for status bar / native behavior consistency
                            htmlEl.href = dest;
                        } else {
                            htmlEl.title = title || "Action";
                            htmlEl.href = "#"; // Fallback to avoid dead link look
                        }

                        htmlEl.onclick = (e) => {
                            e.preventDefault();
                            this.executeTask(xmlNode);
                        };
                        const anc_accesskey = xmlNode.getAttribute('accesskey');
                        if (anc_accesskey) htmlEl.accessKey = anc_accesskey;

                        const anc_tabindex = xmlNode.getAttribute('tabindex');
                        if (anc_tabindex) htmlEl.tabIndex = parseInt(anc_tabindex, 10);
                    }
                    break;

                case 'img':
                    const src = xmlNode.getAttribute('src');
                    const alt = xmlNode.getAttribute('alt') || 'image'; // WML requires alt, defaulting if missing
                    htmlEl = document.createElement('span');
                    htmlEl.className = 'wml-image-container';
                    htmlEl.title = alt;

                    // Default state: Show [Alt] while loading
                    htmlEl.textContent = `[${alt}]`;

                    const localsrc = xmlNode.getAttribute('localsrc');
                    let localIcon = null;
                    if (localsrc && typeof getLocalsrcPictogram === 'function') {
                        localIcon = getLocalsrcPictogram(localsrc);
                    }

                    if (localIcon) {
                        htmlEl.textContent = localIcon;
                        htmlEl.style.border = "none";
                        htmlEl.style.textDecoration = "none";
                        htmlEl.title = alt;
                    } else if (src) {
                        const resolvedSrc = resolveUrl(this.interpolate(src));
                        // PASS 'alt' to the loader so it can revert to it on failure
                        this.loadImage(resolvedSrc, htmlEl, alt);
                    }

                    const hspace = xmlNode.getAttribute('hspace');
                    if (hspace) {
                        htmlEl.style.marginLeft = hspace + 'px';
                        htmlEl.style.marginRight = hspace + 'px';
                    }

                    const vspace = xmlNode.getAttribute('vspace');
                    if (vspace) {
                        htmlEl.style.marginTop = vspace + 'px';
                        htmlEl.style.marginBottom = vspace + 'px';
                    }
                    break;

                case 'input':
                    htmlEl = document.createElement('input');
                    htmlEl.style.maxWidth = '100%';
                    htmlEl.style.boxSizing = 'border-box';

                    const type = xmlNode.getAttribute('type');
                    htmlEl.type = (type === 'password') ? 'password' : 'text';

                    const varName = xmlNode.getAttribute('name');
                    if (varName) {
                        let newName = state.currentUrl + "-" + (this.currentCardId || 'default') + "-" + varName;
                        htmlEl.name = newName.replace(/[^A-Za-z0-9_-]/g, '-');
                    }
                    const initVal = xmlNode.getAttribute('value');
                    const format = xmlNode.getAttribute('format');
                    const maxlength = xmlNode.getAttribute('maxlength');
                    // const emptyok = xmlNode.getAttribute('emptyok'); // Handled by validation usually, or required attribute

                    if (maxlength) {
                        htmlEl.maxLength = parseInt(maxlength, 10);
                    }

                    const size = xmlNode.getAttribute('size');
                    if (size) {
                        htmlEl.size = parseInt(size, 10);
                    }

                    const emptyok = xmlNode.getAttribute('emptyok');
                    if (emptyok === 'false') {
                        htmlEl.required = true;
                    }

                    const i_accesskey = xmlNode.getAttribute('accesskey');
                    if (i_accesskey) htmlEl.accessKey = i_accesskey;

                    const i_tabindex = xmlNode.getAttribute('tabindex');
                    if (i_tabindex) htmlEl.tabIndex = parseInt(i_tabindex, 10);

                    // Priority: Context Value -> Attribute Value -> Empty
                    const currentVal = state.wmlContext[varName] || initVal || "";
                    htmlEl.value = currentVal;

                    if (varName && !state.wmlContext[varName] && initVal) {
                        state.wmlContext[varName] = initVal;
                    }

                    if (format) {
                        // 1. Transpile WML format to HTML5 pattern validation
                        try {
                            const transpileWmlFormat = (fmt) => {
                                let regexStr = '^';
                                let i = 0;
                                const map = {
                                    'A': '[^\\p{Ll}\\p{N}]', 'a': '[^\\p{Lu}\\p{N}]',
                                    'N': '\\p{N}', 'n': '[^\\p{L}]',
                                    'X': '[^\\p{Ll}]', 'x': '[^\\p{Lu}]',
                                    'M': '.', 'm': '.'
                                };

                                while (i < fmt.length) {
                                    let char = fmt[i];

                                    if (char === '\\') {
                                        if (i + 1 < fmt.length) {
                                            const nx = fmt[++i];
                                            const isSyntaxChar = /[\^$.*+?()[\]{}|\\]/.test(nx);
                                            regexStr += (isSyntaxChar ? '\\' + nx : nx);
                                        }
                                        i++;
                                        continue;
                                    }

                                    let quantifier = '';
                                    if (char === '*') {
                                        if (i + 1 < fmt.length && map[fmt[i + 1]]) {
                                            quantifier = '*';
                                            i++;
                                            char = fmt[i];
                                        } else {
                                            regexStr += '\\*';
                                            i++;
                                            continue;
                                        }
                                    } else if (/[0-9]/.test(char)) {
                                        let numStr = '';
                                        while (i < fmt.length && /[0-9]/.test(fmt[i])) {
                                            numStr += fmt[i];
                                            i++;
                                        }
                                        if (i < fmt.length && map[fmt[i]]) {
                                            quantifier = `{1,${numStr}}`;
                                            char = fmt[i];
                                        } else {
                                            regexStr += numStr;
                                            continue;
                                        }
                                    }

                                    if (map[char]) {
                                        regexStr += map[char] + quantifier;
                                    } else {
                                        const isSyntaxChar = /[\^$.*+?()[\]{}|\\]/.test(char);
                                        regexStr += isSyntaxChar ? '\\' + char : char;
                                    }
                                    i++;
                                }
                                return regexStr + '$';
                            };

                            const patternStr = transpileWmlFormat(format);
                            if (patternStr) {
                                htmlEl.setAttribute('pattern', patternStr);
                                htmlEl.title = `Format: ${format}`;
                            }
                        } catch (e) {
                            console.error("Format transpilation failed", e);
                        }

                        // 2. Smart keyboard hints
                        if (/^[\*0-9]*N+$/.test(format)) {
                            htmlEl.setAttribute('inputmode', 'numeric');
                        }
                        if (/^[\*0-9]*M+$/.test(format) ||
                            /^[\*0-9]*A+$/.test(format) ||
                            /^[\*0-9]*X+$/.test(format)) {
                            htmlEl.setAttribute('autocapitalize', 'characters');
                        }
                    }

                    htmlEl.addEventListener('input', (e) => {
                        let val = e.target.value;

                        // Basic WML Format Masking Logic
                        if (format) {
                            // Quick heuristics for common simple masks
                            // N or *N = Numeric
                            if (/^[\*0-9]*N+$/.test(format)) {
                                // Allow digits
                                val = val.replace(/[^0-9]/g, '');
                            }                            
                            if (/^[\*0-9]*n+$/.test(format)) {
                                // Allow digits AND common separators (slash, dash, dot, space, colon, parens)
                                // This fixes "NN/NN/NN" (dates) being stripped to "NNNNNN"
                                val = val.replace(/[^0-9\/\-\.\:\(\)\s]/g, '');
                            }
                            // A, M, X -> Uppercase
                            if (/^[\*0-9]*A+$/.test(format) || /^[\[0-9]*X+$/.test(format)) {
                                val = val.toUpperCase();
                            }
                        }

                        if (val !== e.target.value) {
                            htmlEl.value = val;
                        }

                        if (varName) state.wmlContext[varName] = val;
                    });
                    break;

                case 'select':
                    htmlEl = document.createElement('select');
                    htmlEl.style.maxWidth = '100%';
                    htmlEl.style.boxSizing = 'border-box';
                    const name = xmlNode.getAttribute('name');
                    const multiple = xmlNode.getAttribute('multiple') === 'true';
                    const iname = xmlNode.getAttribute('iname'); // index var name
                    const ivalue = xmlNode.getAttribute('ivalue'); // default index
                    
                    if (iname) htmlEl.dataset.iname = iname;
                    if (ivalue) htmlEl.dataset.ivalue = ivalue;

                    if (multiple) htmlEl.multiple = true;

                    // Bind value
                    if (name) {
                        htmlEl.name = name;
                        // Value binding moved to post-processing
                    }

                    htmlEl.addEventListener('change', (e) => {
                        let val = e.target.value;
                        let indexVals = [];
                        
                        // Calculate standard value and index value
                        if (multiple) {
                            const selected = Array.from(htmlEl.selectedOptions).map(opt => opt.value).join(';');
                            indexVals = Array.from(htmlEl.selectedOptions).map(opt => opt.index + 1);
                            val = selected;
                        } else {
                            if (htmlEl.selectedIndex >= 0) {
                                indexVals.push(htmlEl.selectedIndex + 1);
                            }
                        }

                        if (name) {
                            state.wmlContext[name] = val;
                        }
                        
                        if (iname && indexVals.length > 0) {
                            state.wmlContext[iname] = indexVals.join(';');
                        }

                        // Handle onpick
                        // Note: For multiple select, this only handles the 'primary' selection which might be simplistic
                        // but correct for single-select navigation menus.
                        const selectedOption = htmlEl.selectedOptions[0];
                        if (selectedOption && selectedOption.dataset.onpick) {
                            this.handleNavigation(selectedOption.dataset.onpick);
                        }
                    });

                    const s_accesskey = xmlNode.getAttribute('accesskey');
                    if (s_accesskey) htmlEl.accessKey = s_accesskey;

                    const s_tabindex = xmlNode.getAttribute('tabindex');
                    if (s_tabindex) htmlEl.tabIndex = parseInt(s_tabindex, 10);
                    break;

                case 'optgroup':
                    htmlEl = document.createElement('optgroup');
                    htmlEl.label = xmlNode.getAttribute('title') || "";
                    break;

                case 'option':
                    htmlEl = document.createElement('option');
                    htmlEl.value = xmlNode.getAttribute('value') || "";

                    const onpick = xmlNode.getAttribute('onpick');
                    if (onpick) {
                        // WML <option onpick="url"> behaves like a link when selected
                        // For a standard HTML select, this is tricky. 
                        // We attach a listener to the option (or rather check parent select logic)
                        // But standard HTML <option> doesn't support click well.
                        // We will rely on the parent select 'change' listener to detect this if needed, 
                        // OR (hack) we treat this as a navigation trigger if the user picks it.
                        // Implementation: We'll store it in a data attribute.
                        htmlEl.dataset.onpick = onpick;
                    }
                    break;

                // --- Ignored / Logic-only tags ---
                case 'timer':
                case 'do': case 'card': case 'template':
                case 'go': case 'prev': case 'refresh':
                case 'noop':
                case 'postfield': case 'onevent':
                case 'access': case 'meta': case 'head':
                    return null;

                default:
                    // Fallback: render children
                    htmlEl = document.createElement('span');
            }

            if (htmlEl) {
                // xml:lang → dir="rtl": if the WML element declares an RTL language,
                // set dir on the HTML element so the browser applies correct BiDi rendering.
                const xmlLang = xmlNode.getAttribute('xml:lang');
                if (xmlLang) {
                    // Primary language subtag only (e.g. "ar-EG" → "ar")
                    const lang = xmlLang.split('-')[0].toLowerCase();
                    const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'dv', 'yi', 'ug', 'ku', 'ks', 'sd', 'syr']);
                    if (RTL_LANGS.has(lang)) {
                        htmlEl.dir = 'rtl';
                    }
                    // Collect for expectedInputLanguages hint
                    if (this._collectedLangs) this._collectedLangs.add(lang);
                }

                let targetContainer = htmlEl;
                if (htmlEl._useMarqueeWrapper) {
                    const wrapper = document.createElement('span');
                    wrapper.className = 'wml-nowrap-content';
                    htmlEl.appendChild(wrapper);
                    targetContainer = wrapper;
                    this.setupMarquee(htmlEl, wrapper);
                }

                Array.from(xmlNode.childNodes).forEach(child => {
                    const childEl = this.mapNodeToHTML(child);
                    if (childEl) targetContainer.appendChild(childEl);
                });

                // Post-processing for Select: Bind Value and Handle onpick transition
                if (tagName === 'select') {
                    // Late binding of value (after options are added)
                    
                    // Priority 1: Context variable for iname
                    const inameAttr = htmlEl.dataset.iname;
                    let initialIndex = null;
                    if (inameAttr && state.wmlContext[inameAttr]) {
                        initialIndex = state.wmlContext[inameAttr];
                    } 
                    // Priority 2: ivalue attribute
                    else if (htmlEl.dataset.ivalue) {
                        initialIndex = htmlEl.dataset.ivalue;
                        if (inameAttr) state.wmlContext[inameAttr] = initialIndex; // Initialize context
                    }

                    if (initialIndex) {
                        const indices = initialIndex.split(';').map(n => parseInt(n, 10));
                        Array.from(htmlEl.options).forEach((opt, idx) => {
                            if (indices.includes(idx + 1)) {
                                opt.selected = true;
                            }
                        });
                        
                        // Ensure standard value name context is also updated if not yet set
                        if (htmlEl.name && !state.wmlContext[htmlEl.name]) {
             	              if (htmlEl.multiple) {
                                state.wmlContext[htmlEl.name] = Array.from(htmlEl.selectedOptions).map(o => o.value).join(';');
                            } else if (htmlEl.selectedOptions.length > 0) {
                                state.wmlContext[htmlEl.name] = htmlEl.selectedOptions[0].value;
                            }
                        }
                    } else if (htmlEl.name) {
                        // Priority 3: Fall back to standard name / value binding if no iname/ivalue applies
                        const boundVal = state.wmlContext[htmlEl.name] || xmlNode.getAttribute('value');
                        if (boundVal) {
                            // Split by semi-colon for multiple
                            const vals = boundVal.split(';');
                            Array.from(htmlEl.options).forEach((opt) => {
                                if (vals.includes(opt.value)) {
                                    opt.selected = true;
                                }
                            });
                        }
                    }

                    // Check if we need to convert to a List (for onpick support or vendor specific images)
                    const hasOnPick = htmlEl.querySelector('option[data-onpick]');
                    const vendorSpecificImages = window.siteState && window.siteState.enableVendorSpecific && htmlEl.querySelector('img');

                    if (hasOnPick || vendorSpecificImages) {
                        const list = document.createElement('div');
                        list.className = 'wml-select-list';
                        list.style.display = 'flex';
                        list.style.flexDirection = 'column';
                        list.style.gap = '2px';

                        Array.from(htmlEl.options).forEach(opt => {
                            const row = document.createElement('div');
                            row.className = 'wml-list-item';
                            // Styling
                            Object.assign(row.style, {
                                cursor: 'pointer',
                                padding: '6px 4px',
                                borderBottom: '1px dotted #ccc',
                                display: 'flex',
                                alignItems: 'center'
                            });

                            // Pseudo-Radio/Checkbox indicator
                            const indicator = document.createElement('span');
                            indicator.style.marginRight = '8px';
                            // We use characters for simplicity, or we could use real radio inputs disabled?
                            // Let's use characters to look "texty" like WAP
                            indicator.textContent = opt.selected ? "●" : "○";

                            const text = document.createElement('span');
                            
                            if (window.siteState && window.siteState.enableVendorSpecific) {
                                while (opt.firstChild) {
                                    text.appendChild(opt.firstChild);
                                }
                            } else {
                                text.textContent = opt.text;
                            }

                            row.appendChild(indicator);
                            row.appendChild(text);

                            row.onclick = (e) => {
                                e.stopPropagation(); // Prevent bubbling issues

                                // Update selection UI (Single Select Mode for now)
                                // We assume navigation menus are usually single select
                                Array.from(list.children).forEach(child => {
                                    child.firstChild.textContent = "○";
                                    child.style.fontWeight = "normal";
                                    child.style.backgroundColor = "transparent";
                                });
                                indicator.textContent = "●";
                                row.style.fontWeight = "bold";
                                row.style.backgroundColor = "#f0f0f0";

                                // Trigger Logic
                                const val = opt.value;
                                if (htmlEl.name) {
                                    state.wmlContext[htmlEl.name] = val;
                                }
                                
                                if (htmlEl.dataset.iname) {
                                    state.wmlContext[htmlEl.dataset.iname] = String(opt.index + 1);
                                }

                                if (opt.dataset.onpick) {
                                    this.handleNavigation(opt.dataset.onpick);
                                }
                            };

                            // Initial highlight
                            if (opt.selected) {
                                row.style.fontWeight = "bold";
                                row.style.backgroundColor = "#f0f0f0"; // Slight highlight
                            }

                            list.appendChild(row);
                        });

                        // Replace the select element with our list
                        htmlEl = list;
                    }
                }

                // Post-processing for Table Alignment (WML 'align' attribute on <table>)
                // L=Left, C=Center, R=Right. String maps to columns index 0..N
                if (tagName === 'table') {
                    const alignStr = xmlNode.getAttribute('align');
                    if (alignStr) {
                        const rows = htmlEl.getElementsByTagName('tr');
                        Array.from(rows).forEach(tr => {
                            const cells = tr.children; // td elements
                            for (let i = 0; i < cells.length; i++) {
                                // Only apply if the cell doesn't have its own alignment (attribute or style)
                                // WML spec says cell alignment overrides row/table alignment.
                                const cell = cells[i];

                                // Check if we already applied strict styling in the 'td' case? 
                                // In the 'td' case (lines 870+), we set textAlign if 'align' attribute exists.
                                // So we check if style.textAlign is empty.
                                if (!cell.style.textAlign) {
                                    const char = alignStr.charAt(i).toUpperCase();
                                    if (char === 'C') cell.style.textAlign = 'center';
                                    else if (char === 'R') cell.style.textAlign = 'right';
                                    else if (char === 'L') cell.style.textAlign = 'left';
                                }
                            }
                        });
                    }
                }
            }
            return htmlEl;
        }
        return null;
    }

    interpolate(text) {
        if (!text) return "";
        // Match:
        // 1. $(var:mod) or $(var)  -> Group 1 (var), Group 2 (mod)
        // 2. $var                  -> Group 3 (var)
        return text.replace(/\$\(([a-zA-Z0-9_]+)(?::([a-zA-Z]+))?\)|\$([a-zA-Z0-9_]+)/g, (match, p1, p2, p3) => {
            const varName = p1 || p3;
            const modifier = p2;
            const val = state.wmlContext[varName] || '';

            if (modifier) {
                switch (modifier) {
                    case 'escape':
                    case 'e':
                        return encodeURIComponent(val);
                    case 'unesc':
                    case 'unescape': // Alias just in case
                    case 'u':
                        return decodeURIComponent(val);
                    case 'noesc':
                    case 'n':
                        return val;
                }
            }
            // Default behavior
            return val;
        });
    }

    loadImage(url, container, alt = "Image") {
        console.log(`loadImage called for: ${url}`);

        // Heuristic: Check extension for WBMP
        // Regex fix: Allow query parameters after .wbmp (e.g. image.wbmp?x=1)
        if (url.match(/\.wbmp(\?.*)?$/i)) {
            console.log("Detected WBMP extension -> Using Canvas Decoder");
            this.loadWbmp(url, container);
            return;
        }

        // Otherwise, assume it's a standard image (PNG, GIF, JPEG)
        console.log("Detected Standard Image -> Using Native Rendering");
        container.innerHTML = '';
        const img = document.createElement('img');
        img.alt = alt;
        img.style.maxWidth = "100%";

        // 1. Try Direct URL (Native Browser Rendering)
        img.src = url;

        // 2. Fallback: If blocked (Mixed Content) or CORS fail, use Proxy
        img.onerror = () => {
            // Prevent infinite loop if proxy also fails
            if (img.src.includes('proxy.php')) {
                container.textContent = `[${alt}]`; // Give up
                return;
            }
            console.warn("Native image load triggered onerror (Mixed Content?), falling back to Proxy:", url);
            img.src = `proxy.php?url=${encodeURIComponent(url)}`;
        };

        container.appendChild(img);
    }

    async loadWbmp(url, container) {
        try {
            // Check Page Cache
            if (!this.wbmpCache) this.wbmpCache = new Map();

            let buffer;
            if (this.wbmpCache.has(url)) {
                console.log("WBMP Cache Hit (Promise/Buffer):", url);
                const cached = this.wbmpCache.get(url);
                buffer = (cached instanceof Promise) ? await cached : cached;
            } else {
                console.log("WBMP Cache Miss - Fetching:", url);
                // Store the PROMISE immediately to prevent duplicate requests
                const fetchPromise = fetchProxy(url, 'arraybuffer');
                this.wbmpCache.set(url, fetchPromise);

                try {
                    buffer = await fetchPromise;
                    // Replace promise with actual buffer for future sync access if needed (optional)
                    this.wbmpCache.set(url, buffer);
                } catch (err) {
                    console.error("WBMP Fetch Failed:", url);
                    this.wbmpCache.delete(url); // Remove failed request
                    throw err;
                }
            }

            // Sanity Check: Is this actually a binary WBMP or a text error (404 HTML)?
            // Peek at first few bytes
            if (buffer.byteLength > 0) {
                const arr = new Uint8Array(buffer.slice(0, 10));

                // 1. Check for standard WBMP signature (Type 0 starts with 0x00)
                // If it's NOT 0x00, it's suspicious for a simple WBMP.
                // 2. Check for Text (HTML or Plain Text Errors like "ERROR 404")
                const textPeek = new TextDecoder().decode(arr);

                // Common HTML starts or Text Error words
                if (textPeek.trim().startsWith('<') || textPeek.match(/^ERROR/i) || textPeek.match(/^HTTP/i) || textPeek.match(/^Not/i)) {
                    throw new Error("Server returned text/error (" + textPeek.substring(0, 10) + "...) instead of WBMP");
                }

                // Heuristic: If first byte is valid ASCII text char (e.g. 'E', '4', 'O') and not 0, rejection
                // WBMP Type 0 is 0x00.
                if (arr[0] !== 0 && arr[0] >= 32 && arr[0] <= 126) {
                    throw new Error("Header looks like text, invalid WBMP Type 0");
                }
            }

            const canvas = convertWbmpToCanvas(buffer);
            container.innerHTML = '';
            container.appendChild(canvas);
        } catch (e) {
            console.error("Failed to load WBMP", url, e.message);
            // container.textContent left as [Alt] from caller
        }
    }
}

/* --- WBMP CONVERTER (ROBUST STRIDE CALCULATION) --- */
function convertWbmpToCanvas(buffer) {
    const view = new DataView(buffer);
    let offset = 0;

    function readUintVar() {
        let result = 0;
        while (offset < view.byteLength) {
            const byte = view.getUint8(offset++);
            result = (result << 7) | (byte & 0x7F);
            if ((byte & 0x80) === 0) break;
        }
        return result;
    }

    try {
        const type = readUintVar();

        // Handle optional Fixed Header (byte 0x00) if present after type
        if (type === 0 && offset < view.byteLength) {
            const peek = view.getUint8(offset);
            // Heuristic: skip 0x00 padding if commonly added by some converters
            if (peek === 0x00 && view.byteLength > offset + 2) {
                offset++;
            }
        }

        const width = readUintVar();
        const height = readUintVar();

        if (width <= 0 || height <= 0) return document.createElement('canvas');

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        // Calculate Stride (Bytes per row)
        // Explicitly align to next byte boundary
        const stride = Math.ceil(width / 8);
        const dataStart = offset;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Determine byte index based on row stride
                const byteIndex = dataStart + (y * stride) + (x >>> 3);
                const bitIndex = 7 - (x & 7);

                let isWhite = false;

                if (byteIndex < view.byteLength) {
                    const byte = view.getUint8(byteIndex);
                    isWhite = (byte & (1 << bitIndex)) !== 0;
                }

                const pIdx = (y * width + x) * 4;
                if (isWhite) {
                    // White = Transparent
                    data[pIdx] = 0; data[pIdx + 1] = 0; data[pIdx + 2] = 0; data[pIdx + 3] = 0;
                } else {
                    // Black = Opaque
                    data[pIdx] = 0; data[pIdx + 1] = 0; data[pIdx + 2] = 0; data[pIdx + 3] = 255;
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;

    } catch (e) {
        console.error("WBMP Parse error", e);
        const c = document.createElement('canvas');
        c.width = 10; c.height = 10;
        const x = c.getContext('2d');
        x.fillStyle = 'red';
        x.fillRect(0, 0, 10, 10);
        return c;
    }
}