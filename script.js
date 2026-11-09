let CLIM = null;
let FORECASTS = null;
let hourlyChart = null;
let rainChart = null;

let state = { zone: "nigeria", variable: "temp", date: null };

const ZONE_NAME = {
  nigeria: "Nigeria",
  Tropical_Monsoon: "the Monsoon zone",
  Tropical_Savannah: "the Savannah zone",
  Tropical_Dry_Sahel: "the Sahel",
  Montane: "the Montane zone",
};

async function loadData() {
  const [r1, r2] = await Promise.all([fetch('climatology.json'), fetch('zone_forecasts.json')]);
  CLIM = await r1.json();
  FORECASTS = await r2.json();

  const dateInput = document.getElementById('datePick');

  // The valid range is anchored to the data, not to the machine's clock:
  // predictions start the day after the training data ends (2025-12-31),
  // so every day of the following years is selectable regardless of
  // what "today" happens to be on the device running the app.
  const dataEnd = FORECASTS['nigeria'].generated_from; // "2025-12-31"
  const minDate = addDays(dataEnd, 1);
  dateInput.min = minDate;

  const maxD = new Date(dataEnd + "T00:00:00");
  maxD.setFullYear(maxD.getFullYear() + 10);
  const maxDate = toISODate(maxD);
  dateInput.max = maxDate;

  // Default to the real "today" when it falls inside that range (the
  // common case), otherwise fall back to the first selectable date.
  let defaultDate = toISODate(new Date());
  if (defaultDate < minDate || defaultDate > maxDate) defaultDate = minDate;
  dateInput.value = defaultDate;
  state.date = defaultDate;

  render();
}

function toISODate(d) {
  // Use local date components, not toISOString() (which converts to UTC
  // and can silently shift the date by a day depending on the viewer's
  // timezone offset).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  let doy = Math.floor(diff / 86400000);
  if (doy > 365) doy = 365; // fold leap-day into day 365 bucket
  return doy;
}

// Returns { value, method } where method is 'model' or 'climatology'
function predict(zone, variable, dateStr) {
  const forecast = FORECASTS[zone];
  const idx = forecast.dates.indexOf(dateStr);

  if (idx !== -1) {
    const value = variable === "temp" ? forecast.temp_forecast[idx] : forecast.rain_forecast[idx];
    return { value, method: "model" };
  }

  // climatology + trend fallback
  const d = new Date(dateStr + "T00:00:00");
  const doy = dayOfYear(d);
  const c = CLIM[zone];
  const base = variable === "temp" ? c.temp_climatology[doy - 1] : c.rain_climatology[doy - 1];
  const yearsFromRef = (d.getFullYear() + doy / 365) - c.trend_reference_year;
  // Temperature's trend is a daily-mean rate -- applies directly to any single day.
  // Rainfall's trend is measured from ANNUAL TOTALS, so it has to be spread across
  // the 365 days it represents before applying it to one day's climatology value --
  // otherwise a whole year's worth of decline gets wrongly dumped onto one day.
  const slope = variable === "temp" ? c.trend_slope_temp_per_yr : c.trend_slope_rain_per_yr / 365;
  let value = base + slope * yearsFromRef;
  if (variable === "rain") value = Math.max(value, 0);
  return { value: +value.toFixed(2), method: "climatology", doy };
}

function predictMinMax(zone, dateStr) {
  // Used for the hourly curve: derive a plausible max/min around the
  // predicted mean using the zone's typical diurnal amplitude.
  const mean = predict(zone, "temp", dateStr).value;
  const amp = CLIM[zone].diurnal_amplitude;
  return { min: mean - amp / 2, max: mean + amp / 2 };
}

function hourlyCurve(minT, maxT) {
  // Min at 06:00, max at 15:00, smooth half-cosine rise and fall.
  const hours = [];
  for (let h = 0; h < 24; h++) {
    let t;
    if (h >= 6 && h <= 15) {
      const frac = (h - 6) / 9;
      t = minT + (maxT - minT) * (1 - Math.cos(Math.PI * frac)) / 2;
    } else {
      const hAdj = h < 6 ? h + 24 : h;
      const frac = (hAdj - 15) / 15;
      t = maxT - (maxT - minT) * (1 - Math.cos(Math.PI * frac)) / 2;
    }
    hours.push(+t.toFixed(1));
  }
  return hours;
}

function consequenceText(zone, variable, value, method) {
  const t = CLIM[zone].thresholds;
  const zoneName = ZONE_NAME[zone];

  if (variable === "temp") {
    if (value >= t.hot_95) {
      return `This is <strong>severe heat</strong> for ${zoneName} &mdash; in the hottest 5% of days on record here. Expect real heat-stress risk for outdoor workers, livestock, and anyone without reliable shade or cooling.`;
    }
    if (value >= t.hot_95 - 2) {
      return `This is <strong>above-normal heat</strong> for ${zoneName}. Not extreme, but enough to raise water demand and discomfort, particularly for vulnerable groups.`;
    }
    if (value <= t.cold_5) {
      return `This is <strong>unusually cool</strong> for ${zoneName} &mdash; cooler than 95% of days on record here. Low direct risk, but notable against the zone's normal range.`;
    }
    return `This sits within the <strong>normal range</strong> for ${zoneName} on this date.`;
  }

  // rainfall
  if (value <= t.dry) {
    return `This is a <strong>dry day</strong> for ${zoneName}. On its own this is unremarkable &mdash; but a run of days like this stresses rain-fed crops and water supply if it continues.`;
  }
  if (value >= t.heavy_rain_95) {
    return `This is <strong>heavy rainfall</strong> for ${zoneName} &mdash; in the top 5% of daily totals on record here. Flood and drainage risk rises sharply on days like this, especially in low-lying or urban areas.`;
  }
  return `This is <strong>typical rainfall</strong> for ${zoneName} on this date.`;
}

function render() {
  const { zone, variable, date } = state;
  const result = predict(zone, variable, date);
  const unit = variable === "temp" ? "°C" : "mm";

  document.getElementById('figure').textContent = `${result.value}${unit}`;
  document.getElementById('resultLabel').textContent =
    `${variable === "temp" ? "Temperature" : "Rainfall"} · ${ZONE_NAME[zone]} · ${date}`;
  document.getElementById('methodTag').textContent =
    result.method === "model" ? "Model forecast" : "Historical pattern + trend";

  document.getElementById('consequence').innerHTML =
    consequenceText(zone, variable, result.value, result.method);

  const hourlyBlock = document.getElementById('hourlyBlock');
  const rainBlock = document.getElementById('rainBlock');
  if (variable === "temp") {
    hourlyBlock.style.display = "";
    rainBlock.style.display = "none";
    renderHourly();
  } else {
    hourlyBlock.style.display = "none";
    rainBlock.style.display = "";
    renderRainContext();
  }
}

function renderHourly() {
  const { min, max } = predictMinMax(state.zone, state.date);
  const hours = hourlyCurve(min, max);

  const ctx = document.getElementById('hourlyChart').getContext('2d');
  if (hourlyChart) hourlyChart.destroy();
  hourlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 24 }, (_, h) => `${h}:00`),
      datasets: [{
        data: hours,
        borderColor: "#d0453b",
        backgroundColor: "#d0453b14",
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { label: (c) => `${c.parsed.y}°C` } } },
      scales: {
        y: { grid: { color: '#eef1f6' }, ticks: { font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 8 } }
      }
    }
  });
}

function renderRainContext() {
  // Rainfall has no honest hour-by-hour curve, so instead of leaving the
  // panel blank, show the real predicted/climatological totals for the
  // days surrounding the selected date -- genuine data, just at daily
  // rather than hourly resolution.
  const offsets = [-3, -2, -1, 0, 1, 2, 3];
  const t = CLIM[state.zone].thresholds;
  const labels = [];
  const values = [];

  offsets.forEach((o) => {
    const ds = addDays(state.date, o);
    const d = new Date(ds + "T00:00:00");
    labels.push(o === 0 ? "Selected" : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    values.push(predict(state.zone, "rain", ds).value);
  });

  const ctx = document.getElementById('rainChart').getContext('2d');
  if (rainChart) rainChart.destroy();
  rainChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: offsets.map(o => o === 0 ? "#2451c4" : "#2451c466"),
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false, callbacks: { label: (c) => `${c.parsed.y}mm` } }
      },
      scales: {
        y: { grid: { color: '#eef1f6' }, ticks: { font: { size: 10 } }, suggestedMax: Math.max(t.heavy_rain_95 * 1.1, ...values, 1) },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

document.getElementById('zoneGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('.zone-btn');
  if (!btn) return;
  state.zone = btn.dataset.zone;
  document.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
});

document.getElementById('varToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('.var-btn');
  if (!btn) return;
  state.variable = btn.dataset.var;
  document.querySelectorAll('.var-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
});

document.getElementById('datePick').addEventListener('change', (e) => {
  if (!e.target.value) return;
  state.date = e.target.value;
  render();
});

document.getElementById('hourlyToggle').addEventListener('click', (e) => {
  const wrap = document.getElementById('hourlyChartWrap');
  const showing = wrap.style.display !== "none";
  wrap.style.display = showing ? "none" : "";
  e.target.textContent = showing ? "Show hour-by-hour pattern ↓" : "Hide hour-by-hour pattern ↑";
  if (!showing) renderHourly();
});

document.getElementById('rainToggle').addEventListener('click', (e) => {
  const wrap = document.getElementById('rainChartWrap');
  const showing = wrap.style.display !== "none";
  wrap.style.display = showing ? "none" : "";
  e.target.textContent = showing ? "Show nearby days ↓" : "Hide nearby days ↑";
  if (!showing) renderRainContext();
});

loadData();
