import { FORM_PREVIEW_ASSETS, formPreviewsForGuideSection } from './form-preview-v2.js';
import { createIdentityV3, identityDateTextV3, identityAddressV3 } from './identity-v3.js';

// Presentation coordinates only, in the stored 200 dpi official front images.
// Row boundaries visually checked against 2026bun_01/04/06.pdf, 2026-09-29.
// No new tax calculations. The original images and PDFs are never modified.
const ASSET_BY_FORM = {dependentForm:'fuyou',combinedForm:'combined',insuranceForm:'insurance'};
const ROWS = {
  lifeGeneral:{tops:[395,449,505,560],origin:395},
  lifeCare:{tops:[774,832,892],origin:774},
  lifePension:{tops:[1008,1070,1131],origin:1008},
  quake:{tops:[432,544],origin:432},
  fuyouDependent:{tops:[552,662,773,883],origin:552},
  fuyouUnder16:{tops:[1407,1462],origin:1407},
  specificRelative:{tops:[1118,1194],origin:1118}
};
const esc = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function textLayout(entry) {
  const [, ,w,h]=entry.box;
  if(entry.valueKind!=='text')return {size:Math.min(30,h*.72,(w-10)/(entry.text.length*.62)),lines:[entry.text]};
  // Keep the entire value; never truncate a name on a printable form.
  const chars=Array.from(entry.text);
  for(let size=Math.min(22,h*.64);size>=12;size-=1){
    const columns=Math.max(1,Math.floor((w-8)/size));
    const lines=Array.from({length:Math.ceil(chars.length/columns)},(_,i)=>chars.slice(i*columns,(i+1)*columns).join(''));
    if(lines.length*size*1.1<=h-2)return {size,lines};
  }
  return null;
}

export function buildOfficialOutputV3(guide) {
  const pages=[];
  const identity=guide.identityInfo||createIdentityV3(),blocked=new Set(guide.identityBirthBlocks||[]);
  for(const form of guide.forms||[]){
    const asset=FORM_PREVIEW_ASSETS[ASSET_BY_FORM[form.id]];
    // The housing asset is an example containing another person's sample data.
    if(!asset||asset.kind!=='blank')continue;
    const entries=[],notes=[],seen=new Set(),personRows={};
    const add=(entry,offset=0)=>{
      if(!entry||entry.status!=='calculated'||seen.has(entry.key))return;
      const shifted={...entry,box:[entry.box[0],entry.box[1]+offset,entry.box[2],entry.box[3]]};
      const layout=textLayout(shifted);
      if(!layout){notes.push(`${entry.label}：長い文字は省略せず、一覧を見て手書きしてください。`);return;}
      if(shifted.box[1]+shifted.box[3]>asset.height)return;
      seen.add(entry.key);entries.push({...shifted,layout});
    };
    const text=(key,label,value,box,offset=0)=>{if(value)add({key,label,text:String(value),box,status:'calculated',valueKind:'text'},offset);};
    const owner=identity.taxpayer,employer=identity.employer;
    const header={
      dependentForm:{name:[1078,124,399,49],kana:[1078,91,399,24],address:[1078,278,662,34],postalCode:[1260,248,260,22],birthDate:[1611,92,317,36],householdName:[1611,140,317,33],householdRelationship:[1611,190,317,44],employerName:[477,103,432,66],employerAddress:[477,253,432,55]},
      combinedForm:{name:[1158,145,647,52],kana:[1158,110,647,24],address:[1158,216,647,37],employerName:[525,112,447,35],employerAddress:[525,217,447,35]},
      insuranceForm:{name:[1266,147,682,60],kana:[1266,103,682,28],address:[1266,241,682,56],employerName:[433,105,641,61],employerAddress:[433,250,641,48]}
    }[form.id];
    const labels={name:'氏名',kana:'フリガナ',address:'住所又は居所',birthDate:'生年月日',householdName:'世帯主の氏名',householdRelationship:'世帯主との続柄',relationship:'あなたとの続柄'};
    for(const key of ['name','kana','address','birthDate','householdName','householdRelationship']){
      if(!header[key])continue;
      const value=key==='birthDate'?identityDateTextV3(owner[key]):key==='address'&&form.id!=='dependentForm'?[owner.postalCode?`〒${owner.postalCode}`:'',owner.address].filter(Boolean).join(' '):owner[key];
      text(`identity-owner-${key}`,labels[key],value,header[key]);
    }
    const postal=String(owner.postalCode||'').match(/^(\d{3})-?(\d{4})$/);
    if(form.id==='dependentForm'&&postal){
      text('identity-owner-postal-first','郵便番号（前3桁）',postal[1],[1179,248,50,22]);
      text('identity-owner-postal-last','郵便番号（後4桁）',postal[2],[1250,248,77,22]);
    }
    text('identity-employer-name','給与の支払者の名称',employer.name,header.employerName);
    text('identity-employer-address','給与の支払者の所在地',employer.address,header.employerAddress);
    const personBoxes={
      fuyouDependent:{name:[305,588,248,63],kana:[305,556,248,22],relationship:[566,618,129,33],birthDate:[711,617,268,37],address:[1605,568,279,78]},
      fuyouUnder16:{name:[306,1433,220,23],kana:[306,1409,220,19],relationship:[954,1415,45,38],birthDate:[1009,1414,132,39],address:[1155,1414,388,39]},
      specificRelative:{name:[210,1153,298,32],kana:[210,1123,298,22],relationship:[931,1127,40,53],birthDate:[982,1127,178,53],address:[1172,1127,360,53]}
    };
    for(const section of form.sections||[]){
      if(section.status==='not_applicable')continue;
      const areas=formPreviewsForGuideSection(form.id,section);
      for(const area of areas){
        const contract=(section.contracts||[]).find(c=>area.id.endsWith(`-${c.id}`));
        if(contract){
          const amount=contract.fields.find(f=>f.key===`${contract.id}-amount`);
          if(amount?.status!=='calculated'){notes.push(`${contract.index}件目の保険契約：支払額・支払った人の確認後に記入してください。`);continue;}
          const region=area.id.slice(0,-contract.id.length-1),row=ROWS[region];
          const top=row?.tops[contract.placement?.rowNumber-1];
          if(top==null)continue;
          for(const entry of area.overlays){
            // The company cell starts after the vertical category-label column.
            const placed=entry.key.endsWith('-companyName')&&region!=='quake'?{...entry,box:[182,entry.box[1],180,entry.box[3]]}:entry;
            add(placed,top-row.origin);
          }
          continue;
        }
        const match=area.id.match(/^(fuyouDependent|fuyouUnder16|specificRelative)-(\d+)$/);
        if(match){
          const region=match[1],person=match[2];
          const classification=section.fields.find(f=>f.key===`dependent-${person}-classification`||f.key===`specific-relative-${person}`);
          if(classification?.status!=='calculated'){notes.push(`${person}人目の親族：記入要件の確認後に記入してください。`);continue;}
          const row=ROWS[region],position=personRows[region]||0;
          personRows[region]=position+1;
          if(position>=row.tops.length){notes.push(`${person}人目の親族：用紙の行数を超えるため、会社に別紙の記入方法を確認してください。`);continue;}
          for(const entry of area.overlays)add(entry,row.tops[position]-row.origin);
          // Names use the same row allocation as the associated income.
          const data=identity.dependents[Number(person)-1]||{},boxes=personBoxes[region],offset=row.tops[position]-row.origin;
          for(const key of ['name','kana','relationship','birthDate','address']){
            if(key==='birthDate'&&blocked.has(`dependent-${person}`))continue;
            const value=key==='birthDate'?identityDateTextV3(data.birthDate):key==='address'?region==='specificRelative'&&data.addressMode==='same'?'':identityAddressV3(data,identity):data[key];
            text(`identity-${region}-${person}-${key}`,`${person}人目の${labels[key]}`,value,boxes[key],offset);
          }
          notes.push(`${person}人目の親族の情報を${position+1}行目に表示しています。空欄の氏名等は同じ行へ記入してください。`);
          continue;
        }
        if(form.id==='dependentForm'&&section.id==='spouse'&&section.status!=='calculated'){
          notes.push('扶養控除等申告書のA欄：記入要件を会社に確認してから記入してください。');continue;
        }
        for(const entry of area.overlays)add(entry);
        if(area.id==='combinedSpouse'){
          text('identity-spouse-name','配偶者の氏名',identity.spouse.name,[936,460,339,41]);
          text('identity-spouse-kana','配偶者のフリガナ',identity.spouse.kana,[936,427,339,25]);
          if(!blocked.has('spouse'))text('identity-spouse-birth','配偶者の生年月日',identityDateTextV3(identity.spouse.birthDate),[1700,378,457,32]);
          if(identity.spouse.addressMode!=='same')text('identity-spouse-address','配偶者の住所',identity.spouse.address,[1292,458,393,40]);
        }
        if(area.id==='spouseIncome'&&section.fields.some(f=>f.key==='spouse-salary-revenue'&&f.status==='calculated')){
          // Salary-only spouse: the same known income goes in (1) and the total.
          const income=area.overlays.find(entry=>entry.key==='spouse-income');
          if(income)add({...income,key:'spouse-salary-income',box:[1362,589,191,29]});
        }
      }
      for(const field of section.fields||[]){
        if(field.status==='needs_confirmation')notes.push(`${field.label}：確認が必要なため、用紙の数字は空欄です。`);
      }
    }
    notes.push(...(guide.identityWarnings||[]));
    pages.push({id:form.id,title:form.title,asset,entries,notes:[...new Set(notes)],supplement:form.supplement||null});
  }
  return {pages,housingExcluded:(guide.forms||[]).some(f=>f.id==='housingForm')};
}

export function renderOfficialPageSvgV3(page) {
  const {asset}=page;
  const values=page.entries.map(entry=>{
    const [x,y,w,h]=entry.box,{size,lines}=entry.layout,text=entry.valueKind==='text';
    const baseline=y+(h-lines.length*size*1.1)/2+size*.88;
    return `<g data-form-key="${esc(entry.key)}"><title>${esc(entry.label)}：${esc(entry.text)}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/><text font-size="${size}" font-family="${text?'Meiryo, sans-serif':'Arial, Meiryo, sans-serif'}" font-weight="700" fill="#173e59" text-anchor="${text?'start':'end'}">${lines.map((line,i)=>`<tspan x="${text?x+4:x+w-4}" y="${baseline+i*size*1.1}">${esc(line)}</tspan>`).join('')}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${asset.width} ${asset.height}" role="img" aria-label="${esc(page.title)}。あなたの回答から作った記入例。未記入の欄があります。"><image href="${esc(asset.image)}" width="${asset.width}" height="${asset.height}"/>${values}</svg>`;
}
