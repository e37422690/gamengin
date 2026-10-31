import {
  BlockCategory,
  BlockDefinition,
  BlockInstance,
  DiagnosticIssue,
  GameScene,
} from '../types/engine';

export const BLOCK_CATEGORY_META: Record<
  BlockCategory,
  { label: string; color: string; badgeBg: string; description: string }
> = {
  events: {
    label: 'Olaylar',
    color: '#D97706',
    badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    description: 'Oyun döngüsü, klavye, fare, zamanlayıcı ve çarpışma tetikleyicileri',
  },
  movement: {
    label: 'Hareket',
    color: '#2563EB',
    badgeBg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    description: 'Konum, hız, zıplama, hedefi takip etme ve yön değiştirme',
  },
  control: {
    label: 'Kontrol',
    color: '#7C3AED',
    badgeBg: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    description: 'Koşullar (Eğer/Değilse), döngüler, bekleme ve durdurma',
  },
  variables: {
    label: 'Değişkenler & Mantık',
    color: '#DC2626',
    badgeBg: 'bg-red-500/15 text-red-400 border-red-500/30',
    description: 'Değişken atama, matematiksel işlemler ve rastgele sayı üretimi',
  },
  sensing: {
    label: 'Algılama',
    color: '#0891B2',
    badgeBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    description: 'Çarpışma, mesafe ölçümü, tuş kontrolü ve sahne varlık sorguları',
  },
  audio: {
    label: 'Ses',
    color: '#DB2777',
    badgeBg: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    description: 'Ses efekti çalma, arka plan müziği ve ses seviyesi kontrolü',
  },
  animation: {
    label: 'Animasyon',
    color: '#0D9488',
    badgeBg: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    description: 'Sprite animasyonu başlatma, durdurma ve kare hızı yönetimi',
  },
  scene: {
    label: 'Sahne & Durum',
    color: '#4F46E5',
    badgeBg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    description: 'Sahne geçişi, duraklatma, yeniden başlatma ve oyun durumu',
  },
  ui: {
    label: 'Arayüz (UI)',
    color: '#16A34A',
    badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    description: 'Puan güncelleme, mesaj gösterme, diyalog başlatma ve butonlar',
  },
  advanced: {
    label: 'Gelişmiş Sistemler',
    color: '#EA580C',
    badgeBg: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    description: 'Envanter, görev yönetimi, düşman devriye ve yapay zekâ takibi',
  },
};

export const BLOCK_CATALOG: BlockDefinition[] = [
  // 1. OLAYLAR (Events)
  {
    type: 'event_game_start',
    category: 'events',
    label: 'Oyun Başladığında',
    description: 'Oyun çalışma zamanı başlatıldığında bir kez tetiklenir.',
    isHat: true,
    isContainer: true,
    params: [],
  },
  {
    type: 'event_scene_enter',
    category: 'events',
    label: 'Sahne Açıldığında',
    description: 'Bu sahneye geçiş yapıldığında çalışır.',
    isHat: true,
    isContainer: true,
    params: [],
  },
  {
    type: 'event_key_pressed',
    category: 'events',
    label: 'Tuşa Basıldığında',
    description: 'Belirtilen klavye tuşuna basıldığı ilk karede tetiklenir.',
    isHat: true,
    isContainer: true,
    params: [
      {
        name: 'key',
        label: 'Tuş',
        type: 'key',
        defaultValue: 'Space',
        options: [
          { label: 'Boşluk (Space)', value: 'Space' },
          { label: 'Sağ Ok (ArrowRight)', value: 'ArrowRight' },
          { label: 'Sol Ok (ArrowLeft)', value: 'ArrowLeft' },
          { label: 'Yukarı Ok (ArrowUp)', value: 'ArrowUp' },
          { label: 'Aşağı Ok (ArrowDown)', value: 'ArrowDown' },
          { label: 'W', value: 'KeyW' },
          { label: 'A', value: 'KeyA' },
          { label: 'S', value: 'KeyS' },
          { label: 'D', value: 'KeyD' },
          { label: 'E (Lazer / Etkileşim)', value: 'KeyE' },
          { label: 'F (Ateş Et / Saldırı)', value: 'KeyF' },
          { label: 'Shift (Dash / Hızlı Atılma)', value: 'ShiftLeft' },
        ],
      },
    ],
  },
  {
    type: 'event_key_held',
    category: 'events',
    label: 'Tuş Basılı Tutulduğunda',
    description: 'Belirtilen tuş basılı tutulduğu sürece her karede çalışır.',
    isHat: true,
    isContainer: true,
    params: [
      {
        name: 'key',
        label: 'Tuş',
        type: 'key',
        defaultValue: 'ArrowRight',
        options: [
          { label: 'Sağ Ok (ArrowRight)', value: 'ArrowRight' },
          { label: 'Sol Ok (ArrowLeft)', value: 'ArrowLeft' },
          { label: 'Yukarı Ok (ArrowUp)', value: 'ArrowUp' },
          { label: 'Aşağı Ok (ArrowDown)', value: 'ArrowDown' },
          { label: 'D', value: 'KeyD' },
          { label: 'A', value: 'KeyA' },
          { label: 'W', value: 'KeyW' },
          { label: 'S', value: 'KeyS' },
        ],
      },
    ],
  },
  {
    type: 'event_object_clicked',
    category: 'events',
    label: 'Fareyle Tıklandığında',
    description: 'Hedef nesnenin üzerine fare veya dokunmatik ile tıklandığında tetiklenir.',
    isHat: true,
    isContainer: true,
    params: [],
  },
  {
    type: 'event_timer_interval',
    category: 'events',
    label: 'Belirli Bir Zaman Geçtiğinde',
    description: 'Belirtilen saniye aralığında periyodik olarak tetiklenir.',
    isHat: true,
    isContainer: true,
    params: [
      { name: 'seconds', label: 'Süre (sn)', type: 'number', defaultValue: 1, min: 0.1, max: 60 },
    ],
  },
  {
    type: 'event_on_collision',
    category: 'events',
    label: 'Çarpışma Gerçekleştiğinde',
    description: 'Hedef nesne seçilen roldeki başka bir nesneyle çarpıştığında tetiklenir.',
    isHat: true,
    isContainer: true,
    params: [
      {
        name: 'otherRole',
        label: 'Çarpışılan Tür',
        type: 'objectRole',
        defaultValue: 'collectible',
        options: [
          { label: 'Toplanabilir (Altın/Anahtar)', value: 'collectible' },
          { label: 'Can İksiri / Güçlendirici (PowerUp)', value: 'powerup' },
          { label: 'Kayıt Noktası (Checkpoint)', value: 'checkpoint' },
          { label: 'Görünmez Sınır Duvarı (Invisible Wall)', value: 'invisible_wall' },
          { label: 'Düşman (Slime/Tehlike)', value: 'enemy' },
          { label: 'Hedef Bayrak (Goal)', value: 'goal' },
          { label: 'NPC (Rehber)', value: 'npc' },
          { label: 'Geçit Bölgesi (Trigger)', value: 'trigger' },
          { label: 'Sandık (Crate)', value: 'crate' },
          { label: 'Platform / Duvar', value: 'platform' },
          { label: 'Hareketli Platform', value: 'moving_platform' },
        ],
      },
    ],
  },
  {
    type: 'event_boundary_hit',
    category: 'events',
    label: 'Görünmez Harita Sınırına Değdiğinde',
    description: 'Karakter haritanın görünmez sınırlarına (Alt Uçurum, Sol, Sağ, Üst) veya görünmez duvara değdiğinde tetiklenir.',
    isHat: true,
    isContainer: true,
    params: [
      {
        name: 'edge',
        label: 'Sınır Kenarı',
        type: 'direction',
        defaultValue: 'any',
        options: [
          { label: 'Tüm Sınırlar (Herhangi Biri)', value: 'any' },
          { label: 'Alt Sınır (Uçurum / Boşluk)', value: 'bottom' },
          { label: 'Sol Harita Sınırı', value: 'left' },
          { label: 'Sağ Harita Sınırı', value: 'right' },
          { label: 'Üst Tavan Sınırı', value: 'top' },
        ],
      },
    ],
  },
  {
    type: 'event_anim_trigger',
    category: 'events',
    label: 'Animasyon Tetikleyicisi Çalıştığında',
    description: 'Karakter seçilen animasyon durumuna geçtiğinde veya animasyon klibini oynattığında tetiklenir.',
    isHat: true,
    isContainer: true,
    params: [
      {
        name: 'clip',
        label: 'Tetiklenen Animasyon',
        type: 'animation',
        defaultValue: 'attack',
        options: [
          { label: 'Saldırı / Lazer (Attack)', value: 'attack' },
          { label: 'Zıplama (Jump)', value: 'jump' },
          { label: 'Koşma (Run)', value: 'move' },
          { label: 'Atılma (Dash)', value: 'dash' },
          { label: 'Düşme (Fall)', value: 'fall' },
          { label: 'Durma (Idle)', value: 'idle' },
        ],
      },
    ],
  },
  {
    type: 'event_state_changed',
    category: 'events',
    label: 'Karakter Durumu Değiştiğinde (Zemin/Havada/Yön)',
    description: 'Karakter yere indiğinde, havada ikinci kez zıpladığında veya sağa/sola yön döndüğünde tetiklenir.',
    isHat: true,
    isContainer: true,
    params: [
      {
        name: 'state',
        label: 'Durum Geçişi',
        type: 'string',
        defaultValue: 'double_jumped',
        options: [
          { label: 'Havada Çoklu Zıplama Yaptığında (Double/Multi Jump)', value: 'double_jumped' },
          { label: 'Zemine Tekrar İndiğinde (On Landed)', value: 'landed' },
          { label: 'Sola Yön Döndüğünde (Turned Left ◀)', value: 'turned_left' },
          { label: 'Sağa Yön Döndüğünde (Turned Right ▶)', value: 'turned_right' },
        ],
      },
    ],
  },
  {
    type: 'event_health_zero',
    category: 'events',
    label: 'Can Sıfırlandığında',
    description: 'Nesnenin veya oyuncunun can değeri 0 ve altına düştüğünde tetiklenir.',
    isHat: true,
    isContainer: true,
    params: [],
  },

  // 2. HAREKET (Movement)
  {
    type: 'move_horizontal',
    category: 'movement',
    label: 'Yatay Hareket Et (Sağ/Sol)',
    description: 'Nesneye yatay hız uygular (+ sağa, - sola) ve otomatik yön dönüşünü tetikler.',
    params: [
      { name: 'speed', label: 'Hız (px/sn)', type: 'number', defaultValue: 220, min: -1000, max: 1000 },
    ],
  },
  {
    type: 'move_set_facing',
    category: 'movement',
    label: 'Yön Dönüşünü Ayarla (Sağ / Sol / FlipH)',
    description: 'Karakterin sağa/sola giderken nasıl döneceğini veya hangi yöne bakacağını ayarlar.',
    params: [
      {
        name: 'mode',
        label: 'Yön & Dönüş Modu',
        type: 'direction',
        defaultValue: 'auto_flip',
        options: [
          { label: 'Otomatik Sağ/Sol Aynala (FlipH Aktif)', value: 'auto_flip' },
          { label: 'Sağa Döndür (SAĞ ▶)', value: 'face_right' },
          { label: 'Sola Döndür (◀ SOL)', value: 'face_left' },
          { label: 'Baktığı Yönü Ters Çevir (Flip)', value: 'flip_toggle' },
          { label: 'Yön Dönüşünü Kilitle (Sabit)', value: 'lock_facing' },
        ],
      },
    ],
  },
  {
    type: 'move_vertical',
    category: 'movement',
    label: 'Dikey Hareket Et (Yukarı/Aşağı)',
    description: 'Nesneye dikey hız veya konum değişimi uygular (- yukarı, + aşağı).',
    params: [
      { name: 'speed', label: 'Hız (px/sn)', type: 'number', defaultValue: -200, min: -1000, max: 1000 },
    ],
  },
  {
    type: 'move_jump',
    category: 'movement',
    label: 'Zıpla (Tek / Çoklu / Sınırsız Mod Destekli)',
    description: 'Karakterin seçili zıplama moduna (Yalnızca Zemin, Çoklu Zıplama veya Sınırsız) göre zıplama kuvveti uygular.',
    params: [
      { name: 'force', label: 'Zıplama Gücü', type: 'number', defaultValue: 460, min: 50, max: 1200 },
    ],
  },
  {
    type: 'physics_set_jump_mode',
    category: 'movement',
    label: 'Zıplama Modunu & Hakkını Değiştir',
    description: 'Tek zıplama (yere inmeden zıplayamama), çoklu zıplama (2x/3x) veya sınırsız zıplama modunu ayarlar.',
    params: [
      {
        name: 'mode',
        label: 'Zıplama Modu',
        type: 'string',
        defaultValue: 'multi_jump',
        options: [
          { label: 'Tek Zıplama (Yere İnmeden Tekrar Zıplayamaz)', value: 'grounded_only' },
          { label: 'Çoklu Zıplama (Havada 2x / 3x / N Zıplama)', value: 'multi_jump' },
          { label: 'Sınırsız Zıplama (Havada Sınırsız Zıplama)', value: 'infinite' },
        ],
      },
      {
        name: 'maxJumps',
        label: 'Maks Zıplama Sayısı',
        type: 'number',
        defaultValue: 2,
        min: 1,
        max: 10,
      },
    ],
  },
  {
    type: 'move_dash',
    category: 'movement',
    label: 'Hızlı Atılma (Dash Yap)',
    description: 'Karakteri baktığı yöne doğru ani yüksek hızla ileri fırlatır.',
    params: [
      { name: 'power', label: 'Atılma Hızı', type: 'number', defaultValue: 540, min: 200, max: 1400 },
    ],
  },
  {
    type: 'act_shoot_projectile',
    category: 'movement',
    label: 'Lazer / Enerji Mermisi Ateşle',
    description: 'Karakterin baktığı yöne doğru düşmanlara hasar veren lazer mermisi fırlatır.',
    params: [
      { name: 'speed', label: 'Mermi Hızı', type: 'number', defaultValue: 520, min: 200, max: 1200 },
      { name: 'damage', label: 'Hasar (HP)', type: 'number', defaultValue: 30, min: 5, max: 200 },
    ],
  },
  {
    type: 'physics_flip_gravity',
    category: 'movement',
    label: 'Yerçekimi Yönünü Ters Çevir',
    description: 'Sahnenin veya karakterin yerçekimi yönünü tersine çevirir (Tavan Yürüyüşü).',
    params: [],
  },
  {
    type: 'world_set_boundary_action',
    category: 'scene',
    label: 'Görünmez Harita Sınır Davranışını Ayarla',
    description: 'Haritanın görünmez sınırlarına değildiğinde ne olacağını (Durdur, Sekme, Karşıdan Çık, Başlangıca Işınla, Game Over) belirler.',
    params: [
      {
        name: 'edge',
        label: 'Sınır Kenarı',
        type: 'string',
        defaultValue: 'bottom',
        options: [
          { label: 'Alt Sınır (Uçurum)', value: 'bottom' },
          { label: 'Sol Sınır', value: 'left' },
          { label: 'Sağ Sınır', value: 'right' },
          { label: 'Üst Sınır', value: 'top' },
          { label: 'Tüm Harita Sınırları', value: 'all' },
        ],
      },
      {
        name: 'action',
        label: 'Değince Ne Olsun?',
        type: 'string',
        defaultValue: 'respawn_damage',
        options: [
          { label: 'Katı Duvar (Geçişi Engelle / Durdur)', value: 'solid' },
          { label: 'Elastik Sekme (İçeri Geri Fırlat)', value: 'bounce' },
          { label: 'Ekran Sarma (Karşı Kıyıdan Çık / Wrap)', value: 'wrap' },
          { label: 'Kayıt Noktasına Işınla + Can Azalt', value: 'respawn_damage' },
          { label: 'Anında Oyunu Bitir (Game Over)', value: 'gameover' },
          { label: 'Bölümü Kazan (Zafer)', value: 'victory' },
        ],
      },
    ],
  },
  {
    type: 'world_set_wall_filter',
    category: 'scene',
    label: 'Görünmez Duvarın Etkileyeceği Karakterleri Ayarla',
    description: 'Görünmez duvarların veya harita sınırlarının hangi karakterleri (Tüm Karakterler, Sadece Kahraman, Sadece Düşmanlar, Sadece NPC veya Özel Karakter) etkileyeceğini değiştirir.',
    params: [
      {
        name: 'filter',
        label: 'Etkilenecek Karakter Grubu',
        type: 'string',
        defaultValue: 'all',
        options: [
          { label: 'Tüm Hareketli Karakterler (Kahraman + Düşman + NPC)', value: 'all' },
          { label: 'Sadece Kahraman (Oyuncu)', value: 'player_only' },
          { label: 'Sadece Düşmanlar (Enemy)', value: 'enemies_only' },
          { label: 'Sadece NPC Karakterler', value: 'npcs_only' },
          { label: 'Özel Karakter Adı / ID Filtresi', value: 'custom' },
        ],
      },
      {
        name: 'customTarget',
        label: 'Özel Karakter Adı (Opsiyonel)',
        type: 'string',
        defaultValue: 'Kahraman',
      },
    ],
  },
  {
    type: 'camera_shake',
    category: 'scene',
    label: 'Kamera Sarsıntısı (Screen Shake)',
    description: 'Patlama, vuruş veya boss saldırısında ekranı sarsar.',
    params: [
      { name: 'intensity', label: 'Şiddet (px)', type: 'number', defaultValue: 8, min: 2, max: 30 },
    ],
  },
  {
    type: 'move_to_position',
    category: 'movement',
    label: 'Belirli Bir Konuma Git',
    description: 'Nesneyi doğrudan (X, Y) oyun koordinatlarına taşır.',
    params: [
      { name: 'x', label: 'X Koordinatı', type: 'number', defaultValue: 120 },
      { name: 'y', label: 'Y Koordinatı', type: 'number', defaultValue: 300 },
    ],
  },
  {
    type: 'move_rotate',
    category: 'movement',
    label: 'Döndür',
    description: 'Nesneyi belirtilen derece kadar döndürür.',
    params: [
      { name: 'degrees', label: 'Açı (°)', type: 'number', defaultValue: 15, min: -360, max: 360 },
    ],
  },
  {
    type: 'move_stop',
    category: 'movement',
    label: 'Hareketi Durdur',
    description: 'Nesnenin yatay ve dikey hızını sıfırlar.',
    params: [],
  },

  // 3. KONTROL (Control)
  {
    type: 'control_if_score_gte',
    category: 'control',
    label: 'Eğer Puan >= Eşik İse',
    description: 'Puan belirtilen değere ulaştığında alt blokları çalıştırır.',
    isContainer: true,
    params: [
      { name: 'threshold', label: 'Hedef Puan', type: 'number', defaultValue: 50 },
    ],
  },
  {
    type: 'control_repeat_count',
    category: 'control',
    label: 'İşlemi Belirli Sayıda Tekrarla',
    description: 'Altındaki işlemleri güvenli sınırlar içinde N kez tekrarlar (maks 50).',
    isContainer: true,
    params: [
      { name: 'count', label: 'Tekrar Sayısı', type: 'number', defaultValue: 3, min: 1, max: 50 },
    ],
  },
  {
    type: 'control_wait',
    category: 'control',
    label: 'İşlemi Beklet',
    description: 'Sonraki komuta geçmeden önce belirtilen süre kadar bekler.',
    params: [
      { name: 'seconds', label: 'Saniye', type: 'number', defaultValue: 0.5, min: 0.05, max: 10 },
    ],
  },

  // 4. DEĞİŞKENLER & MANTIK (Variables)
  {
    type: 'var_set',
    category: 'variables',
    label: 'Değişkeni Ata',
    description: 'Bir oyun değişkenine yeni değer atar.',
    params: [
      { name: 'varName', label: 'Değişken Adı', type: 'string', defaultValue: 'anahtarSayisi' },
      { name: 'value', label: 'Değer', type: 'number', defaultValue: 1 },
    ],
  },
  {
    type: 'var_change',
    category: 'variables',
    label: 'Değişkeni Değiştir (+/-)',
    description: 'Sayısal bir değişkeni belirtilen miktarda artırır veya azaltır.',
    params: [
      { name: 'varName', label: 'Değişken Adı', type: 'string', defaultValue: 'enerji' },
      { name: 'delta', label: 'Fark', type: 'number', defaultValue: 10 },
    ],
  },
  {
    type: 'var_random',
    category: 'variables',
    label: 'Rastgele Konum/Değer Üret',
    description: 'Belirtilen aralıkta rastgele sayı üretip değişkene yazar.',
    params: [
      { name: 'varName', label: 'Değişken Adı', type: 'string', defaultValue: 'rastgeleSayi' },
      { name: 'min', label: 'Min', type: 'number', defaultValue: 1 },
      { name: 'max', label: 'Maks', type: 'number', defaultValue: 100 },
    ],
  },

  // 5. ALGILAMA (Sensing)
  {
    type: 'sense_destroy_other',
    category: 'sensing',
    label: 'Çarpışılan Nesneyi Topla / Yok Et',
    description: 'Çarpışma olayındaki diğer nesneyi sahneden kaldırır.',
    params: [],
  },
  {
    type: 'sense_damage_target',
    category: 'sensing',
    label: 'Can Değerini Değiştir',
    description: 'Oyuncunun veya nesnenin canını artırır veya azaltır.',
    params: [
      { name: 'amount', label: 'Can Değişimi', type: 'number', defaultValue: -20, min: -500, max: 500 },
    ],
  },

  // 6. SES (Audio)
  {
    type: 'audio_play_sfx',
    category: 'audio',
    label: 'Ses Efekti Çal',
    description: 'Seçilen ses efektini Web Audio üzerinden gecikmesiz çalar.',
    params: [
      {
        name: 'sound',
        label: 'Ses Efekti',
        type: 'sound',
        defaultValue: 'coin',
        options: [
          { label: 'Altın / Ödül (Coin)', value: 'coin' },
          { label: 'Zıplama (Jump)', value: 'jump' },
          { label: 'Hasar / Çarpma (Hit)', value: 'hit' },
          { label: 'Zafer / Seviye Geçiş (Victory)', value: 'victory' },
          { label: 'Lazer / Etkileşim (Laser)', value: 'laser' },
          { label: 'Tıklama (Click)', value: 'click' },
          { label: 'Görev Bildirimi (Quest)', value: 'quest' },
        ],
      },
    ],
  },
  {
    type: 'audio_set_volume',
    category: 'audio',
    label: 'Ses Seviyesini Değiştir',
    description: 'Ana oyun ses seviyesini %0 ile %100 arasında ayarlar.',
    params: [
      { name: 'volume', label: 'Seviye (%)', type: 'number', defaultValue: 80, min: 0, max: 100 },
    ],
  },

  // 7. ANİMASYON (Animation)
  {
    type: 'anim_play',
    category: 'animation',
    label: 'Karakter Animasyonu Başlat',
    description: 'Nesnenin seçilen animasyon klibini oynatır ve animasyon tetikleyicisini çalıştırır.',
    params: [
      {
        name: 'clip',
        label: 'Animasyon Klibi',
        type: 'animation',
        defaultValue: 'move',
        options: [
          { label: 'Koşma (Run / Move)', value: 'move' },
          { label: 'Durma (Idle)', value: 'idle' },
          { label: 'Zıplama (Jump)', value: 'jump' },
          { label: 'Düşme (Fall)', value: 'fall' },
          { label: 'Saldırı / Lazer (Attack)', value: 'attack' },
          { label: 'Hızlı Atılma (Dash)', value: 'dash' },
        ],
      },
    ],
  },
  {
    type: 'anim_set_character_skin',
    category: 'animation',
    label: 'Karakter Görünümünü / Sınıfını Değiştir',
    description: 'Karakterin görsel sınıfını (Kaşif, Şövalye, Büyücü, Ninja, Siber Robot) anında değiştirir.',
    params: [
      {
        name: 'skin',
        label: 'Karakter Sınıfı',
        type: 'string',
        defaultValue: 'knight',
        options: [
          { label: 'Kaşif Kahraman (Hero)', value: 'hero' },
          { label: 'Zırhlı Şövalye (Knight)', value: 'knight' },
          { label: 'Kristal Büyücü (Mage)', value: 'mage' },
          { label: 'Gölge Ninja (Ninja)', value: 'ninja' },
          { label: 'Siber Robot (Robot)', value: 'robot' },
        ],
      },
    ],
  },

  // 8. SAHNE VE OYUN DURUMU (Scene)
  {
    type: 'scene_change',
    category: 'scene',
    label: 'Sahneyi Değiştir',
    description: 'Belirtilen sahneye geçiş yapar.',
    params: [
      { name: 'sceneId', label: 'Hedef Sahne ID', type: 'sceneId', defaultValue: 'next' },
    ],
  },
  {
    type: 'scene_restart',
    category: 'scene',
    label: 'Sahneyi Yeniden Başlat',
    description: 'Mevcut sahneyi başlangıç durumuna sıfırlar.',
    params: [],
  },
  {
    type: 'scene_victory',
    category: 'scene',
    label: 'Oyunu Kazan (Zafer Ekranı)',
    description: 'Oyunu zafer durumuyla tamamlar ve istatistikleri gösterir.',
    params: [
      { name: 'reason', label: 'Zafer Mesajı', type: 'string', defaultValue: 'Bölüm Tamamlandı!' },
    ],
  },
  {
    type: 'scene_gameover',
    category: 'scene',
    label: 'Oyunu Bitir (Game Over)',
    description: 'Oyunu yenilgi ekranına geçirir.',
    params: [
      { name: 'reason', label: 'Mesaj', type: 'string', defaultValue: 'Canınız Tükendi!' },
    ],
  },

  // 9. ARAYÜZ (UI)
  {
    type: 'ui_add_score',
    category: 'ui',
    label: 'Puanı Güncelle (+/-)',
    description: 'Oyuncu puanına belirtilen değeri ekler veya çıkarır.',
    params: [
      { name: 'points', label: 'Puan Değişimi', type: 'number', defaultValue: 10 },
    ],
  },
  {
    type: 'ui_show_message',
    category: 'ui',
    label: 'Ekranda Mesaj Göster',
    description: 'Oyun içi bildirim çubuğunda bilgi mesajı gösterir.',
    params: [
      { name: 'text', label: 'Mesaj Metni', type: 'string', defaultValue: 'Gizli geçit açıldı!' },
    ],
  },
  {
    type: 'ui_start_dialogue',
    category: 'ui',
    label: 'Diyalog Başlat',
    description: 'Belirtilen NPC diyalog ağacını ekranda açar.',
    params: [
      { name: 'dialogueId', label: 'Diyalog ID', type: 'string', defaultValue: 'dlg_intro' },
    ],
  },

  // 10. GELİŞMİŞ OYUN SİSTEMLERİ (Advanced)
  {
    type: 'adv_inventory_add',
    category: 'advanced',
    label: 'Envantere Eşya Ekle',
    description: 'Oyuncunun çantasına belirtilen eşyayı ekler.',
    params: [
      { name: 'itemName', label: 'Eşya Adı', type: 'string', defaultValue: 'Tapınak Anahtarı' },
    ],
  },
  {
    type: 'adv_quest_start',
    category: 'advanced',
    label: 'Görev Başlat',
    description: 'Belirtilen görevi aktif görevler listesine ekler.',
    params: [
      { name: 'questId', label: 'Görev ID', type: 'string', defaultValue: 'q_main' },
    ],
  },
  {
    type: 'adv_quest_complete',
    category: 'advanced',
    label: 'Görevi Tamamla',
    description: 'Belirtilen görevi tamamlandı olarak işaretler ve ödül puanını verir.',
    params: [
      { name: 'questId', label: 'Görev ID', type: 'string', defaultValue: 'q_main' },
    ],
  },
  {
    type: 'adv_enemy_patrol',
    category: 'advanced',
    label: 'Düşmanı Devriye Gezdir',
    description: 'Düşman nesnesini başlangıç noktası etrafında yatay devriye gezdirir.',
    params: [
      { name: 'range', label: 'Mesafe (px)', type: 'number', defaultValue: 120, min: 20, max: 800 },
      { name: 'speed', label: 'Hız (px/sn)', type: 'number', defaultValue: 95, min: 10, max: 400 },
    ],
  },
  {
    type: 'adv_follow_player',
    category: 'advanced',
    label: 'Oyuncuyu Takip Et',
    description: 'Nesnenin sahnedeki oyuncu karakterine doğru hareket etmesini sağlar.',
    params: [
      { name: 'speed', label: 'Takip Hızı', type: 'number', defaultValue: 85, min: 10, max: 400 },
    ],
  },
];

export function getBlockDefinition(type: string): BlockDefinition | undefined {
  return BLOCK_CATALOG.find((b) => b.type === type);
}

export function validateSceneBlocks(scene: GameScene): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const objectIds = new Set(scene.objects.map((o) => o.id));

  for (const block of scene.blocks) {
    const def = getBlockDefinition(block.type);
    if (!def) {
      issues.push({
        id: `diag_unknown_block_${block.id}`,
        severity: 'error',
        code: 'BLK_UNKNOWN_TYPE',
        title: 'Tanımsız Blok Türü',
        message: `"${block.type}" türünde bir blok motor kataloğunda bulunamadı.`,
        sceneId: scene.id,
        blockId: block.id,
        suggestion: 'Bu bloğu silip katalogdan geçerli bir blok ekleyin.',
      });
      continue;
    }

    if (!def.isHat) {
      issues.push({
        id: `diag_orphan_${block.id}`,
        severity: 'warning',
        code: 'BLK_ORPHAN_ACTION',
        title: 'Olay Bloğuna Bağlı Olmayan Komut',
        message: `"${def.label}" bloğu bir Olay (Hat) bloğunun altına bağlanmamış, bu yüzden oyun sırasında tetiklenmez.`,
        sceneId: scene.id,
        blockId: block.id,
        suggestion: 'Bu komutu "Oyun Başladığında" veya "Çarpışma Gerçekleştiğinde" gibi bir olay bloğunun içine taşıyın.',
      });
    }

    if (block.targetObjectId !== 'scene' && !objectIds.has(block.targetObjectId)) {
      issues.push({
        id: `diag_missing_target_${block.id}`,
        severity: 'error',
        code: 'BLK_MISSING_TARGET',
        title: 'Silinmiş Nesne Referansı',
        message: `"${def.label}" bloğu sahnede artık bulunmayan bir nesneye (${block.targetObjectId}) bağlı.`,
        sceneId: scene.id,
        blockId: block.id,
        suggestion: 'Bloğun hedef nesnesini sahnedeki mevcut bir nesneyle güncelleyin.',
      });
    }

    if (def.isHat && (!block.children || block.children.length === 0)) {
      issues.push({
        id: `diag_empty_hat_${block.id}`,
        severity: 'info',
        code: 'BLK_EMPTY_EVENT',
        title: 'Boş Olay Bloğu',
        message: `"${def.label}" olay bloğunun altında henüz hiçbir aksiyon komutu bulunmuyor.`,
        sceneId: scene.id,
        blockId: block.id,
        suggestion: 'Olay gerçekleştiğinde çalışacak en az bir hareket veya arayüz bloğu ekleyin.',
      });
    }

    const inspectChildren = (children: BlockInstance[] | undefined, depth: number) => {
      if (!children) return;
      if (depth > 8) {
        issues.push({
          id: `diag_depth_${block.id}`,
          severity: 'warning',
          code: 'BLK_DEEP_NESTING',
          title: 'Aşırı İç İçe Blok Derinliği',
          message: 'Blok zinciri 8 seviyeden daha derin, bu durum performansı olumsuz etkileyebilir.',
          sceneId: scene.id,
          blockId: block.id,
          suggestion: 'Döngü ve koşul bloklarını sadeleştirin.',
        });
        return;
      }

      for (const child of children) {
        const cDef = getBlockDefinition(child.type);
        if (!cDef) continue;

        for (const param of cDef.params) {
          const val = child.params[param.name];
          if (val === undefined || val === null || val === '') {
            issues.push({
              id: `diag_missing_param_${child.id}_${param.name}`,
              severity: 'error',
              code: 'BLK_MISSING_PARAM',
              title: 'Eksik Blok Parametresi',
              message: `"${cDef.label}" bloğundaki "${param.label}" alanı boş bırakılmış.`,
              sceneId: scene.id,
              blockId: child.id,
              suggestion: `"${param.label}" için geçerli bir ${param.type === 'number' ? 'sayı' : 'değer'} girin.`,
            });
          } else if (param.type === 'number' && typeof val !== 'number' && Number.isNaN(Number(val))) {
            issues.push({
              id: `diag_nan_param_${child.id}_${param.name}`,
              severity: 'error',
              code: 'BLK_TYPE_MISMATCH',
              title: 'Geçersiz Parametre Türü',
              message: `"${cDef.label}" bloğundaki "${param.label}" alanı sayısal olmalıdır.`,
              sceneId: scene.id,
              blockId: child.id,
              suggestion: 'Sayısal bir değer girin.',
            });
          }
        }

        if (child.type === 'control_repeat_count') {
          const cnt = Number(child.params.count ?? 1);
          if (cnt > 50) {
            issues.push({
              id: `diag_loop_cap_${child.id}`,
              severity: 'warning',
              code: 'BLK_LOOP_LIMIT',
              title: 'Yüksek Tekrar Sayısı Sınırlandırıldı',
              message: `Tekrar bloğu (${cnt}) sonsuz döngü koruması nedeniyle çalışma zamanında maksimum 50 ile sınırlandırılacaktır.`,
              sceneId: scene.id,
              blockId: child.id,
              suggestion: 'Tekrar sayısını 1 ile 50 arasında tutun.',
            });
          }
        }

        inspectChildren(child.children, depth + 1);
      }
    };

    inspectChildren(block.children, 1);
  }

  return issues;
}

export interface CompiledRule {
  id: string;
  eventType: string;
  targetObjectId: string | 'scene';
  eventParams: Record<string, string | number | boolean>;
  actions: BlockInstance[];
}

export function compileBlocksToIR(blocks: BlockInstance[]): CompiledRule[] {
  const rules: CompiledRule[] = [];
  for (const b of blocks) {
    if (b.disabled) continue;
    const def = getBlockDefinition(b.type);
    if (!def || !def.isHat) continue;
    rules.push({
      id: b.id,
      eventType: b.type,
      targetObjectId: b.targetObjectId,
      eventParams: { ...b.params },
      actions: (b.children || []).filter((c) => !c.disabled),
    });
  }
  return rules;
}

export function generateReadableCode(scene: GameScene): string {
  const lines: string[] = [
    `// Otomatik Üretilen Oyun Mantığı — Sahne: ${scene.name} (${scene.id})`,
    `// NOT: Bu kod Görsel Blok Programlama (IR) modelinden üretilmiştir.`,
    `import { RuntimeContext } from '@kareforge/runtime';`,
    ``,
    `export function registerSceneBehavior(ctx: RuntimeContext) {`,
  ];

  const objectNameMap = new Map<string, string>();
  for (const obj of scene.objects) {
    objectNameMap.set(obj.id, obj.name);
  }

  const rules = compileBlocksToIR(scene.blocks);
  if (rules.length === 0) {
    lines.push(`  // Bu sahnede henüz etkin bir olay bloğu bulunmuyor.`);
  }

  const emitActions = (actions: BlockInstance[], indent: string) => {
    for (const act of actions) {
      const targetLabel =
        act.targetObjectId === 'scene'
          ? 'ctx.scene'
          : `ctx.getObject("${objectNameMap.get(act.targetObjectId) || act.targetObjectId}")`;

      switch (act.type) {
        case 'move_horizontal':
          lines.push(`${indent}${targetLabel}.setVelocityX(${Number(act.params.speed ?? 0)});`);
          break;
        case 'move_vertical':
          lines.push(`${indent}${targetLabel}.setVelocityY(${Number(act.params.speed ?? 0)});`);
          break;
        case 'move_jump':
          lines.push(`${indent}${targetLabel}.jump(${Number(act.params.force ?? 460)});`);
          break;
        case 'move_dash':
          lines.push(`${indent}${targetLabel}.dash(${Number(act.params.power ?? 540)});`);
          break;
        case 'move_set_facing':
          lines.push(`${indent}${targetLabel}.setFacing(${JSON.stringify(String(act.params.direction ?? 'right'))}, ${JSON.stringify(String(act.params.flipMode ?? 'horizontal'))});`);
          break;
        case 'physics_set_jump_mode':
          lines.push(`${indent}${targetLabel}.setJumpMode(${JSON.stringify(String(act.params.jumpMode ?? 'multi_jump'))}, ${Number(act.params.maxJumps ?? 2)});`);
          break;
        case 'world_set_boundary_action':
          lines.push(`${indent}ctx.worldBounds.setAction(${JSON.stringify(String(act.params.edge ?? 'bottom'))}, ${JSON.stringify(String(act.params.action ?? 'respawn_damage'))});`);
          break;
        case 'world_set_wall_filter':
          lines.push(`${indent}${targetLabel}.setInvisibleWallTargetFilter(${JSON.stringify(String(act.params.filter ?? 'all'))}, ${JSON.stringify(String(act.params.customTarget ?? ''))});`);
          break;
        case 'act_shoot_projectile':
          lines.push(`${indent}${targetLabel}.shootLaser({ speed: ${Number(act.params.speed ?? 520)}, damage: ${Number(act.params.damage ?? 30)} });`);
          break;
        case 'physics_flip_gravity':
          lines.push(`${indent}${targetLabel}.flipGravity();`);
          break;
        case 'camera_shake':
          lines.push(`${indent}ctx.camera.shake(${Number(act.params.intensity ?? 8)});`);
          break;
        case 'move_to_position':
          lines.push(`${indent}${targetLabel}.setPosition(${Number(act.params.x ?? 0)}, ${Number(act.params.y ?? 0)});`);
          break;
        case 'move_rotate':
          lines.push(`${indent}${targetLabel}.rotate(${Number(act.params.degrees ?? 15)});`);
          break;
        case 'move_stop':
          lines.push(`${indent}${targetLabel}.stopMovement();`);
          break;
        case 'ui_add_score':
          lines.push(`${indent}ctx.hud.addScore(${Number(act.params.points ?? 10)});`);
          break;
        case 'ui_show_message':
          lines.push(`${indent}ctx.hud.showBanner(${JSON.stringify(String(act.params.text ?? ''))});`);
          break;
        case 'ui_start_dialogue':
          lines.push(`${indent}ctx.dialogue.open(${JSON.stringify(String(act.params.dialogueId ?? 'dlg_intro'))});`);
          break;
        case 'audio_play_sfx':
          lines.push(`${indent}ctx.audio.playSfx(${JSON.stringify(String(act.params.sound ?? 'coin'))});`);
          break;
        case 'audio_set_volume':
          lines.push(`${indent}ctx.audio.setVolume(${Number(act.params.volume ?? 80)});`);
          break;
        case 'sense_destroy_other':
          lines.push(`${indent}ctx.collision.destroyOther();`);
          break;
        case 'sense_damage_target':
          lines.push(`${indent}${targetLabel}.modifyHealth(${Number(act.params.amount ?? -20)});`);
          break;
        case 'anim_play':
          lines.push(`${indent}${targetLabel}.playAnimation(${JSON.stringify(String(act.params.clip ?? 'move'))});`);
          break;
        case 'anim_set_character_skin':
          lines.push(`${indent}${targetLabel}.setCharacterClass(${JSON.stringify(String(act.params.skin ?? 'knight'))});`);
          break;
        case 'scene_change':
          lines.push(`${indent}ctx.scene.switchTo(${JSON.stringify(String(act.params.sceneId ?? 'next'))});`);
          break;
        case 'scene_restart':
          lines.push(`${indent}ctx.scene.restart();`);
          break;
        case 'scene_victory':
          lines.push(`${indent}ctx.game.triggerVictory(${JSON.stringify(String(act.params.reason ?? 'Zafer!'))});`);
          break;
        case 'scene_gameover':
          lines.push(`${indent}ctx.game.triggerGameOver(${JSON.stringify(String(act.params.reason ?? 'Oyun Bitti'))});`);
          break;
        case 'var_set':
          lines.push(`${indent}ctx.vars.set(${JSON.stringify(String(act.params.varName ?? 'var'))}, ${JSON.stringify(act.params.value ?? 0)});`);
          break;
        case 'var_change':
          lines.push(`${indent}ctx.vars.add(${JSON.stringify(String(act.params.varName ?? 'var'))}, ${Number(act.params.delta ?? 1)});`);
          break;
        case 'var_random':
          lines.push(`${indent}ctx.vars.setRandom(${JSON.stringify(String(act.params.varName ?? 'rnd'))}, ${Number(act.params.min ?? 1)}, ${Number(act.params.max ?? 100)});`);
          break;
        case 'adv_inventory_add':
          lines.push(`${indent}ctx.inventory.addItem(${JSON.stringify(String(act.params.itemName ?? 'Eşya'))});`);
          break;
        case 'adv_quest_start':
          lines.push(`${indent}ctx.quests.start(${JSON.stringify(String(act.params.questId ?? 'q_main'))});`);
          break;
        case 'adv_quest_complete':
          lines.push(`${indent}ctx.quests.complete(${JSON.stringify(String(act.params.questId ?? 'q_main'))});`);
          break;
        case 'adv_enemy_patrol':
          lines.push(`${indent}${targetLabel}.enablePatrol(${Number(act.params.range ?? 120)}, ${Number(act.params.speed ?? 95)});`);
          break;
        case 'adv_follow_player':
          lines.push(`${indent}${targetLabel}.followPlayer(${Number(act.params.speed ?? 85)});`);
          break;
        case 'control_if_score_gte':
          lines.push(`${indent}if (ctx.hud.getScore() >= ${Number(act.params.threshold ?? 50)}) {`);
          emitActions(act.children || [], `${indent}  `);
          lines.push(`${indent}}`);
          break;
        case 'control_repeat_count':
          lines.push(`${indent}for (let i = 0; i < Math.min(50, ${Number(act.params.count ?? 3)}); i++) {`);
          emitActions(act.children || [], `${indent}  `);
          lines.push(`${indent}}`);
          break;
        case 'control_wait':
          lines.push(`${indent}await ctx.wait(${Number(act.params.seconds ?? 0.5)});`);
          break;
        default:
          lines.push(`${indent}// Komut: ${act.type}`);
      }
    }
  };

  for (const rule of rules) {
    const ownerName =
      rule.targetObjectId === 'scene'
        ? 'Sahne'
        : objectNameMap.get(rule.targetObjectId) || rule.targetObjectId;
    lines.push(`  // Olay: ${rule.eventType} -> Hedef: ${ownerName}`);
    lines.push(`  ctx.on(${JSON.stringify(rule.eventType)}, ${JSON.stringify(rule.eventParams)}, async () => {`);
    emitActions(rule.actions, '    ');
    lines.push(`  });`);
    lines.push(``);
  }

  lines.push(`}`);
  return lines.join('\n');
}
