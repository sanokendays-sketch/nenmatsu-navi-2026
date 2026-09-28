import { TAX_RULES_2026 as R } from './rules-2026.js';

const amountOk = n => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n)) && Number(n) >= 0;
const result = (status, amount = null, details = {}) => ({ status, amount, ...details });

function formulaAmount(premium, table) {
  if (!amountOk(premium)) return null;
  const n = Number(premium), row = table.find(x => n <= x.max);
  // NTA materials allow fractional-yen deduction results to be rounded up.
  return row ? Math.ceil(n * row.rate + row.offset) : null;
}

// NTA No.1140: aggregate paid premiums by category, then apply new/old combination caps.
export function calculateLifeInsuranceDeduction(contracts = [], hasUnder23Dependent = false) {
  if (!Array.isArray(contracts)) return result('needs_confirmation', null, { reason: '契約データが配列ではありません。' });
  const totals = Object.fromEntries(Object.values(R.lifeInsurance.categories).map(k => [k, 0]));
  let incomplete = false, paidCount = 0;
  for (const c of contracts) {
    if (c?.payer === 'いいえ') continue;
    if (c?.payer !== 'はい' || !Object.hasOwn(totals, c?.category) || !amountOk(c?.amount)) { incomplete = true; continue; }
    // 国税庁 107.pdf p.21：個人年金の受取人は本人又は配偶者。他区分は親族も可。
    const allowedRecipients = c.category.includes('個人年金') ? ['本人','配偶者'] : ['本人','配偶者','親族'];
    if (Object.hasOwn(c,'beneficiary') && !allowedRecipients.includes(c.beneficiary)) { incomplete = true; continue; }
    paidCount++;
    totals[c.category] += Number(c.amount);
  }
  if (incomplete) return result('needs_confirmation', null, { totals, reason: '生命保険の支払者・受取人・区分・支払額を証明書と会社担当者へ確認してください。' });
  const r = R.lifeInsurance, cat = r.categories;
  const newLifePremium = totals[cat.newLife], oldLifePremium = totals[cat.oldLife];
  if (hasUnder23Dependent === null && newLifePremium > 0) return result('needs_confirmation', null, { totals, reason: '23歳未満の扶養親族の所得・親族関係を確認して、生命保険料控除の特例の適否を確定してください。' });
  const newLife = formulaAmount(newLifePremium, hasUnder23Dependent ? r.newLifeSpecialFormula : r.newFormula);
  const oldLife = formulaAmount(oldLifePremium, r.oldFormula);
  // 令和8年分「年末調整のしかた」p.24：新のみ・旧のみ・併用の最大額。
  // 特例では旧保険料が6万円超でも、新旧併用を最高6万円で比較する。
  const generalLife = Math.max(newLife, oldLife,
    Math.min(newLife + oldLife, hasUnder23Dependent ? r.caps.under23NewLife : r.caps.mixedCategory));
  const careMedical = Math.min(formulaAmount(totals[cat.careMedical], r.newFormula), r.caps.newCategory);
  const newPension = formulaAmount(totals[cat.newPension], r.newFormula), oldPension = formulaAmount(totals[cat.oldPension], r.oldFormula);
  const pension = Math.max(newPension, oldPension, Math.min(newPension + oldPension, r.caps.mixedCategory));
  const amount = Math.min(generalLife + careMedical + pension, r.caps.total);
  return result(paidCount ? 'calculated' : 'not_applicable', paidCount ? amount : 0,
    { totals, categories: { generalLife, careMedical, pension }, under23ExceptionApplied: Boolean(hasUnder23Dependent && newLifePremium > 0) });
}

// NTA No.1145: records are per certificate/contract to support election for dual-covered contracts.
export function calculateEarthquakeDeduction(records = []) {
  if (!Array.isArray(records)) return result('needs_confirmation');
  const r = R.earthquakeInsurance; let quake = 0, old = 0, incomplete = false, paidCount = 0;
  for (const x of records) {
    if (x?.payer === 'いいえ') continue;
    if (x?.payer !== 'はい' || !amountOk(x?.amount) || !['地震保険料','旧長期損害保険料','両方'].includes(x?.category)) { incomplete = true; continue; }
    paidCount++;
    const n = Number(x.amount);
    if (x.category === '両方') {
      if (!['地震保険料','旧長期損害保険料'].includes(x.election)) { incomplete = true; continue; }
      if (x.election === '地震保険料') quake += n; else old += n;
    } else if (x.category === '地震保険料') quake += n; else old += n;
  }
  if (incomplete) return result('needs_confirmation', null, { quakePremium: quake, oldLongTermPremium: old, reason: '支払者・区分または同一契約の選択が未確定です。' });
  const quakeDeduction = Math.min(quake, r.earthquakeCap);
  // NTA No.1145 calculation; fractional-yen results are rounded up per NTA procedure materials.
  const oldDeduction = old <= r.oldLongTermFullLimit ? old : old <= r.oldLongTermHalfLimit ? Math.ceil(old * r.oldLongTermHalfRate + r.oldLongTermOffset) : r.oldLongTermCap;
  return result(paidCount ? 'calculated' : 'not_applicable', paidCount ? Math.min(quakeDeduction + oldDeduction, r.totalCap) : 0,
    { quakePremium: quake, oldLongTermPremium: old, quakeDeduction, oldLongTermDeduction: oldDeduction });
}

export function calculateSocialInsuranceDeduction(payments = [], status = 'はい') {
  if (status === 'いいえ') return result('not_applicable', 0);
  if (status !== 'はい' || !Array.isArray(payments) || !payments.length || payments.some(x => !amountOk(x?.amount))) return result('needs_confirmation');
  return result(payments.length ? 'calculated' : 'not_applicable', payments.reduce((s, x) => s + Number(x.amount), 0));
}

export function calculateSmallBusinessMutualAidDeduction(payments = [], status = 'はい') {
  if (status === 'いいえ') return result('not_applicable', 0);
  if (status !== 'はい' || !Array.isArray(payments) || !payments.length || payments.some(x => !amountOk(x?.amount) || !R.smallBusinessMutualAid.eligible.includes(x?.type))) return result('needs_confirmation');
  return result(payments.length ? 'calculated' : 'not_applicable', payments.reduce((s, x) => s + Number(x.amount), 0));
}

// eligible is true only after same-living spouse/dependent and tax-law disability status are established.
export function calculateDisabilityDeduction(person = {}) {
  if (person.status === '分からない' || person.eligible === null || person.level === '分からない') return result('needs_confirmation');
  if (person.eligible === false || person.level === 'なし') return result('not_applicable', 0);
  if (person.level === '一般障害者') return result('calculated', R.disabilityDeduction.general);
  if (person.level === '特別障害者') {
    if (person.taxpayer === true) return result('calculated', R.disabilityDeduction.special);
    if (person.cohabiting === true) return result('calculated', R.disabilityDeduction.cohabitingSpecial);
    if (person.cohabiting === false) return result('calculated', R.disabilityDeduction.special);
    return result('needs_confirmation');
  }
  return result('needs_confirmation');
}

export function calculateFamilyDisabilityDeduction(people = []) {
  if (!Array.isArray(people)) return result('needs_confirmation');
  const items = people.map(calculateDisabilityDeduction);
  if (items.some(x => x.status === 'needs_confirmation')) return result('needs_confirmation', null, { people: items });
  const applicable = items.filter(x => x.status === 'calculated');
  return result(applicable.length ? 'calculated' : 'not_applicable', applicable.reduce((s, x) => s + x.amount, 0), { people: items });
}

export function calculateSingleParentOrWidow({ maritalStatus, deFactoPartner, hasQualifyingChild, hasDependent, widowGender, taxpayerTotalIncome, childIncome, childClaimedElsewhere } = {}) {
  if (!maritalStatus || deFactoPartner === '分からない') return result('needs_confirmation');
  if (maritalStatus === '分からない' || hasQualifyingChild === '分からない') return result('needs_confirmation');
  if (maritalStatus === '婚姻中' || deFactoPartner === 'はい') return result('not_applicable', 0);
  if (!amountOk(taxpayerTotalIncome)) return result('needs_confirmation');
  const isSingleParent = maritalStatus === '未婚' || maritalStatus === '離婚' || maritalStatus === '死別・生死不明';
  if(isSingleParent&&hasQualifyingChild===true&&(!amountOk(childIncome)||childClaimedElsewhere==='分からない'||childClaimedElsewhere===null||childClaimedElsewhere===undefined)) return result('needs_confirmation');
  const childQualifies = hasQualifyingChild === true && amountOk(childIncome) && childIncome <= R.singleParentDeduction.childIncomeMax && childClaimedElsewhere === false;
  if (isSingleParent && childQualifies && taxpayerTotalIncome <= R.singleParentDeduction.incomeMax) return result('calculated', R.singleParentDeduction.amount, { type: 'single_parent' });
  const widowMayApply=maritalStatus==='死別・生死不明'||maritalStatus==='離婚'&&hasDependent!==false;
  if(widowMayApply&&widowGender==='分からない'||widowMayApply&&widowGender===undefined) return result('needs_confirmation');
  if(widowMayApply&&widowGender===true&&taxpayerTotalIncome<=R.widowDeduction.incomeMax&&(maritalStatus!=='離婚'||hasDependent===true)) return result('calculated',R.widowDeduction.amount,{type:'widow'});
  if(maritalStatus==='離婚'&&hasDependent===null) return result('needs_confirmation');
  return result('not_applicable', 0);
}

export function calculateWorkingStudent({ isStudent, qualifyingSchool, hasWorkIncome, totalIncome, nonWorkIncome } = {}) {
  if (isStudent === false) return result('not_applicable', 0);
  if (isStudent !== true || qualifyingSchool === null || qualifyingSchool === undefined || hasWorkIncome === null || hasWorkIncome === undefined || !amountOk(totalIncome) || !amountOk(nonWorkIncome)) return result('needs_confirmation');
  if (!qualifyingSchool || !hasWorkIncome || totalIncome > R.workingStudentDeduction.incomeMax || nonWorkIncome > R.workingStudentDeduction.nonWorkIncomeMax) return result('not_applicable', 0);
  return result('calculated', R.workingStudentDeduction.amount);
}
