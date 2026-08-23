# Service Floor Tycoon — custom scenarios

The game is driven by a scenario JSON document. Open **Scenario studio → JSON** to edit the active scenario, or import a `.json` file. Every scenario and game save is stored locally in the browser in the `ServiceTycoonDB` IndexedDB database.

A ready-to-import example is included in [`examples/restaurant.json`](examples/restaurant.json). The game also installs Academy and Restaurant examples automatically the first time it opens.

## File structure

```text
service-tycoon/
├── index.html
├── styles.css
├── app.js
├── README.md
└── examples/
    └── restaurant.json
```

## Scenario schema

```json
{
  "id": "unique-scenario-id",
  "name": "Scenario name",
  "builtIn": false,
  "icon": "✦",
  "currencySymbol": "$",
  "color": "#44d7c2",
  "floor": { "columns": 5, "rows": 5 },
  "icons": {
    "customer": "●",
    "staff": "✦",
    "room": "▤",
    "equipment": "▰"
  },
  "characters": {
    "staff": [
      { "id": "staff-1", "skin": "#f1c6a5", "body": "#a7ef5b", "head": "circle", "bodyShape": "rounded", "icon": "✦" }
    ],
    "customers": [
      { "id": "customer-1", "skin": "#f8d5b8", "body": "#44d7c2", "head": "circle", "bodyShape": "rounded", "icon": "●" }
    ]
  },
  "labels": {
    "customer": { "en": "student", "pt": "aluno", "ja": "生徒" },
    "customerPlural": { "en": "Students", "pt": "Alunos", "ja": "生徒" },
    "staff": { "en": "teacher", "pt": "professor", "ja": "先生" },
    "staffPlural": { "en": "Teachers", "pt": "Professores", "ja": "先生" },
    "room": { "en": "classroom", "pt": "sala", "ja": "教室" },
    "roomPlural": { "en": "Classrooms", "pt": "Salas", "ja": "教室" }
  },
  "activities": [
    {
      "id": "tutoring",
      "name": { "en": "Tutoring", "pt": "Reforço", "ja": "個別指導" },
      "icon": "✎",
      "minDuration": 10,
      "maxDuration": 15,
      "baseRevenue": 48,
      "weight": 1
    }
  ],
  "equipment": [
    {
      "level": 1,
      "name": { "en": "Study desk", "pt": "Mesa de estudo", "ja": "学習机" },
      "icon": "▰",
      "revenueMultiplier": 1
    }
  ],
  "upgrades": {
    "hireStaff": { "baseCost": 180, "multiplier": 1.28 },
    "openRoom": { "baseCost": 260, "multiplier": 1.28 },
    "staffTraining": { "baseCost": 220, "multiplier": 1.28, "revenueBonus": 0.12 },
    "room": { "baseCost": 120, "multiplier": 1.28, "revenueBonus": 0.28 },
    "equipment": { "baseCost": 90, "multiplier": 1.28, "revenueBonus": 0.2 },
    "waitingSeats": { "baseCost": 90, "multiplier": 1.3 },
    "loungeSeats": { "baseCost": 75, "multiplier": 1.28 },
    "elevatorCount": { "baseCost": 320, "multiplier": 1.55 },
    "elevatorSpeed": { "baseCost": 180, "multiplier": 1.38 }
  },
  "facilities": {
    "waiting": { "startingSeats": 4, "maxSeats": 12, "seatsPerUpgrade": 2 },
    "lounge": { "startingSeats": 3, "maxSeats": 12, "seatsPerUpgrade": 2 },
    "elevators": {
      "startingCount": 1,
      "maxCount": 6,
      "baseTravelTime": 1.8,
      "speedMultiplier": 0.78,
      "minimumTravelTime": 0.35
    }
  },
  "routing": {
    "staffServicePosition": "inside",
    "restPolicy": "queueAware",
    "restMin": 3,
    "restMax": 5,
    "walkSpeed": 230,
    "followDelay": 0.24
  },
  "simulation": {
    "minDuration": 10,
    "maxDuration": 15,
    "arrivalInterval": 4.2,
    "waitingCapacity": 12,
    "staffPerService": 1,
    "startingStaff": 1,
    "startingRooms": 1,
    "walkDuration": 0.85
  },
  "economy": {
    "startingCash": 360,
    "baseRevenue": 48,
    "hireBaseCost": 180,
    "roomBaseCost": 260,
    "staffUpgradeBaseCost": 220,
    "roomUpgradeBaseCost": 120,
    "equipmentUpgradeBaseCost": 90,
    "levelMultiplier": 1.28,
    "equipmentRevenueBonus": 0.2,
    "roomRevenueBonus": 0.28,
    "staffRevenueBonus": 0.12
  }
}
```

## Field reference

### Identity and appearance

- `id`: stable, unique key used to connect the scenario to its saved game.
- `name`: name shown in the header and scenario library.
- `builtIn`: informational flag used to mark bundled examples.
- `icon`: icon shown in the scenario library.
- `currencySymbol`: prefix used for all prices.
- `color`: CSS color used as the scenario accent in the interface.
- `appearance.theme`: `dark` or `light`. Changes the interface chrome and default text colors. The header theme button stores the same preference in IndexedDB and applies it immediately.
- `appearance.background`: color of the playable floor/stage. Independent of the interface theme. Text on the floor automatically switches between light and dark for contrast.
- `appearance.roomFill`: interior fill of opened rooms. Independent of the theme and of the stage background. Room labels also pick a contrasting ink color.
- `appearance.roomColor`: accent used for opened-room borders, doors, and progress. Defaults to `color` and can differ from the interface theme.
- `floor.columns` / `floor.rows`: number of rooms shown horizontally and vertically, from `1` to `8` on each axis. Their product is the scenario's room capacity. The grid always stretches across the complete central game area, so configurations with fewer rooms display proportionally larger rooms.
- `icons`: short text or emoji markers for customers, staff, rooms, and equipment.
- `characters.staff` / `characters.customers`: arrays of looks used by the walking people. Each look has `id`, `skin`, `body` (clothes color), `head` (`circle`, `oval`, `square`, `diamond`, `hex`), `bodyShape` (`rounded`, `square`, `tall`, `wide`, `triangle`, `capsule`), `hair` (`none`, `short`, `spike`, `side`, `bob`, `long`, `bun`, `pony`, `curly`), `hairColor`, and an optional `icon` badge. Hair uses a back layer plus a front fringe so the cut sits over the face. `short`, `spike`, and `side` read as shorter/masculine cuts; `bob`, `long`, `bun`, `pony`, and `curly` as longer/feminine cuts. The Scenario Studio **Characters** tab edits these visually. New staff and customers pick a random look that has not been used yet in the current round; after every type has appeared, looks may repeat.
- `roomLayout.furniture`: side-view objects drawn inside every opened room. Each item has `id`, `kind` (`chair`, `table`, `desk`, `bed`, `whiteboard`, `cabinet`, `window`, `toilet`, `bath`, `plant`), `x` / `y` (percent of the room, origin top-left, anchor at the object's feet), `w` / `h` (size), optional `flip`, and `color`. The Scenario Studio **Room** tab lets you drag these and resize them by dragging the edges of a selected object.
- `roomLayout.stations`: standing points for people during service. Each station has `role` (`customer`, `staff`, or `both`), `x` / `y`, and `minShare` / `maxShare` (percent of the service time spent there). Shares are randomized in that range and then scaled so they fill the whole service. Staff with `routing.staffServicePosition` set to `outside` stay at the door and ignore staff/shared stations.
- The Scenario Studio includes a searchable gallery with hundreds of portable Unicode icons. A selected icon can be applied to the scenario, customer, staff, room, equipment, or primary activity without editing JSON.
- `labels`: singular and plural entity names in English (`en`), Portuguese (`pt`), and Japanese (`ja`). Japanese uses `ja` as its standard language code even though the switcher is labelled JP.
- `activities`: one or more weighted service recipes. Each activity controls its localized name, room icon, duration, base revenue, and selection weight. This is how one hotel can mix room stays and food delivery.
- `equipment`: named, localized equipment tiers. The highest configured tier remains active for later levels, which continue receiving the configured upgrade bonus.
- `upgrades`: prices, price multipliers, and revenue bonuses for hiring, expansion, team training, rooms, and equipment. These values override the compatible fallback fields in `economy`.
- `facilities.waiting` / `facilities.lounge`: initial chair count, maximum chair count, and chairs added per upgrade. Waiting chairs determine the live queue capacity; lounge chairs give idle staff individual seats.
- `facilities.elevators`: initial and maximum elevator counts plus travel-time rules. Each cabin can carry one incoming or departing customer at a time. Additional elevators increase parallel capacity; speed levels multiply travel time by `speedMultiplier` down to `minimumTravelTime`.
- `upgrades.elevatorCount` / `upgrades.elevatorSpeed`: purchase-price curves for adding elevator cabins and upgrading the speed of the whole elevator bank.
- `routing.staffServicePosition`: use `inside` to keep staff beside the customer during service, or `outside` to place staff at the room door in the corridor.
- `routing.restPolicy`: `queueAware` sends staff straight to the next waiting customer and uses the lounge only when the queue is empty. `timed` enforces a break between services.
- `routing.restMin` / `restMax`: random break range, in seconds, for the `timed` policy.
- `routing.walkSpeed`: corridor walking speed in pixels per second. Longer routes therefore take longer naturally.
- `routing.followDelay`: delay in seconds between people following the same corridor route, from `0.08` to `1.5`. Staff lead the customer, while additional staff follow behind, preventing characters from walking on top of one another. The default is `0.24`.

### Simulation

- `minDuration` / `maxDuration`: random service duration in seconds.
- `arrivalInterval`: average number of seconds between customer arrivals. Each arrival receives a small random variation.
- `waitingCapacity`: compatibility fallback for the maximum number of customers. New scenarios should keep it equal to `facilities.waiting.maxSeats`.
- `staffPerService`: number of available staff required to start one service. Set this to `2` or more for a hotel room with multiple dedicated butlers.
- `startingStaff` / `startingRooms`: initial team and open-room counts for a new game. `startingRooms` cannot exceed `floor.columns × floor.rows`.
- `walkDuration`: base animation time in seconds between areas.

### Economy

- `startingCash`: money in a new saved game.
- `baseRevenue`: base payment for one completed service.
- `hireBaseCost`, `roomBaseCost`, `staffUpgradeBaseCost`, `roomUpgradeBaseCost`, `equipmentUpgradeBaseCost`: first purchase prices.
- `levelMultiplier`: exponential cost multiplier for repeat purchases.
- `equipmentRevenueBonus`, `roomRevenueBonus`, `staffRevenueBonus`: decimal revenue bonus per level above 1. For example, `0.2` adds 20% per extra level.

## How the simulation works

Customers arrive through the elevator and follow the open corridors into the waiting room. When a room and the configured number of staff are free, staff follow the corridors to the waiting room, escort a customer through that room's animated door, remain beside the customer (or wait outside, according to the scenario), then leave through the same door and return to the elevator to collect payment. With `queueAware`, staff go directly to the next customer and visit the lounge only when the queue is empty. A room cannot start a second service until the current group exits.

Click **Floor 01** above the room grid to open the floor-upgrade manager. It mirrors the configured room layout and shows every open room's current room and equipment levels. Both upgrades can be purchased repeatedly for different rooms without closing the panel; costs, cash, levels, and availability update after every purchase. **Upgrade all rooms + equipment** performs one atomic purchase that adds one room level and one equipment level to every open room. Its displayed price is the sum of all individual upgrades, and the button remains disabled until the complete amount is available.

The first release uses one service recipe per scenario. The schema is intentionally grouped so that future versions can add multiple activities, equipment types, service recipes, and 3D presentation without changing the identity, localization, or base-economy fields.

## Persistence and backup

When **Save & play** changes the active scenario or alters its rules, **Preserve value when reconfiguring** is enabled by default. The game closes the current operation, refunds the original purchase price of hired staff, opened rooms, room and equipment levels, extra chairs, elevators, and elevator-speed levels, then starts the selected configuration with its base resources. Existing cash, lifetime revenue, and served-customer totals move to the selected configuration. Initial resources are not refunded because the new configuration supplies its own initial resources. The previous and destination saves are replaced so the transferred value cannot be duplicated by switching scenarios repeatedly.

Clear the checkbox before **Save & play** to discard the previous cash and resources and start from the new configuration's `startingCash`. The preference itself is stored in IndexedDB.

The database contains:

- `scenarios`: built-in and custom JSON configurations;
- `saves`: cash, revenue, staff, upgrades, and opened rooms per scenario;
- `preferences`: active scenario, language, interface theme, and reconfiguration policy.

Use the main VC Collection **Backup & Restore** utility to export or restore this database together with the rest of the collection.
