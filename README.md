# Duka Stock Sync

Build a B2B inventory sync web app for a wholesale distributor supplying small

retail kiosks ("dukas") in Kenya. The distributor runs regional warehouses and

dukas need to check real-time stock availability before placing orders.

CORE ENTITIES:

1. Items — sku (text, unique), name, category, wholesale_price_kes (number),

   unit_description (e.g. "carton of 24"), created_at

2. Warehouses — id, name, region (e.g. "Nairobi Industrial Area"), created_at

3. Stock — warehouse_id (FK), item_id (FK), quantity_available (number),

   last_synced_at (timestamp)

4. Orders — id, duka_name (text), item_id (FK), warehouse_id (FK),

   quantity_requested, status (enum: pending, confirmed, rejected), created_at

CRUD REQUIREMENTS:

- Full CRUD UI for Items: create, list/search by SKU or name, edit, delete

  (soft-delete/discontinue, don't hard-delete if there's order history)

- Full CRUD UI for Warehouses: create, list, edit, delete

- Stock management screen: view stock by warehouse, manually adjust quantity

  (e.g. for damaged-goods write-offs), see last_synced_at per row

- Orders screen: dukas can submit an order request (item + warehouse +

  quantity), see order status; staff can view all orders and confirm/reject

CORE BUSINESS LOGIC — STOCK AVAILABILITY CHECK:

- Before an order can be confirmed, check quantity_available for that

  item+warehouse combination

- If quantity_requested > quantity_available, reject automatically with a

  clear message

- Show a real-time-feeling "Available: X units" indicator on the order form

SIMULATED SYNC (polling model — this is the important part):

- Build a background process (or a simple scheduled/simulated job) that

  polls a mock "warehouse system" every 5 minutes and updates the Stock

  table's quantity_available and last_synced_at

- Since there's no real warehouse API, simulate it: generate small random

  stock fluctuations (+/- a few units) on each poll cycle to mimic real

  warehouse activity, and log each sync run (timestamp, items updated,

  any errors) to a visible "Sync Log" screen

- The Sync Log screen matters — I need to see poll history, not just

  final state, for documentation purposes

UI/STYLE:

- Clean, functional dashboard style — sidebar nav (Items, Warehouses,

  Stock, Orders, Sync Log)

- Currency displayed in KES

- Mobile-responsive, since staff may check this on phones

DATABASE:

- Use Supabase for the backend/database

- Include reasonable seed data: 3 warehouses (Nairobi, Mombasa, Kisumu

  regions), ~15 sample items (common Kenyan FMCG products — cooking oil,

  maize flour, sugar, soap, etc.), and initial stock levels

DO NOT build any webhook receiver or webhook-related functionality yet —

polling only, for now. I'll extend this in a later phase.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/00478e1c-ed6e-4f49-b071-7a122873d60b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
