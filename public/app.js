let currentCity = 'Барлығы';
let currentUser = JSON.parse(localStorage.getItem('ticketkz_user')) || null;
let favorites = JSON.parse(localStorage.getItem('ticketkz_favs')) || [];
let adminPassword = localStorage.getItem('ticketkz_admin_pass') || null;
let allConcertsCache = [];
let activeTab = 'events';

let currentHallConcert = null;
let bookedSeatsSet = new Set();
let selectedSeats = [];
let currentZoom = 1;
let currentPhotoConcertId = null;

function isAdminLoggedIn() {
    return Boolean(localStorage.getItem('ticketkz_admin_pass'));
}

function formatEventDateTime(dateInput) {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return String(dateInput || '');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
}

document.addEventListener('DOMContentLoaded', () => {
    updateNavUserUI();
    loadConcerts();
    lucide.createIcons();
});

function updateNavUserUI() {
    const nameEl = document.getElementById('nav-user-name');
    if (currentUser) {
        nameEl.textContent = currentUser.full_name.split(' ')[0];
    } else {
        nameEl.textContent = 'Кіру / Профиль';
    }
}

function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('section-events').classList.add('hidden');
    document.getElementById('section-profile').classList.add('hidden');
    document.getElementById('section-admin').classList.add('hidden');

    if (tab === 'events' || tab === 'favorites') {
        document.getElementById(tab === 'events' ? 'nav-events' : 'nav-favorites').classList.add('active');
        document.getElementById('section-events').classList.remove('hidden');
        renderConcertsGrid();
    } else if (tab === 'profile') {
        document.getElementById('nav-profile').classList.add('active');
        document.getElementById('section-profile').classList.remove('hidden');
        loadUserProfile();
    } else if (tab === 'admin') {
        document.getElementById('nav-admin').classList.add('active');
        document.getElementById('section-admin').classList.remove('hidden');
        loadAdminDashboard();
    }
}

function openProfileOrAuth() {
    if (currentUser) switchTab('profile');
    else document.getElementById('auth-modal').classList.remove('hidden');
}

function openAdminOrLogin() {
    if (isAdminLoggedIn()) switchTab('admin');
    else document.getElementById('admin-login-modal').classList.remove('hidden');
}

function logoutUser() {
    localStorage.removeItem('ticketkz_user');
    currentUser = null;
    updateNavUserUI();
    switchTab('events');
}

function logoutAdmin() {
    localStorage.removeItem('ticketkz_admin_pass');
    adminPassword = null;
    switchTab('events');
    renderConcertsGrid();
}

// =========================================================================
// АДМИН КІРУ ЖӘНЕ БАСҚАРУ ПАНЕЛІ
// =========================================================================
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = document.getElementById('admin-pass-input').value.trim();
    const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
    });
    if (res.ok) {
        adminPassword = pass;
        localStorage.setItem('ticketkz_admin_pass', pass);
        closeModal('admin-login-modal');
        document.getElementById('admin-pass-input').value = '';
        renderConcertsGrid();
        switchTab('admin');
    } else {
        alert('Админ құпиясөзі қате!');
    }
});

async function loadAdminDashboard() {
    const pass = localStorage.getItem('ticketkz_admin_pass');
    if (!pass) return;
    const res = await fetch('/api/admin/dashboard', {
        headers: { 'x-admin-password': pass }
    });
    if (!res.ok) {
        logoutAdmin();
        return;
    }
    const data = await res.json();
    document.getElementById('adm-revenue').textContent = `${Number(data.stats.totalRevenue).toLocaleString()} ₸`;
    document.getElementById('adm-sold').textContent = `${data.stats.totalSold} дана`;
    document.getElementById('adm-concerts-count').textContent = data.stats.totalConcerts;
    document.getElementById('adm-users-count').textContent = data.stats.totalUsers;

    const cList = document.getElementById('admin-concerts-list');
    cList.innerHTML = data.concerts.map(c => `
        <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
                <strong style="color:#fff; font-size:1.05rem;">${c.title}</strong>
                <div style="color:#94a3b8; font-size:0.85rem; margin-top:4px;">
                    ${c.city} • ${c.venue} • Бос орын: <b style="color:#38bdf8;">${c.available_seats}</b> • Бағалар: ${Number(c.price_balcony).toLocaleString()} / ${Number(c.price_fanzone).toLocaleString()} / ${Number(c.price_vip).toLocaleString()} ₸
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <button onclick='openPhotoModal(${c.id}, ${JSON.stringify(c.artist)}, ${JSON.stringify(c.title)})' style="background:#0284c7; color:#fff; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:600;">Фото</button>
                <button onclick='openEditConcertModal(${JSON.stringify(c)})' style="background:#334155; color:#fff; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:600;">Өңдеу</button>
                <button onclick="deleteAdminConcert(${c.id})" style="background:#dc2626; color:#fff; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:600;">Өшіру</button>
            </div>
        </div>
    `).join('');

    const bList = document.getElementById('admin-bookings-list');
    bList.innerHTML = data.bookings.map(b => `
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
                <span style="background:#1e293b; color:#38bdf8; padding:3px 8px; border-radius:6px; font-family:monospace; font-weight:700;">${b.ticket_code}</span>
                <strong style="margin-left:8px;">${b.full_name || 'Қонақ'}</strong> — ${b.concert_title || (b.title + ' (' + b.city + ')')}
                <div style="color:#94a3b8; font-size:0.83rem; margin-top:3px;">
                    Аймақ: ${b.zone_name}, Қатар ${b.row_number}, Орын ${b.seat_number} • Сома: <b style="color:#22c55e;">${Number(b.total_price).toLocaleString()} ₸</b>
                </div>
            </div>
            <span style="padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:700; background:${b.status === 'Used' ? '#334155' : '#14532d'}; color:${b.status === 'Used' ? '#94a3b8' : '#4ade80'};">
                ${b.status}
            </span>
        </div>
    `).join('');
}

function openEditConcertModal(c) {
    document.getElementById('edit-c-id').value = c.id;
    document.getElementById('edit-c-artist').value = c.artist;
    document.getElementById('edit-c-title').value = c.title;
    document.getElementById('edit-c-city').value = c.city;
    document.getElementById('edit-c-seats').value = c.available_seats;
    document.getElementById('edit-c-venue').value = c.venue;
    document.getElementById('edit-c-bal').value = c.price_balcony;
    document.getElementById('edit-c-fan').value = c.price_fanzone;
    document.getElementById('edit-c-vip').value = c.price_vip;
    document.getElementById('edit-concert-modal').classList.remove('hidden');
}

document.getElementById('edit-concert-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-c-id').value;
    const payload = {
        artist: document.getElementById('edit-c-artist').value,
        title: document.getElementById('edit-c-title').value,
        city: document.getElementById('edit-c-city').value,
        available_seats: Number(document.getElementById('edit-c-seats').value),
        venue: document.getElementById('edit-c-venue').value,
        price_balcony: Number(document.getElementById('edit-c-bal').value),
        price_fanzone: Number(document.getElementById('edit-c-fan').value),
        price_vip: Number(document.getElementById('edit-c-vip').value)
    };
    const res = await fetch(`/api/admin/concerts/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-password': localStorage.getItem('ticketkz_admin_pass')
        },
        body: JSON.stringify(payload)
    });
    if (res.ok) {
        closeModal('edit-concert-modal');
        loadAdminDashboard();
        loadConcerts();
    } else {
        alert('Жаңарту қатесі!');
    }
});

async function deleteAdminConcert(id) {
    if (!confirm('Бұл концертті өшіруге сенімдісіз бе?')) return;
    const res = await fetch(`/api/admin/concerts/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': localStorage.getItem('ticketkz_admin_pass') }
    });
    if (res.ok) {
        loadAdminDashboard();
        loadConcerts();
    }
}

async function verifyTicketCode(markUsed) {
    const code = document.getElementById('verify-code-input').value.trim();
    if (!code) return alert('Билет кодын енгізіңіз!');
    const res = await fetch('/api/admin/verify-ticket', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-password': localStorage.getItem('ticketkz_admin_pass')
        },
        body: JSON.stringify({ ticket_code: code, markUsed })
    });
    const data = await res.json();
    const box = document.getElementById('verify-result-box');
    if (!res.ok || !data.valid) {
        box.innerHTML = `<div style="padding:12px; background:#450a0a; border:1px solid #dc2626; border-radius:10px; color:#fca5a5;">❌ ${data.error || 'Билет жарамсыз!'}</div>`;
        return;
    }
    const t = data.ticket;
    box.innerHTML = `
        <div style="padding:14px; background:#052e16; border:1px solid #16a34a; border-radius:10px; color:#bbf7d0;">
            ✅ <strong>Билет расталды!</strong> (${t.status})<br>
            Иесі: <b>${t.full_name || 'Қонақ'}</b> • Концерт: <b>${t.title}</b> (${t.city})<br>
            Орын: <b>${t.zone_name}, Қатар ${t.row_number}, Орын ${t.seat_number}</b>
        </div>
    `;
    if (markUsed) loadAdminDashboard();
}

// =========================================================================
// КОНЦЕРТТЕРДІ ЖҮКТЕУ ЖӘНЕ КАРТОЧКАЛАРДЫ ШЫҒАРУ
// =========================================================================
function filterCity(city, btn) {
    currentCity = city;
    document.querySelectorAll('.city-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadConcerts();
}

async function loadConcerts() {
    const search = document.getElementById('search-input').value.trim();
    const params = new URLSearchParams();
    if (currentCity !== 'Барлығы') params.append('city', currentCity);
    if (search) params.append('search', search);

    const res = await fetch(`/api/concerts?${params.toString()}`);
    allConcertsCache = await res.json();
    renderConcertsGrid();
}

function renderConcertsGrid() {
    const grid = document.getElementById('concerts-grid');
    let list = allConcertsCache;
    if (activeTab === 'favorites') {
        list = list.filter(c => favorites.includes(c.id));
    }

    if (list.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#94a3b8; padding:40px;">Концерттер табылмады.</p>`;
        return;
    }

    const adminActive = isAdminLoggedIn();

    grid.innerHTML = list.map(c => {
        const isFav = favorites.includes(c.id);
        const dateStr = formatEventDateTime(c.event_date);

        const photoEditBtnHtml = adminActive
            ? `<button class="card-icon-btn" onclick='openPhotoModal(${c.id}, ${JSON.stringify(c.artist)}, ${JSON.stringify(c.title)})' title="Суретті ауыстыру (Админ)">
                   <i data-lucide="image"></i>
               </button>`
            : '';

        return `
            <div class="card">
                <div class="card-img-wrap">
                    <span class="badge-type">${c.concert_type}</span>
                    <div class="card-actions-top">
                        ${photoEditBtnHtml}
                        <button class="card-icon-btn ${isFav ? 'fav-active' : ''}" onclick="toggleFavorite(${c.id})" title="Таңдаулыларға қосу">
                            <i data-lucide="heart"></i>
                        </button>
                    </div>
                    <img src="${c.image_url}" alt="${c.artist}" onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=600&h=800&q=80'">
                </div>
                <div class="card-body">
                    <div class="card-city"><i data-lucide="map-pin"></i> ${c.city} • ${dateStr}</div>
                    <h3 class="card-title">${c.title}</h3>
                    <p class="card-venue">${c.venue}</p>
                    <div class="card-footer">
                        <div>
                            <small>Бағасы:</small>
                            <strong>${Number(c.price_balcony).toLocaleString()} ₸ бастап</strong>
                        </div>
                        <button class="buy-btn" onclick="openHallModal(${c.id})">Билет алу</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function toggleFavorite(id) {
    if (favorites.includes(id)) favorites = favorites.filter(f => f !== id);
    else favorites.push(id);
    localStorage.setItem('ticketkz_favs', JSON.stringify(favorites));
    renderConcertsGrid();
}

async function syncRealConcertsFromAPI() {
    const input = document.getElementById('api-artist-input');
    const artistQuery = input.value.trim();
    if (!artistQuery) return alert('Әртіс атын енгізіңіз!');
    const btn = document.getElementById('sync-api-btn');
    btn.disabled = true;
    btn.textContent = 'Жүктелуде...';
    try {
        const res = await fetch('/api/sync-real-concerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artistQuery })
        });
        const data = await res.json();
        if (res.ok) {
            alert(`${data.count} жаңа концерт қосылды!`);
            input.value = '';
            loadConcerts();
        } else {
            alert(data.error || 'Қате!');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="globe"></i> API Билеттер Қосу';
        lucide.createIcons();
    }
}

// =========================================================================
// ФОТО АУЫСТЫРУ МОДАЛІ (ТЕК АДМИНГЕ АРНАЛҒАН)
// =========================================================================
function openPhotoModal(concertId, artist, title) {
    if (!isAdminLoggedIn()) {
        alert('Суретті ауыстыру үшін алдымен Админ аккаунтпен кіріңіз!');
        openAdminOrLogin();
        return;
    }
    currentPhotoConcertId = concertId;
    document.getElementById('photo-modal-subtitle').textContent = `${title}`;
    document.getElementById('itunes-search-query').value = artist;
    document.getElementById('new-photo-url').value = '';
    document.getElementById('photo-preview-box').classList.add('hidden');
    document.getElementById('photo-modal').classList.remove('hidden');
    searchArtistImagesAPI();
}

async function searchArtistImagesAPI() {
    const q = document.getElementById('itunes-search-query').value.trim();
    if (!q) return;
    const grid = document.getElementById('api-photos-grid');
    grid.innerHTML = '<small style="grid-column:1/-1; color:#94a3b8;">Ізделуде...</small>';
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&country=kz&media=music&limit=4`);
    const data = await res.json();
    const results = data.results || [];
    if (results.length === 0) {
        grid.innerHTML = '<small style="grid-column:1/-1; color:#f87171;">Сурет табылмады</small>';
        return;
    }
    grid.innerHTML = results.map(item => {
        const hdUrl = item.artworkUrl100.replace('100x100bb', '600x800bb');
        return `<img src="${hdUrl}" onclick="selectApiPhoto('${hdUrl}')" style="width:100%; height:95px; object-fit:cover; border-radius:8px; cursor:pointer; border:2px solid transparent;" onmouseover="this.style.borderColor='#38bdf8'" onmouseout="this.style.borderColor='transparent'">`;
    }).join('');
}

function selectApiPhoto(url) {
    document.getElementById('new-photo-url').value = url;
    previewNewPhoto(url);
}

function setRandomConcertApiUrl() {
    const samples = [
        'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&h=800&q=80',
        'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=600&h=800&q=80',
        'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=600&h=800&q=80',
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&h=800&q=80',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&h=800&q=80'
    ];
    const rand = samples[Math.floor(Math.random() * samples.length)];
    selectApiPhoto(rand);
}

function previewNewPhoto(url) {
    const box = document.getElementById('photo-preview-box');
    const img = document.getElementById('photo-preview-img');
    if (url) {
        img.src = url;
        box.classList.remove('hidden');
    } else {
        box.classList.add('hidden');
    }
}

document.getElementById('photo-url-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = localStorage.getItem('ticketkz_admin_pass');
    if (!pass) {
        alert('Суретті тек Админ аккаунтпен кірген соң ғана ауыстыруға болады!');
        return;
    }
    const imageUrl = document.getElementById('new-photo-url').value.trim();
    const res = await fetch(`/api/concerts/${currentPhotoConcertId}/image`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-password': pass
        },
        body: JSON.stringify({ image_url: imageUrl })
    });
    const data = await res.json();
    if (res.ok) {
        closeModal('photo-modal');
        loadConcerts();
        if (activeTab === 'admin') loadAdminDashboard();
    } else {
        alert(data.error || 'Суретті жаңарту қатесі');
    }
});

// =========================================================================
// ЖАҢА КОНЦЕРТ ҚОСУ ЖӘНЕ ПРОФИЛЬГЕ КІРУ
// =========================================================================
document.getElementById('add-concert-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        artist: document.getElementById('new-c-artist').value.trim(),
        title: document.getElementById('new-c-title').value.trim(),
        city: document.getElementById('new-c-city').value,
        event_date: document.getElementById('new-c-date').value,
        venue: document.getElementById('new-c-venue').value.trim(),
        price_balcony: Number(document.getElementById('new-c-bal').value),
        price_fanzone: Number(document.getElementById('new-c-fan').value),
        price_vip: Number(document.getElementById('new-c-vip').value),
        image_url: document.getElementById('new-c-img').value.trim()
    };
    const res = await fetch('/api/concerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (res.ok) {
        closeModal('add-concert-modal');
        e.target.reset();
        loadConcerts();
    } else {
        alert('Концертті қосу қатесі');
    }
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        full_name: document.getElementById('auth-name').value.trim(),
        email: document.getElementById('auth-email').value.trim(),
        phone: document.getElementById('auth-phone').value.trim(),
        city: document.getElementById('auth-city').value
    };
    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const user = await res.json();
    if (res.ok) {
        currentUser = user;
        localStorage.setItem('ticketkz_user', JSON.stringify(user));
        updateNavUserUI();
        closeModal('auth-modal');
        switchTab('profile');
    } else {
        alert(user.error || 'Кіру қатесі');
    }
});

// =========================================================================
// ЗАЛ СХЕМАСЫ (ТҮРЛІ-ТҮСТІ ДИЗАЙН), ОРЫН ТАҢДАУ ЖӘНЕ ТӨЛЕМ ЖАСАУ
// =========================================================================
async function openHallModal(concertId) {
    currentHallConcert = allConcertsCache.find(c => c.id === concertId);
    if (!currentHallConcert) return;

    selectedSeats = [];
    currentZoom = 1;
    document.getElementById('modal-title').textContent = `${currentHallConcert.title}`;
    document.getElementById('modal-venue-info').textContent = `${currentHallConcert.city} • ${currentHallConcert.venue}`;

    document.getElementById('price-legend').innerHTML = `
        <span class="leg-item"><i style="background:linear-gradient(135deg,#06b6d4,#10b981);"></i> Балкон (${Number(currentHallConcert.price_balcony).toLocaleString()} ₸)</span>
        <span class="leg-item"><i style="background:linear-gradient(135deg,#a855f7,#6366f1);"></i> Арена Партер (${Number(currentHallConcert.price_fanzone).toLocaleString()} ₸)</span>
        <span class="leg-item"><i style="background:linear-gradient(135deg,#f59e0b,#ea580c);"></i> VIP Партер (${Number(currentHallConcert.price_vip).toLocaleString()} ₸)</span>
        <span class="leg-item"><i style="background:linear-gradient(135deg,#16a34a,#22c55e);"></i> Таңдалған</span>
        <span class="leg-item"><i style="background:#cbd5e1;"></i> Бос емес</span>
    `;

    const res = await fetch(`/api/concerts/${concertId}/booked-seats`);
    const booked = await res.json();
    bookedSeatsSet = new Set(booked.map(b => `${b.zone_name}-${b.row_number}-${b.seat_number}`));

    renderHallCanvas();
    updateCartUI();
    document.getElementById('booking-modal').classList.remove('hidden');
}

function renderHallCanvas() {
    const canvas = document.getElementById('hall-canvas');
    canvas.style.transform = `scale(${currentZoom})`;
    canvas.style.transformOrigin = 'top center';

    const zones = [
        {
            name: 'Партер',
            price: Number(currentHallConcert.price_vip),
            color: '#f59e0b',
            bg: 'linear-gradient(135deg, #f59e0b, #ea580c)',
            softBg: 'rgba(245, 158, 11, 0.14)',
            rows: 3,
            cols: 16
        },
        {
            name: 'Арена Партер',
            price: Number(currentHallConcert.price_fanzone),
            color: '#a855f7',
            bg: 'linear-gradient(135deg, #a855f7, #6366f1)',
            softBg: 'rgba(168, 85, 247, 0.14)',
            rows: 6,
            cols: 18
        },
        {
            name: 'Балкон',
            price: Number(currentHallConcert.price_balcony),
            color: '#06b6d4',
            bg: 'linear-gradient(135deg, #06b6d4, #10b981)',
            softBg: 'rgba(6, 182, 212, 0.14)',
            rows: 4,
            cols: 20
        }
    ];

    let html = `<div class="stage-bar">САХНА / STAGE</div>`;
    for (const z of zones) {
        html += `
            <div class="zone-block" style="background: ${z.softBg}; border: 1px solid ${z.color}55;">
                <div class="zone-label" style="color: ${z.color};">${z.name} — ${z.price.toLocaleString()} ₸</div>
        `;
        for (let r = 1; r <= z.rows; r++) {
            html += `<div class="seat-row"><span class="row-num">${r}</span>`;
            for (let s = 1; s <= z.cols; s++) {
                const key = `${z.name}-${r}-${s}`;
                const isBooked = bookedSeatsSet.has(key);
                const isSel = selectedSeats.some(item => item.key === key);

                let seatStyle = `background: ${z.bg}; color: #ffffff; border: 2px solid ${z.color};`;
                if (isBooked) {
                    seatStyle = `background: #cbd5e1; color: #64748b; border: 2px solid #94a3b8; cursor: not-allowed; opacity: 0.65;`;
                } else if (isSel) {
                    seatStyle = `background: linear-gradient(135deg, #16a34a, #22c55e); color: #ffffff; border: 2px solid #14532d; transform: scale(1.15); box-shadow: 0 0 10px rgba(34, 197, 94, 0.75);`;
                }

                html += `
                    <button type="button"
                        class="seat-dot ${isBooked ? 'booked' : ''} ${isSel ? 'selected' : ''}"
                        style="${seatStyle}"
                        ${isBooked ? 'disabled' : `onclick="toggleSeat('${z.name}', ${r}, ${s}, ${z.price})"`}
                        title="${z.name}, Қатар ${r}, Орын ${s} — ${z.price.toLocaleString()} ₸">
                        ${s}
                    </button>
                `;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }
    canvas.innerHTML = html;
}

function zoomHall(delta) {
    currentZoom = Math.min(1.5, Math.max(0.7, currentZoom + delta));
    document.getElementById('hall-canvas').style.transform = `scale(${currentZoom})`;
}

function toggleSeat(zone, row, seat, price) {
    const key = `${zone}-${row}-${seat}`;
    const idx = selectedSeats.findIndex(s => s.key === key);
    if (idx >= 0) selectedSeats.splice(idx, 1);
    else selectedSeats.push({ key, zone, row, seat, price });
    renderHallCanvas();
    updateCartUI();
}

function updateCartUI() {
    const chips = document.getElementById('selected-seats-chips');
    const countEl = document.getElementById('cart-count');
    const totalEl = document.getElementById('total-price');

    countEl.textContent = selectedSeats.length;
    const total = selectedSeats.reduce((sum, s) => sum + s.price, 0);
    totalEl.textContent = total.toLocaleString();

    if (selectedSeats.length === 0) {
        chips.innerHTML = `<span style="color:#94a3b8; font-size:0.9rem;">Схемадан бос орындарды басып таңдаңыз...</span>`;
    } else {
        chips.innerHTML = selectedSeats.map(s => `
            <span class="seat-chip">${s.zone} • Қ:${s.row} О:${s.seat} (${s.price.toLocaleString()} ₸)</span>
        `).join('');
    }
}

function confirmSeatBooking() {
    if (selectedSeats.length === 0) return alert('Кем дегенде 1 орын таңдаңыз!');
    if (!currentUser) {
        closeModal('booking-modal');
        document.getElementById('auth-modal').classList.remove('hidden');
        return;
    }
    const total = selectedSeats.reduce((sum, s) => sum + s.price, 0);
    document.getElementById('pay-modal-amount').textContent = total.toLocaleString();
    closeModal('booking-modal');
    document.getElementById('payment-modal').classList.remove('hidden');
}

function formatCardNumber(el) {
    let v = el.value.replace(/\D/g, '').substring(0, 16);
    el.value = v.replace(/(.{4})/g, '$1 ').trim();
    document.getElementById('card-num-preview').textContent = el.value || '•••• •••• •••• ••••';
}

function formatCardExp(el) {
    let v = el.value.replace(/\D/g, '').substring(0, 4);
    if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
    el.value = v;
    document.getElementById('card-exp-preview').textContent = v || 'MM/YY';
}

document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('pay-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Төлем өңделуде...';

    try {
        const res = await fetch('/api/book-seats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                concert_id: currentHallConcert.id,
                seats: selectedSeats
            })
        });
        const data = await res.json();
        if (res.ok) {
            closeModal('payment-modal');
            selectedSeats = [];
            loadConcerts();
            switchTab('profile');
        } else {
            alert(data.error || 'Брондау қатесі!');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="lock"></i> Төлемді растау';
        lucide.createIcons();
    }
});

// =========================================================================
// ПАЙДАЛАНУШЫ ПРОФИЛІ, ЭЛЕКТРОНДЫ БИЛЕТ ЖӘНЕ ТАЗА PDF ЖҮКТЕУ
// =========================================================================
async function loadUserProfile() {
    if (!currentUser) return;
    const res = await fetch(`/api/profile/${currentUser.id}`);
    if (!res.ok) {
        logoutUser();
        return;
    }
    const data = await res.json();
    document.getElementById('prof-avatar').textContent = data.user.full_name.charAt(0).toUpperCase();
    document.getElementById('prof-name').textContent = data.user.full_name;
    document.getElementById('prof-meta').textContent = `${data.user.email} • ${data.user.city}`;

    document.getElementById('stat-spent').textContent = `${Number(data.analytics.totalSpent).toLocaleString()} ₸`;
    document.getElementById('stat-tickets').textContent = `${data.analytics.totalTickets} дана`;
    document.getElementById('stat-events').textContent = `${data.analytics.eventsCount} концерт`;
    document.getElementById('stat-city').textContent = data.analytics.favoriteCity;

    const list = document.getElementById('my-tickets-list');
    if (data.tickets.length === 0) {
        list.innerHTML = `<p style="color:#94a3b8;">Әзірге сатып алынған билеттер жоқ.</p>`;
        return;
    }

    list.innerHTML = data.tickets.map(t => {
        const dt = formatEventDateTime(t.event_date);
        return `
            <div class="ticket-item" id="ticket-card-${t.id}">
                <div class="ticket-left">
                    <span class="ticket-code-badge">${t.ticket_code}</span>
                    <h4>${t.title}</h4>
                    <p>${t.city} • ${t.venue} • ${dt}</p>
                    <div class="ticket-seat-info">Аймақ: <b>${t.zone_name}</b> • Қатар: <b>${t.row_number}</b> • Орын: <b>${t.seat_number}</b> • Бағасы: <b>${Number(t.total_price).toLocaleString()} ₸</b></div>
                </div>
                <div class="ticket-right">
                    <div id="qr-${t.id}" class="qr-box"></div>
                    <div class="ticket-btns">
                        <button class="pdf-btn" onclick="downloadTicketPDF(${t.id}, '${t.ticket_code}')">PDF жүктеу</button>
                        <button class="cancel-btn" onclick="cancelBooking(${t.id})">Қайтару</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    data.tickets.forEach(t => {
        const qrEl = document.getElementById(`qr-${t.id}`);
        if (qrEl) {
            new QRCode(qrEl, { text: t.ticket_code, width: 76, height: 76 });
        }
    });
}

function downloadTicketPDF(id, code) {
    const cardEl = document.getElementById(`ticket-card-${id}`);
    if (!cardEl) return;

    const badge = cardEl.querySelector('.ticket-code-badge')?.textContent?.trim() || code;
    const title = cardEl.querySelector('h4')?.textContent?.trim() || 'Концерт билеті';
    const meta = cardEl.querySelector('.ticket-left p')?.textContent?.trim() || '';
    const seatInfo = cardEl.querySelector('.ticket-seat-info')?.textContent?.trim() || '';
    const holderName = currentUser?.full_name || 'Көрермен';

    const sandbox = document.getElementById('pdf-render-sandbox');
    sandbox.innerHTML = `
        <div id="clean-pdf-ticket" style="
            width: 720px;
            background: #ffffff;
            color: #0f172a;
            border: 2px solid #0f172a;
            border-radius: 16px;
            overflow: hidden;
            font-family: 'Segoe UI', sans-serif;
            box-sizing: border-box;
        ">
            <div style="
                background: linear-gradient(135deg, #0f172a, #1e3a8a);
                color: #ffffff;
                padding: 18px 24px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div style="font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">
                    Ticket<span style="color: #38bdf8;">KZ</span> — Электронды билет
                </div>
                <div style="
                    background: #38bdf8;
                    color: #0f172a;
                    padding: 6px 14px;
                    border-radius: 8px;
                    font-family: monospace;
                    font-weight: 800;
                    font-size: 15px;
                ">${badge}</div>
            </div>

            <div style="padding: 22px 24px; display: flex; justify-content: space-between; gap: 20px; align-items: center;">
                <div style="flex: 1;">
                    <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Іс-шара</div>
                    <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 4px 0 12px;">${title}</div>

                    <div style="font-size: 13px; color: #334155; margin-bottom: 8px;">${meta}</div>
                    <div style="font-size: 14px; font-weight: 700; color: #0284c7; margin-bottom: 10px;">${seatInfo}</div>
                    <div style="font-size: 13px; color: #475569;">Сатып алушы: <strong>${holderName}</strong></div>
                </div>

                <div style="
                    border-left: 2px dashed #cbd5e1;
                    padding-left: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                ">
                    <div id="pdf-qr-target"></div>
                    <svg id="pdf-barcode-target"></svg>
                </div>
            </div>

            <div style="
                background: #f1f5f9;
                padding: 10px 24px;
                font-size: 12px;
                color: #475569;
                display: flex;
                justify-content: space-between;
                border-top: 1px solid #e2e8f0;
            ">
                <span>Кіру кезінде QR немесе штрих-кодты көрсетіңіз</span>
                <span>magzhann-sqly.onrender.com</span>
            </div>
        </div>
    `;

    new QRCode(document.getElementById('pdf-qr-target'), {
        text: badge,
        width: 100,
        height: 100
    });

    if (window.JsBarcode) {
        JsBarcode('#pdf-barcode-target', badge.replace(/[^A-Za-z0-9-]/g, ''), {
            format: 'CODE128',
            width: 1.5,
            height: 36,
            displayValue: true,
            fontSize: 11,
            margin: 2
        });
    }

    const pdfTarget = document.getElementById('clean-pdf-ticket');
    html2pdf()
        .set({
            margin: 10,
            filename: `${badge}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(pdfTarget)
        .save()
        .then(() => {
            sandbox.innerHTML = '';
        });
}

async function cancelBooking(id) {
    if (!confirm('Билетті қайтаруға сенімдісіз бе?')) return;
    const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
    if (res.ok) {
        loadUserProfile();
        loadConcerts();
    }
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}