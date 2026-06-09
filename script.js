const $ = (sel) => document.querySelector(sel);

async function getAQI(city) {
  const token = window.WAQI_TOKEN;

  if (!token || token === "REPLACE_WITH_YOUR_WAQI_TOKEN") {
    alert("WAQI token is missing. Add your token in index.html.");
    return;
  }

  const url = `https://api.waqi.info/feed/${encodeURIComponent(city)}/?token=${token}`;

  console.log("Fetching:", url);

  const response = await fetch(url);
  const result = await response.json();

  console.log("WAQI response:", result);

  if (result.status !== "ok") {
    alert("Location not found or API error: " + (result.data || "Unknown error"));
    return;
  }

  showAQI(result.data);
}

function showAQI(data) {
  document.getElementById("aqResult").classList.remove("hidden");

  document.getElementById("locationName").textContent =
    data.city?.name || "Selected location";

  document.getElementById("updatedAt").textContent =
    data.time?.s ? `Updated: ${data.time.s}` : "";

  document.getElementById("aqiBadge").textContent = `AQI ${data.aqi}`;
  document.getElementById("domPol").textContent =
    data.dominentpol ? `Dominant: ${data.dominentpol.toUpperCase()}` : "";

  const pollutants = document.getElementById("pollutants");
  pollutants.innerHTML = "";

  if (data.iaqi) {
    Object.entries(data.iaqi).forEach(([key, value]) => {
      const div = document.createElement("div");
      div.className = "chip";
      div.innerHTML = `<strong>${key.toUpperCase()}</strong><br>${value.v}`;
      pollutants.appendChild(div);
    });
  }
}

document.getElementById("searchForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const city = document.getElementById("cityInput").value.trim();

  if (!city) {
    alert("Please enter a city name.");
    return;
  }

  getAQI(city);
});

