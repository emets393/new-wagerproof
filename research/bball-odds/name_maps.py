"""Team-name crosswalks between data sources.

Canonical spine = CBBD names (results_ncaab / cbbd_*_box) for NCAAB and
Odds-API full names (games_nba) for NBA. norm() before every comparison.
"""
import re


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


# KenPom -> CBBD. KenPom abbreviates trailing "St." for State schools; the rest
# are one-off renames/abbreviations verified against results_ncaab 2026-07-16.
KP_ALIASES = {
    "Albany": "UAlbany",
    "American": "American University",
    "Appalachian St.": "App State",
    "CSUN": "Cal State Northridge",
    "Cal St. Northridge": "Cal State Northridge",
    "Cal Baptist": "California Baptist",
    "Cal St. Bakersfield": "Cal State Bakersfield",
    "Cal St. Fullerton": "Cal State Fullerton",
    "Connecticut": "UConn",
    "FIU": "Florida International",
    "Grambling St.": "Grambling",
    "IU Indy": "IU Indianapolis",
    "IUPUI": "IU Indianapolis",
    "Illinois Chicago": "UIC",
    "LIU": "Long Island University",
    "Louisiana Monroe": "UL Monroe",
    "Loyola MD": "Loyola Maryland",
    "McNeese St.": "McNeese",
    "Miami FL": "Miami",
    "Mississippi": "Ole Miss",
    "Nebraska Omaha": "Omaha",
    "Nicholls St.": "Nicholls",
    "Penn": "Pennsylvania",
    "Queens": "Queens University",
    "SIUE": "SIU Edwardsville",
    "Saint Francis": "St. Francis (PA)",
    "Sam Houston St.": "Sam Houston",
    "San Jose St.": "San José State",
    "Seattle": "Seattle U",
    "Southeast Missouri": "Southeast Missouri State",
    "Southeastern Louisiana": "SE Louisiana",
    "St. Francis NY": "St. Francis Brooklyn",
    "St. Thomas": "St. Thomas-Minnesota",
    "Tennessee Martin": "UT Martin",
    "Texas A&M Commerce": "East Texas A&M",
    "Texas A&M Corpus Chris": "Texas A&M-Corpus Christi",
    "UMKC": "Kansas City",
    "USC Upstate": "South Carolina Upstate",
}


def kp_to_cbbd(name):
    name = str(name)
    if name in KP_ALIASES:
        return KP_ALIASES[name]
    if name.endswith(" St."):
        return name[:-4] + " State"
    return name
