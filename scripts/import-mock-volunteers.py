#!/usr/bin/env python3
"""Turn the mock "Volunteer Application Responses" spreadsheet into demo volunteers.

    python3 -I scripts/import-mock-volunteers.py <responses.xlsx> > /tmp/mock.sql
    node scripts/db.mjs file /tmp/mock.sql
    node scripts/db.mjs sql "select public.reset_demo_data()"

Only profile-safe fields are imported. Health answers, medication, pregnancy, injuries, criminal record,
emergency contacts, street addresses, vehicle plates, ID photos, age and gender are never read into the app.
Every person becomes a demo account (walled off from real data) with an address on the reserved
mock.sevasetu.demo domain and a random password nobody knows (they cannot sign in).
"""
import hashlib
import json
import re
import secrets
import sys
import unicodedata
import uuid

import openpyxl

NS = uuid.UUID("5e7a5e7a-0000-4000-8000-00000000d0d0")

PROVINCES = {"québec": ("QC", "CA"), "quebec": ("QC", "CA"), "ontario": ("ON", "CA"), "nova scotia": ("NS", "CA"),
             "alberta": ("AB", "CA"), "british columbia": ("BC", "CA"), "manitoba": ("MB", "CA"),
             "saskatchewan": ("SK", "CA"), "new brunswick": ("NB", "CA"),
             "massachusetts": ("MA", "US"), "vermont": ("VT", "US"), "new york": ("NY", "US")}
CITIES = {"boston": (42.3601, -71.0589), "brampton": (43.7315, -79.7624), "burlington": (44.4759, -73.2121),
          "calgary": (51.0447, -114.0719), "gatineau": (45.4765, -75.7013), "halifax": (44.6488, -63.5752),
          "laval": (45.6066, -73.7124), "mississauga": (43.5890, -79.6441), "montréal": (45.5019, -73.5674),
          "new york": (40.7128, -74.0060), "ottawa": (45.4215, -75.6972), "québec city": (46.8139, -71.2080),
          "sherbrooke": (45.4042, -71.8929), "toronto": (43.6532, -79.3832), "vancouver": (49.2827, -123.1207)}
LEVEL = {"professional": "expert", "experienced": "intermediate", "beginner": "beginner"}
AREA_FROM_EXPERIENCE = {"children's programs": "kids_youth", "audio-visual / tech": "technology", "wellness / spa": "meditation",
                        "reception / front desk": "event_setup", "hospitality / guest services": "event_setup",
                        "kitchen / food service": "food", "event management": "event_setup", "retail / boutique": "fundraising",
                        "transportation / shuttle": "logistics", "security / parking": "logistics",
                        "photography / social media": "design_media", "housekeeping": "logistics"}
# department column -> (skill key, seva area when Experienced or Professional)
DEPARTMENTS = {35: ("kitchen", "food"), 36: ("av_tech", "technology"), 38: ("housekeeping", "logistics"),
               39: ("office", "administration"), 40: ("childcare", "kids_youth"), 41: ("construction", "logistics"),
               42: ("grounds", "environment")}
OTHER_AREA = {"it_support": "technology", "event_coordination": "event_setup", "project_management": "administration",
              "customer_service": "event_setup", "marketing": "outreach", "retail_sales": "fundraising",
              "data_analytics": "data", "fundraising_and_donor_support": "fundraising", "graphic_design": "design_media",
              "procurement": "logistics", "stage_design": "event_setup"}
LANG = {"english": "english", "french": "french", "hindi": "hindi", "spanish": "spanish", "gujarati": "gujarati",
        "punjabi": "punjabi", "tamil": "tamil", "telugu": "telugu", "marathi": "marathi", "bengali": "bengali"}


def sq(v):
    return "null" if v is None else "'" + str(v).replace("'", "''") + "'"


def arr(items):
    return "'{" + ",".join(items) + "}'::text[]"


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def yes(v):
    return str(v or "").lower().startswith("yes")


def level_of(text):
    t = str(text or "").lower()
    for k, v in LEVEL.items():
        if t.startswith(k):
            return v
    return None


def main(path):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = [r for r in ws.iter_rows(values_only=True) if r and r[1]][1:]
    used = set()
    out = ["begin;"]
    for r in rows:
        first, last = str(r[13] or "").strip(), str(r[14] or "").strip()
        if not first:
            continue
        local = f"{slug(first)}.{slug(last)}"
        n = 1
        while local + ("" if n == 1 else str(n)) in used:
            n += 1
        local += "" if n == 1 else str(n)
        used.add(local)
        email = f"{local}@mock.sevasetu.demo"
        uid = str(uuid.uuid5(NS, email))
        h = int(hashlib.md5(email.encode()).hexdigest(), 16)

        prov, country = PROVINCES.get(str(r[23] or "").strip().lower(), (None, "CA"))
        city_name = str(r[22] or "").strip()
        lat, lng = CITIES.get(city_name.lower(), (None, None))
        city = f"{city_name}, {prov}" if prov else city_name

        skills, levels, areas = [], {}, set()
        for col, (key, area) in DEPARTMENTS.items():
            lv = level_of(r[col])
            if lv:
                skills.append(key)
                levels[key] = lv
                if lv in ("expert", "intermediate"):
                    areas.add(area)
        for part in str(r[43] or "").split(";"):
            if "–" not in part:
                continue
            name, lv = [x.strip() for x in part.split("–", 1)]
            key = slug(name)
            lv = level_of(lv)
            if lv and key:
                key = {"retail_sales": "retail", "fundraising_and_donor_support": "fundraising"}.get(key, key)
                skills.append(key)
                levels[key] = lv
                if slug(name) in OTHER_AREA and lv != "beginner":
                    areas.add(OTHER_AREA[slug(name)])
        for col, key in ((31, "first_responder"), (32, "doctor"), (33, "nurse"), (34, "first_aid")):
            if yes(r[col]):
                skills.append(key)
                levels[key] = "expert" if key != "first_aid" else "intermediate"
        if yes(r[59]):
            years = float(r[61] or 0)
            skills.append("driving")
            levels["driving"] = "expert" if years >= 10 else "intermediate" if years >= 3 else "beginner"
        strengths = str(r[30] or "").lower()
        if "data entry" in strengths:
            skills.append("data_entry")
        if "customer service" in strengths:
            skills.append("customer_service")
        if "landscaping" in strengths:
            skills.append("gardening")
        if "large-scale cooking" in strengths:
            skills.append("cooking")
            levels["cooking"] = "expert"
        for exp in str(r[44] or "").split(", "):
            a = AREA_FROM_EXPERIENCE.get(exp.strip().lower())
            if a:
                areas.add(a)

        languages = []
        for part in str(r[58] or "").split(";"):
            name = part.split("–")[0].strip().lower()
            if name in LANG and LANG[name] not in languages:
                languages.append(LANG[name])
        if "french" in languages and "english" in languages:
            skills.append("translation")
            areas.add("translation") if h % 3 == 0 else None

        courses = []
        if r[70] and str(r[70]).strip() not in ("None", ""):
            courses.append("part1")
        if r[71] and str(r[71]).strip() not in ("None", ""):
            courses.append("part2")
        if yes(r[11]):
            courses.append("vtp")
        teacher = str(r[73] or "").strip()
        is_teacher = teacher and not teacher.lower().startswith("no")
        if is_teacher or (r[72] and str(r[72]).strip() not in ("None", "")):
            courses.append("teachers")
        if is_teacher:
            skills += ["teaching", "facilitation"]
            levels["teaching"] = "expert"
            areas.update({"teaching", "meditation"})

        skills = list(dict.fromkeys(skills))[:20]
        areas = sorted(areas)[:8] or ["event_setup"]
        experienced = yes(r[9])
        available = str(r[2] or "").lower().startswith("yes")
        arrival = r[3].date().isoformat() if hasattr(r[3], "date") else None
        hours = ["1-2", "3-5", "6+"][h % 3]

        out.append(f"""
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', {sq(uid)}, 'authenticated', 'authenticated', {sq(email)},
  extensions.crypt({sq(secrets.token_urlsafe(24))}, extensions.gen_salt('bf')), now(),
  '{{"provider":"email","providers":["email"]}}', jsonb_build_object('full_name', {sq(first + ' ' + last)}),
  {sq(r[0].isoformat() if hasattr(r[0], 'isoformat') else None)}::timestamptz, now(), '', '', '', '')
on conflict (id) do nothing;
update public.profiles set is_demo = true, full_name = {sq(first + ' ' + last)}, city = {sq(city)}, province = {sq(prov)},
  country = {sq(country)}, latitude = {lat if lat is not None else 'null'}, longitude = {lng if lng is not None else 'null'},
  radius_km = 50, serve_mode = {sq(['either', 'either', 'onsite'][h % 3])}, interests = {arr(areas)}, skills = {arr(skills)},
  skill_levels = {sq(json.dumps(levels))}::jsonb, languages = {arr(languages)}, courses = {arr(sorted(set(courses)))},
  person_type = {sq('volunteer_teacher' if is_teacher else 'volunteer')}, profession = {sq(str(r[27] or '').strip()[:80] or None)},
  hours_per_week = {sq(hours)}, directory_opt_in = true, onboarded_at = coalesce(onboarded_at, now()), locale = {sq('fr' if prov == 'QC' and h % 2 == 0 else 'en')}
where id = {sq(uid)};
insert into public.demo_volunteer_seed (user_id, experienced, last_seva, available_retreat, arrival, large_groups)
values ({sq(uid)}, {str(experienced).lower()}, {sq(None if str(r[10]) == 'None' else r[10])}, {str(available).lower()},
  {sq(arrival)}::date, {str(yes(r[28])).lower()})
on conflict (user_id) do update set experienced = excluded.experienced, last_seva = excluded.last_seva,
  available_retreat = excluded.available_retreat, arrival = excluded.arrival, large_groups = excluded.large_groups;
delete from public.availability_slots where user_id = {sq(uid)};""")
        # weekly availability isn't on the form: give most people a plausible pattern, leave ~1 in 7 blank
        if h % 7 != 0:
            slots = set()
            for w in (5, 6):
                slots.add((w, ["morning", "afternoon"][h % 2]))
            if h % 3 == 0:
                slots.update((w, "evening") for w in range(0, 5, 2))
            if h % 5 == 0:
                slots.update((w, "morning") for w in range(0, 5))
            values = ", ".join(f"({sq(uid)}, {w}, '{p}')" for w, p in sorted(slots))
            out.append(f"insert into public.availability_slots (user_id, weekday, period) values {values};")
    out.append("commit;")
    print("\n".join(out))


if __name__ == "__main__":
    main(sys.argv[1])
