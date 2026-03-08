// ─── Card constants ──────────────────────────────────────────────────────────
const CARD_W   = 400;
const CARD_H   = 600;
const CORNER_R = 20;
const PHOTO_H  = 315;  // header photo zone (top 52%)
const PANEL_Y  = 275;  // frosted panel start — overlaps photo by 40px

// ─── Themes ──────────────────────────────────────────────────────────────────
const themes = {
    pink: {
        bg1:        '#2a2350',
        bg2:        '#181825',
        accent1:    '#ff8ecf',
        accent2:    '#bfaaff',
        subtext:    '#e0d7f7',
        fgGrad:     ['#c8b8ff', '#ff8ecf'],
        blobA:      '#bfaaff',
        blobB:      '#ff8ecf',
        panelFill:  'rgba(10, 8, 24, 0.84)',
    },
    blue: {
        bg1:        '#1a1e42',
        bg2:        '#0b0d26',
        accent1:    '#7eb8ff',
        accent2:    '#a8d0ff',
        subtext:    '#c4daff',
        fgGrad:     ['#a8d0ff', '#5a9fff'],
        blobA:      '#a8d0ff',
        blobB:      '#5a9fff',
        panelFill:  'rgba(6, 8, 22, 0.86)',
    },
    green: {
        bg1:        '#162c28',
        bg2:        '#0a1a16',
        accent1:    '#50e8b0',
        accent2:    '#90f5d0',
        subtext:    '#b0ecd8',
        fgGrad:     ['#90f5d0', '#30c890'],
        blobA:      '#90f5d0',
        blobB:      '#50e8b0',
        panelFill:  'rgba(6, 16, 12, 0.86)',
    },
};

// ─── State ───────────────────────────────────────────────────────────────────
let currentTheme = 'pink';
let avatarImg    = null;
let _noise       = null;
let _drawTimer   = null;

// ─── Utilities ───────────────────────────────────────────────────────────────
function hexToRgb(hex) {
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
}

function cardClipPath(ctx, W, H, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(0, 0, W, H, r);
    } else {
        ctx.moveTo(r, 0);
        ctx.lineTo(W - r, 0);
        ctx.arcTo(W, 0, W, r, r);
        ctx.lineTo(W, H - r);
        ctx.arcTo(W, H, W - r, H, r);
        ctx.lineTo(r, H);
        ctx.arcTo(0, H, 0, H - r, r);
        ctx.lineTo(0, r);
        ctx.arcTo(0, 0, r, 0, r);
        ctx.closePath();
    }
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines;
}

// ─── Grain texture (cached) ──────────────────────────────────────────────────
function getNoiseTexture() {
    if (_noise) return _noise;
    const off  = new OffscreenCanvas(CARD_W, CARD_H);
    const octx = off.getContext('2d');
    const data = octx.createImageData(CARD_W, CARD_H);
    const buf  = data.data;
    for (let i = 0; i < buf.length; i += 4) {
        const v    = (Math.random() * 255) | 0;
        buf[i]     = v;
        buf[i + 1] = v;
        buf[i + 2] = v;
        buf[i + 3] = (Math.random() * 20) | 0;  // 0-8% opacity
    }
    octx.putImageData(data, 0, 0);
    _noise = off;
    return off;
}

// ─── Canvas setup (call once) ────────────────────────────────────────────────
function setupCanvas() {
    const canvas = document.getElementById('card-canvas');
    const dpr    = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width  = CARD_W * dpr;
    canvas.height = CARD_H * dpr;
    // Set CSS width; height derives from canvas intrinsic ratio so max-width works responsively
    canvas.style.width = `${CARD_W}px`;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function drawPhotoHeader(ctx, img, W, zoneH) {
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;

    // Scale image to cover the full zone width
    const scale = Math.max(W / sw, zoneH / sh);
    const dw    = sw * scale;
    const dh    = sh * scale;

    // Center horizontally; bias vertically toward top 28% (face-aware)
    const dx = (W - dw) / 2;
    const dy = -(dh - zoneH) * 0.28;

    ctx.drawImage(img, dx, dy, dw, dh);

    // Side vignette to focus the eye
    const vigW = 55;
    const vL = ctx.createLinearGradient(0, 0, vigW, 0);
    vL.addColorStop(0, 'rgba(0,0,0,0.5)');
    vL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vL;
    ctx.fillRect(0, 0, vigW, zoneH);

    const vR = ctx.createLinearGradient(W - vigW, 0, W, 0);
    vR.addColorStop(0, 'rgba(0,0,0,0)');
    vR.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vR;
    ctx.fillRect(W - vigW, 0, vigW, zoneH);
}

function drawAbstractHeader(ctx, W, zoneH, theme) {
    // Background gradient
    const bg = ctx.createRadialGradient(W / 2, zoneH * 0.42, 0, W / 2, zoneH * 0.42, W * 0.9);
    bg.addColorStop(0, theme.bg1);
    bg.addColorStop(1, theme.bg2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, zoneH);

    // Soft color blobs
    const blobs = [
        { x: W * 0.18, y: zoneH * 0.22, r: 115, c: theme.blobA, a: 0.14 },
        { x: W * 0.82, y: zoneH * 0.42, r: 125, c: theme.blobB, a: 0.11 },
        { x: W * 0.48, y: zoneH * 0.72, r: 95,  c: theme.blobA, a: 0.09 },
        { x: W * 0.65, y: zoneH * 0.15, r: 70,  c: theme.blobB, a: 0.08 },
    ];
    blobs.forEach(({ x, y, r, c, a }) => {
        const [cr, cg, cb] = hexToRgb(c);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${a * 2.2})`);
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, zoneH);
    });

    // Concentric sonar rings
    ctx.save();
    ctx.strokeStyle = theme.accent1;
    ctx.lineWidth = 0.75;
    for (let i = 1; i <= 4; i++) {
        ctx.globalAlpha = 0.055 / i;
        ctx.beginPath();
        ctx.arc(W / 2, zoneH * 0.44, i * 54, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();

    // Large faint central ♡
    ctx.save();
    ctx.font = `${Math.round(zoneH * 0.56)}px sans-serif`;
    ctx.fillStyle = theme.accent1;
    ctx.globalAlpha = 0.065;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♡', W / 2, zoneH * 0.43);
    ctx.restore();

    // Scattered ambient symbols
    const ambient = [
        { s: '✿', x: 0.11, y: 0.16, sz: 17, a: 0.28 },
        { s: '★', x: 0.86, y: 0.20, sz: 14, a: 0.24 },
        { s: '✧', x: 0.20, y: 0.74, sz: 12, a: 0.21 },
        { s: '✦', x: 0.80, y: 0.70, sz: 12, a: 0.21 },
        { s: '♡', x: 0.89, y: 0.58, sz: 15, a: 0.22 },
        { s: '✿', x: 0.08, y: 0.54, sz: 13, a: 0.19 },
        { s: '★', x: 0.52, y: 0.12, sz: 11, a: 0.19 },
        { s: '✧', x: 0.38, y: 0.82, sz: 10, a: 0.17 },
    ];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ambient.forEach(({ s, x, y, sz, a }) => {
        ctx.font = `${sz}px sans-serif`;
        ctx.fillStyle = theme.accent1;
        ctx.globalAlpha = a;
        ctx.fillText(s, W * x, zoneH * y);
    });
    ctx.restore();
}

function drawHeaderFade(ctx, W, zoneH, bgHex) {
    const [r, g, b] = hexToRgb(bgHex);
    // Fade starts mid-photo, is fully opaque just past photo zone
    const fade = ctx.createLinearGradient(0, zoneH * 0.42, 0, zoneH + 12);
    fade.addColorStop(0,    `rgba(${r},${g},${b},0)`);
    fade.addColorStop(0.55, `rgba(${r},${g},${b},0.65)`);
    fade.addColorStop(1,    `rgba(${r},${g},${b},1)`);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, zoneH + 12);
}

function drawInfoPanel(ctx, y, W, H, theme) {
    ctx.save();

    // Upward shadow to separate from photo zone
    ctx.shadowBlur    = 28;
    ctx.shadowColor   = 'rgba(0,0,0,0.45)';
    ctx.shadowOffsetY = -5;
    ctx.fillStyle = theme.panelFill;
    ctx.fillRect(0, y, W, H - y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Vertical sheen (simulated glass reflection)
    const sheen = ctx.createLinearGradient(0, y, 0, y + 55);
    sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, y, W, 55);

    // Top border — the "glass rim"
    const rimGrad = ctx.createLinearGradient(0, 0, W, 0);
    rimGrad.addColorStop(0,   'rgba(255,255,255,0)');
    rimGrad.addColorStop(0.12, 'rgba(255,255,255,0.22)');
    rimGrad.addColorStop(0.88, 'rgba(255,255,255,0.22)');
    rimGrad.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, y, W, 1);

    ctx.restore();
}

function drawAccentLine(ctx, W, y, theme) {
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0,   'rgba(0,0,0,0)');
    grad.addColorStop(0.25, theme.accent1);
    grad.addColorStop(0.75, theme.accent2);
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, W, 1.5);
    ctx.restore();
}

function drawStanLabel(ctx, W, y, theme) {
    const label = 'S T A N';
    ctx.save();
    ctx.font = `700 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.accent1;

    const lw     = ctx.measureText(label).width;
    const gap    = 14;
    const margin = 38;
    const lx1    = margin;
    const lx2    = W / 2 - lw / 2 - gap;
    const rx1    = W / 2 + lw / 2 + gap;
    const rx2    = W - margin;

    // Left fading line
    const lg = ctx.createLinearGradient(lx1, 0, lx2, 0);
    lg.addColorStop(0, 'transparent');
    lg.addColorStop(1, theme.accent1);
    ctx.strokeStyle = lg;
    ctx.lineWidth   = 0.7;
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.moveTo(lx1, y); ctx.lineTo(lx2, y); ctx.stroke();

    // Right fading line
    const rg = ctx.createLinearGradient(rx1, 0, rx2, 0);
    rg.addColorStop(0, theme.accent1);
    rg.addColorStop(1, 'transparent');
    ctx.strokeStyle = rg;
    ctx.beginPath(); ctx.moveTo(rx1, y); ctx.lineTo(rx2, y); ctx.stroke();

    // Label
    ctx.globalAlpha = 0.88;
    ctx.fillText(label, W / 2, y + 0.5);
    ctx.restore();
}

function drawHeroText(ctx, text, W, y, theme) {
    // Auto-size to fit within padded width
    let sz = 48;
    const maxW = W - 60;
    ctx.font = `700 ${sz}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    while (ctx.measureText(text).width > maxW && sz > 18) {
        sz--;
        ctx.font = `700 ${sz}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    }

    // Gradient keyed to actual measured text width
    const halfW = ctx.measureText(text).width / 2;
    const grad  = ctx.createLinearGradient(W / 2 - halfW, 0, W / 2 + halfW, 0);
    grad.addColorStop(0,   theme.fgGrad[0]);
    grad.addColorStop(0.5, theme.accent1);
    grad.addColorStop(1,   theme.fgGrad[1]);

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = grad;

    // Two-pass glow: wide diffuse then tight hot-core
    ctx.shadowBlur  = 24;
    ctx.shadowColor = theme.accent1 + '44';
    ctx.fillText(text, W / 2, y);
    ctx.shadowBlur  = 7;
    ctx.shadowColor = theme.accent1 + '99';
    ctx.fillText(text, W / 2, y);

    ctx.restore();
}

function drawHoloBorder(ctx, W, H, r) {
    const lineW = 4;
    const inset = lineW / 2;
    ctx.save();
    const holo = ctx.createLinearGradient(0, 0, W, H);
    holo.addColorStop(0,    '#ff6b9d');
    holo.addColorStop(0.18, '#c44dff');
    holo.addColorStop(0.36, '#4daaff');
    holo.addColorStop(0.54, '#4dffd1');
    holo.addColorStop(0.72, '#ffe94d');
    holo.addColorStop(0.90, '#ff9d4d');
    holo.addColorStop(1,    '#ff6b9d');
    ctx.strokeStyle = holo;
    ctx.lineWidth   = lineW;
    ctx.globalAlpha = 0.78;
    // Inset path so the full stroke width is visible within the card clip
    const ir = Math.max(0, r - inset);
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(inset, inset, W - inset * 2, H - inset * 2, ir);
    } else {
        const x = inset, y = inset, w = W - inset * 2, h = H - inset * 2;
        ctx.moveTo(x + ir, y);
        ctx.lineTo(x + w - ir, y);
        ctx.arcTo(x + w, y, x + w, y + ir, ir);
        ctx.lineTo(x + w, y + h - ir);
        ctx.arcTo(x + w, y + h, x + w - ir, y + h, ir);
        ctx.lineTo(x + ir, y + h);
        ctx.arcTo(x, y + h, x, y + h - ir, ir);
        ctx.lineTo(x, y + ir);
        ctx.arcTo(x, y, x + ir, y, ir);
        ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
}

function drawCornerMarks(ctx, W, H, m, theme) {
    const len = 11;
    const pos = [
        [m,     m,     0],
        [W - m, m,     Math.PI / 2],
        [W - m, H - m, Math.PI],
        [m,     H - m, Math.PI * 1.5],
    ];
    ctx.save();
    ctx.strokeStyle = theme.accent1;
    ctx.lineWidth   = 1;
    ctx.globalAlpha = 0.35;
    ctx.lineCap     = 'square';
    pos.forEach(([x, y, angle]) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, len);
        ctx.lineTo(0, 0);
        ctx.lineTo(len, 0);
        ctx.stroke();
        ctx.restore();
    });
    ctx.restore();
}

// ─── Main draw function ──────────────────────────────────────────────────────
function drawCard() {
    const canvas = document.getElementById('card-canvas');
    const ctx    = canvas.getContext('2d');
    const dpr    = Math.min(window.devicePixelRatio || 1, 3);

    // Reset to dpr scale (safe to call repeatedly)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CARD_W, CARD_H);

    const W     = CARD_W;
    const H     = CARD_H;
    const theme = themes[currentTheme];

    // ── Clip everything to rounded card shape ──
    ctx.save();
    cardClipPath(ctx, W, H, CORNER_R);
    ctx.clip();

    // ── Solid background ──
    ctx.fillStyle = theme.bg2;
    ctx.fillRect(0, 0, W, H);

    // ── Header zone (photo or abstract art) ──
    ctx.save();
    // Clip drawing to just the photo zone height to prevent overflow
    ctx.beginPath();
    ctx.rect(0, 0, W, PHOTO_H);
    ctx.clip();
    if (avatarImg) {
        drawPhotoHeader(ctx, avatarImg, W, PHOTO_H);
    } else {
        drawAbstractHeader(ctx, W, PHOTO_H, theme);
    }
    ctx.restore();

    // ── Gradient fade from header into panel ──
    drawHeaderFade(ctx, W, PHOTO_H, theme.bg2);

    // ── Frosted info panel ──
    drawInfoPanel(ctx, PANEL_Y, W, H, theme);

    // ── Accent divider line ──
    drawAccentLine(ctx, W, PANEL_Y + 16, theme);

    // ── @handle ──
    const rawH  = document.getElementById('handle').value.trim() || 'yourhandle';
    const hText = rawH.startsWith('@') ? rawH : '@' + rawH;
    ctx.save();
    ctx.font         = '300 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle    = theme.subtext;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha  = 0.78;
    ctx.fillText(hText, W / 2, PANEL_Y + 50);
    ctx.restore();

    // ── I STAN with flanking gradient lines ──
    drawStanLabel(ctx, W, PANEL_Y + 84, theme);

    // ── Fandom name (hero text) ──
    const fandom = document.getElementById('fandom').value.trim() || 'everyone';
    drawHeroText(ctx, fandom, W, PANEL_Y + 138, theme);

    // ── Quote (optional, wraps up to 3 lines) ──
    const quoteRaw = document.getElementById('quote').value.trim();
    if (quoteRaw) {
        ctx.save();
        ctx.font         = 'italic 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle    = theme.subtext;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.globalAlpha  = 0.6;
        const qLines = wrapText(ctx, `"${quoteRaw}"`, W - 90);
        const lineH  = 18;
        // Vertically center the text block in the quote zone
        const totalH = (qLines.length - 1) * lineH;
        const qY     = PANEL_Y + 182 - totalH / 2;
        qLines.forEach((line, i) => ctx.fillText(line, W / 2, qY + i * lineH));
        ctx.restore();
    }

    // ── Decorative symbol row ──
    const SYMS = ['✿', '♡', '★', '✧', '✦'];
    ctx.save();
    ctx.font         = '14px sans-serif';
    ctx.fillStyle    = theme.accent1;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha  = 0.45;
    SYMS.forEach((s, i) => ctx.fillText(s, W / 2 + (i - 2) * 40, H - 92));
    ctx.restore();

    // ── stan.moe watermark ──
    ctx.save();
    ctx.font         = '400 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle    = theme.subtext;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha  = 0.26;
    ctx.letterSpacing = '0.12em';
    ctx.fillText('stan.moe', W / 2, H - 56);
    ctx.letterSpacing = '0';
    ctx.restore();

    // ── Corner bracket ornaments ──
    drawCornerMarks(ctx, W, H, 18, theme);

    // ── Film grain overlay ──
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.32;
    ctx.drawImage(getNoiseTexture(), 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // ── Holographic rainbow border (inside clip, fully visible) ──
    drawHoloBorder(ctx, W, H, CORNER_R);

    // ── Release card clip ──
    ctx.restore();
}

// ─── Event handling ──────────────────────────────────────────────────────────
function scheduleDraw() {
    clearTimeout(_drawTimer);
    _drawTimer = setTimeout(drawCard, 50);
}

['handle', 'fandom', 'quote'].forEach(id => {
    document.getElementById(id).addEventListener('input', scheduleDraw);
});

// Avatar upload
function handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
        const img   = new Image();
        img.onload  = () => {
            avatarImg = img;
            const preview = document.getElementById('avatar-preview');
            preview.src          = e.target.result;
            preview.style.display = 'block';
            document.querySelector('.avatar-upload-label').style.display = 'none';
            drawCard();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

const avatarFile = document.getElementById('avatar-file');
const avatarDrop = document.getElementById('avatar-drop');

avatarFile.addEventListener('change', e => handleImageFile(e.target.files[0]));

avatarDrop.addEventListener('dragover', e => {
    e.preventDefault();
    avatarDrop.classList.add('drag-over');
});
avatarDrop.addEventListener('dragleave', () => avatarDrop.classList.remove('drag-over'));
avatarDrop.addEventListener('drop', e => {
    e.preventDefault();
    avatarDrop.classList.remove('drag-over');
    handleImageFile(e.dataTransfer.files[0]);
});

// Theme picker
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTheme = btn.dataset.theme;
        drawCard();
    });
});

// Download — canvas is 2x, so export is 800×1200 for crisp sharing
document.getElementById('download-btn').addEventListener('click', () => {
    const canvas   = document.getElementById('card-canvas');
    const fandom   = document.getElementById('fandom').value.trim() || 'stan-card';
    const filename = fandom.replace(/[^a-z0-9\s]/gi, '').trim().replace(/\s+/g, '-').toLowerCase();
    const link     = document.createElement('a');
    link.download  = `${filename || 'stan-card'}-stan.moe.png`;
    link.href      = canvas.toDataURL('image/png');
    link.click();
});

// ─── Init ────────────────────────────────────────────────────────────────────
setupCanvas();
// Wait for fonts before first draw to avoid fallback-font flash
document.fonts.ready.then(drawCard);
