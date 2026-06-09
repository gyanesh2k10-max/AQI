```javascript
const $ = (selector) => document.querySelector(selector);

const searchForm = $("#searchForm");
const cityInput = $("#cityInput");
const gpsButton = $("#useGPS");
const statusMessage = $("#statusMessage");
const aqResult = $("#aqResult");

/**
 * Display a message below the search form.
 */
function setStatus(message, isError = false) {
  if (!statusMessage) return;

  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#ff6b6b" : "";
}

/**
 * Return a background colour for the US AQI scale.
 */
function getAQIColour(aqi) {
  if (!Number.isFinite(aqi)) return "#6c757d";
  if (aqi <= 50) return "#00e400";
  if (aqi <= 100) return "#ffff00";
  if (aqi <= 150) return "#ff7e00";
  if (aqi <= 200) return "#ff0000";
  if (aqi <= 300) return "#8f3f97";

  return "#7e0023";
}

/**
 * Return readable text colour for the AQI badge.
 */
function getAQITextColour(aqi) {
  if (aqi <= 100) return "#111111";
  return "#ffffff";
}

/**
 * Check that a token has been added in index.html.
 */
function getToken() {
  const token = window.WAQI_TOKEN?.trim();

  if (
    !token ||
    token === "PASTE_YOUR_NEW_WAQI_TOKEN_HERE" ||
    token === "REPLACE_WITH_YOUR_WAQI_TOKEN"
  ) {
    throw new Error(
      "WAQI token is missing. Add your valid token in index.html."
    );
  }

  return token;
}

/**
 * Request AQI data from a WAQI API URL.
 */
async function fetchWAQIData(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Network error: ${response.status}`);
  }

  const result = await response.json();

  if (result.status !== "ok") {
    let errorMessage = "AQI data could not be found.";

    if (typeof result.data === "string") {
      errorMessage = result.data;
    }

    throw new Error(errorMessage);
  }

  return result.data;
}

/**
 * Search by city or location name.
 */
async function getAQIByCity(city) {
  const token = getToken();

  const url =
    `https://api.waqi.info/feed/${encodeURIComponent(city)}/` +
    `?token=${encodeURIComponent(token)}`;

  return fetchWAQIData(url);
}

/**
 * Search using latitude and longitude.
 */
async function getAQIByCoordinates(latitude, longitude) {
  const token = getToken();

  const url =
    `https://api.waqi.info/feed/geo:${latitude};${longitude}/` +
    `?token=${encodeURIComponent(token)}`;

  return fetchWAQIData(url);
}

/**
 * Display AQI and pollutant information.
 */
function showAQI(data) {
  aqResult.classList.remove("hidden");

  $("#locationName").textContent =
    data.city?.name || "Selected monitoring station";

  $("#updatedAt").textContent = data.time?.s
    ? `Updated: ${data.time.s}`
    : "Update time unavailable";

  const aqi = Number(data.aqi);
  const aqiBadge = $("#aqiBadge");

  aqiBadge.textContent = Number.isFinite(aqi)
    ? `AQI ${aqi}`
    : "AQI unavailable";

  aqiBadge.style.backgroundColor = getAQIColour(aqi);
  aqiBadge.style.color = getAQITextColour(aqi);

  $("#domPol").textContent = data.dominentpol
    ? `Dominant pollutant: ${data.dominentpol.toUpperCase()}`
    : "Dominant pollutant unavailable";

  const pollutantsContainer = $("#pollutants");
  pollutantsContainer.innerHTML = "";

  if (!data.iaqi || Object.keys(data.iaqi).length === 0) {
    pollutantsContainer.innerHTML =
      '<p class="muted">No individual pollutant measurements are available.</p>';

    return;
  }

  const preferredOrder = [
    "pm25",
    "pm10",
    "no2",
    "so2",
    "o3",
    "co",
    "nh3",
    "t",
    "h",
    "p",
    "w"
  ];

  const pollutantNames = {
    pm25: "PM2.5",
    pm10: "PM10",
    no2: "NO₂",
    so2: "SO₂",
    o3: "O₃",
    co: "CO",
    nh3: "NH₃",
    t: "Temperature",
    h: "Humidity",
    p: "Pressure",
    w: "Wind"
  };

  const pollutantUnits = {
    t: "°C",
    h: "%",
    p: "hPa",
    w: "m/s"
  };

  const entries = Object.entries(data.iaqi).sort(([keyA], [keyB]) => {
    const indexA = preferredOrder.indexOf(keyA);
    const indexB = preferredOrder.indexOf(keyB);

    const orderA = indexA === -1 ? 999 : indexA;
    const orderB = indexB === -1 ? 999 : indexB;

    return orderA - orderB;
  });

  entries.forEach(([key, measurement]) => {
    if (measurement?.v === undefined || measurement?.v === null) return;

    const card = document.createElement("div");
    card.className = "chip";

    const name = pollutantNames[key] || key.toUpperCase();
    const unit = pollutantUnits[key] || "";

    const nameElement = document.createElement("strong");
    nameElement.textContent = name;

    const valueElement = document.createElement("span");
    valueElement.className = "muted";
    valueElement.textContent = `${measurement.v}${unit ? ` ${unit}` : ""}`;

    card.appendChild(nameElement);
    card.appendChild(document.createElement("br"));
    card.appendChild(valueElement);

    pollutantsContainer.appendChild(card);
  });
}

/**
 * Run a city search.
 */
async function searchByCity(city) {
  try {
    setStatus(`Searching for air-quality data near ${city}…`);
    aqResult.classList.add("hidden");

    const data = await getAQIByCity(city);

    showAQI(data);
    setStatus("Live monitoring-station data loaded successfully.");
  } catch (error) {
    console.error("WAQI city search error:", error);
    setStatus(`Unable to load data: ${error.message}`, true);
  }
}

/**
 * Run a GPS search.
 */
async function searchByGPS() {
  if (!navigator.geolocation) {
    setStatus("Your browser does not support location services.", true);
    return;
  }

  setStatus("Requesting your location…");

  gpsButton.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        setStatus("Searching for the nearest monitoring station…");
        aqResult.classList.add("hidden");

        const { latitude, longitude } = position.coords;

        const data = await getAQIByCoordinates(latitude, longitude);

        showAQI(data);
        setStatus("Nearest available monitoring-station data loaded.");
      } catch (error) {
        console.error("WAQI GPS search error:", error);
        setStatus(`Unable to load data: ${error.message}`, true);
      } finally {
        gpsButton.disabled = false;
      }
    },
    (error) => {
      gpsButton.disabled = false;

      let message = "Your location could not be accessed.";

      if (error.code === error.PERMISSION_DENIED) {
        message =
          "Location permission was denied. Allow location access or search by city.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = "Your current location is unavailable.";
      } else if (error.code === error.TIMEOUT) {
        message = "The location request timed out.";
      }

      setStatus(message, true);
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

/**
 * City-search form event.
 */
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const city = cityInput.value.trim();

  if (!city) {
    setStatus("Please enter a city or location name.", true);
    cityInput.focus();
    return;
  }

  searchByCity(city);
});

/**
 * GPS button event.
 */
gpsButton.addEventListener("click", searchByGPS);
```
