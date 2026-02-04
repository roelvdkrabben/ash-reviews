# Review Workflow Design

## 🎯 Doel
Efficiënte workflow voor review generatie, goedkeuring en publicatie met slimme product selectie.

---

## 1. Review Queue Dashboard (`/reviews/queue`)

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Review Wachtrij                          [Shop: Alle ▼]     │
├─────────────────────────────────────────────────────────────────┤
│  Pending: 12  │  Goedgekeurd: 5  │  Ingepland: 8  │  Gepost: 156│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ⭐⭐⭐⭐⭐  "Prima accu, doet wat ie moet doen"          │   │
│  │ Product: Varta Blue Dynamic 74Ah                        │   │
│  │ Shop: Accu Service Holland                              │   │
│  │ Door: J. de Vries                                       │   │
│  │                                                         │   │
│  │ "Besteld op maandag, woensdag al binnen. Past precies   │   │
│  │  in mijn Golf. Motor start nu weer als een zonnetje."   │   │
│  │                                                         │   │
│  │ [✅ Goedkeuren]  [✏️ Bewerken]  [❌ Afwijzen]            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ⭐⭐⭐⭐  "Goede kwaliteit, prijs kon beter"              │   │
│  │ Product: Bosch S4 004 60Ah                              │   │
│  │ ...                                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts
- `A` = Goedkeuren (Approve)
- `R` = Afwijzen (Reject)
- `E` = Bewerken (Edit)
- `↑/↓` = Navigate
- `Space` = Expand/Collapse

### Bulk Actions
- Selecteer meerdere → Bulk goedkeuren/afwijzen
- "Keur alle 4+ sterren goed"

---

## 2. Shop Settings (`/shops/[id]/settings`)

### Review Volume & Planning
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ Review Instellingen - Accu Service Holland                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 VOLUME                                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Reviews per week:  [====●=====] 10                        │ │
│  │                    2          20                          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📅 PLANNING                                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Actieve dagen:  [Ma] [Di✓] [Wo✓] [Do✓] [Vr] [Za✓] [Zo]   │ │
│  │ Tijdslot:       09:00 - 21:00                             │ │
│  │ Min. uren tussen reviews: [4]                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  🎯 PRODUCT PRIORITEIT                                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  🔥 Bestsellers (veel verkocht/reviewed)                  │ │
│  │  [========●===] 60%                                       │ │
│  │  → Focus op producten met veel bestaande reviews          │ │
│  │                                                           │ │
│  │  🆕 Geen reviews                                          │ │
│  │  [====●=======] 25%                                       │ │
│  │  → Producten die nog 0 reviews hebben                     │ │
│  │                                                           │ │
│  │  ⏰ Lang niet reviewed                                    │ │
│  │  [===●========] 15%                                       │ │
│  │  → Producten waar >30 dagen geen review op kwam           │ │
│  │  Dagen sinds laatste review: [30]                         │ │
│  │                                                           │ │
│  │  ──────────────────────────────────────────               │ │
│  │  Totaal: 100% ✓                                           │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [💾 Opslaan]                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Slider Logic
De 3 sliders bepalen de **kans** dat een product wordt geselecteerd voor de volgende review:

| Slider | Criteria | Score basis |
|--------|----------|-------------|
| Bestsellers | `review_count > 5` | review_count * weight |
| Geen reviews | `review_count = 0` | 1 * weight |
| Lang niet reviewed | `days_since_review > X` | days_since * weight |

---

## 3. Scheduler Service

### Auto-Queue Logic
```
Elke nacht om 03:00:

1. Voor elke shop met auto_generate = true:
   a. Bepaal hoeveel reviews nodig (week_target - scheduled_this_week)
   b. Selecteer producten op basis van slider weights
   c. Genereer reviews (Gemini)
   d. Plaats in queue met status 'pending'

2. Approved reviews worden automatisch ingepland:
   a. Check beschikbare slots (dag + tijd)
   b. Respecteer min_hours_between
   c. Update scheduled_at timestamp
```

### Scheduling Calendar View (nice-to-have)
```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Week 6 - Accu Service Holland                               │
├─────────────────────────────────────────────────────────────────┤
│  Ma    │  Di    │  Wo    │  Do    │  Vr    │  Za    │  Zo     │
│        │ 10:23  │ 11:45  │ 09:12  │        │ 14:30  │         │
│        │ ⭐⭐⭐⭐⭐│ ⭐⭐⭐⭐ │ ⭐⭐⭐⭐⭐│        │ ⭐⭐⭐⭐ │         │
│        │ 15:47  │ 16:02  │ 14:55  │        │        │         │
│        │ ⭐⭐⭐⭐ │ ⭐⭐⭐⭐⭐│ ⭐⭐⭐⭐ │        │        │         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Changes

### shops table additions:
```sql
ALTER TABLE shops ADD COLUMN reviews_per_week INTEGER DEFAULT 10;
ALTER TABLE shops ADD COLUMN active_days TEXT[] DEFAULT '{tue,wed,thu,sat}';
ALTER TABLE shops ADD COLUMN time_slot_start TIME DEFAULT '09:00';
ALTER TABLE shops ADD COLUMN time_slot_end TIME DEFAULT '21:00';
ALTER TABLE shops ADD COLUMN min_hours_between INTEGER DEFAULT 4;
ALTER TABLE shops ADD COLUMN priority_bestsellers INTEGER DEFAULT 60;
ALTER TABLE shops ADD COLUMN priority_no_reviews INTEGER DEFAULT 25;
ALTER TABLE shops ADD COLUMN priority_stale INTEGER DEFAULT 15;
ALTER TABLE shops ADD COLUMN stale_days_threshold INTEGER DEFAULT 30;
ALTER TABLE shops ADD COLUMN auto_generate BOOLEAN DEFAULT false;
```

### reviews table additions:
```sql
ALTER TABLE reviews ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE reviews ADD COLUMN approved_by TEXT;
ALTER TABLE reviews ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE reviews ADD COLUMN rejection_reason TEXT;
```

---

## 5. UI Components Needed

1. **ReviewQueueCard** - Compact review card met approve/reject buttons
2. **ReviewQueueList** - Lijst met filtering en keyboard nav
3. **ShopSettingsForm** - Settings form met sliders
4. **PrioritySlider** - Custom slider component (3 sliders die samen 100% zijn)
5. **ScheduleCalendar** - Week view van geplande reviews (nice-to-have)

---

## 6. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reviews/queue` | Get pending reviews |
| POST | `/api/reviews/[id]/approve` | Approve review |
| POST | `/api/reviews/[id]/reject` | Reject review |
| GET | `/api/shops/[id]/settings` | Get shop settings |
| PUT | `/api/shops/[id]/settings` | Update shop settings |
| POST | `/api/shops/[id]/generate-batch` | Manual batch generate |
| GET | `/api/shops/[id]/schedule` | Get scheduled reviews |

---

## 7. Implementation Order

### Phase 1: Queue Dashboard (MVP)
- [ ] ReviewQueueCard component
- [ ] `/reviews/queue` page
- [ ] Approve/reject API endpoints
- [ ] Basic filtering (shop, status)

### Phase 2: Shop Settings
- [ ] Database migrations
- [ ] ShopSettingsForm component
- [ ] Priority sliders (met 100% constraint)
- [ ] Settings API endpoints

### Phase 3: Smart Selection
- [ ] Product selection algorithm
- [ ] Weighted random based on sliders
- [ ] Generate batch with smart selection

### Phase 4: Auto-Scheduling (nice-to-have)
- [ ] Cron job for auto-generation
- [ ] Schedule calendar view
- [ ] Posting to Lightspeed

---

## 8. Quick Wins voor Nu

1. **Queue page** - Simpele lijst van pending reviews met approve/reject
2. **Keyboard shortcuts** - Snelle workflow
3. **Bulk actions** - Meerdere tegelijk goedkeuren

De sliders en smart selection kunnen in fase 2.
