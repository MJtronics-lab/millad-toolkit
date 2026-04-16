// Shared data and utilities for Millads Toolkit
// v2: Tagesablauf-Reihenfolge + Wasser-Tracker

const RULES = [
  { section: "Morgen (Fajr–9:00)", items: [
    "6-8 Stunden geschlafen (Vortag)",
    "2 Ayat auswendig gelernt + Tafsir",
    "1 Kapitel Madinah-Buch",
    "30 Min Pflege (Klamotten, Bart, Haare, Produkte)",
    "Vit D, Magnesium, Omega 3 eingenommen",
  ]},
  { section: "Vormittag (9:00–12:30)", items: [
    "Fitness gemacht (oder Pause-Tag, max. 3 am Stück)",
    "Max. 2h am Stück gearbeitet",
  ]},
  { section: "Mittag & Familie (12:30–15:00)", items: [
    "10 Min mit Inaaya bei Eltern oder Moschee",
  ]},
  // ↑ Water tracker is rendered here in the UI (not in rules array)
  { section: "Nachmittag (15:00–18:00)", items: [
    "10 Seiten in einem guten Buch gelesen",
    "15 Min nachgedacht: jemandem Freude machen",
    "15 Min Ausflug/Treffen geplant oder Ersatztätigkeit",
    "Max. 6h gearbeitet",
    "Nicht nach 18 Uhr gearbeitet",
  ]},
  { section: "Feierabend (18:00–18:45)", items: [
    "15 Min laufen",
    "10 Min dehnen",
    "10 Min Nackentraining",
  ]},
  { section: "Abend (18:45–21:00)", items: [
    "10-20 Min Vortrag mit Familie geschaut",
    "Max. 1h YouTube (nur nützliche Inhalte)",
    "Max. 1 Stück Süßes",
    "Letzte Mahlzeit vor 21 Uhr",
  ]},
  { section: "Wind Down (ab 21:00)", items: [
    "Ab 21 Uhr keine Geräte",
    "10 Min Abend-Adhkar",
  ]},
];

const DEFAULT_KERN = ['s0_i1', 's1_i0', 's3_i4', 's5_i1', 's5_i2', 's5_i3', 's6_i0'];
const WATER_GOAL = 8;
const CALORIE_GOAL = 2500;
const RULES_VERSION = 3;

// Migrate old kern_rules from v1 layout
(function migrateKernRules() {
  const v = localStorage.getItem('rules_version');
  if (v !== String(RULES_VERSION)) {
    localStorage.removeItem('kern_rules');
    localStorage.setItem('rules_version', String(RULES_VERSION));
  }
})();

// Build flat list of all rule IDs + labels
const ALL_RULE_IDS = [];
const ID_TO_LABEL = {};
RULES.forEach((sec, sIdx) => {
  sec.items.forEach((label, iIdx) => {
    const id = `s${sIdx}_i${iIdx}`;
    ALL_RULE_IDS.push(id);
    ID_TO_LABEL[id] = label;
  });
});
// Virtual tracker rules
ALL_RULE_IDS.push('water');
ID_TO_LABEL['water'] = 'Wasser (8 Gläser)';
ALL_RULE_IDS.push('calories');
ID_TO_LABEL['calories'] = 'Kalorien (2500 kcal)';

function getKernRules() {
  try {
    const saved = localStorage.getItem('kern_rules');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return [...DEFAULT_KERN];
}

function dateISO(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getWaterCount(iso) {
  try {
    const v = localStorage.getItem('water_' + iso);
    if (v !== null) return parseInt(v, 10) || 0;
  } catch(e) {}
  return 0;
}

function setWaterCount(iso, count) {
  localStorage.setItem('water_' + iso, String(Math.max(0, Math.min(count, 12))));
}

function getCalories(iso) {
  try {
    const v = localStorage.getItem('calories_' + iso);
    if (v !== null) return parseInt(v, 10) || 0;
  } catch(e) {}
  return 0;
}

function setCalories(iso, amount) {
  localStorage.setItem('calories_' + iso, String(Math.max(0, amount)));
}

function getDayChecklist(iso) {
  try {
    const raw = localStorage.getItem('checklist_' + iso);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function analyzeDayResult(iso) {
  const data = getDayChecklist(iso);
  if (!data) return null;

  const kern = getKernRules();
  let done = 0, total = 0, kernDone = 0, kernTotal = 0;

  // Regular rules
  RULES.forEach((sec, sIdx) => {
    sec.items.forEach((label, iIdx) => {
      const id = `s${sIdx}_i${iIdx}`;
      total++;
      const checked = !!data[id];
      if (checked) done++;
      if (kern.includes(id)) {
        kernTotal++;
        if (checked) kernDone++;
      }
    });
  });

  // Water tracker
  total++;
  const water = getWaterCount(iso);
  const waterDone = water >= WATER_GOAL;
  if (waterDone) done++;
  if (kern.includes('water')) {
    kernTotal++;
    if (waterDone) kernDone++;
  }

  // Calorie tracker
  total++;
  const cals = getCalories(iso);
  const calsDone = cals >= CALORIE_GOAL;
  if (calsDone) done++;
  if (kern.includes('calories')) {
    kernTotal++;
    if (calsDone) kernDone++;
  }

  const items = { ...data, water: waterDone, calories: calsDone };

  return {
    done, total, kernDone, kernTotal,
    kernClean: kernDone === kernTotal,
    pct: total > 0 ? Math.round(done / total * 100) : 0,
    items,
    waterCount: water,
  };
}

function calculateStreak() {
  const today = new Date();
  let streak = 0;

  const todayResult = analyzeDayResult(dateISO(today));
  const todayFinished = localStorage.getItem('penalty_' + dateISO(today)) !== null
    || (todayResult && todayResult.done > 0);

  let checkDate = todayFinished ? new Date(today) : addDays(today, -1);

  for (let i = 0; i < 365; i++) {
    const iso = dateISO(checkDate);
    const result = analyzeDayResult(iso);
    if (!result) break;
    if (!result.kernClean) break;
    streak++;
    checkDate = addDays(checkDate, -1);
  }

  return streak;
}

function getWeekData(days) {
  days = days || 7;
  const today = new Date();
  const results = [];

  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    const iso = dateISO(d);
    const result = analyzeDayResult(iso);
    results.push({
      date: iso,
      dayName: d.toLocaleDateString('de-DE', { weekday: 'short' }),
      result: result,
    });
  }

  return results.reverse();
}

function getRuleWeekStats(days) {
  days = days || 7;
  const weekData = getWeekData(days);
  const stats = {};

  ALL_RULE_IDS.forEach(id => {
    let completed = 0, tracked = 0;
    weekData.forEach(day => {
      if (day.result) {
        tracked++;
        if (day.result.items[id]) completed++;
      }
    });
    stats[id] = { completed, tracked, label: ID_TO_LABEL[id], isKern: getKernRules().includes(id) };
  });

  return stats;
}

function getWeekPenalties() {
  const today = new Date();
  let count = 0;
  const penalties = [];

  for (let i = 0; i < 7; i++) {
    const d = addDays(today, -i);
    const iso = dateISO(d);
    try {
      const raw = localStorage.getItem('penalty_' + iso);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.level && p.level !== 'clean') {
          count++;
          penalties.push({ date: iso, ...p });
        }
      }
    } catch(e) {}
  }

  return { count, penalties };
}

function getLastWeekPct() {
  const today = new Date();
  let totalDone = 0, totalRules = 0;

  for (let i = 7; i < 14; i++) {
    const iso = dateISO(addDays(today, -i));
    const result = analyzeDayResult(iso);
    if (result) {
      totalDone += result.done;
      totalRules += result.total;
    }
  }

  return totalRules > 0 ? Math.round(totalDone / totalRules * 100) : null;
}

function getThisWeekPct() {
  const today = new Date();
  let totalDone = 0, totalRules = 0;

  for (let i = 0; i < 7; i++) {
    const iso = dateISO(addDays(today, -i));
    const result = analyzeDayResult(iso);
    if (result) {
      totalDone += result.done;
      totalRules += result.total;
    }
  }

  return totalRules > 0 ? Math.round(totalDone / totalRules * 100) : 0;
}

// === QURAN VERSES & HADITHS ===
const DAILY_WISDOM = [
  { ar: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", de: "Im Namen Allahs, des Allerbarmers, des Barmherzigen.", ref: "Al-Fatiha 1:1" },
  { ar: "إِنَّ مَعَ الْعُسْرِ يُسْرًا", de: "Wahrlich, mit der Erschwernis kommt die Erleichterung.", ref: "Ash-Sharh 94:6" },
  { ar: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ", de: "Und wer auf Allah vertraut — für den ist Er genügend.", ref: "At-Talaq 65:3" },
  { ar: "فَاذْكُرُونِي أَذْكُرْكُمْ", de: "Gedenkt Meiner, so gedenke Ich eurer.", ref: "Al-Baqara 2:152" },
  { ar: "وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ", de: "Und gebt die Hoffnung auf Allahs Barmherzigkeit nicht auf.", ref: "Yusuf 12:87" },
  { ar: "رَبِّ زِدْنِي عِلْمًا", de: "Mein Herr, mehre mir an Wissen.", ref: "Ta Ha 20:114" },
  { ar: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", de: "Wahrlich, Allah ist mit den Geduldigen.", ref: "Al-Baqara 2:153" },
  { ar: "وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ", de: "Und sucht Hilfe in der Geduld und im Gebet.", ref: "Al-Baqara 2:45" },
  { ar: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً", de: "Unser Herr, gib uns im Diesseits Gutes und im Jenseits Gutes.", ref: "Al-Baqara 2:201" },
  { ar: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا", de: "Allah erlegt keiner Seele mehr auf, als sie zu leisten vermag.", ref: "Al-Baqara 2:286" },
  { ar: "وَقُل رَّبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا", de: "Und sage: Mein Herr, erbarme Dich ihrer, so wie sie mich aufzogen, als ich klein war.", ref: "Al-Isra 17:24" },
  { ar: "وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ", de: "Und es mag sein, dass ihr etwas hasst, was gut für euch ist.", ref: "Al-Baqara 2:216" },
  { ar: "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا", de: "Und wer Allah fürchtet — dem verschafft Er einen Ausweg.", ref: "At-Talaq 65:2" },
  { ar: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ", de: "Allah genügt uns, und Er ist der beste Sachwalter.", ref: "Al Imran 3:173" },
  { ar: "وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ", de: "Und dein Herr wird dir gewiss geben, und du wirst zufrieden sein.", ref: "Ad-Duha 93:5" },
  { de: "Die besten unter euch sind diejenigen, die den besten Charakter haben.", ref: "Hadith — Bukhari" },
  { de: "Wer an Allah und den Jüngsten Tag glaubt, soll Gutes sprechen oder schweigen.", ref: "Hadith — Bukhari & Muslim" },
  { de: "Macht es leicht und macht es nicht schwer. Gebt frohe Botschaft und schreckt nicht ab.", ref: "Hadith — Bukhari" },
  { de: "Die stärkste Person ist nicht die, die andere überwindet, sondern die, die sich selbst bei Zorn beherrscht.", ref: "Hadith — Bukhari" },
  { de: "Allah schaut nicht auf eure Körper oder euer Aussehen, sondern auf eure Herzen und Taten.", ref: "Hadith — Muslim" },
  { de: "Jeder von euch ist ein Hirte, und jeder ist verantwortlich für seine Herde.", ref: "Hadith — Bukhari & Muslim" },
  { de: "Nutze fünf vor fünf: Deine Jugend vor dem Alter, deine Gesundheit vor der Krankheit, deinen Reichtum vor der Armut, deine Freizeit vor der Beschäftigung, und dein Leben vor dem Tod.", ref: "Hadith — Hakim" },
  { de: "Das Gebet ist der Schlüssel zum Paradies.", ref: "Hadith — Ahmad" },
  { de: "Wer einen Weg geht, um Wissen zu suchen, dem erleichtert Allah einen Weg zum Paradies.", ref: "Hadith — Muslim" },
  { ar: "وَالْعَصْرِ إِنَّ الْإِنسَانَ لَفِي خُسْرٍ", de: "Beim Zeitalter! Der Mensch ist wahrlich im Verlust.", ref: "Al-Asr 103:1-2" },
  { ar: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا", de: "Denn wahrlich, mit der Erschwernis ist Erleichterung.", ref: "Ash-Sharh 94:5" },
  { ar: "وَاللَّهُ يُحِبُّ الْمُحْسِنِينَ", de: "Und Allah liebt die Gutes Tuenden.", ref: "Al Imran 3:134" },
  { de: "Lächle deinen Bruder an — es ist eine Sadaqa.", ref: "Hadith — Tirmidhi" },
  { ar: "إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ", de: "Wahrlich, wir gehören Allah, und zu Ihm kehren wir zurück.", ref: "Al-Baqara 2:156" },
  { de: "Sei in dieser Welt wie ein Fremder oder ein Reisender.", ref: "Hadith — Bukhari" },
  { ar: "وَلَا تَمْشِ فِي الْأَرْضِ مَرَحًا", de: "Und schreite nicht übermütig auf der Erde.", ref: "Al-Isra 17:37" },
  { de: "Keiner von euch glaubt wirklich, bis er für seinen Bruder das wünscht, was er für sich selbst wünscht.", ref: "Hadith — Bukhari & Muslim" },
  { ar: "ادْعُونِي أَسْتَجِبْ لَكُمْ", de: "Ruft Mich an, Ich werde euch erhören.", ref: "Ghafir 40:60" },
  { de: "Die Dunya ist ein Gefängnis für den Gläubigen und ein Paradies für den Ungläubigen.", ref: "Hadith — Muslim" },
  { ar: "وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ", de: "Und helft einander zur Güte und Gottesfurcht.", ref: "Al-Ma'ida 5:2" },
  { de: "Wessen zwei Tage gleich sind, der ist betrogen.", ref: "Hadith — Daylami" },
  { ar: "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا", de: "Unser Herr, lass unsere Herzen nicht abschweifen, nachdem Du uns rechtgeleitet hast.", ref: "Al Imran 3:8" },
  { de: "Seid nicht zornig — und euch gehört das Paradies.", ref: "Hadith — Ahmad" },
  { ar: "وَاصْبِرْ فَإِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ", de: "Und sei geduldig, denn Allah lässt den Lohn der Gutes Tuenden nicht verloren gehen.", ref: "Hud 11:115" },
  { de: "Die beste Tat ist das Gebet zu seiner Zeit.", ref: "Hadith — Bukhari & Muslim" },
  { ar: "يَا أَيُّهَا الَّذِينَ آمَنُوا اصْبِرُوا وَصَابِرُوا", de: "O ihr, die ihr glaubt, seid standhaft und wetteifert in Standhaftigkeit.", ref: "Al Imran 3:200" },
  { de: "Reinlichkeit ist die Hälfte des Glaubens.", ref: "Hadith — Muslim" },
  { ar: "قُلْ هُوَ اللَّهُ أَحَدٌ", de: "Sprich: Er ist Allah, der Eine.", ref: "Al-Ikhlas 112:1" },
  { de: "Wer an Allah glaubt und den Jüngsten Tag, der soll seinen Nachbarn gut behandeln.", ref: "Hadith — Bukhari & Muslim" },
  { ar: "وَلَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا", de: "Sei nicht traurig, wahrlich, Allah ist mit uns.", ref: "At-Tawba 9:40" },
  { de: "Der Muslim, der sich unter die Menschen mischt und ihre Belästigung erträgt, ist besser als der, der sich von ihnen fernhält.", ref: "Hadith — Tirmidhi" },
  { ar: "إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنفُسِهِمْ", de: "Allah ändert nicht den Zustand eines Volkes, bis sie das ändern, was in ihnen selbst ist.", ref: "Ar-Ra'd 13:11" },
  { de: "Die beste Sadaqa ist die, die du gibst während du gesund und geizig bist, Armut fürchtest und Reichtum erhoffst.", ref: "Hadith — Bukhari & Muslim" },
  { ar: "وَرَحْمَتِي وَسِعَتْ كُلَّ شَيْءٍ", de: "Und Meine Barmherzigkeit umfasst alle Dinge.", ref: "Al-A'raf 7:156" },
  { de: "Beginnt mit dem Bismillah bei jeder bedeutenden Sache.", ref: "Hadith — Abu Dawud" },
];

function getDailyWisdom() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return DAILY_WISDOM[dayOfYear % DAILY_WISDOM.length];
}

// === NIGHT LOCK (21:00 - 04:00) ===
function checkNightLock() {
  const hour = new Date().getHours();
  if (hour >= 21 || hour < 4) {
    if (sessionStorage.getItem('night_lock_dismissed')) return;
    showNightLock();
  }
}

function showNightLock() {
  const overlay = document.createElement('div');
  overlay.id = 'night-lock';
  overlay.innerHTML = `
    <div style="
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: #0a0a0f; z-index: 10000;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px 30px; text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <div style="font-size: 64px; margin-bottom: 24px;">🌙</div>
      <div style="font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 12px;">
        Du solltest jetzt nicht am Handy sein.
      </div>
      <div style="font-size: 15px; color: #8a96a3; line-height: 1.6; max-width: 320px; margin-bottom: 8px;">
        Ab 21 Uhr keine Geräte. Leg das Handy weg, mach deine Adhkar und geh schlafen.
      </div>
      <div style="font-size: 14px; color: #9b6dd755; margin-bottom: 60px; font-style: italic;">
        وَجَعَلْنَا نَوْمَكُمْ سُبَاتًا
      </div>
      <button onclick="document.getElementById('night-lock').remove(); sessionStorage.setItem('night_lock_dismissed','1');" style="
        background: none; border: 1px solid #2a3445; color: #4a5668;
        padding: 8px 20px; border-radius: 8px; font-size: 12px; cursor: pointer;
      ">Trotzdem öffnen</button>
    </div>
  `;
  document.body.appendChild(overlay);
}
