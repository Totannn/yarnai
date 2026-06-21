"""
Vertil — the Nigerian Brand Voice Engine.

This is the differentiator. Generic AI writes copy; this writes copy that sounds
like it came from a brand rooted in Surulere, Aba, Kano or Enugu. The engine
combines three layers:

  1. Brand Voice  — a stored profile (industry, audience, tone, samples) that is
                    injected into every generation so output always sounds like
                    *that* brand, not generic AI.
  2. Content Core — per-content-type templates tuned for Nigerian distribution
                    channels (WhatsApp, Jumia, Jiji, Meta ads, SMS...).
  3. Language Layer — a tone library of real Nigerian voices, not "broken English".
"""

from __future__ import annotations

# --------------------------------------------------------------------------- #
# Module 3 — Nigerian Language / Tone Library
# Each tone is a tested prompt configuration. Users pick from this menu.
# --------------------------------------------------------------------------- #

TONES: dict[str, dict] = {
    "pidgin": {
        "label": "Naija Pidgin",
        "emoji": "🗣️",
        "blurb": "Real Pidgin — street-smart, warm, high-energy.",
        "guidance": (
            "Write in authentic Nigerian Pidgin English — NOT broken English. "
            "Use correct, natural expressions the way real Nigerians speak: "
            "'e don set', 'no dey carry last', 'as e dey hot', 'e go better', "
            "'no dulling', 'we don land', 'sharp sharp', 'gbedu'. "
            "Keep it punchy and conversational. Pidgin is the language of trust and "
            "vibe on Nigerian social media — lean into the energy without overdoing slang."
        ),
    },
    "lagos_corporate": {
        "label": "Lagos Corporate",
        "emoji": "🏙️",
        "blurb": "Polished, ambitious, fintech/startup Lagos.",
        "guidance": (
            "Write in clean, confident, professional English with a Lagos startup edge — "
            "the way a Lagos fintech or tech company speaks. Aspirational but not stiff, "
            "modern, benefit-led. Occasional light, tasteful local flavour is fine, but "
            "the register is corporate and trustworthy. Think Paystack, Flutterwave, Kuda."
        ),
    },
    "yoruba_mix": {
        "label": "Yoruba Code-Switch",
        "emoji": "🧡",
        "blurb": "English with natural Yoruba phrases woven in.",
        "guidance": (
            "Write in English with natural Yoruba code-switching woven in the way Lagos "
            "and South-West brands actually speak. Sprinkle real Yoruba phrases where they "
            "land naturally: 'Owo ti e' (your money), 'E ku ise' (well done), 'Aje', "
            "'Omo to good', ' Se wa daadaa', 'Maa lo'. Always keep it understandable to a "
            "general Nigerian audience — the Yoruba should add warmth and identity, not block comprehension."
        ),
    },
    "igbo_market": {
        "label": "Igbo Market Voice",
        "emoji": "💼",
        "blurb": "Direct, value-focused, trust-building Eastern commerce.",
        "guidance": (
            "Write in the direct, value-driven, trust-building tone common in Eastern "
            "Nigerian commerce (Onitsha, Aba, Nnewi). Emphasise value-for-money, quality, "
            "durability and good business. Confident and persuasive. You may weave in light "
            "Igbo phrases naturally where they add warmth: 'Daalu' (thank you), 'Ngwa ngwa' "
            "(quickly), 'Ihe oma' (good thing) — but keep the core message in clear English."
        ),
    },
    "hausa_north": {
        "label": "Northern / Hausa Voice",
        "emoji": "🕌",
        "blurb": "Formal, respectful, relationship-first.",
        "guidance": (
            "Write in a formal, respectful, relationship-first tone suited to Northern "
            "Nigerian audiences (Kano, Kaduna, Sokoto). Lead with courtesy and trust. "
            "You may include respectful Hausa greetings/phrases where natural: 'Sannu' "
            "(hello/well done), 'Na gode' (thank you), 'Madalla' (excellent), 'Barka'. "
            "Keep the register dignified and warm; avoid slang."
        ),
    },
    "luxury": {
        "label": "Luxury / Premium",
        "emoji": "✨",
        "blurb": "Aspirational, exclusive, understated.",
        "guidance": (
            "Write in an aspirational, premium, understated tone for an affluent Nigerian "
            "audience. Confidence over loudness. Emphasise status, craftsmanship, exclusivity "
            "and taste. Minimal slang, no exclamation overload — let the prestige speak."
        ),
    },
    "religious": {
        "label": "Faith-Friendly",
        "emoji": "🙏",
        "blurb": "Warm, hopeful, faith-aware.",
        "guidance": (
            "Write in a warm, hopeful, faith-aware tone that resonates with Nigeria's deeply "
            "religious mainstream audience, without being preachy or excluding anyone. "
            "Gratitude, blessing and encouragement land well: 'God bless your hustle', "
            "'Favour no go finish'. Keep it inclusive and uplifting."
        ),
    },
    "friendly": {
        "label": "Friendly & Simple",
        "emoji": "😊",
        "blurb": "Clear, warm everyday English.",
        "guidance": (
            "Write in clear, warm, simple everyday Nigerian English. Friendly and approachable, "
            "easy for anyone to read. No heavy slang, no stiffness — just human and likeable."
        ),
    },
}

# --------------------------------------------------------------------------- #
# Module 2 — Content Generation Core
# Each content type has its own template tuned for the Nigerian channel it lives on.
# --------------------------------------------------------------------------- #

CONTENT_TYPES: dict[str, dict] = {
    "instagram_caption": {
        "label": "Instagram / Facebook Caption",
        "emoji": "📸",
        "spec": (
            "Write a scroll-stopping social media caption for Instagram/Facebook. "
            "Open with a strong hook in the first line. Keep it tight and punchy. "
            "End with a clear call-to-action and 4-8 relevant hashtags (mix Nigerian + niche). "
            "Use line breaks for readability. Emojis welcome but tasteful."
        ),
    },
    "tweet": {
        "label": "X / Twitter Post",
        "emoji": "🐦",
        "spec": (
            "Write a sharp post for X (Twitter), under 280 characters. One strong idea, "
            "punchy and shareable, built for Nigerian Twitter energy. Optional 1-2 hashtags."
        ),
    },
    "whatsapp_broadcast": {
        "label": "WhatsApp Broadcast",
        "emoji": "💬",
        "spec": (
            "Write a short, conversion-focused WhatsApp broadcast message ready to paste into "
            "WhatsApp Business. Personal and direct, like messaging a customer who already knows you. "
            "Use *bold* with single asterisks for emphasis (WhatsApp formatting). End with a clear "
            "next step (e.g. 'Reply YES to order'). Keep it brief — people skim on WhatsApp."
        ),
    },
    "product_description": {
        "label": "Product Description (Jumia/Jiji)",
        "emoji": "🛍️",
        "spec": (
            "Write a persuasive product description suited for Jumia, Jiji, a Shopify store or a "
            "WhatsApp catalogue. Lead with the key benefit, list standout features as short bullets, "
            "handle the obvious buyer objection (quality, delivery, price), and price in Naira (₦) if a "
            "price is implied. End with an action nudge. Build trust — Nigerian online buyers are cautious."
        ),
    },
    "sms": {
        "label": "SMS / Promo Blast",
        "emoji": "📱",
        "spec": (
            "Write a single SMS promotional message under 160 characters. Punchy, urgent, one offer, "
            "one action. Include the brand name. No fluff — every character counts."
        ),
    },
    "ad_copy": {
        "label": "Meta / Google Ad Copy",
        "emoji": "🎯",
        "spec": (
            "Write paid ad copy (Meta/Google). Provide: a primary text (2-3 short lines, hook + benefit + CTA), "
            "a punchy headline (under 40 chars), and a one-line description. Speak to the target customer's "
            "real desire or pain. Price in Naira if relevant."
        ),
    },
    "email": {
        "label": "Email / Newsletter",
        "emoji": "✉️",
        "spec": (
            "Write a marketing email. Provide a compelling subject line, a short preview line, and a body "
            "that is warm, skimmable and benefit-led, ending in one clear call-to-action button text. "
            "Keep paragraphs short."
        ),
    },
    "blog_intro": {
        "label": "Blog / Article Intro",
        "emoji": "📝",
        "spec": (
            "Write an engaging, SEO-aware introduction (2-3 paragraphs) for a blog article aimed at a "
            "Nigerian audience. Hook the reader, establish relevance to their life, and set up what the "
            "article will deliver. Naturally include the topic keywords."
        ),
    },
}

# Nigerian cultural calendar — injected so copy is contextually aware.
NAIJA_CALENDAR_CONTEXT = (
    "Be aware of the Nigerian cultural calendar and weave it in ONLY when relevant: "
    "Detty December (festive Dec spending), the 'ember months' rush, end-of-month salary "
    "cycles (pay-day promos land late-month/early-month), Ramadan & Eid, Christmas & Easter, "
    "Independence Day (Oct 1), Valentine, Black Friday, and 'school resumption' season. "
    "Reference local payment methods naturally where it fits: bank transfer, Opay/Palmpay/Moniepay, "
    "POS, 'send account number', pay on delivery."
)


def build_brand_block(profile: dict | None) -> str:
    """Render a stored Brand Profile into the system prompt. This is Module 1 —
    it's what makes every piece sound like the specific brand."""
    if not profile:
        return (
            "No specific brand profile was provided. Write for a general Nigerian "
            "small business with a friendly, trustworthy voice."
        )

    lines = ["You are the in-house copywriter for this specific Nigerian brand. "
             "Every word must sound like THIS brand:\n"]

    def add(label, key):
        val = (profile.get(key) or "").strip()
        if val:
            lines.append(f"- {label}: {val}")

    add("Brand name", "name")
    add("Industry", "industry")
    add("Target customer", "audience")
    add("Customer location", "location")
    add("What the brand sells / does", "description")
    add("Brand personality keywords", "personality")

    samples = (profile.get("samples") or "").strip()
    if samples:
        lines.append(
            "\nHere are real samples of content this brand likes. Match this voice, "
            "rhythm and vocabulary closely:\n\"\"\"\n" + samples + "\n\"\"\""
        )

    return "\n".join(lines)


def _liked_block(liked_examples: list[str] | None) -> str:
    if not liked_examples:
        return ""
    joined = "\n\n".join(f"• {e.strip()}" for e in liked_examples if e and e.strip())
    if not joined:
        return ""
    return (
        "\n\n# WHAT THIS BRAND LOVES (learned from past 👍 feedback)\n"
        "The brand rated these past pieces as spot-on. Emulate their energy, rhythm "
        "and word choice — this is the voice working:\n" + joined
    )


def build_system_prompt(profile: dict | None, tone_key: str,
                        liked_examples: list[str] | None = None) -> str:
    """Assemble the full Nigerian-tuned system prompt for a generation request."""
    tone = TONES.get(tone_key, TONES["friendly"])
    brand_block = build_brand_block(profile)

    return f"""You are Vertil — Nigeria's sharpest brand copywriter. You write marketing \
copy that sounds like it came from a real, rooted Nigerian brand — never generic, \
never stiff "international AI" English. You deeply understand Nigerian consumer \
psychology, humour, hustle culture and what actually makes people in Lagos, Aba, \
Kano, Enugu, Port Harcourt and Abuja stop scrolling and buy.

# THE BRAND
{brand_block}{_liked_block(liked_examples)}

# THE VOICE FOR THIS PIECE — {tone['label']}
{tone['guidance']}

# NIGERIAN CONTEXT
{NAIJA_CALENDAR_CONTEXT}
All prices are in Nigerian Naira (₦). Write for Nigerians, in a Nigerian voice, \
about Nigerian realities.

# RULES
- Sound human and rooted, never like a template or a generic AI assistant.
- Match the brand voice above more than any generic "best practice".
- Be specific and vivid; avoid empty marketing filler ("top-notch quality", "we are the best").
- Respect the requested format exactly.
- Do not explain yourself, do not add notes or disclaimers — output ONLY the finished copy.
"""


# ----------------------- refine + brand extraction ------------------------ #

REFINE_PRESETS = {
    "shorter": "Make it noticeably shorter and tighter — cut every word that isn't pulling weight.",
    "punchier": "Make the hook punchier and more scroll-stopping. Stronger opening line.",
    "more_pidgin": "Lean more into authentic Nigerian Pidgin and street energy.",
    "more_pro": "Make it a touch more polished and professional, less slangy.",
    "add_cta": "Strengthen the call-to-action so it drives an immediate next step.",
    "more_emojis": "Add a few tasteful, well-placed emojis to lift the energy.",
}


def build_refine_prompt(profile: dict | None, tone_key: str, original: str,
                        instruction: str) -> tuple[str, str]:
    """System + user prompt to refine one existing piece of copy."""
    system = build_system_prompt(profile, tone_key)
    instr = REFINE_PRESETS.get(instruction, instruction).strip() or "Improve this copy."
    user = (
        "Here is a piece of copy you wrote earlier:\n"
        f"\"\"\"\n{original.strip()}\n\"\"\"\n\n"
        f"Revise it: {instr}\n\n"
        "Keep the same brand voice and language. Output ONLY the revised copy — no notes."
    )
    return system, user


def build_extract_brand_system() -> str:
    return """You analyse a Nigerian brand's existing content and infer its brand profile.
From the samples the user pastes, deduce the brand's identity. Return ONLY valid JSON \
(no markdown, no commentary) in exactly this shape:
{
  "name": "best guess at brand name or empty string",
  "industry": "...",
  "audience": "target customer in one phrase",
  "location": "likely customer location in Nigeria",
  "description": "what the brand sells / does, one sentence",
  "personality": "3-6 voice/personality keywords, comma-separated"
}
Infer from tone, vocabulary, products mentioned and language mix. If something is \
genuinely unknowable, use an empty string. Output JSON only."""


def parse_brand_json(text: str) -> dict:
    import json

    raw = text.strip().strip("`")
    if raw.lower().startswith("json"):
        raw = raw[4:]
    s, e = raw.find("{"), raw.rfind("}")
    if s != -1 and e != -1:
        raw = raw[s:e + 1]
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    keys = ("name", "industry", "audience", "location", "description", "personality")
    return {k: str(data.get(k, "")).strip() for k in keys}


def build_user_prompt(content_type_key: str, brief: str, variants: int) -> str:
    """Build the user turn describing the content type, the brief, and how many variants."""
    ct = CONTENT_TYPES.get(content_type_key, CONTENT_TYPES["instagram_caption"])
    brief = (brief or "").strip() or "a general promotional piece for the brand"

    return f"""Create {ct['label']}.

FORMAT SPEC:
{ct['spec']}

THE BRIEF (what to write about):
{brief}

Produce exactly {variants} distinct option(s). Make each option genuinely different \
in angle or hook — not minor rewordings. Separate each option with a line containing \
only '---' (three dashes) and nothing else. Do not number them or add any other commentary."""


def list_tones() -> list[dict]:
    return [{"key": k, **{x: v[x] for x in ("label", "emoji", "blurb")}} for k, v in TONES.items()]


def list_content_types() -> list[dict]:
    return [{"key": k, **{x: v[x] for x in ("label", "emoji")}} for k, v in CONTENT_TYPES.items()]


def split_variants(text: str) -> list[str]:
    """Split the model output into individual variants on '---' separators."""
    parts = [p.strip() for p in text.split("\n---")]
    # also handle a leading '---' or inline separators
    cleaned: list[str] = []
    for p in parts:
        p = p.strip().strip("-").strip()
        if p:
            cleaned.append(p)
    return cleaned or [text.strip()]


# --------------------------------------------------------------------------- #
# Module 4 — Content Calendar Builder
# Claude proposes a month of posts, anchored to the Nigerian cultural calendar.
# --------------------------------------------------------------------------- #

CADENCE_COUNTS = {
    "2_week": ("2 posts per week", 8),
    "3_week": ("3 posts per week", 12),
    "4_week": ("4 posts per week", 16),
    "daily":  ("daily-ish (5 per week)", 20),
}


def build_calendar_system(profile: dict | None) -> str:
    brand_block = build_brand_block(profile)
    valid_ct = ", ".join(CONTENT_TYPES.keys())
    valid_tone = ", ".join(TONES.keys())
    return f"""You are Vertil's content strategist for Nigerian brands. You plan \
monthly social media calendars that ride the rhythm of Nigerian life — pay-day \
cycles, public holidays, religious moments, cultural waves (Detty December, ember \
months, Valentine, Independence Day, Black Friday, school resumption) — so the brand \
always shows up at the right moment with the right message.

# THE BRAND
{brand_block}

# NIGERIAN CONTEXT
{NAIJA_CALENDAR_CONTEXT}

# YOUR JOB
Plan a content calendar. For each post pick the best content_type and tone, give a \
sharp content theme/idea, a scroll-stopping hook line, and tie it to a real reason \
(an occasion, a salary-cycle moment, or a brand goal). Spread posts sensibly across \
the weeks; cluster more energy around the big cultural moments of THAT specific month.

content_type MUST be one of: {valid_ct}
tone MUST be one of: {valid_tone}

# OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no commentary), exactly this shape:
{{
  "posts": [
    {{
      "day": 1,
      "occasion": "short reason / cultural moment",
      "theme": "what the post is about (one sentence)",
      "hook": "the opening line that stops the scroll",
      "content_type": "instagram_caption",
      "tone": "pidgin"
    }}
  ]
}}
Sort posts by ascending day. Use realistic day numbers (1-28/30/31) for the month."""


def build_calendar_user(month: str, year: int, cadence_key: str) -> str:
    desc, count = CADENCE_COUNTS.get(cadence_key, CADENCE_COUNTS["3_week"])
    return (
        f"Plan the content calendar for {month} {year}. "
        f"Cadence: {desc} — produce about {count} posts total. "
        f"Anchor the plan to what actually happens in Nigeria during {month} "
        f"(holidays, salary cycles, cultural moments, weather/season). "
        f"Return ONLY the JSON object."
    )


def parse_calendar_json(text: str) -> list[dict]:
    """Robustly pull the posts array out of the model's response."""
    import json

    raw = text.strip()
    if raw.startswith("```"):  # strip code fences if present
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end + 1]
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    posts = data.get("posts", []) if isinstance(data, dict) else []
    cleaned = []
    for p in posts:
        if not isinstance(p, dict):
            continue
        ct = p.get("content_type") if p.get("content_type") in CONTENT_TYPES else "instagram_caption"
        tn = p.get("tone") if p.get("tone") in TONES else "friendly"
        try:
            day = int(p.get("day", 1))
        except (TypeError, ValueError):
            day = 1
        cleaned.append({
            "day": max(1, min(day, 31)),
            "occasion": str(p.get("occasion", "")).strip(),
            "theme": str(p.get("theme", "")).strip(),
            "hook": str(p.get("hook", "")).strip(),
            "content_type": ct,
            "tone": tn,
        })
    cleaned.sort(key=lambda x: x["day"])
    return cleaned


def list_cadences() -> list[dict]:
    return [{"key": k, "label": v[0], "count": v[1]} for k, v in CADENCE_COUNTS.items()]


def content_type_meta(key: str) -> dict:
    return CONTENT_TYPES.get(key, CONTENT_TYPES["instagram_caption"])


def tone_meta(key: str) -> dict:
    return TONES.get(key, TONES["friendly"])


def _extract_json(text: str) -> dict:
    """Pull the outermost JSON object out of a model response (handles code fences)."""
    import json

    raw = text.strip().strip("`")
    if raw.lower().startswith("json"):
        raw = raw[4:]
    s, e = raw.find("{"), raw.rfind("}")
    if s != -1 and e != -1:
        raw = raw[s:e + 1]
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _num(v, default: int = 0) -> int:
    try:
        return int(float(str(v).replace("₦", "").replace(",", "").strip()))
    except (TypeError, ValueError):
        return default


# --------------------------------------------------------------------------- #
# Module 5 — Gig Rate Advisor ("Wetin to charge")
# Realistic Naira pricing for the Nigerian freelancer / creator economy.
# --------------------------------------------------------------------------- #

GIG_CATEGORIES = [
    "Social media management", "Content creation (video)", "Graphic design",
    "Photography", "Videography", "Copywriting / content writing", "Web development",
    "Makeup artistry", "Fashion design / tailoring", "MC / event host", "DJ",
    "Catering / small chops", "Event planning / decor", "Brand strategy / consulting",
    "Influencer / UGC campaign", "Voiceover", "Virtual assistance", "Other",
]
EXPERIENCE_LEVELS = [
    "Just starting (0–1 yr)", "Intermediate (1–3 yrs)",
    "Experienced (3–5 yrs)", "Expert (5+ yrs)",
]
CLIENT_TYPES = [
    "Individual", "Small business / SME", "Startup",
    "Large company / corporate", "Agency", "NGO / Government",
]


def build_rate_system() -> str:
    return """You are Vertil's Naija Rate Advisor — a sharp, experienced Nigerian \
freelance/creative-business consultant. You help Nigerians price their gigs CONFIDENTLY \
and FAIRLY for the current Nigerian market, in Naira (₦). You know real local rates: \
what a Lagos brand actually pays a social media manager, what an Aba tailor charges, \
what UGC creators get, how Abuja corporate budgets differ from SME budgets. You fight \
the Nigerian habit of underpricing ("collecting small money for big work").

Give realistic, current Nigerian market ranges — not Western/dollar rates. Factor in \
the person's experience, the client type (corporates pay more than individuals), \
location, and scope. Be encouraging but grounded.

Return ONLY valid JSON (no markdown, no commentary), exactly this shape:
{
  "service": "the service, restated cleanly",
  "recommended": {"low": 50000, "mid": 90000, "high": 160000, "unit": "per month"},
  "summary": "one punchy sentence with the headline recommendation",
  "factors": ["3-5 short bullets explaining what drives this range for THEM"],
  "pitch": "2-4 sentences they can say to confidently quote this price to the client",
  "tips": ["3-4 short pricing/negotiation tips for the Nigerian market"],
  "upsells": ["2-3 ways to package or add-on to charge more"]
}
All money values are plain integers in Naira (no symbols, no commas). 'unit' is e.g. \
'per month', 'per project', 'per post', 'per day', 'per plate'."""


def build_rate_user(d: dict) -> str:
    parts = [
        f"Service / gig: {d.get('service', '').strip() or 'a creative service'}",
        f"Experience level: {d.get('experience', '').strip() or 'not stated'}",
        f"Location: {d.get('location', '').strip() or 'Nigeria (general)'}",
        f"Client type: {d.get('client_type', '').strip() or 'not stated'}",
    ]
    scope = d.get("scope", "").strip()
    if scope:
        parts.append(f"Scope / deliverables: {scope}")
    return ("Advise on what to charge.\n" + "\n".join(parts) +
            "\n\nReturn ONLY the JSON object.")


def parse_rate_json(text: str) -> dict:
    data = _extract_json(text)
    rec = data.get("recommended", {}) if isinstance(data.get("recommended"), dict) else {}
    return {
        "service": str(data.get("service", "")).strip(),
        "recommended": {
            "low": _num(rec.get("low")), "mid": _num(rec.get("mid")),
            "high": _num(rec.get("high")), "unit": str(rec.get("unit", "per project")).strip(),
        },
        "summary": str(data.get("summary", "")).strip(),
        "factors": [str(x).strip() for x in (data.get("factors") or []) if str(x).strip()][:6],
        "pitch": str(data.get("pitch", "")).strip(),
        "tips": [str(x).strip() for x in (data.get("tips") or []) if str(x).strip()][:5],
        "upsells": [str(x).strip() for x in (data.get("upsells") or []) if str(x).strip()][:4],
    }


# --------------------------------------------------------------------------- #
# Module 6 — Personal Branding Advisor
# Strategy for creators/freelancers: positioning, pillars, target brands.
# --------------------------------------------------------------------------- #

CONTENT_FORMATS = [
    "Short-form video (TikTok / Reels)", "YouTube", "Twitter / X threads",
    "Instagram posts", "LinkedIn", "Blog / Newsletter", "Podcast", "Photography",
]
BRAND_TYPES = [
    "Fintech", "Fashion & beauty", "FMCG / consumer goods", "Tech / SaaS",
    "Food & beverage", "Telecoms", "Entertainment / music", "Hospitality / travel",
    "Health & wellness", "Education", "Real estate", "Automobile",
]


def build_personal_brand_system() -> str:
    return """You are Vertil's Personal Branding Advisor for Nigerian creators, \
freelancers and professionals. You design sharp, authentic personal-brand strategies \
that win attention and brand deals in the Nigerian market. You understand Nigerian \
social media culture, what local brands look for in creators/ambassadors, and how to \
stand out without being fake. Be specific, practical and encouraging — Naija context, \
real platforms, real brand names where useful.

Return ONLY valid JSON (no markdown, no commentary), exactly this shape:
{
  "positioning": "a one-paragraph positioning statement — who they are, for whom, why they matter",
  "tagline": "a short, memorable personal tagline",
  "niche": "the refined niche/lane in a few words",
  "content_pillars": [
    {"name": "pillar name", "description": "what it covers and why it works", "ideas": ["concrete post idea 1", "idea 2", "idea 3"]}
  ],
  "voice": "describe the content voice/personality they should own",
  "target_brands": [
    {"type": "brand category", "examples": "1-3 real Nigerian brand examples", "why": "why they're a fit", "pitch": "how to approach / pitch them"}
  ],
  "bio_options": ["2-3 ready-to-use social bio options"],
  "next_steps": ["3-5 concrete actions to take in the next 30 days"]
}
Give 3-5 content_pillars and 3-5 target_brands."""


def build_personal_brand_user(d: dict) -> str:
    fmts = ", ".join(d.get("formats", [])) if isinstance(d.get("formats"), list) else str(d.get("formats", ""))
    brands = ", ".join(d.get("brand_types", [])) if isinstance(d.get("brand_types"), list) else str(d.get("brand_types", ""))
    parts = [
        f"Interests / niche: {d.get('interests', '').strip() or 'not stated'}",
        f"Content they want to create: {fmts.strip() or 'not stated'}",
        f"Types of brands they want to work with: {brands.strip() or 'open'}",
    ]
    if d.get("platform", "").strip():
        parts.append(f"Main platform / current audience: {d.get('platform').strip()}")
    if d.get("goal", "").strip():
        parts.append(f"Their goal: {d.get('goal').strip()}")
    return ("Design a personal brand strategy for this Nigerian creator.\n" +
            "\n".join(parts) + "\n\nReturn ONLY the JSON object.")


def parse_brand_advice_json(text: str) -> dict:
    data = _extract_json(text)

    def slist(key, n):
        return [str(x).strip() for x in (data.get(key) or []) if str(x).strip()][:n]

    pillars = []
    for p in (data.get("content_pillars") or [])[:5]:
        if not isinstance(p, dict):
            continue
        pillars.append({
            "name": str(p.get("name", "")).strip(),
            "description": str(p.get("description", "")).strip(),
            "ideas": [str(x).strip() for x in (p.get("ideas") or []) if str(x).strip()][:4],
        })
    targets = []
    for t in (data.get("target_brands") or [])[:5]:
        if not isinstance(t, dict):
            continue
        targets.append({
            "type": str(t.get("type", "")).strip(),
            "examples": str(t.get("examples", "")).strip(),
            "why": str(t.get("why", "")).strip(),
            "pitch": str(t.get("pitch", "")).strip(),
        })
    return {
        "positioning": str(data.get("positioning", "")).strip(),
        "tagline": str(data.get("tagline", "")).strip(),
        "niche": str(data.get("niche", "")).strip(),
        "content_pillars": pillars,
        "voice": str(data.get("voice", "")).strip(),
        "target_brands": targets,
        "bio_options": slist("bio_options", 3),
        "next_steps": slist("next_steps", 6),
    }


def advisor_options() -> dict:
    return {
        "gig_categories": GIG_CATEGORIES,
        "experience_levels": EXPERIENCE_LEVELS,
        "client_types": CLIENT_TYPES,
        "content_formats": CONTENT_FORMATS,
        "brand_types": BRAND_TYPES,
    }
