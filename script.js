
const QURAN_API = 'https://api.alquran.cloud/v1';
const ADHAN_BASE = 'https://api.aladhan.com/v1';
const $ = id => document.getElementById(id);

// Daily message
document.getElementById('dailyMessage').textContent = "ابدأ يومك بذكر الله وتدبر كتابه.";

// Load Surah list
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
  }catch(e){ $('surahSelect').innerHTML='<option>خطأ في التحميل</option>'; }
}

async function loadSurah(number){
  $('quranContent').innerHTML = 'جارٍ التحميل...';
  try{
    const r = await fetch(`${QURAN_API}/surah/${number}`);
    const j = await r.json();
    if(j && j.data){
      const html = j.data.ayahs.map(a=>`<p style="direction:rtl;font-size:20px;margin:8px 0">${a.text}<span class="small" style="display:block;font-size:12px;margin-top:6px">(${a.numberInSurah})</span></p>`).join('');
      $('quranContent').innerHTML = html;
      window.scrollTo({top:0,behavior:'smooth'});
    } else $('quranContent').textContent = 'فشل تحميل السورة';
  }catch(e){ $('quranContent').textContent = 'فشل الاتصال'; }
}

// Play recitation
async function playRecitation(surah=1, reciterKey='saad_alghamdi'){
  const ap = $('audioPlayer');
  try{
    const url = `https://cdn.islamic.network/quran/audio/128/${reciterKey}/${surah}.mp3`;
    ap.src = url;
    await ap.play();
  }catch(e){
    console.warn('play error', e);
    alert('لتشغيل الصوت، اضغط جزءًا من الصفحة أولاً (سياسة المتصفح).');
  }
}

// Tasbih
const TASB_KEY = 'ibnnaf_tasbih_v1';
let tasb = JSON.parse(localStorage.getItem(TASB_KEY)||'{"count":0,"target":99}');
function saveTasb(){ localStorage.setItem(TASB_KEY, JSON.stringify(tasb)); updateWeekStats(); }
function updateWeekStats(){ $('weekStats').textContent = (tasb.count || 0) + ' تسبّحات عامة'; }
document.addEventListener('DOMContentLoaded', ()=>{
  $('tasbihCount').textContent = tasb.count;
  $('tasbihTarget').value = tasb.target;
  loadSurahList();
  updateWeekStats();
});

document.getElementById('incBtn').addEventListener('click', ()=>{ tasb.count++; $('tasbihCount').textContent=tasb.count; saveTasb(); if(tasb.count>=tasb.target) setTimeout(()=>alert('مبروك وصلت الهدف!'),50); });
document.getElementById('decBtn').addEventListener('click', ()=>{ if(tasb.count>0) tasb.count--; $('tasbihCount').textContent=tasb.count; saveTasb(); });
document.getElementById('resetBtn').addEventListener('click', ()=>{ tasb.count=0; $('tasbihCount').textContent=0; saveTasb(); });
$('tasbihTarget').addEventListener('change', ()=>{ tasb.target = parseInt($('tasbihTarget').value||99); saveTasb(); });

// bindings for Quran play/load
document.getElementById('playSurahBtn').addEventListener('click', ()=>{ const s=$('surahSelect').value||1; const r=$('reciterSelect').value; playRecitation(s, r); });
document.getElementById('loadSurahBtn').addEventListener('click', ()=>{ const v=$('surahSelect').value; if(v) loadSurah(v); else alert('اختر السورة'); });

// Prayer times
async function fetchPrayerTimes(lat, lon, method=2){
  try{
    const t = Math.floor(Date.now()/1000);
    const url = `${ADHAN_BASE}/timings/${t}?latitude=${lat}&longitude=${lon}&method=${method}`;
    const r = await fetch(url); const j = await r.json(); return j.data;
  }catch(e){ console.warn(e); return null; }
}
function renderTimings(data){
  if(!data) { $('timesGrid').innerHTML = 'لا توجد مواقيت'; return; }
  const timings = data.timings; const order = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha']; $('timesGrid').innerHTML='';
  order.forEach(k=>{ const div=document.createElement('div'); div.className='time-box'; div.innerHTML = `<div class="small">${k}</div><div style="font-weight:800">${timings[k]}</div>`; $('timesGrid').appendChild(div); });
  findNextPrayer(timings);
  $('locationInfo').textContent = data.meta ? `${data.meta.timezone} — ${data.date.readable}` : '-';
}
function timeStrToDate(t){ const [hh,mm]=t.split(':').map(x=>parseInt(x)); const now=new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0); }
let countdownInterval=null;
function findNextPrayer(timings){ const order=['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha']; const now=new Date(); for(let i=0;i<order.length;i++){ const name=order[i]; const t=timeStrToDate(timings[name]); if(t.getTime()>now.getTime()){ startCountdown(t,name); return; } } const tomorrowFajr=timeStrToDate(timings['Fajr']); tomorrowFajr.setDate(tomorrowFajr.getDate()+1); startCountdown(tomorrowFajr,'Fajr (غداً)'); }
function startCountdown(targetDate,name){ $('nextName').textContent=name; if(countdownInterval) clearInterval(countdownInterval); function update(){ const now=new Date(); let diff=targetDate.getTime()-now.getTime(); if(diff<=0){ $('nextCountdown').textContent='00:00:00'; return; } const h=Math.floor(diff/3600000); diff%=3600000; const m=Math.floor(diff/60000); diff%=60000; const s=Math.floor(diff/1000); $('nextCountdown').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; } update(); countdownInterval=setInterval(update,1000); }

// Simple quiz
const QUESTIONS=[{q:"ما اسم أول سورة أنزلت؟",options:["الفاتحة","العلق","يس","المدثر"],a:1},{q:"كم عدد أجزاء القرآن؟",options:["20 جزء","30 جزء","15 جزء","10 أجزاء"],a:1}];
let quizState={index:0,score:0,order:[]};
function startQuiz(){ quizState.order=QUESTIONS.map((_,i)=>i).sort(()=>Math.random()-0.5); quizState.index=0; quizState.score=0; $('qTotal').textContent=quizState.order.length; document.getElementById('quizPlay').style.display='block'; document.getElementById('quizResult').style.display='none'; document.getElementById('quizIntro')?.remove(); showQuestion(); }
function showQuestion(){ const idx=quizState.order[quizState.index]; const Q=QUESTIONS[idx]; $('qIndex').textContent=quizState.index+1; $('questionText').textContent=Q.q; const opts=Q.options.map((opt,i)=>`<button class="option-btn" data-i="${i}">${opt}</button>`).join(''); $('optionsList').innerHTML=opts; [...$('optionsList').children].forEach(btn=>{ btn.addEventListener('click', ()=>{ const chosen=parseInt(btn.getAttribute('data-i')); if(chosen===Q.a){ btn.classList.add('correct'); quizState.score++; } else { btn.classList.add('wrong'); const correctBtn=[...$('optionsList').children].find(b=>parseInt(b.getAttribute('data-i'))===Q.a); if(correctBtn) correctBtn.classList.add('correct'); } [...$('optionsList').children].forEach(b=>b.disabled=true); }); }); }
function nextQuestion(){ if(quizState.index<quizState.order.length-1){ quizState.index++; showQuestion(); } else finishQuiz(); }
function finishQuiz(){ document.getElementById('quizPlay').style.display='none'; document.getElementById('quizResult').style.display='block'; document.getElementById('scoreVal').textContent=`${quizState.score} / ${quizState.order.length}`; }
document.getElementById('startQuizBtn').addEventListener('click', startQuiz); document.getElementById('nextQBtn').addEventListener('click', nextQuestion); document.getElementById('retryBtn').addEventListener('click', ()=>{ location.reload(); });

// Init - try fetch prayer times using geolocation
(async function init(){ try{ if(navigator.geolocation){ navigator.geolocation.getCurrentPosition(async pos=>{ const lat=pos.coords.latitude, lon=pos.coords.longitude; const data = await fetchPrayerTimes(lat, lon, 2); if(data) renderTimings(data); }, async ()=>{ const r=await fetch(`${ADHAN_BASE}/timingsByCity?city=Algiers&country=Algeria&method=2`); const j=await r.json(); if(j&&j.data) renderTimings(j.data); }, {timeout:10000}); } else { const r=await fetch(`${ADHAN_BASE}/timingsByCity?city=Algiers&country=Algeria&method=2`); const j=await r.json(); if(j&&j.data) renderTimings(j.data); } }catch(e){ console.warn(e); } })();
