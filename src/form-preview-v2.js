import { baseQuestionId } from './flow.js';
import { pageForQuestion } from './wizard-v2.js';
import { QUESTIONS } from './questions.js';
import { insuranceContractRows } from './form-guide.js';

// Coordinates refer to the first page of the official 2026 PDFs rendered at
// 200 dpi (housing example: 160 dpi). Source URLs and hashes are in V2_FORM_PREVIEW.md.
export const FORM_PREVIEW_ASSETS = Object.freeze({
  fuyou: { title:'扶養控除等（異動）申告書', image:'forms/fuyou-front.png', pdf:'forms/fuyou-2026.pdf', width:2339, height:1654, kind:'blank' },
  combined: { title:'基礎控除等の兼用申告書', image:'forms/kiso-spouse-front.png', pdf:'forms/kiso-spouse-2026.pdf', width:2339, height:1654, kind:'blank' },
  insurance: { title:'保険料控除申告書', image:'forms/hoken-front.png', pdf:'forms/hoken-2026.pdf', width:2339, height:1654, kind:'blank' },
  housing: { title:'住宅借入金等特別控除申告書の国税庁記載例', image:'forms/housing-example-front.png', pdf:'forms/housing-example-2026.pdf', width:1871, height:1323, kind:'example' }
});

export const REGIONS = Object.freeze({
  fuyouHead: { asset:'fuyou', title:'本人欄', crop:[75,45,1950,290], mark:[917,87,1020,230] },
  fuyouSpouse: { asset:'fuyou', title:'A 源泉控除対象配偶者', crop:[76,344,2020,225], mark:[128,453,1957,100] },
  fuyouDependent: { asset:'fuyou', title:'B 源泉控除対象親族', crop:[74,348,2020,663], mark:[128,552,1957,443] },
  fuyouUnder16: { asset:'fuyou', title:'住民税に関する事項／16歳未満の扶養親族', crop:[72,1327,2190,215], mark:[80,1360,2180,158] },
  fuyouDisability: { asset:'fuyou', title:'C 障害者、寡婦、ひとり親又は勤労学生', crop:[75,978,2020,215], mark:[282,995,555,180] },
  fuyouParent: { asset:'fuyou', title:'C 寡婦・ひとり親', crop:[74,978,2020,215], mark:[836,995,148,180] },
  fuyouStudent: { asset:'fuyou', title:'C 勤労学生', crop:[74,978,2020,215], mark:[838,1081,145,65] },
  basicIncome: { asset:'combined', title:'基礎控除申告書／給与所得の収入金額', crop:[146,303,746,300], mark:[378,380,228,80] },
  basicOtherIncome: { asset:'combined', title:'基礎控除申告書／給与所得以外の所得の合計額', crop:[146,303,746,302], mark:[607,457,265,78] },
  basicDeduction: { asset:'combined', title:'基礎控除申告書／基礎控除の額', crop:[150,596,740,395], mark:[674,801,201,65] },
  combinedSpouse: { asset:'combined', title:'配偶者控除等申告書／配偶者の氏名等', crop:[900,302,1295,230], mark:[927,345,1239,166] },
  spouseIncome: { asset:'combined', title:'配偶者控除等申告書／配偶者の収入金額・所得金額', crop:[900,500,1295,283], mark:[927,540,665,213] },
  spouseDeduction: { asset:'combined', title:'配偶者控除等申告書／控除の額', crop:[910,777,1285,238], mark:[1897,784,270,171] },
  specificRelative: { asset:'combined', title:'特定親族特別控除申告書', crop:[149,1016,2043,370], mark:[167,1061,2000,214] },
  incomeAdjustment: { asset:'combined', title:'所得金額調整控除申告書／要件', crop:[150,1405,2040,216], mark:[168,1426,583,170] },
  lifeGeneral: { asset:'insurance', title:'保険料控除申告書／一般の生命保険料', crop:[99,320,1195,463], mark:[136,394,1154,222] },
  lifeCare: { asset:'insurance', title:'保険料控除申告書／介護医療保険料', crop:[99,760,1195,253], mark:[136,774,1154,175] },
  lifePension: { asset:'insurance', title:'保険料控除申告書／個人年金保険料', crop:[99,998,1195,315], mark:[136,1008,1154,184] },
  lifeTotal: { asset:'insurance', title:'保険料控除申告書／生命保険料控除額の合計', crop:[99,1180,1195,249], mark:[1128,1306,161,112] },
  quake: { asset:'insurance', title:'保険料控除申告書／地震保険料控除', crop:[1305,318,895,620], mark:[1307,324,884,336] },
  social: { asset:'insurance', title:'保険料控除申告書／社会保険料控除', crop:[1304,938,897,257], mark:[1307,945,884,185] },
  ideco: { asset:'insurance', title:'保険料控除申告書／小規模企業共済等掛金控除', crop:[1304,1195,897,408], mark:[1307,1204,884,323] },
  housing: { asset:'housing', title:'住宅借入金等特別控除申告書の記載例', crop:[620,185,600,625], mark:[665,320,500,399] }
});

// Monetary entries only: these boxes were checked against the stored official
// blank form images. Amounts come from formGuide, never from new tax calculations.
const RESULT_FIELD_BOXES = {
  basicIncome: [['salary-revenue',[389,405,188,32]],['salary-income',[617,411,218,30]],['non-salary-income',[617,480,218,33]],['total-income',[617,545,218,29]]],
  basicOtherIncome: [['non-salary-income',[617,480,218,33]]],
  basicDeduction: [['basic-deduction',[687,816,151,31]]],
  fuyouSpouse: [['withholding-spouse-income',[1166,498,106,31]]],
  spouseIncome: [['spouse-salary-revenue',[1143,589,174,29]],['spouse-income',[1362,704,191,29]]],
  lifeGeneral: [['life-paid-新生命保険料',[353,638,75,23]],['life-paid-旧生命保険料',[355,742,108,24]],['life-general-deduction',[1120,740,135,25]]],
  lifeCare: [['life-paid-介護医療保険料',[338,976,124,23]],['life-care-deduction',[1119,975,135,25]]],
  lifePension: [['life-paid-新個人年金保険料',[338,1220,124,23]],['life-paid-旧個人年金保険料',[338,1277,124,23]],['life-pension-deduction',[1119,1275,135,25]]],
  lifeTotal: [['life-deduction-amount',[1140,1382,113,25]]],
  quake: [['earthquake-paid',[2012,679,141,25]],['old-long-term-paid',[2012,740,141,25]],['earthquake-deduction',[1970,891,180,25]]],
  social: [['social-deduction',[2007,1152,146,25]]],
  ideco: [['mutual-aid-deduction',[2007,1557,146,25]]]
};

function monetaryOverlay(section, key, box) {
  const field=section.fields.find(f=>f.key===key);
  if(!field||field.status==='not_applicable'||field.status==='incomplete')return null;
  const known=field.status==='calculated'&&typeof field.value==='string'&&/^[\d,]+円$/.test(field.value);
  return {key,label:field.label,box,text:known?field.value.slice(0,-1):'要確認',status:known?'calculated':'needs_confirmation'};
}

function overlaysForRegion(id, section) {
  let boxes=RESULT_FIELD_BOXES[id]||[];
  if(id==='spouseDeduction'){
    const special=section.fields.find(f=>f.key==='spouse-deduction')?.label.includes('特別');
    boxes=[['spouse-deduction',special?[1910,914,216,26]:[1910,829,216,26]]];
  }
  if(id==='ideco'){
    const type=section.fields.find(f=>f.key==='mutual-aid-type')?.value;
    const rows={'小規模企業共済掛金':1294,'企業型年金加入者掛金':1358,'個人型年金加入者掛金（iDeCo）':1423,'心身障害者扶養共済掛金':1488};
    if(Object.hasOwn(rows,type))boxes=[...boxes,['mutual-aid-paid',[2007,rows[type],146,25]]];
  }
  return boxes.map(([key,box])=>monetaryOverlay(section,key,box)).filter(Boolean);
}

function contractPreviewAreas(section) {
  return (section.contracts||[]).flatMap(contract=>{
    if(contract.placement?.location==='supplement')return [];
    const life=contract.id.startsWith('life-');
    const regionId=life?['新生命保険料','旧生命保険料'].includes(contract.category)?'lifeGeneral':contract.category==='介護医療保険料'?'lifeCare':['新個人年金保険料','旧個人年金保険料'].includes(contract.category)?'lifePension':null:
      ['地震保険料','旧長期損害保険料'].includes(contract.category)?'quake':null;
    // An unknown category cannot be assigned to an arbitrary row on the paper.
    if(!regionId)return [];
    const region=REGIONS[regionId],row=regionId==='lifeGeneral'?395:regionId==='lifeCare'?774:1008;
    const boxes=life?{companyName:[150,row+9,214,36],insuranceKind:[381,row+9,105,36],insurancePeriod:[499,row+9,57,36],holderName:[568,row+9,154,36],recipientName:[740,row+7,183,contract.pension?25:36],recipientRelationship:[937,row+9,29,36],category:[978,row+9,49,30],amount:[1050,row+18,150,25],...(contract.pension?{pensionStartDate:[811,row+43,149,13]}:{})}:
      {companyName:[1350,447,137,68],insuranceKind:[1501,447,105,68],insurancePeriod:[1620,447,42,68],holderName:[1675,441,177,34],insuredName:[1675,492,158,34],insuredRelationship:[1836,492,27,34],category:[1877,448,73,68],amount:[1967,447,131,40]};
    const overlays=Object.entries(boxes).map(([key,box])=>{
      const field=contract.fields.find(f=>f.key===`${contract.id}-${key}`);
      if(!field||['incomplete','not_applicable'].includes(field.status))return null;
      if(key==='amount')return monetaryOverlay({fields:contract.fields},field.key,box);
      const known=field.status==='calculated'&&typeof field.value==='string';
      const text=key==='category'&&!life?(field.value==='地震保険料'?'地震':'旧長期'):field.value;
      return {key:field.key,label:field.label,box,text:known?text:'要確認',status:known?'calculated':'needs_confirmation',valueKind:'text'};
    }).filter(Boolean);
    return [{id:`${regionId}-${contract.id}`,...region,asset:FORM_PREVIEW_ASSETS.insurance,directEntry:true,title:`${region.title}／${contract.index}件目の契約`,overlays,note:'この契約を先頭の記入行に表示した例です。実際の用紙では同じ区分の空いている行に記入してください。長い名称は画像では省略する場合があります。全文は契約別一覧で確認できます。'}];
  });
}

const GUIDE_REGIONS = Object.freeze({
  dependentForm: { identity:['fuyouHead'], spouse:['fuyouSpouse'], relatives:['fuyouDependent'], 'special-status':['fuyouDisability'], 'resident-tax':['fuyouUnder16'] },
  combinedForm: { basic:['basicIncome','basicDeduction'], 'spouse-deduction':['combinedSpouse','spouseIncome','spouseDeduction'], 'specific-relative':['specificRelative'], 'income-adjustment':['incomeAdjustment'] },
  insuranceForm: { earthquake:['quake'], 'social-insurance':['social'], 'mutual-aid':['ideco'] },
  housingForm: { 'housing-docs':['housing'] }
});

export function formPreviewsForGuideSection(formId, section) {
  let regionIds=GUIDE_REGIONS[formId]?.[section.id]||[];
  if(formId==='combinedForm'&&section.id==='basic'&&section.fields.some(f=>f.key==='non-salary-income'&&f.value!=='0円')){
    regionIds=['basicIncome','basicOtherIncome','basicDeduction'];
  }
  if(formId==='insuranceForm'&&section.id==='life-insurance'){
    const hasPayment=categories=>categories.some(category=>section.fields.some(f=>f.key===`life-paid-${category}`&&f.value!=null&&f.value!=='0円'));
    regionIds=[
      ...(hasPayment(['新生命保険料','旧生命保険料'])?['lifeGeneral']:[]),
      ...(hasPayment(['介護医療保険料'])?['lifeCare']:[]),
      ...(hasPayment(['新個人年金保険料','旧個人年金保険料'])?['lifePension']:[])
    ];
    if(!regionIds.length)regionIds=['lifeGeneral','lifeCare','lifePension'];
    regionIds=[...regionIds,'lifeTotal'];
  }
  if(formId==='dependentForm'&&section.id==='special-status'){
    regionIds=[
      ...(section.fields.some(f=>f.key==='disability-status'&&f.status!=='not_applicable')?['fuyouDisability']:[]),
      ...(section.fields.some(f=>f.key==='parent-status'&&f.status!=='not_applicable')?['fuyouParent']:[]),
      ...(section.fields.some(f=>f.key==='student-status'&&f.status!=='not_applicable')?['fuyouStudent']:[])
    ];
  }
  const areas=regionIds.flatMap(id=>{
    const area={id,...REGIONS[id],asset:FORM_PREVIEW_ASSETS[REGIONS[id].asset],directEntry:formId!=='housingForm',example:EXAMPLES[id],overlays:overlaysForRegion(id,section)};
    // Each relative is illustrated in the first blank row, avoiding an assumed
    // paper order or dropping people when their number exceeds the printed rows.
    const incomePattern=id==='specificRelative'?/^specific-income-(\d+)$/:['fuyouDependent','fuyouUnder16'].includes(id)?/^dependent-(\d+)-income$/:null;
    if(!incomePattern)return [area];
    const people=section.fields.filter(f=>incomePattern.test(f.key));
    if(!people.length)return [area];
    return people.map(f=>{
      const person=f.key.match(incomePattern)[1];
      const box=id==='specificRelative'?[1742,1151,152,30]:id==='fuyouUnder16'?[1769,1425,93,27]:[1166,613,106,31];
      const overlays=[monetaryOverlay(section,f.key,box)];
      if(id==='specificRelative')overlays.push(monetaryOverlay(section,`specific-deduction-${person}`,[1945,1151,181,30]));
      return {...area,id:`${id}-${person}`,title:`${area.title}／${person}人目の親族`,overlays:overlays.filter(Boolean),note:'この親族の金額を先頭の記入行に表示した例です。実際の用紙では空いている行に記入してください。'};
    });
  });
  return [...areas,...contractPreviewAreas(section)];
}

const escapeSvg=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderFormPreviewSvg(area, showValues=true) {
  const {asset,crop,mark}=area,entries=showValues?(area.overlays||[]):[];
  const label=`国税庁様式の${area.title||area.section}${entries.length?`。${entries.map(e=>`${e.label}：${e.text}${e.status==='calculated'&&e.valueKind!=='text'?'円':''}`).join('、')}`:''}`;
  const values=entries.map(e=>{
    const [x,y,w,h]=e.box,known=e.status==='calculated';
    if(e.valueKind==='text'){
      const size=Math.min(w<=40?10:w<=65?12:h<=20?10:h<=40?15:21,h*.65),columns=Math.max(1,Math.floor((w-8)/size)),maxLines=Math.max(1,Math.min(3,Math.floor(h/(size*1.1))));
      const characters=Array.from(e.text),capacity=columns*maxLines;
      const display=characters.length>capacity?[...characters.slice(0,Math.max(0,capacity-1)),'…']:characters;
      const lines=Array.from({length:Math.ceil(display.length/columns)},(_,i)=>display.slice(i*columns,(i+1)*columns).join(''));
      return `<g data-form-key="${escapeSvg(e.key)}" class="v2-paper-value ${known?'is-calculated':'is-pending'}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${known?'#edf6ff':'#fff0d8'}" stroke="${known?'#6890ae':'#ac7334'}" stroke-width="1.5"/><text font-size="${size}" font-weight="700" font-family="Meiryo,Arial,sans-serif" fill="${known?'#16496e':'#8a4d16'}">${lines.map((line,i)=>`<tspan x="${x+4}" y="${y+(h-lines.length*size*1.1)/2+size*.9+i*size*1.1}">${escapeSvg(line)}</tspan>`).join('')}</text></g>`;
    }
    const size=Math.min(30,h*.72,(w-12)/(e.text.length*(known ? 0.61 : 1)));
    return `<g data-form-key="${escapeSvg(e.key)}" class="v2-paper-value ${known?'is-calculated':'is-pending'}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${known?'#edf6ff':'#fff0d8'}" stroke="${known?'#6890ae':'#ac7334'}" stroke-width="1.5"/><text x="${x+w-6}" y="${y+h/2+size*.35}" font-size="${size}" font-weight="700" font-family="Arial,Meiryo,sans-serif" text-anchor="end" fill="${known?'#16496e':'#8a4d16'}">${escapeSvg(e.text)}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="v2-paper-image" viewBox="${crop.join(' ')}" style="aspect-ratio:${crop[2]}/${crop[3]}" role="img" aria-label="${escapeSvg(label)}"><image href="${escapeSvg(asset.image)}" x="0" y="0" width="${asset.width}" height="${asset.height}"/>${mark?`<rect x="${mark[0]}" y="${mark[1]}" width="${mark[2]}" height="${mark[3]}" class="${area.directEntry?'v2-paper-highlight':'v2-paper-context'}" fill="${area.directEntry?'#ffe263':'#63b8e8'}" fill-opacity="${area.directEntry?'.16':'.12'}" stroke="${area.directEntry?'#e09c00':'#2678aa'}" stroke-width="8" vector-effect="non-scaling-stroke"/>`:''}${values}</svg>`;
}

const NO_DIRECT_ENTRY = new Set([
  'target','form','salaryLimit','changedJob','priorSlip','otherSalary','otherIncome','spouse','spouseShared','spouseClaimed','spouseAge','spouseIncomeType',
  'dependents','dependentCount','dependentKin','dependentAge','dependentIncome','dependentSalary','dependentShared',
  'disabilityFamily','parentStatus','deFactoPartner','parentChild','parentChildIncomeKnown','parentChildIncome','parentChildClaimed','widowGender','studentSchool',
  'life','lifeCount','lifeType','lifePaid','earthquake','earthquakeCount','earthquakeElection','earthquakePaid',
  'social','ideco','housing','housingFirst','housingDocs','housingBalance','special'
]);

const EXAMPLES = {
  fuyouHead:'例：扶養家族がいない方も、本人欄の氏名・住所等は配布された様式に記入します。',
  fuyouSpouse:'例：配偶者がいる場合、A欄の要件を確認して氏名・生年月日・所得見積額等を記入します。A欄と配偶者控除等申告書では要件が異なります。',
  fuyouDependent:'例：20歳の親族がいる場合、B欄の年齢・所得等の要件を確認します。給与収入をそのまま「所得の見積額」欄へ書きません。',
  fuyouUnder16:'例：12歳の子は、住民税に関する事項の「16歳未満の扶養親族」欄を確認します。',
  fuyouDisability:'例：一般障害者なら、C欄の該当区分・人数と「障害者又は勤労学生の内容」欄を確認します。',
  fuyouParent:'例：ひとり親の要件を満たす場合、C欄の「ひとり親」を確認します。婚姻状況だけで確定しません。',
  fuyouStudent:'例：勤労学生の要件を満たす場合、C欄を確認し、学校名・入学年月日等を記入します。',
  basicIncome:'例：給与収入が4,800,000円なら、給与所得(1)の「収入金額」に4,800,000円。所得金額は計算後の額を別欄へ記入します。',
  basicOtherIncome:'例：給与以外の所得がある場合、その所得金額を確認して(2)欄へ。収入額をそのまま書きません。',
  combinedSpouse:'例：配偶者の氏名・生年月日等は、この欄に記入します。アプリは個人情報を収集していません。',
  spouseIncome:'例：配偶者の給与収入1,240,000円なら、(1)の「収入金額」に1,240,000円。所得金額は計算後の額を別欄へ記入します。',
  specificRelative:'例：19～22歳の親族は、所得に応じてこの欄の記入候補になります。B欄の要件とは異なるため、結果画面の判定を確認します。',
  incomeAdjustment:'例：給与収入850万円超で該当要件がある場合、この欄にチェックします。控除額をこの欄へ直接書く欄はありません。',
  lifeGeneral:'例：新生命保険料の証明書の申告額80,000円を契約行の(a)欄へ。控除額は下の計算欄で別に求めます。',
  lifeCare:'例：介護医療保険料の証明書の申告額30,000円を契約行の(a)欄へ。控除額とは別の金額です。',
  lifePension:'例：個人年金保険料の証明書の申告額40,000円を契約行の(a)欄へ。控除額とは別の金額です。',
  quake:'例：地震保険料の証明額42,000円を契約行の支払額欄へ。地震保険料控除額は下の計算欄で求めます。',
  social:'例：給与天引き以外に支払った国民年金120,000円を「あなたが本年中に支払った保険料の金額」欄へ。',
  ideco:'例：給与天引き以外に本人が支払ったiDeCo掛金276,000円を、個人型年金加入者掛金の行へ。',
  housing:'記載例の金額は転記しません。2年目以降は手元の申告書と年末残高情報を照合します。初年度は原則として確定申告が必要です。'
};

function dependentRegion(routeId, answers) {
  if(!routeId.startsWith('dep:'))return 'fuyouDependent';
  const index=Number(routeId.split(':')[1]);
  const age=answers[`dep:${index}:age`];
  return Number.isInteger(age)&&age<16?'fuyouUnder16':'fuyouDependent';
}

function lifeRegion(routeId, answers) {
  if(!routeId.startsWith('life:'))return 'lifeGeneral';
  const category=answers[`life:${routeId.split(':')[1]}:type`];
  if(category==='介護医療保険料')return 'lifeCare';
  if(category?.includes('個人年金'))return 'lifePension';
  return 'lifeGeneral';
}

// For a payment or category question, outline its column within the official
// section. The app cannot select a particular paper row without knowing how
// the employee will group multiple certificates on that form.
function markForQuestion(key, regionId, defaultMark) {
  const lifePart=key.startsWith('life')?key.slice(4):null,earthquakePart=key.startsWith('earthquake')?key.slice(10):null;
  if(lifePart){
    const y=regionId==='lifeCare'?774:regionId==='lifePension'?1008:395,h=regionId==='lifeGeneral'?220:174;
    const columns={CompanyName:[138,236],InsuranceKind:[374,120],InsurancePeriod:[494,68],HolderName:[562,169],RecipientName:[731,238],RecipientRelationship:[933,36],PensionStartDate:[731,238]};
    if(columns[lifePart])return [columns[lifePart][0],y,columns[lifePart][1],h];
  }
  if(earthquakePart){
    const columns={CompanyName:[1343,153],InsuranceKind:[1496,120],InsurancePeriod:[1616,52],HolderName:[1668,202],InsuredName:[1668,202],InsuredRelationship:[1833,37]};
    if(columns[earthquakePart])return [columns[earthquakePart][0],433,columns[earthquakePart][1],226];
  }
  if(key==='spouseSalary')return [1132,577,218,56];
  if(key==='lifeAmount')return regionId==='lifeCare'?[1037,773,172,172]:regionId==='lifePension'?[1037,1008,172,180]:[1037,395,172,220];
  if(key==='lifeRecipient')return regionId==='lifeCare'?[731,773,238,172]:regionId==='lifePension'?[731,1008,238,180]:[731,395,238,220];
  if(key==='earthquakeAmount')return [1956,433,151,226];
  if(key==='earthquakeType')return [1870,433,85,226];
  if(key==='socialTypes')return [1360,1007,137,123];
  if(key==='socialAmount')return [1988,1007,202,123];
  if(key==='idecoType')return [1375,1264,613,263];
  if(key==='idecoAmount')return [1988,1264,202,263];
  return defaultMark;
}

export function formPreviewForQuestion(routeId, answers={}) {
  const key=baseQuestionId(routeId),page=pageForQuestion(routeId);
  let regionId;
  if(page==='salary')regionId=key==='ownSalary'||key==='allSalary'?'basicIncome':key==='otherIncome'?'basicOtherIncome':'fuyouHead';
  else if(page==='spouse')regionId=key==='spouseIncomeType'||key==='spouseSalary'?'spouseIncome':'combinedSpouse';
  else if(page==='dependents')regionId=dependentRegion(routeId,answers);
  else if(page==='personal')regionId=key.startsWith('disability')?'fuyouDisability':key.startsWith('student')?'fuyouStudent':'fuyouParent';
  else if(page==='life')regionId=lifeRegion(routeId,answers);
  else if(page==='earthquake')regionId='quake';
  else if(page==='social')regionId=key.startsWith('ideco')?'ideco':'social';
  else regionId=key==='special'?'fuyouHead':'housing';
  const region=REGIONS[regionId],asset=FORM_PREVIEW_ASSETS[region.asset];
  // During entry, show already answered contract fields in the same paper row.
  // An unanswered payment/payer is not an unknown payment and is left blank.
  const kind=routeId.startsWith('life:')?'life':routeId.startsWith('earthquake:')?'earthquake':null;
  const currentContract=kind?insuranceContractRows(answers,kind).find(c=>c.index===Number(routeId.split(':')[1])):null;
  const questionArea=currentContract?contractPreviewAreas({contracts:[{...currentContract,fields:currentContract.fields.filter(f=>!f.key.endsWith('-amount')||Object.hasOwn(answers,`${kind}:${currentContract.index}:amount`)&&Object.hasOwn(answers,`${kind}:${currentContract.index}:paid`))}]}).find(p=>p.asset===asset&&p.id.startsWith(regionId+'-')):null;
  const dependentIndex=routeId.startsWith('dep:')?Number(routeId.split(':')[1]):null;
  const age=dependentIndex===null?null:answers[`dep:${dependentIndex}:age`];
  const secondary=page==='dependents'&&Number.isInteger(age)&&age>=19&&age<23?'specificRelative':page==='spouse'?'fuyouSpouse':null;
  const note=currentContract?.placement.location==='supplement'?`${currentContract.placement.label}へ記載します。紙の記載欄を超えるため、画像の先頭行にはこの契約を重ねません。結果画面から添付別紙明細をPDF保存・印刷できます。`:
    dependentIndex!==null&&age==='分からない'?'年齢が未確定のため、B欄と16歳未満欄のどちらかを確定できません。生年月日を確認してください。':
    dependentIndex!==null&&dependentIndex>4?'紙の様式に収まらない親族の記入方法は、勤務先の案内を確認してください。':
    key==='special'?'事情ごとに記入欄が異なるため、ここでは共通の記入欄を示しません。':
    page==='housing'?'この画像は国税庁の記載例です。住宅・借入条件によって用紙が異なります。':null;
  return {
    routeId, section:key==='special'?'特殊ケースの確認：共通の記入欄はありません':QUESTIONS[key]?.entryLabel?`${region.title}／${QUESTIONS[key].entryLabel}`:region.title,
    example:key==='special'?'例：国外居住親族がいる場合は、該当する申告書の欄と必要書類を会社担当者へ確認します。':EXAMPLES[regionId],
    directEntry:currentContract?.placement.location!=='supplement'&&!NO_DIRECT_ENTRY.has(key),
    overlays:questionArea?.overlays||[],
    note,
    asset, crop:region.crop, mark:key==='special'?null:markForQuestion(key,regionId,region.mark),
    secondary:secondary?{...REGIONS[secondary],asset:FORM_PREVIEW_ASSETS[REGIONS[secondary].asset],example:EXAMPLES[secondary],directEntry:false}:null
  };
}
