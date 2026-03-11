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