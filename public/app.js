let selectedCity = 'Барлығы';
let currentConcert = null;
let currentUser = JSON.parse(localStorage.getItem('ticketkz_user')) || null;
let favorites = JSON.parse(localStorage.getItem('ticketkz_favs')) || [];
let showingFavoritesOnly = false;
let adminPassword = sessionStorage.getItem('ticketkz_admin_pass') || null;
let cachedUserTickets = [];

let hallScale = 1;
let selectedSeatsList = [];
let bookedSeatsSet = new Set();
let editingConcertId = null;

// 1. Бет жүктелгенде
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    updateNavUser();
    loadConcerts();
});

function updateNavUser() {
    const label = document.getElementById('nav-user-name');
    label.textContent = currentUser ? currentUser.full_name.split(' ')[0] : 'Кіру / Профиль';
}

// 2. Қала бойынша сүзгілеу
function filterCity(city, btn) {
    selectedCity = city;
    showingFavoritesOnly = false;
    document.querySelectorAll('.city-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadConcerts();
}

// 3. Концерттерді жүктеу
async function loadConcerts() {
    const search = document.getElementById('search-input').value;
    const params = new URLSearchParams({ city: selectedCity, search });
    const res = await fetch(`/api/concerts?${params}`);
    let concerts = await res.json();

    if (showingFavoritesOnly) {
        concerts = concerts.filter(c => favorites.includes(c.id));
    }

    const grid = document.getElementById('concerts-grid');
    if (concerts.length === 0) {
        grid.innerHTML = '<p style="color:#94a3b8">Сұраныс бойынша концерттер табылмады.</p>';
        return;
    }

    grid.innerHTML = concerts.map(c => {
        const isFav = favorites.includes(c.id);
        const concertJson = JSON.stringify(c).replace(/'/g, "&#39;");
        const safeTitle = `${c.artist} — ${c.title}`.replace(/'/g, "\\'");
        const safeArtist = (c.artist || '').replace(/'/g, "\\'");
        const safeUrl = (c.image_url || '').replace(/'/g, "\\'");

        const vLower = (c.venue || '').toLowerCase();
        const isStadium = vLower.includes('стадион') || vLower.includes('мұнайшы') || vLower.includes('амфитеатр') || vLower.includes('астана арена') || vLower.includes('түркістан арена');
        const isArena = !isStadium && (vLower.includes('арена') || vLower.includes('спорт') || vLower.includes('мұз'));
        const tierSubLabel = isStadium ? 'Трибуна / Фан-алаң / VIP' : (isArena ? 'Жоғарғы ярус / Фан-зона / VIP' : 'Балкон / Партер / VIP');

        return `
        <div class="card">
            <div class="card-img-wrap">
                <img src="${c.image_url}" alt="${c.title}">
                <span class="badge-type">${c.concert_type}</span>
                <button class="icon-action-btn" style="right: 52px;" title="API арқылы фото ауыстыру" onclick="openPhotoModal(${c.id}, '${safeTitle}', '${safeArtist}', '${safeUrl}')">
                    <i data-lucide="image"></i>
                </button>
                <button class="icon-action-btn ${isFav ? 'fav-active' : ''}" onclick="toggleFavorite(${c.id})">
                    <i data-lucide="heart" ${isFav ? 'style="fill:#f43f5e"' : ''}></i>
                </button>
            </div>
            <div class="card-body">
                <h3>${c.title}</h3>
                <div class="artist">${c.artist}</div>
                <div class="guests-box"><i data-lucide="sparkles" style="color:#f59e0b"></i> <b>Кеш қонақтары:</b> ${c.special_guests || 'Жоқ'}</div>
                <p class="info"><i data-lucide="map-pin"></i> <b>Қала:</b> ${c.city} — ${c.venue}</p>
                <p class="info"><i data-lucide="calendar"></i> <b>Уақыты:</b> ${new Date(c.event_date).toLocaleString('kk-KZ', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                <p class="info"><i data-lucide="armchair"></i> <b>Қалған билет:</b> ${c.available_seats} орын</p>
                <div class="card-footer">
                    <div class="price-range">
                        ${Number(c.price_balcony).toLocaleString()} – ${Number(c.price_vip).toLocaleString()} ₸
                        <small>${tierSubLabel}</small>
                    </div>
                    <button class="buy-btn" onclick='openBookingModal(${concertJson})'>
                        <i data-lucide="ticket"></i> Орын таңдау
                    </button>
                </div>
            </div>
        </div>
    `}).join('');

    lucide.createIcons();
}

function toggleFavorite(id) {
    if (favorites.includes(id)) {
        favorites = favorites.filter(f => f !== id);
    } else {
        favorites.push(id);
    }
    localStorage.setItem('ticketkz_favs', JSON.stringify(favorites));
    loadConcerts();
}

function switchTab(tab) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('section-events').classList.add('hidden');
    document.getElementById('section-profile').classList.add('hidden');
    document.getElementById('section-admin').classList.add('hidden');

    if (tab === 'events') {
        showingFavoritesOnly = false;
        document.getElementById('nav-events').classList.add('active');
        document.getElementById('section-events').classList.remove('hidden');
        loadConcerts();
    } else if (tab === 'favorites') {
        showingFavoritesOnly = true;
        document.getElementById('nav-favorites').classList.add('active');
        document.getElementById('section-events').classList.remove('hidden');
        loadConcerts();
    } else if (tab === 'profile') {
        document.getElementById('nav-profile').classList.add('active');
        document.getElementById('section-profile').classList.remove('hidden');
        loadProfileData();
    } else if (tab === 'admin') {
        document.getElementById('nav-admin').classList.add('active');
        document.getElementById('section-admin').classList.remove('hidden');
        loadAdminDashboard();
    }
}

function openProfileOrAuth() {
    if (!currentUser) {
        document.getElementById('auth-modal').classList.remove('hidden');
    } else {
        switchTab('profile');
    }
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        full_name: document.getElementById('auth-name').value,
        email: document.getElementById('auth-email').value,
        phone: document.getElementById('auth-phone').value,
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
        updateNavUser();
        closeModal('auth-modal');
        switchTab('profile');
    } else {
        alert(user.error);
    }
});

function logoutUser() {
    localStorage.removeItem('ticketkz_user');
    currentUser = null;
    updateNavUser();
    switchTab('events');
}

// 6. НАҚТЫ СТАДИОН / МҰЗ АРЕНАСЫ / КОНЦЕРТ САРАЙЫНЫҢ СХЕМАЛАРЫ
function zoomHall(delta) {
    hallScale = Math.min(1.6, Math.max(0.65, hallScale + delta));
    document.getElementById('hall-canvas').style.transform = `scale(${hallScale})`;
}

function detectVenueArchitecture(venueName) {
    const v = venueName.toLowerCase();
    if (v.includes('стадион') || v.includes('мұнайшы') || v.includes('амфитеатр') || v.includes('астана арена') || v.includes('түркістан арена')) {
        return 'STADIUM';
    }
    if (v.includes('арена') || v.includes('спорт') || v.includes('мұз')) {
        return 'ARENA';
    }
    return 'HALL';
}

async function openBookingModal(concert) {
    if (!currentUser) {
        alert('Билет сатып алу және оны профильде сақтау үшін алдымен профильге кіріңіз!');
        openProfileOrAuth();
        return;
    }

    currentConcert = concert;
    selectedSeatsList = [];
    hallScale = 1;
    const canvas = document.getElementById('hall-canvas');
    canvas.style.transform = 'scale(1)';

    const cleanVenueName = concert.venue.split('(')[0].trim();
    const archType = detectVenueArchitecture(concert.venue);

    document.getElementById('modal-title').textContent = `${cleanVenueName} — Орындар схемасы`;
    document.getElementById('modal-venue-info').textContent = `${concert.artist} (${concert.title}) • ${concert.city}, ${concert.venue}`;

    const pVip = Number(concert.price_vip);
    const pFan = Number(concert.price_fanzone);
    const pBal = Number(concert.price_balcony);
    const pMid = Math.round((pFan + pBal) / 2);

    const res = await fetch(`/api/concerts/${concert.id}/booked-seats`);
    const booked = await res.json();
    bookedSeatsSet = new Set(booked.map(b => `${b.zone_name}|${b.row_number}|${b.seat_number}`));

    if (archType === 'STADIUM') {
        document.getElementById('price-legend').innerHTML = `
            <div class="legend-item"><span class="legend-dot" style="background:#f43f5e"></span> VIP Партер (Сахна алды): ${pVip.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#10b981"></span> Алаң / Фан-зона: ${pFan.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#0ea5e9"></span> Батыс / Шығыс трибуна: ${pMid.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#ea580c"></span> Оңтүстік трибуна (Жоғарғы): ${pBal.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#cbd5e1"></span> Сатылып кеткен</div>
        `;

        canvas.innerHTML = `
            <div class="venue-arch-banner">🏟️ ${cleanVenueName.toUpperCase()} (АШЫҚ СТАДИОН СХЕМАСЫ — БАЛКОН ЖОҚ)</div>
            <div class="stadium-bowl">
                <div class="hall-stage">САХНА / STAGE</div>
                <div class="hall-upper-row">
                    <div class="hall-sector">
                        <div class="sector-label">Батыс трибуна (Сектор W)</div>
                        <div id="sec-west" class="seats-block"></div>
                    </div>
                    <div class="hall-sector stadium-field-box">
                        <div class="sector-label" style="color:#047857;">Орталық Алаң (VIP & Фан-зона)</div>
                        <div id="sec-field" class="seats-block"></div>
                    </div>
                    <div class="hall-sector">
                        <div class="sector-label">Шығыс трибуна (Сектор E)</div>
                        <div id="sec-east" class="seats-block"></div>
                    </div>
                </div>
                <div class="hall-sector wide-sector">
                    <div class="sector-label">Оңтүстік трибуна (Жоғарғы секторлар S1 – S4)</div>
                    <div id="sec-south" class="seats-block"></div>
                </div>
            </div>
        `;

        renderSector('sec-west', 'Батыс трибуна', 8, 7, () => ({ price: pMid, color: '#0ea5e9' }));
        renderSector('sec-field', 'Алаң (VIP / Фан-зона)', 11, 20, (r) => r <= 4 ? { price: pVip, color: '#f43f5e' } : { price: pFan, color: '#10b981' });
        renderSector('sec-east', 'Шығыс трибуна', 8, 7, () => ({ price: pMid, color: '#0ea5e9' }));
        renderSector('sec-south', 'Оңтүстік трибуна', 6, 28, () => ({ price: pBal, color: '#ea580c' }));
    } else if (archType === 'ARENA') {
        document.getElementById('price-legend').innerHTML = `
            <div class="legend-item"><span class="legend-dot" style="background:#f43f5e"></span> VIP Партер: ${pVip.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#0ea5e9"></span> Арена Фан-зона: ${pFan.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#8b5cf6"></span> Сектор A / B (Төменгі ярус): ${pMid.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#ea580c"></span> Сектор C (Жоғарғы ярус): ${pBal.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#cbd5e1"></span> Сатылып кеткен</div>
        `;

        canvas.innerHTML = `
            <div class="venue-arch-banner">🏒 ${cleanVenueName.toUpperCase()} (СПОРТ-КОНЦЕРТ АРЕНАСЫ)</div>
            <div class="hall-stage">САХНА / СЦЕНА</div>
            <div class="hall-upper-row">
                <div class="hall-sector">
                    <div class="sector-label">Сектор A (Сол қанат)</div>
                    <div id="sec-arena-a" class="seats-block"></div>
                </div>
                <div class="hall-sector">
                    <div class="sector-label">Арена Партер & Фан-зона</div>
                    <div id="sec-arena-center" class="seats-block"></div>
                </div>
                <div class="hall-sector">
                    <div class="sector-label">Сектор B (Оң қанат)</div>
                    <div id="sec-arena-b" class="seats-block"></div>
                </div>
            </div>
            <div class="hall-sector wide-sector">
                <div class="sector-label">Сектор C (Жоғарғы ярус трибунасы)</div>
                <div id="sec-arena-c" class="seats-block"></div>
            </div>
        `;

        renderSector('sec-arena-a', 'Сектор A', 7, 7, () => ({ price: pMid, color: '#8b5cf6' }));
        renderSector('sec-arena-center', 'Арена Партер', 12, 22, (r) => r <= 5 ? { price: pVip, color: '#f43f5e' } : { price: pFan, color: '#0ea5e9' });
        renderSector('sec-arena-b', 'Сектор B', 7, 7, () => ({ price: pMid, color: '#8b5cf6' }));
        renderSector('sec-arena-c', 'Сектор C (Жоғарғы ярус)', 7, 28, () => ({ price: pBal, color: '#ea580c' }));
    } else {
        document.getElementById('price-legend').innerHTML = `
            <div class="legend-item"><span class="legend-dot" style="background:#f43f5e"></span> VIP Партер: ${pVip.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#0ea5e9"></span> Партер / Амфитеатр: ${pFan.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#a855f7"></span> Балкон (Алдыңғы қатарлар): ${pMid.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#ea580c"></span> Балкон (Жоғарғы қатарлар): ${pBal.toLocaleString()} ₸</div>
            <div class="legend-item"><span class="legend-dot" style="background:#cbd5e1"></span> Сатылып кеткен</div>
        `;

        canvas.innerHTML = `
            <div class="venue-arch-banner">🎭 ${cleanVenueName.toUpperCase()} (КОНЦЕРТ ЗАЛЫ)</div>
            <div class="hall-stage">САХНА / СЦЕНА</div>
            <div class="hall-upper-row">
                <div class="hall-sector">
                    <div class="sector-label">Амфитеатр А</div>
                    <div id="sector-amp-left" class="seats-block"></div>
                </div>
                <div class="hall-sector">
                    <div class="sector-label">Партер</div>
                    <div id="sector-parterre" class="seats-block"></div>
                </div>
                <div class="hall-sector">
                    <div class="sector-label">Амфитеатр Б</div>
                    <div id="sector-amp-right" class="seats-block"></div>
                </div>
            </div>
            <div class="hall-sector wide-sector">
                <div class="sector-label">Балкон</div>
                <div id="sector-balcony" class="seats-block"></div>
            </div>
        `;

        renderSector('sector-amp-left', 'Амфитеатр А', 7, 7, () => ({ price: pFan, color: '#0ea5e9' }));
        renderSector('sector-parterre', 'Партер', 12, 22, (r) => r <= 5 ? { price: pVip, color: '#f43f5e' } : { price: pFan, color: '#0ea5e9' });
        renderSector('sector-amp-right', 'Амфитеатр Б', 7, 7, () => ({ price: pFan, color: '#0ea5e9' }));
        renderSector('sector-balcony', 'Балкон', 8, 28, (r) => r <= 4 ? { price: pMid, color: '#a855f7' } : { price: pBal, color: '#ea580c' });
    }

    updateSelectedCartUI();
    document.getElementById('booking-modal').classList.remove('hidden');
    lucide.createIcons();
}

function renderSector(containerId, zoneName, rows, cols, styleFn) {
    const container = document.getElementById(containerId);
    let html = '';

    for (let r = 1; r <= rows; r++) {
        const { price, color } = styleFn(r);
        html += `<div class="seat-row"><span class="row-num">${r}</span>`;
        for (let s = 1; s <= cols; s++) {
            const key = `${zoneName}|${r}|${s}`;
            const isBooked = bookedSeatsSet.has(key);
            html += `<button type="button" 
                class="seat-dot ${isBooked ? 'booked' : ''}" 
                style="background:${color}"
                title="${zoneName} • Қатар ${r}, Орын ${s} — ${price.toLocaleString()} ₸"
                ${isBooked ? 'disabled' : `onclick="toggleSeat('${zoneName}', ${r}, ${s}, ${price}, this)"`}
            ></button>`;
        }
        html += `</div>`;
    }
    container.innerHTML = html;
}

function toggleSeat(zone, row, seat, price, btnEl) {
    const idx = selectedSeatsList.findIndex(item => item.zone === zone && item.row === row && item.seat === seat);
    if (idx > -1) {
        selectedSeatsList.splice(idx, 1);
        btnEl.classList.remove('selected');
    } else {
        selectedSeatsList.push({ zone, row, seat, price });
        btnEl.classList.add('selected');
    }
    updateSelectedCartUI();
}

function updateSelectedCartUI() {
    const chips = document.getElementById('selected-seats-chips');
    const countEl = document.getElementById('cart-count');
    const totalEl = document.getElementById('total-price');

    countEl.textContent = selectedSeatsList.length;
    const total = selectedSeatsList.reduce((sum, s) => sum + s.price, 0);
    totalEl.textContent = total.toLocaleString();

    if (selectedSeatsList.length === 0) {
        chips.innerHTML = '<span style="color:#94a3b8; font-size:0.9rem;">Схемадан бос орындарды басып таңдаңыз...</span>';
        return;
    }

    chips.innerHTML = selectedSeatsList.map((s, i) => `
        <div class="seat-chip">
            ${s.zone}: Қатар ${s.row}, Орын ${s.seat} (${s.price.toLocaleString()} ₸)
            <button type="button" onclick="removeSeatFromCart(${i})">×</button>
        </div>
    `).join('');
}

function removeSeatFromCart(index) {
    const removed = selectedSeatsList[index];
    selectedSeatsList.splice(index, 1);
    document.querySelectorAll('.seat-dot.selected').forEach(btn => {
        if (btn.title.startsWith(`${removed.zone} • Қатар ${removed.row}, Орын ${removed.seat} `)) {
            btn.classList.remove('selected');
        }
    });
    updateSelectedCartUI();
}

// 7. Картамен төлеу терезесі
function confirmSeatBooking() {
    if (selectedSeatsList.length === 0) {
        alert('Кем дегенде 1 орын таңдаңыз!');
        return;
    }

    const total = selectedSeatsList.reduce((sum, s) => sum + s.price, 0);
    document.getElementById('pay-modal-amount').textContent = total.toLocaleString();
    document.getElementById('pay-card-holder').value = currentUser.full_name.toUpperCase();
    document.getElementById('card-holder-preview').textContent = currentUser.full_name.toUpperCase();
    document.getElementById('card-num-preview').textContent = '•••• •••• •••• ••••';
    document.getElementById('card-exp-preview').textContent = 'MM/YY';

    closeModal('booking-modal');
    document.getElementById('payment-modal').classList.remove('hidden');
}

function formatCardNumber(input) {
    let val = input.value.replace(/\D/g, '').substring(0, 16);
    let formatted = val.replace(/(.{4})/g, '$1 ').trim();
    input.value = formatted;
    document.getElementById('card-num-preview').textContent = formatted || '•••• •••• •••• ••••';

    const brand = document.getElementById('card-brand-label');
    if (val.startsWith('4')) brand.textContent = 'VISA / KASPI';
    else if (val.startsWith('5')) brand.textContent = 'MASTERCARD';
    else brand.textContent = 'BANK CARD';
}

function formatCardExp(input) {
    let val = input.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 3) val = val.substring(0, 2) + '/' + val.substring(2);
    input.value = val;
    document.getElementById('card-exp-preview').textContent = val || 'MM/YY';
}

document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawCard = document.getElementById('pay-card-num').value.replace(/\s/g, '');
    if (rawCard.length < 16) {
        alert('Картаның 16 санын толық енгізіңіз!');
        return;
    }

    const btn = document.getElementById('pay-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Банк арқылы төлем тексерілуде...';

    await new Promise(r => setTimeout(r, 1500));

    const res = await fetch('/api/book-seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            concert_id: currentConcert.id,
            seats: selectedSeatsList
        })
    });
    const data = await res.json();

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="lock"></i> Төлемді растау';
    lucide.createIcons();

    if (res.ok) {
        alert(`Төлем сәтті өтті! ${data.bookings.length} билет сатып алынды. QR-кодтар профиліңізде сақталды.`);
        document.getElementById('payment-form').reset();
        closeModal('payment-modal');
        switchTab('profile');
    } else {
        alert('Қате: ' + data.error);
    }
});

// 8. Профиль мен Аналитиканы жүктеу + PDF Билет жүктеу
async function loadProfileData() {
    if (!currentUser) return;
    const res = await fetch(`/api/profile/${currentUser.id}`);
    const data = await res.json();
    cachedUserTickets = data.tickets || [];

    document.getElementById('prof-avatar').textContent = data.user.full_name[0].toUpperCase();
    document.getElementById('prof-name').textContent = data.user.full_name;
    document.getElementById('prof-meta').textContent = `${data.user.email} • ${data.user.phone} • ${data.user.city}`;

    document.getElementById('stat-spent').textContent = `${data.analytics.totalSpent.toLocaleString()} ₸`;
    document.getElementById('stat-tickets').textContent = `${data.analytics.totalTickets} дана`;
    document.getElementById('stat-events').textContent = `${data.analytics.eventsCount} концерт`;
    document.getElementById('stat-city').textContent = data.analytics.favoriteCity;

    const list = document.getElementById('my-tickets-list');
    if (cachedUserTickets.length === 0) {
        list.innerHTML = '<p style="color:#94a3b8">Сізде әлі сатып алынған билеттер жоқ.</p>';
        return;
    }

    list.innerHTML = cachedUserTickets.map((t, index) => {
        const seatText = t.row_number ? `Қатар: ${t.row_number}, Орын: ${t.seat_number}` : 'Еркін кіру (Тұрып көру)';
        const statusBadge = t.status === 'Used'
            ? '<span style="background:#64748b; color:#fff; padding:3px 8px; border-radius:6px; font-size:0.75rem; margin-left:8px;">ПАЙДАЛАНЫЛҒАН</span>'
            : '<span style="background:#16a34a; color:#fff; padding:3px 8px; border-radius:6px; font-size:0.75rem; margin-left:8px;">БЕЛСЕНДІ</span>';

        return `
        <div class="ticket-item">
            <div class="ticket-left">
                <div style="display:flex; align-items:center; flex-wrap:wrap;">
                    <span class="ticket-code-badge">БИЛЕТ № ${t.ticket_code}</span>
                    ${statusBadge}
                </div>
                <h3>${t.artist} — ${t.title} (${t.concert_type})</h3>
                <p class="info"><i data-lucide="map-pin"></i> <b>Өтетін орны:</b> ${t.city}, ${t.venue}</p>
                <p class="info"><i data-lucide="calendar"></i> <b>Күні мен уақыты:</b> ${new Date(t.event_date).toLocaleString('kk-KZ')}</p>
                <p class="info"><i data-lucide="armchair"></i> <b>Аймақ:</b> ${t.zone_name} (${seatText}) • <b>Саны:</b> ${t.quantity} билет</p>
                <p class="info"><i data-lucide="credit-card"></i> <b>Төленген сома:</b> <strong style="color:#22c55e">${Number(t.total_price).toLocaleString()} ₸</strong></p>
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                    <button type="button" onclick="downloadTicketPDF(${index})" style="background:#0284c7; color:#fff; border:none; padding:9px 14px; border-radius:8px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                        <i data-lucide="file-down"></i> PDF Билет жүктеу
                    </button>
                    <button class="cancel-ticket-btn" style="margin-top:0;" onclick="cancelTicket(${t.id})">
                        <i data-lucide="trash-2"></i> Билетті қайтару
                    </button>
                </div>
            </div>
            <div class="ticket-right">
                <div id="qr-${t.id}"></div>
                <svg id="barcode-${t.id}"></svg>
            </div>
        </div>
    `}).join('');

    lucide.createIcons();

    cachedUserTickets.forEach(t => {
        new QRCode(document.getElementById(`qr-${t.id}`), {
            text: `TICKETKZ|${t.ticket_code}|${t.artist}|${t.zone_name}|R${t.row_number}-S${t.seat_number}`,
            width: 110,
            height: 110
        });
        JsBarcode(`#barcode-${t.id}`, t.ticket_code, {
            format: "CODE128",
            width: 1.5,
            height: 36,
            displayValue: true,
            fontSize: 12
        });
    });
}

// QR-КОДЫ БАР PDF-БИЛЕТ ЖҮКТЕУ ФУНКЦИЯСЫ
async function downloadTicketPDF(ticketIndex) {
    const t = cachedUserTickets[ticketIndex];
    if (!t) return;

    const sandbox = document.getElementById('pdf-render-sandbox');
    const seatText = t.row_number ? `Қатар ${t.row_number}, Орын ${t.seat_number}` : 'Еркін кіру';
    const formattedDate = new Date(t.event_date).toLocaleString('kk-KZ', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    sandbox.innerHTML = `
        <div id="pdf-ticket-card" style="width: 680px; background: #ffffff; color: #0f172a; font-family: Arial, sans-serif; border: 2px solid #0284c7; border-radius: 16px; overflow: hidden; padding: 0;">
            <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #ffffff; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 24px; font-weight: 800; letter-spacing: 1px;">Ticket<span style="color: #38bdf8;">KZ</span></div>
                    <div style="font-size: 12px; color: #cbd5e1; margin-top: 2px;">РЕСМИ ЭЛЕКТРОНДЫ БИЛЕТ / OFFICIAL E-TICKET</div>
                </div>
                <div style="text-align: right;">
                    <div style="background: #38bdf8; color: #0f172a; font-weight: 800; padding: 6px 12px; border-radius: 8px; font-size: 14px;">
                        ${t.ticket_code}
                    </div>
                </div>
            </div>

            <div style="padding: 24px 28px; display: flex; justify-content: space-between; gap: 20px;">
                <div style="flex: 1;">
                    <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Іс-шара / Концерт</div>
                    <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 4px 0 14px 0;">${t.artist} — ${t.title}</div>

                    <div style="margin-bottom: 10px;">
                        <span style="font-size: 12px; color: #64748b;">Өтетін орны:</span><br>
                        <strong style="font-size: 14px;">${t.city}, ${t.venue}</strong>
                    </div>

                    <div style="margin-bottom: 10px;">
                        <span style="font-size: 12px; color: #64748b;">Күні мен уақыты:</span><br>
                        <strong style="font-size: 14px;">${formattedDate}</strong>
                    </div>

                    <div style="display: flex; gap: 20px; margin-top: 14px; background: #f1f5f9; padding: 12px; border-radius: 10px;">
                        <div>
                            <span style="font-size: 11px; color: #64748b;">АЙМАҚ / СЕКТОР</span><br>
                            <strong style="font-size: 14px; color: #0284c7;">${t.zone_name}</strong>
                        </div>
                        <div>
                            <span style="font-size: 11px; color: #64748b;">ОРЫН</span><br>
                            <strong style="font-size: 14px;">${seatText}</strong>
                        </div>
                        <div>
                            <span style="font-size: 11px; color: #64748b;">БАҒАСЫ</span><br>
                            <strong style="font-size: 14px; color: #16a34a;">${Number(t.total_price).toLocaleString()} ₸</strong>
                        </div>
                    </div>

                    <div style="margin-top: 14px; font-size: 12px; color: #475569;">
                        Билет иесі: <strong>${currentUser.full_name}</strong> (${currentUser.email})
                    </div>
                </div>

                <div style="width: 170px; border-left: 2px dashed #cbd5e1; padding-left: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                    <div id="pdf-qr-box" style="padding: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;"></div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 8px;">Кіреберісте QR-кодты сканерлеңіз</div>
                    <div style="font-size: 13px; font-weight: 800; margin-top: 4px; color: #0f172a;">${t.ticket_code}</div>
                </div>
            </div>

            <div style="background: #f8fafc; padding: 10px 28px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; display: flex; justify-content: space-between;">
                <span>TicketKZ онлайн билет жүйесі • 24/7</span>
                <span>Жарамдылық статусы: ${t.status === 'Used' ? 'Пайдаланылған' : 'Белсенді'}</span>
            </div>
        </div>
    `;

    new QRCode(document.getElementById('pdf-qr-box'), {
        text: `TICKETKZ|${t.ticket_code}|${t.artist}|${t.zone_name}|R${t.row_number}-S${t.seat_number}`,
        width: 135,
        height: 135
    });

    await new Promise(r => setTimeout(r, 250));

    const element = document.getElementById('pdf-ticket-card');
    const opt = {
        margin: 10,
        filename: `TicketKZ_${t.ticket_code}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    await html2pdf().set(opt).from(element).save();
    sandbox.innerHTML = '';
}

async function cancelTicket(id) {
    if (!confirm('Бұл билетті шынымен қайтарғыңыз келе ме?')) return;
    const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
    if (res.ok) {
        loadProfileData();
    }
}

// 9. Сыртқы API сілтемелері арқылы КНИЖНЫЙ фото іздеу және ауыстыру
function openPhotoModal(concertId, title, artist, currentUrl) {
    editingConcertId = concertId;
    document.getElementById('photo-modal-subtitle').textContent = title;
    document.getElementById('itunes-search-query').value = artist;
    const input = document.getElementById('new-photo-url');
    input.value = currentUrl;
    previewNewPhoto(currentUrl);
    document.getElementById('photo-modal').classList.remove('hidden');
    searchArtistImagesAPI();
}

async function searchArtistImagesAPI() {
    const query = document.getElementById('itunes-search-query').value.trim();
    const grid = document.getElementById('api-photos-grid');
    if (!query) return;

    grid.innerHTML = '<span style="color:#94a3b8; font-size:0.8rem; grid-column: span 4;">API-ден ізделуде...</span>';
    try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=kz&media=music&limit=8`);
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
            grid.innerHTML = '<span style="color:#94a3b8; font-size:0.8rem; grid-column: span 4;">Фото табылмады.</span>';
            return;
        }

        grid.innerHTML = data.results.map(item => {
            const hdUrl = item.artworkUrl100.replace('100x100bb', '600x800bb');
            return `<img src="${hdUrl}" title="${item.collectionName || item.trackName}" onclick="selectApiImageUrl('${hdUrl}')" style="width:100%; height:115px; object-fit:cover; object-position:top center; border-radius:8px; cursor:pointer; border:2px solid transparent;" onmouseover="this.style.borderColor='#38bdf8'" onmouseout="this.style.borderColor='transparent'">`;
        }).join('');
    } catch (err) {
        grid.innerHTML = '<span style="color:#ef4444; font-size:0.8rem; grid-column: span 4;">API байланыс қатесі.</span>';
    }
}

function setRandomConcertApiUrl() {
    const randomId = Math.floor(Math.random() * 1000);
    const apiUrl = `https://picsum.photos/600/800?random=${randomId}`;
    selectApiImageUrl(apiUrl);
}

function selectApiImageUrl(url) {
    document.getElementById('new-photo-url').value = url;
    previewNewPhoto(url);
}

function previewNewPhoto(url) {
    const box = document.getElementById('photo-preview-box');
    const img = document.getElementById('photo-preview-img');
    if (url && url.startsWith('http')) {
        img.src = url;
        box.classList.remove('hidden');
    } else {
        box.classList.add('hidden');
    }
}

document.getElementById('photo-url-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const image_url = document.getElementById('new-photo-url').value.trim();

    const res = await fetch(`/api/concerts/${editingConcertId}/image`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url })
    });

    if (res.ok) {
        closeModal('photo-modal');
        loadConcerts();
    } else {
        alert('Суретті жаңарту қатесі');
    }
});

// 10. Жаңа шынайы концерт қосу формасы
document.getElementById('add-concert-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        artist: document.getElementById('new-c-artist').value,
        title: document.getElementById('new-c-title').value,
        city: document.getElementById('new-c-city').value,
        event_date: document.getElementById('new-c-date').value,
        venue: document.getElementById('new-c-venue').value,
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
        alert('Жаңа концерт сәтті қосылды!');
        document.getElementById('add-concert-form').reset();
        closeModal('add-concert-modal');
        loadConcerts();
    }
});

// 11. Ашық API арқылы әртістің концерттерін базаға жүктеу
async function syncRealConcertsFromAPI() {
    const input = document.getElementById('api-artist-input');
    const btn = document.getElementById('sync-api-btn');
    const artistQuery = input.value.trim() || 'Coldplay';

    btn.disabled = true;
    btn.textContent = 'API жүктелуде...';

    try {
        const res = await fetch('/api/sync-real-concerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artistQuery })
        });
        const data = await res.json();

        if (res.ok) {
            alert(`API арқылы "${artistQuery}" әртісінің ${data.count} концерті қосылды!`);
            input.value = '';
            const allBtn = document.querySelector('.city-btn');
            filterCity('Барлығы', allBtn);
        } else {
            alert('Қате: ' + data.error);
        }
    } catch (err) {
        alert('Сервермен байланыс қатесі');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="globe"></i> API Билеттер Қосу';
        lucide.createIcons();
    }
}

// ================= 12. АДМИН-ПАНЕЛЬ ЛОГИКАСЫ =================

function openAdminOrLogin() {
    if (!adminPassword) {
        document.getElementById('admin-login-modal').classList.remove('hidden');
    } else {
        switchTab('admin');
    }
}

document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = document.getElementById('admin-pass-input').value;

    const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
    });

    if (res.ok) {
        adminPassword = pass;
        sessionStorage.setItem('ticketkz_admin_pass', pass);
        document.getElementById('admin-login-form').reset();
        closeModal('admin-login-modal');
        switchTab('admin');
    } else {
        alert('Құпиясөз қате! Қайта тексеріңіз (Әдепкі: admin2026)');
    }
});

function logoutAdmin() {
    adminPassword = null;
    sessionStorage.removeItem('ticketkz_admin_pass');
    switchTab('events');
}

async function loadAdminDashboard() {
    if (!adminPassword) return;

    const res = await fetch('/api/admin/dashboard', {
        headers: { 'x-admin-password': adminPassword }
    });

    if (!res.ok) {
        logoutAdmin();
        return;
    }

    const data = await res.json();

    document.getElementById('adm-revenue').textContent = `${data.stats.totalRevenue.toLocaleString()} ₸`;
    document.getElementById('adm-sold').textContent = `${data.stats.totalSold} дана`;
    document.getElementById('adm-concerts-count').textContent = data.stats.totalConcerts;
    document.getElementById('adm-users-count').textContent = data.stats.totalUsers;

    // Концерттер тізімі
    const concertsList = document.getElementById('admin-concerts-list');
    concertsList.innerHTML = data.concerts.map(c => {
        const cJson = JSON.stringify(c).replace(/'/g, "&#39;");
        return `
        <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
                <strong style="font-size:1.05rem; color:#f8fafc;">${c.artist} — ${c.title}</strong>
                <div style="color:#94a3b8; font-size:0.85rem; margin-top:4px;">
                    ${c.city} • ${c.venue} • ${new Date(c.event_date).toLocaleString('kk-KZ')}
                </div>
                <div style="color:#38bdf8; font-size:0.85rem; margin-top:4px;">
                    Бағалар: ${Number(c.price_balcony).toLocaleString()} / ${Number(c.price_fanzone).toLocaleString()} / ${Number(c.price_vip).toLocaleString()} ₸ • Бос орын: <b>${c.available_seats}</b>
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <button type="button" onclick='openEditConcertModal(${cJson})' style="background:#0ea5e9; color:#fff; border:none; padding:8px 14px; border-radius:8px; font-weight:600; cursor:pointer;">
                    Өңдеу
                </button>
                <button type="button" onclick="deleteConcertAdmin(${c.id})" style="background:#ef4444; color:#fff; border:none; padding:8px 14px; border-radius:8px; font-weight:600; cursor:pointer;">
                    Өшіру
                </button>
            </div>
        </div>
    `}).join('');

    // Сатылымдар журналы
    const bookingsList = document.getElementById('admin-bookings-list');
    if (data.bookings.length === 0) {
        bookingsList.innerHTML = '<p style="color:#94a3b8">Әзірге сатылған билеттер жоқ.</p>';
    } else {
        bookingsList.innerHTML = data.bookings.map(b => {
            const isUsed = b.status === 'Used';
            return `
            <div style="background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <span style="background:#1e293b; color:#38bdf8; padding:3px 8px; border-radius:6px; font-weight:700; font-size:0.8rem;">${b.ticket_code}</span>
                    <span style="background:${isUsed ? '#475569' : '#15803d'}; color:#fff; padding:3px 8px; border-radius:6px; font-size:0.75rem; margin-left:6px;">
                        ${isUsed ? 'ӨТКІЗІЛГЕН (Used)' : 'БЕЛСЕНДІ'}
                    </span>
                    <strong style="margin-left:8px;">${b.artist} — ${b.title}</strong>
                    <div style="color:#94a3b8; font-size:0.83rem; margin-top:4px;">
                        Сатып алушы: <b>${b.full_name || 'Белгісіз'}</b> (${b.email || ''}) • Аймақ: ${b.zone_name} (Қатар ${b.row_number}, Орын ${b.seat_number})
                    </div>
                </div>
                <div style="text-align:right;">
                    <strong style="color:#22c55e;">+${Number(b.total_price).toLocaleString()} ₸</strong>
                    <div style="color:#64748b; font-size:0.78rem;">${new Date(b.booking_date).toLocaleString('kk-KZ')}</div>
                </div>
            </div>
        `}).join('');
    }

    lucide.createIcons();
}

function openEditConcertModal(concert) {
    document.getElementById('edit-c-id').value = concert.id;
    document.getElementById('edit-c-artist').value = concert.artist;
    document.getElementById('edit-c-title').value = concert.title;
    document.getElementById('edit-c-city').value = concert.city;
    document.getElementById('edit-c-venue').value = concert.venue;
    document.getElementById('edit-c-seats').value = concert.available_seats;
    document.getElementById('edit-c-bal').value = concert.price_balcony;
    document.getElementById('edit-c-fan').value = concert.price_fanzone;
    document.getElementById('edit-c-vip').value = concert.price_vip;
    document.getElementById('edit-concert-modal').classList.remove('hidden');
}

document.getElementById('edit-concert-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-c-id').value;
    const payload = {
        artist: document.getElementById('edit-c-artist').value,
        title: document.getElementById('edit-c-title').value,
        city: document.getElementById('edit-c-city').value,
        venue: document.getElementById('edit-c-venue').value,
        available_seats: Number(document.getElementById('edit-c-seats').value),
        price_balcony: Number(document.getElementById('edit-c-bal').value),
        price_fanzone: Number(document.getElementById('edit-c-fan').value),
        price_vip: Number(document.getElementById('edit-c-vip').value)
    };

    const res = await fetch(`/api/admin/concerts/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminPassword
        },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        closeModal('edit-concert-modal');
        loadAdminDashboard();
    } else {
        alert('Сақтау қатесі!');
    }
});

async function deleteConcertAdmin(id) {
    if (!confirm('Бұл концертті базадан толық өшіргіңіз келе ме?')) return;
    const res = await fetch(`/api/admin/concerts/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword }
    });
    if (res.ok) {
        loadAdminDashboard();
    }
}

async function verifyTicketCode(markUsed) {
    const code = document.getElementById('verify-code-input').value.trim();
    const box = document.getElementById('verify-result-box');
    if (!code) return;

    const res = await fetch('/api/admin/verify-ticket', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminPassword
        },
        body: JSON.stringify({ ticket_code: code, markUsed })
    });
    const data = await res.json();

    if (!res.ok || !data.valid) {
        box.innerHTML = `<div style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#fca5a5; padding:12px; border-radius:10px;">❌ ${data.error}</div>`;
        return;
    }

    const t = data.ticket;
    const isUsed = t.status === 'Used';
    box.innerHTML = `
        <div style="background:rgba(34,197,94,0.12); border:1px solid #22c55e; color:#f8fafc; padding:14px; border-radius:10px;">
            <div style="font-weight:700; color:#4ade80; font-size:1.05rem;">
                ✅ Билет расталды: ${t.ticket_code} (${isUsed ? 'ӨТКІЗІЛГЕН — Used' : 'КІРУГЕ РҰҚСАТ'})
            </div>
            <div style="margin-top:6px; font-size:0.9rem; color:#cbd5e1;">
                <b>Концерт:</b> ${t.artist} — ${t.title} (${t.city})<br>
                <b>Иесі:</b> ${t.full_name} • <b>Орын:</b> ${t.zone_name}, Қатар ${t.row_number}, Орын ${t.seat_number}
            </div>
        </div>
    `;
    if (markUsed) loadAdminDashboard();
}