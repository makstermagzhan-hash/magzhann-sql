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

const NEON_DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_QB0YoH4IpSMw@ep-frosty-brook-bekarcd3-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: NEON_DB_URL,
    ssl: { rejectUnauthorized: false }
});

// 1. Барлық концерттерді алу (қала және іздеу сүзгісімен)
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

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Сервер қатесі' });
    }
});

// 2. Ашық API арқылы шынайы концерттерді жүктеп, базаға қосу
app.post('/api/sync-real-concerts', async (req, res) => {
    const { artistQuery } = req.body;
    const searchArtist = (artistQuery || 'Coldplay').trim();

    try {
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchArtist)}&country=kz&media=music&limit=5`);
        const itunesData = await itunesRes.json();
        const artistImg = itunesData.results?.[0]?.artworkUrl100?.replace('100x100bb', '600x800bb')
            || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=600&h=800&q=80';
        const officialArtistName = itunesData.results?.[0]?.artistName || searchArtist;

        const bitUrl = `https://rest.bandsintown.com/artists/${encodeURIComponent(officialArtistName)}/events?app_id=ticketkz_app`;
        const bitRes = await fetch(bitUrl);
        let events = [];
        if (bitRes.ok) {
            const rawEvents = await bitRes.json();
            if (Array.isArray(rawEvents)) events = rawEvents.slice(0, 6);
        }

        const kzArenas = [
            { city: 'Алматы', venue: 'Алматы Арена (Нұркент шағын ауданы, 7)' },
            { city: 'Астана', venue: 'Астана Арена (Тұран даңғылы, 48)' },
            { city: 'Шымкент', venue: 'Орталық Стадион (Қажымұқан көшесі, 1)' },
            { city: 'Қарағанды', venue: 'Қарағанды Арена (Республика даңғылы, 13)' },
            { city: 'Ақтау', venue: 'Ақтау Амфитеатры (Теңіз жағалауы)' },
            { city: 'Атырау', venue: 'Мұнайшы Стадионы (Сәтбаев даңғылы, 15)' }
        ];
        const insertedConcerts = [];

        if (events.length > 0) {
            for (let i = 0; i < events.length; i++) {
                const ev = events[i];
                const arena = kzArenas[i % kzArenas.length];
                const realVenue = ev.venue?.name ? `${ev.venue.name} — ${arena.venue}` : arena.venue;
                const eventDate = ev.datetime || new Date(Date.now() + (i + 7) * 86400000).toISOString();
                const lineup = (ev.lineup && ev.lineup.length > 1) ? ev.lineup.slice(1).join(', ') : 'Арнайы қонақтар (Live Band)';
                const basePrice = 10000 + (i * 1500);

                const insertRes = await pool.query(
                    `INSERT INTO concerts (title, artist, concert_type, special_guests, city, venue, event_date, price_balcony, price_fanzone, price_vip, available_seats, image_url)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 260, $11) RETURNING *`,
                    [
                        (ev.title || `${officialArtistName} World Tour`).substring(0, 140),
                        officialArtistName.substring(0, 95),
                        'API Тур',
                        lineup,
                        arena.city,
                        realVenue.substring(0, 145),
                        eventDate,
                        basePrice,
                        Math.round(basePrice * 1.8),
                        Math.round(basePrice * 3.2),
                        artistImg
                    ]
                );
                insertedConcerts.push(insertRes.rows[0]);
            }
        } else {
            const items = itunesData.results || [];
            if (items.length === 0) {
                return res.status(404).json({ error: `"${searchArtist}" бойынша API деректері табылмады!` });
            }

            for (let i = 0; i < Math.min(3, items.length); i++) {
                const item = items[i];
                const arena = kzArenas[i];
                const cover = item.artworkUrl100.replace('100x100bb', '600x800bb');
                const eventDate = new Date(Date.now() + (i + 10) * 86400000).toISOString();
                const basePrice = 9000 + (i * 2000);
                const tourName = item.collectionName || item.trackName || 'Live Concert';

                const insertRes = await pool.query(
                    `INSERT INTO concerts (title, artist, concert_type, special_guests, city, venue, event_date, price_balcony, price_fanzone, price_vip, available_seats, image_url)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 240, $11) RETURNING *`,
                    [
                        `${tourName} Live Tour`.substring(0, 140),
                        item.artistName.substring(0, 95),
                        'API Концерт',
                        `Жанр: ${item.primaryGenreName || 'Live Music'}`,
                        arena.city,
                        arena.venue,
                        eventDate,
                        basePrice,
                        basePrice * 2,
                        basePrice * 3.5,
                        cover
                    ]
                );
                insertedConcerts.push(insertRes.rows[0]);
            }
        }

        res.json({ success: true, count: insertedConcerts.length, concerts: insertedConcerts });
    } catch (err) {
        console.error('API Sync қатесі:', err);
        res.status(500).json({ error: 'Сыртқы API-мен байланыс қатесі' });
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

        const result = await pool.query(
            `INSERT INTO concerts (title, artist, concert_type, special_guests, city, venue, event_date, price_balcony, price_fanzone, price_vip, available_seats, image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 240, $11) RETURNING *`,
            [title, artist, concert_type || 'Соло концерт', special_guests || 'Жоқ', city, venue, event_date, price_balcony, price_fanzone, price_vip, finalImg]
        );
        res.json({ success: true, concert: result.rows[0] });
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
        const result = await pool.query(
            'UPDATE concerts SET image_url = $1 WHERE id = $2 RETURNING *',
            [image_url, id]
        );
        res.json({ success: true, concert: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Суретті жаңарту қатесі' });
    }
});

// 5. Сатылып кеткен орындарды алу
app.get('/api/concerts/:id/booked-seats', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT zone_name, row_number, seat_number FROM bookings WHERE concert_id = $1',
            [id]
        );
        res.json(result.rows);
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
        let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            userRes = await pool.query(
                'INSERT INTO users (full_name, email, phone, city) VALUES ($1, $2, $3, $4) RETURNING *',
                [full_name, email, phone || '+7 (777) 000-00-00', city || 'Алматы']
            );
        } else {
            userRes = await pool.query(
                'UPDATE users SET full_name = $1, phone = COALESCE($2, phone), city = COALESCE($3, city) WHERE email = $4 RETURNING *',
                [full_name, phone, city, email]
            );
        }
        res.json(userRes.rows[0]);
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

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const concertRes = await client.query(
            'SELECT available_seats FROM concerts WHERE id = $1 FOR UPDATE',
            [concert_id]
        );
        if (concertRes.rows.length === 0) throw new Error('Концерт табылмады');
        if (concertRes.rows[0].available_seats < seats.length) throw new Error('Бос орындар жеткіліксіз!');

        const createdBookings = [];
        for (const s of seats) {
            const existing = await client.query(
                'SELECT id FROM bookings WHERE concert_id = $1 AND zone_name = $2 AND row_number = $3 AND seat_number = $4',
                [concert_id, s.zone, s.row, s.seat]
            );
            if (existing.rows.length > 0) {
                throw new Error(`${s.zone}: Қатар ${s.row}, Орын ${s.seat} бос емес!`);
            }

            const ticket_code = 'TKZ-' + Math.floor(100000 + Math.random() * 900000);
            const bRes = await client.query(
                `INSERT INTO bookings (ticket_code, user_id, concert_id, zone_name, row_number, seat_number, quantity, total_price)
                 VALUES ($1, $2, $3, $4, $5, $6, 1, $7) RETURNING *`,
                [ticket_code, user_id, concert_id, s.zone, s.row, s.seat, s.price]
            );
            createdBookings.push(bRes.rows[0]);
        }

        await client.query(
            'UPDATE concerts SET available_seats = available_seats - $1 WHERE id = $2',
            [seats.length, concert_id]
        );

        await client.query('COMMIT');
        res.json({ success: true, bookings: createdBookings });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 8. Профиль және Аналитика
app.get('/api/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'Пайдаланушы табылмады' });

        const ticketsRes = await pool.query(`
            SELECT b.*, c.title, c.artist, c.city, c.venue, c.event_date, c.concert_type, c.special_guests, c.image_url
            FROM bookings b
            JOIN concerts c ON b.concert_id = c.id
            WHERE b.user_id = $1
            ORDER BY b.booking_date DESC
        `, [userId]);

        const tickets = ticketsRes.rows;
        const totalSpent = tickets.reduce((sum, t) => sum + Number(t.total_price), 0);
        const totalTickets = tickets.reduce((sum, t) => sum + Number(t.quantity), 0);

        const cityCounts = {};
        tickets.forEach(t => { cityCounts[t.city] = (cityCounts[t.city] || 0) + 1; });
        const favoriteCity = Object.keys(cityCounts).sort((a, b) => cityCounts[b] - cityCounts[a])[0] || 'Әлі жоқ';

        res.json({
            user: userRes.rows[0],
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
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const bRes = await client.query('SELECT * FROM bookings WHERE id = $1', [id]);
        if (bRes.rows.length === 0) throw new Error('Билет табылмады');

        const booking = bRes.rows[0];
        await client.query('UPDATE concerts SET available_seats = available_seats + $1 WHERE id = $2', [booking.quantity, booking.concert_id]);
        await client.query('DELETE FROM bookings WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
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
        const statsRes = await pool.query(`
            SELECT 
                COALESCE(SUM(total_price), 0) AS total_revenue,
                COALESCE(SUM(quantity), 0) AS total_sold
            FROM bookings
        `);
        const usersCountRes = await pool.query('SELECT COUNT(*) AS count FROM users');
        const concertsRes = await pool.query('SELECT * FROM concerts ORDER BY event_date ASC');
        const bookingsRes = await pool.query(`
            SELECT b.*, u.full_name, u.email, u.phone, c.artist, c.title, c.city, c.venue, c.event_date
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            LEFT JOIN concerts c ON b.concert_id = c.id
            ORDER BY b.booking_date DESC
            LIMIT 100
        `);

        res.json({
            stats: {
                totalRevenue: Number(statsRes.rows[0].total_revenue),
                totalSold: Number(statsRes.rows[0].total_sold),
                totalUsers: Number(usersCountRes.rows[0].count),
                totalConcerts: concertsRes.rows.length
            },
            concerts: concertsRes.rows,
            bookings: bookingsRes.rows
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
        const result = await pool.query(
            `UPDATE concerts 
             SET title = $1, artist = $2, city = $3, venue = $4, price_balcony = $5, price_fanzone = $6, price_vip = $7, available_seats = $8
             WHERE id = $9 RETURNING *`,
            [title, artist, city, venue, price_balcony, price_fanzone, price_vip, available_seats, id]
        );
        res.json({ success: true, concert: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Концертті жаңарту қатесі' });
    }
});

// 13. Концертті өшіру
app.delete('/api/admin/concerts/:id', checkAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM concerts WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Концертті өшіру қатесі' });
    }
});

// 14. Билет кодын (TKZ-XXXXXX) тексеру және өткізу (Валидация)
app.post('/api/admin/verify-ticket', checkAdmin, async (req, res) => {
    const { ticket_code, markUsed } = req.body;
    if (!ticket_code) return res.status(400).json({ error: 'Билет кодын енгізіңіз!' });

    try {
        const cleanCode = ticket_code.trim().toUpperCase();
        const bRes = await pool.query(`
            SELECT b.*, u.full_name, u.phone, c.artist, c.title, c.city, c.venue, c.event_date
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            LEFT JOIN concerts c ON b.concert_id = c.id
            WHERE b.ticket_code = $1
        `, [cleanCode]);

        if (bRes.rows.length === 0) {
            return res.status(404).json({ valid: false, error: 'Мұндай кодты билет базадан табылмады!' });
        }

        let ticket = bRes.rows[0];
        if (markUsed && ticket.status !== 'Used') {
            const upd = await pool.query(
                "UPDATE bookings SET status = 'Used' WHERE id = $1 RETURNING *",
                [ticket.id]
            );
            ticket.status = upd.rows[0].status;
        }

        res.json({ valid: true, ticket });
    } catch (err) {
        res.status(500).json({ error: 'Тексеру қатесі' });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер іске қосылды: http://localhost:${PORT}`);
});