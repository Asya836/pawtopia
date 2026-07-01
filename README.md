# Pawtopia

Pawtopia, kayıp ve bulunan hayvanların konumlarını paylaşmayı ve keşfetmeyi kolaylaştıran mobil bir uygulamadır. Uygulama React Native ve Expo ile geliştirilmiştir ve Firebase Firestore'u veri depolama ve gerçek zamanlı güncellemeler için kullanır.

**Ana amaçlar:**
- Kayıp hayvan bildirimleri oluşturmak ve yayınlamak
- Harita üzerinde hayvanların güncel konumlarını görmek
- Hayvan listesi ve detay sayfaları ile iletişim bilgilerine ulaşmak

## Özellikler
- Ana sayfa: son eklenen veya yakınınızdaki hayvanları listeler
- Harita görünümü: hayvanların konumunu harita üzerinde gösterir (`src/pages/MapPage.jsx`)
- Detay sayfası: hayvanın bilgileri, fotoğrafları ve konum geçmişi
- Gerçek zamanlı güncellemeler: Firestore snapshot ile konumlar ve hayvan verileri anlık güncellenir
- Kullanıcı konumu: kullanıcı konumunu gösterir ve haritayı yeniden merkezlemeyi sağlar

## Hızlı Başlangıç

1. Depoyu klonlayın:

```bash
git clone <repo-url>
cd pawtopia
```

2. Bağımlılıkları yükleyin:

```bash
npm install
# veya
yarn
```

3. Geliştirme sunucusunu başlatın:

```bash
npm start
# veya
expo start
```

4. Cihazda çalıştırma:
- Expo Go uygulaması ile tarayın veya emülatörde `a` (Android) / `i` (iOS) ile başlatın.

## Ortam Değişkenleri / Firebase
Projeyi çalıştırmak için Firebase yapılandırması gereklidir. `src/firebase/config.js` içinde kullanılan anahtarları projenize uygun şekilde ayarlayın.

- Firestore koleksiyonları: `pets` ve her `pets/{id}/locations` alt koleksiyonu beklenir.

Örnek yapı (`src/firebase/config.js`):

```js
// export const firebaseConfig = {
//   apiKey: "...",
//   authDomain: "...",
//   projectId: "...",
//   storageBucket: "...",
//   messagingSenderId: "...",
//   appId: "..."
// }
```

## Proje Yapısı (kısa özet)
- `App.js` / `index.js`: uygulama başlangıç noktası
- `src/navigation`: uygulama gezinme bileşenleri
- `src/pages`: sayfalar (Home, Map, Profile, AnimalDetail, vs.)
- `src/components`: tekrar kullanılabilir UI bileşenleri (kartlar, butonlar)
- `src/firebase`: Firestore iletişimi ve yardımcı fonksiyonlar
- `assets/`, `src/images`: uygulama görselleri ve ikonlar

## Harita Davranışı — Önemli Değişiklik
- Harita geçişleri (kamera animasyonları) uygulama içinde kasıtlı olarak kaldırıldı: `src/pages/MapPage.jsx` dosyasında `animateToCoordinates` fonksiyonunun varsayılan süre `0` yapıldı. Bu sayede harita odaklanmaları anında gerçekleşir ve animasyon kaynaklı gecikmeler/çakışmalar engellenir.

## Geliştirme Notları ve Test
- Kod formatı: lint/format araçları yoksa proje stilini takip edin
- Yeni özellik eklerken küçük, tek amaçlı commitler yapın

## Yayınlama
- Expo ile dağıtım yapıyorsanız `expo build` veya `eas build` komutlarını kullanın. Prod için Firebase kurallarınızı gözden geçirin.

## Katkıda Bulunma
- Bir özellik/düzeltme eklemek için fork → branch → PR akışını kullanın. Değişikliklerinizin açıklayıcı commit mesajları ve kısa bir PR açıklaması olmasına dikkat edin.

## Lisans
- Proje lisansı yoksa veya sahibi tarafından belirtilmemişse, kullanmadan önce repo sahibine danışın.

---

Değişiklikleri README'ye ekledim. Daha fazla detay (ör. ekran görüntüleri, API dokümantasyonu, test talimatları) istiyorsanız ekleyeyim.
