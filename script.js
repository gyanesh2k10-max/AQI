document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("searchForm");
  const cityInput = document.getElementById("cityInput");
  const gpsButton = document.getElementById("useGPS");
  const statusMessage = document.getElementById("statusMessage");
  const aqResult = document.getElementById("aqResult");

  const locationName = document.getElementById("locationName");
  const updatedAt = document.getElementById("updatedAt");
  const aqiBadge = document.getElementById("aqiBadge");
  const domPol = document.getElementById("domPol");
  const pollutants = document.getElementById("pollutants");

  function showStatus(message, isError = false) {
    if (!statusMessage) return;

    statusMessage.textContent = message;
    statusMessage.style.color = isError ? "#c62828" : "#68748a";
  }

  function getToken() {
    const token = window.WAQI_TOKEN?.trim();

    if (
      !token ||
      token === "YOUR_VALID_WAQI_TOKEN" ||
      token === "PASTE_YOUR_NEW_WAQI_TOKEN_HERE" ||
      token === "REPLACE_WITH_YOUR_WAQI_TOKEN"
    ) {
      throw new Error(
        "WAQI token is missing. Add your valid token near the bottom of index.html."
      );
    }

    return token;
  }

  function getAQIColour(aqi) {
    if (!Number.isFinite(aqi)) return "#6c757d";
    if (aqi <= 50) return "#009b36";
    if (aqi <= 100) return "#77b82a";
    if (aqi <= 150) return "#f4b000";
    if (aqi <= 200) return "#f27900";
    if (aqi <= 300) return "#d93424";

    return "#7a208f";
  }

  function getAQITextColour(aqi) {
    return aqi <= 150 ? "#111111" : "#ffffff";
  }

  async function requestAQIData(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Network error ${response.status}`);
    }

    const result = await response.json();

    console.log("WAQI response:", result);

    if (result.status !== "ok") {
      const errorText =
        typeof result.data === "string"
          ? result.data
          : "No air-quality station was found for this location.";

      throw new Error(errorText);
    }

    return result.data;
  }

  async function searchCity(city) {
    const token = getToken();

    /*
     * First try the direct city feed.
     */
    const directUrl =
      `https://api.waqi.info/feed/${encodeURIComponent(city)}/` +
      `?token=${encodeURIComponent(token)}`;

    try {
      return await requestAQIData(directUrl);
    } catch (directError) {
      console.warn("Direct city search failed:", directError);

      /*
       * If the direct feed fails, search for monitoring stations.
       */
      const searchUrl =
        `https://api.waqi.info/search/` +
        `?token=${encodeURIComponent(token)}` +
        `&keyword=${encodeURIComponent(city)}`;

      const response = await fetch(searchUrl);

      if (!response.ok) {
        throw new Error(`Network error ${response.status}`);
      }

      const result = await response.json();

      console.log("WAQI station search:", result);

      if (
        result.status !== "ok" ||
        !Array.isArray(result.data) ||
        result.data.length === 0
      ) {
        throw new Error(
          "No monitoring station was found. Try a nearby major city."
        );
      }

      const station = result.data[0];

      if (!station.uid) {
        throw new Error("The monitoring station ID is unavailable.");
      }

      const stationUrl =
        `https://api.waqi.info/feed/@${station.uid}/` +
        `?token=${encodeURIComponent(token)}`;

      return requestAQIData(stationUrl);
    }
  }

  async function searchCoordinates(latitude, longitude) {
    const token = getToken();

    const url =
      `https://api.waqi.info/feed/geo:${latitude};${longitude}/` +
      `?token=${encodeURIComponent(token)}`;

    return requestAQIData(url);
  }

  function displayAQI(data) {
    if (!aqResult) return;

    aqResult.classList.remove("hidden");

    locationName.textContent =
      data.city?.name || "Selected monitoring station";

    updatedAt.textContent = data.time?.s
      ? `Updated: ${data.time.s}`
      : "Update time unavailable";

    const aqi = Number(data.aqi);

    aqiBadge.innerHTML = "";

    const label = document.createElement("span");
    label.className = "aqi-label";
    label.textContent = "AQI";

    const number = document.createElement("span");
    number.className = "aqi-number";
    number.textContent = Number.isFinite(aqi) ? aqi : "—";

    aqiBadge.appendChild(label);
    aqiBadge.appendChild(number);

    aqiBadge.style.backgroundColor = getAQIColour(aqi);
    aqiBadge.style.color = getAQITextColour(aqi);

    domPol.textContent = data.dominentpol
      ? data.dominentpol.toUpperCase()
      : "Unavailable";

    pollutants.innerHTML = "";

    if (!data.iaqi || Object.keys(data.iaqi).length === 0) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent =
        "No individual pollutant measurements are available.";

      pollutants.appendChild(message);
      return;
    }

    const displayNames = {
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

    const units = {
      t: "°C",
      h: "%",
      p: "hPa",
      w: "m/s"
    };

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

    const entries = Object.entries(data.iaqi).sort(
      ([firstKey], [secondKey]) => {
        const firstIndex = preferredOrder.indexOf(firstKey);
        const secondIndex = preferredOrder.indexOf(secondKey);

        return (
          (firstIndex === -1 ? 999 : firstIndex) -
          (secondIndex === -1 ? 999 : secondIndex)
        );
      }
    );

    entries.forEach(([key, measurement]) => {
      if (
        measurement?.v === undefined ||
        measurement?.v === null
      ) {
        return;
      }

      const card = document.createElement("div");
      card.className = "chip";

      const title = document.createElement("strong");
      title.textContent = displayNames[key] || key.toUpperCase();

      const lineBreak = document.createElement("br");

      const value = document.createElement("span");
      value.className = "muted";

      const unit = units[key] || "";
let displayValue = measurement.v;

if (["t", "h", "p", "w"].includes(key)) {
  const numericValue = Number(measurement.v);

  if (Number.isFinite(numericValue)) {
    displayValue = numericValue.toFixed(1);
  }
}

value.textContent = `${displayValue}${unit ? ` ${unit}` : ""}`;
      card.appendChild(title);
      card.appendChild(lineBreak);
      card.appendChild(value);

      pollutants.appendChild(card);
        const contactForm = document.getElementById("contactForm");
  const contactStatus = document.getElementById("contactStatus");

  if (contactForm && contactStatus) {
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = contactForm.querySelector(
        ".contact-submit-button"
      );

      const formData = new FormData(contactForm);

      contactStatus.textContent = "Sending your message…";
      contactStatus.className = "contact-status";

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending…";
      }

      try {
        const response = await fetch(contactForm.action, {
          method: "POST",
          body: formData,
          headers: {
            Accept: "application/json"
          }
        });

        if (!response.ok) {
          throw new Error("The message could not be sent.");
        }

        contactForm.reset();

        contactStatus.textContent =
          "Thank you. Your message has been sent successfully.";

        contactStatus.className =
          "contact-status success";
      } catch (error) {
        console.error("Contact form error:", error);

        contactStatus.textContent =
          "Sorry, your message could not be sent. Please try again.";

        contactStatus.className =
          "contact-status error";
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Send message";
        }
      }
    });
  }
    });

    aqResult.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  async function handleCitySearch(city) {
    try {
      showStatus(`Searching for air-quality data near ${city}…`);

      if (aqResult) {
        aqResult.classList.add("hidden");
      }

      const data = await searchCity(city);

      displayAQI(data);
      showStatus("Live air-quality data loaded successfully.");
    } catch (error) {
      console.error("City search error:", error);

      showStatus(
        `Unable to load data: ${error.message}`,
        true
      );
    }
  }

  async function handleGPS() {
    if (!navigator.geolocation) {
      showStatus(
        "Your browser does not support location services.",
        true
      );
      return;
    }

    showStatus("Requesting your current location…");
    gpsButton.disabled = true;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          showStatus(
            "Searching for the nearest air-quality monitoring station…"
          );

          if (aqResult) {
            aqResult.classList.add("hidden");
          }

          const data = await searchCoordinates(
            position.coords.latitude,
            position.coords.longitude
          );

          displayAQI(data);

          showStatus(
            "Nearest monitoring-station data loaded successfully."
          );
        } catch (error) {
          console.error("GPS search error:", error);

          showStatus(
            `Unable to load data: ${error.message}`,
            true
          );
        } finally {
          gpsButton.disabled = false;
        }
      },
      (error) => {
        gpsButton.disabled = false;

        let message =
          "Your current location could not be accessed.";

        if (error.code === error.PERMISSION_DENIED) {
          message =
            "Location permission was denied. Allow location access or search by city.";
        } else if (
          error.code === error.POSITION_UNAVAILABLE
        ) {
          message = "Your current location is unavailable.";
        } else if (error.code === error.TIMEOUT) {
          message = "The location request timed out.";
        }

        showStatus(message, true);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  }

  if (!searchForm || !cityInput) {
    console.error(
      "Search form or city input was not found in index.html."
    );
    return;
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const city = cityInput.value.trim();

    if (!city) {
      showStatus(
        "Please enter a city, state or country.",
        true
      );

      cityInput.focus();
      return;
    }

    handleCitySearch(city);
  });

  if (gpsButton) {
    gpsButton.addEventListener("click", handleGPS);
  }
});
