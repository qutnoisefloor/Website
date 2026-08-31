(() => {
  const cfg = window.NF_CONFIG || {};
  const valid = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-PROJECT") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR-PUBLISHABLE");
  const sb = valid && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = id => document.getElementById(id);
  const loginPanel = $("loginPanel"), dashboard = $("dashboard"), logout = $("logout");

  function msg(text) { $("loginError").textContent = text || ""; }
  function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c])); }

  async function requireSession() {
    if (!sb) { msg("Add your Supabase values to config.js first."); return; }
    const { data } = await sb.auth.getSession();
    if (data.session) showDashboard();
  }
  function showDashboard() {
    loginPanel.hidden = true; dashboard.hidden = false; logout.hidden = false;
    refreshAll();
  }
  function showLogin() { loginPanel.hidden = false; dashboard.hidden = true; logout.hidden = true; }

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    msg("");
    if (!sb) return msg("Supabase is not configured.");
    const { error } = await sb.auth.signInWithPassword({ email:$("email").value, password:$("password").value });
    if (error) return msg(error.message);
    showDashboard();
  });
  logout.addEventListener("click", async () => { await sb.auth.signOut(); showLogin(); });

  async function loadLinks() {
    const { data, error } = await sb.from("links").select("*").order("sort_order");
    if (error) throw error;
    $("linksList").innerHTML = (data || []).map(x => `
      <div class="admin-row">
        <div><div class="row-title">${esc(x.title)} ${x.enabled ? "" : "— disabled"}</div><div class="row-meta">${esc(x.url)}</div></div>
        <div class="row-actions"><button data-edit-link="${x.id}" class="outline-button">edit</button><button data-del-link="${x.id}" class="danger">delete</button></div>
      </div>`).join("") || '<div class="muted">No links yet.</div>';
    document.querySelectorAll("[data-edit-link]").forEach(b => b.onclick = () => editLink(data.find(x => x.id === b.dataset.editLink)));
    document.querySelectorAll("[data-del-link]").forEach(b => b.onclick = () => deleteLink(b.dataset.delLink));
  }

  function editLink(x = null) {
    $("linkDialogTitle").textContent = x ? "edit link" : "new link";
    $("linkId").value = x?.id || "";
    $("linkTitle").value = x?.title || "";
    $("linkNote").value = x?.note || "";
    $("linkIcon").value = x?.icon || "∿";
    $("linkUrl").value = x?.url || "";
    $("linkEnabled").checked = x?.enabled ?? true;
    $("linkDialog").showModal();
  }
  $("newLink").onclick = () => editLink();
  $("linkForm").addEventListener("submit", async e => {
    e.preventDefault();
    const payload = { title:$("linkTitle").value.trim(), note:$("linkNote").value.trim(), icon:$("linkIcon").value.trim(), url:$("linkUrl").value.trim(), enabled:$("linkEnabled").checked };
    const id = $("linkId").value;
    let res;
    if (id) res = await sb.from("links").update(payload).eq("id", id);
    else {
      const { data: max } = await sb.from("links").select("sort_order").order("sort_order",{ascending:false}).limit(1);
      payload.sort_order = (max?.[0]?.sort_order || 0) + 1;
      res = await sb.from("links").insert(payload);
    }
    if (res.error) return alert(res.error.message);
    $("linkDialog").close(); loadLinks();
  });
  async function deleteLink(id) {
    if (!confirm("Delete this link?")) return;
    const { error } = await sb.from("links").delete().eq("id", id);
    if (error) alert(error.message); else loadLinks();
  }

  async function loadCampaigns() {
    const { data, error } = await sb.from("campaigns").select("*").order("created_at",{ascending:false});
    if (error) throw error;
    const origin = location.origin + location.pathname.replace(/\/admin\/?$/, "/");
    $("campaignList").innerHTML = (data || []).map(x => {
      const route = origin + "r/" + encodeURIComponent(x.code);
      return `<div class="admin-row">
        <div><div class="row-title">/r/${esc(x.code)} ${x.enabled ? "" : "— disabled"}</div><div class="row-meta">${esc(x.label || "unlabelled")} → ${esc(x.destination)}</div></div>
        <div class="row-actions"><button data-copy="${esc(route)}" class="outline-button">copy</button><button data-qr="${esc(route)}" class="outline-button">QR</button><button data-edit-camp="${x.id}" class="outline-button">edit</button><button data-del-camp="${x.id}" class="danger">delete</button></div>
      </div>`;
    }).join("") || '<div class="muted">No QR routes yet.</div>';
    document.querySelectorAll("[data-copy]").forEach(b => b.onclick = async () => { await navigator.clipboard.writeText(b.dataset.copy); b.textContent="copied"; setTimeout(()=>b.textContent="copy",900); });
    document.querySelectorAll("[data-qr]").forEach(b => b.onclick = () => openQr(b.dataset.qr));
    document.querySelectorAll("[data-edit-camp]").forEach(b => b.onclick = () => editCampaign(data.find(x => x.id === b.dataset.editCamp)));
    document.querySelectorAll("[data-del-camp]").forEach(b => b.onclick = () => deleteCampaign(b.dataset.delCamp));
  }
  function editCampaign(x=null) {
    $("campaignDialogTitle").textContent = x ? "edit route" : "new route";
    $("campaignId").value=x?.id||""; $("campaignCode").value=x?.code||""; $("campaignDestination").value=x?.destination||"/";
    $("campaignLabel").value=x?.label||""; $("campaignEnabled").checked=x?.enabled ?? true;
    $("campaignDialog").showModal();
  }
  $("newCampaign").onclick=()=>editCampaign();
  $("campaignForm").addEventListener("submit", async e => {
    e.preventDefault();
    const payload={code:$("campaignCode").value.trim(),destination:$("campaignDestination").value.trim(),label:$("campaignLabel").value.trim(),enabled:$("campaignEnabled").checked};
    const id=$("campaignId").value;
    const res=id ? await sb.from("campaigns").update(payload).eq("id",id) : await sb.from("campaigns").insert(payload);
    if(res.error) return alert(res.error.message);
    $("campaignDialog").close(); loadCampaigns();
  });
  async function deleteCampaign(id){ if(!confirm("Delete this route and its label?"))return; const {error}=await sb.from("campaigns").delete().eq("id",id); if(error)alert(error.message);else loadCampaigns(); }

  function openQr(url) {
    const w = window.open("", "_blank", "width=430,height=520");
    if (!w) return alert("Allow pop-ups for the admin page to generate a QR.");
    w.document.write(`<!doctype html><html><head><title>Noise Floor QR</title><style>body{background:#edf0ed;color:#101820;font:12px monospace;text-align:center;padding:28px}#qr{background:white;width:360px;height:360px;padding:12px;margin:18px auto}p{word-break:break-all;color:#174ea6}</style></head><body><div>NF_ROUTE / QR</div><div id="qr"></div><p>${esc(url)}</p><script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script><script>new QRCode(document.getElementById("qr"),{text:${JSON.stringify(url)},width:360,height:360,correctLevel:QRCode.CorrectLevel.M});<\/script></body></html>`);
    w.document.close();
  }

  async function loadStats() {
    const since = new Date(Date.now()-30*86400000).toISOString();
    const { data, error } = await sb.from("traffic_events").select("event_type,visitor_id,created_at,code").gte("created_at", since).order("created_at",{ascending:true});
    if(error) throw error;
    const events=data||[], visits=events.filter(x=>x.event_type==="visit"), scans=events.filter(x=>x.event_type==="qr_scan");
    const unique=new Set(visits.map(x=>x.visitor_id)).size;
    $("stats").innerHTML=`<div class="stat"><b>${events.length}</b><span>events / 30d</span></div><div class="stat"><b>${unique}</b><span>unique browsers / 30d</span></div><div class="stat"><b>${scans.length}</b><span>QR scans / 30d</span></div>`;
    const today = new Date().toISOString().slice(0,10);
    const hours = Array(24).fill(0);
    events.filter(x=>x.created_at.slice(0,10)===today).forEach(x=>hours[new Date(x.created_at).getHours()]++);
    const max=Math.max(1,...hours);
    $("hourChart").innerHTML=hours.map((n,h)=>`<div class="hour-bar" style="height:${Math.max(2, n/max*145)}px" title="${h}:00 — ${n} events"><span>${String(h).padStart(2,"0")}</span></div>`).join("");
    const byCode={};
    scans.forEach(x => {
      const key=x.code || "(unknown)";
      if(!byCode[key]) byCode[key]={scans:0,visitors:new Set()};
      byCode[key].scans++;
      byCode[key].visitors.add(x.visitor_id);
    });
    $("trafficTable").innerHTML=`<div class="traffic-line"><b>QR code</b><b>scans</b><b>unique visitors</b></div>`+
      Object.entries(byCode).sort((a,b)=>b[1].scans-a[1].scans).map(([code,x])=>`<div class="traffic-line"><span>${esc(code)}</span><span>${x.scans}</span><span>${x.visitors.size}</span></div>`).join("") || '<div class="muted">No QR scans in the last 30 days.</div>';
  }

  async function loadMusic() {
    const {data}=await sb.from("site_settings").select("key,value").eq("key","music_url").maybeSingle();
    $("musicStatus").textContent=data?.value ? "current track configured." : "no track configured.";
  }
  $("uploadMusic").onclick=async()=>{
    const file=$("musicFile").files[0]; if(!file)return alert("Choose an audio file first.");
    if(file.size>25*1024*1024)return alert("Keep the track under 25 MB.");
    $("musicStatus").textContent="uploading…";
    const ext=(file.name.split(".").pop()||"mp3").toLowerCase();
    const path=`background/current-${Date.now()}.${ext}`;
    const up=await sb.storage.from("music").upload(path,file,{upsert:true,contentType:file.type||"audio/mpeg"});
    if(up.error)return $("musicStatus").textContent=up.error.message;
    const {data}=sb.storage.from("music").getPublicUrl(path);
    const res=await sb.from("site_settings").upsert({key:"music_url",value:data.publicUrl});
    $("musicStatus").textContent=res.error?res.error.message:"track updated.";
  };

  async function refreshAll(){ try { await Promise.all([loadLinks(),loadCampaigns(),loadStats(),loadMusic()]); } catch(e){ console.error(e); alert(e.message); } }
  $("refreshStats").onclick=loadStats;
  sb?.auth.onAuthStateChange((_event, session) => session ? showDashboard() : showLogin());
  requireSession();
})();
