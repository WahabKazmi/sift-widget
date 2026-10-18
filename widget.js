/**
 * Sift embeddable chat widget.
 *
 * Usage (drop into any theme, Shopify/WooCommerce or otherwise):
 *
 *   <script
 *     src="https://your-cdn.com/widget.js"
 *     data-merchant-id="fernweh-outdoor"
 *     data-engine-url="https://api.yoursift.com"
 *     defer
 *   ></script>
 *
 * Optional attributes:
 *   data-color            accent color, hex, default "#9333EA"
 *   data-position          "bottom-right" | "bottom-left", default "bottom-right"
 *   data-assistant-name    shown in the header before the first message loads, default "Sift"
 *   data-greeting          first message shown when the widget opens
 *
 * Everything renders inside a Shadow DOM so the host site's CSS can never
 * leak in or be broken by this widget's styles — this is what makes it
 * safe to embed on an arbitrary merchant's theme sight unseen.
 */
(function () {
  "use strict";

  // --- Config, read from the <script> tag that loaded this file ---------
  var scriptTag = document.currentScript;
  if (!scriptTag) {
    console.error("Sift widget: could not find its own <script> tag — cannot read config. Make sure this file is loaded via a <script> tag, not dynamically injected without preserving document.currentScript.");
    return;
  }

  var CONFIG = {
    merchantId: scriptTag.getAttribute("data-merchant-id"),
    engineUrl: (scriptTag.getAttribute("data-engine-url") || "").replace(/\/$/, ""),
    color: scriptTag.getAttribute("data-color") || "#9333EA",
    position: scriptTag.getAttribute("data-position") === "bottom-left" ? "left" : "right",
    assistantName: scriptTag.getAttribute("data-assistant-name") || "Sift",
    greeting:
      scriptTag.getAttribute("data-greeting") ||
      "Hi — tell me what you're shopping for and I'll pull it up.",
  };

  if (!CONFIG.merchantId || !CONFIG.engineUrl) {
    console.error("Sift widget: data-merchant-id and data-engine-url are required attributes on the <script> tag.");
    return;
  }

  // --- Load Mixpanel (CDN) and init for widget-level analytics ---------
  (function () {
    try {
      var mpToken = "199780cf6cb5125ad8c2926c543f60a8";
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/mixpanel-browser/dist/mixpanel.min.js";
      s.async = true;
      s.onload = function () {
        try {
          if (window.mixpanel) {
            window.mixpanel.init(mpToken, { autocapture: true, record_sessions_percent: 100 });
            // 'Widget Loaded' tracking removed per request
          }
        } catch (e) {}
      };
      document.head.appendChild(s);
    } catch (e) {}
  })();

  // --- Session id: stable per browser tab session, resets on new session -
  var SESSION_KEY = "sift_session_" + CONFIG.merchantId;
  var sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = (crypto.randomUUID ? crypto.randomUUID() : "sess_" + Math.random().toString(36).slice(2));
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  // --- Shadow DOM host, isolated from the merchant site's own styles -----
  var host = document.createElement("div");
  host.id = "sift-widget-root";
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: "open" });

  var css = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .wrap { position: fixed; bottom: 20px; ${CONFIG.position}: 20px; z-index: 2147483000; display: flex; flex-direction: column; align-items: ${CONFIG.position === "left" ? "flex-start" : "flex-end"}; gap: 12px; }
    .fab { width: 56px; height: 56px; border-radius: 999px; border: none; cursor: pointer; background: ${CONFIG.color}; box-shadow: 0 8px 24px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; transition: transform 0.15s ease; }
    .fab:hover { transform: scale(1.05); }
    .fab svg { width: 24px; height: 24px; }
    .panel { width: 360px; max-width: calc(100vw - 40px); height: 520px; max-height: calc(100vh - 100px); background: #0f0f14; border: 1px solid #2a2a35; border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.4); display: flex; flex-direction: column; overflow: hidden; opacity: 0; transform: translateY(12px) scale(0.98); transition: opacity 0.18s ease, transform 0.18s ease; pointer-events: none; }
    .panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #2a2a35; background: #16161c; }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .dot { width: 8px; height: 8px; border-radius: 999px; background: #4ade80; }
    .title { color: #f4f2fa; font-weight: 600; font-size: 14px; margin: 0; }
    .close-btn { background: none; border: none; color: #9c97ac; cursor: pointer; width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
    .close-btn:hover { color: #f4f2fa; background: #1e1e26; }
    .messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .msg-row { display: flex; }
    .msg-row.user { justify-content: flex-end; }
    .bubble { max-width: 85%; padding: 10px 14px; border-radius: 16px; font-size: 13.5px; line-height: 1.5; }
    .bubble.assistant { background: #1e1e26; border: 1px solid #2a2a35; color: #f4f2fa; border-bottom-left-radius: 4px; }
    .bubble.user { background: ${CONFIG.color}; color: #0a0a0f; border-bottom-right-radius: 4px; }
    .products { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .product-card { display: flex; align-items: center; gap: 10px; background: #16161c; border: 1px solid #2a2a35; border-radius: 10px; padding: 8px; text-decoration: none; }
    .product-card:hover { border-color: ${CONFIG.color}; }
    .product-img { width: 36px; height: 36px; border-radius: 6px; background: #0f0f14; flex-shrink: 0; object-fit: cover; }
    .product-info { min-width: 0; flex: 1; }
    .product-name { color: #f4f2fa; font-size: 12.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
    .product-price { color: ${CONFIG.color}; font-size: 11.5px; font-family: monospace; margin: 2px 0 0; }
    .typing { display: flex; gap: 4px; padding: 10px 14px; }
    .typing span { width: 6px; height: 6px; border-radius: 999px; background: #9c97ac; animation: bounce 1.2s infinite; }
    .typing span:nth-child(2) { animation-delay: 0.15s; }
    .typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }
    .input-row { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #2a2a35; }
    .input { flex: 1; background: #1e1e26; border: 1px solid #2a2a35; border-radius: 999px; padding: 9px 14px; color: #f4f2fa; font-size: 13px; outline: none; }
    .input:focus { border-color: ${CONFIG.color}; }
    .input::placeholder { color: #6b6878; }
    .send-btn { width: 34px; height: 34px; border-radius: 999px; border: none; background: ${CONFIG.color}; color: #0a0a0f; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .messages::-webkit-scrollbar { width: 5px; }
    .messages::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 3px; }
  `;

  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  shadow.appendChild(styleEl);

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  wrap.innerHTML =
    '<button class="fab" id="sift-fab" aria-label="Open chat">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
    "</svg></button>" +
    '<div class="panel" id="sift-panel">' +
    '<div class="header"><div class="header-left"><span class="dot"></span><p class="title" id="sift-title">' +
    escapeHtml(CONFIG.assistantName) +
    '</p></div><button class="close-btn" id="sift-close" aria-label="Close chat">✕</button></div>' +
    '<div class="messages" id="sift-messages"></div>' +
    '<div class="input-row"><input class="input" id="sift-input" type="text" placeholder="Ask me anything…" autocomplete="off" />' +
    '<button class="send-btn" id="sift-send" aria-label="Send">→</button></div>' +
    "</div>";
  shadow.appendChild(wrap);

  var fab = shadow.getElementById("sift-fab");
  var panel = shadow.getElementById("sift-panel");
  var closeBtn = shadow.getElementById("sift-close");
  var messagesEl = shadow.getElementById("sift-messages");
  var input = shadow.getElementById("sift-input");
  var sendBtn = shadow.getElementById("sift-send");

  var seeded = false;
  var sending = false;

  function open() {
    panel.classList.add("open");
    fab.style.display = "none";
    if (!seeded) {
      seeded = true;
      appendBubble("assistant", escapeHtml(CONFIG.greeting));
    }
    input.focus();
  }
  function close() {
    panel.classList.remove("open");
    fab.style.display = "flex";
  }

  fab.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendBubble(role, html) {
    var row = document.createElement("div");
    row.className = "msg-row " + role;
    var bubble = document.createElement("div");
    bubble.className = "bubble " + role;
    bubble.innerHTML = html;
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollToBottom();
    return row;
  }

  function appendTyping() {
    var row = document.createElement("div");
    row.className = "msg-row assistant";
    row.id = "sift-typing";
    row.innerHTML = '<div class="bubble assistant typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(row);
    scrollToBottom();
  }
  function removeTyping() {
    var el = shadow.getElementById("sift-typing");
    if (el) el.remove();
  }

  function renderProducts(products) {
    if (!products || products.length === 0) return "";
    var cards = products
      .map(function (p) {
        var img = p.imageUrl
          ? '<img class="product-img" src="' + p.imageUrl + '" alt="" />'
          : '<div class="product-img"></div>';
        return (
          '<a class="product-card" href="' +
          (p.productUrl || "#") +
          '" target="_blank" rel="noopener">' +
          img +
          '<div class="product-info"><p class="product-name">' +
          escapeHtml(p.title) +
          '</p><p class="product-price">$' +
          p.price +
          " " +
          escapeHtml(p.currency || "") +
          "</p></div></a>"
        );
      })
      .join("");
    return '<div class="products">' + cards + "</div>";
  }

  async function sendMessage(text) {
    if (!text || sending) return;
    sending = true;
    sendBtn.disabled = true;
    input.value = "";

    appendBubble("user", escapeHtml(text));
    appendTyping();


    try {
      var res = await fetch(CONFIG.engineUrl + "/api/merchants/" + encodeURIComponent(CONFIG.merchantId) + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionId }),
      });

      var body = await res.json();
      removeTyping();

      if (!res.ok) {
        var limitHit = res.status === 402 || (body && body.code === "PLAN_LIMIT_REACHED");
        appendBubble(
          "assistant",
          escapeHtml(
            limitHit
              ? "This store has reached its monthly search limit. Please try again next month."
              : res.status === 429
                ? "I'm getting a lot of messages right now — try again in a moment."
                : "Sorry, something went wrong on my end. Please try again."
          )
        );
        console.error("Sift widget: chat request failed —", body.error || res.status);
        try { if (window.mixpanel) window.mixpanel.track("Widget Error", { merchantId: CONFIG.merchantId, error: body.error || res.status }); } catch (e) {}
      } else {
        appendBubble("assistant", escapeHtml(body.reply) + renderProducts(body.products));
        // 'Widget Message Received' tracking removed per request
      }
    } catch (err) {
      removeTyping();
      appendBubble("assistant", "Sorry, I couldn't reach the store's assistant right now. Please try again shortly.");
      console.error("Sift widget: network error —", err);
      try { if (window.mixpanel) window.mixpanel.track("Widget Error", { merchantId: CONFIG.merchantId, error: String(err) }); } catch (e) {}
    } finally {
      sending = false;
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener("click", function () {
    sendMessage(input.value.trim());
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendMessage(input.value.trim());
  });
})();
