const BASE = 'https://iusvdyjeimqrgtomojux.supabase.co';
const KEY = 'sb_publishable_mBm_AmV5TFt4fCoPS8iQng_vR0TXcEe';
const MEDIA = BASE + '/storage/v1/object/public/ananai-shop/';
const WA = '996501506506';
const MIN = 1;
const AGE = {56:'0–1 мес',62:'1–3 мес',68:'3–6 мес',74:'6–9 мес',80:'9–12 мес',86:'12–18 мес',92:'18–24 мес'};
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Number(value).toLocaleString('ru-RU') + ' сом';
const hp = model => model && model.price > 0;
const pr = model => hp(model) ? fmt(model.price) : 'По запросу';
const tt = t => t.q + ' шт.' + (t.s ? ' · ' + fmt(t.s) : '') + (t.u ? ' · по запросу' : '');
const PH = new URL('./assets/placeholder.svg', document.baseURI).href;
const im = m => m.img || PH;
const dm=$('dm'), dc=$('dc'), de=$('de'), bar=$('bar');
const show = dialog => { if (!dialog.open) dialog.showModal(); };
const STORE='ananai_catalog_cart_v2', DATA={cats:[],texts:[]};
const models=new Map(), byId=id=>models.get(id);
let cur={}, cart=[], ed=null, admin=false, session=null, refreshing=null;
let sections=[], page=0, pageRequest=0, settingsVersion=1, editTextVersion=1, revision=null;
let syncing=null, loaded=false, filterTimer, cartTicket=0;
try { const raw=JSON.parse(localStorage.getItem(STORE)||'[]'); if(Array.isArray(raw))cart=raw.filter(x=>x&&/^[\w-]{1,80}$/.test(x.id)&&Number.isSafeInteger(x.q)&&x.q>=1&&x.q<=99999); }catch{}
function saveCart(){try{localStorage.setItem(STORE,JSON.stringify(cart))}catch{}}
function media(path){
  return typeof path==='string' && /^(shop|owner)\/[a-zA-Z0-9_-]+\.(webp|jpg|png)$/.test(path) ? MEDIA+path : '';
}
function storeRow(row){
  const model={...row,img:media(row.img),thumb:media(row.thumb),sizes:Array.isArray(row.sizes)?row.sizes:[],
    colors:row.colors.map(c=>({...c,hex:/^#[0-9a-f]{6}$/i.test(c.hex)?c.hex:'#cccccc',img:media(c.img)}))};
  models.set(model.id,model);return model;
}
function errMsg(err){return err.status===401 || err.status===403 ? 'Доступ запрещён. Войдите в аккаунт владельца.' : err.message;}
async function call(path,{method='GET',body,headers={},token,raw=false}={}){
  const h={apikey:KEY,...headers};
  if(token)h.Authorization='Bearer '+token;
  if(body!==undefined && !raw)h['Content-Type']='application/json';
  const res=await fetch(BASE+path,{method,headers:h,body:body===undefined?undefined:raw?body:JSON.stringify(body),cache:'no-store'});
  const text=await res.text();let data;
  try{data=text?JSON.parse(text):null}catch{data=null}
  if(!res.ok)throw Object.assign(new Error(data?.msg||data?.message||data?.error_description||'Ошибка сервера '+res.status),{status:res.status});
  return data;
}
async function ownerToken(){
  if(!admin||!session)throw Error('Войдите в аккаунт владельца.');
  if(Date.now()/1000 < session.expires_at-60)return session.access_token;
  if(!refreshing){
    const previous=session;
    refreshing=call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:previous.refresh_token}})
      .then(s=>{if(session!==previous)throw Error('Сеанс завершён.');session=s;return s.access_token})
      .catch(e=>{if(session===previous&&(e.status===400||e.status===401))clearOwner();throw e})
      .finally(()=>{refreshing=null});
  }
  return refreshing;
}
const rest = (path,opts) => call('/rest/v1/'+path,opts);
async function write(path,method,body,prefer='return=representation'){
  return rest(path,{method,body,token:await ownerToken(),headers:{Prefer:prefer}});
}
function fail(err){$('catalogStatus').textContent='Не удалось обновить каталог. '+errMsg(err);$('retryStore').hidden=false}
function clearStatus(){$('catalogStatus').textContent='';$('retryStore').hidden=true}
function filters(){return {category:$('category').value,term:$('catalogSearch').value.trim(),ordering:$('catalogSort').value,page_no:page}}
async function render(){
  const ticket=++pageRequest;
  const rows=await rest('rpc/ananai_page',{method:'POST',body:filters()});
  if(ticket!==pageRequest)return;
  if(!rows.length && page>0){page--;return render()}
  const displayed=rows.slice(0,24).map(storeRow);
  const groups=new Map();
  for(const item of displayed){if(!groups.has(item.cat))groups.set(item.cat,[]);groups.get(item.cat).push(item)}
  $('secs').innerHTML=Array.from(groups,([cat,items])=>'<section class="sec"><div class="sh"><h2>'+esc(cat)+'</h2><img src="'+esc($('ico').src)+'" alt=""></div><div class="cards">'+items.map(card).join('')+'</div></section>').join('');
  $('searchNote').textContent=displayed.length?'':'Ничего не найдено. Попробуйте другое название или раздел.';
  $('pageNav').hidden=!page && rows.length<=24;$('pageInfo').textContent='Страница '+(page+1);
  $('prev').disabled=page===0;$('next').disabled=rows.length<=24;
}
async function meta(){
  const [cats,config]=await Promise.all([rest('ananai_sections?select=*&order=position,name'),rest('ananai_settings?select=texts,version&id=eq.true')]);
  sections=cats;DATA.cats=cats.map(c=>c.name);
  let selected=$('category').value;
  $('category').innerHTML='<option value="">Все разделы</option>'+cats.map(c=>'<option>'+esc(c.name)+'</option>').join('');
  $('category').value=DATA.cats.includes(selected)?selected:'';
  $('toc').innerHTML=cats.map((c,i)=>'<li><a href="#s'+i+'" data-section="'+i+'"><b>'+String(i+1).padStart(2,'0')+'</b><span>'+esc(c.name)+'</span><small>'+plural(c.total)+'</small></a></li>').join('');
  DATA.texts=config[0]?.texts||[];settingsVersion=config[0]?.version??1;applyTexts();
}
async function rowsFor(ids){
  const keys=[...new Set(ids)].filter(k=>/^[\w-]{1,80}$/.test(k));const all=[];
  for(let i=0;i<keys.length;i+=60){const part=keys.slice(i,i+60);all.push(...await rest('ananai_items?select=*&id=in.('+part.join(',')+')'))}
  return all;
}
async function syncCart(){
  const ticket=++cartTicket, ids=cart.map(x=>x.id);
  if(dm.open && cur.id)ids.push(cur.id);
  const rows=await rowsFor(ids);
  if(ticket!==cartTicket)return;
  const found=new Set(rows.map(r=>storeRow(r).id));
  const oldLength=cart.length;
  cart=cart.filter(x=>{
    if(!found.has(x.id))return false;
    const m=byId(x.id);
    if(m.colors.length){
      const index=x.colorName?m.colors.findIndex(c=>c.name===x.colorName):x.c;
      if(!Number.isInteger(index)||!m.colors[index])return false;
      x.c=index;x.colorName=m.colors[index].name;
    }else if(x.colorName)return false;
    return x.s==null?!m.sizes.length:m.sizes.some(s=>String(s)===String(x.s));
  });
  if(cart.length!==oldLength)$('orderNote').textContent='Каталог изменился. Недоступные варианты удалены из заказа.';
  upd();if(dc.open)renderC();
  if(dm.open){if(!found.has(cur.id))dm.close();else{const m=byId(cur.id);if(!m.colors[cur.c])cur.c=0;if(!m.sizes.includes(cur.s))cur.s=null;renderM()}}
}
function synchronize(force=false){
  if(syncing){if(force)refreshQueued=true;return syncing}
  syncing=(async()=>{
    do{
      const refresh=force||refreshQueued;refreshQueued=false;force=false;
      await refreshStore(refresh);
    }while(refreshQueued);
  })().finally(()=>{syncing=null});
  return syncing;
}
async function refreshStore(force){
  try{
    const [state]=await rest('ananai_revision?select=revision&id=eq.true');
    if(force||!loaded||revision!==state.revision){
      await meta();
      if(!loaded && /^#s\d+$/.test(location.hash))$('category').value=DATA.cats[Number(location.hash.slice(2))]||'';
      await Promise.all([render(),syncCart()]);
      revision=state.revision;
      if(!loaded){loaded=true;await openHash()}
      clearStatus();
    }
  }catch(err){fail(err)}
}
let refreshQueued=false;
function gotoPage(n,scroll=false){
  page=n;render().then(clearStatus).catch(fail);
  if(scroll)$('catalogArea').scrollIntoView({behavior:'instant'});
}
async function openHash(){
  if(location.hash==='#admin'){if(!admin)show($('login'));return}
  if(location.hash.startsWith('#model=')){
    const p=new URLSearchParams(location.hash.slice(1)),id=p.get('model'),rows=await rowsFor([id]);
    if(!rows.length){$('catalogStatus').textContent='Этой модели больше нет в каталоге.';return}
    const m=storeRow(rows[0]),c=Number(p.get('color'))||0;
    cur={id,c:m.colors[c]?c:0,q:1,s:null,requestedColor:'Как на фото'};renderM();show(dm)
  }else if(/^#s\d+$/.test(location.hash)){
    $('category').value=DATA.cats[Number(location.hash.slice(2))]||'';gotoPage(0,true);
  }
}
function plural(n){var a=n%10,b=n%100;return n+(a===1&&b!==11?" модель":(a>=2&&a<=4&&(b<12||b>14))?" модели":" моделей")}

function card(m){
var ad=admin?'<div class="adm"><button data-edit="'+esc(m.id)+'">Изменить</button><button data-del="'+esc(m.id)+'">Удалить</button></div>':"";
return '<div><button class="pc" data-open="'+esc(m.id)+'" aria-label="'+esc(m.name)+'"><img decoding="async" src="'+esc(m.thumb||im(m))+'" alt="'+esc(m.name)+'" loading="lazy"><span class="pm"><span class="pn">'+esc(m.name)+'</span><span class="pa">'+(m.art?esc(m.art):"ОТ "+MIN+" ШТ.")+'</span><span class="pp">'+pr(m)+'</span></span></button>'+ad+'</div>'}

function renderM(f){var m=byId(cur.id),c=m.colors[cur.c],img=(c&&c.img)||im(m);
var col=m.colors.length?'<div class="lbl">Цвет: <b>'+esc(c.name)+'</b></div><div class="sw">'+m.colors.map(function(k,j){return '<button class="swb" data-c="'+j+'" aria-label="'+esc(k.name)+'" aria-pressed="'+(j===cur.c)+'" style="background:'+esc(k.hex)+'"></button>'}).join("")+'</div>':
'<label class="lbl" for="requestedColor">Желаемый цвет (уточним наличие)</label><input id="requestedColor" type="text" list="requestedColors" maxlength="60" placeholder="Выберите или укажите цвет" value="'+esc(cur.requestedColor)+'"><datalist id="requestedColors"><option value="Как на фото"><option value="Белый"><option value="Бежевый"><option value="Молочный"><option value="Розовый"><option value="Голубой"><option value="Серый"><option value="Зелёный"><option value="Чёрный"></datalist>';
var sz=m.sizes.length?'<div class="lbl">Размер (рост, см)</div><div class="sz">'+m.sizes.map(function(s,j){return '<button class="chip" data-si="'+j+'" aria-pressed="'+(s===cur.s)+'"><b>'+esc(s)+'</b>'+(AGE[s]?'<small>'+AGE[s]+'</small>':"")+'</button>'}).join("")+'</div>':"";
dm.innerHTML='<button class="x" data-close aria-label="Закрыть">×</button><div class="mgrid"><img class="big" src="'+esc(img)+'" alt="'+esc(m.name)+'"><div class="mbody"><h3>'+esc(m.name)+'</h3>'+(m.art?'<p class="mut" style="margin:0 0 8px">'+esc(m.art)+'</p>':"")+'<p class="mut">'+esc(m.desc)+'</p><p class="pr2">'+(hp(m)?fmt(m.price)+' <span class="mut" style="font-weight:400;font-size:14px">за штуку</span>':'Цена по запросу')+'</p>'+col+sz+
'<div class="lbl">Количество, шт. (минимум '+MIN+')</div><div class="qty"><button data-q="-1" aria-label="Меньше">−</button><input id="qi" type="number" min="'+MIN+'" inputmode="numeric" value="'+cur.q+'" aria-label="Количество"><button data-q="1" aria-label="Больше">+</button></div><button class="btn add" data-add>Добавить в заказ</button><p class="note" id="note" role="status" aria-live="polite"></p></div></div>';
if(f){var e=dm.querySelector(f);if(e)e.focus()}}

function tot(){var q=0,s=0,u=0;cart.forEach(function(x){var m=byId(x.id);q+=x.q;if(hp(m))s+=x.q*m.price;else u+=x.q});return{q:q,s:s,u:u}}
function upd(){saveCart();var t=tot();bar.classList.toggle("on",t.q>0);document.body.classList.toggle("hasbar",t.q>0);$("bt").textContent=tt(t)}
function lineTxt(x){var m=byId(x.id),c=m.colors[x.c];return [c?c.name:(x.requestedColor?"Желаемый цвет: "+x.requestedColor:""),x.s?"размер "+x.s:""].filter(Boolean).join(", ")}
function renderC(){var t=tot();
$("cl").innerHTML=cart.length?cart.map(function(x,i){var m=byId(x.id),c=m.colors[x.c];return '<div class="line"><img src="'+esc((c&&c.img)||im(m))+'" alt=""><div><b>'+esc(m.name)+'</b><div class="mut">'+esc(lineTxt(x))+'</div><div class="qty sm"><button data-cq="'+i+'" data-d="-1" aria-label="Меньше">−</button><b>'+x.q+'</b><button data-cq="'+i+'" data-d="1" aria-label="Больше">+</button></div></div><div class="lt">'+(hp(m)?fmt(x.q*m.price):"по запросу")+'<button class="rm" data-rm="'+i+'">Убрать</button></div></div>'}).join(""):'<p class="mut">В заказе пока ничего нет.</p>';
$("ct").textContent=tt(t)}
function add(){var m=byId(cur.id),n=$("note");
if(m.sizes.length&&cur.s==null){n.textContent="Сначала выберите размер.";n.className="note err";return}
var requestedColor=m.colors.length?"":(cur.requestedColor||"").trim();
if(!m.colors.length&&!requestedColor){n.textContent="Укажите цвет или выберите «Как на фото».";n.className="note err";$("requestedColor").focus();return}
if(!Number.isSafeInteger(cur.q)||cur.q<1||cur.q>99999){n.textContent="Введите количество от 1 до 99 999.";return}
var k=cart.find(function(x){return x.id===cur.id&&x.c===cur.c&&x.s===cur.s&&(x.requestedColor||"")===requestedColor});
if(k && k.q+cur.q>99999){n.textContent="Слишком большое количество.";return} if(k)k.q+=cur.q;else cart.push({id:cur.id,c:cur.c,colorName:m.colors[cur.c]?.name||"",s:cur.s,q:cur.q,requestedColor:requestedColor});
upd();n.className="note";n.textContent="Добавлено в заказ: "+cur.q+" шт. Можно выбрать другой цвет или размер."}
function deliveryFields(){
 const courier=$("method").value==="Курьером",pickup=$("method").value==="Пункт выдачи";
 $("addressLabel").hidden=!courier;$("address").required=courier;
 $("pointLabel").hidden=!pickup;$("point").required=pickup;
}
$("method").onchange=deliveryFields;deliveryFields();
function orderData(){
 if(!cart.length){$("orderNote").textContent="Добавьте товар в заказ.";return}
 if(!$("deliveryForm").reportValidity())return;
 const details=[["Получатель","cn"],["Телефон","phone"],["Город","city"],["Способ получения","method"]];
 if($("address").required)details.push(["Адрес доставки","address"]);
 if($("point").required)details.push(["Пункт выдачи","point"]);
 if($("cc").value.trim())details.push(["Комментарий","cc"]);
 const lines=cart.map((x,i)=>{
  const m=byId(x.id),c=m.colors[x.c],link=new URL(location.pathname,location.origin);
  link.hash=new URLSearchParams({model:x.id,color:x.c}).toString();
  return {title:(i+1)+". "+m.name+(m.art?" ("+m.art+")":""),summary:[lineTxt(x),x.q+" шт.",hp(m)?fmt(m.price*x.q):"цена по запросу"].filter(Boolean).join(" · "),image:c?.img||im(m),link:link.href};
 });
 const contact=details.map(([label,id])=>label+": "+$(id).value.trim()).join("\n");
 const total="Итого: "+tt(tot());
 return {lines,contact,total,message:["Заказ Ananai",...lines.map(l=>l.title+"\n"+l.summary+"\nФото модели: "+l.link),total,contact].join("\n\n")};
}

function photoDocument(o){
 const rows=o.lines.map(l=>'<section><img alt="" src="'+esc(l.image)+'"><div><b>'+esc(l.title)+'</b><p>'+esc(l.summary)+'</p></div></section>').join("");
 return new File(['<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Заказ Ananai</title><style>body{font:16px system-ui;max-width:740px;margin:auto;padding:20px}section{display:flex;gap:16px;align-items:center;border-bottom:1px solid #ddd;padding:12px 0}img{width:100px;height:100px;object-fit:contain}pre{font:inherit;white-space:pre-wrap}</style><h1>Заказ Ananai</h1>'+rows+'<h3>'+esc(o.total)+'</h3><pre>'+esc(o.contact)+'</pre></html>'],"ananai-order.html",{type:"text/html"});
}
function openEdit(id,cat){var m=id&&byId(id);
ed=m?{id:m.id,isNew:false,version:m.version,thumb:m.thumb,name:m.name,art:m.art||"",cat:m.cat,price:m.price,sizes:m.sizes.join(", "),desc:m.desc,img:m.img,colors:m.colors.map(function(c){return{name:c.name,hex:c.hex,img:c.img||""}})}:{id:"p"+crypto.randomUUID(),isNew:true,name:"",art:"",cat:cat||DATA.cats[0],price:"",sizes:"",desc:"",img:"",colors:[]};
renderE();show(de)}
function renderE(){var e=ed;
$("deb").innerHTML='<h3>'+(e.isNew?"Новый товар":"Изменить товар")+'</h3>'+
'<label>Название<input data-f="name" value="'+esc(e.name)+'"></label>'+
'<label>Артикул (необязательно)<input data-f="art" value="'+esc(e.art)+'" placeholder="АРТ-123"></label>'+
'<label>Раздел (выберите или впишите новый)<input data-f="cat" list="catlist" value="'+esc(e.cat)+'"></label><datalist id="catlist">'+DATA.cats.map(function(c){return '<option value="'+esc(c)+'">'}).join("")+'</datalist>'+
'<label>Цена за штуку, сом (пусто — «цена по запросу»)<input type="number" min="0" inputmode="numeric" data-f="price" value="'+esc(e.price)+'"></label>'+
'<label>Размеры через запятую (пусто — без размеров)<input data-f="sizes" value="'+esc(e.sizes)+'" placeholder="56, 62, 68"></label>'+
'<label>Описание<textarea data-f="desc">'+esc(e.desc)+'</textarea></label>'+
'<div class="lbl">Главное фото</div>'+(e.img?'<img class="prev" src="'+esc(e.img)+'" alt="">':"")+'<input type="file" accept="image/*" data-file="main">'+
'<div class="lbl">Цвета (у каждого цвета можно добавить своё фото)</div>'+e.colors.map(function(c,i){return '<div class="crow"><input data-ci="'+i+'" data-cf="name" value="'+esc(c.name)+'" placeholder="Название цвета"><input type="color" data-ci="'+i+'" data-cf="hex" value="'+esc(c.hex||"#cccccc")+'" aria-label="Цвет"><button data-rc="'+i+'" aria-label="Удалить цвет">×</button><label class="fl">Фото этого цвета<input type="file" accept="image/*" data-file="'+i+'"></label>'+(c.img?'<img class="prev sm" src="'+esc(c.img)+'" alt="">':"")+'</div>'}).join("")+
'<button class="btn alt" data-ac>+ Добавить цвет</button><p class="note err" id="en" role="status"></p><button class="btn add" data-save>Сохранить товар</button>'}
const copyNodes=Array.from(document.querySelectorAll(".cover .c1,.cover .c2,.cover .c3,.intro h1,.intro .lead,.feat b,.feat span,.intro h4,.coop h2,.partnership h3,.partnership p,.cols h4,.cols p"));
const defaults=copyNodes.map(n=>n.textContent);
function applyTexts(){
 copyNodes.forEach((node,i)=>{const value=DATA.texts?.[i];node.textContent=typeof value==="string"?value:defaults[i]});
}
function editTexts(){
 const fields=$("textFields");fields.replaceChildren();
 copyNodes.forEach((node,i)=>{
  const label=document.createElement("label"),input=document.createElement("textarea");
  label.textContent=["Обложка — верхняя строка","Обложка — название каталога","Обложка — дополнительная строка (по желанию)"][i]||defaults[i];
  input.value=node.textContent;input.maxLength=2000;label.append(input);fields.append(label);
 });show($("siteTexts"));
}

function clearOwner(){
  session=null;admin=false;ed=null;$('ab').hidden=true;
  for(const d of [de,$('siteTexts'),$('passwordDialog')])if(d.open)d.close();
  if(loaded)render().catch(fail);
}
$('loginForm').onsubmit=async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;$('loginNote').textContent='Вход…';
  try{
    const s=await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email:$('email').value.trim(),password:$('pass').value}});
    const allowed=await rest('admins?select=user_id&user_id=eq.'+encodeURIComponent(s.user.id),{token:s.access_token});
    if(!allowed.length){await call('/auth/v1/logout?scope=local',{method:'POST',token:s.access_token}).catch(()=>{});throw Error('У аккаунта нет прав владельца.')}
    session=s;admin=true;$('ab').hidden=false;$('loginNote').textContent='';$('login').close();await render();$('ab').scrollIntoView();
  }catch(err){$('loginNote').textContent=err.status===400?'Проверьте адрес почты и пароль.':errMsg(err)}
  finally{$('pass').value='';button.disabled=false}
};
$('passwordForm').onsubmit=async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;
  try{
    const s=await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email:session.user.email,password:$('oldPassword').value}});
    session=s;
    await call('/auth/v1/user',{method:'PUT',token:s.access_token,body:{password:$('newPassword').value,current_password:$('oldPassword').value}});
    $('passwordDialog').close();$('abn').textContent='Пароль изменён.';
  }catch(err){$('passNote').textContent=errMsg(err)}finally{button.disabled=false;$('passwordForm').reset()}
};
async function logout(){
  const token=session?.access_token;clearOwner();history.replaceState(null,'',location.pathname+location.search);
  if(token)await call('/auth/v1/logout?scope=local',{method:'POST',token}).catch(()=>{});
}
function resizePhoto(image,maxSide){
  const scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Не удалось обработать фото.')),'image/webp',.84));
}
async function preparePhoto(file,draft,color){
  if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)||file.size>25*1024*1024)throw Error('Выберите фото JPG, PNG, WebP или AVIF до 25 МБ.');
  draft.pending=(draft.pending||0)+1;const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=url;await image.decode();
    const full=await resizePhoto(image,1600),thumb=color?null:await resizePhoto(image,320);
    if(ed!==draft)return;
    const preview=URL.createObjectURL(full);(draft.previews??=[]).push(preview);
    if(color){color.img=preview;color.file=full}else{draft.img=preview;draft.fullFile=full;draft.thumbFile=thumb}
    renderE();
  }finally{draft.pending--;URL.revokeObjectURL(url)}
}
const pathFor=url=>url&&url.startsWith(MEDIA)?url.slice(MEDIA.length):'';
async function upload(blob){
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
  const path='owner/'+hash+'.'+({ 'image/webp':'webp','image/jpeg':'jpg','image/png':'png'}[blob.type]);
  try{await call('/storage/v1/object/ananai-shop/'+path,{method:'POST',token:await ownerToken(),body:blob,raw:true,headers:{'Content-Type':blob.type,'Cache-Control':'31536000'}})}
  catch(err){if(!/already exists|duplicate/i.test(err.message))throw err}
  return path;
}
async function saveProduct(){
  const draft=ed;if(!draft||draft.saving||!admin)return;
  const note=$('en');
  if(draft.pending){note.textContent='Дождитесь обработки фото.';return}
  const name=draft.name.trim(),cat=draft.cat.trim(),price=Number(draft.price);
  if(!name||!cat||!Number.isFinite(price)||price<0){note.textContent='Проверьте название, раздел и цену.';return}
  if(draft.colors.some(c=>!c.name.trim())){note.textContent='Укажите название каждого цвета.';return}
  draft.saving=true;de.querySelector('button[data-save]').disabled=true;note.textContent='Сохранение…';
  try{
    const colors=[];
    for(const c of draft.colors){colors.push({name:c.name.trim(),hex:c.hex,img:c.file?await upload(c.file):pathFor(c.img)})}
    if(new Set(colors.map(c=>c.name)).size!==colors.length)throw Error('Названия цветов должны различаться.');
    const img=draft.fullFile?await upload(draft.fullFile):pathFor(draft.img);
    const thumb=draft.thumbFile?await upload(draft.thumbFile):pathFor(draft.thumb)||img;
    const item={id:draft.id,name,cat,price,art:draft.art.trim(),desc:draft.desc.trim(),img,thumb,colors,
      sizes:[...new Set(draft.sizes.split(/[,;]+/).map(s=>s.trim()).filter(Boolean))].map(s=>String(Number(s))===s?Number(s):s)};
    await write('rpc/ananai_save_item','POST',{item,expected_version:draft.version??null});
    if(ed===draft)de.close();$('abn').textContent='Товар сохранён.';await synchronize(true);
  }catch(err){if(ed===draft)note.textContent=errMsg(err)}
  finally{draft.saving=false;if(ed===draft)de.querySelector('button[data-save]').disabled=false}
}
de.addEventListener('cancel',e=>{if(ed?.saving)e.preventDefault()});
de.addEventListener('close',()=>{for(const url of ed?.previews||[])URL.revokeObjectURL(url);ed=null});
async function removeProduct(id){
  const fresh=await rowsFor([id]);
  if(!fresh.length){await synchronize(true);throw Error('Товар уже удалён.')}
  const m=storeRow(fresh[0]);
  if(!confirm('Удалить «'+m.name+'» ('+pr(m)+')?'))return;
  const rows=await write('ananai_items?id=eq.'+encodeURIComponent(id)+'&version=eq.'+m.version,'DELETE');
  if(!rows.length)throw Error('Товар уже изменён. Обновите каталог.');
  $('abn').textContent='Товар удалён.';await synchronize(true);
}
$('textForm').onsubmit=async e=>{
  e.preventDefault();if(!admin)return;
  const button=e.submitter;button.disabled=true;
  try{
    const texts=Array.from($('textFields').querySelectorAll('textarea'),t=>t.value.trim());
    const rows=await write('ananai_settings?id=eq.true&version=eq.'+editTextVersion,'PATCH',{texts});
    if(!rows.length)throw Error('Тексты уже изменены. Откройте форму снова.');
    $('siteTexts').close();$('abn').textContent='Тексты сохранены.';await synchronize(true);
  }catch(err){$('textNote').textContent=errMsg(err)}finally{button.disabled=false}
};
function download(file){
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function backup(){
  const items=[];
  for(let offset=0;;offset+=250){const rows=await rest('ananai_items?select=*&order=position,id&limit=250&offset='+offset);items.push(...rows);if(rows.length<250)break}
  download(new File([JSON.stringify({version:2,categories:sections.map(({name,position})=>({name,position})),texts:DATA.texts,items},null,2)],'ananai-catalog.json',{type:'application/json'}));
}
function dataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})}
async function imageBlob(url){
  const response=await fetch(url);if(!response.ok)throw Error('Не удалось загрузить фото заказа.');return response.blob();
}
async function receipt(order){
  const lines=await Promise.all(order.lines.map(async l=>({...l,image:await dataURL(await imageBlob(l.image))})));
  download(photoDocument({...order,lines}));$('orderNote').textContent='Файл с фотографиями сохранён.';
}
async function verifiedOrder(){
  if(!$('deliveryForm').reportValidity())return;
  const before=JSON.stringify(cart.map(x=>[x.id,x.q,x.s,x.colorName,byId(x.id)?.version]));
  await syncCart();
  if(before!==JSON.stringify(cart.map(x=>[x.id,x.q,x.s,x.colorName,byId(x.id)?.version]))){
    $('orderNote').textContent='Каталог изменился. Проверьте заказ и подтвердите ещё раз.';return;
  }
  return orderData();
}
$('deliveryForm').onsubmit=async e=>{
  e.preventDefault();if(!cart.length)return;
  try{const o=await verifiedOrder();if(o)location.assign('https://wa.me/'+WA+'?text='+encodeURIComponent(o.message))}
  catch(err){$('orderNote').textContent=errMsg(err)}
};
$('receipt').onclick=async()=>{try{const o=await verifiedOrder();if(o)await receipt(o)}catch(err){$('orderNote').textContent=errMsg(err)}};
$('pictures').onclick=async()=>{
  try{
    const o=await verifiedOrder();if(!o)return;
    if(navigator.canShare){
      const files=await Promise.all(o.lines.map(async(l,i)=>{const b=await imageBlob(l.image);return new File([b],(i+1)+'-Ananai.'+(b.type.split('/')[1]||'jpg'),{type:b.type})}));
      if(navigator.canShare({files})){try{await navigator.share({files,text:o.message,title:'Заказ Ananai'});return}catch(err){if(err.name==='AbortError')return;if(err.name!=='NotAllowedError')throw err}}
    }
    await receipt(o);
  }catch(err){if(err.name!=='AbortError')$('orderNote').textContent=errMsg(err)}
};
$('retryStore').onclick=()=>synchronize(true);
$('catalogSearch').oninput=()=>{clearTimeout(filterTimer);filterTimer=setTimeout(()=>gotoPage(0),180)};
for(const id of ['catalogSort','category'])$(id).onchange=()=>gotoPage(0);
$('clearSearch').onclick=()=>{$('catalogSearch').value='';$('catalogSort').value='default';$('category').value='';gotoPage(0)};
$('next').onclick=()=>gotoPage(page+1,true);$('prev').onclick=()=>gotoPage(Math.max(0,page-1),true);
$('siteBack').onclick=()=>{if(document.referrer && history.length>1){history.back()}else{show($('closedStore'))}};
document.addEventListener('click',async event=>{
  const section=event.target.closest('[data-section]');
  if(section){event.preventDefault();history.pushState(null,'',section.hash);await openHash();return}
  if(event.target.closest('a[href="#admin"]')){event.preventDefault();if(!admin){history.replaceState(null,'','#admin');show($('login'))}else $('ab').scrollIntoView();return}
  if(event.target.matches('dialog')){if(event.target!==de||!ed?.saving)event.target.close();return}
  const button=event.target.closest('button');if(!button)return;const d=button.dataset;
  try{
    if('reopen' in d){$('closedStore').close();window.scrollTo(0,0)}
    else if('open' in d){cur={id:d.open,c:0,s:null,q:1,requestedColor:'Как на фото'};renderM();show(dm)}
    else if('close' in d){const dlg=button.closest('dialog');if(dlg!==de||!ed?.saving)dlg.close();}
    else if('c' in d){cur.c=+d.c;renderM('[data-c="'+d.c+'"]')}
    else if('si' in d){cur.s=byId(cur.id).sizes[+d.si];renderM('[data-si="'+d.si+'"]')}
    else if('q' in d){cur.q=Math.min(99999,Math.max(1,(Number.isFinite(cur.q)?cur.q:1)+Number(d.q)));renderM('[data-q="'+d.q+'"]')}
    else if('add' in d)add();
    else if('cq' in d){cart[+d.cq].q=Math.min(99999,Math.max(1,cart[+d.cq].q+Number(d.d)));upd();renderC()}
    else if('rm' in d){cart.splice(+d.rm,1);upd();renderC()}
    else if('cart' in d){renderC();show(dc)}
    else if(admin){
      if('new' in d)openEdit(null,$('category').value);
      else if('edit' in d)openEdit(d.edit);
      else if('del' in d)await removeProduct(d.del);
      else if('save' in d)await saveProduct();
      else if('ac' in d){ed.colors.push({name:'',hex:'#cccccc',img:''});renderE()}
      else if('rc' in d){ed.colors.splice(+d.rc,1);renderE()}
      else if('copyedit' in d){editTextVersion=settingsVersion;$('textNote').textContent='';editTexts()}
      else if('backup' in d)await backup();
      else if('import' in d)$('backupFile').click();
      else if('pw' in d){$('passNote').textContent='';show($('passwordDialog'))}
      else if('exit' in d)await logout();
    }
  }catch(err){if(admin)$('abn').textContent=errMsg(err);else fail(err)}
});
document.addEventListener('input',e=>{
  const t=e.target,d=t.dataset;
  if(t.id==='qi')cur.q=t.valueAsNumber;
  else if(t.id==='requestedColor')cur.requestedColor=t.value;
  else if(ed && d.f)ed[d.f]=t.value;
  else if(ed && d.cf)ed.colors[Number(d.ci)][d.cf]=t.value;
});
document.addEventListener('change',async e=>{
  const t=e.target,d=t.dataset,draft=ed;if(!draft||!admin||!('file' in d)||!t.files?.[0])return;
  try{await preparePhoto(t.files[0],draft,d.file==='main'?null:draft.colors[Number(d.file)])}
  catch(err){if(ed===draft)$('en').textContent=errMsg(err)}
});
window.addEventListener('hashchange',()=>openHash().catch(fail));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void synchronize()});
window.addEventListener('focus',()=>synchronize());window.addEventListener('online',()=>synchronize(true));
setInterval(()=>{if(!document.hidden)void synchronize()},20000);
$('catalogStatus').textContent='Загружаем каталог…';synchronize(true);

$('backupFile').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file||!admin)return;
  try{
    const input=JSON.parse(await file.text()),d=input.catalog||input;
    if(!Array.isArray(d.items)||!d.items.length||d.items.length>10000)throw Error('Проверьте формат копии.');
    const categories=d.categories||d.cats?.map((name,i)=>({name,position:i+1}));
    if(!Array.isArray(categories))throw Error('В копии отсутствуют разделы.');
    if(!confirm('Импортировать товары ('+d.items.length+')? Совпадающие товары и тексты будут обновлены.'))return;
    const [state]=await rest('ananai_revision?select=revision&id=eq.true');
    const seen=new Map();
    async function restorePhoto(value){
      if(!value)return '';
      if(media(value))return value;
      if(pathFor(value) && media(pathFor(value)))return pathFor(value);
      if(!/^data:image\/(jpeg|png|webp);base64,/.test(value))throw Error('Копия содержит неподдерживаемое изображение.');
      if(!seen.has(value))seen.set(value,await upload(await (await fetch(value)).blob()));
      return seen.get(value);
    }
    const items=[];
    for(const [i,row] of d.items.entries()){
      $('abn').textContent='Подготовка товаров: '+(i+1)+' / '+d.items.length;
      const colors=[];for(const c of row.colors||[])colors.push({name:c.name,hex:c.hex,img:await restorePhoto(c.img)});
      items.push({id:row.id,cat:row.cat,position:row.position??i,name:row.name,art:row.art||'',price:row.price??0,desc:row.desc||'',sizes:row.sizes||[],colors,img:await restorePhoto(row.img),thumb:await restorePhoto(row.thumb)});
    }
    await write('rpc/ananai_restore','POST',{catalog:{items,categories,texts:d.texts},expected_revision:state.revision});
    await synchronize(true);$('abn').textContent='Импортировано товаров: '+items.length;
  }catch(err){$('abn').textContent=errMsg(err)}
};
