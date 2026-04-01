"""
Fetches currently-airing anime with next episode air times from the AniList
GraphQL API, writes data/countdown.json and updates sitemap.xml.

AniList API is free and requires no authentication.
Runs every 3 hours via GitHub Actions.
"""

import json
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join(SCRIPT_DIR, "..")
OUTPUT_PATH = os.path.join(ROOT_DIR, "data", "countdown.json")
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



def slugify(title: str, anilist_id: int | None = None) -> str:
    """Convert a show title to a URL-safe slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60]
    if anilist_id is not None:
        slug = f"{slug}-{anilist_id}"
    return slug


def fetch_airing() -> list[dict]:
    """Fetch currently-airing anime with upcoming episode info."""
    last_exc: Exception | None = None
    for attempt in range(3):
        if attempt:
            wait = 2 ** attempt  # 2s, 4s
            print(f"Retrying in {wait}s (attempt {attempt + 1}/3)...")
            time.sleep(wait)
        try:
            response = requests.post(
                ANILIST_URL,
                json={"query": QUERY, "variables": {"perPage": LIMIT}},
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=30,
            )
            response.raise_for_status()
            break
        except requests.exceptions.RequestException as exc:
            print(f"Attempt {attempt + 1} failed: {exc}")
            last_exc = exc
    else:
        raise last_exc  # type: ignore[misc]
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
        lines.append(f"    <loc>{SITE_URL}/countdown/show.html?slug={show['slug']}</loc>")
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
