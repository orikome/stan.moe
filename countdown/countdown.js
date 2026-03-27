// Anime countdown — handles both listing page and individual show pages

(function () {
  "use strict";

  const isShowPage = document.body.classList.contains("countdown-show-page");
  const slug = new URLSearchParams(window.location.search).get("slug");

  // ── Helpers ──

  function formatCountdown(airingAt) {
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

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function createTimerHTML(airingAt) {
    const cd = formatCountdown(airingAt);
    if (cd.expired) {
      return '<div class="timer-aired">Aired!</div>';
    }
    return (
      '<div class="timer" data-airing-at="' + airingAt + '">' +
        '<div class="timer-segment">' +
          '<div class="timer-value">' + cd.days + '</div>' +
          '<div class="timer-label">days</div>' +
        '</div>' +
        '<div class="timer-segment">' +
          '<div class="timer-value">' + pad(cd.hours) + '</div>' +
          '<div class="timer-label">hrs</div>' +
        '</div>' +
        '<div class="timer-segment">' +
          '<div class="timer-value">' + pad(cd.minutes) + '</div>' +
          '<div class="timer-label">min</div>' +
        '</div>' +
        '<div class="timer-segment">' +
          '<div class="timer-value">' + pad(cd.seconds) + '</div>' +
          '<div class="timer-label">sec</div>' +
        '</div>' +
      '</div>'
    );
  }

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function isValidAnilistUrl(url) {
    return typeof url === "string" && url.startsWith("https://anilist.co/");
  }

  // ── Tick all timers ──

  function tickTimers() {
    var timers = document.querySelectorAll("[data-airing-at]");
    for (var i = 0; i < timers.length; i++) {
      var el = timers[i];
      var airingAt = parseInt(el.dataset.airingAt, 10);
      var cd = formatCountdown(airingAt);

      if (cd.expired) {
        el.outerHTML = '<div class="timer-aired">Aired!</div>';
        continue;
      }

      var values = el.querySelectorAll(".timer-value");
      if (values.length === 4) {
        values[0].textContent = cd.days;
        values[1].textContent = pad(cd.hours);
        values[2].textContent = pad(cd.minutes);
        values[3].textContent = pad(cd.seconds);
      }
    }
  }

  // ── Listing page ──

  function renderGrid(shows) {
    var grid = document.getElementById("countdown-grid");
    if (!grid) return;

    for (var i = 0; i < shows.length; i++) {
      var s = shows[i];
      var card = document.createElement("a");
      card.className = "countdown-card";
      card.href = "show.html?slug=" + encodeURIComponent(s.slug);

      var epText = "Ep " + s.nextEpisode;
      if (s.totalEpisodes) epText += " / " + s.totalEpisodes;

      var scoreHtml = "";
      if (s.averageScore != null) {
        scoreHtml =
          '<span class="card-score">' +
          "\u2605 " + (s.averageScore / 10).toFixed(1) +
          "</span>";
      }

      var genreText = s.genres && s.genres.length ? s.genres.join(" \u00b7 ") : "";
      var genreHtml = genreText
        ? '<span class="card-genre">' + escapeHTML(genreText) + "</span>"
        : "";

      // Cover with overlay fade and episode badge
      var coverHtml = "";
      if (s.coverImage) {
        coverHtml =
          '<div class="card-cover-wrap">' +
            '<img class="card-cover" src="' + escapeHTML(s.coverImage) + '" alt="' + escapeHTML(s.title) + '" loading="lazy" />' +
            '<div class="card-cover-fade"></div>' +
            '<div class="card-episode-badge">' + escapeHTML(epText) + '</div>' +
          '</div>';
      }

      // Romaji subtitle
      var romajiHtml = "";
      if (s.titleRomaji && s.titleRomaji !== s.title) {
        romajiHtml = '<div class="card-title-romaji">' + escapeHTML(s.titleRomaji) + '</div>';
      }

      card.innerHTML =
        coverHtml +
        '<div class="card-body">' +
          '<div class="card-title">' + escapeHTML(s.title) + "</div>" +
          romajiHtml +
          '<div class="card-meta">' +
            genreHtml +
            scoreHtml +
          "</div>" +
          createTimerHTML(s.airingAt) +
        "</div>";

      grid.appendChild(card);
    }
  }

  // ── Show detail page ──

  function renderShowDetail(show) {
    var detail = document.getElementById("show-detail");
    if (!detail) return;

    var bannerHtml = "";
    if (show.bannerImage) {
      bannerHtml =
        '<div class="show-banner-wrap">' +
          '<img class="show-banner" src="' + escapeHTML(show.bannerImage) + '" alt="" />' +
          '<div class="show-banner-fade"></div>' +
        '</div>';
    }

    var coverHtml = show.coverImage
      ? '<img class="show-cover" src="' + escapeHTML(show.coverImage) + '" alt="' + escapeHTML(show.title) + '" />'
      : "";

    var romajiHtml = show.titleRomaji && show.titleRomaji !== show.title
      ? '<div class="show-title-romaji">' + escapeHTML(show.titleRomaji) + "</div>"
      : "";

    var tagsHtml = "";
    var tags = [];
    if (show.genres && show.genres.length) {
      for (var i = 0; i < show.genres.length; i++) {
        tags.push('<span class="show-tag">' + escapeHTML(show.genres[i]) + "</span>");
      }
    }
    if (show.averageScore != null) {
      tags.push('<span class="show-tag">\u2605 ' + (show.averageScore / 10).toFixed(1) + "</span>");
    }
    if (tags.length) {
      tagsHtml = '<div class="show-tags">' + tags.join("") + "</div>";
    }

    var epText = "Episode " + show.nextEpisode;
    if (show.totalEpisodes) epText += " of " + show.totalEpisodes;

    var linksHtml = "";
    if (isValidAnilistUrl(show.siteUrl)) {
      linksHtml =
        '<div class="show-links">' +
        '<a class="show-anilist-link" href="' + escapeHTML(show.siteUrl) + '" target="_blank" rel="noopener noreferrer">' +
        "View on AniList &rarr;" +
        "</a></div>";
    }

    detail.innerHTML =
      bannerHtml +
      '<div class="show-header">' +
        coverHtml +
        '<div class="show-info">' +
          '<h1 class="show-title">' + escapeHTML(show.title) + "</h1>" +
          romajiHtml +
          tagsHtml +
        "</div>" +
      "</div>" +
      '<div class="show-episode-info">' + escapeHTML(epText) + "</div>" +
      createTimerHTML(show.airingAt) +
      linksHtml;
  }

  // ── Load data ──

  async function loadCountdown() {
    try {
      var res = await fetch("../data/countdown.json");
      if (!res.ok) return;
      var data = await res.json();
      var shows = data.shows;
      if (!Array.isArray(shows) || !shows.length) return;

      if (isShowPage && slug) {
        var match = shows.find(function (s) {
          return s.slug === slug;
        });
        if (match) {
          renderShowDetail(match);
          document.title = match.title + " Episode " + match.nextEpisode + " Countdown \u2014 stan.moe";
        }
      } else {
        renderGrid(shows);
      }

      // Start ticking after render
      setInterval(tickTimers, 1000);
    } catch (_) {
      // silently fail — countdown is non-critical
    }
  }

  loadCountdown();
})();
