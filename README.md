# Nigeria's Changing Climate

An interactive web dashboard presenting findings from a research project
analyzing 46 years (1980–2025) of real ERA5 climate data for Nigeria, using
statistical trend detection (Mann-Kendall, BEAST) and machine learning
(LSTM, Random Forest) to detect and predict temperature and rainfall change
across Nigeria's four climate zones.

## Features

- Interactive zone selector (Nigeria + 4 climate zones)
- Real historical temperature/rainfall trends, 1980–2025
- Trend-based projections to 2035
- Plain-language explanations of human impact per zone
- Extreme weather event trends (hot days, heavy rainfall days)
- Real-world forecast validation: models trained only through 2025,
  checked against actual observed January 2026 weather

## Tech

Static site — plain HTML/CSS/JS, [Chart.js](https://www.chartjs.org/) for
charts, no build step or backend required. All data in `data.json` was
exported from the underlying Python research project (real ERA5 data +
actual trained model results, not placeholder numbers).

## Deploy

This is a zero-config static site — deploy directly on [Vercel](https://vercel.com)
by importing this repository.

## Local development

```
python -m http.server 8000
```
then open `http://localhost:8000`.
