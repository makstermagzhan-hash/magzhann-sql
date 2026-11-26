const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Локальді SQLite файлы (парольсіз және сыртқы серверсіз)
const dbPath = path.join(__dirname, 'ticketkz.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('SQLite қосылу қатесі:', err.message);
    else console.log('SQLite дерекқоры сәтті қосылды:', dbPath);
});

// Promise негізіндегі ыңғайлы SQLite көмекшілері
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Кестелерді құру және 12 қалаға 28 бастапқы концертті автоматты толтыру
async function initDatabase() {
    await dbRun('PRAGMA foreign_keys = ON');

    await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            city TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS concerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            concert_type TEXT NOT NULL,
            special_guests TEXT,
            city TEXT NOT NULL,
            venue TEXT NOT NULL,
            event_date TEXT NOT NULL,
            price_balcony REAL NOT NULL,
            price_fanzone REAL NOT NULL,
            price_vip REAL NOT NULL,
            available_seats INTEGER NOT NULL,
            image_url TEXT,
            UNIQUE(title, city, event_date)
        )
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_code TEXT UNIQUE NOT NULL,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            concert_id INTEGER REFERENCES concerts(id) ON DELETE CASCADE,
            zone_name TEXT NOT NULL,
            row_number INTEGER,
            seat_number INTEGER,
            quantity INTEGER NOT NULL,
            total_price REAL NOT NULL,
            status TEXT DEFAULT 'Active',
            booking_date TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const countRow = await dbGet('SELECT COUNT(*) AS cnt FROM concerts');
    if (countRow.cnt === 0) {
        const seedConcerts = [
            // АЛМАТЫ
            ['MOLDANAZAR — Жеке Концерт (КАЗ)', 'MOLDANAZAR', 'Соло концерт', 'Арнайы қонақтар (Live Band)', 'Алматы', 'Республика Сарайы (Достық даңғылы, 56)', '2026-11-28T20:00:00', 10700, 18000, 32000, 240, 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Қайрат Нұртас — Үлкен Жеке Кеш', 'Қайрат Нұртас', 'Соло концерт', 'Төреғали Төреәлі, Нұрболат Абдуллин', 'Алматы', 'Алматы Арена (Нұркент шағын ауданы, 7)', '2026-12-12T19:30:00', 8000, 15000, 35000, 300, 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Ninety One — Q-Pop Live Show', 'Ninety One', 'Соло концерт', 'ALPHA, Rusha', 'Алматы', 'Орталық Стадион (Абай даңғылы, 48)', '2026-12-21T20:00:00', 10000, 19000, 38000, 260, 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=600&h=800&q=80'],
            // АСТАНА
            ['Ирина Кайратовна — Үлкен Арена Шоу', 'Ирина Кайратовна', 'Соло концерт', 'Shiza, Hiro, Dequine', 'Астана', 'Барыс Арена (Тұран даңғылы, 57)', '2026-12-16T20:00:00', 12000, 22000, 45000, 350, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Димаш Құдайберген — Stranger World Tour', 'Димаш Құдайберген', 'Соло концерт', 'Халықаралық симфониялық оркестр', 'Астана', 'Астана Арена (Тұран даңғылы, 48)', '2027-01-15T19:00:00', 15000, 30000, 75000, 400, 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&h=800&q=80'],
            ['The Limba — Астана Live', 'The Limba', 'Соло концерт', 'Andro, JONY', 'Астана', 'Конгресс-орталық (Сауран көшесі, 44)', '2026-12-25T20:00:00', 11000, 20000, 40000, 220, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&h=800&q=80'],
            // ШЫМКЕНТ
            ['Sadraddin — Жанды Дауыс Кеші', 'Sadraddin', 'Соло концерт', 'Kalifarniya, Aro', 'Шымкент', 'Орталық Стадион (Қажымұқан көшесі, 1)', '2026-12-19T19:30:00', 9000, 16000, 30000, 250, 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Төреғали Төреәлі — Ұлы Дала Баласы', 'Төреғали Төреәлі', 'Соло концерт', 'Ерке Есмахан, Қуандық Рахым', 'Шымкент', 'Түркістан Сарайы (Нұрсәт шағын ауданы, 11)', '2026-12-08T19:00:00', 7500, 14000, 28000, 240, 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Kalifarniya — Шымкент Шоу', 'Kalifarniya', 'Соло концерт', 'Yenlik, Darkhan Juzz Tribute', 'Шымкент', 'Мұз Сарайы (Желтоқсан көшесі, 15)', '2027-01-10T20:00:00', 8500, 15500, 31000, 260, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&h=800&q=80'],
            // ҚАРАҒАНДЫ
            ['Скриптонит — Отандастарға Арналған Кеш', 'Скриптонит', 'Соло концерт', '104, Truwer, Райда', 'Қарағанды', 'Қарағанды Арена (Республика даңғылы, 13)', '2026-12-14T20:00:00', 13000, 25000, 50000, 310, 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Мирас Жүгінісов — Зымыран Tour', 'Мирас Жүгінісов', 'Соло концерт', 'Raim, Artur', 'Қарағанды', 'Кеншілер Мәдениет Сарайы (Бұқар жырау, 32)', '2026-12-27T19:30:00', 8000, 14500, 29000, 210, 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=600&h=800&q=80'],
            // АҚТӨБЕ
            ['Raim — Қозғалмасын Tour', 'Raim', 'Соло концерт', 'Ерке Есмахан, Adil', 'Ақтөбе', 'Қоныс Спорт Сарайы (Әбілқайыр хан даңғылы, 52)', '2026-12-11T20:00:00', 8500, 15000, 30000, 250, 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Ерке Есмахан — Қайда? Live', 'Ерке Есмахан', 'Соло концерт', 'Raim, Мадина Сәдуақасова', 'Ақтөбе', 'Өнер Орталығы (Әбілқайыр хан даңғылы, 90Б)', '2027-01-08T19:00:00', 7500, 13500, 27000, 220, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&h=800&q=80'],
            // АТЫРАУ
            ['Shiza — Батыс Толқыны', 'Shiza', 'Соло концерт', 'Ирина Кайратовна, Dequine', 'Атырау', 'Мұнайшы Стадионы (Сәтбаев даңғылы, 15)', '2026-12-18T20:00:00', 9500, 17500, 34000, 270, 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Нұрболат Абдуллин — Сен қорқақсың', 'Нұрболат Абдуллин', 'Соло концерт', 'Қайрат Нұртас, Ернар Айдар', 'Атырау', 'Махамбет Өтемісұлы атындағы Сарай (Абай, 8)', '2026-12-29T19:30:00', 8000, 14000, 28000, 200, 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?auto=format&fit=crop&w=600&h=800&q=80'],
            // АҚТАУ
            ['Yenlik — Теңіз Жағасындағы Кеш', 'Yenlik', 'Соло концерт', 'MOLDANAZAR, Aro', 'Ақтау', 'Ақтау Амфитеатры (Теңіз жағалауы, 15 ш/а)', '2026-12-20T20:00:00', 9000, 16500, 33000, 260, 'https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Айқын Төлепберген — 20 Жыл Сахнада', 'Айқын Төлепберген', 'Юбилейлік концерт', 'Мақпал Исабекова, Әли Оқапов', 'Ақтау', 'Абай Мәдениет Сарайы (4 ш/а, 34)', '2027-01-12T19:30:00', 7500, 13000, 26000, 210, 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=600&h=800&q=80'],
            // ӨСКЕМЕН
            ['Jah Khalib — Алтайдан Сәлем', 'Jah Khalib', 'Соло концерт', 'The Limba, Mot', 'Өскемен', 'Борис Александров атындағы Спорт Сарайы (Абай, 2)', '2026-12-15T20:00:00', 11500, 21000, 42000, 290, 'https://images.unsplash.com/photo-1504898770365-14faca6a7320?auto=format&fit=crop&w=600&h=800&q=80'],
            ['ALPHA — Q-Pop Шығыс Туры', 'ALPHA', 'Соло концерт', 'Ninety One, Rusha', 'Өскемен', 'Ертіс Концерт Залы (Протозанов көшесі, 43)', '2026-12-26T19:00:00', 8000, 14500, 28000, 230, 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&h=800&q=80'],
            // ПАВЛОДАР
            ['МузАРТ — Алтын Қор Әндері', 'МузАРТ', 'Соло концерт', 'Сәкен Майғазиев, Мейрамбек Бесбаев', 'Павлодар', 'Естай атындағы Мәдениет Сарайы (Мәшһүр Жүсіп, 48)', '2026-12-13T19:00:00', 9000, 16000, 32000, 240, 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Hiro — Солтүстік Шоу', 'Hiro', 'Соло концерт', 'Shiza, Truwer', 'Павлодар', 'Астана Мұз Сарайы (Қаирбаев көшесі, 87)', '2027-01-05T20:00:00', 8500, 15500, 30000, 250, 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=600&h=800&q=80'],
            // ТАРАЗ
            ['Қуандық Рахым — Болайық Бірге', 'Қуандық Рахым', 'Соло концерт', 'Альбина Шардарова, Төреғали Төреәлі', 'Тараз', 'Баласағұн Орталық Концерт Залы (Төле би даңғылы, 89)', '2026-12-17T19:30:00', 7000, 12500, 25000, 220, 'https://images.unsplash.com/photo-1485579149621-3123dd979885?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Ернар Айдар — Жанды Дауыс', 'Ернар Айдар', 'Соло концерт', 'Нұрболат Абдуллин, Роза Әлқожа', 'Тараз', 'Тараз Арена (Тәуке хан көшесі, 22)', '2026-12-30T19:00:00', 7500, 13500, 27000, 260, 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=600&h=800&q=80'],
            // ҚОСТАНАЙ
            ['Роза Рымбаева — Алтын Дауыс', 'Роза Рымбаева', 'Гала-концерт', 'Әли Оқапов, Мәди Рымбаев', 'Қостанай', 'Жастар Сарайы (Әл-Фараби даңғылы, 60)', '2026-12-22T19:00:00', 8500, 15000, 30000, 210, 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?auto=format&fit=crop&w=600&h=800&q=80'],
            ['DeLacure — Тобыл Жағалауы', 'DeLacure', 'Соло концерт', 'V $ X V PRiNCE, Кисло-Сладкий', 'Қостанай', 'Мұз Сарайы (Тәуелсіздік көшесі, 132)', '2027-01-14T20:00:00', 9000, 16500, 32000, 240, 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&h=800&q=80'],
            // ТҮРКІСТАН
            ['Мейрамбек Бесбаев — Рухани Кеш', 'Мейрамбек Бесбаев', 'Соло концерт', 'МузАРТ, Тоқтар Серіков', 'Түркістан', 'Конгресс Холл Түркістан (Жаңа қала, 28)', '2026-12-24T19:30:00', 8000, 14500, 29000, 230, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Sadraddin & Kalifarniya — Түркістан Арена Шоу', 'Sadraddin', 'Бірлескен концерт', 'Kalifarniya, Мирас Жүгінісов', 'Түркістан', 'Түркістан Арена (Б. Саттарханов даңғылы, 40)', '2027-01-18T20:00:00', 9500, 18000, 36000, 320, 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=600&h=800&q=80']
        ];

        for (const c of seedConcerts) {
            await dbRun(
                `INSERT OR IGNORE INTO concerts (title, artist, concert_type, special_guests, city, venue, event_date, price_balcony, price_fanzone, price_vip, available_seats, image_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                c
            );
        }
        console.log('12 қалаға 28 концерт SQLite базасына енгізілді.');
    }
}

// 1. Барлық концерттерді алу (қала және іздеу сүзгісімен)
app.get('/api/concerts', async (req, res) => {
    try {
        const { city, search } = req.query;
        let query = 'SELECT * FROM concerts WHERE 1=1';
        const params = [];

        if (city && city !== 'Барлығы') {
            params.push(city);
            query += ' AND city = ?';
        }
        if (search) {
            const pattern = `%${search}%`;
            params.push(pattern, pattern, pattern);
            query += ' AND (title LIKE ? OR artist LIKE ? OR venue LIKE ?)';
        }
        query += ' ORDER BY event_date ASC';

        const rows = await dbAll(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Сервер қатесі' });
    }
});

// 2. Ашық API-лер (OpenStreetMap + iTunes + BandsInTown) арқылы 12 қалаға 2 концерттен автоматты жүктеу
app.post('/api/sync-real-concerts', async (req, res) => {
    const { artistQuery } = req.body;
    const searchArtist = (artistQuery || 'Coldplay').trim();

    try {
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchArtist)}&country=kz&media=music&limit=6`);
        const itunesData = await itunesRes.json();
        const items = itunesData.results || [];
        if (items.length === 0) {
            return res.status(404).json({ error: `"${searchArtist}" бойынша iTunes API-ден дерек табылмады!` });
        }

        const artistImg = items[0].artworkUrl100.replace('100x100bb', '600x800bb');
        const officialArtistName = items[0].artistName || searchArtist;

        const targetCities = [
            'Алматы', 'Астана', 'Шымкент', 'Қарағанды', 'Ақтөбе', 'Атырау',
            'Ақтау', 'Өскемен', 'Павлодар', 'Тараз', 'Қостанай', 'Түркістан'
        ];

        const dynamicVenues = [];
        for (const city of targetCities) {
            try {
                const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ' арена стадион')}&format=json&limit=1&accept-language=kk`;
                const osmRes = await fetch(osmUrl, {
                    headers: { 'User-Agent': 'TicketKZ-Platform/1.0' }
                });
                const osmData = await osmRes.json();

                if (Array.isArray(osmData) && osmData.length > 0) {
                    const parts = osmData[0].display_name.split(',').map(s => s.trim());
                    const venueTitle = parts[0];
                    const streetInfo = parts.slice(1, 3).join(', ');
                    dynamicVenues.push({
                        city,
                        venue: `${venueTitle} (${streetInfo})`.substring(0, 145)
                    });
                } else {
                    dynamicVenues.push({ city, venue: `${city} Орталық Аренасы` });
                }
            } catch (_) {
                dynamicVenues.push({ city, venue: `${city} Орталық Аренасы` });
            }
        }

        let bitEvents = [];
        try {
            const bitUrl = `https://rest.bandsintown.com/artists/${encodeURIComponent(officialArtistName)}/events?app_id=ticketkz_app`;
            const bitRes = await fetch(bitUrl);
            if (bitRes.ok) {
                const rawEvents = await bitRes.json();
                if (Array.isArray(rawEvents)) bitEvents = rawEvents;
            }
        } catch (_) {}

        const insertedConcerts = [];
        let counter = 0;

        for (const place of dynamicVenues) {
            for (let k = 0; k < 2; k++) {
                const trackItem = items[counter % items.length];
                const cover = trackItem.artworkUrl100.replace('100x100bb', '600x800bb') || artistImg;
                const bitEv = bitEvents[counter % (bitEvents.length || 1)];

                const tourTitle = (bitEv?.title
                    ? `${bitEv.title} — ${place.city}`
                    : `${trackItem.collectionName || trackItem.trackName || 'Live Show'} (${k === 0 ? 'Кешкі шоу' : 'Қосымша концерт'})`).substring(0, 145);

                const dupCheck = await dbGet(
                    'SELECT id FROM concerts WHERE artist = ? AND title = ? AND city = ?',
                    [officialArtistName.substring(0, 95), tourTitle, place.city]
                );
                if (dupCheck) {
                    counter++;
                    continue;
                }

                const eventDate = new Date(Date.now() + (counter + 5) * 86400000).toISOString();
                const basePrice = 8500 + (k * 2000);

                const info = await dbRun(
                    `INSERT INTO concerts (title, artist, concert_type, special_guests, city, venue, event_date, price_balcony, price_fanzone, price_vip, available_seats, image_url)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 260, ?)`,
                    [
                        tourTitle,
                        officialArtistName.substring(0, 95),
                        'API Тур',
                        `Жанр: ${trackItem.primaryGenreName || 'Pop / Live'} • Арнайы қонақтар`,
                        place.city,
                        place.venue,
                        eventDate,
                        basePrice,
                        Math.round(basePrice * 1.8),
                        Math.round(basePrice * 3.2),
                        cover
                    ]
                );
                const created = await dbGet('SELECT * FROM concerts WHERE id = ?', [info.lastID]);
                insertedConcerts.push(created);
                counter++;
            }
        }

        res.json({ success: true, count: insertedConcerts.length, concerts: insertedConcerts });
    } catch (err) {
        console.error('API Sync қатесі:', err);
        res.status(500).json({ error: 'Сыртқы API-лермен байланыс қатесі' });
    }
});

// 3. Жаңа шынайы концертті қолмен қосу
app.post('/api/concerts', async (req, res) => {
    const { title, artist, concert_type, special_guests, city, venue, event_date, price_balcony, price_fanzone, price_vip, image_url } = req.body;
    try {
        let finalImg = image_url;
        if (!finalImg) {
            const itRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&country=kz&media=music&limit=1`);
            const itData = await itRes.json();
            finalImg = itData.results?.[0]?.artworkUrl100?.replace('100x100bb', '600x800bb')
                || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=600&h=800&q=80';
        }

        const info = await dbRun(
            `INSERT INTO concerts (title, artist, concert_type, special_guests, city, venue, event_date, price_balcony, price_fanzone, price_vip, available_seats, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 240, ?)`,
            [title, artist, concert_type || 'Соло концерт', special_guests || 'Жоқ', city, venue, event_date, price_balcony, price_fanzone, price_vip, finalImg]
        );
        const created = await dbGet('SELECT * FROM concerts WHERE id = ?', [info.lastID]);
        res.json({ success: true, concert: created });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Концертті қосу қатесі' });
    }
});

// 4. Концерт фотосын URL сілтеме арқылы ауыстыру
app.put('/api/concerts/:id/image', async (req, res) => {
    const { id } = req.params;
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: 'Сурет сілтемесін (URL) енгізіңіз!' });
    try {
        await dbRun('UPDATE concerts SET image_url = ? WHERE id = ?', [image_url, id]);
        const updated = await dbGet('SELECT * FROM concerts WHERE id = ?', [id]);
        res.json({ success: true, concert: updated });
    } catch (err) {
        res.status(500).json({ error: 'Суретті жаңарту қатесі' });
    }
});

// 5. Сатылып кеткен орындарды алу
app.get('/api/concerts/:id/booked-seats', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await dbAll(
            'SELECT zone_name, row_number, seat_number FROM bookings WHERE concert_id = ?',
            [id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Орындарды жүктеу қатесі' });
    }
});

// 6. Профильге кіру немесе тіркеу
app.post('/api/auth', async (req, res) => {
    const { full_name, email, phone, city } = req.body;
    if (!email || !full_name) {
        return res.status(400).json({ error: 'Аты-жөніңіз бен Email енгізіңіз!' });
    }

    try {
        let user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            const info = await dbRun(
                'INSERT INTO users (full_name, email, phone, city) VALUES (?, ?, ?, ?)',
                [full_name, email, phone || '+7 (777) 000-00-00', city || 'Алматы']
            );
            user = await dbGet('SELECT * FROM users WHERE id = ?', [info.lastID]);
        } else {
            await dbRun(
                'UPDATE users SET full_name = ?, phone = COALESCE(?, phone), city = COALESCE(?, city) WHERE email = ?',
                [full_name, phone, city, email]
            );
            user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Профиль қатесі' });
    }
});

// 7. Бірнеше таңдалған орынды брондау
app.post('/api/book-seats', async (req, res) => {
    const { user_id, concert_id, seats } = req.body;
    if (!seats || seats.length === 0) {
        return res.status(400).json({ error: 'Кем дегенде 1 орын таңдаңыз!' });
    }

    try {
        await dbRun('BEGIN TRANSACTION');

        const concert = await dbGet('SELECT available_seats FROM concerts WHERE id = ?', [concert_id]);
        if (!concert) throw new Error('Концерт табылмады');
        if (concert.available_seats < seats.length) throw new Error('Бос орындар жеткіліксіз!');

        const createdBookings = [];
        for (const s of seats) {
            const existing = await dbGet(
                'SELECT id FROM bookings WHERE concert_id = ? AND zone_name = ? AND row_number = ? AND seat_number = ?',
                [concert_id, s.zone, s.row, s.seat]
            );
            if (existing) {
                throw new Error(`${s.zone}: Қатар ${s.row}, Орын ${s.seat} бос емес!`);
            }

            const ticket_code = 'TKZ-' + Math.floor(100000 + Math.random() * 900000);
            const info = await dbRun(
                `INSERT INTO bookings (ticket_code, user_id, concert_id, zone_name, row_number, seat_number, quantity, total_price)
                 VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
                [ticket_code, user_id, concert_id, s.zone, s.row, s.seat, s.price]
            );
            const row = await dbGet('SELECT * FROM bookings WHERE id = ?', [info.lastID]);
            createdBookings.push(row);
        }

        await dbRun(
            'UPDATE concerts SET available_seats = available_seats - ? WHERE id = ?',
            [seats.length, concert_id]
        );

        await dbRun('COMMIT');
        res.json({ success: true, bookings: createdBookings });
    } catch (err) {
        await dbRun('ROLLBACK');
        res.status(400).json({ error: err.message });
    }
});

// 8. Профиль және Аналитика
app.get('/api/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'Пайдаланушы табылмады' });

        const tickets = await dbAll(`
            SELECT b.*, c.title, c.artist, c.city, c.venue, c.event_date, c.concert_type, c.special_guests, c.image_url
            FROM bookings b
            JOIN concerts c ON b.concert_id = c.id
            WHERE b.user_id = ?
            ORDER BY b.booking_date DESC
        `, [userId]);

        const totalSpent = tickets.reduce((sum, t) => sum + Number(t.total_price), 0);
        const totalTickets = tickets.reduce((sum, t) => sum + Number(t.quantity), 0);

        const cityCounts = {};
        tickets.forEach(t => { cityCounts[t.city] = (cityCounts[t.city] || 0) + 1; });
        const favoriteCity = Object.keys(cityCounts).sort((a, b) => cityCounts[b] - cityCounts[a])[0] || 'Әлі жоқ';

        res.json({
            user,
            tickets,
            analytics: { totalSpent, totalTickets, eventsCount: tickets.length, favoriteCity }
        });
    } catch (err) {
        res.status(500).json({ error: 'Профиль қатесі' });
    }
});

// 9. Билетті қайтару
app.delete('/api/bookings/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('BEGIN TRANSACTION');
        const booking = await dbGet('SELECT * FROM bookings WHERE id = ?', [id]);
        if (!booking) throw new Error('Билет табылмады');

        await dbRun('UPDATE concerts SET available_seats = available_seats + ? WHERE id = ?', [booking.quantity, booking.concert_id]);
        await dbRun('DELETE FROM bookings WHERE id = ?', [id]);

        await dbRun('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await dbRun('ROLLBACK');
        res.status(400).json({ error: err.message });
    }
});

// ================= АДМИН-ПАНЕЛЬ API =================

function checkAdmin(req, res, next) {
    const pass = req.headers['x-admin-password'] || req.body?.password || req.query?.password;
    if (pass !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Админ құпиясөзі қате!' });
    }
    next();
}

// 10. Админ авторизациясы
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Құпиясөз қате!' });
    }
});

// 11. Админ жалпы статистика, концерттер және сатылымдар
app.get('/api/admin/dashboard', checkAdmin, async (req, res) => {
    try {
        const stats = await dbGet(`
            SELECT 
                COALESCE(SUM(total_price), 0) AS total_revenue,
                COALESCE(SUM(quantity), 0) AS total_sold
            FROM bookings
        `);
        const usersCount = await dbGet('SELECT COUNT(*) AS count FROM users');
        const concerts = await dbAll('SELECT * FROM concerts ORDER BY event_date ASC');
        const bookings = await dbAll(`
            SELECT b.*, u.full_name, u.email, u.phone, c.artist, c.title, c.city, c.venue, c.event_date
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            LEFT JOIN concerts c ON b.concert_id = c.id
            ORDER BY b.booking_date DESC
            LIMIT 100
        `);

        res.json({
            stats: {
                totalRevenue: Number(stats.total_revenue),
                totalSold: Number(stats.total_sold),
                totalUsers: Number(usersCount.count),
                totalConcerts: concerts.length
            },
            concerts,
            bookings
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Админ деректерін жүктеу қатесі' });
    }
});

// 12. Концерт бағасы мен атауын өңдеу
app.put('/api/admin/concerts/:id', checkAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, artist, city, venue, price_balcony, price_fanzone, price_vip, available_seats } = req.body;
    try {
        await dbRun(
            `UPDATE concerts 
             SET title = ?, artist = ?, city = ?, venue = ?, price_balcony = ?, price_fanzone = ?, price_vip = ?, available_seats = ?
             WHERE id = ?`,
            [title, artist, city, venue, price_balcony, price_fanzone, price_vip, available_seats, id]
        );
        const updated = await dbGet('SELECT * FROM concerts WHERE id = ?', [id]);
        res.json({ success: true, concert: updated });
    } catch (err) {
        res.status(500).json({ error: 'Концертті жаңарту қатесі' });
    }
});

// 13. Концертті өшіру
app.delete('/api/admin/concerts/:id', checkAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('DELETE FROM concerts WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Концертті өшіру қатесі' });
    }
});

// 14. Билет кодын (TKZ-XXXXXX) тексеру және өткізу
app.post('/api/admin/verify-ticket', checkAdmin, async (req, res) => {
    const { ticket_code, markUsed } = req.body;
    if (!ticket_code) return res.status(400).json({ error: 'Билет кодын енгізіңіз!' });

    try {
        const cleanCode = ticket_code.trim().toUpperCase();
        let ticket = await dbGet(`
            SELECT b.*, u.full_name, u.phone, c.artist, c.title, c.city, c.venue, c.event_date
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            LEFT JOIN concerts c ON b.concert_id = c.id
            WHERE b.ticket_code = ?
        `, [cleanCode]);

        if (!ticket) {
            return res.status(404).json({ valid: false, error: 'Мұндай кодты билет базадан табылмады!' });
        }

        if (markUsed && ticket.status !== 'Used') {
            await dbRun("UPDATE bookings SET status = 'Used' WHERE id = ?", [ticket.id]);
            ticket.status = 'Used';
        }

        res.json({ valid: true, ticket });
    } catch (err) {
        res.status(500).json({ error: 'Тексеру қатесі' });
    }
});

// Серверді база дайын болған соң іске қосу
initDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`TicketKZ (SQLite) іске қосылды: http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Базаны инициализациялау қатесі:', err);
    });