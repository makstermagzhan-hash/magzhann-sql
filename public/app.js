let selectedCity = 'Барлығы';
let currentConcert = null;
let currentUser = JSON.parse(localStorage.getItem('ticketkz_user')) || null;
let favorites = JSON.parse(localStorage.getItem('ticketkz_favs')) || [];
let showingFavoritesOnly = false;

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

// 8. Профиль мен Аналитиканы жүктеу
async function loadProfileData() {
    if (!currentUser) return;
    const res = await fetch(`/api/profile/${currentUser.id}`);
    const data = await res.json();

    document.getElementById('prof-avatar').textContent = data.user.full_name[0].toUpperCase();
    document.getElementById('prof-name').textContent = data.user.full_name;
    document.getElementById('prof-meta').textContent = `${data.user.email} • ${data.user.phone} • ${data.user.city}`;

    document.getElementById('stat-spent').textContent = `${data.analytics.totalSpent.toLocaleString()} ₸`;
    document.getElementById('stat-tickets').textContent = `${data.analytics.totalTickets} дана`;
    document.getElementById('stat-events').textContent = `${data.analytics.eventsCount} концерт`;
    document.getElementById('stat-city').textContent = data.analytics.favoriteCity;

    const list = document.getElementById('my-tickets-list');
    if (data.tickets.length === 0) {
        list.innerHTML = '<p style="color:#94a3b8">Сізде әлі сатып алынған билеттер жоқ.</p>';
        return;
    }

    list.innerHTML = data.tickets.map(t => {
        const seatText = t.row_number ? `Қатар: ${t.row_number}, Орын: ${t.seat_number}` : 'Еркін кіру (Тұрып көру)';
        return `
        <div class="ticket-item">
            <div class="ticket-left">
                <span class="ticket-code-badge">БИЛЕТ № ${t.ticket_code}</span>
                <h3>${t.artist} — ${t.title} (${t.concert_type})</h3>
                <p class="info"><i data-lucide="map-pin"></i> <b>Өтетін орны:</b> ${t.city}, ${t.venue}</p>
                <p class="info"><i data-lucide="calendar"></i> <b>Күні мен уақыты:</b> ${new Date(t.event_date).toLocaleString('kk-KZ')}</p>
                <p class="info"><i data-lucide="armchair"></i> <b>Аймақ:</b> ${t.zone_name} (${seatText}) • <b>Саны:</b> ${t.quantity} билет</p>
                <p class="info"><i data-lucide="credit-card"></i> <b>Төленген сома:</b> <strong style="color:#22c55e">${Number(t.total_price).toLocaleString()} ₸</strong></p>
                <button class="cancel-ticket-btn" onclick="cancelTicket(${t.id})">
                    <i data-lucide="trash-2"></i> Билетті қайтару
                </button>
            </div>
            <div class="ticket-right">
                <div id="qr-${t.id}"></div>
                <svg id="barcode-${t.id}"></svg>
            </div>
        </div>
    `}).join('');

    lucide.createIcons();

    data.tickets.forEach(t => {
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