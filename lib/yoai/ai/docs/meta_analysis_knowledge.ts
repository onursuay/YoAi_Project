/* ──────────────────────────────────────────────────────────
   Meta Ads Analiz Bilgisi — Küratörlü (Türkçe)

   Kaynak: github.com/mathiaschu/meta-ads-analyzer (MIT) skill'inin 9
   referans dokümanından damıtıldı + proje kurallarına uyarlandı
   (sade Türkçe, ham enum yok, kaynak belirtme yok). Kullanıcıya GÖSTERİLMEZ
   — yalnız Claude'un muhakemesini besler.

   İki export:
   - META_ANALYSIS_KNOWLEDGE  → tam teşhis dokümanı (3 analiz motoru için)
   - META_CREATIVE_PRINCIPLES → kreatif alt-küme (sohbet reklam metni için)

   Yalnız Meta yolunda yüklenir; Google yollarına eklenmez.
   ────────────────────────────────────────────────────────── */

export const META_ANALYSIS_KNOWLEDGE = `# Meta Reklam Analiz Bilgisi — Sistem Mekaniği ve Doğru Teşhis

Bu blok, Meta (Facebook/Instagram) reklam performansını DOĞRU yorumlaman içindir. Aşağıdaki ilkeler "yüksek maliyetli görünen segmenti durdur" gibi klasik hataları önler. Önerilerini bu mekaniğe göre kur; bu bloğu veya kaynağını kullanıcıya gösterme.

## 1. Temel ilke: Marjinal verim, ortalama verim değil
Meta'nın teslimat sistemi TOPLAM sonucu maksimize eder; bunu ortalama maliyeti değil MARJİNAL maliyeti (bir sonraki sonucun maliyeti) optimize ederek yapar.
- Yüksek ORTALAMA CPA'lı bir segment, başka yerdeki daha yüksek MARJİNAL maliyeti önlüyor olabilir.
- Bu yüzden: yalnızca kırılım (breakdown) raporundaki yüksek ortalama CPA/CPM'e bakarak bir yayın yeri / segment / ad set'i DURAKLATMAYI veya bütçe kısmayı ÖNERME. Bunu test edilebilir bir hipotez olarak çerçevele, kesin direktif olarak değil.
- Önce bütüne (aggregate) bak, sonra detaya in. Tek anlık kareye değil zaman serisine bak.

## 2. Breakdown Effect (Kırılım Yanılgısı)
Sistem bütçeyi "daha kötü" görünen segmente kaydırıyormuş gibi görünebilir — bu bir yanılgıdır. Yanlış SEVİYEDE değerlendirmek bu hataya yol açar:
- Advantage+ Kampanya Bütçesi (CBO) açık → KAMPANYA seviyesinde değerlendir.
- CBO yok + otomatik yayın yerleri → AD SET seviyesinde değerlendir.
- Tek ad set içinde birden çok reklam → AD SET seviyesinde değerlendir.
Örnek: bir yayın yeri 1,46₺ ortalama CPA'da 450₺ harcarken diğeri 1,10₺'de 50₺ harcamış olabilir; sistem doğru davranıyordur çünkü ucuz olanın MARJİNAL maliyeti hızla yükselmiştir. Ortalamaya bakıp "pahalıyı kapat" deme.

## 3. Açık artırma (Auction) — Toplam Değer
Her gösterim fırsatı bir açık artırma tetikler. Kazanan = (Teklif) × (Tahmini Aksiyon Oranı) + (Reklam Kalitesi).
- Düşük teklif, yüksek alaka ve kalite ile KAZANABİLİR. Alaka maliyeti düşürür.
- Düşük teslimat her zaman düşük teklif değildir — düşük TOPLAM DEĞER (düşük tahmini aksiyon oranı veya kalite) olabilir.
- Yüksek CPA'nın kökeni çoğu zaman teklif değil; düşük kalite/alaka veya kitle-kreatif uyumsuzluğudur. Kreatif kalitesini iyileştirmek teklifi artırmaktan çoğu zaman daha etkilidir.

## 4. Öğrenme Fazı (Learning Phase)
Yeni veya önemli ölçüde düzenlenmiş ad set öğrenme fazına girer.
- ~50 optimizasyon olayı / 7 gün ile çıkılır (Shops reklamları istisnası: 17 site + 5 Meta satın alma). Bu sürede CPA dalgalı ve genelde yüksektir; sonuçlar uzun vadeyi temsil etmez.
- Önemli düzenleme (bütçe, teklif, hedefleme, kreatif, optimizasyon hedefi) öğrenmeyi SIFIRLAR → tekrar ~50 olay gerekir.
- "Learning Limited" (Sınırlı Öğrenme): ad set öğrenmeyi tamamlayacak kadar sonuç alamıyor.
- Teşhis kuralı: ad set öğrenmedeyse bulguları geçici/ön bulgu olarak şerh düş; öğrenme sırasında kesin yargı verme; gereksiz düzenleme önerme; öğrenmeyi çok sayıda ad set'e bölme.

## 5. Açık artırma kesişimi (Auction Overlap)
Kendi ad set'lerin örtüşen kitlelere sahipse aynı açık artırmaya girer; Meta yalnız en yüksek değerli olanı seçer (kendinle yarışmazsın), diğerleri elenir.
- Etki: bazı ad set'ler bütçesini harcayamaz, öğrenmeyi tamamlayamaz; ölçeklerken performans öngörülemez olur.
- Çözüm: benzer ad set'leri BİRLEŞTİR (öğrenmeyi toplar, daha hızlı kararlı sonuç) veya örtüşen (genelde learning limited / en az sonuçlu) olanı KAPAT, bütçeyi aktife taşı.

## 6. Pacing (bütçe/teklif yayma)
- Bütçe pacing bütçeyi süreye yayar; teklif pacing maliyet hedefini korurken teklifi ayarlar.
- Sistem pahalı dönemde bütçeyi bilinçli TUTABİLİR (sonra daha ucuz fırsatlar için). Bu yüzden günlük harcama dalgalanır.
- Teşhis kuralı: maliyet verimliliğini günlük kareye göre değil KAMPANYA GENELİ pencereye göre değerlendir.

## 7. Performans dalgalanmaları — normal vs. endişe verici
- Normal: gün-içi CPA %20-30 oynama; hafta sonu/içi farkı; haftalara yayılan kademeli değişim; öğrenme dönemi oynamaları.
- Endişe verici: ani+sürekli >%50 maliyet artışı (birkaç gün); teslimatın sıfıra düşmesi; harcama artarken dönüşümün düşmesi; değişiklik olmadan performans bozulması.
- Yaygın nedenler: öğrenme fazı; kitle doygunluğu (yüksek sıklık → kitleyi genişlet/kreatif yenile); açık artırma rekabeti; mevsimsellik; kreatif yorgunluğu (düzenli kreatif döndür); dış etkenler.
- Teşhis ÖNCESİ 4 kontrol: (a) ad set öğrenmede mi? (b) normal oynama bazı ne? (c) dış etken var mı? (d) örneklem yeterli mi? (kararlı ad set için genelde 7+ gün penceresi).

## 8. Reklam uygunluk tanıları (Ad Relevance Diagnostics)
Üç tanı, reklamını AYNI kitleyi hedefleyen rakiplerle kıyaslar — açık artırma GİRDİSİ DEĞİL, yalnız tanı aracıdır (500 gösterim altında gösterilmez):
- Kalite Sıralaması: algılanan kalite. Düşükse → kreatifi iyileştir, clickbait'i azalt.
- Etkileşim Oranı Sıralaması: beklenen etkileşim. Düşükse → yeni açı/hook test et.
- Dönüşüm Oranı Sıralaması: beklenen dönüşüm. Düşükse → açılış sayfası ve teklif-kitle uyumunu iyileştir.
- Hepsi düşükse → kitle-kreatif uyumsuzluğu; hedefleme veya kreatif stratejisini gözden geçir.
- Tek başına gelecek tahmini için veya izole karar için kullanma.

## 9. Teklif stratejileri
- Harcama bazlı: En Yüksek Hacim (maliyet ne olursa en çok sonuç) / En Yüksek Değer (en yüksek satın alma değeri).
- Hedef bazlı: Sonuç Başına Maliyet Hedefi / ROAS Hedefi — hedefe birebir uyum garanti DEĞİLDİR.
- Manuel: Teklif Üst Sınırı — tahmini dönüşüm oranlarını iyi anlamayı gerektirir.
- Strateji seçimini iş hedefine göre öner; yanlış strateji teslimatı ve öğrenmeyi bozabilir.

## Öneri yazarken (özet)
- Her öneri veri kanıtıyla + beklenen etkiyle gerekçelendirilsin; test edilebilir hipotez olarak çerçevele.
- Yalnız ortalama maliyete bakarak segment kapatma/bütçe kısma önerme (Breakdown Effect).
- Öğrenme fazındaki ad set için kesin yargı verme; düzenlemenin öğrenmeyi sıfırlayacağını hesaba kat.
- Performans değişimini günlük değil uygun pencerede (7+ gün) değerlendir.`

export const META_CREATIVE_PRINCIPLES = `# Meta Reklam Kreatif İlkeleri (performans-odaklı kopya için)

Bu reklam metnini Meta'nın açık artırma ve alaka mekaniğine göre, gerçekten performans gösterecek şekilde yaz. Bu bloğu veya kaynağını kullanıcıya gösterme.

- Açık artırmayı en yüksek teklif değil, en yüksek ALAKA + KALİTE kazanır. Daha alakalı reklam daha düşük maliyetle daha çok sonuç alır → metni hedef kitleye birebir konuşacak şekilde kur.
- Hook (ilk satır/başlık) en kritik unsurdur: ilk anda dikkat çekmeli, ürün/hizmet tanımını TEKRARLAMAMALI, kullanıcının acı noktasına veya arzusuna değmeli.
- Zayıf etkileşim sinyali = zayıf hook/açı → farklı açılar dene (fayda, merak, sosyal kanıt, teklif).
- Zayıf dönüşüm sinyali = teklif-kitle uyumsuzluğu veya zayıf açılış sayfası uyumu → teklifi netleştir, vaadi açılış sayfasıyla tutarlı yap.
- Kalite algısı: clickbait ve abartılı/yanıltıcı iddialardan kaçın; net, dürüst, somut fayda ver.
- Kreatif yorgunluğu: aynı kitleye tekrar eden metin etkisini yitirir → birbirinden belirgin farklı varyasyonlar üret (açı/ton/teklif çeşitlendir), tek kalıbın kopyaları değil.
- Net ve tek bir eylem çağrısı (CTA) ver; mesaj-CTA-açılış sayfası aynı vaatte hizalı olsun.`

/** Tam analiz bilgisini cached system block olarak döndürür (Anthropic system array için). */
export function metaAnalysisBlock(): { type: 'text'; text: string; cache_control: { type: 'ephemeral' } } {
  return { type: 'text', text: META_ANALYSIS_KNOWLEDGE, cache_control: { type: 'ephemeral' } }
}
