"""
Fetches the top currently-airing anime from the AniList GraphQL API
and writes the result to data/trending.json.

AniList API is free and requires no authentication.
Docs: https://anilist.gitbook.io/anilist-apiv2-docs/

Runs every 2 hours via GitHub Actions.
"""

import json
import os
from datetime import datetime, timezone

import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "data", "trending.json")
ANILIST_URL = "https://graphql.anilist.co"
LIMIT = 5

QUERY = """
query ($perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(status: RELEASING, type: ANIME, sort: POPULARITY_DESC) {
      id
      title { romaji english }
      averageScore
      genres
      siteUrl
    }
  }
}
"""


def fetch_trending() -> list[dict]:
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
    for item in media_list:
        # Prefer English title, fall back to romaji
        title = (
            item.get("title", {}).get("english")
            or item.get("title", {}).get("romaji")
            or ""
        )

        # Validate URL — only allow anilist.co links
        site_url = item.get("siteUrl", "")
        if not site_url.startswith("https://anilist.co/"):
            site_url = ""

        # AniList scores are 0-100; convert to 0-10 for display
        raw_score = item.get("averageScore")
        score = round(raw_score / 10, 1) if raw_score else None

        results.append(
            {
                "id": int(item["id"]),
                "title": str(title)[:120],
                "score": score,
                "genres": item.get("genres", [])[:2],
                "url": site_url,
            }
        )

    return results


def main() -> None:
    print("Fetching trending anime from AniList API...")
    anime = fetch_trending()

    output = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "anime": anime,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(anime)} entries to {os.path.relpath(OUTPUT_PATH)}")
    for i, a in enumerate(anime, 1):
        score = f"★ {a['score']}" if a["score"] else "no score"
        print(f"  #{i} {a['title']} — {score}")


if __name__ == "__main__":
    main()
