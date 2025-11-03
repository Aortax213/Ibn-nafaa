/* script.js — Ibn Nafaa (معدّل: تشغيل صوت آمن للهواتف + حفظ أوفلاين باستخدام Cache API) */

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
  // استخدم 128 للمحسنات، 64 أصغر حجمًا إذا رغبت
  return `https://cdn.islamic.network/quran/audio/${bitrate}/${reciterKey}/${padSurah(surah)}.mp3`;
}

/* ===== حالة واجهة المستخدم ===== */
function updateStatus(txt){ const el = $('statusText'); if(el) el.textContent = txt; }

/* ===== تحميل قائمة السور وإظهارها ===== */
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
    console.error(e);
    const sel = $('surahSelect'); if(sel) sel.innerHTML = '<option>خطأ في التحميل</option>';
  }
}

/* ===== إظهار نص السورة ===== */
async function loadSurah(number){
  const out = $('quranContent');
  out.innerHTML = 'جارٍ التحميل...';
  try{
    const r = await fetch(`${QURAN_API}/surah/${number}`);
    const j = await r.json();
    if(j && j.data && j.data.ayahs){
      const html = j.data.ayahs.map(a=>`<p style="direction:rtl;font-size:18px;margin:6px 0">${a.text}<span class="small" style="display:block;font-size:12px;margin-top:6px">(${a.numberInSurah})</span></p>`).join('');
      out.innerHTML = html;
      window.scrollTo({top:0,behavior:'smooth'});
    } else out.textContent = 'فشل تحميل نص السورة';
  }catch(e){
    console.error(e);
    out.textContent = 'تعذر الاتصال بنص السورة';
  }
}

/* ===== فحص إذا السورة مخزنة في الكاش ===== */
async function isSurahCached(reciterKey, surah, bitrate='128'){
  try{
    const url = buildAudioUrl(reciterKey, surah, bitrate);
    const cache = await caches.open(AUDIO_CACHE);
    const match = await cache.match(url);
    return !!match;
  }catch(e){
    return false;
  }
}

/* ===== تحميل وحفظ السورة في الكاش (download-on-demand) ===== */
async function downloadSurahToCache(reciterKey, surah, bitrate='128', onProgress){
  const url = buildAudioUrl(reciterKey, surah, bitrate);
  try{
    const cache = await caches.open(AUDIO_CACHE);
    const match = await cache.match(url);
    if(match) return {status:'cached', url};

    const resp = await fetch(url);
    if(!resp.ok) throw new Error('فشل التحميل: ' + resp.status);
    await cache.put(url, resp.clone());
    return {status:'downloaded', url};
  }catch(err){
    console.error(err);
    return {status:'error', message:String(err)};
  }
}

/* ===== تشغيل السورة: الكاش أولًا ثم الشبكة + ضمان تفاعل المستخدم ===== */
async function playSurah(reciterKey, surah, bitrate='128'){
  const audio = $('audioPlayer');
  const url = buildAudioUrl(reciterKey, surah, bitrate);

  try{
    updateStatus('جارٍ محاولة التشغيل...');

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
        // قد يحتاج تفاعل المستخدم؛ سنحاول آليًا بعد تعيين مستمع تفاعل
        console.warn('play from blob requires user interaction', e);
      }
    }

    // 2) إذا غير مخزّن أو لم يبدأ التشغيل، شغّله من CDN مباشرة
    audio.src = url;

    // محاولة التشغيل مباشرةً (قد يُرفض إذا لم يحدث تفاعل)
    try{
      await audio.play();
      updateStatus('يعمل من الإنترنت — السورة ' + surah);
    }catch(err){
      // إذا رفض التشغيل الآلي: جهّز مستمعًا لأول تفاعل لتشغيل الصوت فورًا
      updateStatus('اضغط الشاشة أو زر التشغيل للسماح بتشغيل الصوت');
      const playOnce = async () => {
        try{
          await audio.play();
          updateStatus('تم التشغيل بعد التفاعل — السورة ' + surah);
        }catch(e){
          console.warn('لا يزال التشغيل مرفوضاً', e);
        } finally {
          document.removeEventListener('click', playOnce);
          document.removeEventListener('touchstart', playOnce);
        }
      };
      document.addEventListener('click', playOnce, {once:true});
      document.addEventListener('touchstart', playOnce, {once:true});
    }

    // 3) احفظ السورة في الكاش في الخلفية (لكي تعمل أوفلاين لاحقًا)
    downloadSurahToCache(reciterKey, surah, bitrate).then(res=>{
      if(res.status === 'downloaded') updateStatus('تم حفظ السورة محلياً (أوفلاين)');
      else if(res.status === 'cached') updateStatus('السورة موجودة مسبقًا في الكاش');
    }).catch(e=>console.warn('خطأ الحفظ بالخلفية', e));

  }catch(e){
    console.error('خطأ أثناء محاولة التشغيل', e);
    updateStatus('خطأ أثناء التشغيل: ' + String(e));
  }
}

/* ===== تحميل كل السور (تحذير: يأخذ مساحة) ===== */
async function downloadAll(reciterKey, bitrate='128', progressCb){
  const total = 114;
  let done = 0;
  for(let i=1;i<=total;i++){
    const res = await downloadSurahToCache(reciterKey, i, bitrate);
    done++;
    if(progressCb) progressCb(Math.round((done/total)*100));
    // تأخير بسيط لتخفيف الضغط على السيرفر
    await new Promise(r=>setTimeout(r, 150));
  }
  return true;
}

/* ===== حذف الكاش (إدارة التخزين) ===== */
async function clearAudioCache(){
  try{
    await caches.delete(AUDIO_CACHE);
    updateStatus('تم حذف ملفات الصوت المخزنة');
    alert('تم حذف ملفات الصوت المخزنة في المتصفح');
  }catch(e){
    console.warn(e);
    alert('فشل حذف الكاش');
  }
}

/* ===== =========== الجزء المتبقي من وظائف التطبيق (سبحة - مواقيت - مسابقة) =========== ===== */

/* Daily message */
try { document.getElementById('dailyMessage').textContent = "ابدأ يومك بذكر الله وتدبر كتابه."; } catch(e){}

/* Tasbih */
const TASB_KEY = 'ibnnaf_tasbih_v1';
let tasb = JSON.parse(localStorage.getItem(TASB_KEY) || '{"count":0,"target":99}');
function saveTasb(){ localStorage.setItem(TASB_KEY, JSON.stringify(tasb)); updateWeekStats(); }
function updateWeekStats(){ $('weekStats').textContent = (tasb.count || 0) + ' تسبّحات عامة'; }

document.addEventListener('DOMContentLoaded', ()=>{
  // تهيئة واجهة
  $('tasbihCount').textContent = tasb.count;
  $('tasbihTarget').value = tasb.target || 99;
  loadSurahList();
  updateWeekStats();

  // ربط أزرار السبحة
  $('incBtn').addEventListener('click', ()=>{ tasb.count++; $('tasbihCount').textContent = tasb.count; saveTasb(); if(tasb.count>=tasb.target) setTimeout(()=>alert('مبروك وصلت الهدف!'),50); });
  $('decBtn').addEventListener('click', ()=>{ if(tasb.count>0) tasb.count--; $('tasbihCount').textContent = tasb.count; saveTasb(); });
  $('resetBtn').addEventListener('click', ()=>{ tasb.count=0; $('tasbihCount').textContent = 0; saveTasb(); });
  $('tasbihTarget').addEventListener('change', ()=>{ tasb.target = parseInt($('tasbihTarget').value||99); saveTasb(); });

  // ربط أزرار القرآن
  $('playSurahBtn').addEventListener('click', async ()=>{
    const s = $('surahSelect').value || 1;
    const r = $('reciterSelect').value || 'saad_alghamdi';
    updateStatus('جاري تشغيل السورة — ' + s);
    await playSurah(r, s, '128');
  });

  $('loadSurahBtn').addEventListener('click', async ()=>{
    const v = $('surahSelect').value;
    if(v) await loadSurah(v);
    else alert('اختر السورة');
  });

  $('downloadSurahBtn').addEventListener('click', async ()=>{
    const s = $('surahSelect').value || 1;
    const r = $('reciterSelect').value || 'saad_alghamdi';
    $('downloadSurahBtn').disabled = true; $('downloadSurahBtn').textContent = 'جارٍ التحميل...';
    updateStatus('تحميل السورة وحفظها في الجهاز...');
    const res = await downloadSurahToCache(r, s, '128');
    if(res.status === 'downloaded' || res.status === 'cached'){
      updateStatus('تم حفظ السورة في الجهاز');
      alert('تم حفظ السورة بنجاح للاستماع أوفلاين');
    } else {
      updateStatus('فشل حفظ السورة');
      alert('فشل تحميل السورة: ' + (res.message || 'خطأ غير معروف'));
    }
    $('downloadSurahBtn').disabled = false; $('downloadSurahBtn').textContent = 'تحميل للسماع أوفلاين';
  });

  $('downloadAllBtn').addEventListener('click', async ()=>{
    if(!confirm('تحميل كل القرآن سيأخذ مساحة كبيرة. الاستمرار؟')) return;
    const r = $('reciterSelect').value || 'saad_alghamdi';
    $('downloadAllBtn').disabled = true; $('downloadAllBtn').textContent = 'جاري تحميل كل القرآن...';
    updateStatus('تحميل كل القرآن — جاري التحميل (قد يستغرق وقتاً)');
    await downloadAll(r, '128', p => { const prog = document.getElementById('dlProgress'); if(prog) prog.style.width = p + '%'; updateStatus('تقدم التحميل: ' + p + '%'); });
    updateStatus('انتهى تحميل كل القرآن');
    alert('انتهى تحميل كل القرآن (محلياً في المتصفح)');
    $('downloadAllBtn').disabled = false; $('downloadAllBtn').textContent = 'تحميل كل القرآن (تحذير)';
    const prog = document.getElementById('dlProgress'); if(prog) prog.style.width = '0%';
  });

  // زر حذف الكاش إن وُجد
  const clearBtn = document.getElementById('clearCacheBtn');
  if(clearBtn) clearBtn.addEventListener('click', async ()=>{
    if(!confirm('هل تريد حذف جميع ملفات الصوت المخزنة؟')) return;
    await clearAudioCache();
  });

  // تهيئة مواقيت الصلاة
  tryInitPrayer();
});

/* ===== مواقيت الصلاة ===== */
async function fetchPrayerTimes(lat, lon, method=2){
  try{
    const t = Math.floor(Date.now()/1000);
    const url = `${ADHAN_BASE}/timings/${t}?latitude=${lat}&longitude=${lon}&method=${method}`;
    const r = await fetch(url); const j = await r.json(); return j.data;
  }catch(e){ console.warn(e); return null; }
}
function renderTimings(data){
  if(!data) { document.getElementById('timesGrid').innerHTML = 'لا توجد مواقيت'; return; }
  const timings = data.timings; const order = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
  const grid = document.getElementById('timesGrid'); grid.innerHTML = '';
  order.forEach(k=>{
    const div = document.createElement('div'); div.className='time-box'; div.style.padding='8px'; div.innerHTML = `<div class="small">${k}</div><div style="font-weight:800">${timings[k]}</div>`; grid.appendChild(div);
  });
  findNextPrayer(timings);
  document.getElementById('locationInfo').textContent = data.meta ? `${data.meta.timezone} — ${data.date.readable}` : '-';
}
function timeStrToDate(t){ const [hh,mm]=t.split(':').map(x=>parseInt(x)); const now=new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0); }
let countdownInterval=null;
function findNextPrayer(timings){
  const order=['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha']; const now=new Date();
  for(let i=0;i<order.length;i++){
    const name=order[i]; const t=timeStrToDate(timings[name]);
    if(t.getTime()>now.getTime()){ startCountdown(t,name); return; }
  }
  const tomorrowFajr=timeStrToDate(timings['Fajr']); tomorrowFajr.setDate(tomorrowFajr.getDate()+1); startCountdown(tomorrowFajr,'Fajr (غداً)');
}
function startCountdown(targetDate,name){ document.getElementById('nextName').textContent=name; if(countdownInterval) clearInterval(countdownInterval);
  function update(){ const now=new Date(); let diff=targetDate.getTime()-now.getTime(); if(diff<=0){ document.getElementById('nextCountdown').textContent='00:00:00'; return; } const h=Math.floor(diff/3600000); diff%=3600000; const m=Math.floor(diff/60000); diff%=60000; const s=Math.floor(diff/1000); document.getElementById('nextCountdown').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
  update(); countdownInterval=setInterval(update,1000);
}

/* ===== مسابقة بسيطة (كما كانت) ===== */
const QUESTIONS=[{q:"ما اسم أول سورة أنزلت؟",options:["الفاتحة","العلق","يس","المدثر"],a:1},{q:"كم عدد أجزاء القرآن؟",options:["20 جزء","30 جزء","15 جزء","10 أجزاء"],a:1}];
let quizState={index:0,score:0,order:[]};
function startQuiz(){ quizState.order=QUESTIONS.map((_,i)=>i).sort(()=>Math.random()-0.5); quizState.index=0; quizState.score=0; document.getElementById('qTotal').textContent=quizState.order.length; document.getElementById('quizPlay').style.display='block'; document.getElementById('quizResult').style.display='none'; document.getElementById('quizIntro')?.remove(); showQuestion(); }
function showQuestion(){ const idx=quizState.order[quizState.index]; const Q=QUESTIONS[idx]; document.getElementById('qIndex').textContent=quizState.index+1; document.getElementById('questionText').textContent=Q.q; const opts=Q.options.map((opt,i)=>`<button class="option-btn" data-i="${i}">${opt}</button>`).join(''); document.getElementById('optionsList').innerHTML=opts; [...document.getElementById('optionsList').children].forEach(btn=>{ btn.addEventListener('click', ()=>{ const chosen=parseInt(btn.getAttribute('data-i')); if(chosen===Q.a){ btn.classList.add('correct'); quizState.score++; } else { btn.classList.add('wrong'); const correctBtn=[...document.getElementById('optionsList').children].find(b=>parseInt(b.getAttribute('data-i'))===Q.a); if(correctBtn) correctBtn.classList.add('correct'); } [...document.getElementById('optionsList').children].forEach(b=>b.disabled=true); }); }); }
function nextQuestion(){ if(quizState.index<quizState.order.length-1){ quizState.index++; showQuestion(); } else finishQuiz(); }
function finishQuiz(){ document.getElementById('quizPlay').style.display='none'; document.getElementById('quizResult').style.display='block'; document.getElementById('scoreVal').textContent=`${quizState.score} / ${quizState.order.length}`; }
document.getElementById('startQuizBtn').addEventListener('click', startQuiz); document.getElementById('nextQBtn').addEventListener('click', nextQuestion); document.getElementById('retryBtn').addEventListener('click', ()=>{ location.reload(); });

/* ===== Init bootstrap (جرب تحميل مواقيت الصلاة) ===== */
(async function init(){
  try{
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(async pos=>{
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        const data = await fetchPrayerTimes(lat, lon, 2);
        if(data) renderTimings(data);
      }, async ()=>{ const r = await fetch(`${ADHAN_BASE}/timingsByCity?city=Algiers&country=Algeria&method=2`); const j = await r.json(); if(j && j.data) renderTimings(j.data); }, {timeout:10000});
    } else {
      const r = await fetch(`${ADHAN_BASE}/timingsByCity?city=Algiers&country=Algeria&method=2`);
      const j = await r.json(); if(j && j.data) renderTimings(j.data);
    }
  }catch(e){ console.warn(e); }
})();
