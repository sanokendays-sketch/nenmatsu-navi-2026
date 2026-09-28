import { baseQuestionId } from './flow.js';
import { buildResult } from './calculations.js';
import { buildFormGuide } from './form-guide.js';
import { WIZARD_PAGES, traceWizard, commitWizardAnswer, pageProgress, questionGuide } from './wizard-v2.js';
import { formPreviewForQuestion, formPreviewsForGuideSection, renderFormPreviewSvg } from './form-preview-v2.js';
import { contractAnswer, SAME_CONTRACT_HOLDER } from './state.js';
import { renderInsuranceSupplement } from './insurance-supplement-v2.js';

const root=document.querySelector('#app');
let answers={}, currentPage=0, started=false, editingId=null, multiDraft={}, checked={}, openMapId=null, expandedImages={}, hiddenValues={};
let annexExpanded=false;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const human=value=>Array.isArray(value)?value.join('、'):typeof value==='number'?`${value.toLocaleString('ja-JP')}`:String(value);
const statusText={calculated:'計算できました',not_applicable:'今回は対象外です',needs_confirmation:'会社担当者へ確認してください',incomplete:'用紙に記入してください'};
function questionTitle(id,q){
 if(id.startsWith('dep:'))return `${id.split(':')[1]}人目の家族：${q.text}`;
 if(id.startsWith('life:'))return `${id.split(':')[1]}件目の生命保険：${q.text}`;
 if(id.startsWith('earthquake:'))return `${id.split(':')[1]}件目の地震保険：${q.text}`;
 if(id.startsWith('disability:'))return `${id.split(':')[1]==='spouse'?'配偶者':`${id.split(':')[2]}人目の家族`}：${q.text}`;
 return q.text;
}
function renderHome(){
 root.innerHTML=`<article class="card v2-home"><div class="eyebrow">令和8年分 · バージョン2</div><h1>書類を見ながら、ページごとに入力</h1><p>国税庁の年末調整計算シートと申告書の入力項目に沿って、必要な質問だけを表示します。質問と同時に、対応する令和8年分申告書の実際の欄を示します。黄色は記入候補、青色は判定に関連する欄です。</p><ol class="v2-home-steps">${WIZARD_PAGES.map(p=>`<li>${esc(p.title)}</li>`).join('')}</ol><div class="notice">判定のための質問は回答をそのまま申告書へ書きません。保険契約の契約者・受取人等の氏名は、記入例を作るために入力できます。住所・マイナンバーは集めません。回答は保存・送信されず、計算シートへの自動転記も行いません。</div><button class="button v2-primary" data-action="start">入力をはじめる</button></article>`;
}
function questionControls(item){
 const {id,question:q}=item;
 if(q.input==='text'){
  const holder=contractAnswer(id.replace(/:[^:]+$/,':holderName'),answers);
  const reuse=q.reuseHolder&&typeof holder==='string'&&holder!=='分からない'&&holder.trim();
  return `<form class="v2-input-form" data-text-route="${esc(id)}"><label>${esc(q.text)}<input type="text" maxlength="80" value="${item.value===undefined||item.value==='分からない'?'':esc(contractAnswer(id,answers)||'')}" autocomplete="off" required></label><button class="button" type="submit">この回答を確定</button>${reuse?`<button class="button secondary" type="button" data-reuse-holder="${esc(id)}">契約者と同じ（${esc(holder)}）</button>`:''}<button class="button secondary" type="button" data-unknown="${esc(id)}">分からない・後で確認</button><p class="v2-error" role="alert" hidden></p></form>`;
 }
 if(q.input){const min=q.input==='count'?1:0,max=q.input==='count'?(q.max??10):q.input==='age'?120:999999999;return `<form class="v2-input-form" data-number-route="${esc(id)}"><label>${q.input==='money'?'金額（円）':q.input==='age'?'年齢':q.unit||'人数'}<input type="number" inputmode="numeric" min="${min}" max="${max}" step="1" value="${typeof item.value==='number'?esc(item.value):''}" required></label><button class="button" type="submit">この回答を確定</button>${q.input!=='count'?`<button class="button secondary" type="button" data-unknown="${esc(id)}">${q.input==='age'?'年齢が分からない':'金額が分からない'}</button>`:''}<p class="v2-error" role="alert" hidden></p></form>`;}
 if(q.multi){const selected=multiDraft[id]||(Array.isArray(item.value)?item.value:[]);return `<div class="v2-options">${q.choices.map(choice=>`<button class="button secondary" data-multi-route="${esc(id)}" data-multi-value="${esc(choice)}" aria-pressed="${selected.includes(choice)}">${selected.includes(choice)?'✓ ':''}${esc(choice)}</button>`).join('')}</div><button class="button v2-confirm" data-confirm-multi="${esc(id)}">選択を確定</button><p class="v2-error" role="alert" hidden></p>`;}
 return `<div class="v2-options" role="group" aria-label="回答">${q.choices.map(choice=>`<button class="button secondary" data-choice-route="${esc(id)}" data-choice-value="${esc(choice)}">${esc(choice)}</button>`).join('')}</div>`;
}
function questionCard(item,activeId){
 const {id,question:q,answered}=item,open=!answered||editingId===id,guide=questionGuide(id),active=id===activeId;
 return `<section class="v2-question ${open?'v2-question-open':'v2-question-done'} ${active?'v2-focused':''}"><div class="v2-question-head"><div><p class="v2-small">${active?'★ 表示中の申告書で確認':answered?'回答済み':'入力する質問'}</p><h3>${esc(questionTitle(id,q))}</h3></div>${answered&&!open?`<button class="button tertiary" data-edit="${esc(id)}">変更</button>`:''}</div>${answered&&!open?`<p class="v2-answer">${esc(human(contractAnswer(id,answers)))}</p>`:`${q.hint?`<p class="hint">${esc(q.hint)}</p>`:''}<div class="v2-guide"><div><strong>見る資料</strong><span>${esc(guide.source)}</span></div><div><strong>入力する内容</strong><span>${esc(guide.input)}</span></div><div><strong>記入先の目安</strong><span>${esc(guide.destination)}</span></div></div>${questionControls(item)}`}</section>`;
}
function paperImage(area,showValues=true){return renderFormPreviewSvg(area,showValues);}
function previewPanel(item){
 const preview=formPreviewForQuestion(item.id,answers),entered=item.answered?esc(human(contractAnswer(item.id,answers)))+(item.question.input==='money'&&typeof item.value==='number'?'円':''):null;
 return `<aside class="v2-paper-panel" aria-label="現在の質問に対応する申告書の記入欄"><div class="eyebrow">今、どの欄を確認していますか？</div><h2>${esc(preview.section)}</h2><p class="v2-paper-question">${esc(questionTitle(item.id,item.question))}</p><p class="v2-paper-mode ${preview.directEntry?'v2-direct':'v2-decision'}">${preview.directEntry?'★ 黄色の枠が記入候補の欄です':preview.mark?'◇ 青色の枠は判定に関連する欄です。回答をそのまま転記しません':'◇ この質問に共通の記入欄はありません。回答をそのまま転記しません'}</p>${preview.note?`<p class="notice">${esc(preview.note)}</p>`:''}<div class="v2-paper-frame">${paperImage({...preview,title:preview.section})}</div><p class="v2-paper-caption">${preview.asset.kind==='blank'?'国税庁 令和8年分の空欄様式':'国税庁 令和8年分の記載例'}から表示。${preview.mark?'枠はアプリが示す確認範囲です。':''}</p><details class="v2-zoom"><summary>欄を拡大して読む</summary><div class="v2-zoom-frame">${paperImage({...preview,title:preview.section})}</div></details><div class="v2-paper-example"><h3>記入例（架空の内容）</h3><p>${esc(preview.example)}</p>${entered?`<p><strong>あなたの回答：</strong>${entered}</p>`:''}</div>${preview.secondary?`<details class="v2-related-paper"><summary>関連するもう一つの欄を見る</summary><h3>${esc(preview.secondary.title)}</h3>${paperImage(preview.secondary)}<p>${esc(preview.secondary.example)}</p><p>両方の欄の要件を結果画面で確認してください。</p></details>`:''}<a class="v2-paper-link" href="${esc(preview.asset.pdf)}" target="_blank" rel="noopener">この申告書の全体を見る（PDF）</a></aside>`;
}
function progressNav(trace){const progress=pageProgress(trace);return `<nav class="v2-progress" aria-label="入力ページ">${WIZARD_PAGES.map((p,i)=>`<button type="button" data-page="${i}" class="v2-page-link ${i===currentPage?'is-current':''}" ${progress[i].status==='locked'?'disabled':''} aria-current="${i===currentPage?'step':'false'}"><span>${String(i+1).padStart(2,'0')}</span>${esc(p.title)}${progress[i].status==='done'?' ✓':''}</button>`).join('')}</nav>`;}
function renderPage(){
 const trace=traceWizard(answers);
 if(trace.terminal==='end'){root.innerHTML=`<article class="card"><div class="eyebrow">対象確認</div><h1>この会社での年末調整について確認してください</h1><p>「この会社で年末調整を受けない」と回答しました。勤務先または税務署の案内をご確認ください。</p><button class="button secondary" data-action="restart">最初からやり直す</button></article>`;return;}
 if(trace.terminal==='result'&&currentPage>=WIZARD_PAGES.length){renderResult();return;}
 const pending=trace.pending?WIZARD_PAGES.findIndex(p=>p.id===trace.items.at(-1).page):WIZARD_PAGES.length;
 if(currentPage>pending)currentPage=pending;
 const page=WIZARD_PAGES[currentPage],items=trace.items.filter(x=>x.page===page.id);
 const activeItem=items.find(x=>x.id===editingId)||items.find(x=>!x.answered)||items.at(-1);
 const activePreview=activeItem?formPreviewForQuestion(activeItem.id,answers):null;
 const complete=items.length>0&&items.every(x=>x.answered);
 const contractPattern=/^(life|earthquake):\d+:/;
 const contractPrefix=(activeItem?.id.match(contractPattern)||items.findLast(item=>contractPattern.test(item.id))?.id.match(contractPattern))?.[0];
 const otherContracts=new Map();
 if(contractPrefix)for(const item of items){const prefix=item.id.match(/^(life|earthquake):\d+:/)?.[0];if(prefix&&prefix!==contractPrefix&&!otherContracts.has(prefix))otherContracts.set(prefix,item);}
 const shownItems=contractPrefix?items.filter(item=>!item.id.match(/^(life|earthquake):\d+:/)||item.id.startsWith(contractPrefix)):items;
 const contractSummary=otherContracts.size?'<section class="v2-contract-summary"><h3>ほかの入力済み契約</h3><p>変更したい契約を選ぶと、その契約の質問を表示します。</p>'+[...otherContracts.values()].map(item=>{const p=item.id.replace(/:[^:]+$/,':');return '<button class="button secondary" data-edit="'+esc(item.id)+'">'+p.split(':')[1]+'件目：'+esc([answers[p+'companyName'],answers[p+'type'],typeof answers[p+'amount']==='number'?human(answers[p+'amount'])+'円':null].filter(Boolean).join('／')||'入力途中')+'</button>';}).join('')+'</section>':'';
 root.innerHTML=`<div class="v2-layout">${progressNav(trace)}<main class="v2-main"><article class="card v2-page"><div class="eyebrow">ページ ${currentPage+1} / ${WIZARD_PAGES.length}</div><h1>${esc(page.title)}</h1><p class="v2-lead">${esc(page.lead)}</p>${activePreview?`<p class="v2-current-topic">今見ている欄：<strong>${esc(activePreview.section)}</strong><span>${activePreview.directEntry?'記入候補':'判定用'}</span></p>`:''}<div class="v2-source"><span>準備する資料：${esc(page.source)}</span><a href="${esc(page.official)}" target="_blank" rel="noopener">国税庁の記載例を開く</a></div><div class="v2-destination"><strong>このページの入力先</strong><p>${esc(page.destination)}</p></div>${items.length?shownItems.map(item=>questionCard(item,activeItem?.id)).join(''):`<p class="notice">このページの追加質問はありません。</p>`}${contractSummary}<div class="v2-nav"><button class="button secondary" data-action="previous" ${currentPage===0?'disabled':''}>前のページ</button>${complete?`<button class="button" data-action="next">${currentPage===WIZARD_PAGES.length-1?'結果を見る':'次のページ'}</button>`:`<span class="v2-help">表示された質問に回答すると、次へ進めます。</span>`}</div></article>${activeItem?previewPanel(activeItem):''}</main></div>`;
}
function renderResult(){
 const result=buildResult(answers),guide=buildFormGuide(result);
 const field=f=>{
  const value=f.value==null?f.status==='incomplete'?'ご自身で記入':f.status==='not_applicable'?'今回は対象外':'要確認':f.value;
  return `<div class="v2-field v2-field-${esc(f.status)}"><span>${esc(f.label)}</span><strong>${esc(value)}</strong><small>${esc(statusText[f.status]||statusText.needs_confirmation)}</small>${f.note?`<p>${esc(f.note)}</p>`:''}</div>`;
 };
 const visibleFields=s=>s.fields.filter(f=>f.status!=='not_applicable');
 const contractDetails=s=>(s.contracts||[]).map(c=>`<section class="v2-contract-detail"><h5>${c.index}件目の契約：${esc(c.category||'区分は要確認')}</h5><p class="v2-placement">${esc(c.placement.label)}</p><p>${esc(statusText[c.status]||statusText.needs_confirmation)}</p>${c.fields.filter(f=>f.status!=='not_applicable').map(field).join('')}</section>`).join('');
 const mapImage=area=>{
  const key=area.viewKey,expanded=Boolean(expandedImages[key]),shown=!hiddenValues[key],hasValues=area.overlays.length>0,hasText=area.overlays.some(e=>e.valueKind==='text');
  return `<figure class="v2-map-image"><figcaption>${esc(area.title)}</figcaption><div class="v2-map-image-actions">${hasValues?`<button type="button" class="button secondary" data-toggle-values="${esc(key)}" aria-pressed="${shown}">${hasText?(shown?'記入内容を隠す':'あなたの記入内容を表示'):(shown?'金額を隠す':'あなたの金額を表示')}</button>`:''}<button type="button" class="button secondary" data-expand-image="${esc(key)}" aria-expanded="${expanded}">${expanded?'標準サイズに戻す':'この欄を大きく見る'}</button></div><div class="v2-paper-frame v2-map-image-scroll ${expanded?'is-expanded':''}">${paperImage(area,shown)}</div><p class="v2-paper-caption">${area.asset.kind==='blank'?'国税庁の令和8年分空欄様式':'国税庁の令和8年分記載例'}。${area.mark?`${area.directEntry?'黄色':'青色'}の枠はアプリが示す確認範囲です。`:''}</p>${hasValues?'<p class="v2-map-value-note">青字はあなたの回答・計算結果から作った記入候補です（名称・氏名・金額。金額は円単位）。「要確認」は転記前に会社担当者へ確認してください。</p>':area.example?`<p class="v2-map-hint">${esc(area.example)}</p>`:''}${area.note?`<p class="v2-map-hint">${esc(area.note)}</p>`:''}<a class="v2-paper-link" href="${esc(area.asset.pdf)}" target="_blank" rel="noopener">${area.asset.kind==='blank'?'空欄の申告書全体を見る（PDF）':'国税庁の記載例全体を見る（PDF）'}</a></figure>`;
 };
 const map=form=>`<div class="v2-form-map" id="v2-map-${esc(form.id)}"><p>回答に対応する令和8年分申告書の実際の欄へ、確認できた金額を重ねた記入例です。元の国税庁PDFは変更していません。住宅ローンは国税庁の記載例です。</p>${form.sections.filter(s=>visibleFields(s).length).map(s=>`<div class="v2-form-map-section"><h4>${esc(s.title)}</h4>${formPreviewsForGuideSection(form.id,s).map(area=>mapImage({...area,viewKey:`${form.id}:${s.id}:${area.id}`})).join('')}</div>`).join('')}</div>`;
 const card=form=>`<section class="v2-result-card ${form.supplement?.required?'has-supplement':''}" id="v2-form-${esc(form.id)}"><h3>${esc(form.title)}</h3><p class="v2-form-status">${esc(statusText[form.status]||statusText.needs_confirmation)}</p>${form.notice?`<p class="notice">${esc(form.notice)}</p>`:''}${form.sections.filter(s=>visibleFields(s).length).map(s=>`<div class="v2-result-section"><h4>${esc(s.title)}</h4>${visibleFields(s).map(field).join('')}${contractDetails(s)}</div>`).join('')}<button type="button" class="button v2-map-open" data-map="${esc(form.id)}" aria-controls="v2-map-${esc(form.id)}" aria-expanded="${openMapId===form.id}">${openMapId===form.id?'記入例を閉じる':'記入場所を見る（金額入り）'}</button>${openMapId===form.id?map(form):''}${renderInsuranceSupplement(form.supplement,annexExpanded)}</section>`;
 root.innerHTML=`<article class="card v2-results"><div class="eyebrow">バージョン2 · 入力結果</div><p class="v2-print-heading">令和8年分 年末調整おたすけナビ v2</p><h1>申告書へ記入する内容</h1><p>申告書ごとに、回答から分かった記入内容と金額を表示しています。支払額と計算後の控除額は別の行です。要確認の金額は転記せず、会社担当者へ確認してください。</p><div class="v2-print-actions"><button class="button" type="button" data-action="print">PDFとして保存</button><p>印刷画面で保存先を「PDFとして保存」にしてください。記入内容・必要書類・確認事項をA4の記入ガイドとして保存できます。</p></div><p class="v2-print-note">これは記入用の案内です。公式申告書そのものではありません。要確認の項目は転記前に会社担当者へ確認してください。</p><section><h2>① あなたが記入する書類</h2>${guide.forms.map(f=>`<a class="v2-form-name" href="#v2-form-${esc(f.id)}">${esc(f.title)}<span>記入内容へ ↓</span></a>`).join('')}</section><section class="v2-entry-content"><h2>② 記入する内容・金額</h2>${guide.forms.map(card).join('')}</section><section><h2>③ 用意する書類・証明書</h2>${guide.requiredDocuments.length?`<ul>${guide.requiredDocuments.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>回答から追加で必要になった証明書はありません。</p>'}</section><section><h2>④ 会社担当者へ確認すること</h2>${guide.staffConfirmations.length?`<ul>${guide.staffConfirmations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>回答から追加の確認事項はありません。</p>'}</section><section><h2>⑤ 提出前チェック</h2>${guide.submissionChecklist.map((x,i)=>`<label class="v2-check"><input type="checkbox" data-check="${i}" ${checked[i]?'checked':''}>${esc(x)}</label>`).join('')}</section><div class="v2-nav"><button class="button secondary" data-action="previous">前のページへ戻る</button><button class="button secondary" data-action="restart">最初からやり直す</button></div></article>`;
}
function render(){if(!started)renderHome();else renderPage();}
function refreshResult(){const top=window.scrollY;renderResult();if(Number.isFinite(top))window.scrollTo?.(0,top);}
function answer(id,value){commitWizardAnswer(answers,id,value);editingId=null;openMapId=null;expandedImages={};hiddenValues={};delete multiDraft[id];render();}
root.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.action==='start'){started=true;render();return;}
 if(b.dataset.action==='restart'){if(window.confirm('入力内容をすべて消して、最初からやり直しますか？')){answers={};currentPage=0;editingId=null;multiDraft={};checked={};openMapId=null;expandedImages={};hiddenValues={};started=false;render();}return;}
 if(b.dataset.action==='previous'){currentPage=Math.max(0,currentPage-1);editingId=null;render();return;}
 if(b.dataset.action==='next'){currentPage=Math.min(WIZARD_PAGES.length,currentPage+1);editingId=null;render();return;}
 if(b.dataset.action==='print'){window.print();return;}
 if(b.dataset.action==='toggle-annex'){annexExpanded=!annexExpanded;refreshResult();return;}
 if(b.dataset.action==='print-annex'){
  if(!buildFormGuide(buildResult(answers)).forms.some(f=>f.supplement?.required))return;
  root.classList.add('v2-annex-only');
  try{window.print();}finally{root.classList.remove('v2-annex-only');}
  return;
 }
 if(b.dataset.page!==undefined){const page=Number(b.dataset.page),p=pageProgress(traceWizard(answers));if(p[page]?.status!=='locked'){currentPage=page;editingId=null;render();}return;}
 if(b.dataset.edit!==undefined){editingId=b.dataset.edit;render();return;}
 if(b.dataset.map!==undefined){openMapId=openMapId===b.dataset.map?null:b.dataset.map;refreshResult();return;}
 if(b.dataset.toggleValues!==undefined){const key=b.dataset.toggleValues;hiddenValues[key]=!hiddenValues[key];refreshResult();return;}
 if(b.dataset.expandImage!==undefined){const key=b.dataset.expandImage;expandedImages[key]=!expandedImages[key];refreshResult();return;}
 if(b.dataset.choiceRoute!==undefined){answer(b.dataset.choiceRoute,b.dataset.choiceValue);return;}
 if(b.dataset.unknown!==undefined){answer(b.dataset.unknown,'分からない');return;}
 if(b.dataset.reuseHolder!==undefined){answer(b.dataset.reuseHolder,SAME_CONTRACT_HOLDER);return;}
 if(b.dataset.multiRoute!==undefined){const id=b.dataset.multiRoute,value=b.dataset.multiValue,selected=multiDraft[id]||(Array.isArray(answers[id])?[...answers[id]]:[]);if(value==='どれもない')multiDraft[id]=selected.includes(value)?[]:[value];else multiDraft[id]=selected.includes(value)?selected.filter(x=>x!==value):[...selected.filter(x=>x!=='どれもない'),value];render();return;}
 if(b.dataset.confirmMulti!==undefined){const id=b.dataset.confirmMulti,list=multiDraft[id]||answers[id]||[];if(!list.length){const error=b.parentElement.querySelector('.v2-error');if(error){error.hidden=false;error.textContent='該当する項目を選んでください。';}return;}answer(id,list);}
});
root.addEventListener('submit',event=>{
 const textForm=event.target.closest('form[data-text-route]');
 if(textForm?.dataset.textRoute!==undefined){event.preventDefault();const value=textForm.querySelector('input').value.trim();if(!value||value.length>80){const error=textForm.querySelector('.v2-error');error.hidden=false;error.textContent='1～80文字で入力してください。';return;}answer(textForm.dataset.textRoute,value);return;}
 const form=event.target.closest('form[data-number-route]');if(!form)return;event.preventDefault();const input=form.querySelector('input'),value=Number(input.value),min=Number(input.min),max=Number(input.max);
 if(input.value===''||!Number.isInteger(value)||value<min||value>max){const error=form.querySelector('.v2-error');error.hidden=false;error.textContent=`${min}～${max}の整数を入力してください。`;return;}
 answer(form.dataset.numberRoute,value);
});
root.addEventListener('change',event=>{if(event.target.matches('[data-check]'))checked[event.target.dataset.check]=event.target.checked;});
render();
