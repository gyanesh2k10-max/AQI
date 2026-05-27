const $ = (sel)=>document.querySelector(sel);

const gradeColor = (aqi) => {
  if (aqi == null || isNaN(aqi)) return "#6c757d";
  if (aqi <= 50) return "#00e400";        // Good
  if (aqi <= 100) return "#ffff00";       // Moderate
  if (aqi <= 150) return "#ff7e00";       // Unhealthy for Sensitive Groups
  if (aqi <= 200) return "#ff0000";       // Unhealthy
  if (aqi <= 300) return "#8f3f97";       // Very Unhealthy
  return "#7e0023";                        // Hazardous
};

async function fetchWAQIByKeyword(keyword){
  const token = window.WAQI_TOKEN;
  const url = `https://api.waqi.info/search/?token=${token}&keyword=${encodeURIComponent(keyword)}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.status !== "ok" || !j.data?.length) throw new Error("No stations found");
  // Pick best match (highest scoring)
  j.data.sort((a,b)=>(b.score??0)-(a.score??0));
  const first = j.data[0];
  return fetchWAQIByStation(first.station?.uid);
}

async function fetchWAQIByCoords(lat, lon){
  const token = window.WAQI_TOKEN;
  const url = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${token}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.status !== "ok") throw new Error("No data for this location");
  return j.data;
}

async function fetchWAQIByStation(uid){
  const token = window.WAQI_TOKEN;
  const url = `https://api.waqi.info/feed/@${uid}/?token=${token}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.status !== "ok") throw new Error("No data for this station");
  return j.data;
}

// Optional: OpenAQ backup for pollutant list near coordinates
async function fetchOpenAQ(lat, lon){
  const url = `https://api.openaq.org/v3/measurements?coordinates=${lat},${lon}&radius=10000&limit=50&sort=desc&order_by=datetime`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("OpenAQ fetch failed");
  return (await r.json()).results;
}

function renderAQ(data, fallbackPollutants = []){
  $("#aqResult").classList.remove("hidden");
  $("#locationName").textContent = data.city?.name || data.city || "Selected location";
  const ts = data.time?.s || data.time;
  $("#updatedAt").textContent = ts ? `Updated: ${ts}` : "";

  const aqi = Number(data.aqi);
  const aqiBadge = $("#aqiBadge");
  aqiBadge.textContent = `AQI ${isNaN(aqi) ? "—" : aqi}`;
  aqiBadge.style.background = gradeColor(aqi);

  const domPol = $("#domPol");
  domPol.textContent = data.dominentpol ? `Dominant: ${data.dominentpol.toUpperCase()}` : "—";

  const pollutants = [];
  // WAQI "iaqi" object
  if (data.iaqi){
    for (const [key, obj] of Object.entries(data.iaqi)){
      if (obj?.v != null) pollutants.push([key.toUpperCase(), obj.v]);
    }
  }
  // Merge in OpenAQ recent readings if missing
  for (const p of fallbackPollutants){
    const k = p.parameter?.toUpperCase?.() || p.parameter;
    const already = pollutants.find(([name])=>name===k);
    if (!already) pollutants.push([k, p.value]);
  }
  const wrap = $("#pollutants");
  wrap.innerHTML = "";
  pollutants.sort((a,b)=>a[0].localeCompare(b[0]));
  pollutants.forEach(([name,val])=>{
    const div = document.createElement("div");
    div.className = "chip";
    div.innerHTML = `<strong>${name}</strong><br/><span class="muted">${val}</span>`;
    wrap.appendChild(div);
  });
}

async function handleSearch(keyword, coords){
  try{
    let waqi;
    let openaq = [];
    if (coords){
      waqi = await fetchWAQIByCoords(coords.lat, coords.lon);
      try { openaq = await fetchOpenAQ(coords.lat, coords.lon); } catch {}
    } else {
      waqi = await fetchWAQIByKeyword(keyword);
    }
    renderAQ(waqi, openaq);
  } catch (e){
    alert(e.message || "Something went wrong");
  }
}

document.getElementById("searchForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const q = $("#cityInput").value.trim();
  if (!q) return;
  handleSearch(q, null);
});

document.getElementById("useGPS").addEventListener("click", ()=>{
  if (!navigator.geolocation){ alert("Geolocation not supported"); return; }
  navigator.geolocation.getCurrentPosition(
    (pos)=> handleSearch(null, {lat: pos.coords.latitude, lon: pos.coords.longitude}),
    (err)=> alert("Could not get your location")
  );
});

// --- News (via serverless function /api/news) ---
async function loadNews(){
  try{
    const r = await fetch("/api/news");
    const items = await r.json();
    const list = $("#newsList");
    list.innerHTML = "";
    items.slice(0,8).forEach(item=>{
      const li = document.createElement("li");
      li.innerHTML = `<a href="${item.link}" target="_blank" rel="noopener">${item.title}</a>
        <div class="muted small">${item.source} — ${item.pubDate}</div>`;
      list.appendChild(li);
    });
  }catch(e){
    // Silent fail; leave empty
  }
}
loadNews();
