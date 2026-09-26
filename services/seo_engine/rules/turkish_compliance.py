import re
from typing import Any, Dict, Optional, List
from enum import Enum
from services.seo_engine.base import SeoRule, RuleCategory, IssueSeverity, RuleCheckResult

class TurkishComplianceSector(str, Enum):
    HEALTH_MEDICAL = "HEALTH_MEDICAL"
    FOOD_SUPPLEMENT = "FOOD_SUPPLEMENT"
    LEGAL_SERVICES = "LEGAL_SERVICES"
    FINANCIAL_SERVICES = "FINANCIAL_SERVICES"
    SUPERLATIVE_COMMERCIAL = "SUPERLATIVE_COMMERCIAL"
    ILLEGAL_BETTING_TOBACCO = "ILLEGAL_BETTING_TOBACCO"

def normalize_turkish_text(text: str) -> str:
    """Türkçe karakterleri ve Unicode combining dot karakterlerini normalleştirir."""
    if not text:
        return ""
    # Python'da 'İ'.lower() -> 'i\u0307' (combining dot) oluşturduğu için önce dönüştürülmeli
    s = text.replace('İ', 'i').replace('I', 'i').replace('ı', 'i')
    s = s.replace('Ğ', 'g').replace('ğ', 'g')
    s = s.replace('Ü', 'u').replace('ü', 'u')
    s = s.replace('Ş', 's').replace('ş', 's')
    s = s.replace('Ö', 'o').replace('ö', 'o')
    s = s.replace('Ç', 'c').replace('ç', 'c')
    s = s.lower().replace('\u0307', '')
    return s

TURKISH_REGULATORY_RULES = [
    # -------------------------------------------------------------
    # 1. SAĞLIK, MEDİKAL, ESTETİK VE KLİNİK (TİTCK & SAĞLIK BAKANLIĞI)
    # -------------------------------------------------------------
    {
        "id": "TR_HEALTH_TREATMENT_CLAIM",
        "sector": TurkishComplianceSector.HEALTH_MEDICAL,
        "title": "Tıbbi Tedavi ve Şifa Beyanı Yasağı",
        "patterns": [
            r"\btedavi\s+eder\b",
            r"\bkesin\s+tedavi\b",
            r"\bgarantili\s+tedavi\b",
            r"\bsifa\s+bul\b",
            r"\bhastaligi\s+yok\s+eder\b",
            r"\btedavisi\s+%?100\b",
            r"\bkokten\s+cozum\b",
            r"\bmucize\s+tedavi\b",
            r"\bbitkisel\s+tedavi\s+kesin\b",
        ],
        "legal_basis": "12 Kasım 2025 tarih ve 33075 sayılı R.G. Sağlık Hizmetlerinde Tanıtım ve Bilgilendirme Faaliyetleri Hakkında Yönetmelik md. 5 & 1219 sayılı Tababet Kanunu",
        "penalty_risk": "6502 S.K. md. 77 uyarınca 2026 yılı yeniden değerleme oranıyla internet ortamında 8.635.800 TL'ye varan idari para cezası ve reklam durdurma.",
        "suggested_fix": "'tedavi sürecini destekler' veya 'uzman hekim kontrolünde değerlendirilir' şeklinde nötr bilgi verin.",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "id": "TR_HEALTH_SUPERLATIVE_DOCTOR",
        "sector": TurkishComplianceSector.HEALTH_MEDICAL,
        "title": "Hekim ve Klinik Üstünlük/Talep Yaratma Yasağı",
        "patterns": [
            r"\ben\s+iyi\s+doktor\b",
            r"\ben\s+iyi\s+cerrah\b",
            r"\ben\s+iyi\s+hekim\b",
            r"\ben\s+basarili\s+cerrah\b",
            r"\b1\s+numarali\s+klinik\b",
            r"\bturkiye'?nin\s+en\s+iyi\s+(?:hastanesi|klinigi)\b",
            r"\ben\s+iyi\s+dis\s+hekimi\b",
            r"\ben\s+iyi\s+estetik\b",
        ],
        "legal_basis": "12 Kasım 2025 tarih ve 33075 sayılı R.G. Sağlık Tanıtım Yönetmeliği md. 5/1-ç (Haksız rekabet ve üstünlük yasağı)",
        "penalty_risk": "Reklam Kurulu para cezası (2026 tavanı 8.635.800 TL) ve Tabip Odası Disiplin soruşturması.",
        "suggested_fix": "'Deneyimli hekim kadrosu' veya doğrudan hekimin unvan ve akademik kariyerini yalın belirtin.",
        "severity": IssueSeverity.HIGH,
    },
    {
        "id": "TR_HEALTH_BEFORE_AFTER",
        "sector": TurkishComplianceSector.HEALTH_MEDICAL,
        "title": "Önce-Sonra (Before-After) ve Garanti Sonuç Vaadi Yasağı",
        "patterns": [
            r"\boncesi\s+sonrasi\b",
            r"\bbefore\s+after\b",
            r"\bonce\s+sonra\s+fotograflar\b",
            r"\bgarantili\s+sonuc\b",
            r"\bagrisiz\s+acisiz\s+kesin\b",
            r"\bsifir\s+risk\b",
            r"\byan\s+etkisi\s+yoktur\b",
        ],
        "legal_basis": "12 Kasım 2025 tarih ve 33075 sayılı R.G. Sağlık Tanıtım Yönetmeliği md. 5/1-d (Önce/sonra görseli ve mutlak başarı vaadi yasağı)",
        "penalty_risk": "Web sayfasına BTK re'sen erişim engeli ve 8.635.800 TL'ye varan Reklam Kurulu cezası.",
        "suggested_fix": "'Uygulama süreci hakkında hekiminize danışınız' şeklinde tıbbi bilgilendirme yapın.",
        "severity": IssueSeverity.CRITICAL,
    },

    # -------------------------------------------------------------
    # 2. GIDA TAKVİYELERİ, KOZMETİK VE ZAYIFLAMA
    # -------------------------------------------------------------
    {
        "id": "TR_FOOD_WEIGHT_LOSS_CLAIM",
        "sector": TurkishComplianceSector.FOOD_SUPPLEMENT,
        "title": "Takviyelerde Zayıflama ve Tıbbi Etki İddiası Yasağı",
        "patterns": [
            r"\bzayiflati(?:r|yor)\b",
            r"\byag\s+yakici\s+garanti\b",
            r"\b1\s+haftada\s+\d+\s+kilo\b",
            r"\bistahi\s+tamamen\s+keser\b",
            r"\bkanseri\s+onler\b",
            r"\bsekeri\s+dusurur\b",
            r"\btansiyonu\s+dengeler\b",
        ],
        "legal_basis": "Türk Gıda Kodeksi Beslenme ve Sağlık Beyanları Yönetmeliği (Ağustos 2026) & Tüketici Kanunu md. 61",
        "penalty_risk": "Reklam Kurulu tarafından üst sınırdan idari para cezası ve ürün toplatma.",
        "suggested_fix": "'Dengeli beslenme ve aktif yaşam tarzını destekler' veya EFSA/Tarım onaylı beyanları kullanın.",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "id": "TR_FOOD_MINISTRY_DECEPTION",
        "sector": TurkishComplianceSector.FOOD_SUPPLEMENT,
        "title": "Sağlık Bakanlığı Onaylı Takviye/İlaç Aldatmacası",
        "patterns": [
            r"\bsaglik\s+bakanligi\s+onayli\b",
            r"\bbakanlik\s+onayli\s+ilac\b",
            r"\bdoktor\s+tavsiyeli\s+takviye\b",
            r"\bprofesor\s+onayli\b",
        ],
        "legal_basis": "TİTCK Takviye Edici Gıda Kılavuzu (Gıda takviyeleri Sağlık Bakanlığı değil, Tarım Bakanlığı onaylıdır)",
        "penalty_risk": "Nitelikli tüketici aldatmasından doğrudan savcılık bildirimi ve idari para cezası.",
        "suggested_fix": "'T.C. Tarım ve Orman Bakanlığı Onaylı Takviye Edici Gıda No: ...' şeklinde ruhsat numarasını yazın.",
        "severity": IssueSeverity.CRITICAL,
    },

    # -------------------------------------------------------------
    # 3. HUKUK VE AVUKATLIK HİZMETLERİ (TBB)
    # -------------------------------------------------------------
    {
        "id": "TR_LEGAL_SUPERLATIVE_LAWYER",
        "sector": TurkishComplianceSector.LEGAL_SERVICES,
        "title": "Avukatlıkta Üstünlük, Başarı ve Karşılaştırma Yasağı",
        "patterns": [
            r"\ben\s+iyi\s+avukat\b",
            r"\ben\s+iyi\s+ceza\s+avukati\b",
            r"\ben\s+basarili\s+avukat\b",
            r"\buzman\s+bosanma\s+avukati\b",
            r"\bturkiye'?nin\s+en\s+iyi\s+hukuk\s+burosu\b",
            r"\b1\s+numarali\s+avukat\b",
        ],
        "legal_basis": "1136 sayılı Avukatlık Kanunu md. 55 ve TBB Reklam Yasağı Yönetmeliği md. 7",
        "penalty_risk": "Baro Disiplin Kurulu soruşturması, kınama ve para cezası.",
        "suggested_fix": "'Avukatlık ve Hukuki Danışmanlık' veya uzmanlık yerine 'Çalışma Alanlarımız' ifadesini kullanın.",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "id": "TR_LEGAL_GUARANTEE_FREE",
        "sector": TurkishComplianceSector.LEGAL_SERVICES,
        "title": "Dava Kazanma Garantisi ve Ücretsiz Hizmet Yasağı",
        "patterns": [
            r"\bdava\s+kazanma\s+garantisi\b",
            r"\bkesin\s+beraat\b",
            r"\btazminat\s+garantisi\b",
            r"\b%100\s+basari\s+orani\b",
            r"\bucretsiz\s+danismanlik\b",
            r"\bucretsiz\s+dava\b",
            r"\bindirimli\s+avukatlik\b",
        ],
        "legal_basis": "Avukatlık Kanunu md. 164 (Asgari tarife altı iş yasağı) & TBB Meslek Kuralları",
        "penalty_risk": "Disiplin cezası ve haksız rekabet tazminatı.",
        "suggested_fix": "'Hukuki süreç ve dava danışmanlığı için büromuzla iletişime geçebilirsiniz.'",
        "severity": IssueSeverity.CRITICAL,
    },

    # -------------------------------------------------------------
    # 4. FİNANS, KREDİ, YATIRIM VE KRİPTO (SPK & BDDK)
    # -------------------------------------------------------------
    {
        "id": "TR_FINANCE_GUARANTEED_RETURN",
        "sector": TurkishComplianceSector.FINANCIAL_SERVICES,
        "title": "Finansta Kesin Kazanç ve Garantili Getiri Vaadi Yasağı",
        "patterns": [
            r"\bkesin\s+kazanc\b",
            r"\bgarantili\s+getiri\b",
            r"\bkayipsiz\s+yatirim\b",
            r"\bgunluk\s+%\s*\d+\s+kar\b",
            r"\bzengin\s+olma\s+garantisi\b",
            r"\bkesin\s+al-sat\s+sinyali\b",
            r"\b%100\s+kazandiran\s+bot\b",
            r"\bgarantili\s+forex\b",
            r"\bkesin\s+kripto\s+kazanc\b",
        ],
        "legal_basis": "7518 sayılı Kripto Varlık Kanunu & 6362 sayılı SPK md. 106-107 (Piyasa Dolandırıcılığı)",
        "penalty_risk": "SPK idari para cezası ve 2 yıldan 5 yıla kadar hapis cezası talebi.",
        "suggested_fix": "'Yatırımlar piyasa riski içerir, geçmiş getiri gelecek için gösterge değildir.' uyarısını ekleyin.",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "id": "TR_FINANCE_ILLEGAL_LOAN",
        "sector": TurkishComplianceSector.FINANCIAL_SERVICES,
        "title": "Yetkisiz Kredi, Tefecilik ve Sicil Yok Sayma Reklamı",
        "patterns": [
            r"\bsicili\s+bozuklara\s+kredi\b",
            r"\bkredi\s+notu\s+onemsiz\b",
            r"\bsenetlen\s+kredi\b",
            r"\bsenete\s+kredi\b",
            r"\btefeci\s+kredi\b",
            r"\bkefilsiz\s+sartsiz\s+aninda\s+para\b",
            r"\bbanka\s+harici\s+kredi\b",
        ],
        "legal_basis": "5411 sayılı Bankacılık Kanunu md. 150 & TCK md. 241 (Tefecilik Suçu)",
        "penalty_risk": "Savcılık soruşturması ve BTK tarafından re'sen anında erişim engeli.",
        "suggested_fix": "Yalnızca BDDK yetkili banka ve finansman kuruluşlarının resmi faiz oranlarını listeleyin.",
        "severity": IssueSeverity.CRITICAL,
    },

    # -------------------------------------------------------------
    # 5. E-TİCARET & GENEL TİCARİ REKLAMLAR (TİCARET BAKANLIĞI)
    # -------------------------------------------------------------
    {
        "id": "TR_COMMERCIAL_UNPROVEN_SUPERLATIVE",
        "sector": TurkishComplianceSector.SUPERLATIVE_COMMERCIAL,
        "title": "İspatlanamayan Üstünlük İddiası ('En Ucuz', 'Rakipsiz')",
        "patterns": [
            r"\bturkiye'?nin\s+en\s+ucuzu\b",
            r"\ben\s+ucuz\s+fiyat\b",
            r"\brakipsiz\s+fiyat\b",
            r"\bdunyanin\s+en\s+iyisi\b",
            r"\brakipsiz\s+kalite\b",
            r"\btek\s+adres\b",
        ],
        "legal_basis": "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 7-8-9 (İspat Külfeti)",
        "penalty_risk": "Akredite bağımsız araştırma raporu olmadan kullanımı halinde Reklam Kurulu para cezası.",
        "suggested_fix": "'Avantajlı fiyat seçenekleri', 'Yüksek kalite standartları' şeklinde nesnel ifade kullanın.",
        "severity": IssueSeverity.HIGH,
    },
    {
        "id": "TR_COMMERCIAL_ABSOLUTE_RETURN",
        "sector": TurkishComplianceSector.SUPERLATIVE_COMMERCIAL,
        "title": "Koşulsuz Şartsız İade Yanıltmacası",
        "patterns": [
            r"\bkosulsuz\s+sartsiz\s+iade\b",
            r"\bsartsiz\s+iade\s+garantisi\b",
        ],
        "legal_basis": "6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği md. 15 (Cayma hakkı istisnaları)",
        "penalty_risk": "Tüketiciyi hakları konusunda yanıltmaktan dolayı idari yaptırım.",
        "suggested_fix": "'Yasal cayma hakkı kapsamında 14 gün içinde kolay iade imkanı'",
        "severity": IssueSeverity.MEDIUM,
    },
    {
        "id": "TR_COMMERCIAL_FAKE_SCARCITY",
        "sector": TurkishComplianceSector.SUPERLATIVE_COMMERCIAL,
        "title": "Sahte Stok Kıtlığı ve Aciliyet Baskısı (Dark Patterns)",
        "patterns": [
            r"\b(?:yalnizca\s+|sadece\s+)?(?:stokta\s+)?son\s+\d+(?:\s+(?:adet|urun|parca|paket|kisiye))?\s+kaldi\b",
            r"\b(?:sadece|yalnizca)\s+son\s+\d+\s+(?:adet|urun)\b",
            r"\bhemen\s+almazsaniz\s+tuken(?:ir|iyor)\b",
            r"\bstoklar\s+tukenmek\s+uzere\b",
            r"\bacele\s+edin\s+tukeniyor\b",
            r"\bfirsat\s+bitmek\s+uzere\b",
            r"\btukenmeden\s+alin\b",
            r"\b(?:yalnizca|sadece)\s+\d+\s+dakikaniz\s+kaldi\b",
        ],
        "legal_basis": "6502 sayılı Tüketici Kanunu md. 61 & Ticari Reklam Yönetmeliği md. 28 / Haksız Ticari Uygulamalar (Dark Patterns)",
        "penalty_risk": "Reklam Kurulu tarafından 2.158.950 TL'den 8.635.800 TL'ye varan idari para cezası ve reklam durdurma.",
        "suggested_fix": "Yapay aciliyet ve kıtlık baskısı oluşturmayın; stok miktarını ERP/envanterle teyitli veya nesnel olarak 'Stokta var' şeklinde belirtin.",
        "severity": IssueSeverity.HIGH,
    },

    # -------------------------------------------------------------
    # 6. YASADIŞI BAHİS, TÜTÜN VE ELEKTRONİK SİGARA
    # -------------------------------------------------------------
    {
        "id": "TR_ILLEGAL_BETTING",
        "sector": TurkishComplianceSector.ILLEGAL_BETTING_TOBACCO,
        "title": "Yasadışı Bahis ve Kumar Terimleri",
        "patterns": [
            r"\bcanli\s+bahis\s+oyna\b",
            r"\bkacak\s+iddaa\b",
            r"\bbonus\s+veren\s+bahis\s+siteleri\b",
            r"\bcasino\s+slot\s+oyna\b",
            r"\bsweet\s+bonanza\s+taktikleri\b",
            r"\bguvenilir\s+bahis\s+sitesi\b",
        ],
        "legal_basis": "7258 sayılı Kanun md. 5 & TCK md. 228 (Kumar oynanması için yer ve imkan sağlama)",
        "penalty_risk": "1 ila 3 yıl hapis cezası ve BTK tarafından anında site kapatma/erişim engeli.",
        "suggested_fix": "Yasadışı bahis içeriği barındırılamaz, sayfadan derhal kaldırılmalıdır.",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "id": "TR_TOBACCO_VAPE",
        "sector": TurkishComplianceSector.ILLEGAL_BETTING_TOBACCO,
        "title": "Tütün, Nargile ve Elektronik Sigara Satış/Reklam Yasağı",
        "patterns": [
            r"\belektronik\s+sigara\s+satin\s+al\b",
            r"\biqos\s+siparis\b",
            r"\bpuff\s+bar\s+fiyat\b",
            r"\bvape\s+likit\s+al\b",
            r"\bnargile\s+tutunu\s+siparis\b",
        ],
        "legal_basis": "4207 sayılı Kanun & 2149 sayılı Cumhurbaşkanlığı Kararı (E-sigara ithalatı ve satışı yasaktır)",
        "penalty_risk": "Kaçakçılıkla Mücadele Kanunu kapsamında adli işlem ve site erişim engeli.",
        "suggested_fix": "Tütün ve nikotin ürünlerinin internet ortamında satışı ve tanıtımı tamamen yasaktır.",
        "severity": IssueSeverity.CRITICAL,
    }
]

def scan_text_for_turkish_compliance(text: str, sector: Optional[str] = None) -> List[Dict[str, Any]]:
    """Metin veya HTML içeriğinde Türkiye mevzuatına aykırı ifadeleri tarar."""
    if not text:
        return []
    
    normalized = normalize_turkish_text(text)
    violations = []

    for rule in TURKISH_REGULATORY_RULES:
        if sector and rule["sector"].value != sector:
            continue

        for pat in rule["patterns"]:
            match = re.search(pat, normalized, re.IGNORECASE)
            if match:
                start, end = match.span()
                matched_snippet = text[max(0, start-15):min(len(text), end+15)]
                violations.append({
                    "rule_id": rule["id"],
                    "sector": rule["sector"].value,
                    "title": rule["title"],
                    "matched_pattern": match.group(0),
                    "context_snippet": matched_snippet.strip(),
                    "legal_basis": rule["legal_basis"],
                    "penalty_risk": rule["penalty_risk"],
                    "suggested_fix": rule["suggested_fix"],
                    "severity": rule["severity"].value,
                })
                break # Her kural için ilk eşleşme yeterlidir

    return violations

class TurkishRegulatoryComplianceRule(SeoRule):
    """
    Türkiye Cumhuriyeti Ticaret Bakanlığı, TİTCK, TBB, SPK ve BDDK mevzuatlarına
    göre web sayfalarında yer alması cezaya/erişim engeline yol açacak
    yasaklı kelime ve iddia kalıplarını denetleyen deterministik kural.
    """
    rule_id = "RULE_TURKISH_REGULATORY_COMPLIANCE"
    name = "Türkiye Mevzuatı ve Reklam Kurulu Yasaklı Kelime/Kalıp İhlali"
    category = RuleCategory.COMPLIANCE
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://ticaret.gov.tr/tuketici/ticari-reklamlar"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        # Taranacak alanlar: Title, Meta Açıklama, H1, H2, ve sayfa gövde metni
        fields_to_check = [
            ("title", page_context.get("title") or ""),
            ("meta_description", page_context.get("meta_description") or ""),
            ("h1", page_context.get("h1") or ""),
            ("h2", " ".join(page_context.get("h2", [])) if isinstance(page_context.get("h2"), list) else str(page_context.get("h2") or "")),
            ("content", page_context.get("content") or page_context.get("body_text") or ""),
            ("url", page_context.get("url") or "")
        ]

        aggregated_text = "\n".join([val for _, val in fields_to_check if val])
        if not aggregated_text.strip():
            return None

        violations = scan_text_for_turkish_compliance(aggregated_text)
        if not violations:
            return None

        # En kritik ihlali baz al
        critical_count = sum(1 for v in violations if v["severity"] == "CRITICAL")
        chosen_severity = IssueSeverity.CRITICAL if critical_count > 0 else IssueSeverity.HIGH

        first_v = violations[0]
        violation_list_str = ", ".join([f"'{v['matched_pattern']}' ({v['title']})" for v in violations[:3]])

        return RuleCheckResult(
            passed=False,
            rule_id=self.rule_id,
            category=self.category,
            severity=chosen_severity,
            confidence=1.0,
            title=f"Türkiye Reklam Mevzuatı İhlali: {first_v['title']}",
            description=(
                f"Sayfada Türkiye'de yasal yaptırıma (idari para cezası veya BTK erişim engeli) "
                f"neden olabilecek {len(violations)} yasaklı ifade tespit edildi: {violation_list_str}. "
                f"Yasal Dayanak: {first_v['legal_basis']}"
            ),
            evidence={
                "url": page_context.get("url"),
                "total_violations": len(violations),
                "violations": violations,
                "penalty_risk": first_v["penalty_risk"],
            },
            recommendation_template=(
                f"Tespit edilen '{first_v['matched_pattern']}' ifadesini derhal kaldırın. "
                f"Tavsiye Edilen Uyumlu Alternatif: {first_v['suggested_fix']}"
            ),
            documentation_url=self.documentation_url
        )
