# Nigeria Climate Forecast

A minimal interactive forecast tool built on a research project analyzing
46 years (1980–2025) of real ERA5 climate data for Nigeria.

Select a zone (Nigeria, or one of its four climate regions) and a variable
(temperature or rainfall) to see a real 14-day forecast from a trained LSTM
neural network — not a statistical trend line, the model's actual output,
generated recursively day by day from the end of the training data
(2025-12-31).

## Tech

Static site — plain HTML/CSS/JS, [Chart.js](https://www.chartjs.org/) for
the chart, no build step or backend required. `zone_forecasts.json`
contains the precomputed model output (5 zones × 14 days × 2 variables),
generated from the underlying Python research project.

## Deploy

Zero-config static site — deploy on [Vercel](https://vercel.com) by
importing this repository.

## Local development

```
python -m http.server 8000
```
then open `http://localhost:8000`.
