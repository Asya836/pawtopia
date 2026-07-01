# Pawtopia

Pawtopia sokak hayvanlarının sistematik olarak kayıt altına alınması, izlenmesi ve kullanıcılar tarafından desteklenmesini amaçlayan bir mobil uygulamadır. Uygulama, kullanıcı etkileşimi, konum tabanlı veri yönetimi ve geçmiş kayıt takibi üzerine kuruludur. React Native ve Expo ile geliştirilmiştir ve Firebase Firestore'u veri depolama ve gerçek zamanlı güncellemeler için kullanır.


## Özellikler
- Ana sayfa: son eklenen veya yakınınızdaki hayvanları listeler
- Harita görünümü: hayvanların konumunu harita üzerinde gösterir
- Detay sayfası: hayvanın bilgileri, fotoğrafları ve konum, besleme, tedavi geçmişleri
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



## Proje Yapısı (kısa özet)
- `App.js` / `index.js`: uygulama başlangıç noktası
- `src/navigation`: uygulama gezinme bileşenleri
- `src/pages`: sayfalar
- `src/components`: tekrar kullanılabilir UI bileşenleri
- `src/firebase`: Firestore iletişimi ve yardımcı fonksiyonlar
- `assets/`, `src/images`: uygulama görselleri ve ikonlar

## Ekran Görüntüleri
<img width="921" height="2048" src="https://github.com/user-attachments/assets/7e6763b3-4af0-416e-9201-4e8aab360af4" />

<img width="921" height="2048" src="https://github.com/user-attachments/assets/8daeb96b-3522-461f-a1b0-505ef25962bd" />

<img width="921" height="2048" src="https://github.com/user-attachments/assets/06930999-4b52-42e6-a8bb-2748d7d8b947" />

<img width="921" height="2048" src="https://github.com/user-attachments/assets/a5c3924b-afff-49c5-b480-f60b12a1247e" />

