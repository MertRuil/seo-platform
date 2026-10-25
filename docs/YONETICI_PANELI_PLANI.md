# Yönetici paneli: kapsam ve ekran planı

Durum: taslak, onay bekliyor. Kod yazılmadı.

## 1. Neden gerekli

- `users.is_platform_admin` bayrağı var, ama hiçbir API ucu bu bayrağa bakmıyor.
- API'de organizasyon oluşturma ve üye ekleme uçları var. Web'de bunların ekranı yok. Web'den kayıt olan kullanıcının organizasyonu olmadığı için site ekleyemiyor ("Organizasyon bulunamadı.").
- Üretimde `init_db` yöneticiye de organizasyon açmıyor. Bugün canlıda kimse site ekleyemez.
- Plan değiştirmek, AI kredisi tanımlamak ya da hesap kapatmak için veritabanına elle bağlanmak gerekiyor.
- `audit_logs` tablosuna kayıt yazılıyor, ama okuyan bir ekran yok.

## 2. Kimler kullanır

Panel yalnızca platform ekibi içindir. Müşteriler paneli görmez, menüde bağlantısı da çıkmaz. Ekip, tüm müşterilerin hesaplarını, ödemelerini ve kullanımını tek yerden görür.

| Kim | Ne görür |
| --- | --- |
| Platform yöneticisi (`is_platform_admin = true`) | `/admin` altındaki tüm ekranlar |
| Organizasyon sahibi veya yöneticisi (OWNER, ADMIN) | Bu panelin kapsamında değil. Kendi ekibini yöneteceği "Ekip" sayfası 2. sürümde. |
| Diğer kullanıcılar | `/admin` adresine girerse 403 sayfası görür, menüde bağlantı çıkmaz |

## 3. Bağlı düzeltme (Faz 0)

Panelden bağımsız olarak, kayıt akışı organizasyonsuz kullanıcı üretmemeli:

- `POST /auth/register`, kullanıcıyla birlikte bir organizasyon (`<ad>` veya e-posta alan adından türetilen ad), OWNER üyeliği ve `free` plan aboneliği oluşturur.
- Mevcut organizasyonsuz kullanıcılar için tek seferlik bir betik aynı işi yapar.
- Böylece "İlk siteyi ekleyin" formu çalışır. Yönetici paneli istisnai durumlar için kalır.

## 4. Erişim kuralları

1. **Arka uç tek karar noktası.** Yeni `require_platform_admin` bağımlılığı, her istekte `users` tablosundan `is_platform_admin` ve `is_active` alanlarını okur. Token içindeki `is_admin` alanına güvenmez, çünkü o alan yetki kaldırıldıktan sonra token süresi dolana kadar geçerli kalır.
2. Next.js'in kendi ürettiği yerel token'lar (`auth_source = nextjs_local`) `/admin` uçlarında her ortamda reddedilir.
3. Web tarafında menü bağlantısı yalnızca `user.isAdmin` olduğunda görünür. Bu yalnızca görünüm içindir, asıl kontrol arka uçta.
4. `/api/v1/admin/*` için tek bir BFF yönlendirmesi olur ve yerel depoya düşmez. Arka uca ulaşılamazsa 503 döner. Panel hiçbir zaman örnek veri göstermez.
5. Yönetici kendi yöneticiliğini kaldıramaz ve kendini pasife alamaz. Son platform yöneticisi kaldırılamaz.
6. Bir organizasyonun son OWNER'ı çıkarılamaz ve rolü düşürülemez.
7. Paneldeki her yazma işlemi `audit_logs` tablosuna, önceki ve sonraki durumuyla birlikte kaydedilir. Plan ve kredi işlemlerinde gerekçe alanı zorunludur.

## 5. Ekranlar

Hepsi mevcut uygulamanın içinde `/admin` altında yer alır. Sol menüde en altta "Yönetim" grubu olur. Görsel dil mevcut bileşenlerle aynı: `PageHeader`, `DataTable`, `PageTabs`, `Badge`.

### 5.1. Genel bakış: `/admin`

```
┌ Yönetim ─────────────────────────────────────────────┐
│ Kullanıcı 128 (aktif 121) │ Organizasyon 74 │ Site 96 │
│ Aylık yinelenen gelir $1.240 │ Bu ay tahsilat $1.105   │
│ Ödemesi geciken 2 │ Son 30 gün yeni ücretli 5, iptal 1 │
│ Son 7 gün tarama 310 (başarısız 12)                    │
├──────────────────────────────┬────────────────────────┤
│ Plan dağılımı                │ Sistem durumu           │
│ free 51 · starter 12 · pro 8 │ Veritabanı   bağlı      │
│ agency 3 · enterprise 0      │ Kuyruk       süreç içi  │
│                              │ AI sağlayıcı anahtar yok│
│                              │ E-posta      yapılandırılmadı │
├──────────────────────────────┴────────────────────────┤
│ Son yönetici işlemleri (10)                     Tümü → │
└───────────────────────────────────────────────────────┘
```

- Sistem durumu yalnızca evet/hayır döndürür, anahtar değeri göstermez: veritabanı, Redis, LLM sağlayıcısının adı ve anahtarın tanımlı olup olmadığı, SMTP.
- Bu kart, durum incelemesinde bulunan sorunları ("AI anahtarı yok", "veritabanına ulaşılamıyor") ilk bakışta gösterir.

### 5.2. Kullanıcılar: `/admin/users`

Tablo sütunları: e-posta, ad, organizasyonlar (rozet olarak ad ve rol), durum (aktif/pasif), platform yöneticisi, kayıt tarihi, son giriş.

- E-posta veya ada göre arama. Durum ve yöneticilik süzgeci. Sayfa başına 50 satır.
- Satıra tıklayınca sağda detay paneli açılır: üyelikleri, sahip olduğu siteler, son 20 denetim kaydı.
- İşlemler:
  - Pasife al / aktif et. Pasife alınan kullanıcının token'ları bir sonraki istekte reddedilir; bu kontrol zaten var.
  - Platform yöneticisi yap / kaldır. Onay penceresi açılır.
  - Bir organizasyona ekle: organizasyon ve rol seçilir.
- 1. sürümde olmayanlar: kullanıcıyı silme (pasife alma yeter, KVKK silme talebi 2. sürümde), şifre sıfırlama (SMTP yapılandırılınca), kullanıcının yerine giriş yapma.

### 5.3. Organizasyonlar: `/admin/organizations`

Tablo sütunları: ad, slug, plan, abonelik durumu, üye sayısı, site sayısı, bu ayki AI kredisi kullanımı ve hakkı, oluşturulma tarihi.

- "Yeni organizasyon" düğmesi: ad ve sahip e-postası istenir. Sahip kayıtlı değilse hata verir; davet akışı 2. sürümde.

Detay sayfası `/admin/organizations/[id]`, sekmelerle:

| Sekme | İçerik | İşlemler |
| --- | --- | --- |
| Üyeler | e-posta, rol, eklenme tarihi | ekle, rol değiştir, çıkar (son OWNER korunur) |
| Siteler | ad, alan adı, doğrulama, son tarama ve durumu | yalnızca görüntüleme, siteye geçiş bağlantısı |
| Plan ve kullanım | plan, durum, dönem sonu, sayaçlar, kredi bakiyesi | planı değiştir (sağlayıcı MANUAL olarak kaydedilir), AI kredisi tanımla; ikisinde de gerekçe zorunlu |
| Denetim kaydı | bu organizasyonun kayıtları | yalnızca görüntüleme |

### 5.4. Ödemeler: `/admin/billing`

Üç sekme:

| Sekme | İçerik |
| --- | --- |
| Abonelikler | organizasyon, plan, durum (deneme, aktif, ödemesi gecikmiş, iptal), sağlayıcı (Paddle veya elle), dönem sonu, aylık tutar. Durum ve plana göre süzgeç. |
| Faturalar | numara, organizasyon, tutar, vergi, para birimi, durum (ödendi, bekliyor, iptal), kesim ve ödeme tarihi, PDF bağlantısı. Tarih ve duruma göre süzgeç. |
| Ödeme olayları | Paddle'dan gelen webhook olayları: tür, zaman, işlenme durumu, hata mesajı. Bu sekme, işlenemeyen ödemeleri bulmak için. |

- Üstte özet satırı yer alır: aylık yinelenen gelir, bu ayki tahsilat, ödemesi geciken abonelik sayısı, son 30 günde yeni ücretli abonelik ve iptal sayısı. Tutarlar para birimine göre ayrı gösterilir, kurla çevrilmez.
- Aylık yinelenen gelir, aktif aboneliklerin plan fiyatından hesaplanır. Yıllık fiyat 12'ye bölünür.
- Bu ekran yalnızca okunur. İade ve iptal Paddle panelinden yapılır.
- **Veri durumu:** Faturalar yalnızca Paddle webhook'u geldiğinde yazılıyor. Paddle anahtarları henüz tanımlı olmadığı için bu sekme ödeme akışı canlıya alınana kadar boş kalır. Elle atanan planlar Abonelikler sekmesinde görünür.

### 5.5. Kullanım: `/admin/usage`

- Organizasyon başına bu dönemin tablosu: taranan sayfa, otomatik düzeltme, AI kredisi, AI token kullanımı. Her değer plan sınırının yüzdesi olarak da gösterilir.
- Sınırın %80'ini geçenler sarı, sınıra ulaşanlar kırmızı işaretlenir. Satış fırsatını ve kötüye kullanımı buradan görürsünüz.
- Satıra tıklayınca son 30 günün günlük kullanım grafiği ve kullanım olayları açılır: hangi tarama ya da öneri ne kadar harcadı.
- AI kredi hareketleri (tanımlama, tüketim, iade) bakiyeyle birlikte listelenir.
- **Veri durumu:**
  - Taranan sayfa ve otomatik düzeltme sayaçları doğru yazılıyor.
  - AI kullanımını yalnızca yol haritası ucu kaydediyor, o da gerçek token sayısı yerine her seferinde sabit 1.500 yazıyor. Öneri üreten AI ajanları hiç kayıt bırakmıyor.
  - Bu ekranın anlamlı olması için Faz 1'e "gerçek AI kullanımını kaydetme" işi eklendi (bölüm 7).

### 5.6. Denetim kaydı: `/admin/audit`

- Süzgeçler: organizasyon, kullanıcı, işlem türü, tarih aralığı.
- Satırda zaman, kim, işlem, kaynak türü ve kimliği bulunur. Satır açılınca önceki ve sonraki durum yan yana görünür.
- Yalnızca okunur, kayıtlar silinemez. Sayfa başına 50 satır.

## 6. API uçları (yeni, `/api/v1/admin`)

| Yöntem | Yol | İş |
| --- | --- | --- |
| GET | `/admin/overview` | sayılar, plan dağılımı, son işlemler |
| GET | `/admin/system` | bileşen durumu (yalnızca evet/hayır) |
| GET | `/admin/users?q=&status=&admin=&page=` | kullanıcı listesi |
| GET | `/admin/users/{id}` | kullanıcı detayı |
| PATCH | `/admin/users/{id}` | `is_active`, `is_platform_admin` |
| GET | `/admin/organizations?q=&plan=&page=` | organizasyon listesi |
| POST | `/admin/organizations` | ad ve sahip e-postasıyla oluşturma |
| GET | `/admin/organizations/{id}` | detay: üyeler, siteler, abonelik, kullanım |
| POST | `/admin/organizations/{id}/members` | üye ekleme |
| PATCH | `/admin/organizations/{id}/members/{user_id}` | rol değiştirme |
| DELETE | `/admin/organizations/{id}/members/{user_id}` | üyeyi çıkarma |
| POST | `/admin/organizations/{id}/plan` | plan değiştirme (gerekçe zorunlu) |
| POST | `/admin/organizations/{id}/credits` | kredi tanımlama (gerekçe zorunlu) |
| GET | `/admin/billing/summary` | gelir, tahsilat, gecikme, yeni ve iptal sayıları |
| GET | `/admin/billing/subscriptions?status=&plan=&page=` | abonelik listesi |
| GET | `/admin/billing/invoices?status=&from=&to=&page=` | fatura listesi |
| GET | `/admin/billing/events?processed=&page=` | ödeme olayları; ham içerik yerine yalnızca tür, zaman ve hata |
| GET | `/admin/usage?metric=&page=` | organizasyon başına dönem kullanımı ve sınır oranı |
| GET | `/admin/usage/{org_id}` | günlük seri, kullanım olayları, kredi hareketleri |
| GET | `/admin/audit?org=&user=&action=&from=&to=&page=` | denetim kaydı |

Plan ve kredi uçları mevcut `EntitlementGuard` ve `UsageService` servislerini kullanır, iş mantığı kopyalanmaz.

## 7. Veri değişiklikleri (Alembic göçü)

- `audit_logs.organization_id` boş bırakılabilir olur. Kullanıcıyı pasife almak gibi platform düzeyindeki işlemlerin organizasyonu yok.
- `users.last_login_at` sütunu eklenir ve başarılı girişte güncellenir.
- Diğer tablolar değişmez.

Gerçek AI kullanımının kaydı (Faz 1):
- Üç LLM sağlayıcısı da (Anthropic, OpenAI, Gemini) yanıtla birlikte girdi ve çıktı token sayısını döndürüyor. `services/agents/base.py` bu sayıları okuyup çağrıyı başlatan organizasyon adına `usage_events` tablosuna (`metric = ai_tokens`) ve `tokens_used_this_month` sayacına yazar.
- Yol haritası ucundaki sabit 1.500 tahmini kaldırılır, yerine gerçek sayı yazılır.
- Anahtar olmadığında kullanılan test sağlayıcısı kullanım kaydı bırakmaz.

## 8. Bu sırada düzeltilecek güvenlik açığı

`billing.py` içindeki `_manual_billing_allowed`, yetkiyi token içindeki `is_admin` alanından okuyor. Yöneticiliği kaldırılan biri, token süresi dolana kadar ücretli plan açıp kredi tanımlayabilir. Bu fonksiyon da `require_platform_admin` ile aynı veritabanı kontrolüne geçirilir.

## 9. Testler

Arka uç (pytest):
- Yönetici olmayan kullanıcı her `/admin` ucunda 403 alır, yerel token 401 alır.
- Pasife alınan yöneticinin token'ı reddedilir. Yöneticiliği kaldırılan kişi bir sonraki istekte 403 alır.
- Yönetici kendini pasife alamaz, kendi yöneticiliğini kaldıramaz. Son yönetici korunur.
- Son OWNER çıkarılamaz, rolü düşürülemez.
- Her yazma işlemi tam olarak bir denetim kaydı bırakır. Plan ve kredi işlemleri gerekçesiz reddedilir.
- Kayıt organizasyon, OWNER üyeliği ve `free` abonelik oluşturur (Faz 0).
- Aylık gelir hesabı: aylık ve yıllık fiyat, farklı para birimleri, iptal ve deneme durumundaki abonelikler (bunlar hesaba katılmaz).
- Ödeme olayları ucu webhook'un ham içeriğini döndürmez.
- Bir LLM çağrısı, sağlayıcının bildirdiği token sayısını doğru organizasyona yazar.

Web (`test-ui-suite.ts`):
- Yönetim menüsü yalnızca `isAdmin` olduğunda görünür.
- `/api/v1/admin` yönlendirmesinde yerel depoya düşüş yoktur.

Tarayıcı: masaüstü ve 375 px'te altı ekran, açık ve koyu tema, klavyeyle gezinme.

## 10. Uygulama sırası

| Faz | İş | Dokunulan yer |
| --- | --- | --- |
| 0 | Kayıtta organizasyon ve plan, eski kullanıcılar için betik | `apps/api/routes/auth.py`, `scripts/` |
| 1 | Göç, `require_platform_admin`, admin uçları, faturalama kontrolü, gerçek AI kullanımı kaydı, pytest | `apps/api/routes/admin.py` (yeni), `services/security/`, `services/agents/base.py`, `infra/migrations/`, `tests/` |
| 2 | BFF yönlendirmesi, `api.ts` istemcisi, altı ekran, menü | `apps/web/src/app/admin/`, `apps/web/src/app/api/v1/admin/`, `nav.ts` |
| 3 | Testler, build, tarayıcı kontrolü, commit | |

Her faz ayrı commit olur. Mobil uygulamaya yönetim ekranı eklenmez.

## 11. Karar bekleyen sorular

1. Yeni kayıt olan kullanıcıya otomatik organizasyon ve `free` plan açılsın mı? Önerim: evet (Faz 0).
2. 1. sürümde kullanıcı silme olmasın, yalnızca pasife alma olsun mu? Önerim: evet.
3. "Kullanıcının yerine giriş yap" özelliği gerekli mi? Önerim: 1. sürümde olmasın. Yanlış kullanımı ağır sonuç doğurur, ayrıca ayrı onay ve kayıt kuralı ister.
4. Panel aynı uygulamada `/admin` altında mı olsun, ayrı bir alan adında mı? Önerim: aynı uygulamada.
