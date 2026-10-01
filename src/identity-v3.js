import { TAX_RULES_2026 } from './rules-2026.js';

// Optional paper-entry data, separate from tax answers. Memory only.
const PERSON_FIELDS=[['name','氏名',80],['kana','フリガナ',80],['birthDate','生年月日',10],['addressMode','住所の選び方',12],['address','住所又は居所',160],['relationship','あなたとの続柄',20]];
const OWNER_FIELDS=[['name','あなたの氏名',80],['kana','フリガナ',80],['postalCode','郵便番号',8],['address','あなたの住所又は居所',160],['birthDate','あなたの生年月日',10],['householdName','世帯主の氏名',80],['householdRelationship','世帯主の、あなたとの続柄',20]];
const EMPLOYER_FIELDS=[['name','勤務先の名称',120],['address','勤務先の住所',160]];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createIdentityV3(){return {taxpayer:{},employer:{},spouse:{},dependents:[]};}
export function syncIdentityV3(identity,answers={}){
 const source=identity||createIdentityV3(),count=Math.max(0,Math.min(100,Number(answers.depCount)||0));
 return {taxpayer:{...source.taxpayer},employer:{...source.employer},spouse:answers.spouse==='はい'?{...source.spouse}:{},dependents:Array.from({length:count},(_,i)=>({...source.dependents?.[i]}))};
}
export function identityDateTextV3(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '';
 const date=new Date(`${value}T00:00:00Z`);
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return '';
 return new Intl.DateTimeFormat('ja-JP-u-ca-japanese',{dateStyle:'long',timeZone:'UTC'}).format(date);
}
export function identityAddressV3(person,identity){return person?.addressMode==='same'?identity.taxpayer?.address||'':person?.address||'';}
export function identityAgeAtYearEndV3(birthDate){
 if(!identityDateTextV3(birthDate))return null;
 // 2026 NTA form: age 16 includes births on 2011-01-01; age 19 includes
 // 2008-01-01. The birthday eve is when age increases under Japanese law.
 return TAX_RULES_2026.year-Number(birthDate.slice(0,4))+(birthDate.slice(5)==='01-01'?1:0);
}

function scopes(identity,answers){
 return [['taxpayer',identity.taxpayer,OWNER_FIELDS,'あなた'],['employer',identity.employer,EMPLOYER_FIELDS,'勤務先'],...(answers.spouse==='はい'?[['spouse',identity.spouse,PERSON_FIELDS.filter(f=>f[0]!=='relationship'),'結婚している相手']]:[]),...identity.dependents.map((person,i)=>[`dependents.${i}`,person,PERSON_FIELDS,`${i+1}人目の家族`])];
}
function setPath(identity,path,value){
 const parts=path.split('.'),field=parts.pop();
 const record=parts[0]==='dependents'?identity.dependents[Number(parts[1])]:identity[parts[0]];
 if(record)record[field]=value;
}
export function captureIdentityFormV3(form,answers){
 const identity=syncIdentityV3(createIdentityV3(),answers);
 const allowed=new Set(scopes(identity,answers).flatMap(([path,,fields])=>fields.map(([key])=>`${path}.${key}`)));
 for(const input of form.querySelectorAll('[data-identity-path]'))if(allowed.has(input.dataset.identityPath))setPath(identity,input.dataset.identityPath,input.value);
 return identity;
}
export function validateIdentityV3(raw,answers){
 const identity=syncIdentityV3(raw,answers),errors=[];
 for(const [path,person,fields,title] of scopes(identity,answers))for(const [key,label,max] of fields){
  const value=String(person[key]??'').trim();person[key]=value;
  if(value.length>max)errors.push({path:`${path}.${key}`,message:`${title}の${label}は${max}文字以内で入力してください。`});
  if(key==='addressMode'&&!['','same','different'].includes(value))errors.push({path:`${path}.${key}`,message:'住所の選び方を選び直してください。'});
  if(key==='birthDate'&&value&&(!identityDateTextV3(value)||value<'1900-01-01'||value>`${TAX_RULES_2026.year}-12-31`))errors.push({path:`${path}.${key}`,message:`${title}の生年月日を1900年から${TAX_RULES_2026.year}年の実在する日付で入力してください。`});
  if(key==='postalCode'&&value){
   const normalized=value.normalize('NFKC').replace(/\s/g,'');
   if(!/^\d{3}-?\d{4}$/.test(normalized))errors.push({path:`${path}.${key}`,message:'郵便番号は123-4567のように7桁の数字で入力してください。'});
   else person[key]=normalized.replace(/^(\d{3})-?(\d{4})$/,'$1-$2');
  }
 }
 return {ok:!errors.length,identity,errors};
}
export function identityWarningsV3(identity,answers){
 const warnings=[];
 for(const [title,person,age] of [...(answers.spouse==='はい'?[['配偶者',identity.spouse,answers.spouseAge]]:[]),...identity.dependents.map((p,i)=>[`${i+1}人目の家族`,p,answers[`dep:${i+1}:age`]])]){
  if(person.birthDate&&typeof age==='number'&&identityAgeAtYearEndV3(person.birthDate)!==age)warnings.push(`${title}の生年月日と年末の年齢の回答が一致していません。年齢の回答又は生年月日を修正してください。修正まで生年月日は用紙に反映しません。`);
  if(person.addressMode==='same'&&!identity.taxpayer.address)warnings.push(`${title}は本人と同じ住所を選んでいます。本人の住所を入力してください。`);
 }
 return warnings;
}

function personFields(prefix,person,identity){
 const records=[['name','氏名',person.name],['kana','フリガナ',person.kana],['birth','生年月日',identityDateTextV3(person.birthDate)],['relationship','あなたとの続柄',person.relationship],['address','住所又は居所',identityAddressV3(person,identity)]];
 return records.map(([key,label,value])=>({key:`${prefix}-${key}`,label,value:value||null,status:value?'calculated':'incomplete',inputOnly:true}));
}
export function attachIdentityToGuideV3(guide,identity,answers){
 const data=syncIdentityV3(identity,answers),warnings=identityWarningsV3(data,answers);
 const owner=[['name','あなたの氏名',data.taxpayer.name],['kana','フリガナ',data.taxpayer.kana],['postal','郵便番号',data.taxpayer.postalCode],['address','あなたの住所又は居所',data.taxpayer.address],['employer-name','給与の支払者の名称（氏名）',data.employer.name],['employer-address','給与の支払者の所在地（住所）',data.employer.address]].map(([key,label,value])=>({key:`paper-owner-${key}`,label,value:value||null,status:value?'calculated':'incomplete',inputOnly:true}));
 const forms=guide.forms.map(form=>{
  if(form.id==='housingForm')return form;
  const fields=form.sections.map(section=>({...section,fields:section.fields.flatMap(field=>{
   if(field.key==='taxpayer-identity')return [...owner,...[['birth','あなたの生年月日',identityDateTextV3(data.taxpayer.birthDate)],['household-name','世帯主の氏名',data.taxpayer.householdName],['household-relationship','あなたとの続柄（世帯主）',data.taxpayer.householdRelationship]].map(([key,label,value])=>({key:`paper-owner-${key}`,label,value:value||null,status:value?'calculated':'incomplete',inputOnly:true}))];
   if(field.key==='spouse-identity'&&Object.values(data.spouse).some(Boolean))return personFields('paper-spouse',data.spouse,data).filter(f=>!f.key.endsWith('-relationship'));
   const match=field.key.match(/^dependent-(\d+)-identity$/);
   if(match&&Object.values(data.dependents[Number(match[1])-1]||{}).some(Boolean))return personFields(`paper-relative-${match[1]}`,data.dependents[Number(match[1])-1],data);
   const specific=field.key.match(/^specific-relative-(\d+)$/);
   if(specific&&Object.values(data.dependents[Number(specific[1])-1]||{}).some(Boolean))return [...personFields(`paper-specific-${specific[1]}`,data.dependents[Number(specific[1])-1],data),field];
   return [field];
  })}));
  const spouseSection=fields.find(section=>section.id==='spouse-deduction');
  if(spouseSection&&Object.values(data.spouse).some(Boolean))spouseSection.fields.unshift(...personFields('paper-spouse',data.spouse,data).filter(f=>!f.key.endsWith('-relationship')));
  if(form.id!=='dependentForm')fields.unshift({id:'paper-identity',title:'本人・勤務先の記入内容',status:'incomplete',fields:owner});
  return {...form,sections:fields};
 });
 const blocked=[];
 if(data.spouse.birthDate&&typeof answers.spouseAge==='number'&&identityAgeAtYearEndV3(data.spouse.birthDate)!==answers.spouseAge)blocked.push('spouse');
 data.dependents.forEach((p,i)=>{if(p.birthDate&&typeof answers[`dep:${i+1}:age`]==='number'&&identityAgeAtYearEndV3(p.birthDate)!==answers[`dep:${i+1}:age`])blocked.push(`dependent-${i+1}`);});
 for(const form of forms)for(const section of form.sections)for(const field of section.fields){
  if(!field.inputOnly||field.label!=='生年月日')continue;
  const relative=field.key.match(/^paper-(?:relative|specific)-(\d+)-birth$/);
  if(field.key==='paper-spouse-birth'&&blocked.includes('spouse')||relative&&blocked.includes(`dependent-${relative[1]}`)){
   field.value=null;field.status='needs_confirmation';field.note='年齢の回答又は生年月日を修正してから転記してください。';
  }
 }
 return {...guide,forms,identityInfo:data,identityBirthBlocks:blocked,identityWarnings:warnings,staffConfirmations:[...new Set([...guide.staffConfirmations,...warnings])]};
}

export function renderIdentityEditorV3(identity,answers,options={}){
 const data=syncIdentityV3(identity,answers);
 const input=(path,person,[key,label,max])=>{
  const id=`identity-${path.replace(/\./g,'-')}-${key}`,value=person[key]||'';
  if(key==='addressMode')return `<div class="v3-identity-field"><label for="${id}">住所は本人と同じですか？</label><select id="${id}" data-identity-path="${path}.${key}"><option value="" ${!value?'selected':''}>まだ選ばない</option><option value="same" ${value==='same'?'selected':''}>本人と同じ住所を使う</option><option value="different" ${value==='different'?'selected':''}>別の住所を下に入力する</option></select></div>`;
  return `<div class="v3-identity-field"><label for="${id}">${esc(label)}</label><input id="${id}" type="${key==='birthDate'?'date':'text'}" data-identity-path="${path}.${key}" value="${esc(value)}" maxlength="${max}" autocomplete="off" ${key==='birthDate'?`min="1900-01-01" max="${TAX_RULES_2026.year}-12-31"`:''} ${key==='postalCode'?'inputmode="numeric"':''}>${key==='address'?`<small>番地・建物名まで入力します。${path==='taxpayer'||path==='employer'?'':'「本人と同じ」を選んだ方は空欄で構いません。'}</small>`:''}${key==='birthDate'?'<small>西暦で入力し、用紙には和暦で表示します。年齢の回答と違う場合は確認します。</small>':''}</div>`;
 };
 return `<section class="v3-identity-editor" id="v3-identity-editor"><h2>最後に、名前や住所を用紙へ入れる</h2><p>入力は任意です。一度入力した本人情報を各用紙で使います。空欄は後から手書きできます。</p><p>個人番号はここでは入力しません。必要な記入方法は会社の案内に従ってください。${esc(options.storageNote||'入力はこの画面を開いている間だけ保持し、保存・送信しません。')}</p><form data-identity-form novalidate>${scopes(data,answers).map(([path,person,fields,title])=>`<fieldset><legend>${esc(title)}</legend><div class="v3-identity-grid">${fields.map(field=>input(path,person,field)).join('')}</div></fieldset>`).join('')}<p>入力後に「用紙へ反映する」を押して、下の用紙で文字を確認してください。</p><button class="button v3-primary" type="submit">名前・住所などを用紙へ反映する</button><button class="button tertiary" type="button" data-action="clear-identity">名前などを消して、手書きにする</button><p class="v3-error" id="v3-identity-error" role="alert" hidden></p></form></section>`;
}
