/* ===== إعدادات ومراجع ===== */
const QURAN_API = 'https://api.alquran.cloud/v1';
const ADHAN_BASE = 'https://api.aladhan.com/v1';
const RECITERS = { 'سعد الغامدي':'saad_alghamdi', 'الجهني':'aljuhani' };
const AUDIO_CACHE = 'ibn-nafaa-audio-v1';
const $ = id => document.getElementById(id);

/* ===== مساعدة لصيغة رقم السورة (3 خانات) ===== */
function padSurah(n){ return String(n).padStart(3,'0'); }

/* ===== بناء رابط الصوت من CDN (64 أو 128 kbps) ===== */
function buildAudioUrl(reciterKey, surah, bitrate='128'){
  return `https://cdn.islamic.network/quran/audio/${bitrate}/${reciterKey}/${padSurah(surah)}.mp3`;
}

/* ===== تشغيل الصوت بعد التفاعل الأول ===== */
async function playSurah(reciterKey, surah, bitrate='128'){
  const audio = $('audioPlayer');
  const url = buildAudioUrl(reciterKey, surah, bitrate);
  
  try{
    // 1) محاولة تشغيل من الكاش (أوفلاين) أولًا
    const cache = await caches.open(AUDIO_CACHE);
    const cached = await cache.match(url);
    if(cached){
      const blob = await cached.blob();
      const blobUrl = URL.createObjectURL(blob);
      audio.src = blobUrl;
      try{
        await audio.play();
        updateStatus('يعمل من الكاش (أوفلاين) — السورة ' + surah);
        return;
      }catch(e){
        // إذا لم يتم تشغيل الصوت من الكاش بشكل صحيح
        console.warn('فشل التشغيل من الكاش', e);
      }
    }

    // 2) إذا لم ينجح من الكاش، شغّل من الإنترنت
    audio.src = url;
    await audio.play(); // حاول التشغيل مباشرة
    updateStatus('يعمل من الإنترنت — السورة ' + surah);

    // 3) حفظ السورة في الكاش في الخلفية
    downloadSurahToCache(reciterKey, surah, bitrate);
  }catch(e){
    console.warn('حدث خطأ أثناء محاولة تشغيل الصوت', e);
    updateStatus('خطأ أثناء التشغيل: ' + String(e));
    // تحفيز المستخدم للتفاعل مع الصوت (click أو touchstart)
    const playOnce = async () => {
      try{
        await audio.play();
        updateStatus('تم التشغيل بعد التفاعل — السورة ' + surah);
      }catch(e){
        console.warn('فشل التشغيل حتى بعد التفاعل', e);
      } finally {
        document.removeEventListener('click', playOnce);
        document.removeEventListener('touchstart', playOnce);
      }
    };
    document.addEventListener('click', playOnce, {once:true});
    document.addEventListener('touchstart', playOnce, {once:true});
  }
}

/* ===== تحميل وحفظ السورة في الكاش ===== */
async function downloadSurahToCache(reciterKey, surah, bitrate='128'){
  const url = buildAudioUrl(reciterKey, surah, bitrate);
  try{
    const cache = await caches.open(AUDIO_CACHE);
    const match = await cache.match(url);
    if(match) return;

    const resp = await fetch(url);
    if(!resp.ok) throw new Error('فشل التحميل: ' + resp.status);
    await cache.put(url, resp.clone());
    console.log('تم حفظ السورة في الكاش:', surah);
  }catch(err){
    console.warn('فشل حفظ السورة في الكاش:', err);
  }
}

/* ===== إعدادات الصوت من المتصفح ===== */
function updateStatus(txt){ const el = $('statusText'); if(el) el.textContent = txt; }

/* ===== تحميل السور وعرضها ===== */
async function loadSurahList(){
  try{
    const res = await fetch(`${QURAN_API}/surah`);
    const j = await res.json();
    const sel = $('surahSelect'); sel.innerHTML = '<option value="">اختر السورة</option>';
    j.data.forEach(s=>{
      const opt = document.createElement('option');
      opt.value = s.number;
      opt.textContent = `${s.number} — ${s.englishName} — ${s.name}`;
      sel.appendChild(opt);
    });
  }catch(e){
    const sel = $('surahSelect'); if(sel) sel.innerHTML = '<option>خطأ في التحميل</option>';
  }
}

/* ===== تشغيل السورة عند الضغط على الزر ===== */
document.getElementById('playSurahBtn').addEventListener('click', () => {
  const s = $('surahSelect').value || 1;
  const r = $('reciterSelect').value || 'saad_alghamdi';
  playSurah(r, s, '128');
});

/* ===== التحميل التلقائي للسورة المحددة ===== */
document.getElementById('loadSurahBtn').addEventListener('click', () => {
  const v = $('surahSelect').value;
  if(v) loadSurah(v);
  else alert('اختر السورة');
});

/* ===== ملاحظة: يتم تحديث محتوى الصفحة بعد هذه التعديلات ===== */
