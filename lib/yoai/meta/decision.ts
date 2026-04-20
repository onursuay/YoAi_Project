/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Meta Decision Layer (v1)

   Teşhis (RootCauseId) → Aksiyon (DecisionAction) eşleştirmesi.
   Aksiyon türleri:
     monitor         — izle, şimdilik dokunma
     tweak           — mevcut kampanyada küçük düzeltme (kreatif ekle, bütçe ayarla)
     revise          — adset/kreatif revize et (duplicate yeni varyantla)
     recreate        — kampanya yapısını yeniden kur (yeni kampanya öner)
     change_objective — objective değiştirmeyi öner

   Decision'lar executable olmak zorunda değil; kullanıcıya
   önerilen sonraki adımı açıklarlar. execute katmanı
   (actionExecutor) sadece destekledikleri action'ları yürütür;
   diğerleri "draft" olarak sunulur.
   ────────────────────────────────────────────────────────── */

import type { DiagnosisResult, RootCauseId } from './diagnosis'

export type DecisionActionType =
  | 'monitor'
  | 'tweak'
  | 'revise'
  | 'recreate'
  | 'change_objective'

export interface DecisionAction {
  actionType: DecisionActionType
  /** Hangi varlığı hedefliyor */
  target: 'campaign' | 'adset' | 'ad' | 'creative' | 'objective'
  /** Kullanıcıya gösterilecek kısa başlık */
  title: string
  /** Ne yapılacağının detayı */
  rationale: string
  /** Önerilen somut değişiklik (executable alanlar) */
  change: Record<string, unknown>
  /** Kullanıcı onayı gerekli mi (v1'de hepsi true — yayın kararı kullanıcıda) */
  requiresApproval: boolean
  /** Aciliyet */
  priority: 'high' | 'medium' | 'low'
}

export interface Decision {
  campaignId: string
  campaignName: string
  /** Diagnosis'ten gelen baskın rootCause */
  rootCauseId: RootCauseId
  /** Önerilen aksiyon(lar) — genelde 1, bazen 2 */
  actions: DecisionAction[]
  /** Teşhisten aksiyona geçiş gerekçesi */
  reasoning: string
}

/* ── Mapping table: rootCause → action(s) ── */

export function decideForDiagnosis(diag: DiagnosisResult): Decision {
  const primary = diag.primary
  switch (primary.id) {
    case 'healthy':
      return {
        campaignId: diag.campaignId,
        campaignName: diag.campaignName,
        rootCauseId: primary.id,
        reasoning: 'Teşhis: sağlıklı. Müdahale önerilmiyor; trendi izlemeye devam.',
        actions: [
          {
            actionType: 'monitor',
            target: 'campaign',
            title: 'İzlemeye devam et',
            rationale: 'Belirgin bir sorun yok; mevcut yapı trend koruyorsa dokunma.',
            change: {},
            requiresApproval: false,
            priority: 'low',
          },
        ],
      }

    case 'insufficient_data':
      return {
        campaignId: diag.campaignId,
        campaignName: diag.campaignName,
        rootCauseId: primary.id,
        reasoning:
          'Veri yetersiz — Meta öğrenme fazı tamamlanmadan aksiyon almak sinyal bozar.',
        actions: [
          {
            actionType: 'monitor',
            target: 'campaign',
            title: 'Öğrenme fazı bitene kadar bekle',
            rationale:
              'Kampanya yeterli sinyal toplamadan (50+ dönüşüm / 7 gün) değişiklik önerme.',
            change: {},
            requiresApproval: false,
            priority: 'low',
          },
        ],
      }

    case 'budget_starvation':
      return {
        campaignId: diag.campaignId,
        campaignName: diag.campaignName,
        rootCauseId: primary.id,
        reasoning: 'Bütçe Meta\'nın öğrenme fazına girmesine izin vermiyor.',
        actions: [
          {
            actionType: 'tweak',
            target: 'campaign',
            title: 'Günlük bütçeyi artır',
            rationale:
              'Meta minimum öğrenme bütçesinin altında; CPA × 50 civarı günlük bütçe öğrenmeyi hızlandırır.',
            change: { suggestedDailyBudgetMultiplier: 2 },
            requiresApproval: true,
            priority: 'high',
          },
        ],
      }

    case 'pixel_misfire':
      return {
        campaignId: diag.campaignId,
        campaignName: diag.campaignName,
        rootCauseId: primary.id,
        reasoning:
          'Dönüşüm hedefli kampanyada yüksek harcama + sıfır dönüşüm. Pixel/event tracking bozuk olma olasılığı yüksek.',
        actions: [
          {
            actionType: 'tweak',
            target: 'campaign',
            title: 'Kampanyayı duraklat + Pixel/Event doğrulamasına başla',
            rationale:
              'Harcama devam ederken tracking bozuksa para yanar. Önce duraklat, Events Manager\'da event fire durumunu kontrol et.',
            change: { status: 'PAUSED', requirePixelAudit: true },
            requiresApproval: true,
            priority: 'high',
          },
        ],
      }

    case 'creative_fatigue':
      return {
        campaignId: diag.campaignId,
        campaignName: diag.campaignName,
        rootCauseId: primary.id,
        reasoning:
          'Aynı kitleye çok sık gösterim; yeni kreatif varyantları frequency baskısını azaltır.',
        actions: [
          {
            actionType: 'revise',
            target: 'creative',
            title: 'Yeni kreatif varyantları ekle',
            rationale:
              'Mevcut ad\'leri duraklatma, yeni kreatif ekle — Meta delivery dengelensin.',
            change: { addNewCreatives: true, rotateOld: true },
            requiresApproval: true,
            priority: 'high',
          },
        ],
      }

    case 'hook_problem':
      return {
        campaignId: diag.campaignId,
        campaignName: diag.campaignName,
        rootCauseId: primary.id,
        reasoning:
          'Gösterim ucuz ama tıklama düşük — birincil metin/görsel hook zayıf. Kreatif odaklı revize gerekli.',
        actions: [
          {
            actionType: 'revise',
            target: 'ad',
            title: 'Hook\'u güçlendiren yeni kreatif üret',
            rationale:
              'İlk saniye / ilk satır tıklama kararını belirler. Yeni başlık + görsel varyantı test et.',
            change: { regenerateCreative: true, focusOn: 'hook' },
            requiresApproval: true,
            priority: 'medium',
          },
        ],
      }

    case 'audience_mismatch':
      return {
        campaignId: diag.campaignId,
        campaignName: diag.campaignName,
        rootCauseId: primary.id,
        reasoning:
          'CPM yüksek + CTR düşük → hedefleme pahalı ama ilgisiz. Adset seviyesinde kitle revize edilmeli.',
        actions: [
          {
            actionType: 'revise',
            target: 'adset',
            title: 'Hedeflemeyi daralt / ilgi alanını değiştir',
            rationale:
              'Advantage+ audience açık olsa bile cold start sinyali yanlış. Tanımlı ilgi/lookalike ekle.',
            change: { refineTargeting: true },
            requiresApproval: true,
            priority: 'medium',
          },
        ],
      }

    case 'landing_page_problem':
      return {
        campaignId: diag.campaignId,
        campaignName: diag.campaignName,
        rootCauseId: primary.id,
        reasoning:
          'Tıklama iyi ama dönüşüm pahalı — trafik kaliteli değilse CTR düşerdi, o halde landing sayfası veya funnel kırık.',
        actions: [
          {
            actionType: 'monitor',
            target: 'campaign',
            title: 'Landing page denetle — form/hız/ilgi uyumu',
            rationale:
              'YoAlgoritma reklam tarafını değiştirmeden önce landing page\'in ads ile tutarlılığını kontrol etmeli.',
            change: { landingPageAuditRequired: true },
            requiresApproval: false,
            priority: 'medium',
          },
        ],
      }

    case 'event_quality_problem':
      return {
        campaignId: diag.campaignId,
        campaignName: diag.campaignName,
        rootCauseId: primary.id,
        reasoning:
          'Dönüşüm event\'i yetersiz tetikleniyor; Meta yeterli sinyal alamıyor.',
        actions: [
          {
            actionType: 'tweak',
            target: 'adset',
            title: 'Event kalitesini yükselt / farklı event\'e geç',
            rationale:
              'Event Match Quality düşükse Meta optimizasyonu zayıflar. Server-side event veya daha üst funnel event dene.',
            change: { improveEventQuality: true },
            requiresApproval: true,
            priority: 'high',
          },
        ],
      }

    case 'wrong_optimization_goal':
      return {
        campaignId: diag.campaignId,
        campaignName: diag.campaignName,
        rootCauseId: primary.id,
        reasoning:
          'Kampanya objective\'i ile gerçekleşen değer arasında uyumsuzluk var — objective değiştirmek daha iyi optimizasyon sağlayabilir.',
        actions: [
          {
            actionType: 'change_objective',
            target: 'objective',
            title: 'Objective\'i değiştirerek yeni kampanya öner',
            rationale:
              'Mevcut kampanyayı durdur, aynı hedef kitleye SALES veya LEADS objective ile yeni bir taslak üret.',
            change: { suggestedObjective: 'OUTCOME_SALES' },
            requiresApproval: true,
            priority: 'medium',
          },
        ],
      }
  }
}

export function decideForDiagnoses(diags: DiagnosisResult[]): Decision[] {
  return diags.map(decideForDiagnosis)
}
