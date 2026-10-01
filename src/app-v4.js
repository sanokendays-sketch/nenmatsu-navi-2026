import { buildResult } from './calculations.js';
import { buildFormGuide } from './form-guide.js';
import { QUESTIONS } from './questions.js';
import { baseQuestionId } from './flow.js';
import { commitWizardAnswer } from './wizard-v2.js';
import { contractAnswer, SAME_CONTRACT_HOLDER } from './state.js';
import { questionCopyV3, choiceLabelV3, parseNumberV3 } from './copy-v3.js';
import { FORM_PREVIEW_ASSETS } from './form-preview-v2.js';
import { createIdentityV3, syncIdentityV3, captureIdentityFormV3, validateIdentityV3, attachIdentityToGuideV3, renderIdentityEditorV3 } from './identity-v3.js';
import { buildOfficialOutputV3, renderOfficialPageSvgV3 } from './official-output-v3.js';
import { renderInsuranceSupplement } from './insurance-supplement-v2.js';
import { PAPER_GROUPS_V4, PAPER_TABS_V4, paperZonesV4, groupSequenceV4, groupPendingV4, groupStatusV4, visiblePaperEntryV4, paperPreflightDetailsV4 } from './paper-first-v4.js';
import { serializeDraftV4, readDraftV4 } from './session-v4.js';

const root=document.querySelector('#app');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let answers={},identity=createIdentityV3(),identityDraft=null,tabId='dependentForm',zoneId=null,activeGroup=null,activeQuestion=null,preflightOpen=false,printAcknowledged=false,zoomed=false,saveMessage='';

function guide(){
 const base=buildFormGuide(buildResult(answers));
 // The insurance paper remains selectable before any insurance answer exists.
 if(!base.forms.some(form=>form.id==='insuranceForm'))base.forms.push({id:'insuranceForm',title:'給与所得者の保険料控除申告書',required:false,relevant:false,status:'incomplete',sections:[]});
 return attachIdentityToGuideV3(base,identity,answers);
}
function tab(){return PAPER_TABS_V4.find(x=>x.id===tabId);}
function zone(){return paperZonesV4(tabId).find(x=>x.id===zoneId);}
function paperPage(data){
 const found=buildOfficialOutputV3(data).pages.find(x=>x.id===tabId);
 const asset=FORM_PREVIEW_ASSETS[tab().asset];
 return {...(found||{id:tabId,title:asset.title,asset,entries:[],notes:[]}),entries:(found?.entries||[]).filter(x=>visiblePaperEntryV4(x,answers))};
}
function visibleStatus(id){
 if(id==='identity'){
  const fields=[identity.taxpayer?.name,identity.taxpayer?.address,identity.employer?.name,identity.taxpayer?.kana,identity.employer?.address];
  if(tabId==='dependentForm')fields.push(identity.taxpayer?.postalCode,identity.taxpayer?.birthDate,identity.taxpayer?.householdName,identity.taxpayer?.householdRelationship);
  if(tabId!=='insuranceForm'&&answers.spouse==='はい')fields.push(identity.spouse?.name,identity.spouse?.kana,identity.spouse?.birthDate);
  if(tabId!=='insuranceForm'&&answers.dependents==='はい')for(let i=0;i<Number(answers.depCount||0);i++){
   const person=identity.dependents?.[i];fields.push(person?.name,person?.kana,person?.birthDate,person?.relationship);
  }
  const filled=fields.filter(Boolean).length;
  return filled===fields.length?'complete':filled?'in_progress':'not_started';
 }
 return groupStatusV4(id,answers);
}
function groupBadge(id){
 return {complete:'入力済み',needs_confirmation:'要確認',in_progress:'入力中',not_started:'未入力'}[visibleStatus(id)];
}
function paper(page){
 const current=tab(),zones=paperZonesV4(tabId);
 const markers=zones.map(z=>{
  const [x,y,w,h]=z.mark,a=z.asset,active=zoneId===z.id;
  const status=visibleStatus(z.group);
  return `<button type="button" class="v4-hotspot is-${status} ${active?'is-active':''}" data-zone="${z.id}" aria-label="${esc(z.title)}：${groupBadge(z.group)}。この欄を開く" aria-pressed="${active}" style="left:${x/a.width*100}%;top:${y/a.height*100}%;width:${w/a.width*100}%;height:${h/a.height*100}%"><span>${esc(PAPER_GROUPS_V4[z.group].title)}<strong>${groupBadge(z.group)}</strong></span></button>`;
 }).join('');
 const groups=[...new Set(zones.map(z=>z.group))];
 return `<section class="v4-paper-card card" aria-label="${esc(current.short)}の申告書"><div class="v4-paper-top"><div><p class="eyebrow">令和8年分の実際の用紙</p><h1>${esc(current.short)}</h1><p>色の枠を選ぶと、その欄に必要な質問が開きます。回答は用紙へ反映します。</p></div><a href="${esc(page.asset.pdf)}" target="_blank" rel="noopener">国税庁の用紙PDFを見る</a></div><div class="v4-status-legend" aria-label="枠の色の意味"><span class="is-not_started">未入力</span><span class="is-in_progress">入力中</span><span class="is-complete">入力済み</span><span class="is-needs_confirmation">要確認</span></div><button class="button secondary v4-zoom" data-action="zoom" aria-pressed="${zoomed}">${zoomed?'標準サイズへ戻す':'用紙を大きく見る'}</button><div class="v4-paper-scroll"><div class="v4-paper-canvas ${zoomed?'is-zoomed':''}">${renderOfficialPageSvgV3(page)}${markers}</div></div><p class="v4-small">画像は国税庁の令和8年分空欄様式の表面です。枠・青い文字はこのアプリの記入例です。未入力・未確定の欄は空欄のままです。</p><details class="v4-region-list"><summary>記入欄を一覧から選ぶ</summary><div class="v4-region-buttons">${zones.map(z=>`<button class="button secondary" data-zone="${z.id}">${esc(z.title)} <small>${groupBadge(z.group)}</small></button>`).join('')}</div></details><div class="v4-paper-actions"><button class="button v3-primary" data-action="preflight">この用紙の未記入を確認してPDFにする</button><button class="button secondary" data-action="select-identity">名前・住所を入力</button></div></section>`;
}
function questionControls(id){
 const q=QUESTIONS[baseQuestionId(id)],value=contractAnswer(id,answers);
 const unknown=q.input&&q.input!=='count'?'<button class="button secondary" type="button" data-action="unknown">分からない・後で確認</button>':'';
 if(q.input){
  const unit=q.input==='money'?'円':q.input==='age'?'歳':q.input==='count'?(q.unit==='件数'?'件':q.unit||'人'):'';
  const shown=typeof value==='number'?value.toLocaleString('ja-JP'):value&&value!=='分からない'?value:'';
  const holder=q.reuseHolder?contractAnswer(id.replace(/:[^:]+$/,':holderName'),answers):null;
  const reuse=holder&&holder!=='分からない'?`<button class="button secondary" type="button" data-action="reuse">契約者と同じ（${esc(holder)}）</button>`:'';
  return `<label for="v4-answer">${esc(q.input==='money'?'金額':q.input==='age'?'年末の年齢':q.input==='count'?'件数・人数':q.entryLabel||'入力する内容')}</label><div class="v4-input-row"><input id="v4-answer" name="answer" type="text" ${q.input==='text'?'maxlength="80"':'inputmode="numeric"'} autocomplete="off" value="${esc(shown)}"><span>${esc(unit)}</span></div><button class="button v3-primary" type="submit">反映して次へ</button>${reuse}${unknown}`;
 }
 return `<fieldset><legend>${q.multi?'当てはまるものをすべて選ぶ':'一つ選ぶ'}</legend><div class="v4-choices">${q.choices.map(choice=>`<label class="v4-choice"><input type="${q.multi?'checkbox':'radio'}" name="answer" value="${esc(choice)}" ${q.multi?Array.isArray(value)&&value.includes(choice)?'checked':'':value===choice?'checked':''}><span>${esc(choiceLabelV3(choice))}</span></label>`).join('')}</div></fieldset><button class="button v3-primary" type="submit">反映して次へ</button>`;
}
function editor(){
 const selected=zone(),groupId=selected?.group||activeGroup,location=selected?.title||PAPER_GROUPS_V4[groupId]?.title;
 if(!groupId)return `<section class="card v4-editor"><h2>用紙の記入欄を選んでください</h2><p>左の色の枠をクリックすると、ここに質問が出ます。小さい枠は「記入欄を一覧から選ぶ」からも開けます。</p><p>回答は自動保存・送信されません。続きから使う場合は作業ファイルを保存してください。</p></section>`;
 const group=PAPER_GROUPS_V4[groupId];
 if(groupId==='identity')return `<section class="card v4-editor"><p class="eyebrow">選んだ場所：${esc(location)}</p>${renderIdentityEditorV3(identityDraft||identity,answers,{storageNote:'入力は自動保存・送信されません。「作業ファイルを保存」を押した場合は氏名等もファイルに含まれます。'})}</section>`;
 const sequence=groupSequenceV4(groupId,answers),pending=groupPendingV4(groupId,answers),id=activeQuestion&&sequence.includes(activeQuestion)?activeQuestion:pending;
 const list=sequence.filter(x=>Object.hasOwn(answers,x));
 const review=list.length?`<details class="v4-answers"><summary>この欄の回答を直す（${list.length}件）</summary>${list.map(x=>`<button type="button" class="button tertiary" data-edit="${esc(x)}">${esc(questionCopyV3(x).title)}：${esc(Array.isArray(answers[x])?answers[x].map(choiceLabelV3).join('、'):choiceLabelV3(String(contractAnswer(x,answers))))}</button>`).join('')}</details>`:'';
 if(!id)return `<section class="card v4-editor"><p class="eyebrow">選んだ場所：${esc(location)}</p><h2>${esc(group.title)}の質問は終わりました</h2><p>入力した内容は用紙に反映されています。空欄や「分からない」と答えた箇所はPDF出力前に確認できます。</p>${review}<button class="button secondary" data-action="select-identity">氏名・住所も入力する</button></section>`;
 const copy=questionCopyV3(id);
 return `<section class="card v4-editor"><p class="eyebrow">選んだ場所：${esc(location)}</p><h2>${esc(group.title)}</h2><p class="v4-progress">この欄の ${Math.max(1,sequence.indexOf(id)+1)} 問目</p><form data-question="${esc(id)}" novalidate><h3>${esc(copy.title)}</h3><p>${esc(copy.help)}</p>${copy.example?`<p class="v4-example">例：${esc(copy.example)}</p>`:''}${questionControls(id)}<p class="v3-error" id="v4-error" role="alert" hidden></p></form>${review}</section>`;
}
function preflight(data){
 if(!preflightOpen)return '';
 const items=paperPreflightDetailsV4(tabId,answers,identity,data,paperPage(data));
 return `<section class="card v4-preflight" id="v4-preflight"><h2>PDFにする前の確認</h2><p>この用紙で、まだ確認・記入が必要な箇所です。「この欄へ戻る」で用紙の入力へ移れます。PDFへ進んでも空欄は自動で埋まりません。</p>${items.length?`<ul>${items.map(x=>`<li><span>${esc(x.message)}</span>${x.group?`<button type="button" class="button secondary" data-jump-group="${esc(x.group)}">この欄へ戻る</button>`:''}</li>`).join('')}</ul>`:'<p>現在の回答から追加の確認事項は見つかりませんでした。紙面全体も確認してください。</p>'}<label class="v4-confirm"><input type="checkbox" data-print-ack ${printAcknowledged?'checked':''}><span>空欄と確認事項を見ました。記入例をPDFにします。</span></label><button class="button v3-primary" data-action="print" ${printAcknowledged?'':'disabled'}>この用紙をPDF保存・印刷</button><button class="button tertiary" data-action="close-preflight">用紙に戻る</button><p id="v4-print-error" class="v3-error" role="alert" hidden></p></section>`;
}
function printAnnex(page){
 if(tabId!=='insuranceForm'||!page.supplement?.required)return '';
 const html=renderInsuranceSupplement(page.supplement,true);
 const name=identity.taxpayer.name||'________________________',employer=identity.employer.name||'________________________';
 return html.replace('提出者氏名：________________________　勤務先：________________________',()=>`提出者氏名：${esc(name)}　勤務先：${esc(employer)}`)
  .replace('提出者氏名・勤務先は印刷後に記入してください。','未入力の提出者氏名・勤務先は印刷後に記入してください。');
}
function render(){
 identity=syncIdentityV3(identity,answers);
 const data=guide(),page=paperPage(data);
 root.innerHTML=`<nav class="v4-tabs" aria-label="申告書を選ぶ">${PAPER_TABS_V4.map(t=>`<button type="button" data-tab="${t.id}" class="${tabId===t.id?'is-current':''}" aria-current="${tabId===t.id?'page':'false'}">${esc(t.short)}</button>`).join('')}</nav><section class="v4-savebar" aria-label="作業の保存と再開"><div><strong>途中でやめるとき</strong><p>回答は自動保存しません。保存した作業ファイルには氏名・住所なども含まれます。ご自身だけが使える場所に保管してください。</p></div><button class="button secondary" data-action="save-draft">作業ファイルを保存</button><button class="button secondary" data-action="load-draft">作業ファイルから再開</button><input id="v4-draft-file" type="file" accept=".json,application/json" hidden><p class="v4-save-message" role="status">${esc(saveMessage)}</p></section><div class="v4-layout">${paper(page)}${editor()}</div><div class="v4-bottom"><button class="button secondary" data-action="select-special">そのほかの事情を確認する</button><button class="button tertiary" data-action="reset">回答を最初からやり直す</button><p>住宅ローン控除の用紙は、ご本人へ交付された書類を使用してください。<button class="v4-text-button" data-action="select-housing">住宅ローンの確認へ</button></p></div>${preflight(data)}<div class="v4-print-sheet"><div class="v4-main-sheet">${renderOfficialPageSvgV3(page)}<p>令和8年分の記入例（未完成）／空欄・該当チェックはご自身で確認・記入</p></div>${printAnnex(page)}</div>`;
}
function selectZone(id){zoneId=id;activeGroup=null;activeQuestion=null;preflightOpen=false;printAcknowledged=false;render();root.querySelector('.v4-editor h2')?.focus?.();}
function openGroup(groupId){const z=paperZonesV4(tabId).find(x=>x.group===groupId);if(z)selectZone(z.id);else{zoneId=null;activeGroup=groupId;activeQuestion=null;preflightOpen=false;printAcknowledged=false;render();}}
function showError(message){const el=root.querySelector('#v4-error');if(el){el.hidden=false;el.textContent=message;}root.querySelector('[name="answer"]')?.focus();}
function answer(value){
 const id=root.querySelector('form[data-question]')?.dataset.question;if(!id)return;
 commitWizardAnswer(answers,id,value);
 identity=syncIdentityV3(identity,answers);
 if(identityDraft)identityDraft=syncIdentityV3(identityDraft,answers);
 activeQuestion=null;preflightOpen=false;printAcknowledged=false;saveMessage='変更があります。続きから使う場合は作業ファイルをもう一度保存してください。';render();
}
function saveDraft(){
 if(identityDraft){
  const checked=validateIdentityV3(identityDraft,answers);
  if(!checked.ok){saveMessage=`氏名・住所を保存できません：${checked.errors[0].message}`;render();return;}
  identity=checked.identity;identityDraft=null;
 }
 const file=new Blob([serializeDraftV4(answers,identity,tabId)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(file),link=document.createElement('a');
 link.href=url;link.download='nenmatsu-navi-2026-sagyou.json';document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
 saveMessage='作業ファイルの保存を開始しました。「反映して次へ」を押した回答が保存対象です。保存先を確認してください。';render();
}
async function loadDraft(file){
 if(!file)return;
 try{
  if(file.size>1000000)throw new Error('作業ファイルが大きすぎます。');
  const loaded=readDraftV4(await file.text());
  if((Object.keys(answers).length||Object.values(identity.taxpayer).some(Boolean)||identityDraft)&&!window.confirm('現在の入力を作業ファイルの内容に置き換えますか？'))return;
  answers=loaded.answers;identity=loaded.identity;identityDraft=null;tabId=loaded.tabId;
  zoneId=null;activeGroup=null;activeQuestion=null;preflightOpen=false;printAcknowledged=false;
  saveMessage='作業ファイルを読み込みました。用紙上の内容を確認してから続きを入力してください。';render();
 }catch(error){saveMessage=`読み込めませんでした：${error.message}`;render();}
}
async function printPaper(){
 if(!printAcknowledged)return;
 if(identityDraft){const error=root.querySelector('#v4-print-error');error.hidden=false;error.textContent='名前や住所の変更があります。先に「用紙へ反映する」を押してください。';return;}
 const selectedTab=tabId,imageSource=paperPage(guide()).asset.image,error=root.querySelector('#v4-print-error');
 try{
  await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error('image'));image.src=imageSource;});
  if(document.fonts?.ready)await document.fonts.ready;
  if(tabId!==selectedTab||!preflightOpen||!printAcknowledged)return;
  document.body.classList.add('v4-printing');
  try{window.print();}finally{document.body.classList.remove('v4-printing');}
 }catch{if(error){error.hidden=false;error.textContent='申告書画像を読み込めませんでした。v4フォルダーのformsを確認してください。';}}
}
root.addEventListener('input',event=>{const form=event.target.closest('form[data-identity-form]');if(form){identityDraft=captureIdentityFormV3(form,answers);saveMessage='変更があります。続きから使う場合は作業ファイルをもう一度保存してください。';const message=root.querySelector('.v4-save-message');if(message)message.textContent=saveMessage;}});
root.addEventListener('change',async event=>{
 const input=event.target;
 if(input.matches('#v4-draft-file')){await loadDraft(input.files?.[0]);input.value='';return;}
 if(input.matches('[data-identity-path]')){identityDraft=captureIdentityFormV3(input.closest('form'),answers);input.removeAttribute('aria-invalid');saveMessage='変更があります。続きから使う場合は作業ファイルをもう一度保存してください。';const message=root.querySelector('.v4-save-message');if(message)message.textContent=saveMessage;}
 if(input.matches('[data-print-ack]')){printAcknowledged=input.checked;root.querySelector('[data-action="print"]').disabled=!input.checked;}
 if(input.matches('input[type="checkbox"][name="answer"]')&&input.checked){
  for(const other of root.querySelectorAll('input[type="checkbox"][name="answer"]'))if(other!==input&&(input.value==='どれもない'||other.value==='どれもない'))other.checked=false;
 }
});
root.addEventListener('submit',event=>{
 const form=event.target;if(!form.matches('form[data-question],form[data-identity-form]'))return;
 event.preventDefault();
 if(form.matches('[data-identity-form]')){
  const result=validateIdentityV3(captureIdentityFormV3(form,answers),answers);
  if(!result.ok){const error=root.querySelector('#v3-identity-error');error.hidden=false;error.textContent=result.errors.map(x=>x.message).join(' ');const field=[...form.querySelectorAll('[data-identity-path]')].find(x=>x.dataset.identityPath===result.errors[0].path);field?.setAttribute('aria-invalid','true');field?.focus();return;}
  identity=result.identity;identityDraft=null;saveMessage='変更があります。続きから使う場合は作業ファイルをもう一度保存してください。';render();return;
 }
 const id=form.dataset.question,q=QUESTIONS[baseQuestionId(id)];
 if(q.input==='text'){const value=form.querySelector('[name="answer"]').value.trim();if(!value||value.length>80){showError('証明書の内容を1〜80文字で入力してください。');return;}answer(value);return;}
 if(q.input){const parsed=parseNumberV3(form.querySelector('[name="answer"]').value,q);if(!parsed.ok){showError(parsed.message);return;}answer(parsed.value);return;}
 const selected=[...form.querySelectorAll('[name="answer"]:checked')].map(x=>x.value);
 if(!selected.length){showError('当てはまるものを選んでください。');return;}
 answer(q.multi?selected:selected[0]);
});
root.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.tab){tabId=button.dataset.tab;zoneId=null;activeGroup=null;activeQuestion=null;preflightOpen=false;printAcknowledged=false;render();return;}
 if(button.dataset.zone){selectZone(button.dataset.zone);return;}
 if(button.dataset.jumpGroup){
  const groupId=button.dataset.jumpGroup;
  if(!paperZonesV4(tabId).some(z=>z.group===groupId)){
   const destination=PAPER_TABS_V4.find(item=>paperZonesV4(item.id).some(z=>z.group===groupId));
   if(destination)tabId=destination.id;
  }
  openGroup(groupId);root.querySelector('.v4-editor')?.scrollIntoView({block:'start',behavior:'smooth'});return;
 }
 if(button.dataset.edit){activeQuestion=button.dataset.edit;render();return;}
 const action=button.dataset.action;
 if(action==='unknown')answer('分からない');
 if(action==='reuse')answer(SAME_CONTRACT_HOLDER);
 if(action==='zoom'){zoomed=!zoomed;root.querySelector('.v4-paper-canvas')?.classList.toggle('is-zoomed',zoomed);button.textContent=zoomed?'標準サイズへ戻す':'用紙を大きく見る';button.setAttribute('aria-pressed',String(zoomed));}
 if(action==='select-identity')openGroup('identity');
 if(action==='select-special'){tabId='dependentForm';openGroup('special');}
 if(action==='select-housing'){tabId='combinedForm';openGroup('housing');}
 if(action==='preflight'){preflightOpen=true;printAcknowledged=false;render();root.querySelector('#v4-preflight')?.scrollIntoView({block:'start',behavior:'smooth'});}
 if(action==='close-preflight'){preflightOpen=false;printAcknowledged=false;render();}
 if(action==='print')printPaper();
 if(action==='save-draft')saveDraft();
 if(action==='load-draft')root.querySelector('#v4-draft-file')?.click();
 if(action==='clear-identity'&&window.confirm('氏名・住所等の入力を消しますか？税の回答は残します。')){identity=createIdentityV3();identityDraft=null;saveMessage='氏名・住所を消しました。保存済みの作業ファイルには反映されません。';render();}
 if(action==='reset'&&window.confirm('入力した回答と氏名等をすべて消しますか？')){answers={};identity=createIdentityV3();identityDraft=null;zoneId=null;activeGroup=null;activeQuestion=null;preflightOpen=false;printAcknowledged=false;saveMessage='画面の入力を消しました。保存済みの作業ファイルは端末から別途削除してください。';render();}
});
render();
