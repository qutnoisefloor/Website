(() => {
  const cfg = window.NF_CONFIG || {};
  const hasSupabase = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-PROJECT") &&
                      cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR-PUBLISHABLE");
  const sb = hasSupabase && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  const path = location.pathname.replace(/\/+$/, "") || "/";
  const routeMatch = path.match(/\/r\/([^/]+)/i);

  const visitorKey = "nf_visitor_id";
  let visitorId = localStorage.getItem(visitorKey);
  if (!visitorId) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : "v-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    localStorage.setItem(visitorKey, visitorId);
  }

  function basePath() {
    const p = location.pathname;
    const marker = p.toLowerCase().indexOf("/r/");
    if (marker >= 0) return p.slice(0, marker) || "/";
    return p.endsWith("/") ? p : p + "/";
  }

  async function recordEvent(code = null, eventType = "visit") {
    if (!sb) return;
    try {
      await sb.from("traffic_events").insert({
        visitor_id: visitorId,
        code: code || null,
        event_type: eventType,
        path: location.pathname,
        referrer: document.referrer ? new URL(document.referrer).origin : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null
      });
    } catch (e) {
      console.warn("Noise Floor analytics:", e.message);
    }
  }

  async function resolveRoute(code) {
    if (!sb) {
      location.replace(basePath());
      return;
    }
    const { data, error } = await sb.from("campaigns")
      .select("code,destination,enabled")
      .eq("code", code)
      .maybeSingle();

    if (error || !data || !data.enabled) {
      location.replace(basePath());
      return;
    }
    await recordEvent(code, "qr_scan");
    const destination = data.destination || "/";
    const url = new URL(destination, location.origin);
    if (url.origin === location.origin && (url.pathname === "/" || url.pathname === basePath())) {
      url.searchParams.set("src", code);
    }
    location.replace(url.toString());
  }

  if (routeMatch) {
    resolveRoute(decodeURIComponent(routeMatch[1]));
    return;
  }

  const linksEl = document.getElementById("links");
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  async function loadSettings() {
    if (!sb) return { music_url: "" };
    const { data } = await sb.from("site_settings").select("key,value").in("key", ["music_url"]);
    return Object.fromEntries((data || []).map(x => [x.key, x.value]));
  }

  async function loadLinks() {
    if (!sb) {
      return [
        { title: "Instagram", note: "follow the signal", icon: "IG", url: "https://instagram.com/" },
        { title: "Discord", note: "talk shop / share builds", icon: "DS", url: "https://discord.com/" },
        { title: "QUT Club Hub", note: "membership & events", icon: "Q", url: "https://qutguild.com/" },
        { title: "Email", note: "noise.floor@qut.edu.au", icon: "@", url: "mailto:noise.floor@qut.edu.au" }
      ];
    }
    const { data, error } = await sb.from("links").select("id,title,note,icon,url,enabled").eq("enabled", true).order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function renderLinks(items) {
    if (!linksEl) return;
    if (!items.length) {
      linksEl.innerHTML = '<div class="loading-card">no active links yet.</div>';
      return;
    }
    linksEl.innerHTML = items.map(item => `
      <a class="link-card" href="${escapeHtml(item.url)}" data-link-id="${item.id || ""}" target="${/^https?:/i.test(item.url) ? "_blank" : "_self"}" rel="noopener">
        <span class="link-left">
          <span class="link-icon">${escapeHtml(item.icon || "∿")}</span>
          <span><span class="link-title">${escapeHtml(item.title)}</span>${item.note ? `<span class="link-note">${escapeHtml(item.note)}</span>` : ""}</span>
        </span>
        <span class="arrow">↗</span>
      </a>
    `).join("");
    linksEl.querySelectorAll("a[data-link-id]").forEach(a => a.addEventListener("click", () => {
      recordEvent(null, "link_click");
    }, { passive: true }));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
  }

  const audio = document.getElementById("bgAudio");
  const toggle = document.getElementById("musicToggle");
  const label = document.getElementById("musicLabel");
  const gate = document.getElementById("musicGate");
  const soundBtn = document.getElementById("enterWithSound");
  const silentBtn = document.getElementById("enterSilent");

  function setMusicState(on) {
    if (!audio || !toggle) return;
    toggle.setAttribute("aria-pressed", String(on));
    if (label) label.textContent = on ? "sound on" : "sound off";
  }
  async function enableMusic() {
    if (!audio?.src) return;
    try { await audio.play(); setMusicState(true); } catch { setMusicState(false); }
  }
  function closeGate() { if (gate) gate.hidden = true; }

  toggle?.addEventListener("click", async () => {
    if (!audio?.src) return;
    if (audio.paused) await enableMusic();
    else { audio.pause(); setMusicState(false); }
  });
  soundBtn?.addEventListener("click", async () => { closeGate(); await enableMusic(); });
  silentBtn?.addEventListener("click", closeGate);

  async function boot() {
    try {
      const [settings, links] = await Promise.all([loadSettings(), loadLinks()]);
      if (settings.music_url && audio) {
        audio.src = settings.music_url;
        audio.volume = 0.22;
      }
      renderLinks(links);
      recordEvent(new URLSearchParams(location.search).get("src"), "visit");
      // Ask only after the user has a chance to choose. Browsers block autoplay,
      // so sound is never started without a gesture.
      if (audio?.src && !sessionStorage.getItem("nf_music_choice")) {
        gate.hidden = false;
        soundBtn?.addEventListener("click", () => sessionStorage.setItem("nf_music_choice", "sound"), { once: true });
        silentBtn?.addEventListener("click", () => sessionStorage.setItem("nf_music_choice", "silent"), { once: true });
      }
    } catch (e) {
      console.error(e);
      renderLinks([]);
    }
  }
  boot();
})();
