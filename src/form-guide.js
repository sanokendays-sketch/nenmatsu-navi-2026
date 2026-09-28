import { contractAnswer } from './state.js';
import { TAX_RULES_2026 } from './rules-2026.js';
import { assignInsurancePlacements, buildInsuranceSupplement } from './insurance-layout.js';
// Tax calculations stay in calculations.js. This module maps their results to
// the actual Reiwa 8 form labels and keeps presentation markup out of that layer.
const statusFor = value => value === 'calculated' || value === 'candidate'
  ? 'calculated'
  : value === 'not_applicable' || value === 'not-qualified' || value === 'no-deduction-by-age'
    ? 'not_applicable'
    : 'needs_confirmation';

const field = (key, label, value, status = value === null || value === undefined ? 'needs_confirmation' : 'calculated', note = '') => ({ key, label, value, status, note });
const yen = n => Number.isFinite(n) ? `${n.toLocaleString('ja-JP')}円` : null;
const moneyField = (key, label, value, status = value === null || value === undefined ? 'needs_confirmation' : 'calculated', note = '') => field(key, label, yen(value), status, note);

function dependentForm(a, c) {
  const limits = TAX_RULES_2026.withholdingForm;
  const spouseKnownOutside = Number.isFinite(c.totalIncome) && c.totalIncome > limits.taxpayerSpouseIncomeMax
    || Number.isFinite(c.spouse.totalIncome) && c.spouse.totalIncome > limits.spouseIncomeMax;
  const showSpouse = a.spouse === 'はい' && !spouseKnownOutside;
  const people = (c.dependents || []).map(d => {
    const special = d.specificRelative?.amount > 0;
    const status = !d.ageGroup || d.deduction?.status === 'unknown' || d.deduction?.status === 'needs-review' || d.deduction?.status === 'needs-income-details' || d.specificRelative?.type === 'unknown'
      ? 'needs_confirmation'
      : d.deduction?.amount > 0 || special ? 'calculated' : d.ageGroup === 'under16' ? 'calculated' : 'not_applicable';
    const knownOutside = Number.isFinite(d.income) && d.income > (d.ageGroup === '19to22' ? limits.specificRelativeIncomeMax : TAX_RULES_2026.thresholds.dependentIncome);
    return {
      knownOutside,
      title: `${d.index}人目の親族`, status,
      fields: [
        field(`dependent-${d.index}-identity`, '氏名・フリガナ・続柄・生年月日', null, 'incomplete', 'この扶養親族の氏名等は本人が様式に記入してください。'),
        field(`dependent-${d.index}-classification`, d.ageGroup === 'under16' ? '住民税に関する事項／16歳未満の扶養親族' : 'B 源泉控除対象親族の候補区分', special ? '特定親族特別控除の候補あり' : d.deduction?.amount > 0 ? '扶養親族控除の候補あり' : d.ageGroup === 'under16' ? '記入候補' : '今回の回答では記入候補なし', status, '年齢・所得・生計・申告重複等の条件を会社の資料と照合してください。'),
        field(`dependent-${d.index}-income`, '令和8年中の所得の見積額', yen(d.income), d.income === null ? 'needs_confirmation' : 'calculated'),
        ...(d.deduction?.amount > 0 ? [moneyField(`dependent-${d.index}-deduction`, '扶養控除の候補額（申告書の所得見積額欄とは別）', d.deduction.amount)] : []),
        ...(special ? [moneyField(`dependent-${d.index}-specific-relative`, '特定親族特別控除の額（候補）', d.specificRelative.amount)] : [])
      ],
    };
  }).filter(person => !person.knownOutside);
  const relevant = people.length > 0 || a.spouse === 'はい' || c.deductions.disability.status !== 'not_applicable' || c.deductions.singleParentOrWidow.status !== 'not_applicable' || c.deductions.workingStudent.status !== 'not_applicable';
  const sections = [
    { id: 'identity', title: '本人欄', status: 'incomplete', fields: [field('taxpayer-identity', 'あなたの氏名・住所又は居所等', null, 'incomplete', '氏名、住所などは配布された様式に本人が記入してください。個人番号欄は会社の案内に従ってください。')] },
    ...(showSpouse ? [{ id: 'spouse', title: 'A 源泉控除対象配偶者', status: 'needs_confirmation', fields: [field('spouse-identity', '配偶者の氏名・生年月日・所得見積額等', null, 'incomplete', '本人の合計所得900万円以下・配偶者の合計所得95万円以下など、A欄の記載要件を会社の案内で確認してください。'),moneyField('withholding-spouse-income','令和8年中の所得の見積額',c.spouse.totalIncome)] }] : []),
    ...(people.some(x => !x.fields.some(f => f.key.endsWith('-classification') && f.label.includes('16歳未満'))) ? [{ id: 'relatives', title: 'B 源泉控除対象親族', status: people.filter(x => !x.fields.some(f => f.key.endsWith('-classification') && f.label.includes('16歳未満'))).some(x => x.status === 'needs_confirmation') ? 'needs_confirmation' : 'calculated', fields: people.filter(x => !x.fields.some(f => f.key.endsWith('-classification') && f.label.includes('16歳未満'))).flatMap(x => x.fields) }] : []),
    ...((c.deductions.disability.status !== 'not_applicable' || c.deductions.singleParentOrWidow.status !== 'not_applicable' || c.deductions.workingStudent.status !== 'not_applicable') ? [{ id: 'special-status', title: 'C 障害者、寡婦、ひとり親又は勤労学生', status: [c.deductions.disability,c.deductions.singleParentOrWidow,c.deductions.workingStudent].some(x => x.status === 'needs_confirmation') ? 'needs_confirmation' : 'calculated', fields: [
      field('disability-status', '障害者の区分・該当する事実', c.deductions.disability.status === 'calculated' ? '該当候補あり' : null, c.deductions.disability.status === 'calculated' ? 'calculated' : statusFor(c.deductions.disability.status), '障害者手帳等の種類、交付年月日、等級などを本人が記入してください。'),
      field('parent-status', '寡婦又はひとり親', c.deductions.singleParentOrWidow.status === 'calculated' ? c.deductions.singleParentOrWidow.type === 'single_parent' ? 'ひとり親候補' : '寡婦候補' : null, statusFor(c.deductions.singleParentOrWidow.status)),
      field('student-status', '勤労学生', c.deductions.workingStudent.status === 'calculated' ? '該当候補あり' : null, statusFor(c.deductions.workingStudent.status), '該当する場合は学校名・入学年月日・所得の種類と見積額も様式に記入します。')
    ] }] : []),
    ...(people.some(x => x.fields.some(f => f.key.endsWith('-classification') && f.label.includes('16歳未満'))) ? [{ id: 'resident-tax', title: '住民税に関する事項／16歳未満の扶養親族', status: 'calculated', fields: people.filter(x => x.fields.some(f => f.key.endsWith('-classification') && f.label.includes('16歳未満'))).flatMap(x => x.fields) }] : [])
  ];
  const formStatus = sections.some(s => s.status === 'needs_confirmation') ? 'needs_confirmation' : sections.some(s => s.status === 'incomplete') ? 'incomplete' : 'calculated';
  return { id: 'dependentForm', title: '給与所得者の扶養控除等（異動）申告書', required: true, relevant, status: formStatus, sourceLabels: ['あなたの氏名', 'あなたの住所又は居所', 'A 源泉控除対象配偶者', 'B 源泉控除対象親族', 'C 障害者、寡婦、ひとり親又は勤労学生', '住民税に関する事項', '16歳未満の扶養親族'], sections };
}

function combinedForm(a, r) {
  const c = r.calculations;
  const known = c.totalIncome !== null;
  const spouseStatus = a.spouse !== 'はい' ? 'not_applicable' : c.spouse.deduction.amount === null || c.spouse.deduction.status === 'unknown' ? 'needs_confirmation' : c.spouse.deduction.amount > 0 ? 'calculated' : 'not_applicable';
  const relatives = c.dependents.filter(x => x.ageGroup === '19to22' && (x.specificRelative?.amount > 0 || x.specificRelative?.type === 'unknown'));
  const incomeAdjustmentStatus = c.grossSalary === null || c.grossSalary <= 8500000 ? 'not_applicable' : c.incomeAdjustmentDeduction === null ? 'needs_confirmation' : c.incomeAdjustmentDeduction > 0 ? 'calculated' : 'not_applicable';
  const sections = [
    { id: 'basic', title: '基礎控除申告書', status: known ? 'calculated' : 'needs_confirmation', fields: [
      moneyField('salary-revenue', '給与所得の収入金額', c.grossSalary, c.grossSalary === null ? 'needs_confirmation' : 'calculated', 'すべての勤務先分の給与収入を合算します。'),
      moneyField('salary-income', '給与所得の所得金額', c.adjustedSalaryIncome, c.adjustedSalaryIncome === null ? 'needs_confirmation' : 'calculated', '所得金額調整控除がある場合は、その控除後の金額を記入します。'),
      field('non-salary-income', '給与所得以外の所得の合計額', a.otherIncome === 'ない' ? '0円' : null, a.otherIncome === 'ない' ? 'calculated' : 'needs_confirmation', a.otherIncome === 'ない' ? '' : '給与以外の所得がある場合は所得の種類ごとの所得金額を確認してください。'),
      moneyField('total-income', 'あなたの本年中の合計所得金額の見積額', c.totalIncome, known ? 'calculated' : 'needs_confirmation'),
      moneyField('basic-deduction', '基礎控除の額', c.basicDeduction, c.basicDeduction === null ? 'needs_confirmation' : 'calculated')
    ] },
    ...(a.spouse === 'はい' ? [{ id: 'spouse-deduction', title: '配偶者控除等申告書', status: spouseStatus, fields: [
      moneyField('spouse-salary-revenue', '配偶者の給与収入金額', a.spouseIncomeType === '給与だけ' ? a.spouseSalary : null, a.spouseIncomeType === '給与だけ' && Number.isFinite(Number(a.spouseSalary)) ? 'calculated' : 'needs_confirmation'),
      moneyField('spouse-income', '配偶者の本年中の合計所得金額の見積額', c.spouse.totalIncome, c.spouse.totalIncome === null ? 'needs_confirmation' : 'calculated'),
      field('spouse-judgement', '判定', c.spouse.deduction.type === 'spouse' ? '配偶者控除候補' : c.spouse.deduction.type === 'special' ? '配偶者特別控除候補' : spouseStatus === 'not_applicable' ? '対象外候補' : null, spouseStatus),
      moneyField('spouse-deduction', c.spouse.deduction.type === 'special' ? '配偶者特別控除の額' : '配偶者控除の額', c.spouse.deduction.amount, spouseStatus)
    ] }] : []),
    ...(relatives.length ? [{ id: 'specific-relative', title: '特定親族特別控除申告書', status: relatives.some(x => x.specificRelative?.type === 'unknown') ? 'needs_confirmation' : 'calculated', fields: relatives.flatMap(x => [
      field(`specific-relative-${x.index}`, `該当者（${x.index}人目）`, '該当候補あり', x.specificRelative?.type === 'unknown' ? 'needs_confirmation' : 'calculated', '氏名・続柄・生年月日は本人が記入してください。'),
      moneyField(`specific-income-${x.index}`, '特定親族の本年中の合計所得金額の見積額', x.income, x.income === null ? 'needs_confirmation' : 'calculated'),
      moneyField(`specific-deduction-${x.index}`, '特定親族特別控除の額', x.specificRelative?.amount, x.specificRelative?.amount === null ? 'needs_confirmation' : 'calculated')
    ]) }] : []),
    ...(c.grossSalary !== null && c.grossSalary > 8500000 ? [{ id: 'income-adjustment', title: '所得金額調整控除申告書', status: incomeAdjustmentStatus, fields: [
      field('income-adjustment-eligibility', '要件', incomeAdjustmentStatus === 'calculated' ? '対象候補' : null, incomeAdjustmentStatus),
      moneyField('income-adjustment-amount', '所得金額調整控除額（参考）', c.incomeAdjustmentDeduction, incomeAdjustmentStatus, 'この申告書の所得金額調整控除欄に金額の記入欄はありません。要件と該当親族等を記入し、控除後の給与所得は基礎控除申告書へ転記します。')
    ] }] : [])
  ];
  return { id: 'combinedForm', title: '給与所得者の基礎控除申告書 兼 配偶者控除等申告書 兼 特定親族特別控除申告書 兼 所得金額調整控除申告書', required: true, relevant: true, status: sections.some(s => s.status === 'needs_confirmation') ? 'needs_confirmation' : 'calculated', sections };
}

function insuranceForm(a, r) {
  const d = r.calculations.deductions;
  const sections = [];
  if (a.life === 'はい') {
    const x = d.lifeInsurance, totals = x.totals || {};
    const categories = [
      ['新生命保険料', totals['新生命保険料'] || 0], ['旧生命保険料', totals['旧生命保険料'] || 0], ['介護医療保険料', totals['介護医療保険料'] || 0], ['新個人年金保険料', totals['新個人年金保険料'] || 0], ['旧個人年金保険料', totals['旧個人年金保険料'] || 0]
    ];
    sections.push({ id: 'life-insurance', title: '生命保険料控除', status: statusFor(x.status), contracts:insuranceContractRows(a,'life'), fields: [
      ...categories.map(([label, amount]) => moneyField(`life-paid-${label}`, `申告書へ記入する支払保険料等の合計：${label}`, x.status === 'needs_confirmation' ? null : amount, x.status === 'needs_confirmation' ? 'needs_confirmation' : x.status === 'not_applicable' ? 'not_applicable' : 'calculated', '契約ごとの証明額をこの区分内で合算した金額です。支払額であり、控除額ではありません。')),
      ...[['generalLife','life-general-deduction','一般の生命保険料の控除額'],['careMedical','life-care-deduction','介護医療保険料の控除額'],['pension','life-pension-deduction','個人年金保険料の控除額']].filter(([key])=>x.categories?.[key]>0).map(([key,id,label])=>moneyField(id,label,x.categories[key],statusFor(x.status))),
      moneyField('life-deduction-amount', '計算後の生命保険料控除額（申告書の控除額欄）', x.amount, statusFor(x.status)),
      field('life-23-exception', '年齢23歳未満の扶養親族を有する場合の特例', x.under23ExceptionApplied ? '該当候補' : null, x.status === 'needs_confirmation' ? 'needs_confirmation' : x.under23ExceptionApplied ? 'calculated' : 'not_applicable', '該当時は様式の特例欄も記載します。')
    ] });
  }
  if (a.earthquake === 'はい') {
    const x = d.earthquake;
    sections.push({ id: 'earthquake', title: '地震保険料控除', status: statusFor(x.status), contracts:insuranceContractRows(a,'earthquake'), fields: [
      moneyField('earthquake-paid', '申告書へ記入する地震保険料の支払額合計', x.quakePremium, statusFor(x.status)),
      moneyField('old-long-term-paid', '申告書へ記入する旧長期損害保険料の支払額合計', x.oldLongTermPremium, statusFor(x.status)),
      moneyField('earthquake-deduction', '計算後の地震保険料控除額', x.amount, statusFor(x.status))
    ] });
  }
  if (a.social === 'はい') {
    const x = d.socialInsurance;
    sections.push({ id: 'social-insurance', title: '社会保険料控除（給与天引き以外に本人が支払ったもの）', status: statusFor(x.status), fields: [
      field('social-types', '社会保険の種類', (a.socialTypes || []).join('、') || null, (a.socialTypes || []).length ? 'calculated' : 'needs_confirmation'),
      moneyField('social-paid', 'あなたが本年中に支払った保険料の金額', x.amount, statusFor(x.status), '給与から差し引かれた金額はここへ重ねて記入しません。複数種類の場合、この金額は合計です。支払先別の各行へ同じ合計を繰り返し記入せず、内訳を確認してください。'),
      moneyField('social-deduction', '社会保険料控除額', x.amount, statusFor(x.status))
    ] });
  }
  if (a.ideco === 'はい') {
    const x = d.smallBusinessMutualAid;
    sections.push({ id: 'mutual-aid', title: '小規模企業共済等掛金控除', status: statusFor(x.status), fields: [
      field('mutual-aid-type', '掛金の種類', a.idecoType || null, x.status === 'needs_confirmation' ? 'needs_confirmation' : 'calculated'),
      moneyField('mutual-aid-paid', 'あなたが本年中に支払った掛金の金額', x.amount, statusFor(x.status), '給与から差し引かれた掛金はここへ重ねて記入しません。'),
      moneyField('mutual-aid-deduction', '小規模企業共済等掛金控除額', x.amount, statusFor(x.status))
    ] });
  }
  const entryStatuses=sections.flatMap(s=>(s.contracts||[]).map(c=>c.status));
  return { id: 'insuranceForm', title: '給与所得者の保険料控除申告書', required: sections.length > 0, relevant: sections.length > 0, status: sections.some(s => s.status === 'needs_confirmation')||entryStatuses.includes('needs_confirmation') ? 'needs_confirmation' : entryStatuses.includes('incomplete')?'incomplete':sections.length ? 'calculated' : 'not_applicable', sections, supplement:buildInsuranceSupplement(sections) };
}

function housingForm(a) {
  if (a.housing !== 'はい') return null;
  const firstYear = a.housingFirst === 'はい';
  const knownYear = firstYear || a.housingFirst === 'いいえ';
  const status = knownYear ? firstYear ? 'needs_confirmation' : 'needs_confirmation' : 'needs_confirmation';
  return {
    id: 'housingForm', title: firstYear ? '住宅ローン控除（初年度の確定申告）' : '給与所得者の住宅借入金等特別控除申告書', required: !firstYear, relevant: true, status,
    notice: firstYear ? '初年度は原則として確定申告が必要です。年末調整での控除計算は行いません。' : a.housingFirst === 'いいえ' ? '2年目以降は年末調整で住宅ローン控除を受けられる場合があります。勤務先の案内で提出可否を確認してください。' : '適用初年度か確認してください。',
    sections: [{ id: 'housing-docs', title: firstYear ? '確定申告の準備' : '2年目以降の年末調整の準備', status: 'needs_confirmation', fields: [
      field('housing-year', '控除を受ける初年度か', firstYear ? '初年度' : a.housingFirst === 'いいえ' ? '2年目以降' : null, knownYear ? 'calculated' : 'needs_confirmation'),
      field('housing-declaration', firstYear ? '確定申告書・住宅借入金等特別控除額の計算明細書等' : '年末調整のための住宅借入金等特別控除申告書兼控除証明書', null, 'needs_confirmation', firstYear ? '必要書類は住宅・借入・居住等の要件で異なります。税務署等の最新案内をご確認ください。' : '2年目以降、税務署から交付された該当年分の申告書を用意します。'),
      field('housing-balance', firstYear ? '住宅取得資金等の年末残高情報・証明書類' : '住宅取得資金に係る借入金の年末残高等証明書又は調書方式の年末残高等情報', null, 'needs_confirmation', '調書方式か証明書方式かにより準備物が異なります。'),
      field('housing-amount', '住宅ローン控除額', null, 'needs_confirmation', 'このアプリでは計算しません。')
    ] }]
  };
}

export function buildFormGuide(result) {
  const a = result?.a || {}, c = result?.calculations || {};
  const safe = { ...result, calculations: {
    grossSalary: null, salaryIncome: null, incomeAdjustmentDeduction: null, adjustedSalaryIncome: null, totalIncome: null, basicDeduction: null,
    spouse: { grossIncome: null, totalIncome: null, deduction: { type: 'none', amount: null, status: 'unknown' } }, dependents: [],
    deductions: {
      lifeInsurance: {status:'not_applicable',amount:0,totals:{}}, earthquake:{status:'not_applicable',amount:0,quakePremium:0,oldLongTermPremium:0},
      socialInsurance:{status:'not_applicable',amount:0}, smallBusinessMutualAid:{status:'not_applicable',amount:0},
      disability:{status:'not_applicable',amount:0}, singleParentOrWidow:{status:'not_applicable',amount:0}, workingStudent:{status:'not_applicable',amount:0}
    }, ...c,
    spouse: { grossIncome: null, totalIncome: null, deduction: { type: 'none', amount: null, status: 'unknown' }, ...(c.spouse || {}) },
    deductions: {lifeInsurance:{status:'not_applicable',amount:0,totals:{}}, earthquake:{status:'not_applicable',amount:0,quakePremium:0,oldLongTermPremium:0}, socialInsurance:{status:'not_applicable',amount:0},smallBusinessMutualAid:{status:'not_applicable',amount:0},disability:{status:'not_applicable',amount:0},singleParentOrWidow:{status:'not_applicable',amount:0},workingStudent:{status:'not_applicable',amount:0},...(c.deductions||{})}
  } };
  const forms = [dependentForm(a, safe.calculations), combinedForm(a, safe)];
  const insurance = insuranceForm(a, safe);
  if (insurance.relevant) forms.push(insurance);
  const housing = housingForm(a);
  if (housing) forms.push(housing);
  const requiredDocuments = new Set(result?.docs || []);
  const staffConfirmations = new Set(result?.confirmations || []);
  if(a.social==='はい'&&(a.socialTypes||[]).length>1){
    staffConfirmations.add('複数種類の社会保険料を合計額で入力しています。支払先・負担する人ごとの内訳を確認し、申告書の2行に収まらない場合は任意様式の別紙へ記載して添付してください。アプリではこの内訳を自動配分しません。');
  }
  if(insurance.supplement.required){
    requiredDocuments.add('保険料控除申告書の添付別紙明細（記載欄を超えた契約分）');
    staffConfirmations.add('保険契約が記載欄を超えています。勤務先指定の別紙様式・提出方法があれば、それに従ってください。');
  }
  if (a.housing === 'はい' && a.housingFirst === 'はい') requiredDocuments.add('住宅ローン控除の初年度の確定申告に必要な書類（住宅・借入・居住等の要件により異なります）');
  return {
    forms,
    requiredDocuments: [...requiredDocuments],
    staffConfirmations: [...staffConfirmations],
    submissionChecklist: ['氏名を書いた', '住所を書いた', '会社指定の個人情報欄を確認した', '配偶者・扶養家族情報を記入した', '控除証明書をそろえた', '必要な申告書を確認した', '転記した金額を確認した', ...(insurance.supplement.required?['別紙明細に氏名・勤務先を書き、申告書と必要な証明書をそろえて提出する']:[])]
  };
}

// Labels follow the 2026 NTA insurance-premium return. Personal names are only
// taken from explicit answers; categories such as "本人" are never used as names.
export function insuranceContractRows(a,kind) {
  const life=kind==='life',count=Number(a[life?'lifeCount':'earthquakeCount'])||0;
  const labels=life?{companyName:'保険会社等の名称',insuranceKind:'保険等の種類',insurancePeriod:'保険期間又は年金支払期間',holderName:'保険等の契約者の氏名',recipientName:'保険金等の受取人の氏名',recipientRelationship:'あなたとの続柄'}:
    {companyName:'保険会社等の名称',insuranceKind:'保険等の種類（目的）',insurancePeriod:'保険期間',holderName:'保険等の契約者の氏名',insuredName:'保険等の対象となった家屋等に居住又は家財を利用している者の氏名',insuredRelationship:'あなたとの続柄'};
  const records=Array.from({length:count},(_,n)=>{
    const index=n+1,p=`${kind}:${index}:`,category=a[p+'type'],payer=a[p+'paid'];
    if(payer==='いいえ')return null;
    const pension=life&&String(category).includes('個人年金');
    const entries=Object.entries({...labels,...(pension?{pensionStartDate:'支払開始日'}:{})});
    const fields=entries.map(([key,label])=>{
      const raw=key==='recipientRelationship'&&['本人','配偶者'].includes(a[p+'recipient'])?a[p+'recipient']:contractAnswer(p+key,a);
      const known=typeof raw==='string'&&raw.trim()&&raw!=='分からない';
      return field(`${kind}-contract-${index}-${key}`,label,known?raw:null,known?'calculated':raw==='分からない'?'needs_confirmation':'incomplete');
    });
    const selected=category==='両方'?a[p+'election']:category;
    fields.push(field(`${kind}-contract-${index}-category`,life?'新・旧の区分':'地震保険料又は旧長期損害保険料区分',life?(category?.startsWith('新')?'新':category?.startsWith('旧')?'旧':null):selected,['新生命保険料','旧生命保険料','新個人年金保険料','旧個人年金保険料','地震保険料','旧長期損害保険料'].includes(selected)?'calculated':category==='介護医療保険料'?'not_applicable':'needs_confirmation'));
    const amount=a[p+'amount'],knownAmount=typeof amount==='number'&&Number.isFinite(amount)&&amount>=0;
    fields.push(moneyField(`${kind}-contract-${index}-amount`,'あなたが本年中に支払った保険料等の金額',knownAmount?amount:null,knownAmount&&payer==='はい'?'calculated':'needs_confirmation','この契約の支払額です。控除額ではありません。'));
    return {id:`${kind}-contract-${index}`,index,category:selected,pension,status:fields.some(f=>f.status==='needs_confirmation')?'needs_confirmation':fields.some(f=>f.status==='incomplete')?'incomplete':'calculated',fields};
  }).filter(Boolean);
  return assignInsurancePlacements(records);
}

