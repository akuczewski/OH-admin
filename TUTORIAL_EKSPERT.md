# OH! Club — Samouczek dla Ekspertów (CMS)

Witaj! Ten dokument pomoże Ci zrozumieć, jak wprowadzać dane do systemu, aby algorytm personalizacji w aplikacji mobilnej działał poprawnie i dostarczał użytkowniczkom dopasowane treści.

---

## 1. Programy i Profile (MVP)
Na start (MVP) skupiamy się na 4 głównych programach:
1.  **Opanuj Cukier** — Stabilizacja glukozy i insuliny.
2.  **Opanuj Skórę** — Cera trądzikowa i stany zapalne.
3.  **Opanuj Stres** — Relaksacja i obniżanie kortyzolu.
4.  **Glow-up** — Optymalizacja hormonalna i uroda.

---

## 2. Fazy Cyklu
Aplikacja używa uproszczonego modelu **2 faz**:
- **Folikularna** (follicular) — rozpoczyna się od menstruacji. W tej fazie dojrzewa pęcherzyk jajnikowy i rośnie poziom estrogenów. Użytkowniczka zazwyczaj ma więcej energii i jest w lepszym nastroju.
- **Lutealna** (luteal) — rozpoczyna się po owulacji. Dominuje progesteron, organizm przygotowuje się na ewentualną ciążę. Mogą nasilać się objawy PMS.

> [!IMPORTANT]
> Przy dodawaniu treści powiązanych z fazami (treningi, rytuały, cytaty), zawsze wybieraj jedną z powyższych faz.

---

## 3. Jak dodawać treści (Zasady Tagowania)

### A. Przepisy (Recipes)
Twoje serce bazy danych — Dieta:
1.  **Profiles (Programy)**: Zaznacz wszystkie programy, dla których ten przepis jest wskazany (np. "Opanuj Cukier" dla przepisów o niskim indeksie glikemicznym). **Dieta zależy tylko od Programu**, nie od fazy cyklu.
2.  **Meal Slot**: Wybierz, czy to śniadanie, obiad, czy przekąska.
3.  **Makroskładniki**: Wpisz wartości dla jednej porcji.
4.  **Składniki**: Dodaj listę składników z ilością i jednostką (używane do generowania listy zakupów).

### B. Nawyki (Habits)
Nawyki budują rutynę użytkowniczki i są podzielone na 4 grupy:
1.  **Fundamenty (foundation)**: Codzienne nawyki, niezależne od fazy cyklu. Są podstawą dbania o siebie.
2.  **Program (program)**: Nawyki wynikające z wybranego programu (np. "Opanuj Cukier"). Zależą od **Profilu**.
3.  **Wsparcie fazy (phase)**: Nawyki specyficzne dla aktualnej fazy cyklu. Zależą od **Fazy**.
4.  **Dodatkowe (additional)**: Baza opcjonalnych nawyków, które użytkowniczka może sama dodać do swojego planu dnia.

**Pola w panelu:**
- **Type**: Wybierz jedną z powyższych grup.
- **Profiles**: Wypełnij dla typu `program`.
- **Phases**: Wypełnij dla typu `phase`.
- **Priority**: Ustal kolejność (1 = najwyższy priorytet).

### C. Artykuły (Knowledge Base)
Artykuły budują autorytet ekspertów:
1.  **Profiles**: Artykuł pokaże się tylko użytkowniczkom oznaczonym tymi profilami. **Artykuły zależą tylko od Programu**.
2.  **Tag**: Kategoria artykułu (np. DIETA, BEAUTY, ZDROWIE, WELLNESS, SUPLEMENTY).
3.  **Author**: Autor artykułu (wyświetlany w aplikacji).

### D. Objawy (Symptoms) ✨ NOWE
Objawy pozwalają użytkowniczkom codziennie śledzić swoje samopoczucie:
1.  **Name**: Nazwa objawu wyświetlana w aplikacji (np. "Wzdęcia", "Zmęczenie").
2.  **Category**: Kategoria objawu — `mood` (nastrój), `body` (ciało), `energy` (energia), `digestion` (trawienie).
3.  **Icon**: Emoji lub nazwa ikony (opcjonalnie).
4.  **Priority**: Kolejność wyświetlania w danej kategorii.

> [!NOTE]
> Objawy są **niezależne od profilu i fazy cyklu** — każda użytkowniczka widzi pełną listę w zakładce "Dodaj Objawy". Historia jest zapisywana lokalnie na urządzeniu.

### E. Rytuał Pielęgnacyjny (Care Ritual)
Porady pielęgnacyjne dopasowane do fazy cyklu:
1.  **Name**: Nazwa rytuału (np. "Nawilżanie intensywne", "Oczyszczanie głębokie").
2.  **Description**: Szczegółowy opis rytuału — jakie kroki wykonać, jakie produkty zastosować.
3.  **Phases**: Wybierz fazy cyklu (Folikularna / Lutealna), dla których rytuał jest adekwatny.
4.  **Image**: Zdjęcie ilustrujące rytuał (format `.webp` lub `.jpg`, zoptymalizowane pod mobile).

### F. Trening (Training)
Sugestie aktywności fizycznej:
1.  **Title & Description**: Nazwa i krótki opis treningu.
2.  **Phases**: Kluczowe dla dopasowania intensywności do cyklu.
3.  **Intensity**: Low, Medium lub High.

### G. Cytat Motywacyjny (Motivation Quote)
Inspiracja na każdy dzień:
1.  **Text**: Krótka, motywująca myśl.
2.  **Author**: Kto jest autorem (opcjonalnie).
3.  **assignedPhase**: Faza cyklu, w której cytat będzie wyświetlany.

---

## 4. Zależności w skrócie

| Co steruje | Czym |
| :--- | :--- |
| **Program (Profil)** | Dietą, Nawykami programowymi, Artykułami |
| **Faza Cyklu** | Treningiem, Rytuałem pielęgnacyjnym, Cytatami, Nawykami fazowymi |
| **Niezależne** | Objawy, Nawyki fundamentowe, Nawyki dodatkowe |

---

## 5. Import Masowy (CSV / Excel)
Jeśli masz bardzo dużo danych do wprowadzenia, możesz skorzystać z funkcji importu:
1.  **Pobierz Szablony**: W folderze `/cms/TEMPLATES/` znajdziesz szablony CSV.
2.  **Wypełnij Dane**: Otwórz je w Excelu lub Google Sheets, wpisz treści i zapisz jako **CSV**.
3.  **Wgraj w Strapi**: Content Manager → wybierz typ → Import/Export.

> [!WARNING]
> **Relacje (Profile)**: Przy imporcie masowym relacje do profili mogą wymagać ręcznego sprawdzenia w panelu Strapi.

---

## 6. Praca w panelu Strapi
1.  Zaloguj się do panelu (Content Manager).
2.  Zawsze pracuj na **Draftach** — treść pojawi się w aplikacji dopiero po kliknięciu **Publish**.
3.  Zdjęcia: Staraj się wrzucać pliki o wysokiej jakości, ale zoptymalizowane pod mobile (format `.webp` lub `.jpg`).
