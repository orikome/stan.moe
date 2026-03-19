"""
Fetches currently-airing anime with next episode air times from the AniList
GraphQL API, writes data/countdown.json, generates a static HTML page per
show under countdown/, and updates sitemap.xml.

AniList API is free and requires no authentication.
Runs every 3 hours via GitHub Actions.
"""

import html
import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join(SCRIPT_DIR, "..")
OUTPUT_PATH = os.path.join(ROOT_DIR, "data", "countdown.json")
COUNTDOWN_DIR = os.path.join(ROOT_DIR, "countdown")
SITEMAP_PATH = os.path.join(ROOT_DIR, "sitemap.xml")
ANILIST_URL = "https://graphql.anilist.co"
SITE_URL = "https://stan.moe"
LIMIT = 30

QUERY = """
query ($perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(
      status: RELEASING
      type: ANIME
      sort: POPULARITY_DESC
      format_in: [TV, TV_SHORT]
    ) {
      id
      title { romaji english }
      coverImage { large medium }
      siteUrl
      genres
      episodes
      format
      averageScore
      popularity
      bannerImage
      nextAiringEpisode {
        airingAt
        episode
      }
    }
  }
}
"""

# ---------------------------------------------------------------------------
# HTML template for individual show pages
# ---------------------------------------------------------------------------
SHOW_PAGE_TEMPLATE = """\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title_esc} Episode {next_episode} Countdown &mdash; stan.moe</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../style.css" />
    <link rel="stylesheet" href="countdown.css" />
    <link rel="icon" type="image/png" href="../favicon.ico" />
    <link rel="apple-touch-icon" href="../apple-touch-icon.png" />
    <meta name="color-scheme" content="dark" />
    <meta
      name="description"
      content="Countdown to {title_esc} episode {next_episode}. Live timer shows exactly when the next episode airs.{meta_genres}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="{page_url}" />
    <meta property="og:title" content="{title_esc} Episode {next_episode} Countdown &mdash; stan.moe" />
    <meta property="og:description" content="Live countdown to {title_esc} episode {next_episode} air date." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{page_url}" />
    <meta property="og:image" content="{og_image}" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="stan.moe" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{title_esc} Episode {next_episode} Countdown" />
    <meta name="twitter:description" content="Live countdown to {title_esc} episode {next_episode} air date." />
    <meta name="twitter:image" content="{twitter_image}" />
    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "TVEpisode",
      "name": "{title_json} Episode {next_episode}",
      "episodeNumber": {next_episode},
      "datePublished": "{air_date_iso}",
      "partOfSeries": {{
        "@type": "TVSeries",
        "name": "{title_json}",
        "url": "{anilist_url}"
      }},
      "url": "{page_url}",
      "isPartOf": {{
        "@type": "WebPage",
        "name": "Anime Episode Countdown",
        "url": "{site_url}/countdown/"
      }}
    }}
    </script>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-5CB9DW9ES5"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {{ dataLayer.push(arguments); }}
      gtag("js", new Date());
      gtag("config", "G-5CB9DW9ES5");
    </script>
  </head>
  <body class="countdown-page countdown-show-page" data-slug="{slug}">
    <div class="kawaii-elements">
      <div class="kawaii-element">&#10047;</div>
      <div class="kawaii-element">&#9825;</div>
      <div class="kawaii-element">&#9733;</div>
      <div class="kawaii-element">&#10023;</div>
      <div class="kawaii-element">&#10022;</div>
    </div>

    <div class="page-header">
      <a href="/countdown/" class="back-link">&larr; all countdowns</a>
    </div>

    <main class="show-detail" id="show-detail">
      <noscript>
        <h1>{title_esc}</h1>
        <p>Episode {next_episode} airs on {air_date_human}.</p>
        <p>Enable JavaScript to see the live countdown timer.</p>
      </noscript>
    </main>

    <div class="footer">
      <p>
        made by
        <a href="https://github.com/orikome" target="_blank">orikome</a>
      </p>
    </div>

    <script src="countdown.js"></script>
  </body>
</html>
"""


def slugify(title: str, anilist_id: int | None = None) -> str:
    """Convert a show title to a URL-safe slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60]
    if anilist_id is not None:
        slug = f"{slug}-{anilist_id}"
    return slug


def fetch_airing() -> list[dict]:
    """Fetch currently-airing anime with upcoming episode info."""
    response = requests.post(
        ANILIST_URL,
        json={"query": QUERY, "variables": {"perPage": LIMIT}},
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()

    media_list = data.get("data", {}).get("Page", {}).get("media", [])

    results = []
    seen_slugs: set[str] = set()

    for item in media_list:
        # Skip shows with no upcoming episode
        next_ep = item.get("nextAiringEpisode")
        if not next_ep or not next_ep.get("airingAt"):
            continue

        # Prefer English title, fall back to romaji
        title = (
            item.get("title", {}).get("english")
            or item.get("title", {}).get("romaji")
            or ""
        )
        title_romaji = item.get("title", {}).get("romaji") or ""

        # Validate URL
        site_url = item.get("siteUrl", "")
        if not site_url.startswith("https://anilist.co/"):
            site_url = ""

        # Cover image — prefer medium size for listing, large for detail
        cover = item.get("coverImage", {})
        cover_image = cover.get("large") or cover.get("medium") or ""

        # Banner image (can be null)
        banner_image = item.get("bannerImage") or ""

        # Generate slug, handle collisions
        slug = slugify(title)
        if slug in seen_slugs:
            slug = slugify(title, item["id"])
        seen_slugs.add(slug)

        results.append(
            {
                "slug": slug,
                "anilistId": int(item["id"]),
                "title": str(title)[:120],
                "titleRomaji": str(title_romaji)[:120],
                "coverImage": cover_image,
                "bannerImage": banner_image,
                "siteUrl": site_url,
                "genres": item.get("genres", [])[:2],
                "totalEpisodes": item.get("episodes"),
                "averageScore": item.get("averageScore"),
                "nextEpisode": next_ep["episode"],
                "airingAt": next_ep["airingAt"],
            }
        )

    # Sort by airing time (soonest first)
    results.sort(key=lambda x: x["airingAt"])
    return results


def load_existing_shows() -> list[dict]:
    """Load existing countdown data for comparison."""
    try:
        with open(OUTPUT_PATH, encoding="utf-8") as f:
            return json.load(f).get("shows", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def write_countdown_json(shows: list[dict]) -> None:
    """Write the countdown data file."""
    output = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "shows": shows,
    }
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(shows)} shows to {os.path.relpath(OUTPUT_PATH, ROOT_DIR)}")


def generate_show_pages(shows: list[dict]) -> set[str]:
    """Generate individual HTML pages for each show. Returns set of filenames created."""
    os.makedirs(COUNTDOWN_DIR, exist_ok=True)
    created_files: set[str] = set()

    for show in shows:
        filename = f"{show['slug']}.html"
        created_files.add(filename)
        filepath = os.path.join(COUNTDOWN_DIR, filename)

        airing_dt = datetime.fromtimestamp(show["airingAt"], tz=timezone.utc)
        genres_str = ", ".join(show["genres"]) if show["genres"] else ""
        meta_genres = f" {genres_str} anime." if genres_str else ""

        # Escape for HTML attributes / content
        title_esc = html.escape(show["title"])
        # Escape for JSON-LD (double-escape for JSON inside HTML)
        title_json = show["title"].replace("\\", "\\\\").replace('"', '\\"')

        page_url = f"{SITE_URL}/countdown/{filename}"
        og_image = show["coverImage"]
        twitter_image = show["bannerImage"] or show["coverImage"]
        anilist_url = show["siteUrl"]

        page_html = SHOW_PAGE_TEMPLATE.format(
            title_esc=title_esc,
            title_json=title_json,
            slug=html.escape(show["slug"]),
            next_episode=show["nextEpisode"],
            page_url=page_url,
            og_image=og_image,
            twitter_image=twitter_image,
            anilist_url=anilist_url,
            air_date_iso=airing_dt.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
            air_date_human=airing_dt.strftime("%B %d, %Y"),
            meta_genres=meta_genres,
            site_url=SITE_URL,
        )

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(page_html)

    print(f"Generated {len(created_files)} show pages in countdown/")
    return created_files


def cleanup_stale_pages(current_files: set[str]) -> None:
    """Delete HTML files in countdown/ that are no longer in the current data."""
    # Files we never touch
    keep = {"index.html"}

    for entry in os.listdir(COUNTDOWN_DIR):
        if not entry.endswith(".html"):
            continue
        if entry in keep or entry in current_files:
            continue
        path = os.path.join(COUNTDOWN_DIR, entry)
        os.remove(path)
        print(f"  Removed stale page: countdown/{entry}")


def update_sitemap(shows: list[dict]) -> None:
    """Regenerate sitemap.xml, preserving non-countdown entries."""
    ns = "http://www.sitemaps.org/schemas/sitemap/0.9"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Parse existing sitemap and keep non-countdown entries
    preserved: list[dict] = []
    try:
        tree = ET.parse(SITEMAP_PATH)
        for url_el in tree.findall(f"{{{ns}}}url"):
            loc_el = url_el.find(f"{{{ns}}}loc")
            if loc_el is not None and "/countdown" not in (loc_el.text or ""):
                entry: dict = {"loc": loc_el.text}
                freq_el = url_el.find(f"{{{ns}}}changefreq")
                prio_el = url_el.find(f"{{{ns}}}priority")
                if freq_el is not None:
                    entry["changefreq"] = freq_el.text
                if prio_el is not None:
                    entry["priority"] = prio_el.text
                preserved.append(entry)
    except (FileNotFoundError, ET.ParseError):
        # If sitemap is missing or broken, start fresh with defaults
        preserved = [
            {"loc": f"{SITE_URL}/", "changefreq": "monthly", "priority": "1.0"},
            {
                "loc": f"{SITE_URL}/card.html",
                "changefreq": "monthly",
                "priority": "0.9",
            },
        ]

    # Build new sitemap XML
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    for entry in preserved:
        lines.append("  <url>")
        lines.append(f"    <loc>{entry['loc']}</loc>")
        if "changefreq" in entry:
            lines.append(f"    <changefreq>{entry['changefreq']}</changefreq>")
        if "priority" in entry:
            lines.append(f"    <priority>{entry['priority']}</priority>")
        lines.append("  </url>")

    # Add countdown listing page
    lines.append("  <url>")
    lines.append(f"    <loc>{SITE_URL}/countdown/</loc>")
    lines.append(f"    <lastmod>{today}</lastmod>")
    lines.append("    <changefreq>daily</changefreq>")
    lines.append("    <priority>0.8</priority>")
    lines.append("  </url>")

    # Add individual show pages
    for show in shows:
        lines.append("  <url>")
        lines.append(f"    <loc>{SITE_URL}/countdown/{show['slug']}.html</loc>")
        lines.append(f"    <lastmod>{today}</lastmod>")
        lines.append("    <changefreq>daily</changefreq>")
        lines.append("    <priority>0.7</priority>")
        lines.append("  </url>")

    lines.append("</urlset>")

    with open(SITEMAP_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    total = len(preserved) + 1 + len(shows)
    print(f"Updated sitemap.xml ({total} URLs)")


def main() -> None:
    print("Fetching airing anime from AniList API...")
    shows = fetch_airing()

    if not shows:
        print("No airing shows found — skipping.")
        return

    existing = load_existing_shows()
    # Compare ignoring updated_at — just the show data
    if existing == shows:
        print("No changes in countdown data — skipping write.")
        return

    write_countdown_json(shows)
    created = generate_show_pages(shows)
    cleanup_stale_pages(created)
    update_sitemap(shows)

    for i, s in enumerate(shows[:10], 1):
        ep_info = f"Ep {s['nextEpisode']}"
        if s["totalEpisodes"]:
            ep_info += f"/{s['totalEpisodes']}"
        print(f"  #{i} {s['title']} — {ep_info}")
    if len(shows) > 10:
        print(f"  ... and {len(shows) - 10} more")


if __name__ == "__main__":
    main()
