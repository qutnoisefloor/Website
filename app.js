(() => {

  /* ========================================================
     CONFIG / SUPABASE
     ======================================================== */

  const cfg = window.NF_CONFIG || {};

  const hasSupabase =
    cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR-PUBLISHABLE");

  const sb =
    hasSupabase && window.supabase
      ? window.supabase.createClient(
          cfg.SUPABASE_URL,
          cfg.SUPABASE_ANON_KEY
        )
      : null;


  /* ========================================================
     ROUTING
     ======================================================== */

  const path =
    location.pathname.replace(/\/+$/, "") || "/";

  const routeMatch =
    path.match(/\/r\/([^/]+)/i);


  function basePath() {

    const p = location.pathname;

    const marker =
      p.toLowerCase().indexOf("/r/");

    if (marker >= 0) {
      return p.slice(0, marker) || "/";
    }

    return p.endsWith("/")
      ? p
      : p + "/";
  }


  /* ========================================================
     VISITOR ID
     ======================================================== */

  const visitorKey =
    "nf_visitor_id";

  let visitorId =
    localStorage.getItem(visitorKey);


  if (!visitorId) {

    visitorId =
      crypto.randomUUID
        ? crypto.randomUUID()
        : "v-" +
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2);

    localStorage.setItem(
      visitorKey,
      visitorId
    );
  }


  /* ========================================================
     ANALYTICS
     ======================================================== */

  async function recordEvent(
    code = null,
    eventType = "visit"
  ) {

    if (!sb) return;

    try {

      let referrer = null;

      if (document.referrer) {

        try {
          referrer =
            new URL(
              document.referrer
            ).origin;
        }

        catch {
          referrer = null;
        }

      }


      await sb
        .from("traffic_events")
        .insert({

          visitor_id:
            visitorId,

          code:
            code || null,

          event_type:
            eventType,

          path:
            location.pathname,

          referrer,

          timezone:
            Intl
              .DateTimeFormat()
              .resolvedOptions()
              .timeZone || null

        });

    }

    catch (e) {

      console.warn(
        "Noise Floor analytics:",
        e.message
      );

    }
  }


  /* ========================================================
     QR / CAMPAIGN ROUTES
     ======================================================== */

  async function resolveRoute(code) {

    if (!sb) {

      location.replace(
        basePath()
      );

      return;
    }


    const {
      data,
      error
    } =
      await sb
        .from("campaigns")
        .select(
          "code,destination,enabled"
        )
        .eq(
          "code",
          code
        )
        .maybeSingle();


    if (
      error ||
      !data ||
      !data.enabled
    ) {

      location.replace(
        basePath()
      );

      return;
    }


    await recordEvent(
      code,
      "qr_scan"
    );


    const destination =
      data.destination || "/";


    const url =
      new URL(
        destination,
        location.origin
      );


    if (
      url.origin ===
        location.origin &&
      (
        url.pathname === "/" ||
        url.pathname ===
          basePath()
      )
    ) {

      url.searchParams.set(
        "src",
        code
      );
    }


    location.replace(
      url.toString()
    );
  }


  if (routeMatch) {

    resolveRoute(
      decodeURIComponent(
        routeMatch[1]
      )
    );

    return;
  }


  /* ========================================================
     DOM REFERENCES
     ======================================================== */

  const linksEl =
    document.getElementById(
      "links"
    );


  const audioPanel =
    document.getElementById(
      "audioPanel"
    );


  const audio =
    document.getElementById(
      "bgAudio"
    );


  const soundButton =
    document.getElementById(
      "soundButton"
    );


  const playSymbol =
    soundButton
      ?.querySelector(
        ".play-symbol"
      );


  const trackName =
    document.getElementById(
      "trackName"
    );


  const clock =
    document.getElementById(
      "clock"
    );


  /* ========================================================
     CLOCK
     ======================================================== */

  function updateClock() {

    if (!clock) return;


    const now =
      new Date();


    const time =
      new Intl.DateTimeFormat(
        "en-AU",
        {
          hour:
            "2-digit",

          minute:
            "2-digit",

          hour12:
            false
        }
      ).format(now);


    clock.textContent =
      `${time} / BNE`;
  }


  updateClock();


  setInterval(
    updateClock,
    30000
  );


  /* ========================================================
     SITE SETTINGS
     ======================================================== */

  async function loadSettings() {

    if (!sb) {

      return {
        music_url: ""
      };

    }


    const {
      data,
      error
    } =
      await sb
        .from("site_settings")
        .select("key,value")
        .in(
          "key",
          [
            "music_url"
          ]
        );


    if (error) {

      console.warn(
        "Noise Floor settings:",
        error.message
      );

      return {
        music_url: ""
      };
    }


    return Object.fromEntries(
      (data || []).map(
        item => [
          item.key,
          item.value
        ]
      )
    );
  }


  /* ========================================================
     LINKS
     ======================================================== */

  async function loadLinks() {

    /*
      Fallback links are used when Supabase
      isn't configured yet.
    */

    if (!sb) {

      return [

        {
          title:
            "Instagram",

          note:
            "follow the signal",

          icon:
            "IG",

          url:
            "https://instagram.com/"
        },

        {
          title:
            "Discord",

          note:
            "talk shop / share builds",

          icon:
            "DS",

          url:
            "https://discord.com/"
        },

        {
          title:
            "QUT Club Hub",

          note:
            "membership & events",

          icon:
            "Q",

          url:
            "https://qutguild.com/"
        },

        {
          title:
            "Email",

          note:
            "noise.floor@qut.edu.au",

          icon:
            "@",

          url:
            "mailto:noise.floor@qut.edu.au"
        }

      ];
    }


    const {
      data,
      error
    } =
      await sb
        .from("links")
        .select(
          "id,title,note,icon,url,enabled"
        )
        .eq(
          "enabled",
          true
        )
        .order(
          "sort_order",
          {
            ascending:
              true
          }
        );


    if (error) {
      throw error;
    }


    return data || [];
  }


  /* ========================================================
     LINK RENDERING
     ======================================================== */

  function renderLinks(items) {

    if (!linksEl) return;


    if (!items.length) {

      linksEl.innerHTML =
        `
        <div class="empty-state">
          no active signals detected.
        </div>
        `;

      return;
    }


    linksEl.innerHTML =
      items
        .map(
          (
            item,
            index
          ) => {

            const number =
              String(
                index + 1
              ).padStart(
                2,
                "0"
              );


            const external =
              /^https?:/i.test(
                item.url
              );


            return `
              <a
                class="link-row"
                href="${escapeHtml(item.url)}"
                data-link-id="${escapeHtml(item.id || "")}"
                target="${external ? "_blank" : "_self"}"
                ${external ? 'rel="noopener noreferrer"' : ""}
              >

                <span class="link-number">
                  ${number}
                </span>

                <span class="link-content">

                  <span class="link-title">
                    ${escapeHtml(item.title)}
                  </span>

                  ${
                    item.note
                      ? `
                        <span class="link-description">
                          ${escapeHtml(item.note)}
                        </span>
                        `
                      : ""
                  }

                </span>

                <span class="link-arrow">
                  ↗
                </span>

              </a>
            `;
          }
        )
        .join("");


    linksEl
      .querySelectorAll(
        ".link-row"
      )
      .forEach(
        link => {

          link.addEventListener(
            "click",
            () => {

              recordEvent(
                null,
                "link_click"
              );

            },
            {
              passive:
                true
            }
          );

        }
      );
  }


  /* ========================================================
     HTML ESCAPING
     ======================================================== */

  function escapeHtml(value) {

    return String(
      value ?? ""
    ).replace(
      /[&<>"']/g,
      character => ({
        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        '"':
          "&quot;",

        "'":
          "&#039;"
      })[character]
    );
  }


  /* ========================================================
     AUDIO
     ======================================================== */

  function updateAudioUI() {

    if (
      !audio ||
      !soundButton
    ) {
      return;
    }


    const playing =
      !audio.paused;


    soundButton
      .classList
      .toggle(
        "playing",
        playing
      );


    soundButton.setAttribute(
      "aria-label",
      playing
        ? "Pause background sound"
        : "Play background sound"
    );


    soundButton.setAttribute(
      "aria-pressed",
      String(playing)
    );


    if (playSymbol) {

      playSymbol.textContent =
        playing
          ? "Ⅱ"
          : "▶";

    }
  }


  async function playAudio() {

    if (
      !audio ||
      !audio.src
    ) {
      return;
    }


    try {

      await audio.play();

      updateAudioUI();

      recordEvent(
        null,
        "sound_play"
      );

    }

    catch (error) {

      console.warn(
        "Noise Floor audio:",
        error.message
      );


      updateAudioUI();
    }
  }


  function pauseAudio() {

    if (!audio) return;


    audio.pause();


    updateAudioUI();


    recordEvent(
      null,
      "sound_pause"
    );
  }


  soundButton
    ?.addEventListener(
      "click",
      async () => {

        if (!audio?.src) {
          return;
        }


        if (audio.paused) {

          await playAudio();

        }

        else {

          pauseAudio();

        }

      }
    );


  audio
    ?.addEventListener(
      "play",
      updateAudioUI
    );


  audio
    ?.addEventListener(
      "pause",
      updateAudioUI
    );


  /* ========================================================
     CINEMATIC SCROLL
     ======================================================== */

  const scrollCue =
    document.querySelector(
      ".scroll-cue"
    );


  scrollCue
    ?.addEventListener(
      "click",
      event => {

        const directory =
          document.getElementById(
            "directory"
          );


        if (!directory) {
          return;
        }


        /*
          CSS already provides smooth scrolling.
          This JS fallback lets us respect reduced motion.
        */

        event.preventDefault();


        const reducedMotion =
          window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches;


        directory.scrollIntoView({
          behavior:
            reducedMotion
              ? "auto"
              : "smooth",

          block:
            "start"
        });


        history.replaceState(
          null,
          "",
          "#directory"
        );


        recordEvent(
          null,
          "directory_enter"
        );

      }
    );


  /* ========================================================
     BOOT
     ======================================================== */

  async function boot() {

    try {

      const [
        settings,
        links
      ] =
        await Promise.all([
          loadSettings(),
          loadLinks()
        ]);


      /*
        AUDIO
      */

      if (
        settings.music_url &&
        audio
      ) {

        audio.src =
          settings.music_url;


        audio.volume =
          0.22;


        if (audioPanel) {
          audioPanel.hidden =
            false;
        }


        if (trackName) {
          trackName.textContent =
            "Noise Floor";
        }

      }

      else {

        if (audioPanel) {
          audioPanel.hidden =
            true;
        }

      }


      updateAudioUI();


      /*
        LINKS
      */

      renderLinks(
        links
      );


      /*
        ANALYTICS
      */

      const source =
        new URLSearchParams(
          location.search
        ).get("src");


      recordEvent(
        source,
        "visit"
      );

    }

    catch (error) {

      console.error(
        "Noise Floor boot error:",
        error
      );


      renderLinks([]);

    }
  }


  boot();

})();
