# Key request flows

Images for slides: [`img/flow-join.png`](img/flow-join.png), [`img/flow-donate.png`](img/flow-donate.png).

## 1. Join a seva (no overbooking)

```mermaid
sequenceDiagram
  autonumber
  actor V as Volunteer
  participant App as Web / mobile app
  participant API as REST/RPC API
  participant DB as PostgreSQL
  V->>App: Tap "Join"
  App->>API: rpc join_task(task, qty) + JWT
  API->>DB: call as the signed-in user
  DB->>DB: lock the seva row (select … for update)
  DB->>DB: check: published, open, deadline, private access, course, not blocked
  alt spots left
    DB->>DB: insert assignment, triggers update counters
    DB->>DB: notification "Your position is confirmed"
    DB-->>App: { status: joined }
  else full / changed
    DB-->>App: { status: full } or { capacity_changed, available }
  end
  App-->>V: Confirmation or "Only N left"
```

Two people pressing Join at the same moment are served one after the other, because of the row lock, so the last spot is never sold twice.

## 2. Donate (money goes straight to the organization)

```mermaid
sequenceDiagram
  autonumber
  actor D as Donor
  participant App
  participant F as donate-checkout (Edge Function → Lambda)
  participant DB as PostgreSQL
  participant S as Stripe (organization's account)
  participant W as stripe-webhook (Edge Function → Lambda)
  D->>App: Choose amount, monthly or once
  App->>F: POST campaign, amount
  F->>DB: insert donation (pending)
  F->>S: create Checkout session on the connected account
  F-->>App: Checkout URL
  D->>S: Pay on Stripe's page
  S->>W: webhook (signed)
  W->>W: verify signature
  W->>DB: match id + session + account + amount + currency
  W->>DB: mark paid → campaign totals, notify organizers
  S-->>D: Receipt email
```

## 3. Complete an event and log hours

```mermaid
sequenceDiagram
  autonumber
  actor O as Organizer
  participant App
  participant DB as PostgreSQL
  O->>App: Complete event
  App->>DB: rpc event_hours_candidates(event)
  DB-->>App: volunteers + estimated hours
  O->>App: Adjust hours, enter people reached
  App->>DB: update events.people_reached
  App->>DB: rpc complete_event(event, hours[])
  DB->>DB: check organizer, published, every row belongs to this event
  DB->>DB: upsert event_hours, notify each volunteer
  DB->>DB: status = completed (status guard allows it only here)
  DB-->>App: done
  Note over DB: Dashboard, Impact and Volunteer 360 read these hours
```
