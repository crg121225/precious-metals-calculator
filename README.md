# Precious Metals Pricing Calculator

A pricing tool for buying and selling precious metals. Enter an item's metal, purity and weight, and it calculates melt value, a store buy offer and a suggested retail price. A second panel totals the silver content of common bullion coins.

**Built with:** Next.js, React, TypeScript, Tailwind CSS

## Features

- Weekly bullion price sheet (`/price-sheet`) modeled on the shop's handwritten form: the owner sets a premium over melt for each product or types his own price, marks items sold out, then prints the sheet or saves it as an image to post. Settings are saved only in that browser.
- Showcase cards (`/showcase`): photo + item number + price (or "price in store") + in-store rules on one image to share, with a one-tap SOLD stamp. Photos stay on the device.
- Quote price lock and a multi-item customer ticket
- Live spot prices for gold, silver, platinum and palladium from [gold-api.com](https://gold-api.com), refreshed every minute through a server route (`/api/spot`), with a stale-price warning and a manual entry mode as a fallback
- Jewelry pricing for 24k, 22k, 18k, 14k and 10k gold, sterling silver, platinum 950 and pure platinum, by grams or pennyweight
- Adjustable buy margin and retail multiplier, with results that update instantly as you type
- Coin calculator for 90% silver coins (by face value), Morgan and Peace dollars, and American Silver Eagles, with its own buy margin

## What it does and doesn't do

- It's a calculator, not AI: weight × purity × spot price, then the owner's margin or premium.
- The owner sets every margin and premium and can type his own price on any line. Nothing is posted automatically.
- Customer tickets, premiums, prices and showcase photos are never uploaded. Price sheet settings and showcase cards stay in the browser's local storage.
- The only outside request is for public spot prices from gold-api.com.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Live prices need the app to run with its server (`npm run dev`, `npm start`, or a host such as Vercel). A static-only export will not include the `/api/spot` route. Spot prices are market reference prices, not a guaranteed buy or sell price.

## About

Built by Chelsea Gallagher as a portfolio project while studying Software Development at Ivy Tech Community College, with help from AI-assisted development tools.
