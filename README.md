# Financial Freedom

Work out how much you need invested to stop depending on a salary, and when you could get there. It runs entirely in your browser, with no build step and no account.

## Use it

Double-click `index.html`. Your numbers stay in that browser, so use **Settings > Save my plan** to keep a copy.

## How it works

- **Overview:** your number, your date, how long your savings last, and the stops along the way.
- **Plan:** life stages with their own income and spending, where you'll live, and what-if comparisons.
- **Money:** optional income and expense tracking with categories and rules.
- **Settings:** currency, assumptions, and saving or loading your data.

Only exchange rates are fetched from the internet, from two free services that need no key. Your data is never sent anywhere.

## Project layout

```
index.html        Page structure
assets/           Favicon
css/              tokens (colours), layout, components
js/
  config.js       Constants
  engine.js       Planning maths, with no DOM or app state
  store.js        Saved data and validation
  rates.js        Exchange rates
  format.js       Display and currency helpers
  model.js        Turns the plan into the numbers views show
  charts.js       SVG charts
  views/          One file per tab
  tutorial.js     First-run walkthrough
  app.js          Startup and tab switching
tests/            Tests for the planning maths
private/          Personal data, ignored by git
```

The scripts are plain files loaded in order rather than ES modules, because browsers block modules on pages opened straight from disk.

## Tests

```
npm test
```

## Privacy

Never commit bank statements or plan files. `.gitignore` covers `private/`, `*.csv`, `*.pdf` and saved plan files.
