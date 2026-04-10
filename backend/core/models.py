"""
QuranSRT Data Models — models.py

Berisi semua Pydantic models (schema request/response) dan
data statis (daftar reciter, terjemahan, surah).
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from enum import Enum


# ── Enums ─────────────────────────────────────────────────────────────────────

class SRTMode(str, Enum):
    WAQOF  = "WAQOF"   # Pecah per tanda waqof (natural pause)
    VERSE  = "VERSE"   # Satu ayat = satu subtitle
    STD    = "STD"     # Standard, batas karakter per baris


# ── Request & Response Models ─────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    """Parameter untuk generate file SRT."""
    surah:           int = Field(..., ge=1, le=114, description="Nomor surah (1-114)")
    start_verse:     int = Field(..., ge=1,         description="Ayat awal")
    end_verse:       int = Field(..., ge=1,         description="Ayat akhir")
    reciter_id:      str = Field(...,               description="ID reciter")
    translation_key: str = Field("none",            description="Kunci terjemahan, 'none' jika tanpa terjemahan")
    mode:            SRTMode = Field(SRTMode.WAQOF, description="Mode subtitle")
    show_arabic:     bool = Field(True,             description="Tampilkan teks Arab")
    include_mp3:     bool = Field(False,            description="Sertakan MP3 dalam ZIP")

    @field_validator("end_verse")
    @classmethod
    def end_must_be_gte_start(cls, v, info):
        if info.data.get("start_verse") and v < info.data["start_verse"]:
            raise ValueError("end_verse harus >= start_verse")
        return v

    @field_validator("reciter_id")
    @classmethod
    def reciter_must_exist(cls, v):
        if v not in RECITERS:
            raise ValueError(f"Reciter '{v}' tidak ditemukan")
        return v


class SRTResult(BaseModel):
    """Hasil generate SRT — dikembalikan oleh core engine."""
    srt_content:      str
    filename:         str
    block_count:      int
    surah_name:       str  # nama Arab
    surah_name_latin: str  # nama Latin
    audio_base_url:   str
    reciter_name:     str


class BatchItem(BaseModel):
    """Satu item dalam batch request."""
    surah:       int = Field(..., ge=1, le=114)
    start_verse: int = Field(..., ge=1)
    end_verse:   int = Field(..., ge=1)


class BatchRequest(BaseModel):
    """Request untuk batch generate — fitur Pro."""
    items:           list[BatchItem] = Field(..., max_length=30)
    reciter_id:      str
    translation_key: str  = "none"
    mode:            SRTMode = SRTMode.WAQOF
    show_arabic:     bool = True
    include_mp3:     bool = False


class GenerateHistoryItem(BaseModel):
    """Item riwayat generate untuk disimpan ke database."""
    user_id:         str
    surah:           int
    start_verse:     int
    end_verse:       int
    reciter_id:      str
    translation_key: str
    mode:            str
    filename:        str


# ── Data Statis: Reciter ──────────────────────────────────────────────────────
# api_id: ID yang digunakan di qurancdn.com API
# audio_url_pattern: template URL untuk download MP3 per ayat
#   {surah} = nomor surah 3 digit (001, 002, ...)
#   {verse} = nomor ayat 3 digit (001, 002, ...)

RECITERS: dict[str, dict] = {
    "husary": {
        "name":              "Mahmoud Khalil Al-Husary",
        "name_ar":           "محمود خليل الحصري",
        "api_id":            1,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/mahmood_khaleel_al-husaree/{surah}{verse}.mp3",
        "style":             "Murattal",
        "sample_url":        "https://download.quranicaudio.com/quran/mahmood_khaleel_al-husaree/001001.mp3",
    },
    "alafasy": {
        "name":              "Mishary Rashid Alafasy",
        "name_ar":           "مشاري راشد العفاسي",
        "api_id":            7,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/{surah}{verse}.mp3",
        "style":             "Murattal",
        "sample_url":        "https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/001001.mp3",
    },
    "abdulbasit_murattal": {
        "name":              "Abdul Basit (Murattal)",
        "name_ar":           "عبد الباسط عبد الصمد (مرتل)",
        "api_id":            2,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/abdul_baset_murattal/{surah}{verse}.mp3",
        "style":             "Murattal",
        "sample_url":        "https://download.quranicaudio.com/quran/abdul_baset_murattal/001001.mp3",
    },
    "abdulbasit_mujawwad": {
        "name":              "Abdul Basit (Mujawwad)",
        "name_ar":           "عبد الباسط عبد الصمد (مجود)",
        "api_id":            3,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/abd_al-baset_abd_as-samad_mujawwad/{surah}{verse}.mp3",
        "style":             "Mujawwad",
        "sample_url":        "https://download.quranicaudio.com/quran/abd_al-baset_abd_as-samad_mujawwad/001001.mp3",
    },
    "abdulsamad": {
        "name":              "Abdul Samad",
        "name_ar":           "عبد الصمد",
        "api_id":            6,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/abdurrahmaan_as-sudais_and_su'ood_ash-shuraym/{surah}{verse}.mp3",
        "style":             "Murattal",
        "sample_url":        "https://download.quranicaudio.com/quran/abdurrahmaan_as-sudais_and_su'ood_ash-shuraym/001001.mp3",
    },
    "minshawi_murattal": {
        "name":              "Muhammad Al-Minshawi",
        "name_ar":           "محمد صديق المنشاوي (مرتل)",
        "api_id":            11,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/muhammad_siddeeq_al-minshaawee/{surah}{verse}.mp3",
        "style":             "Murattal",
        "sample_url":        "https://download.quranicaudio.com/quran/muhammad_siddeeq_al-minshaawee/001001.mp3",
    },
    "minshawi_hq": {
        "name":              "Al-Minshawi (HQ)",
        "name_ar":           "المنشاوي عالي الجودة",
        "api_id":            12,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/minshawi_mujawwad/{surah}{verse}.mp3",
        "style":             "Mujawwad",
        "sample_url":        "https://download.quranicaudio.com/quran/minshawi_mujawwad/001001.mp3",
    },
    "ayyoub": {
        "name":              "Muhammad Ayyoub",
        "name_ar":           "محمد أيوب",
        "api_id":            10,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/muhammad_ayyoob/{surah}{verse}.mp3",
        "style":             "Murattal",
        "sample_url":        "https://download.quranicaudio.com/quran/muhammad_ayyoob/001001.mp3",
    },
    "shatri": {
        "name":              "Abu Bakr Al-Shatri",
        "name_ar":           "أبو بكر الشاطري",
        "api_id":            9,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/abu_bakr_ash-shaatree/{surah}{verse}.mp3",
        "style":             "Murattal",
        "sample_url":        "https://download.quranicaudio.com/quran/abu_bakr_ash-shaatree/001001.mp3",
    },
    "tablawi": {
        "name":              "Muhammad Al-Tablawi",
        "name_ar":           "محمد الطبلاوي",
        "api_id":            14,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/muhammad_al-tablaawy/{surah}{verse}.mp3",
        "style":             "Mujawwad",
        "sample_url":        "https://download.quranicaudio.com/quran/muhammad_al-tablaawy/001001.mp3",
    },
    "sudais": {
        "name":              "Abdul Rahman Al-Sudais",
        "name_ar":           "عبد الرحمن السديس",
        "api_id":            5,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/abdurrahmaan_as-sudais/{surah}{verse}.mp3",
        "style":             "Murattal",
        "sample_url":        "https://download.quranicaudio.com/quran/abdurrahmaan_as-sudais/001001.mp3",
    },
    "ghamdi": {
        "name":              "Saad Al-Ghamdi",
        "name_ar":           "سعد الغامدي",
        "api_id":            8,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/saad_al-ghaamidi/{surah}{verse}.mp3",
        "style":             "Murattal",
        "sample_url":        "https://download.quranicaudio.com/quran/saad_al-ghaamidi/001001.mp3",
    },
    # ── Reciter baru (upgrade dari versi Streamlit) ──────────────────────────
    "shuraym": {
        "name":              "Saud Al-Shuraym",
        "name_ar":           "سعود الشريم",
        "api_id":            4,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/su'ood_ash-shuraym/{surah}{verse}.mp3",
        "style":             "Murattal",
        "sample_url":        "https://download.quranicaudio.com/quran/su'ood_ash-shuraym/001001.mp3",
    },
    "maher": {
        "name":              "Maher Al-Muaiqly",
        "name_ar":           "ماهر المعيقلي",
        "api_id":            17,
        "audio_url_pattern": "https://download.quranicaudio.com/quran/maher_al_muaiqly/{surah}{verse}.mp3",
        "style":             "Murattal",
        "sample_url":        "https://download.quranicaudio.com/quran/maher_al_muaiqly/001001.mp3",
    },
}


# ── Data Statis: Terjemahan ───────────────────────────────────────────────────
# id: ID terjemahan di qurancdn.com API
# lang_code: kode bahasa ISO 639-1

TRANSLATIONS: dict[str, dict] = {
    # ── Khusus ──────────────────────────────────────────────────────────────
    "transliteration": {
        "name": "Transliteration (Latin)",
        "flag": "🔤",
        "id":   None,  # Ditangani secara khusus di srt_generator
        "lang": "xx",
    },

    # ── Indonesia ────────────────────────────────────────────────────────────
    "id_kemenag": {
        "name": "Indonesia — Kemenag RI",
        "flag": "🇮🇩",
        "id":   33,
        "lang": "id",
    },
    "id_jalalayn": {
        "name": "Indonesia — Tafsir Jalalayn",
        "flag": "🇮🇩",
        "id":   74,
        "lang": "id",
    },
    "id_quraish": {
        "name": "Indonesia — Tafsir Quraish Shihab",
        "flag": "🇮🇩",
        "id":   76,
        "lang": "id",
    },

    # ── Malaysia ──────────────────────────────────────────────────────────────
    "ms_basmeih": {
        "name": "Melayu — Basmeih",
        "flag": "🇲🇾",
        "id":   39,
        "lang": "ms",
    },

    # ── Inggris ───────────────────────────────────────────────────────────────
    "en_sahih": {
        "name": "English — Sahih International",
        "flag": "🇬🇧",
        "id":   20,
        "lang": "en",
    },
    "en_khattab": {
        "name": "English — Dr. Khattab",
        "flag": "🇬🇧",
        "id":   131,
        "lang": "en",
    },
    "en_yusufali": {
        "name": "English — Yusuf Ali",
        "flag": "🇬🇧",
        "id":   22,
        "lang": "en",
    },
    "en_pickthall": {
        "name": "English — Pickthall",
        "flag": "🇬🇧",
        "id":   19,
        "lang": "en",
    },

    # ── Asia Tenggara ────────────────────────────────────────────────────────
    "tl_tagalog": {
        "name": "Tagalog",
        "flag": "🇵🇭",
        "id":   64,
        "lang": "tl",
    },
    "vi_vietnamese": {
        "name": "Vietnamese",
        "flag": "🇻🇳",
        "id":   75,
        "lang": "vi",
    },

    # ── Tambahan baru ────────────────────────────────────────────────────────
    "tr_turkish": {
        "name": "Türkçe",
        "flag": "🇹🇷",
        "id":   52,
        "lang": "tr",
    },
    "fr_french": {
        "name": "Français",
        "flag": "🇫🇷",
        "id":   31,
        "lang": "fr",
    },
    "de_german": {
        "name": "Deutsch",
        "flag": "🇩🇪",
        "id":   27,
        "lang": "de",
    },
    "es_spanish": {
        "name": "Español",
        "flag": "🇪🇸",
        "id":   83,
        "lang": "es",
    },
    "ru_russian": {
        "name": "Русский",
        "flag": "🇷🇺",
        "id":   45,
        "lang": "ru",
    },
    "ur_urdu": {
        "name": "اردو",
        "flag": "🇵🇰",
        "id":   54,
        "lang": "ur",
    },
    "bn_bengali": {
        "name": "বাংলা",
        "flag": "🇧🇩",
        "id":   120,
        "lang": "bn",
    },
    "hi_hindi": {
        "name": "हिन्दी",
        "flag": "🇮🇳",
        "id":   122,
        "lang": "hi",
    },
    "zh_chinese": {
        "name": "中文",
        "flag": "🇨🇳",
        "id":   109,
        "lang": "zh",
    },
}


# ── Data Statis: 114 Surah ────────────────────────────────────────────────────
# Data ringkas untuk keperluan UI dan naming file.
# verse_count: jumlah ayat (untuk validasi input)

SURAH_DATA: dict[int, dict] = {
    1:   {"name_simple": "Al-Fatihah",      "name_arabic": "الفاتحة",      "verse_count": 7},
    2:   {"name_simple": "Al-Baqarah",      "name_arabic": "البقرة",       "verse_count": 286},
    3:   {"name_simple": "Ali-Imran",       "name_arabic": "آل عمران",     "verse_count": 200},
    4:   {"name_simple": "An-Nisa",         "name_arabic": "النساء",       "verse_count": 176},
    5:   {"name_simple": "Al-Maidah",       "name_arabic": "المائدة",      "verse_count": 120},
    6:   {"name_simple": "Al-Anam",         "name_arabic": "الأنعام",      "verse_count": 165},
    7:   {"name_simple": "Al-Araf",         "name_arabic": "الأعراف",      "verse_count": 206},
    8:   {"name_simple": "Al-Anfal",        "name_arabic": "الأنفال",      "verse_count": 75},
    9:   {"name_simple": "At-Tawbah",       "name_arabic": "التوبة",       "verse_count": 129},
    10:  {"name_simple": "Yunus",           "name_arabic": "يونس",         "verse_count": 109},
    11:  {"name_simple": "Hud",             "name_arabic": "هود",          "verse_count": 123},
    12:  {"name_simple": "Yusuf",           "name_arabic": "يوسف",         "verse_count": 111},
    13:  {"name_simple": "Ar-Rad",          "name_arabic": "الرعد",        "verse_count": 43},
    14:  {"name_simple": "Ibrahim",         "name_arabic": "إبراهيم",      "verse_count": 52},
    15:  {"name_simple": "Al-Hijr",         "name_arabic": "الحجر",        "verse_count": 99},
    16:  {"name_simple": "An-Nahl",         "name_arabic": "النحل",        "verse_count": 128},
    17:  {"name_simple": "Al-Isra",         "name_arabic": "الإسراء",      "verse_count": 111},
    18:  {"name_simple": "Al-Kahf",         "name_arabic": "الكهف",        "verse_count": 110},
    19:  {"name_simple": "Maryam",          "name_arabic": "مريم",         "verse_count": 98},
    20:  {"name_simple": "Ta-Ha",           "name_arabic": "طه",           "verse_count": 135},
    21:  {"name_simple": "Al-Anbiya",       "name_arabic": "الأنبياء",     "verse_count": 112},
    22:  {"name_simple": "Al-Hajj",         "name_arabic": "الحج",         "verse_count": 78},
    23:  {"name_simple": "Al-Muminun",      "name_arabic": "المؤمنون",     "verse_count": 118},
    24:  {"name_simple": "An-Nur",          "name_arabic": "النور",        "verse_count": 64},
    25:  {"name_simple": "Al-Furqan",       "name_arabic": "الفرقان",      "verse_count": 77},
    26:  {"name_simple": "Ash-Shuara",      "name_arabic": "الشعراء",      "verse_count": 227},
    27:  {"name_simple": "An-Naml",         "name_arabic": "النمل",        "verse_count": 93},
    28:  {"name_simple": "Al-Qasas",        "name_arabic": "القصص",        "verse_count": 88},
    29:  {"name_simple": "Al-Ankabut",      "name_arabic": "العنكبوت",     "verse_count": 69},
    30:  {"name_simple": "Ar-Rum",          "name_arabic": "الروم",        "verse_count": 60},
    31:  {"name_simple": "Luqman",          "name_arabic": "لقمان",        "verse_count": 34},
    32:  {"name_simple": "As-Sajdah",       "name_arabic": "السجدة",       "verse_count": 30},
    33:  {"name_simple": "Al-Ahzab",        "name_arabic": "الأحزاب",      "verse_count": 73},
    34:  {"name_simple": "Saba",            "name_arabic": "سبإ",          "verse_count": 54},
    35:  {"name_simple": "Fatir",           "name_arabic": "فاطر",         "verse_count": 45},
    36:  {"name_simple": "Ya-Sin",          "name_arabic": "يس",           "verse_count": 83},
    37:  {"name_simple": "As-Saffat",       "name_arabic": "الصافات",      "verse_count": 182},
    38:  {"name_simple": "Sad",             "name_arabic": "ص",            "verse_count": 88},
    39:  {"name_simple": "Az-Zumar",        "name_arabic": "الزمر",        "verse_count": 75},
    40:  {"name_simple": "Ghafir",          "name_arabic": "غافر",         "verse_count": 85},
    41:  {"name_simple": "Fussilat",        "name_arabic": "فصلت",         "verse_count": 54},
    42:  {"name_simple": "Ash-Shura",       "name_arabic": "الشورى",       "verse_count": 53},
    43:  {"name_simple": "Az-Zukhruf",      "name_arabic": "الزخرف",       "verse_count": 89},
    44:  {"name_simple": "Ad-Dukhan",       "name_arabic": "الدخان",       "verse_count": 59},
    45:  {"name_simple": "Al-Jathiyah",     "name_arabic": "الجاثية",      "verse_count": 37},
    46:  {"name_simple": "Al-Ahqaf",        "name_arabic": "الأحقاف",      "verse_count": 35},
    47:  {"name_simple": "Muhammad",        "name_arabic": "محمد",         "verse_count": 38},
    48:  {"name_simple": "Al-Fath",         "name_arabic": "الفتح",        "verse_count": 29},
    49:  {"name_simple": "Al-Hujurat",      "name_arabic": "الحجرات",      "verse_count": 18},
    50:  {"name_simple": "Qaf",             "name_arabic": "ق",            "verse_count": 45},
    51:  {"name_simple": "Adh-Dhariyat",    "name_arabic": "الذاريات",     "verse_count": 60},
    52:  {"name_simple": "At-Tur",          "name_arabic": "الطور",        "verse_count": 49},
    53:  {"name_simple": "An-Najm",         "name_arabic": "النجم",        "verse_count": 62},
    54:  {"name_simple": "Al-Qamar",        "name_arabic": "القمر",        "verse_count": 55},
    55:  {"name_simple": "Ar-Rahman",       "name_arabic": "الرحمن",       "verse_count": 78},
    56:  {"name_simple": "Al-Waqiah",       "name_arabic": "الواقعة",      "verse_count": 96},
    57:  {"name_simple": "Al-Hadid",        "name_arabic": "الحديد",       "verse_count": 29},
    58:  {"name_simple": "Al-Mujadila",     "name_arabic": "المجادلة",     "verse_count": 22},
    59:  {"name_simple": "Al-Hashr",        "name_arabic": "الحشر",        "verse_count": 24},
    60:  {"name_simple": "Al-Mumtahanah",   "name_arabic": "الممتحنة",     "verse_count": 13},
    61:  {"name_simple": "As-Saf",          "name_arabic": "الصف",         "verse_count": 14},
    62:  {"name_simple": "Al-Jumuah",       "name_arabic": "الجمعة",       "verse_count": 11},
    63:  {"name_simple": "Al-Munafiqun",    "name_arabic": "المنافقون",    "verse_count": 11},
    64:  {"name_simple": "At-Taghabun",     "name_arabic": "التغابن",      "verse_count": 18},
    65:  {"name_simple": "At-Talaq",        "name_arabic": "الطلاق",       "verse_count": 12},
    66:  {"name_simple": "At-Tahrim",       "name_arabic": "التحريم",      "verse_count": 12},
    67:  {"name_simple": "Al-Mulk",         "name_arabic": "الملك",        "verse_count": 30},
    68:  {"name_simple": "Al-Qalam",        "name_arabic": "القلم",        "verse_count": 52},
    69:  {"name_simple": "Al-Haqqah",       "name_arabic": "الحاقة",       "verse_count": 52},
    70:  {"name_simple": "Al-Maarij",       "name_arabic": "المعارج",      "verse_count": 44},
    71:  {"name_simple": "Nuh",             "name_arabic": "نوح",          "verse_count": 28},
    72:  {"name_simple": "Al-Jinn",         "name_arabic": "الجن",         "verse_count": 28},
    73:  {"name_simple": "Al-Muzzammil",    "name_arabic": "المزمل",       "verse_count": 20},
    74:  {"name_simple": "Al-Muddaththir",  "name_arabic": "المدثر",       "verse_count": 56},
    75:  {"name_simple": "Al-Qiyamah",      "name_arabic": "القيامة",      "verse_count": 40},
    76:  {"name_simple": "Al-Insan",        "name_arabic": "الإنسان",      "verse_count": 31},
    77:  {"name_simple": "Al-Mursalat",     "name_arabic": "المرسلات",     "verse_count": 50},
    78:  {"name_simple": "An-Naba",         "name_arabic": "النبأ",        "verse_count": 40},
    79:  {"name_simple": "An-Naziat",       "name_arabic": "النازعات",     "verse_count": 46},
    80:  {"name_simple": "Abasa",           "name_arabic": "عبس",          "verse_count": 42},
    81:  {"name_simple": "At-Takwir",       "name_arabic": "التكوير",      "verse_count": 29},
    82:  {"name_simple": "Al-Infitar",      "name_arabic": "الانفطار",     "verse_count": 19},
    83:  {"name_simple": "Al-Mutaffifin",   "name_arabic": "المطففين",     "verse_count": 36},
    84:  {"name_simple": "Al-Inshiqaq",     "name_arabic": "الانشقاق",     "verse_count": 25},
    85:  {"name_simple": "Al-Buruj",        "name_arabic": "البروج",       "verse_count": 22},
    86:  {"name_simple": "At-Tariq",        "name_arabic": "الطارق",       "verse_count": 17},
    87:  {"name_simple": "Al-Ala",          "name_arabic": "الأعلى",       "verse_count": 19},
    88:  {"name_simple": "Al-Ghashiyah",    "name_arabic": "الغاشية",      "verse_count": 26},
    89:  {"name_simple": "Al-Fajr",         "name_arabic": "الفجر",        "verse_count": 30},
    90:  {"name_simple": "Al-Balad",        "name_arabic": "البلد",        "verse_count": 20},
    91:  {"name_simple": "Ash-Shams",       "name_arabic": "الشمس",        "verse_count": 15},
    92:  {"name_simple": "Al-Layl",         "name_arabic": "الليل",        "verse_count": 21},
    93:  {"name_simple": "Ad-Duha",         "name_arabic": "الضحى",        "verse_count": 11},
    94:  {"name_simple": "Ash-Sharh",       "name_arabic": "الشرح",        "verse_count": 8},
    95:  {"name_simple": "At-Tin",          "name_arabic": "التين",        "verse_count": 8},
    96:  {"name_simple": "Al-Alaq",         "name_arabic": "العلق",        "verse_count": 19},
    97:  {"name_simple": "Al-Qadr",         "name_arabic": "القدر",        "verse_count": 5},
    98:  {"name_simple": "Al-Bayyinah",     "name_arabic": "البينة",       "verse_count": 8},
    99:  {"name_simple": "Az-Zalzalah",     "name_arabic": "الزلزلة",      "verse_count": 8},
    100: {"name_simple": "Al-Adiyat",       "name_arabic": "العاديات",     "verse_count": 11},
    101: {"name_simple": "Al-Qariah",       "name_arabic": "القارعة",      "verse_count": 11},
    102: {"name_simple": "At-Takathur",     "name_arabic": "التكاثر",      "verse_count": 8},
    103: {"name_simple": "Al-Asr",          "name_arabic": "العصر",        "verse_count": 3},
    104: {"name_simple": "Al-Humazah",      "name_arabic": "الهمزة",       "verse_count": 9},
    105: {"name_simple": "Al-Fil",          "name_arabic": "الفيل",        "verse_count": 5},
    106: {"name_simple": "Quraysh",         "name_arabic": "قريش",         "verse_count": 4},
    107: {"name_simple": "Al-Maun",         "name_arabic": "الماعون",      "verse_count": 7},
    108: {"name_simple": "Al-Kawthar",      "name_arabic": "الكوثر",       "verse_count": 3},
    109: {"name_simple": "Al-Kafirun",      "name_arabic": "الكافرون",     "verse_count": 6},
    110: {"name_simple": "An-Nasr",         "name_arabic": "النصر",        "verse_count": 3},
    111: {"name_simple": "Al-Masad",        "name_arabic": "المسد",        "verse_count": 5},
    112: {"name_simple": "Al-Ikhlas",       "name_arabic": "الإخلاص",      "verse_count": 4},
    113: {"name_simple": "Al-Falaq",        "name_arabic": "الفلق",        "verse_count": 5},
    114: {"name_simple": "An-Nas",          "name_arabic": "الناس",        "verse_count": 6},
}
