Adım 6 — Workout Summary + Supabase Kayıt implementasyonuna geç.

Önceki hazırlık aşamasında oluşturduğun altyapıyı ve mevcut veritabanı şemasını referans al. Tablo, kolon, type, repository ve servis isimlerini ben tek tek tarif etmeyeceğim; mevcut projedeki en doğru isimleri ve yapıyı sen tespit et.

# Temel Mimari Karar

Workout session kayıt sistemi yalnızca Biceps Curl’e özel hardcode edilmemeli.

Doğru yaklaşım şu olmalı:

* Workout session kayıt altyapısı tüm egzersizleri destekleyecek şekilde genel tasarlanmalı.
* Session kaydı, error kaydı ve stats ekranının veri okuyacağı yapı egzersizden bağımsız olmalı.
* Ancak şu an gerçek analiz verisi üreten tek egzersiz Fitness → Biceps Curl olduğu için ilk çalışan implementasyon Biceps Curl üzerinden bağlanmalı.
* Diğer egzersizlerde Biceps’e özel rep count, warning, form score veya rep log yazılmamalı.
* İleride Squat, Pilates veya Therapy analyzer’ları eklendiğinde aynı genel saveWorkoutSession altyapısını kullanabilmeliler.

Yani yanlış yaklaşım:

```text
saveBicepsCurlSession()
```

Daha doğru yaklaşım:

```text
saveWorkoutSession()
```

ve bu fonksiyon egzersizden gelen genel session summary + analysis summary + error summary verisini kaydetmeli.

---

# Amaç

Fitness → Biceps Curl egzersizi bittiğinde:

1. Genel workout summary oluştur
2. Mevcut session kayıt yapısına workout session kaydı yaz
3. Rep log içindeki warning/hata verilerini mevcut session error kayıt yapısına yaz
4. Kullanıcıya workout summary göster
5. Stats ekranının bu kayıtlardan veri okuyabilecek halde kalmasını sağla

Bu implementasyon Biceps Curl üzerinden test edilecek.
Ancak kayıt altyapısı ileride tüm egzersizler tarafından kullanılabilecek şekilde genel kalmalı.

---

# Önemli

Kod yazmadan önce mevcut dosyaları incele:

* Biceps analyzer / hook dosyaları
* ExerciseCameraScreen
* exercise selection / navigation yapısı
* session repository
* stats repository/service
* Supabase type dosyaları
* SQLite local cache dosyaları
* workout session / session error ile ilgili tüm dosyalar
* migration dosyaları

Mevcut mimariye uygun ilerle.
Yeni isimler uydurmadan önce projede zaten var olan isimleri, tipleri ve fonksiyonları kullan.

---

# Yapılacaklar

## 1. Genel Workout Session Summary Modeli

Önce egzersizden bağımsız bir workout summary modeli oluştur veya mevcut modeli genişlet.

Bu model mantıksal olarak şunları desteklemeli:

* kullanıcı
* egzersiz
* kategori ilişkisi exercises üzerinden dolaylı olabilir
* başlangıç zamanı
* bitiş zamanı veya süre
* tamamlanan tekrar / completed count
* ortalama form skoru
* en iyi / en kötü form skoru üretilebiliyorsa
* analiz sonucu varsa rep log / analysis log
* hata / warning özeti

Alan isimlerini mevcut schema ve type yapısına göre sen belirle.

---

## 2. Genel Save Akışı

Biceps’e özel olmayan genel bir kayıt akışı kur.

Örnek mantık:

```text
finishWorkout()
→ buildWorkoutSummary()
→ saveWorkoutSession()
→ saveSessionErrors()
→ showWorkoutSummary()
```

Bu akış ileride diğer egzersizler tarafından da kullanılabilmeli.

Biceps Curl bu genel akışı kullanan ilk egzersiz olacak.

---

## 3. Biceps Curl Finish Akışı

Kullanıcı Fitness → Biceps Curl ekranında “Bitir” butonuna bastığında:

* tracking durmalı
* session süresi hesaplanmalı
* Biceps analyzer’dan mevcut session özeti alınmalı
* total reps hesaplanmalı
* sol/sağ tekrar bilgisi varsa summary’ye eklenmeli
* form score özeti hesaplanmalı
* rep log / warning özeti hazırlanmalı
* genel saveWorkoutSession akışı çağrılmalı
* workout summary UI gösterilmeli

Biceps’e özel metrikler summary içinde saklanabilir ancak save akışı sadece Biceps’e özel olmamalı.

---

## 4. Diğer Egzersizlerin Davranışı

Diğer egzersizlerde şimdilik analyzer yoksa:

* Biceps analyzer çalışmamalı
* Biceps rep count oluşmamalı
* Biceps warning/form score oluşmamalı
* Biceps’e özel session kaydı yazılmamalı

Ancak genel mimari ileride bu egzersizlerin kendi analyzer’ları eklendiğinde aynı kayıt sistemini kullanacak şekilde hazır olmalı.

Eğer analyzer olmayan egzersizlerde “Bitir” butonu varsa:

* ya yalnızca generic session tamamlandı mesajı göster
* ya da “Bu egzersiz için analiz yakında eklenecek” mesajı göster

Biceps’e özel veri yazma.

---

## 5. Session Error Kaydı

Biceps Curl rep log içinde oluşan warning/hata verilerini mevcut error mapping yapısıyla kaydet.

Mevcut hata kodu / warning mapping dosyalarını kullan.

Aynı hata türü birden fazla kez oluştuysa uygun şekilde grupla ve count mantığını kullan.

Bu sistem de genel düşünülmeli:

* error kayıt altyapısı tüm egzersizler için kullanılabilir olmalı
* ancak şu an Biceps warnings bu altyapıya bağlanan ilk veri kaynağı olacak

---

## 6. Workout Summary UI

Bitir işleminden sonra kullanıcıya basit bir workout summary göster.

Mevcut UI yapısına en az müdahaleyle uygula.

Summary içinde mantıksal olarak şu bilgiler bulunmalı:

* egzersiz adı
* süre
* toplam tekrar veya completed count
* varsa sol/sağ tekrar
* ortalama form skoru
* varsa en iyi / en düşük form skoru
* en sık görülen uyarılar
* kayıt durumu

Tasarımı abartma. Öncelik veri akışının doğru çalışması.

---

## 7. Kayıt Hatası Yönetimi

Kayıt başarısız olursa uygulama crash olmamalı.

Kullanıcı antrenman sonucunu yine görebilmeli.

Kayıt hatası UI’da basit şekilde belirtilmeli ve console’da detaylı loglanmalı.

---

## 8. Stats Screen Entegrasyonunu Koru

Önceki hazırlık aşamasında Daily / Weekly stats ekranı için veri modeli oluşturuldu.

Bu adımda yapılan kayıtlar, mevcut stats repository/service yapısıyla uyumlu olmalı.

Yani Adım 6 sonrası kaydedilen Biceps Curl session’ları istatistik ekranında kullanılabilir veri üretmeli.

Stats ekranı şu verileri bu session kayıtlarından okuyabilmeli:

* Most Common Exercises
* Daily / Weekly Form Improvement
* Form Error Breakdown

---

# Çok Önemli Kurallar

* Kayıt sistemi genel olmalı, sadece Biceps Curl’e hardcode edilmemeli.
* Biceps Curl şu an genel kayıt altyapısının ilk gerçek kullanıcısı olacak.
* Biceps analyzer yalnızca Fitness → Biceps Curl için çalışmaya devam etmeli.
* Diğer egzersizlerde Biceps’e özel kayıt yapılmamalı.
* Reference capture, rep counter, warning ve form score algoritmalarını değiştirme.
* MediaPipe pipeline’a dokunma.
* Stats ekranı için oluşturulan yeni yapıyı bozma.
* Mevcut schema, repository ve type isimlerine bağlı kal.
* Yeni tablo/kolon gerekiyorsa önce neden gerektiğini açıkla.

---

# Bu Aşamada Yapma

* Pilates analyzer yazma
* Therapy analyzer yazma
* Squat analyzer yazma
* Biceps analiz algoritmasını yeniden tasarlama
* UI tasarımını komple değiştirme
* Stats ekranını yeniden tasarlama

---

# Başarı Kriterleri

* Biceps Curl ekranında “Bitir”e basınca session kapanmalı
* Workout summary oluşmalı
* Antrenman sonucu genel session kayıt yapısına yazılmalı
* Warning/error verileri mevcut error kayıt yapısına yazılmalı
* Kayıt başarısız olursa uygulama crash olmamalı
* Stats ekranı bu kayıtlardan veri okuyabilecek durumda kalmalı
* Kayıt altyapısı ileride diğer egzersizlere genişletilebilir olmalı
* Diğer egzersizler Biceps’e özel analiz veya kayıt üretmemeli

Kod yazmadan önce mevcut mimariye göre kısa bir uygulama planı çıkar, sonra implementasyona geç.
