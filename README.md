# OH! Club — CMS (Strapi)

Panel zarządzania treścią dla aplikacji mobilnej OH! Club. Zbudowany na [Strapi v4](https://strapi.io).

---

## Uruchomienie

```bash
# Instalacja zależności
npm install

# Tryb deweloperski (z autoReload)
npm run develop

# Build produkcyjny
npm run build && npm run start
```

Panel będzie dostępny pod `http://localhost:1337/admin`.

---

## Typy Treści (Content Types)

| Typ | DisplayName | Opis |
| :--- | :--- | :--- |
| **profile** | Profil | 4 programy zdrowotne (Opanuj Cukier / Skórę / Stres / Glow-up) |
| **recipe** | Przepis | Przepisy kulinarne z makro, składnikami i tagowaniem per profil |
| **habit** | Nawyk | Nawyki (fundament / program / faza / dodatkowe) |
| **article** | Artykuł | Baza wiedzy — artykuły tagowane per profil |
| **symptom** | Objaw | Objawy codzienne (nastrój / ciało / energia / trawienie) |
| **skin-care** | Rytuał pielęgnacyjny | Porady pielęgnacyjne per faza cyklu (folikularna / lutealna) |
| **training** | Trening | Plany treningowe z intensywnością per faza cyklu |
| **motivation-quote** | Cytat motywacyjny | Cytaty wyświetlane na dashboardzie |
| **instruction** | Instrukcja dla Eksperta | Instrukcja obsługi CMS (singleType) |

### Komponenty (Shared)

| Komponent | Pola |
| :--- | :--- |
| **shared.macros** | protein, carbs, fat |
| **shared.ingredient** | name, amount, unit |

---

## Model Faz Cyklu

Aplikacja używa uproszczonego modelu **2 faz**:
- **Folikularna** (follicular) — od menstruacji do owulacji
- **Lutealna** (luteal) — od owulacji do menstruacji

> [!IMPORTANT]
> Wszystkie content types używające faz (training, skin-care, motivation-quote, habit) muszą korzystać wyłącznie z tych 2 wartości.

---

## Zależności Personalizacji

```
Program (Profil) → Dieta, Nawyki, Artykuły
Faza Cyklu        → Trening, Rytuał pielęgnacyjny, Cytaty
Objawy            → Niezależne od profilu/fazy (codzienne śledzenie)
```

---

## Dokumentacja

- [TUTORIAL_EKSPERT.md](./TUTORIAL_EKSPERT.md) — Samouczek dla ekspertów dodających treści
- [TEMPLATES/](./TEMPLATES/) — Szablony CSV do importu masowego

---

## Deployment

```bash
yarn strapi deploy
```

Więcej opcji: [Strapi Deployment Docs](https://docs.strapi.io/dev-docs/deployment)
