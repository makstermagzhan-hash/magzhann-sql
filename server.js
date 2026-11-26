const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            full_name VARCHAR(150) NOT NULL,
            email VARCHAR(150) UNIQUE NOT NULL,
            phone VARCHAR(50),
            city VARCHAR(100),
            registered_site VARCHAR(200) DEFAULT 'https://magzhann-sqly.onrender.com',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS admins (
            id SERIAL PRIMARY KEY,
            admin_name VARCHAR(150) NOT NULL,
            role VARCHAR(100) DEFAULT 'TicketKZ Басқару Орталығы (Админ)',
            email VARCHAR(150) UNIQUE NOT NULL,
            admin_password VARCHAR(100) NOT NULL,
            site_name VARCHAR(150) NOT NULL,
            site_url VARCHAR(255) NOT NULL,
            total_revenue NUMERIC(12, 2) DEFAULT 0,
            sold_tickets INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        INSERT INTO admins (admin_name, role, email, admin_password, site_name, site_url, total_revenue, sold_tickets)
        VALUES ('Абилкайдар Мағжан', 'TicketKZ Басқару Орталығы (Админ)', 'makstermagzhan@gmail.com', 'admin2026', 'TicketKZ', 'https://magzhann-sqly.onrender.com', 0, 0)
        ON CONFLICT (email) DO NOTHING;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS concerts (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            artist VARCHAR(150) NOT NULL,
            concert_type VARCHAR(100) NOT NULL,
            special_guests TEXT,
            city VARCHAR(100) NOT NULL,
            venue VARCHAR(255) NOT NULL,
            event_date TIMESTAMP NOT NULL,
            price_balcony NUMERIC(10, 2) NOT NULL,
            price_fanzone NUMERIC(10, 2) NOT NULL,
            price_vip NUMERIC(10, 2) NOT NULL,
            available_seats INT NOT NULL,
            image_url TEXT,
            UNIQUE(title, city, event_date)
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            ticket_code VARCHAR(30) UNIQUE NOT NULL,
            user_id INT REFERENCES users(id) ON DELETE CASCADE,
            concert_id INT REFERENCES concerts(id) ON DELETE CASCADE,
            concert_title VARCHAR(255),
            zone_name VARCHAR(50) NOT NULL,
            row_number INT,
            seat_number INT,
            quantity INT NOT NULL,
            total_price NUMERIC(12, 2) NOT NULL,
            status VARCHAR(30) DEFAULT 'Active',
            booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS concert_title VARCHAR(255);
    `);

    await pool.query(`
        CREATE OR REPLACE FUNCTION sync_admin_totals()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE admins
            SET total_revenue = COALESCE((SELECT SUM(total_price) FROM bookings), 0),
                sold_tickets = COALESCE((SELECT SUM(quantity) FROM bookings), 0)
            WHERE email = 'makstermagzhan@gmail.com';
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_sync_admin_totals ON bookings;
        CREATE TRIGGER trg_sync_admin_totals
        AFTER INSERT OR UPDATE OR DELETE ON bookings
        FOR EACH ROW EXECUTE FUNCTION sync_admin_totals();
    `);

    const countRes = await pool.query('SELECT COUNT(*) AS cnt FROM concerts');
    if (Number(countRes.rows[0].cnt) === 0) {
        const seedConcerts = [
            ['MOLDANAZAR — Жеке Концерт (КАЗ)', 'MOLDANAZAR', 'Соло концерт', 'Арнайы қонақтар (Live Band)', 'Алматы', 'Республика Сарайы (Достық даңғылы, 56)', '2026-11-28T20:00:00', 10700, 18000, 32000, 240, 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Қайрат Нұртас — Үлкен Жеке Кеш', 'Қайрат Нұртас', 'Соло концерт', 'Төреғали Төреәлі, Нұрболат Абдуллин', 'Алматы', 'Алматы Арена (Нұркент шағын ауданы, 7)', '2026-12-12T19:30:00', 8000, 15000, 35000, 300, 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Ninety One — Q-Pop Live Show', 'Ninety One', 'Соло концерт', 'ALPHA, Rusha', 'Алматы', 'Орталық Стадион (Абай даңғылы, 48)', '2026-12-21T20:00:00', 10000, 19000, 38000, 260, 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Ирина Кайратовна — Үлкен Арена Шоу', 'Ирина Кайратовна', 'Соло концерт', 'Shiza, Hiro, Dequine', 'Астана', 'Барыс Арена (Тұран даңғылы, 57)', '2026-12-16T20:00:00', 12000, 22000, 45000, 350, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Димаш Құдайберген — Stranger World Tour', 'Димаш Құдайберген', 'Соло концерт', 'Халықаралық симфониялық оркестр', 'Астана', 'Астана Арена (Тұран даңғылы, 48)', '2027-01-15T19:00:00', 15000, 30000, 75000, 400, 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&h=800&q=80'],
            ['The Limba — Астана Live', 'The Limba', 'Соло концерт', 'Andro, JONY', 'Астана', 'Конгресс-орталық (Сауран көшесі, 44)', '2026-12-25T20:00:00', 11000, 20000, 40000, 220, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Sadraddin — Жанды Дауыс Кеші', 'Sadraddin', 'Соло концерт', 'Kalifarniya, Aro', 'Шымкент', 'Орталық Стадион (Қажымұқан көшесі, 1)', '2026-12-19T19:30:00', 9000, 16000, 30000, 250, 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Төреғали Төреәлі — Ұлы Дала Баласы', 'Төреғали Төреәлі', 'Соло концерт', 'Ерке Есмахан, Қуандық Рахым', 'Шымкент', 'Түркістан Сарайы (Нұрсәт шағын ауданы, 11)', '2026-12-08T19:00:00', 7500, 14000, 28000, 240, 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Kalifarniya — Шымкент Шоу', 'Kalifarniya', 'Соло концерт', 'Yenlik, Darkhan Juzz Tribute', 'Шымкент', 'Мұз Сарайы (Желтоқсан көшесі, 15)', '2027-01-10T20:00:00', 8500, 15500, 31000, 260, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Скриптонит — Отандастарға Арналған Кеш', 'Скриптонит', 'Соло концерт', '104, Truwer, Райда', 'Қарағанды', 'Қарағанды Арена (Республика даңғылы, 13)', '2026-12-14T20:00:00', 13000, 25000, 50000, 310, 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Мирас Жүгінісов — Зымыран Tour', 'Мирас Жүгінісов', 'Соло концерт', 'Raim, Artur', 'Қарағанды', 'Кеншілер Мәдениет Сарайы (Бұқар жырау, 32)', '2026-12-27T19:30:00', 8000, 14500, 29000, 210, 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Raim — Қозғалмасын Tour', 'Raim', 'Соло концерт', 'Ерке Есмахан, Adil', 'Ақтөбе', 'Қоныс Спорт Сарайы (Әбілқайыр хан даңғылы, 52)', '2026-12-11T20:00:00', 8500, 15000, 30000, 250, 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Ерке Есмахан — Қайда? Live', 'Ерке Есмахан', 'Соло концерт', 'Raim, Мадина Сәдуақасова', 'Ақтөбе', 'Өнер Орталығы (Әбілқайыр хан даңғылы, 90Б)', '2027-01-08T19:00:00', 7500, 13500, 27000, 220, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Shiza — Батыс Толқыны', 'Shiza', 'Соло концерт', 'Ирина Кайратовна, Dequine', 'Атырау', 'Мұнайшы Стадионы (Сәтбаев даңғылы, 15)', '2026-12-18T20:00:00', 9500, 17500, 34000, 270, 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Нұрболат Абдуллин — Сен қорқақсың', 'Нұрболат Абдуллин', 'Соло концерт', 'Қайрат Нұртас, Ернар Айдар', 'Атырау', 'Махамбет Өтемісұлы атындағы Сарай (Абай, 8)', '2026-12-29T19:30:00', 8000, 14000, 28000, 200, 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Yenlik — Теңіз Жағасындағы Кеш', 'Yenlik', 'Соло концерт', 'MOLDANAZAR, Aro', 'Ақтау', 'Ақтау Амфитеатры (Теңіз жағалауы, 15 ш/а)', '2026-12-20T20:00:00', 9000, 16500, 33000, 260, 'https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Айқын Төлепберген — 20 Жыл Сахнада', 'Айқын Төлепберген', 'Юбилейлік концерт', 'Мақпал Исабекова, Әли Оқапов', 'Ақтау', 'Абай Мәдениет Сарайы (4 ш/а, 34)', '2027-01-12T19:30:00', 7500, 13000, 26000, 210, 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Jah Khalib — Алтайдан Сәлем', 'Jah Khalib', 'Соло концерт', 'The Limba, Mot', 'Өскемен', 'Борис Александров атындағы Спорт Сарайы (Абай, 2)', '2026-12-15T20:00:00', 11500, 21000, 42000, 290, 'https://images.unsplash.com/photo-1504898770365-14faca6a7320?auto=format&fit=crop&w=600&h=800&q=80'],
            ['ALPHA — Q-Pop Шығыс Туры', 'ALPHA', 'Соло концерт', 'Ninety One, Rusha', 'Өскемен', 'Ертіс Концерт Залы (Протозанов көшесі, 43)', '2026-12-26T19:00:00', 8000, 14500, 28000, 230, 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&h=800&q=80'],
            ['МузАРТ — Алтын Қор Әндері', 'МузАРТ', 'Соло концерт', 'Сәкен Майғазиев, Мейрамбек Бесбаев', 'Павлодар', 'Естай атындағы Мәдениет Сарайы (Мәшһүр Жүсіп, 48)', '2026-12-13T19:00:00', 9000, 16000, 32000, 240, 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Hiro — Солтүстік Шоу', 'Hiro', 'Соло концерт', 'Shiza, Truwer', 'Павлодар', 'Астана Мұз Сарайы (Қаирбаев көшесі, 87)', '2027-01-05T20:00:00', 8500, 15500, 30000, 250, 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Қуандық Рахым — Болайық Бірге', 'Қуандық Рахым', 'Соло концерт', 'Альбина Шардарова, Төреғали Төреәлі', 'Тараз', 'Баласағұн Орталық Концерт Залы (Төле би даңғылы, 89)', '2026-12-17T19:30:00', 7000, 12500, 25000, 220, 'https://images.unsplash.com/photo-1485579149621-3123dd979885?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Ернар Айдар — Жанды Дауыс', 'Ернар Айдар', 'Соло концерт', 'Нұрболат Абдуллин, Роза Әлқожа', 'Тараз', 'Тараз Арена (Тәуке хан көшесі, 22)', '2026-12-30T19:00:00', 7500, 13500, 27000, 260, 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Роза Рымбаева — Алтын Дауыс', 'Роза Рымбаева', 'Гала-концерт', 'Әли Оқапов, Мәди Рымбаев', 'Қостанай', 'Жастар Сарайы (Әл-Фараби даңғылы, 60)', '2026-12-22T19:00:00', 8500, 15000, 30000, 210, 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?auto=format&fit=crop&w=600&h=800&q=80'],
            ['DeLacure — Тобыл Жағалауы', 'DeLacure', 'Соло концерт', 'V $ X V PRiNCE, Кисло-Сладкий', 'Қостанай', 'Мұз Сарайы (Тәуелсіздік көшесі, 132)', '2027-01-14T20:00:00', 9000, 16500, 32000, 240, 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Мейрамбек Бесбаев — Рухани Кеш', 'Мейрамбек Бесбаев', 'Соло концерт', 'МузАРТ, Тоқтар Серіков', 'Түркістан', 'Конгресс Холл Түркістан (Жаңа қала, 28)', '2026-12-24T19:30:00', 8000, 14500, 29000, 230, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&h=800&q=80'],
            ['Sadraddin & Kalifarniya — Түркістан Арена Шоу', 'Sadraddin', 'Бірлескен концерт', 'Kalifarniya, Мирас Жүгінісов', 'Түркістан', 'Түркістан Арена (Б. Саттарханов даңғылы, 40)', '2027-01-18T20:00:00', 9500, 18000, 36000, 320, 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=600&h=800&q=80']
        ];

        for (const c of seedConcerts) {
            await pool.query(
                `INSERT INTO concerts (title, artist, concert_type, special_guests, city, venue, event_date, price_balcony, price_fanzone, price_vip, available_seats, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT DO NOTHING`,
                c
            );
        }
    }
}

app.get('/api/concerts', async (req, res) => {
    try {
        const { city, search } = req.query;
        let query = 'SELECT * FROM concerts WHERE 1=1';
        const params = [];
        if (city && city !== 'Барлығы') {
            params.push(city);
            query += ` AND city = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (title ILIKE $${params.length} OR artist ILIKE $${params.length} OR venue ILIKE $${params.length})`;
        }
        query += ' ORDER BY event_date ASC';
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Сервер қатесі' });
    }
});

app.post('/api/sync-real-concerts', async (req, res) => {
    const searchArtist = (req.body.artistQuery || 'Coldplay').trim();
    try {
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchArtist)}&country=kz&media=music&limit=6`);
        const itunesData = await itunesRes.json();
        const items = itunesData.results || [];
        if (items.length === 0) return res.status(404).json({ error: `"${searchArtist}" табылмады!` });

        const artistImg = items[0].artworkUrl100.replace('100x100bb', '600x800bb');
        const officialArtistName = items[0].artistName || searchArtist;
        const targetCities = ['Алматы', 'Астана', 'Шымкент', 'Қарағанды', 'Ақтөбе', 'Атырау', 'Ақтау', 'Өскемен', 'Павлодар', 'Тараз', 'Қостанай', 'Түркістан'];
        const insertedConcerts = [];
        let counter = 0;

        for (const city of targetCities) {
            for (let k = 0; k < 2; k++) {
                const trackItem = items[counter % items.length];
                const cover = trackItem.artworkUrl100.replace('100x100bb', '600x800bb') || artistImg;
                const tourTitle = `${trackItem.collectionName || trackItem.trackName || 'Live Show'} (${k === 0 ? 'Кешкі шоу' : 'Қосымша концерт'})`.substring(0, 145);
                const eventDate = new Date(Date.now() + (counter + 5) * 86400000).toISOString();
                const basePrice = 8500 + (k * 2000);

                const result = await pool.query(
                    `INSERT INTO concerts (title, artist, concert_type, special_guests, city, venue, event_date, price_balcony, price_fanzone, price_vip, available_seats, image_url)
                     VALUES ($1, $2, 'API Тур', $3, $4, $5, $6, $7, $8, $9, 260, $10)
                     ON CONFLICT DO NOTHING RETURNING *`,
                    [tourTitle, officialArtistName.substring(0, 95), `Жанр: ${trackItem.primaryGenreName || 'Pop / Live'}`, city, `${city} Орталық Аренасы`, eventDate, basePrice, Math.round(basePrice * 1.8), Math.round(basePrice * 3.2), cover]
                );
                if (result.rows[0]) insertedConcerts.push(result.rows[0]);
                counter++;
            }
        }
        res.json({ success: true, count: insertedConcerts.length, concerts: insertedConcerts });
    } catch (err) {
        res.status(500).json({ error: 'API қатесі' });
    }
});

app.post('/api/concerts', async (req, res) => {
    const { title, artist, concert_type, special_guests, city, venue, event_date, price_balcony, price_fanzone, price_vip, image_url } = req.body;
    try {
        const finalImg = image_url || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=600&h=800&q=80';
        const { rows } = await pool.query(
            `INSERT INTO concerts (title, artist, concert_type, special_guests, city, venue, event_date, price_balcony, price_fanzone, price_vip, available_seats, image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 240, $11) RETURNING *`,
            [title, artist, concert_type || 'Соло концерт', special_guests || 'Жоқ', city, venue, event_date, price_balcony, price_fanzone, price_vip, finalImg]
        );
        res.json({ success: true, concert: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Концертті қосу қатесі' });
    }
});

app.get('/api/concerts/:id/booked-seats', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT zone_name, row_number, seat_number FROM bookings WHERE concert_id = $1', [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Орындар қатесі' });
    }
});

app.post('/api/auth', async (req, res) => {
    const { full_name, email, phone, city } = req.body;
    if (!email || !full_name) return res.status(400).json({ error: 'Аты-жөніңіз бен Email енгізіңіз!' });
    try {
        const { rows } = await pool.query(
            `INSERT INTO users (full_name, email, phone, city, registered_site)
             VALUES ($1, $2, $3, $4, 'https://magzhann-sqly.onrender.com')
             ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = COALESCE(EXCLUDED.phone, users.phone), city = COALESCE(EXCLUDED.city, users.city)
             RETURNING *`,
            [full_name, email, phone || '+7 (777) 000-00-00', city || 'Алматы']
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Профиль қатесі' });
    }
});

app.post('/api/book-seats', async (req, res) => {
    const { user_id, concert_id, seats } = req.body;
    if (!seats || seats.length === 0) return res.status(400).json({ error: 'Кем дегенде 1 орын таңдаңыз!' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let validUserId = user_id;
        const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [user_id]);
        if (userCheck.rows.length === 0) {
            const fallbackUser = await client.query(
                `INSERT INTO users (full_name, email, phone, city)
                 VALUES ('Қонақ сатып алушы', 'guest_' || floor(random()*100000) || '@ticketkz.kz', '+7 (777) 000-00-00', 'Алматы')
                 RETURNING id`
            );
            validUserId = fallbackUser.rows[0].id;
        }

        const concertRes = await client.query('SELECT artist, title, city FROM concerts WHERE id = $1', [concert_id]);
        const cInfo = concertRes.rows[0];
        const concertTitleText = cInfo ? `${cInfo.artist} — ${cInfo.title} (${cInfo.city})` : 'Концерт';

        const createdBookings = [];
        for (const s of seats) {
            const ticket_code = 'TKZ-' + Math.floor(100000 + Math.random() * 900000);
            const { rows } = await client.query(
                `INSERT INTO bookings (ticket_code, user_id, concert_id, concert_title, zone_name, row_number, seat_number, quantity, total_price)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8) RETURNING *`,
                [ticket_code, validUserId, concert_id, concertTitleText, s.zone, s.row, s.seat, s.price]
            );
            createdBookings.push(rows[0]);
        }
        await client.query('UPDATE concerts SET available_seats = available_seats - $1 WHERE id = $2', [seats.length, concert_id]);
        await client.query('COMMIT');
        res.json({ success: true, bookings: createdBookings });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.get('/api/profile/:userId', async (req, res) => {
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
        if (!userRes.rows[0]) return res.status(404).json({ error: 'Табылмады' });

        const ticketsRes = await pool.query(
            `SELECT b.*, c.title, c.artist, c.city, c.venue, c.event_date, c.concert_type, c.special_guests, c.image_url
             FROM bookings b JOIN concerts c ON b.concert_id = c.id WHERE b.user_id = $1 ORDER BY b.booking_date DESC`,
            [req.params.userId]
        );
        const tickets = ticketsRes.rows;
        const totalSpent = tickets.reduce((sum, t) => sum + Number(t.total_price), 0);
        const totalTickets = tickets.reduce((sum, t) => sum + Number(t.quantity), 0);
        res.json({ user: userRes.rows[0], tickets, analytics: { totalSpent, totalTickets, eventsCount: tickets.length, favoriteCity: userRes.rows[0].city || 'Алматы' } });
    } catch (err) {
        res.status(500).json({ error: 'Профиль қатесі' });
    }
});

app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const bRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
        if (!bRes.rows[0]) return res.status(404).json({ error: 'Табылмады' });
        await pool.query('UPDATE concerts SET available_seats = available_seats + $1 WHERE id = $2', [bRes.rows[0].quantity, bRes.rows[0].concert_id]);
        await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

function checkAdmin(req, res, next) {
    const pass = req.headers['x-admin-password'] || req.body?.password || req.query?.password;
    if (pass !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Админ құпиясөзі қате!' });
    next();
}

app.post('/api/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ error: 'Құпиясөз қате!' });
});

app.get('/api/admin/dashboard', checkAdmin, async (req, res) => {
    try {
        const statsRes = await pool.query('SELECT COALESCE(SUM(total_price), 0) AS total_revenue, COALESCE(SUM(quantity), 0) AS total_sold FROM bookings');
        const usersRes = await pool.query('SELECT COUNT(*) AS count FROM users');
        const concertsRes = await pool.query('SELECT * FROM concerts ORDER BY event_date ASC');
        const bookingsRes = await pool.query(
            `SELECT b.*, u.full_name, u.email, u.phone, c.artist, c.title, c.city, c.venue, c.event_date
             FROM bookings b LEFT JOIN users u ON b.user_id = u.id LEFT JOIN concerts c ON b.concert_id = c.id
             ORDER BY b.booking_date DESC LIMIT 100`
        );
        res.json({
            stats: {
                totalRevenue: Number(statsRes.rows[0].total_revenue),
                totalSold: Number(statsRes.rows[0].total_sold),
                totalUsers: Number(usersRes.rows[0].count),
                totalConcerts: concertsRes.rows.length
            },
            concerts: concertsRes.rows,
            bookings: bookingsRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: 'Админ қатесі' });
    }
});

app.put('/api/admin/concerts/:id', checkAdmin, async (req, res) => {
    const { title, artist, city, venue, price_balcony, price_fanzone, price_vip, available_seats } = req.body;
    try {
        const { rows } = await pool.query(
            `UPDATE concerts SET title=$1, artist=$2, city=$3, venue=$4, price_balcony=$5, price_fanzone=$6, price_vip=$7, available_seats=$8 WHERE id=$9 RETURNING *`,
            [title, artist, city, venue, price_balcony, price_fanzone, price_vip, available_seats, req.params.id]
        );
        res.json({ success: true, concert: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Жаңарту қатесі' });
    }
});

app.delete('/api/admin/concerts/:id', checkAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM concerts WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Өшіру қатесі' });
    }
});

app.post('/api/admin/verify-ticket', checkAdmin, async (req, res) => {
    const { ticket_code, markUsed } = req.body;
    try {
        const cleanCode = (ticket_code || '').trim().toUpperCase();
        const { rows } = await pool.query(
            `SELECT b.*, u.full_name, u.phone, c.artist, c.title, c.city, c.venue, c.event_date
             FROM bookings b LEFT JOIN users u ON b.user_id = u.id LEFT JOIN concerts c ON b.concert_id = c.id
             WHERE b.ticket_code = $1`,
            [cleanCode]
        );
        if (!rows[0]) return res.status(404).json({ valid: false, error: 'Билет табылмады!' });
        if (markUsed && rows[0].status !== 'Used') {
            await pool.query("UPDATE bookings SET status = 'Used' WHERE id = $1", [rows[0].id]);
            rows[0].status = 'Used';
        }
        res.json({ valid: true, ticket: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Тексеру қатесі' });
    }
});

initDatabase()
    .then(() => app.listen(PORT, () => console.log(`TicketKZ (Render PostgreSQL) іске қосылды: ${PORT}`)))
    .catch((err) => console.error('База қатесі:', err));