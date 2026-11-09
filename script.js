let CLIM = null;
let FORECASTS = null;
let hourlyChart = null;

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
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = toISODate(tomorrow);
  dateInput.min = minDate;
  dateInput.value = minDate;
  state.date = minDate;

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 10);
  dateInput.max = toISODate(maxDate);

  render();
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
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
  const rainNote = document.getElementById('rainHourlyNote');
  if (variable === "temp") {
    hourlyBlock.style.display = "";
    rainNote.style.display = "none";
    renderHourly();
  } else {
    hourlyBlock.style.display = "none";
    rainNote.style.display = "";
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

loadData();
