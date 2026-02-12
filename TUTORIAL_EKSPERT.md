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

## 2. Jak dodawać treści (Zasady Tagowania)

### A. Przepisy (Recipes)
Twoje serce bazy danych — Dieta:
1.  **Profiles (Programy)**: Zaznacz wszystkie programy, dla których ten przepis jest wskazany (np. "Opanuj Cukier" dla przepisów o niskim indeksie glikemicznym). **Dieta zależy tylko od Programu**, nie od fazy cyklu.
2.  **Meal Slot**: Wybierz, czy to śniadanie, obiad, czy przekąska.
3.  **Makroskładniki**: Wpisz wartości dla jednej porcji.

### A. Nawyki (Habits)
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

### D. Rytuał Pielęgnacyjny (Care Ritual)
Codzienne krótkie porady wyświetlane na dashboardzie:
1.  **Tip**: Krótka porada (np. o oczyszczaniu czy nawilżaniu).
2.  **Phases**: Wybierz fazy cyklu (Folikularna / Lutealna), dla których porada jest adekwatna. System będzie je losował codziennie w danej fazie.

### E. Trening (Training)
Sugestie aktywności fizycznej:
1.  **Title & Description**: Nazwa i krótki opis treningu.
2.  **Phases**: Kluczowe dla dopasowania intensywności do cyklu (np. joga w fazie menstruacyjnej, siłowy w owulacyjnej).
3.  **Intensity**: Low, Medium lub High.

### F. Cytat Motywacyjny (Motivation Quote)
Inspiracja na każdy dzień dla wszystkich:
1.  **Text**: Krótka, motywująca myśl.
2.  **Author**: Kto jest autorem (opcjonalnie).

---

## 3. Zależności w skrócie
Aby personalizacja działała poprawnie, trzymaj się tych zasad:
- **Program (Profil)** steruje: Dietą, Nawykami i Artykułami.
- **Faza Cyklu** steruje: Treningiem i Rytuałem pielęgnacyjnym (2 fazy: Folikularna i Lutealna).
- **Cytaty** zależą od fazy cyklu.

*Dawniej aplikacja używała logiki "Dual-Match", obecnie przeszliśmy na uproszczony model: Program (Core) / Faza (Wellness).*

---

## 5. Import Masowy (CSV / Excel)
Jeśli masz bardzo dużo danych do wprowadzenia, możesz skorzystać z funkcji importu:
1.  **Pobierz Szablony**: W folderze `/cms/TEMPLATES/` znajdziesz pliki `habits.csv`, `recipes.csv`, `articles.csv`, `skin-care.csv`, `training.csv` oraz `motivation-quotes.csv`.
2.  **Wypełnij Dane**: Otwórz je w Excelu lub Google Sheets, wpisz treści i zapisz z powrotem jako **CSV (Comma Separated Values)**.
3.  **Wgraj w Strapi**:
    - Przejdź do **Content Manager**.
    - Wybierz odpowiedni typ (np. Przepis).
    - Kliknij przycisk **Import/Export** (pojawi się na górze listy po lewej).
    - Wybierz plik i zmapuj pola (powinny zmatchować się automatycznie).

> [!WARNING]
> **Relacje (Profile)**: Przy imporcie masowym relacje do profili mogą wymagać ręcznego sprawdzenia w panelu Strapi, chyba że wpiszesz dokładne ID profilu w kolumnie `profiles`.

---

## 6. Praca w panelu Strapi
1.  Zaloguj się do panelu (Content Manager).
2.  Zawsze pracuj na **Draftach** — treść pojawi się w aplikacji dopiero po kliknięciu **Publish**.
3.  Zdjęcia: Staraj się wrzucać pliki o wysokiej jakości, ale zoptymalizowane pod mobile (format `.webp` lub `.jpg`).
