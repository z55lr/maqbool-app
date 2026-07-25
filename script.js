/* =========================================================
   FIREBASE CONFIG - same project used by the Android app
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyCuhQOiRHyDi8EPYI4Vc4Ry-t__WAPHgF8",
  databaseURL: "https://resha-458ae-default-rtdb.firebaseio.com",
  projectId: "resha-458ae",
  storageBucket: "resha-458ae.appspot.com",
  appId: "1:732893034291:android:3f04b409e3ce9652db7046"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* =========================================================
   HELPERS
   ========================================================= */
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(()=>t.classList.remove('show'), 2600);
}

function normalizeArabic(str){
  return String(str||'')
    .replace(/[أإآ]/g,'ا').replace(/ة/g,'ه')
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .toLowerCase().trim();
}

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}

function openSheet(id){document.getElementById(id).classList.add('active');}
function closeSheet(id){document.getElementById(id).classList.remove('active');}

/* =========================================================
   STATE
   ========================================================= */
let selectedCity = '';
let selectedRangeValue = '';
let selectedRangeLabel = '';
let currentResults = [];   // full filtered set (before search)
let currentUserInfo = {name:'', limit:'', degree:''};

const CITIES = ["بغداد","البصرة","نينوى","أربيل","النجف الأشرف","كربلاء المقدسة","ذي قار","بابل",
  "الأنبار","ديالى","القادسية","ميسان","كركوك","السليمانية","دهوك","المثنى","صلاح الدين","واسط"];

const DEGREE_OPTIONS = [
  {label:"معدلي بين 50 الى 60", value:"50_60"},
  {label:"معدلي بين 60 الى 70", value:"60_70"},
  {label:"معدلي بين 70 الى 80", value:"70_80"},
  {label:"معدلي بين 80 الى 90", value:"80_90"},
  {label:"معدلي من 90 الى 102", value:"90_102"},
  {label:"إظهار جميع النتائج", value:"All_Results"}
];

/* =========================================================
   BUILD SHEET OPTIONS
   ========================================================= */
const cityBox = document.getElementById('cityOptions');
CITIES.forEach(c=>{
  const el = document.createElement('div');
  el.className='sheet-option'; el.textContent=c;
  el.onclick=()=>{
    selectedCity=c;
    const v=document.getElementById('valCity');
    v.textContent=c; v.classList.remove('placeholder');
    closeSheet('overlayCity');
  };
  cityBox.appendChild(el);
});

const degreeBox = document.getElementById('degreeOptions');
DEGREE_OPTIONS.forEach(o=>{
  const el = document.createElement('div');
  el.className='sheet-option'; el.textContent=o.label;
  el.onclick=()=>{
    selectedRangeValue=o.value; selectedRangeLabel=o.label;
    const v=document.getElementById('valDegreeRange');
    v.textContent=o.label; v.classList.remove('placeholder');
    closeSheet('overlayDegree');
  };
  degreeBox.appendChild(el);
});

/* =========================================================
   PERSISTED FORM STATE (like SharedPreferences)
   ========================================================= */
(function restoreForm(){
  try{
    const saved = JSON.parse(localStorage.getItem('maqbool_form')||'{}');
    if(saved.name) document.getElementById('inpName').value = saved.name;
    if(saved.degree) document.getElementById('inpDegree').value = saved.degree;
    if(saved.city){
      selectedCity = saved.city;
      const v=document.getElementById('valCity');
      v.textContent = saved.city; v.classList.remove('placeholder');
    }
    if(saved.rangeValue){
      selectedRangeValue = saved.rangeValue;
      selectedRangeLabel = saved.rangeLabel || saved.rangeValue;
      const v=document.getElementById('valDegreeRange');
      v.textContent = selectedRangeLabel; v.classList.remove('placeholder');
    }
  }catch(e){}
})();

function persistForm(){
  localStorage.setItem('maqbool_form', JSON.stringify({
    name: document.getElementById('inpName').value,
    degree: document.getElementById('inpDegree').value,
    city: selectedCity,
    rangeValue: selectedRangeValue,
    rangeLabel: selectedRangeLabel
  }));
}

/* percentage auto '%' formatting like edittext1 watcher */
const degreeInput = document.getElementById('inpDegree');
degreeInput.addEventListener('input', ()=>{
  let clean = degreeInput.value.replace(/%/g,'').replace(/\u066A/g,'').trim();
  degreeInput.value = clean.length ? clean+'%' : '';
  persistForm();
});
document.getElementById('inpName').addEventListener('input', persistForm);

/* =========================================================
   NAV EVENTS
   ========================================================= */
document.getElementById('btnCity').onclick=()=>openSheet('overlayCity');
document.getElementById('btnDegreeRange').onclick=()=>openSheet('overlayDegree');
document.getElementById('overlayCity').onclick=(e)=>{if(e.target.id==='overlayCity')closeSheet('overlayCity');};
document.getElementById('overlayDegree').onclick=(e)=>{if(e.target.id==='overlayDegree')closeSheet('overlayDegree');};
document.getElementById('overlayUpdate').onclick=(e)=>{if(e.target.id==='overlayUpdate')closeSheet('overlayUpdate');};

document.getElementById('btnFavTop').onclick=()=>{renderFavorites(); showScreen('screen-favorites');};
document.getElementById('btnBackFav').onclick=()=>showScreen('screen-home');
document.getElementById('btnBackResults').onclick=()=>showScreen('screen-home');
document.getElementById('btnExit').onclick=()=>{
  if(confirm('هل تريد إغلاق التطبيق؟')) window.close();
};

/* =========================================================
   ENTER -> compute range, push user record, fetch & filter
   ========================================================= */
document.getElementById('btnEnter').onclick=()=>{
  const name = document.getElementById('inpName').value.trim();
  const degreeRaw = document.getElementById('inpDegree').value.trim();

  if(!name){ toast('خلي معلوماتك بعد كلبي'); return; }
  if(!selectedCity){ toast('من فضلك أختر المحافظة'); return; }
  if(!selectedRangeValue){ toast('من فضلك أختر حدود المعدل'); return; }
  if(!degreeRaw){ toast('من فضلك أكتب معدلك'); return; }

  currentUserInfo = {name, limit:selectedRangeValue, degree:degreeRaw};
  persistForm();

  // fire-and-forget analytics write, mirrors original app's `users` push
  try{
    db.ref('users').push({
      username:name, city:selectedCity, limit:selectedRangeValue, Final_Degree:degreeRaw
    });
  }catch(e){}

  fetchAndShowResults(degreeRaw, selectedRangeValue);
};

function fetchAndShowResults(degreeInputRaw, limitInputRaw){
  let degreeInput = degreeInputRaw
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/%/g,'').replace(/\u066A/g,'').trim();
  let limitInput = limitInputRaw
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace('limit_','').trim();

  const userDegree = parseFloat(degreeInput);
  if(isNaN(userDegree)){ toast('تنبيه: تعذر قراءة المعدل الذي أدخلته'); return; }

  const isAllResults = limitInput.includes('All_Results');
  let minLimit, maxLimit;
  if(isAllResults){
    minLimit = 50; maxLimit = userDegree + 4;
  } else {
    const parts = limitInput.split(/[_-]/);
    if(parts.length === 2){
      const n1 = parseFloat(parts[0]), n2 = parseFloat(parts[1]);
      minLimit = Math.min(n1,n2); maxLimit = Math.max(n1,n2);
    } else {
      maxLimit = parseFloat(limitInput); minLimit = maxLimit - 10;
    }
  }

  showScreen('screen-results');
  document.getElementById('resultCards').innerHTML = renderLoadingCard();

  db.ref('all_limits').once('value').then(snapshot=>{
    const list = [];
    snapshot.forEach(child=>{
      const val = child.val();
      if(val && val.Final_Degree !== undefined && val.Final_Degree !== null){
        const d = parseFloat(String(val.Final_Degree));
        if(!isNaN(d) && d >= minLimit && d <= maxLimit){
          list.push(val);
        }
      }
    });
    currentResults = list;
    document.getElementById('inpSearch').value = '';
    renderResultCards(list);

    if(list.length === 0){
      toast(`لم يتم العثور على نتائج بين ${minLimit} و ${maxLimit}`);
    } else if(isAllResults){
      toast(`تم عرض ${list.length} تخصص من معدل ${maxLimit} إلى ${minLimit}`);
    } else {
      toast(`تم عرض ${list.length} تخصص ضمن نطاق (${minLimit} - ${maxLimit})`);
    }
  }).catch(err=>{
    toast('خطأ في الفايربيز: '+err.message);
    document.getElementById('resultCards').innerHTML = renderEmptyState('حدث خطأ أثناء الاتصال بقاعدة البيانات');
  });
}

function renderLoadingCard(){
  return `<div class="empty-state"><p>جاري تحميل النتائج ...</p></div>`;
}
function renderEmptyState(msg){
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="#8a8f94"><circle cx="11" cy="11" r="7" stroke-width="1.6"/><path d="m20 20-3.5-3.5" stroke-width="1.6" stroke-linecap="round"/></svg>
    <p>${msg}</p>
  </div>`;
}

/* =========================================================
   RENDER RESULT CARDS + FAVORITE TOGGLE
   ========================================================= */
function favKey(item){
  return normalizeArabic(item.Faculty)+'|'+normalizeArabic(item.University)+'|'+normalizeArabic(item.Final_Degree);
}
function getFavorites(){
  try{ return JSON.parse(localStorage.getItem('maqbool_favorites')||'[]'); }catch(e){ return []; }
}
function setFavorites(list){ localStorage.setItem('maqbool_favorites', JSON.stringify(list)); }
function isFavorite(item){
  const key = favKey(item);
  return getFavorites().some(f=>favKey(f)===key);
}
function toggleFavorite(item, btnEl){
  const favs = getFavorites();
  const key = favKey(item);
  const idx = favs.findIndex(f=>favKey(f)===key);
  if(idx===-1){
    favs.push(item);
    setFavorites(favs);
    btnEl.classList.add('active');
    btnEl.querySelector('span').textContent='في المفضلة';
    toast('تمت الإضافة إلى المفضلة ❤️');
  } else {
    favs.splice(idx,1);
    setFavorites(favs);
    btnEl.classList.remove('active');
    btnEl.querySelector('span').textContent='أضف للمفضلة';
    toast('تمت الإزالة من المفضلة 🗑️');
  }
}

function cardHTML(item, opts){
  opts = opts || {};
  const fav = isFavorite(item);
  const favLabel = opts.removeMode ? 'حذف من المفضلة' : (fav ? 'في المفضلة' : 'أضف للمفضلة');
  const favClass = opts.removeMode ? 'card-fav active' : ('card-fav'+(fav?' active':''));
  return `
    <div class="card">
      <div class="card-row"><div class="v">${escapeHtml(item.City)}</div><div class="k">المحافظة :</div></div>
      <div class="card-row"><div class="v">${escapeHtml(item.University)}</div><div class="k">الجامعة :</div></div>
      <div class="card-row"><div class="v">${escapeHtml(item.Faculty)}</div><div class="k">الكلية :</div></div>
      <div class="card-row"><div class="v">${escapeHtml(item.Final_Degree)}</div><div class="k">الدرجة المطلوبة :</div></div>
      <div class="card-row"><div class="v">${escapeHtml(item.Type)}</div><div class="k">نوع الدوام :</div></div>
      <div class="${favClass}" data-key="${escapeHtml(favKey(item))}">
        <span>${favLabel}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="#FF5722"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.2 2 4.5 5.6 4c2-.3 3.9.7 5 2.3 1.1-1.6 3-2.6 5-2.3 3.6.5 5.2 4.2 3.6 7.7C19.5 16.4 12 21 12 21Z" stroke-width="1.7" stroke-linejoin="round"/></svg>
      </div>
    </div>`;
}
function escapeHtml(v){
  return String(v===undefined||v===null?'':v).replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function renderResultCards(list){
  const box = document.getElementById('resultCards');
  document.getElementById('resultSummary').textContent = list.length ? `عدد النتائج: ${list.length}` : '';
  if(!list.length){ box.innerHTML = renderEmptyState('لا توجد نتائج تطابق بحثك'); return; }
  box.innerHTML = list.map(item=>cardHTML(item)).join('');
  box.querySelectorAll('.card-fav').forEach((el, i)=>{
    el.onclick = ()=>toggleFavorite(list[i], el);
  });
}

/* Search within currentResults */
document.getElementById('btnSearch').onclick=doSearch;
document.getElementById('inpSearch').addEventListener('keyup', e=>{ if(e.key==='Enter') doSearch(); });
function doSearch(){
  const q = normalizeArabic(document.getElementById('inpSearch').value);
  if(!q){ renderResultCards(currentResults); toast(`تم عرض جميع النتائج (${currentResults.length})`); return; }
  const filtered = currentResults.filter(item=>{
    const combined = normalizeArabic([item.City,item.University,item.Faculty,item.Final_Degree,item.Type].join(' '));
    return combined.includes(q);
  });
  renderResultCards(filtered);
  toast(filtered.length ? `تم العثور على ${filtered.length} نتيجة` : `لا توجد نتائج تطابق: ${document.getElementById('inpSearch').value}`);
}

/* =========================================================
   FAVORITES SCREEN
   ========================================================= */
function renderFavorites(){
  const box = document.getElementById('favCards');
  const favs = getFavorites();
  if(!favs.length){ box.innerHTML = renderEmptyState('لا توجد تخصصات في المفضلة بعد'); return; }
  box.innerHTML = favs.map(item=>cardHTML(item, {removeMode:true})).join('');
  box.querySelectorAll('.card-fav').forEach((el, i)=>{
    el.onclick = ()=>{
      if(confirm('هل أنت تأكد من إزالة هذا التخصص من المفضلة؟')){
        const favs2 = getFavorites();
        favs2.splice(i,1);
        setFavorites(favs2);
        toast('تمت الإزالة من المفضلة 🗑️');
        renderFavorites();
      }
    };
  });
}

/* =========================================================
   UPDATE CHECK (mirrors `update` node + SharedPreferences flag)
   ========================================================= */
db.ref('update').limitToLast(1).once('value').then(snap=>{
  let data = null;
  snap.forEach(c=>{ data = c.val(); });
  if(!data) return;
  const sig = String(data.if_elsenum||'');
  const lastSeen = localStorage.getItem('maqbool_last_update')||'';
  if(sig === '1' && lastSeen !== sig){
    localStorage.setItem('maqbool_last_update', sig);
    document.getElementById('updateVersion').textContent = 'رقم الإصدار الجديد : ' + (data.Version_number||'');
    document.getElementById('updateMsg').textContent = data.Message || '';
    document.getElementById('btnUpdateDownload').onclick = ()=>{
      if(data.Update_link) window.open(data.Update_link, '_blank');
    };
    openSheet('overlayUpdate');
  }
}).catch(()=>{});
