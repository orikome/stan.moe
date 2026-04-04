// Create sparkle effects
function createSparkle() {
    const container = document.querySelector('.container');
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    
    // Random position
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    
    // Random size
    const size = Math.random() * 6 + 4;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    
    // Random animation delay
    sparkle.style.animationDelay = `${Math.random() * 2}s`;
    
    // Random color variation
    const colors = ['#ff69b4', '#ffb6c1', '#e6e6fa', '#d8bfd8', '#ffc0cb'];
    sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    container.appendChild(sparkle);
    
    // Remove sparkle after animation
    setTimeout(() => {
        sparkle.remove();
    }, 2000);
}

// Create initial sparkles
for (let i = 0; i < 15; i++) {
    setTimeout(() => {
        createSparkle();
    }, i * 300);
}

// Continuous sparkles
setInterval(createSparkle, 500);

// Add subtle interactive effect
document.querySelector('.domain-container').addEventListener('mouseover', function() {
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            createSparkle();
        }, i * 100);
    }
});

// Fetch and render trending anime strip
async function loadTrending() {
    const strip = document.getElementById('trending-strip');
    if (!strip) return;
    try {
        const res = await fetch('data/trending.json');
        if (!res.ok) return;
        const { anime } = await res.json();
        if (!Array.isArray(anime) || !anime.length) return;

        anime.forEach((a, i) => {
            const card = document.createElement('a');
            card.className = 'trending-card';

            // Only allow actual AniList URLs — no open redirects
            if (typeof a.url === 'string' && a.url.startsWith('https://anilist.co/')) {
                card.href = a.url;
                card.target = '_blank';
                card.rel = 'noopener noreferrer';
            }

            const rank = document.createElement('span');
            rank.className = 'trending-rank';
            rank.textContent = `#${i + 1}`;

            const title = document.createElement('span');
            title.className = 'trending-title';
            title.textContent = String(a.title ?? '').slice(0, 120);

            card.appendChild(rank);
            card.appendChild(title);

            if (a.score != null && isFinite(Number(a.score))) {
                const score = document.createElement('span');
                score.className = 'trending-score';
                score.textContent = `★ ${Number(a.score).toFixed(1)}`;
                card.appendChild(score);
            }

            strip.appendChild(card);
        });
    } catch (_) {
        // silently fail — trending is non-critical
    }
}

loadTrending();

// ── Home countdown ──

function formatHomeCountdown(airingAt) {
    const now = Math.floor(Date.now() / 1000);
    const diff = airingAt - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    return {
        days: Math.floor(diff / 86400),
        hours: Math.floor((diff % 86400) / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60,
        expired: false,
    };
}

function padNum(n) { return String(n).padStart(2, '0'); }

function homeTimerHTML(airingAt) {
    const cd = formatHomeCountdown(airingAt);
    if (cd.expired) return '<div class="timer-aired">Aired!</div>';
    return '<div class="timer" data-airing-at="' + airingAt + '">' +
        '<div class="timer-segment"><div class="timer-value">' + cd.days + '</div><div class="timer-label">days</div></div>' +
        '<div class="timer-segment"><div class="timer-value">' + padNum(cd.hours) + '</div><div class="timer-label">hrs</div></div>' +
        '<div class="timer-segment"><div class="timer-value">' + padNum(cd.minutes) + '</div><div class="timer-label">min</div></div>' +
        '<div class="timer-segment"><div class="timer-value">' + padNum(cd.seconds) + '</div><div class="timer-label">sec</div></div>' +
        '</div>';
}

function escapeForHome(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
}

async function loadHomeCountdown() {
    const grid = document.getElementById('home-countdown-grid');
    if (!grid) return;
    try {
        const res = await fetch('data/countdown.json');
        if (!res.ok) return;
        const data = await res.json();
        const shows = data.shows;
        if (!Array.isArray(shows) || !shows.length) return;

        const now = Math.floor(Date.now() / 1000);
        const upcoming = shows
            .filter(s => s.airingAt > now)
            .sort((a, b) => a.airingAt - b.airingAt)
            .slice(0, 6);

        for (const s of upcoming) {
            const card = document.createElement('a');
            card.className = 'countdown-card';
            card.href = 'countdown/show.html?slug=' + encodeURIComponent(s.slug);

            const epText = s.totalEpisodes
                ? 'Ep ' + s.nextEpisode + ' / ' + s.totalEpisodes
                : 'Ep ' + s.nextEpisode;
            const scoreHtml = s.averageScore != null
                ? '<span class="card-score">\u2605 ' + (s.averageScore / 10).toFixed(1) + '</span>'
                : '';
            const genreText = s.genres && s.genres.length ? s.genres.join(' \u00b7 ') : '';
            const genreHtml = genreText
                ? '<span class="card-genre">' + escapeForHome(genreText) + '</span>'
                : '';
            const coverHtml = s.coverImage
                ? '<div class="card-cover-wrap">' +
                  '<img class="card-cover" src="' + escapeForHome(s.coverImage) + '" alt="' + escapeForHome(s.title) + '" loading="lazy" />' +
                  '<div class="card-cover-fade"></div>' +
                  '<div class="card-episode-badge">' + escapeForHome(epText) + '</div>' +
                  '</div>'
                : '';
            const romajiHtml = s.titleRomaji && s.titleRomaji !== s.title
                ? '<div class="card-title-romaji">' + escapeForHome(s.titleRomaji) + '</div>'
                : '';

            card.innerHTML = coverHtml +
                '<div class="card-body">' +
                    '<div class="card-title">' + escapeForHome(s.title) + '</div>' +
                    romajiHtml +
                    '<div class="card-meta">' + genreHtml + scoreHtml + '</div>' +
                    homeTimerHTML(s.airingAt) +
                '</div>';

            grid.appendChild(card);
        }

        // Tick timers live
        setInterval(function () {
            document.querySelectorAll('#home-countdown-grid [data-airing-at]').forEach(function (el) {
                const airingAt = parseInt(el.dataset.airingAt, 10);
                const cd = formatHomeCountdown(airingAt);
                if (cd.expired) {
                    el.outerHTML = '<div class="timer-aired">Aired!</div>';
                    return;
                }
                const vals = el.querySelectorAll('.timer-value');
                if (vals.length === 4) {
                    vals[0].textContent = cd.days;
                    vals[1].textContent = padNum(cd.hours);
                    vals[2].textContent = padNum(cd.minutes);
                    vals[3].textContent = padNum(cd.seconds);
                }
            });
        }, 1000);
    } catch (_) {
        // non-critical — home countdown is a nice-to-have
    }
}

loadHomeCountdown();