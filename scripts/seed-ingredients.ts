
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from cms/.env BEFORE other imports
dotenv.config({ path: path.join(__dirname, '../.env') });

import { db } from '../src/lib/firebase';

interface BaseIngredient {
    name: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    category: string;
    unitType: 'weight' | 'volume' | 'piece';
    averagePieceWeight?: number; // in grams or ml
}

const ingredients: BaseIngredient[] = [
    // --- WARZYWA ---
    { name: 'Awokado', kcal: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, category: 'warzywa', unitType: 'piece', averagePieceWeight: 140 },
    { name: 'Pomidor', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, category: 'warzywa', unitType: 'piece', averagePieceWeight: 150 },
    { name: 'Ogórek', kcal: 15, protein: 0.6, carbs: 3.6, fat: 0.1, fiber: 0.5, category: 'warzywa', unitType: 'piece', averagePieceWeight: 180 },
    { name: 'Papryka czerwona', kcal: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1, category: 'warzywa', unitType: 'piece', averagePieceWeight: 200 },
    { name: 'Papryka żółta', kcal: 27, protein: 1, carbs: 6.3, fat: 0.2, fiber: 0.9, category: 'warzywa', unitType: 'piece', averagePieceWeight: 200 },
    { name: 'Papryka zielona', kcal: 20, protein: 0.9, carbs: 4.6, fat: 0.2, fiber: 1.7, category: 'warzywa', unitType: 'piece', averagePieceWeight: 200 },
    { name: 'Szpinak świeży', kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, category: 'warzywa', unitType: 'weight' },
    { name: 'Brokuł', kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, category: 'warzywa', unitType: 'piece', averagePieceWeight: 500 },
    { name: 'Kalafior', kcal: 25, protein: 1.9, carbs: 5, fat: 0.3, fiber: 2, category: 'warzywa', unitType: 'piece', averagePieceWeight: 600 },
    { name: 'Dynia', kcal: 26, protein: 1, carbs: 6.5, fat: 0.1, fiber: 0.5, category: 'warzywa', unitType: 'weight' },
    { name: 'Cukinia', kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1, category: 'warzywa', unitType: 'piece', averagePieceWeight: 300 },
    { name: 'Cebula', kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, category: 'warzywa', unitType: 'piece', averagePieceWeight: 100 },
    { name: 'Cebula czerwona', kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, category: 'warzywa', unitType: 'piece', averagePieceWeight: 100 },
    { name: 'Czosnek', kcal: 149, protein: 6.4, carbs: 33, fat: 0.5, fiber: 2.1, category: 'warzywa', unitType: 'piece', averagePieceWeight: 5 },
    { name: 'Marchew', kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, category: 'warzywa', unitType: 'piece', averagePieceWeight: 80 },
    { name: 'Ziemniak', kcal: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2, category: 'warzywa', unitType: 'piece', averagePieceWeight: 150 },
    { name: 'Batat', kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, category: 'warzywa', unitType: 'piece', averagePieceWeight: 200 },
    { name: 'Rzodkiewka', kcal: 16, protein: 0.7, carbs: 3.4, fat: 0.1, fiber: 1.6, category: 'warzywa', unitType: 'piece', averagePieceWeight: 15 },
    { name: 'Sałata lodowa', kcal: 14, protein: 0.9, carbs: 3, fat: 0.1, fiber: 1.2, category: 'warzywa', unitType: 'weight' },
    { name: 'Sałata masłowa', kcal: 13, protein: 1.4, carbs: 2.2, fat: 0.2, fiber: 1.1, category: 'warzywa', unitType: 'piece', averagePieceWeight: 200 },
    { name: 'Rukola', kcal: 25, protein: 2.6, carbs: 3.7, fat: 0.7, fiber: 1.6, category: 'warzywa', unitType: 'weight' },
    { name: 'Roszponka', kcal: 21, protein: 2, carbs: 3.6, fat: 0.4, fiber: 1.5, category: 'warzywa', unitType: 'weight' },
    { name: 'Jarmuż', kcal: 49, protein: 4.3, carbs: 8.8, fat: 0.9, fiber: 3.6, category: 'warzywa', unitType: 'weight' },
    { name: 'Szparagi', kcal: 20, protein: 2.2, carbs: 3.9, fat: 0.1, fiber: 2.1, category: 'warzywa', unitType: 'weight' },
    { name: 'Bakłażan', kcal: 25, protein: 1, carbs: 5.9, fat: 0.2, fiber: 3, category: 'warzywa', unitType: 'piece', averagePieceWeight: 350 },
    { name: 'Pieczarki', kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1, category: 'warzywa', unitType: 'weight' },
    { name: 'Fasolka szparagowa', kcal: 31, protein: 1.8, carbs: 7, fat: 0.1, fiber: 3.4, category: 'warzywa', unitType: 'weight' },
    { name: 'Groszek zielony', kcal: 81, protein: 5.4, carbs: 14.5, fat: 0.4, fiber: 5.1, category: 'warzywa', unitType: 'weight' },
    { name: 'Kukurydza (konserwowa)', kcal: 96, protein: 3.3, carbs: 21, fat: 1.5, fiber: 2.4, category: 'warzywa', unitType: 'weight' },
    { name: 'Seler korzeń', kcal: 42, protein: 1.5, carbs: 9.2, fat: 0.3, fiber: 1.8, category: 'warzywa', unitType: 'weight' },
    { name: 'Seler naciowy', kcal: 16, protein: 0.7, carbs: 3, fat: 0.2, fiber: 1.6, category: 'warzywa', unitType: 'piece', averagePieceWeight: 40 },
    { name: 'Pietruszka korzeń', kcal: 36, protein: 2.6, carbs: 8, fat: 0.5, fiber: 4.9, category: 'warzywa', unitType: 'weight' },
    { name: 'Pietruszka natka', kcal: 36, protein: 3, carbs: 6, fat: 0.8, fiber: 3.3, category: 'warzywa', unitType: 'weight' },
    { name: 'Koper świeży', kcal: 43, protein: 3.5, carbs: 7, fat: 1.1, fiber: 2.1, category: 'warzywa', unitType: 'weight' },
    { name: 'Szczypiorek', kcal: 30, protein: 3.3, carbs: 4.4, fat: 0.7, fiber: 2.5, category: 'warzywa', unitType: 'weight' },
    { name: 'Bób', kcal: 88, protein: 8, carbs: 18, fat: 0.7, fiber: 7.5, category: 'warzywa', unitType: 'weight' },
    { name: 'Kapusta biała', kcal: 25, protein: 1.3, carbs: 5.8, fat: 0.1, fiber: 2.5, category: 'warzywa', unitType: 'weight' },
    { name: 'Kapusta czerwona', kcal: 31, protein: 1.4, carbs: 7.4, fat: 0.2, fiber: 2.1, category: 'warzywa', unitType: 'weight' },
    { name: 'Kapusta pekińska', kcal: 13, protein: 1.5, carbs: 2.2, fat: 0.2, fiber: 1, category: 'warzywa', unitType: 'weight' },
    { name: 'Brukselka', kcal: 43, protein: 3.4, carbs: 9, fat: 0.3, fiber: 3.8, category: 'warzywa', unitType: 'weight' },
    { name: 'Karczoch', kcal: 47, protein: 3.3, carbs: 10.5, fat: 0.2, fiber: 5.4, category: 'warzywa', unitType: 'piece', averagePieceWeight: 120 },
    { name: 'Fenkuł (koper włoski)', kcal: 31, protein: 1.2, carbs: 7.3, fat: 0.2, fiber: 3.1, category: 'warzywa', unitType: 'piece', averagePieceWeight: 250 },
    { name: 'Rzepa', kcal: 28, protein: 0.9, carbs: 6.4, fat: 0.1, fiber: 1.8, category: 'warzywa', unitType: 'weight' },
    { name: 'Burak', kcal: 43, protein: 1.6, carbs: 9.6, fat: 0.2, fiber: 2.8, category: 'warzywa', unitType: 'piece', averagePieceWeight: 120 },
    { name: 'Kalarepa', kcal: 27, protein: 1.7, carbs: 6.2, fat: 0.1, fiber: 3.6, category: 'warzywa', unitType: 'piece', averagePieceWeight: 150 },
    { name: 'Rzodkiew czarna', kcal: 32, protein: 1, carbs: 7.5, fat: 0.2, fiber: 1.6, category: 'warzywa', unitType: 'weight' },
    { name: 'Topinambur', kcal: 73, protein: 2, carbs: 17, fat: 0.1, fiber: 1.6, category: 'warzywa', unitType: 'weight' },
    { name: 'Pasternak', kcal: 75, protein: 1.2, carbs: 18, fat: 0.3, fiber: 4.9, category: 'warzywa', unitType: 'weight' },
    { name: 'Cykoria', kcal: 17, protein: 1.2, carbs: 4, fat: 0.1, fiber: 3.1, category: 'warzywa', unitType: 'piece', averagePieceWeight: 150 },
    { name: 'Rabarbar', kcal: 21, protein: 0.9, carbs: 4.5, fat: 0.2, fiber: 1.8, category: 'warzywa', unitType: 'weight' },
    { name: 'Lubczyk świeży', kcal: 35, protein: 2.5, carbs: 6, fat: 0.5, fiber: 2, category: 'przyprawy', unitType: 'weight' },
    { name: 'Czosnek niedźwiedzi', kcal: 19, protein: 2.1, carbs: 3.4, fat: 0.7, fiber: 2.2, category: 'warzywa', unitType: 'weight' },

    // --- OWOCE ---
    { name: 'Jabłko', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, category: 'owoce', unitType: 'piece', averagePieceWeight: 180 },
    { name: 'Banan', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, category: 'owoce', unitType: 'piece', averagePieceWeight: 120 },
    { name: 'Gruszka', kcal: 57, protein: 0.4, carbs: 15, fat: 0.1, fiber: 3.1, category: 'owoce', unitType: 'piece', averagePieceWeight: 160 },
    { name: 'Truskawki', kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2, category: 'owoce', unitType: 'weight' },
    { name: 'Borówki', kcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3, fiber: 2.4, category: 'owoce', unitType: 'weight' },
    { name: 'Maliny', kcal: 52, protein: 1.2, carbs: 12, fat: 0.7, fiber: 6.5, category: 'owoce', unitType: 'weight' },
    { name: 'Jeżyny', kcal: 43, protein: 1.4, carbs: 10, fat: 0.5, fiber: 5.3, category: 'owoce', unitType: 'weight' },
    { name: 'Cytryna', kcal: 29, protein: 1.1, carbs: 9, fat: 0.3, fiber: 2.8, category: 'owoce', unitType: 'piece', averagePieceWeight: 100 },
    { name: 'Pomarańcza', kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, category: 'owoce', unitType: 'piece', averagePieceWeight: 200 },
    { name: 'Grejpfrut', kcal: 42, protein: 0.8, carbs: 11, fat: 0.1, fiber: 1.6, category: 'owoce', unitType: 'piece', averagePieceWeight: 250 },
    { name: 'Mandarynka', kcal: 53, protein: 0.8, carbs: 13, fat: 0.3, fiber: 1.8, category: 'owoce', unitType: 'piece', averagePieceWeight: 60 },
    { name: 'Kiwi', kcal: 61, protein: 1.1, carbs: 15, fat: 0.5, fiber: 3, category: 'owoce', unitType: 'piece', averagePieceWeight: 70 },
    { name: 'Mango', kcal: 60, protein: 0.8, carbs: 15, fat: 0.4, fiber: 1.6, category: 'owoce', unitType: 'piece', averagePieceWeight: 300 },
    { name: 'Ananas', kcal: 50, protein: 0.5, carbs: 13, fat: 0.1, fiber: 1.4, category: 'owoce', unitType: 'weight' },
    { name: 'Arbuz', kcal: 30, protein: 0.6, carbs: 7.6, fat: 0.2, fiber: 0.4, category: 'owoce', unitType: 'weight' },
    { name: 'Melon', kcal: 34, protein: 0.8, carbs: 8, fat: 0.2, fiber: 0.9, category: 'owoce', unitType: 'weight' },
    { name: 'Winogrona', kcal: 69, protein: 0.7, carbs: 18, fat: 0.2, fiber: 0.9, category: 'owoce', unitType: 'weight' },
    { name: 'Brzoskwinia', kcal: 39, protein: 0.9, carbs: 10, fat: 0.3, fiber: 1.5, category: 'owoce', unitType: 'piece', averagePieceWeight: 150 },
    { name: 'Morela', kcal: 48, protein: 1.4, carbs: 11, fat: 0.4, fiber: 2, category: 'owoce', unitType: 'piece', averagePieceWeight: 50 },
    { name: 'Śliwka', kcal: 46, protein: 0.7, carbs: 11, fat: 0.3, fiber: 1.4, category: 'owoce', unitType: 'piece', averagePieceWeight: 30 },
    { name: 'Wiśnia', kcal: 50, protein: 1, carbs: 12, fat: 0.3, fiber: 1.6, category: 'owoce', unitType: 'weight' },
    { name: 'Czereśnia', kcal: 63, protein: 1.1, carbs: 16, fat: 0.2, fiber: 2.1, category: 'owoce', unitType: 'weight' },
    { name: 'Granat', kcal: 83, protein: 1.7, carbs: 19, fat: 1.2, fiber: 4, category: 'owoce', unitType: 'piece', averagePieceWeight: 200 },
    { name: 'Figa świeża', kcal: 74, protein: 0.8, carbs: 19, fat: 0.3, fiber: 2.9, category: 'owoce', unitType: 'piece', averagePieceWeight: 50 },
    { name: 'Daktyle suszone', kcal: 282, protein: 2.5, carbs: 75, fat: 0.4, fiber: 8, category: 'owoce', unitType: 'piece', averagePieceWeight: 10 },
    { name: 'Rodzynki', kcal: 299, protein: 3, carbs: 79, fat: 0.5, fiber: 3.7, category: 'owoce', unitType: 'weight' },
    { name: 'Żurawina suszona', kcal: 308, protein: 0.1, carbs: 82, fat: 1.4, fiber: 6, category: 'owoce', unitType: 'weight' },
    { name: 'Morele suszone', kcal: 241, protein: 3.4, carbs: 62, fat: 0.5, fiber: 7.3, category: 'owoce', unitType: 'weight' },
    { name: 'Śliwki suszone', kcal: 240, protein: 2.2, carbs: 64, fat: 0.4, fiber: 7.1, category: 'owoce', unitType: 'weight' },

    // --- BIAŁKO (MIĘSO, RYBY, JAJA) ---
    { name: 'Pierś z kurczaka', kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Pierś z indyka', kcal: 135, protein: 30, carbs: 0, fat: 0.7, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Mięso mielone z indyka', kcal: 140, protein: 19, carbs: 0, fat: 7, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Mięso mielone wołowe chude', kcal: 150, protein: 20, carbs: 0, fat: 7, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Polędwica wołowa', kcal: 150, protein: 20, carbs: 0, fat: 8, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Polędwiczka wieprzowa', kcal: 120, protein: 21, carbs: 0, fat: 4, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Szynka pieczona', kcal: 145, protein: 21, carbs: 0, fat: 6, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Boczek wędzony', kcal: 450, protein: 12, carbs: 0.6, fat: 45, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Udo z kurczaka bez skóry', kcal: 120, protein: 20, carbs: 0, fat: 4, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Podudzie z kurczaka', kcal: 160, protein: 18, carbs: 0, fat: 9, fiber: 0, category: 'mięso', unitType: 'piece', averagePieceWeight: 100 },
    { name: 'Wątróbka drobiowa', kcal: 120, protein: 19, carbs: 0.7, fat: 4.8, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Wątróbka cielęca', kcal: 140, protein: 20, carbs: 4, fat: 5, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Kaczka pierś', kcal: 200, protein: 19, carbs: 0, fat: 14, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Dziczyzna (sarnina)', kcal: 110, protein: 22, carbs: 0, fat: 2, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Królik mięso', kcal: 115, protein: 22, carbs: 0, fat: 3, fiber: 0, category: 'mięso', unitType: 'weight' },
    { name: 'Łosoś świeży', kcal: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Dorsz świeży', kcal: 82, protein: 18, carbs: 0, fat: 0.7, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Pstrąg tęczowy', kcal: 120, protein: 20, carbs: 0, fat: 4, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Tuńczyk w wodzie (puszka)', kcal: 116, protein: 26, carbs: 0, fat: 0.8, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Tuńczyk stek świeży', kcal: 130, protein: 28, carbs: 0, fat: 1, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Makrela wędzona', kcal: 305, protein: 19, carbs: 0, fat: 25, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Śledź w oleju', kcal: 300, protein: 14, carbs: 0, fat: 27, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Halibut świeży', kcal: 110, protein: 21, carbs: 0, fat: 2.5, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Sandacz świeży', kcal: 85, protein: 19, carbs: 0, fat: 0.9, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Małże gotowane', kcal: 170, protein: 24, carbs: 7, fat: 4.5, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Kalmary krążki', kcal: 90, protein: 16, carbs: 3, fat: 1.5, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Ośmiornica gotowana', kcal: 160, protein: 30, carbs: 4, fat: 2, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Krewetki gotowane', kcal: 99, protein: 24, carbs: 0, fat: 0.3, fiber: 0, category: 'ryby', unitType: 'weight' },
    { name: 'Jajko kurze m rozmiar', kcal: 143, protein: 13, carbs: 0.7, fat: 9.5, fiber: 0, category: 'jaja', unitType: 'piece', averagePieceWeight: 50 },
    { name: 'Białko jaja kurzego', kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0, category: 'jaja', unitType: 'weight' },
    { name: 'Żółtko jaja kurzego', kcal: 322, protein: 16, carbs: 3.6, fat: 27, fiber: 0, category: 'jaja', unitType: 'weight' },

    // --- NABIAŁ I ZAMIENNIKI ---
    { name: 'Jogurt naturalny', kcal: 60, protein: 3.5, carbs: 4.7, fat: 3, fiber: 0, category: 'nabiał', unitType: 'weight' },
    { name: 'Jogurt grecki', kcal: 115, protein: 9, carbs: 4, fat: 7, fiber: 0, category: 'nabiał', unitType: 'weight' },
    { name: 'Skyr naturalny', kcal: 66, protein: 12, carbs: 4, fat: 0.2, fiber: 0, category: 'nabiał', unitType: 'weight' },
    { name: 'Kefir', kcal: 43, protein: 3.4, carbs: 4.8, fat: 1.5, fiber: 0, category: 'nabiał', unitType: 'weight' },
    { name: 'Twaróg chudy', kcal: 85, protein: 18, carbs: 3.5, fat: 0.5, fiber: 0, category: 'nabiał', unitType: 'weight' },
    { name: 'Twaróg półtłusty', kcal: 115, protein: 16, carbs: 3.7, fat: 4, fiber: 0, category: 'nabiał', unitType: 'weight' },
    { name: 'Serek wiejski', kcal: 98, protein: 11, carbs: 2, fat: 5, fiber: 0, category: 'nabiał', unitType: 'weight' },
    { name: 'Mleko 2%', kcal: 50, protein: 3.3, carbs: 4.8, fat: 2, fiber: 0, category: 'nabiał', unitType: 'volume' },
    { name: 'Mleko owsiane', kcal: 45, protein: 0.5, carbs: 7, fat: 1.5, fiber: 0.8, category: 'nabiał', unitType: 'volume' },
    { name: 'Mleko migdałowe (niesłodzone)', kcal: 15, protein: 0.5, carbs: 0.1, fat: 1.2, fiber: 0.3, category: 'nabiał', unitType: 'volume' },
    { name: 'Mleczko kokosowe (puszka)', kcal: 197, protein: 2, carbs: 2.8, fat: 21, fiber: 0, category: 'nabiał', unitType: 'volume' },
    { name: 'Ser mozzarella', kcal: 300, protein: 22, carbs: 2.2, fat: 22, fiber: 0, category: 'nabiał', unitType: 'weight' },
    { name: 'Ser feta', kcal: 264, protein: 14, carbs: 4, fat: 21, fiber: 0, category: 'nabiał', unitType: 'weight' },
    { name: 'Ser parmezan', kcal: 431, protein: 38, carbs: 4, fat: 29, fiber: 0, category: 'nabiał', unitType: 'weight' },
    { name: 'Tofu twarde', kcal: 144, protein: 16, carbs: 3, fat: 8, fiber: 2.3, category: 'białko roślinne', unitType: 'weight' },
    { name: 'Tempeh', kcal: 192, protein: 19, carbs: 9, fat: 11, fiber: 0, category: 'białko roślinne', unitType: 'weight' },

    // --- ZIARNA, MĄKI, STRĄCZKI ---
    { name: 'Ryż biały', kcal: 360, protein: 7, carbs: 79, fat: 0.6, fiber: 1.3, category: 'ziarna', unitType: 'weight' },
    { name: 'Ryż basmati', kcal: 350, protein: 8, carbs: 77, fat: 1, fiber: 1, category: 'ziarna', unitType: 'weight' },
    { name: 'Ryż brązowy', kcal: 350, protein: 7.5, carbs: 72, fat: 2.7, fiber: 3.4, category: 'ziarna', unitType: 'weight' },
    { name: 'Kasza jaglana', kcal: 350, protein: 11, carbs: 70, fat: 3.3, fiber: 3.2, category: 'ziarna', unitType: 'weight' },
    { name: 'Kasza gryczana niepalona', kcal: 345, protein: 13, carbs: 70, fat: 3, fiber: 10, category: 'ziarna', unitType: 'weight' },
    { name: 'Kasza bulgur', kcal: 340, protein: 12, carbs: 76, fat: 1.3, fiber: 12, category: 'ziarna', unitType: 'weight' },
    { name: 'Kasza pęczak', kcal: 350, protein: 9, carbs: 75, fat: 2, fiber: 15, category: 'ziarna', unitType: 'weight' },
    { name: 'Kasza kuskus', kcal: 360, protein: 12, carbs: 72, fat: 1, fiber: 5, category: 'ziarna', unitType: 'weight' },
    { name: 'Komosa ryżowa (quinoa)', kcal: 370, protein: 14, carbs: 64, fat: 6, fiber: 7, category: 'ziarna', unitType: 'weight' },
    { name: 'Płatki owsiane górskie', kcal: 366, protein: 13.5, carbs: 60, fat: 7, fiber: 10, category: 'ziarna', unitType: 'weight' },
    { name: 'Płatki jaglane', kcal: 360, protein: 10, carbs: 70, fat: 3.5, fiber: 3, category: 'ziarna', unitType: 'weight' },
    { name: 'Płatki ryżowe', kcal: 350, protein: 7, carbs: 78, fat: 0.5, fiber: 2, category: 'ziarna', unitType: 'weight' },
    { name: 'Makaron pełnoziarnisty', kcal: 350, protein: 13, carbs: 65, fat: 2.5, fiber: 9, category: 'ziarna', unitType: 'weight' },
    { name: 'Makaron z ciecierzycy', kcal: 340, protein: 20, carbs: 48, fat: 5, fiber: 13, category: 'ziarna', unitType: 'weight' },
    { name: 'Soczewica czerwona (sucha)', kcal: 340, protein: 24, carbs: 50, fat: 1, fiber: 12, category: 'strączki', unitType: 'weight' },
    { name: 'Soczewica zielona (sucha)', kcal: 340, protein: 24, carbs: 48, fat: 1, fiber: 15, category: 'strączki', unitType: 'weight' },
    { name: 'Ciecierzyca (sucha)', kcal: 360, protein: 19, carbs: 50, fat: 6, fiber: 15, category: 'strączki', unitType: 'weight' },
    { name: 'Ciecierzyca (konserwowa)', kcal: 120, protein: 7, carbs: 18, fat: 2, fiber: 6, category: 'strączki', unitType: 'weight' },
    { name: 'Fasola biała (sucha)', kcal: 330, protein: 21, carbs: 45, fat: 1, fiber: 15, category: 'strączki', unitType: 'weight' },
    { name: 'Fasola czerwona (konserwowa)', kcal: 100, protein: 8, carbs: 13, fat: 0.5, fiber: 7, category: 'strączki', unitType: 'weight' },
    { name: 'Fasola mung (gotowana)', kcal: 105, protein: 7, carbs: 19, fat: 0.4, fiber: 7.6, category: 'strączki', unitType: 'weight' },
    { name: 'Edamame (młoda soja)', kcal: 120, protein: 11, carbs: 9, fat: 5, fiber: 5, category: 'strączki', unitType: 'weight' },
    { name: 'Amarantus nasiona', kcal: 370, protein: 14, carbs: 65, fat: 7, fiber: 7, category: 'ziarna', unitType: 'weight' },
    { name: 'Mąka pszenna typ 500', kcal: 340, protein: 10, carbs: 74, fat: 1, fiber: 2.5, category: 'mąki', unitType: 'weight' },
    { name: 'Mąka owsiana', kcal: 380, protein: 13, carbs: 65, fat: 6.5, fiber: 7, category: 'mąki', unitType: 'weight' },
    { name: 'Mąka migdałowa', kcal: 600, protein: 21, carbs: 10, fat: 53, fiber: 10, category: 'mąki', unitType: 'weight' },
    { name: 'Mąka kokosowa', kcal: 330, protein: 19, carbs: 20, fat: 12, fiber: 38, category: 'mąki', unitType: 'weight' },
    { name: 'Mąka orkiszowa jasna', kcal: 340, protein: 12, carbs: 68, fat: 1.5, fiber: 3, category: 'mąki', unitType: 'weight' },
    { name: 'Mąka orkiszowa razowa', kcal: 330, protein: 14, carbs: 63, fat: 2.5, fiber: 10, category: 'mąki', unitType: 'weight' },
    { name: 'Mąka gryczana', kcal: 350, protein: 13, carbs: 70, fat: 3, fiber: 10, category: 'mąki', unitType: 'weight' },
    { name: 'Mąka z ciecierzycy', kcal: 360, protein: 19, carbs: 50, fat: 6, fiber: 10, category: 'mąki', unitType: 'weight' },

    // --- ORZECHY I NASIONA ---
    { name: 'Orzechy włoskie', kcal: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7, category: 'orzechy', unitType: 'weight' },
    { name: 'Orzechy laskowe', kcal: 628, protein: 15, carbs: 17, fat: 61, fiber: 9.7, category: 'orzechy', unitType: 'weight' },
    { name: 'Migdały', kcal: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5, category: 'orzechy', unitType: 'weight' },
    { name: 'Orzechy nerkowca', kcal: 553, protein: 18, carbs: 30, fat: 44, fiber: 3.3, category: 'orzechy', unitType: 'weight' },
    { name: 'Orzeszki ziemne', kcal: 567, protein: 26, carbs: 16, fat: 49, fiber: 8.5, category: 'orzechy', unitType: 'weight' },
    { name: 'Pestki dyni', kcal: 559, protein: 30, carbs: 11, fat: 49, fiber: 6, category: 'nasiona', unitType: 'weight' },
    { name: 'Słonecznik łuskany', kcal: 584, protein: 21, carbs: 20, fat: 51, fiber: 8.6, category: 'nasiona', unitType: 'weight' },
    { name: 'Nasiona chia', kcal: 486, protein: 17, carbs: 42, fat: 31, fiber: 34, category: 'nasiona', unitType: 'weight' },
    { name: 'Siemię lniane', kcal: 534, protein: 18, carbs: 29, fat: 42, fiber: 27, category: 'nasiona', unitType: 'weight' },
    { name: 'Sezam', kcal: 573, protein: 18, carbs: 23, fat: 50, fiber: 11.8, category: 'nasiona', unitType: 'weight' },
    { name: 'Masło orzechowe (100% orzechów)', kcal: 600, protein: 25, carbs: 14, fat: 50, fiber: 6, category: 'tłuszcze', unitType: 'weight' },
    { name: 'Tahini', kcal: 595, protein: 17, carbs: 21, fat: 54, fiber: 9, category: 'tłuszcze', unitType: 'weight' },

    // --- TŁUSZCZE I OLEJE ---
    { name: 'Oliwa z oliwek', kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, category: 'tłuszcze', unitType: 'volume' },
    { name: 'Olej rzepakowy', kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, category: 'tłuszcze', unitType: 'volume' },
    { name: 'Olej kokosowy', kcal: 862, protein: 0, carbs: 0, fat: 99, fiber: 0, category: 'tłuszcze', unitType: 'volume' },
    { name: 'Olej lniany', kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, category: 'tłuszcze', unitType: 'volume' },
    { name: 'Olej z wiesiołka', kcal: 900, protein: 0, carbs: 0, fat: 100, fiber: 0, category: 'tłuszcze', unitType: 'volume' },
    { name: 'Olej z czarnuszki', kcal: 900, protein: 0, carbs: 0, fat: 100, fiber: 0, category: 'tłuszcze', unitType: 'volume' },
    { name: 'Masło', kcal: 717, protein: 0.8, carbs: 0.1, fat: 81, fiber: 0, category: 'tłuszcze', unitType: 'weight' },
    { name: 'Masło klarowane (ghee)', kcal: 880, protein: 0, carbs: 0, fat: 99, fiber: 0, category: 'tłuszcze', unitType: 'weight' },

    // --- DODATKI, PRZYPRAWY, INNE ---
    { name: 'Miód', kcal: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2, category: 'inne', unitType: 'weight' },
    { name: 'Syrop klonowy', kcal: 260, protein: 0, carbs: 67, fat: 0, fiber: 0, category: 'inne', unitType: 'weight' },
    { name: 'Erytrytol', kcal: 0, protein: 0, carbs: 100, fat: 0, fiber: 0, category: 'inne', unitType: 'weight' },
    { name: 'Ksylitol', kcal: 240, protein: 0, carbs: 100, fat: 0, fiber: 0, category: 'inne', unitType: 'weight' },
    { name: 'Kakao naturalne', kcal: 228, protein: 20, carbs: 14, fat: 14, fiber: 33, category: 'inne', unitType: 'weight' },
    { name: 'Czekolada gorzka (85%)', kcal: 600, protein: 9, carbs: 19, fat: 50, fiber: 12, category: 'inne', unitType: 'weight' },
    { name: 'Passata pomidorowa', kcal: 30, protein: 1.5, carbs: 5.5, fat: 0.2, fiber: 1.5, category: 'inne', unitType: 'volume' },
    { name: 'Przecier pomidorowy', kcal: 82, protein: 4.3, carbs: 15, fat: 0.5, fiber: 3, category: 'inne', unitType: 'weight' },
    { name: 'Musztarda', kcal: 100, protein: 5, carbs: 5, fat: 6, fiber: 3, category: 'inne', unitType: 'weight' },
    { name: 'Majonez', kcal: 680, protein: 1, carbs: 3, fat: 75, fiber: 0, category: 'inne', unitType: 'weight' },
    { name: 'Sos sojowy', kcal: 53, protein: 8, carbs: 4.9, fat: 0.6, fiber: 0.8, category: 'inne', unitType: 'volume' },
    { name: 'Ocet jabłkowy', kcal: 21, protein: 0, carbs: 0.9, fat: 0, fiber: 0, category: 'inne', unitType: 'volume' },
    { name: 'Ocet balsamiczny', kcal: 90, protein: 0.5, carbs: 17, fat: 0, fiber: 0, category: 'inne', unitType: 'volume' },
    { name: 'Płatki drożdżowe', kcal: 350, protein: 45, carbs: 25, fat: 5, fiber: 20, category: 'inne', unitType: 'weight' },
    { name: 'Pyłek pszczeli', kcal: 340, protein: 21, carbs: 45, fat: 6, fiber: 12, category: 'inne', unitType: 'weight' },
    { name: 'Drożdże świeże', kcal: 105, protein: 11, carbs: 13, fat: 1.5, fiber: 7, category: 'inne', unitType: 'weight' },
    { name: 'Skrobia ziemniaczana', kcal: 350, protein: 0.1, carbs: 83, fat: 0.1, fiber: 0, category: 'inne', unitType: 'weight' },
    { name: 'Soda oczyszczona', kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, category: 'inne', unitType: 'weight' },
    { name: 'Proszek do pieczenia', kcal: 50, protein: 0, carbs: 12, fat: 0, fiber: 0, category: 'inne', unitType: 'weight' },
    { name: 'Kurkuma', kcal: 354, protein: 8, carbs: 65, fat: 10, fiber: 21, category: 'przyprawy', unitType: 'weight' },
    { name: 'Cynamon', kcal: 247, protein: 4, carbs: 80, fat: 1.2, fiber: 53, category: 'przyprawy', unitType: 'weight' },
    { name: 'Sól morska', kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, category: 'przyprawy', unitType: 'weight' },
    { name: 'Pieprz czarny', kcal: 251, protein: 10, carbs: 64, fat: 3.3, fiber: 25, category: 'przyprawy', unitType: 'weight' },
];

/**
 * Generuje slug z nazwy
 */
function createSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/ł/g, 'l')
        .replace(/ą/g, 'a')
        .replace(/ć/g, 'c')
        .replace(/ę/g, 'e')
        .replace(/ń/g, 'n')
        .replace(/ó/g, 'o')
        .replace(/ś/g, 's')
        .replace(/ź/g, 'z')
        .replace(/ż/g, 'z')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

async function seed() {
    console.log('[SEED] Starting consolidated ingredient seeding to Firestore...');
    console.log(`[SEED] Project ID: ${process.env.FIREBASE_PROJECT_ID}`);

    let count = 0;
    const batchSize = 20;

    // Uzyskaj unikalne rekordy po slugu (na wypadek duplikatów w samej liście)
    const uniqueIngredients = new Map<string, any>();
    for (const item of ingredients) {
        const slug = createSlug(item.name);
        uniqueIngredients.set(slug, {
            ...item,
            slug,
            updatedAt: new Date().toISOString()
        });
    }

    const itemsToProcess = Array.from(uniqueIngredients.values());
    console.log(`[SEED] Processing ${itemsToProcess.length} unique ingredients...`);

    for (let i = 0; i < itemsToProcess.length; i++) {
        const ingredient = itemsToProcess[i];
        try {
            await db.collection('ingredients').doc(ingredient.slug).set(ingredient, { merge: true });
            count++;

            if (count % batchSize === 0) {
                console.log(`[SEED] Progress: ${count}/${itemsToProcess.length}...`);
            }
        } catch (error) {
            console.error(`[SEED] Error seeding ${ingredient.name}:`, error);
        }
    }

    console.log('[SEED] Finished seeding.');
    console.log(`[SEED] Total successfully processed: ${count}`);
    console.log(`[SEED] Errors: ${itemsToProcess.length - count}`);
}

seed().catch(console.error);
