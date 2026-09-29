import { buildResult } from './calculations.js';
import { buildFormGuide } from './form-guide.js';
import { traceWizard, questionGuide } from './wizard-v2.js';
import { formPreviewForQuestion, formPreviewsForGuideSection, renderFormPreviewSvg } from './form-preview-v2.js';
import { contractAnswer, SAME_CONTRACT_HOLDER } from './state.js';
import { renderInsuranceSupplement } from './insurance-supplement-v2.js';
import { CHAPTERS_V3, GLOSSARY_V3, choiceLabelV3, questionCopyV3, parseNumberV3, fieldPurposeV3 } from './copy-v3.js';
import { createJourneyV3, currentItemV3, startJourneyV3, editAnswerV3, submitAnswerV3, continueJourneyV3, backJourneyV3 } from './journey-v3.js';
import { buildOfficialOutputV3, renderOfficialPageSvgV3 } from './official-output-v3.js';
import { createIdentityV3, syncIdentityV3, captureIdentityFormV3, validateIdentityV3, attachIdentityToGuideV3, renderIdentityEditorV3 } from './identity-v3.js';

const root=document.querySelector('#app');
const v2Url=document.body.dataset.v2Url||'../v2/index.html';
let journey=createJourneyV3(),checked={},annexExpanded=false,expandedImages={},hiddenValues={},identity=createIdentityV3(),identityDraft=null;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const human=value=>Array.isArray(value)?value.map(choiceLabelV3).join('、'):typeof value==='number'?value.toLocaleString('ja-JP'):choiceLabelV3(String(value??''));
const statusText={calculated:'計算できました',not_applicable:'今回は対象外です',needs_confirmation:'会社担当者へ確認してください',incomplete:'用紙にご自身で記入してください'};

function currentGuide(){return attachIdentityToGuideV3(buildFormGuide(buildResult(journey.answers)),identity,journey.answers);}
function namedSupplement(supplement,expanded){
 const html=renderInsuranceSupplement(supplement,expanded);
 const name=identity.taxpayer.name||'________________________',employer=identity.employer.name||'________________________';
 return html.replace('提出者氏名：________________________　勤務先：________________________',()=>`提出者氏名：${esc(name)}　勤務先：${esc(employer)}`);
}
function glossary(){return `<details class="v3-glossary"><summary>言葉が分からないとき</summary><dl>${GLOSSARY_V3.map(([word,meaning])=>`<dt>${esc(word)}</dt><dd>${esc(meaning)}</dd>`).join('')}</dl></details>`;}
function renderHome(){
 root.innerHTML=`<article class="card v3-home"><p class="eyebrow">令和8年・2026年分 ／ やさしい記入ナビ v3</p><h1 tabindex="-1">質問に答えて、<br>書類に書く内容を整理しよう</h1><p class="v3-lead">難しい計算はナビが手伝います。<br>分からないことは、あとで会社に確認できます。</p><button class="button v3-primary" data-action="start">一つずつ質問に答える</button><ol class="v3-three-steps"><li><strong>答える</strong><span>書類を見ながら、一問ずつ</span></li><li><strong>書き写す</strong><span>あなたの金額と、書く場所を確認</span></li><li><strong>提出する</strong><span>証明書をそろえて、会社へ</span></li></ol><details class="v3-preparation" open><summary>手元にあると便利なもの</summary><ul><li>会社から配られた申告書</li><li>今年の給与明細（転職した方は前の会社の源泉徴収票も）</li><li>保険やiDeCoなどの証明書（ある方だけ）</li></ul><p>今そろっていなくても始められます。画面を閉じると回答は消えるので、最後に記入ガイドをPDF保存してください。</p></details>${glossary()}<p class="v3-footnote">作るのは書類に書くための案内です。会社の用紙への記入と提出は、あなたが行います。</p><a href="${esc(v2Url)}">前のバージョン（v2）を開く</a></article>`;
}
function progress(chapter){
 const index=CHAPTERS_V3.findIndex(c=>c.id===chapter.id);
 return `<div class="v3-progress"><p>いま：${index+1} / ${CHAPTERS_V3.length}　<strong>${esc(chapter.title)}</strong></p><progress max="${CHAPTERS_V3.length}" value="${index}" aria-label="完了したまとまり">${index}</progress><details><summary>全体の流れを見る</summary><ol>${CHAPTERS_V3.map((c,i)=>`<li ${i===index?'aria-current="step"':''}>${esc(c.title)}${i===index?'（いまここ）':''}</li>`).join('')}</ol></details></div>`;
}
function reviewList(items){return `<dl class="v3-review-list">${items.map(item=>{const copy=questionCopyV3(item.id);return `<div><dt>${copy.who?`${esc(copy.who)}：`:''}${esc(copy.title)}</dt><dd><strong>${esc(human(contractAnswer(item.id,journey.answers)))}${item.question.input==='money'&&typeof item.value==='number'?'円':item.question.input==='age'&&typeof item.value==='number'?'歳':''}</strong><button class="button tertiary" data-edit="${esc(item.id)}">この回答を変える</button></dd></div>`;}).join('')}</dl>`;}
function history(trace){return `<details class="v3-history"><summary>回答を見直す（${trace.items.filter(i=>i.answered).length}問回答済み）</summary>${reviewList(trace.items.filter(i=>i.answered))}</details>`;}
function controls(item,copy){
 const q=item.question,value=contractAnswer(item.id,journey.answers),id='v3-answer';
 const unknown=q.input&&q.input!=='count'?'<button type="button" class="button secondary v3-unknown" data-action="unknown">分からない・あとで確認して進む</button>':'';
 if(q.input){
  const unit=q.input==='money'?'円':q.input==='age'?'歳':q.input==='count'?(q.unit==='件数'?'件':q.unit||'人'):'';
  const holder=q.reuseHolder?contractAnswer(item.id.replace(/:[^:]+$/,':holderName'),journey.answers):null;
  const reuse=typeof holder==='string'&&holder.trim()&&holder!=='分からない';
  const display=typeof value==='number'?value.toLocaleString('ja-JP'):value&&value!=='分からない'?value:'';
  return `<label for="${id}">${q.input==='text'?esc(q.entryLabel||'書類に書く内容'):q.input==='money'?'金額（円）':q.input==='age'?'年末の年齢（歳）':`数（${esc(unit)}）`}</label><p id="v3-format" class="v3-format">${q.input==='text'?'証明書などの文字を、そのまま入力します。':q.input==='money'?'円で入力します。カンマ・全角数字も使えます。':q.input==='age'?'年末時点の年齢を、数字で入力します。':'これから入力する数を、数字で入力します。'}</p><div class="v3-input-with-unit"><input id="${id}" name="answer" type="text" ${q.input!=='text'?'inputmode="numeric"':'maxlength="80"'} aria-describedby="v3-help v3-example v3-format v3-error" autocomplete="off" value="${esc(display)}"><span>${esc(unit)}</span></div><button class="button v3-primary" type="submit">この回答で次へ</button>${reuse?`<button class="button secondary" type="button" data-action="reuse">契約者と同じ（${esc(holder)}）</button>`:''}${unknown}`;
 }
 return `<fieldset><legend class="v3-control-legend">${q.multi?'当てはまるものをすべて選ぶ':'一つ選ぶ'}</legend><div class="v3-choices">${q.choices.map((choice,i)=>`<label class="v3-choice"><input type="${q.multi?'checkbox':'radio'}" name="answer" value="${esc(choice)}" ${q.multi?Array.isArray(value)&&value.includes(choice)?'checked':'':value===choice?'checked':''} aria-describedby="v3-help v3-error"><span>${esc(choiceLabelV3(choice))}</span></label>`).join('')}</div></fieldset><button class="button v3-primary" type="submit">この回答で次へ</button>`;
}
function previewPanel(item){
 const preview=formPreviewForQuestion(item.id,journey.answers);
 return `<aside class="v3-paper card" aria-label="用紙の書く場所"><p class="eyebrow">用紙で見ると、ここ</p><h2>${esc(preview.section)}</h2><p class="v3-paper-mode">${preview.directEntry?'黄色の枠は、この入力に対応する欄です。最後に書く内容をまとめて確認できます。':'いまは、どの欄が必要かを確かめています。この回答をそのまま紙へ書く必要はありません。'}</p><div class="v2-paper-frame">${renderFormPreviewSvg({...preview,title:preview.section})}</div><details class="v3-image-detail"><summary>書く場所を大きく見る</summary><div class="v3-image-scroll">${renderFormPreviewSvg({...preview,title:preview.section})}</div><p>${esc(preview.example)}</p></details>${preview.note?`<p class="notice">${esc(preview.note)}</p>`:''}<p class="v3-footnote">国税庁の令和8年分${preview.asset.kind==='blank'?'申告書':'記載例'}。枠はナビが付けた目印です。</p><a href="${esc(preview.asset.pdf)}" target="_blank" rel="noopener">用紙の全体をPDFで見る</a></aside>`;
}
function renderQuestion(){
 const trace=traceWizard(journey.answers),item=currentItemV3(journey);
 if(!item){renderResult();return;}
 const copy=questionCopyV3(item.id);
 root.innerHTML=`${progress(copy.chapter)}<div class="v3-question-layout"><article class="card v3-question"><p class="eyebrow">${esc(copy.who||copy.chapter.title)}${journey.returnToResult?' ／ 回答の変更':''}</p><h1 tabindex="-1">${esc(copy.title)}</h1><p class="v3-help" id="v3-help">${esc(copy.help)}</p><p class="v3-example" id="v3-example">${copy.example?`例・見るポイント：${esc(copy.example)}`:''}</p><p class="v3-source">手元で見るもの：${esc(questionGuide(item.id).source)}</p><form data-question="${esc(item.id)}" novalidate>${controls(item,copy)}<p class="v3-error" id="v3-error" role="alert" hidden></p></form><details class="v3-official"><summary>申告書の言い方を確認する</summary><p>${esc(copy.officialQuestion)}</p></details>${glossary()}<button class="button tertiary" data-action="back" ${trace.items[0]?.id===item.id?'disabled':''}>前の質問へ戻る</button>${journey.returnToResult?'<button class="button tertiary" data-action="cancel-edit">変更せず結果へ戻る</button>':''}</article>${previewPanel(item)}</div>${history(trace)}`;
}
function renderCheckpoint(){
 const trace=traceWizard(journey.answers),chapter=CHAPTERS_V3.find(c=>c.id===journey.checkpointPage);
 const next=trace.items.find(x=>x.id===journey.currentId),nextCopy=next?questionCopyV3(next.id):null;
 const items=trace.items.filter(x=>x.page===chapter.id&&x.answered),unknown=items.filter(x=>x.value==='分からない'||Array.isArray(x.value)&&x.value.includes('分からない'));
 root.innerHTML=`<article class="card v3-checkpoint"><p class="eyebrow">ひとまとまり終わりました</p><h1 tabindex="-1">${esc(chapter.title)}の回答を確認</h1><p>入力した内容です。違っていたら、ここで直せます。</p>${unknown.length?'<p class="v3-confirm-note">分からないと答えたことは、最後に「会社へ確認すること」にまとめます。</p>':''}${reviewList(items)}<div class="v3-next-topic"><strong>次は：${esc(nextCopy?.chapter.title||'書類に書く内容')}</strong><p>${esc(nextCopy?.chapter.lead||'あなたの回答から、使う書類・金額・証明書をまとめます。')}</p></div><button class="button v3-primary" data-action="continue">${nextCopy?'次のまとまりへ進む':'書類に書く内容を見る'}</button><button class="button tertiary" data-action="back">前の質問へ戻る</button></article>`;
}
function renderField(field){
 const confirmed=field.status==='calculated',known=confirmed&&field.value!=null;
 const value=known?field.value:field.status==='incomplete'?'用紙にご自身で記入':field.status==='not_applicable'?'今回は記入不要':'まだ書き写さないでください';
 return `<div class="v3-transfer-field v3-field-${esc(field.status)}"><p class="v3-field-purpose">${esc(fieldPurposeV3(field))}</p><span class="v3-field-label">${esc(field.label)}</span><strong>${esc(value)}</strong><small>${esc(field.inputOnly&&confirmed?'入力した内容です':statusText[field.status]||statusText.needs_confirmation)}</small>${field.note?`<p>${esc(field.note)}</p>`:''}</div>`;
}
function resultImages(form){return form.sections.map(section=>{
 const areas=formPreviewsForGuideSection(form.id,section);
 return areas.length?`<section class="v3-map-section"><h4>${esc(section.title)}</h4>${areas.map(area=>{const key=`${form.id}:${section.id}:${area.id}`,expanded=Boolean(expandedImages[key]),show=!hiddenValues[key];return `<figure><figcaption>${esc(area.title)}</figcaption><div class="v3-map-actions"><button class="button secondary" data-toggle-values="${esc(key)}">${show?'記入内容を隠す':'あなたの記入内容を表示'}</button><button class="button secondary" data-expand-image="${esc(key)}" aria-expanded="${expanded}">${expanded?'標準サイズに戻す':'この欄を大きく見る'}</button></div><div class="v2-paper-frame ${expanded?'v3-image-scroll':''}">${renderFormPreviewSvg(area,show)}</div><p>青い文字は、あなたの回答から作った記入候補です。「要確認」は、会社に確認してから書きます。</p>${area.note?`<p class="notice">${esc(area.note)}</p>`:''}<a href="${esc(area.asset.pdf)}" target="_blank" rel="noopener">国税庁の${area.asset.kind==='blank'?'空欄用紙':'記載例'}をPDFで見る</a></figure>`;}).join('')}</section>`:'';
 }).join('');}
function officialOutput(guide){
 const output=buildOfficialOutputV3(guide);
 return `<section class="v3-official-output" aria-labelledby="v3-paper-title"><header class="v3-official-controls"><h2 id="v3-paper-title">用紙の形で、あなたの記入例を見る</h2><p>国税庁の用紙画像に、回答済みの内容と計算済みの数字を重ねています。<strong>最後の入力欄で名前や住所も反映できます。空欄と該当チェックはご自身で確認・記入してください。</strong></p><p>現在の記入ガイドに加えて、こちらもPDFにできます。画像から作るPDFなので、保存後に文字を編集する機能はありません。表面だけの記入例です。裏面の説明は「公式PDF」で確認できます。</p><fieldset><legend>PDFにする用紙を選ぶ</legend>${output.pages.map(page=>`<label class="v3-check"><input type="checkbox" data-paper-select="${esc(page.id)}" checked><span>${esc(page.asset.title)}</span></label>`).join('')}</fieldset><button class="button v3-primary" data-action="print-official">選んだ用紙の記入例をPDF保存・印刷</button><button class="button secondary" data-action="print">説明つきの記入ガイドをPDF保存・印刷</button><p>印刷画面で「PDFとして保存」を選びます。A4横・倍率100％・ヘッダーとフッターなしを確認してください。会社指定の用紙や提出方法も確認してください。</p><p id="v3-paper-error" class="v3-error" role="alert" hidden></p>${output.housingExcluded?'<p class="notice">住宅ローン用紙は別人の記載例なので、この数字入り出力には含めません。税務署から交付されたご自身の申告書を使ってください。</p>':''}</header>${output.pages.map(page=>`<section class="v3-official-document" data-official-document="${esc(page.id)}"><article class="v3-official-sheet"><p class="v3-paper-caption">令和8年分・あなたの記入例（未完成）／空欄・該当チェックはご自身で確認・記入</p><h3 class="v3-paper-screen-title">${esc(page.asset.title)}</h3>${renderOfficialPageSvgV3(page)}</article><div class="v3-official-notes"><h4>この用紙で、あとから記入・確認すること</h4><p>入力して反映した氏名・住所・勤務先は用紙に表示します。未入力の欄と個人番号はご自身で記入してください。該当区分のチェック・判定区分・計算の途中欄も、ご自身で確認して記入してください。</p>${page.notes.length?`<ul>${page.notes.map(note=>`<li>${esc(note)}</li>`).join('')}</ul>`:''}<a href="${esc(page.asset.pdf)}" target="_blank" rel="noopener">表面・裏面を公式PDFで確認する</a></div>${namedSupplement(page.supplement,true)}</section>`).join('')}<section class="v3-official-common-notes"><h3>会社へ確認してから提出してください</h3><p>これは回答から作った記入例です。空欄と該当チェックを確認し、証明書を添えて提出します。</p>${guide.staffConfirmations.length?`<ul>${[...new Set(guide.staffConfirmations)].map(note=>`<li>${esc(note)}</li>`).join('')}</ul>`:'<p>回答から追加の担当者確認事項はありません。未回答の個人情報欄などはご自身で記入してください。</p>'}</section></section>`;
}
function renderResult(){
 identity=syncIdentityV3(identity,journey.answers);
 const guide=currentGuide();
 const shortNames={dependentForm:'あなたと家族を書く用紙',combinedForm:'所得と控除額を書く用紙',insuranceForm:'保険料などを書く用紙',housingForm:'住宅ローンの用紙'};
 const card=form=>`<section class="v3-result-card" id="v3-form-${esc(form.id)}"><p class="eyebrow">${esc(shortNames[form.id]||'用意する書類')}</p><h3>${esc(form.title)}</h3>${form.notice?`<p class="notice">${esc(form.notice)}</p>`:''}${form.sections.map(s=>{const fields=s.fields.filter(f=>f.status!=='not_applicable');return fields.length?`<section class="v3-result-section"><h4>${esc(s.title)}</h4>${s.id==='life-insurance'||s.id==='earthquake'?'<p class="v3-money-note">支払った金額は「保険料」の欄へ。計算後の控除額は「控除額」の欄へ。それぞれ別の金額です。</p>':''}${fields.map(renderField).join('')}${(s.contracts||[]).map(c=>`<details class="v3-contract"><summary>${c.index}件目の契約の書く内容</summary><p>${esc(c.placement.label)}</p>${c.fields.filter(f=>f.status!=='not_applicable').map(renderField).join('')}</details>`).join('')}</section>`:'';}).join('')}<details class="v3-result-images" data-result-map="${esc(form.id)}"><summary>実際の用紙で、書く場所とあなたの金額を見る</summary>${resultImages(form)}</details>${namedSupplement(form.supplement,annexExpanded)}</section>`;
 root.innerHTML=`<article class="card v3-results"><p class="eyebrow">回答が終わりました ／ ここから用紙に書きます</p><h1 tabindex="-1">書類に書く内容を確認しよう</h1><p>下の内容を、会社から配られた用紙へ書き写します。<strong>「会社へ確認」は、確認してから書いてください。</strong></p><div class="v3-print-actions"><button class="button v3-primary" data-action="print">記入ガイドをPDF保存・印刷</button><p>印刷画面で「PDFとして保存」を選びます。公式申告書の完成版ではなく、書く内容のガイドです。</p></div><section><h2>① あなたが記入する書類</h2>${guide.forms.map(f=>`<a class="v3-form-link" href="#v3-form-${esc(f.id)}"><strong>${esc(shortNames[f.id]||f.title)}</strong><span>${esc(f.title)}</span><span>書く内容を確認する</span></a>`).join('')}</section><section><h2>② 記入する内容・金額</h2><p>氏名・住所などは、この画面の下にある「最後に、名前や住所を用紙へ入れる」から追加できます。空欄は手書きしてください。</p>${guide.forms.map(card).join('')}</section><section><h2>③ 用意する書類・証明書</h2>${guide.requiredDocuments.length?`<ul>${[...new Set(guide.requiredDocuments)].map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>今回の回答では、追加の証明書はありません。</p>'}</section><section><h2>④ 会社担当者へ確認すること</h2>${guide.staffConfirmations.length?`<p>この一覧を会社の年末調整担当者に見せてください。</p><ul class="v3-confirm-list">${[...new Set(guide.staffConfirmations)].map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>今回の回答からは、追加の確認事項はありません。</p>'}</section><section><h2>⑤ 提出前チェック</h2><p>紙の書類を見ながら確認してください。チェックはこの画面だけで使います。</p>${guide.submissionChecklist.map((x,i)=>`<label class="v3-check"><input type="checkbox" data-check="${i}" ${checked[i]?'checked':''}><span>${esc(x)}</span></label>`).join('')}<p class="v3-confirm-note">確認事項が残っているときは、会社に相談してから提出します。PDFの保存だけでは、会社へ提出されません。</p></section><details class="v3-history"><summary>回答を見直す・変更する</summary>${reviewList(traceWizard(journey.answers).items.filter(x=>x.answered))}</details>${glossary()}<button class="button tertiary" data-action="back">最後の質問へ戻る</button><button class="button tertiary" data-action="restart">最初からやり直す</button></article>`;
 root.querySelector('.v3-results').insertAdjacentHTML('beforeend',renderIdentityEditorV3(identityDraft||identity,journey.answers)+officialOutput(guide));
}
function render(){
 if(journey.mode==='home')renderHome();
 else if(journey.mode==='checkpoint')renderCheckpoint();
 else if(journey.mode==='result')renderResult();
 else if(journey.mode==='end')root.innerHTML=`<article class="card"><h1 tabindex="-1">この会社での年末調整を確認しましょう</h1><p>この会社では行わないと回答しました。ほかの勤務先での手続きや、確定申告が必要かを会社・税務署に確認してください。</p><button class="button" data-action="edit-target">最初の回答を変える</button></article>`;
 else renderQuestion();
}
function move(){render();window.scrollTo?.(0,0);root.querySelector('h1')?.focus({preventScroll:true});}
function answer(value){const item=currentItemV3(journey);if(!item)return;submitAnswerV3(journey,item.id,value);identity=syncIdentityV3(identity,journey.answers);if(identityDraft)identityDraft=syncIdentityV3(identityDraft,journey.answers);move();}
function showError(message){const error=root.querySelector('#v3-error');error.hidden=false;error.textContent=message;root.querySelector('[name="answer"]')?.setAttribute('aria-invalid','true');}
function printGuide(annexOnly=false){
 if(!identityIsApplied())return;
 const closedContracts=[...root.querySelectorAll('details.v3-contract:not([open])')];
 for(const detail of closedContracts)detail.open=true;
 if(annexOnly)root.classList.add('v2-annex-only');
 try{window.print();}finally{root.classList.remove('v2-annex-only');for(const detail of closedContracts)detail.open=false;}
}
async function printOfficial(){
 if(!identityIsApplied())return;
 const error=root.querySelector('#v3-paper-error'),button=root.querySelector('[data-action="print-official"]');
 const selected=new Set([...root.querySelectorAll('[data-paper-select]:checked')].map(el=>el.dataset.paperSelect));
 if(!selected.size){error.hidden=false;error.textContent='PDFにする用紙を一つ以上選んでください。';return;}
 error.hidden=true;button.disabled=true;button.textContent='用紙を準備しています…';
 try{
  const docs=[...root.querySelectorAll('[data-official-document]')];
  const sources=[...new Set(docs.filter(doc=>selected.has(doc.dataset.officialDocument)).flatMap(doc=>[...doc.querySelectorAll('svg image')].map(image=>image.getAttribute('href'))))];
  await Promise.all(sources.map(src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error('image'));image.src=src;})));
  if(document.fonts?.ready)await document.fonts.ready;
  for(const doc of docs)doc.classList.toggle('is-print-selected',selected.has(doc.dataset.officialDocument));
  document.body.classList.add('v3-print-official');
  try{window.print();}finally{document.body.classList.remove('v3-print-official');for(const doc of docs)doc.classList.remove('is-print-selected');}
 }catch{error.hidden=false;error.textContent='用紙を読み込めませんでした。ZIPを展開してから開き、画像ファイルがあるか確認してください。';}
 finally{button.disabled=false;button.textContent='選んだ用紙の記入例をPDF保存・印刷';}
}
function refreshResult(){
 const top=window.scrollY,open=[...root.querySelectorAll('details[data-result-map][open]')].map(x=>x.dataset.resultMap);
 const selections=new Map([...root.querySelectorAll('[data-paper-select]')].map(el=>[el.dataset.paperSelect,el.checked]));
 renderResult();for(const el of root.querySelectorAll('details[data-result-map]'))if(open.includes(el.dataset.resultMap))el.open=true;
 for(const el of root.querySelectorAll('[data-paper-select]'))if(selections.has(el.dataset.paperSelect))el.checked=selections.get(el.dataset.paperSelect);
 window.scrollTo?.(0,top);
}
function identityIsApplied(){
 if(!identityDraft)return true;
 const error=root.querySelector('#v3-identity-error');
 if(error){error.hidden=false;error.textContent='名前や住所の入力を変更しています。先に「名前・住所などを用紙へ反映する」を押してください。';root.querySelector('[data-identity-form] button[type="submit"]')?.focus();}
 return false;
}
root.addEventListener('input',event=>{
 const form=event.target.closest('form[data-identity-form]');
 if(form)identityDraft=captureIdentityFormV3(form,journey.answers);
});
root.addEventListener('submit',event=>{
 const identityForm=event.target.closest('form[data-identity-form]');
 if(identityForm){
  event.preventDefault();const result=validateIdentityV3(captureIdentityFormV3(identityForm,journey.answers),journey.answers);
  if(!result.ok){const error=root.querySelector('#v3-identity-error');error.hidden=false;error.textContent=result.errors.map(e=>e.message).join(' ');const input=[...identityForm.querySelectorAll('[data-identity-path]')].find(el=>el.dataset.identityPath===result.errors[0].path);input?.setAttribute('aria-invalid','true');input?.focus();return;}
  identity=result.identity;identityDraft=null;refreshResult();
  root.querySelector('.v3-official-output')?.scrollIntoView({behavior:'smooth',block:'start'});return;
 }

 const form=event.target.closest('form[data-question]');if(!form)return;event.preventDefault();
 const item=currentItemV3(journey);if(!item||form.dataset.question!==item.id)return;const q=item.question;
 if(q.input==='text'){const value=form.querySelector('input').value.trim();if(!value||value.length>80){showError('証明書の内容を1〜80文字で入力してください。分からなければ、あとで確認できます。');return;}answer(value);return;}
 if(q.input){const parsed=parseNumberV3(form.querySelector('input').value,q);if(!parsed.ok){showError(parsed.message);return;}answer(parsed.value);return;}
 const selected=[...form.querySelectorAll('input[name="answer"]:checked')].map(x=>x.value);
 if(!selected.length){showError(q.multi?'当てはまるものを選んでください。一つもなければ「どれもない」を選びます。':'答えを一つ選んでください。');return;}
 answer(q.multi?selected:selected[0]);
});
root.addEventListener('change',event=>{
 const input=event.target;if(input.matches('[data-identity-path]')){identityDraft=captureIdentityFormV3(input.closest('form'),journey.answers);input.removeAttribute('aria-invalid');return;}if(input.matches('[data-check]')){checked[input.dataset.check]=input.checked;return;}
 if(input.matches('input[type="checkbox"][name="answer"]')&&input.checked){const siblings=root.querySelectorAll('input[type="checkbox"][name="answer"]');if(input.value==='どれもない')for(const el of siblings){if(el!==input)el.checked=false;}else for(const el of siblings){if(el.value==='どれもない')el.checked=false;}}
 if(input.matches('[name="answer"]')){input.removeAttribute('aria-invalid');const error=root.querySelector('#v3-error');if(error)error.hidden=true;}
});
root.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;const action=button.dataset.action;
 if(action==='start'){startJourneyV3(journey);move();}
 else if(action==='continue'){continueJourneyV3(journey);move();}
 else if(action==='back'){backJourneyV3(journey);move();}
 else if(action==='unknown'){answer('分からない');}
 else if(action==='reuse'){answer(SAME_CONTRACT_HOLDER);}
 else if(action==='cancel-edit'){journey.mode='result';journey.returnToResult=false;move();}
 else if(action==='edit-target'){editAnswerV3(journey,'target');move();}
 else if(action==='restart'){if(window.confirm('回答を消して、最初からやり直しますか？')){journey=createJourneyV3();checked={};annexExpanded=false;expandedImages={};hiddenValues={};identity=createIdentityV3();identityDraft=null;move();}}
 else if(action==='print')printGuide();
 else if(action==='print-official')printOfficial();
 else if(action==='clear-identity'){if(window.confirm('入力した本人・家族・勤務先の名前や住所を消しますか？税金の質問への回答は残ります。')){identity=createIdentityV3();identityDraft=null;refreshResult();}}
 else if(action==='toggle-annex'){annexExpanded=!annexExpanded;refreshResult();}
 else if(action==='print-annex'){if(currentGuide().forms.some(f=>f.supplement?.required))printGuide(true);}
 else if(button.dataset.edit){editAnswerV3(journey,button.dataset.edit);move();}
 else if(button.dataset.toggleValues){hiddenValues[button.dataset.toggleValues]=!hiddenValues[button.dataset.toggleValues];refreshResult();}
 else if(button.dataset.expandImage){expandedImages[button.dataset.expandImage]=!expandedImages[button.dataset.expandImage];refreshResult();}
});
render();
