import { QUESTIONS } from './questions.js';
import { baseQuestionId, nextQuestionId, widowGenderMayBeNeeded } from './flow.js';

// 「計算シート」の欄番号は添付された令和8年用年末調整計算シートを確認。
// 申告書の欄名は国税庁令和8年分記載例を確認。Excelファイルは編集しない。
export const WIZARD_PAGES = Object.freeze([
  { id:'salary', title:'本人と給与', lead:'年末調整の対象かを確認し、今年の給与収入の見込みを入力します。', source:'給与明細・前職の源泉徴収票', destination:'計算シート⑦ 給与等の計／基礎控除申告書「給与所得の収入金額」', official:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/306.pdf' },
  { id:'spouse', title:'配偶者', lead:'配偶者の年齢・生計・所得を確認します。', source:'配偶者の給与明細・収入見込み', destination:'配偶者控除等申告書／計算シート⑰', official:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/306.pdf' },
  { id:'dependents', title:'扶養する家族', lead:'一人ずつ入力し、16歳未満・19～22歳・70歳以上の区分を確認します。', source:'家族の生年月日・給与収入の見込み', destination:'扶養控除等申告書 B欄・住民税欄／計算シート上段の扶養区分', official:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/305.pdf' },
  { id:'personal', title:'障害者・ひとり親・学生', lead:'本人と家族の事実関係から、該当する欄を判定します。', source:'障害者手帳・家族の所得・在学先の資料', destination:'扶養控除等申告書 C欄／計算シート上段の障害者等', official:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/305.pdf' },
  { id:'life', title:'生命保険', lead:'控除証明書を契約ごとに確認します。支払保険料と控除額は異なる金額です。', source:'生命保険料控除証明書', destination:'保険料控除申告書「あなたが本年中に支払った保険料等の金額」／計算シート⑮', official:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/307.pdf' },
  { id:'earthquake', title:'地震保険', lead:'地震保険と旧長期損害保険を契約ごとに分けます。', source:'地震保険料控除証明書', destination:'保険料控除申告書「あなたが本年中に支払った保険料等の金額」／計算シート⑯', official:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/307.pdf' },
  { id:'social', title:'社会保険・iDeCo等', lead:'給与天引き以外に本人が支払った金額を入力します。', source:'国民年金の控除証明書・掛金払込証明書など', destination:'保険料控除申告書／計算シート⑬・⑭（給与天引き分は⑫）', official:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/307.pdf' },
  { id:'housing', title:'住宅ローン・特殊ケース', lead:'住宅ローンの手続きと、会社へ確認する事情を整理します。', source:'住宅ローン申告書・年末残高情報など', destination:'計算シート㉔／住宅借入金等特別控除申告書', official:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/308.pdf' }
]);

const PERSONAL = new Set(['disabilitySelf','disabilityFamily','parentStatus','deFactoPartner','parentChild','parentChildIncomeKnown','parentChildIncome','parentChildClaimed','widowGender','student','studentSchool']);
const SALARY = new Set(['target','form','salaryLimit','changedJob','priorSlip','otherSalary','allSalary','ownSalary','otherIncome']);

export function pageForQuestion(routeId) {
  if(routeId==='result')return 'result';
  if(routeId==='end')return 'end';
  if(routeId.startsWith('dep:')||['dependents','dependentCount'].includes(routeId))return 'dependents';
  if(routeId.startsWith('disability:')||PERSONAL.has(routeId))return 'personal';
  if(routeId.startsWith('life:')||['life','lifeCount'].includes(routeId))return 'life';
  if(routeId.startsWith('earthquake:')||['earthquake','earthquakeCount'].includes(routeId))return 'earthquake';
  if(['social','socialTypes','socialAmount','ideco','idecoType','idecoAmount'].includes(routeId))return 'social';
  if(['housing','housingFirst','housingDocs','housingBalance','special'].includes(routeId))return 'housing';
  if(['spouse','spouseShared','spouseClaimed','spouseAge','spouseIncomeType','spouseSalary'].includes(routeId))return 'spouse';
  if(SALARY.has(routeId))return 'salary';
  throw new Error(`Unknown question route: ${routeId}`);
}

export function traceWizard(answers={}) {
  const items=[];
  let id='target';
  const maxSteps=Object.keys(QUESTIONS).length*(1+(Number(answers.depCount)||0)+(Number(answers.lifeCount)||0)+(Number(answers.earthquakeCount)||0));
  for(let i=0;i<maxSteps;i++) {
    if(id==='result'||id==='end')return {items,terminal:id,pending:null};
    const question=QUESTIONS[baseQuestionId(id)];
    if(!question)throw new Error(`Question definition missing: ${id}`);
    const answered=Object.hasOwn(answers,id);
    items.push({id,page:pageForQuestion(id),question,answered,value:answered?answers[id]:undefined});
    if(!answered)return {items,terminal:null,pending:id};
    id=nextQuestionId(id,answers[id],{answers});
    if(!id)throw new Error(`Transition missing after: ${items.at(-1).id}`);
  }
  throw new Error('Question route exceeded expected length');
}

export function commitWizardAnswer(answers,routeId,value) {
  const old=answers[routeId];
  if(JSON.stringify(old)===JSON.stringify(value))return traceWizard(answers);
  answers[routeId]=value;
  if(routeId==='dependentCount')answers.depCount=value;
  if(routeId==='lifeCount')answers.lifeCount=value;
  if(routeId==='earthquakeCount')answers.earthquakeCount=value;
  // A newly opened branch may have an unanswered question. Keep answers on later
  // pages so they are not asked again; remove only values made invalid by this edit.
  const clear=(...keys)=>keys.forEach(key=>delete answers[key]);
  const clearMatching=pattern=>Object.keys(answers).filter(key=>pattern.test(key)).forEach(key=>delete answers[key]);
  if(routeId==='target'&&value==='いいえ') {
    for(const key of Object.keys(answers))if(key!=='target')delete answers[key];
    return traceWizard(answers);
  }
  if(routeId==='changedJob'&&value!=='はい')clear('priorSlip');
  if(routeId==='otherSalary')clear(value==='はい'?'ownSalary':'allSalary');
  if(routeId==='spouse'&&value!=='はい')clear('spouseShared','spouseClaimed','spouseAge','spouseIncomeType','spouseSalary'),clearMatching(/^disability:spouse:/);
  if(routeId==='spouseIncomeType'&&value!=='給与だけ')clear('spouseSalary');
  if(routeId==='dependents'&&value!=='はい')clear('dependentCount','depCount'),clearMatching(/^(dep:|disability:dep:)/);
  if(routeId==='dependentCount') {
    const count=Number(value);
    for(const key of Object.keys(answers)) {
      const match=key.match(/^(?:dep:|disability:dep:)(\d+):/);
      if(match&&Number(match[1])>count)delete answers[key];
    }
  }
  const dep=routeId.match(/^dep:(\d+):(age|income|parent)$/);
  if(dep) {
    const prefix=`dep:${dep[1]}:`;
    if(dep[2]==='age'&&(!Number.isFinite(Number(value))||Number(value)<70))clear(`${prefix}parent`,`${prefix}cohabit`);
    if(dep[2]==='income'&&value!=='給与がある')clear(`${prefix}salary`);
    if(dep[2]==='parent'&&value!=='はい')clear(`${prefix}cohabit`);
  }
  if(routeId==='disabilityFamily'&&value!=='はい')clearMatching(/^disability:/);
  if(routeId.startsWith('disability:')&&routeId.endsWith(':level')&&value!=='特別障害者')clear(routeId.replace(/:level$/,':cohabit'));
  if(routeId==='parentStatus'&&value==='婚姻中')clear('deFactoPartner','parentChild','parentChildIncomeKnown','parentChildIncome','parentChildClaimed','widowGender');
  if(routeId==='deFactoPartner'&&value==='はい')clear('parentChild','parentChildIncomeKnown','parentChildIncome','parentChildClaimed','widowGender');
  if(routeId==='parentChild'&&value!=='はい')clear('parentChildIncomeKnown','parentChildIncome','parentChildClaimed');
  if(routeId==='parentChildIncomeKnown'&&value!=='はい')clear('parentChildIncome');
  if(routeId==='student'&&value!=='はい')clear('studentSchool');
  if(routeId==='life'&&value!=='はい')clear('lifeCount'),clearMatching(/^life:/);
  if(routeId==='lifeCount')for(const key of Object.keys(answers)){const match=key.match(/^life:(\d+):/);if(match&&Number(match[1])>Number(value))delete answers[key];}
  const lifeEdit=routeId.match(/^life:(\d+):(paid|type|recipient)$/);
  if(lifeEdit){
    const prefix=`life:${lifeEdit[1]}:`;
    if(lifeEdit[2]==='paid'&&value==='いいえ')for(const part of ['recipient','companyName','insuranceKind','insurancePeriod','holderName','recipientName','recipientRelationship','pensionStartDate'])clear(prefix+part);
    if(lifeEdit[2]==='type'&&!String(value).includes('個人年金'))clear(prefix+'pensionStartDate');
    if(lifeEdit[2]==='recipient'&&['本人','配偶者'].includes(value))clear(prefix+'recipientRelationship');
  }
  if(routeId==='earthquake'&&value!=='はい')clear('earthquakeCount'),clearMatching(/^earthquake:/);
  if(routeId==='earthquakeCount')for(const key of Object.keys(answers)){const match=key.match(/^earthquake:(\d+):/);if(match&&Number(match[1])>Number(value))delete answers[key];}
  if(/^earthquake:\d+:type$/.test(routeId)&&value!=='両方')clear(routeId.replace(/:type$/,':election'));
  if(/^earthquake:\d+:paid$/.test(routeId)&&value==='いいえ')for(const part of ['companyName','insuranceKind','insurancePeriod','holderName','insuredName','insuredRelationship'])clear(routeId.replace(/:paid$/,':'+part));
  if(routeId==='social'&&value!=='はい')clear('socialTypes','socialAmount');
  if(routeId==='ideco'&&value!=='はい')clear('idecoType','idecoAmount');
  if(routeId==='housing'&&value!=='はい')clear('housingFirst','housingDocs','housingBalance');
  if(routeId==='housingFirst'&&value!=='いいえ')clear('housingDocs','housingBalance');
  if(!widowGenderMayBeNeeded(answers))clear('widowGender');
  return traceWizard(answers);
}

const specificInput = {
  target:'勤務先で今年の年末調整を受ける予定か選びます。', form:'扶養家族がいない場合も含め、扶養控除等申告書の提出状況を選びます。',
  salaryLimit:'税込みの年間給与収入が、表示された基準を超える見込みか選びます。', changedJob:'今年、現在の会社へ転職したか選びます。',
  priorSlip:'前職の源泉徴収票を受け取ったか選びます。', otherSalary:'現在の会社以外から給与を受け取ったか選びます。',
  allSalary:'前職分も含めた税込みの給与総額を円で入力します。', ownSalary:'この会社の税込み給与総額を円で入力します。',
  otherIncome:'給与以外の収入があれば種類を選びます。合計所得を確定できない場合は担当者確認に残します。',
  spouse:'法律上の配偶者の有無を選びます。', spouseShared:'配偶者と生活費を共にしているか選びます。',
  spouseClaimed:'配偶者が他の方の扶養親族等として申告されるか確認します。', spouseAge:'配偶者の2026年12月31日時点の年齢を入力します。',
  spouseIncomeType:'配偶者の収入が給与のみか、その他の所得もあるか選びます。',
  spouseSalary:'配偶者の税込み給与収入を円で入力します。所得額への換算はアプリが行います。',
  dependents:'配偶者以外に生活費を支えている家族がいるか選びます。', dependentCount:'入力する家族の人数を1～10人で入力します。',
  dependentKin:'その方が税法上の親族に当たるか確認します。', dependentAge:'2026年12月31日時点の年齢を入力します。',
  dependentIncome:'給与収入・給与以外の所得・収入なしから選びます。',
  dependentSalary:'その家族の税込み給与収入を円で入力します。', lifeCount:'証明書にある契約・区分の件数を入力します。紙の欄を超える分は添付別紙明細へ案内します。',
  dependentShared:'他の方も同じ家族を扶養として申告する予定か確認します。', dependentParent:'70歳以上の方が父母・祖父母等に当たるか選びます。',
  dependentCohabit:'70歳以上の父母・祖父母等と日常的に同居しているか選びます。',
  disabilitySelf:'手帳や自治体の認定に基づく本人の区分を選びます。', disabilityFamily:'配偶者・登録した家族に該当者がいるか選びます。',
  disabilityPerson:'この方の障害者区分を手帳や認定で確認して選びます。', disabilityCohabit:'特別障害者の方の同居状況を選びます。',
  parentStatus:'年末時点の婚姻状況を事実に沿って選びます。', deFactoPartner:'事実婚関係に当たる同居等の相手がいるか選びます。',
  parentChild:'生計を一にする子がいるか選びます。', parentChildIncomeKnown:'子の合計所得金額を確認できるか選びます。',
  parentChildClaimed:'その子を他の方が扶養等として申告するか選びます。', widowGender:'寡婦控除の判定に必要な区分を選びます。',
  student:'年末時点で在学しているか選びます。', studentSchool:'在学先と課程の区分を確認して選びます。',
  life:'今年分の生命保険料控除証明書があるか選びます。',
  lifeType:'証明書の「新・旧」「介護医療」「個人年金」の区分を選びます。', lifeAmount:'控除額ではなく証明書の申告額を円で入力します。',
  lifePaid:'この保険料を実際に支払った方を確認します。', lifeRecipient:'保険金・年金の受取人の続柄を選びます。',
  earthquake:'今年分の地震保険料控除証明書があるか選びます。', earthquakeCount:'証明書に記載された契約の数を入力します。',
  earthquakeType:'証明書の「地震」「旧長期」または両方を選びます。', earthquakeElection:'同一契約に両方ある場合、申告する一方の区分を選びます。',
  earthquakeAmount:'選んだ区分の支払額を円で入力します。', socialAmount:'給与天引き以外に本人が支払った額を円で入力します。',
  earthquakePaid:'この保険料を実際に支払った方を確認します。',
  social:'給与天引き以外に本人が社会保険料を支払ったか選びます。', socialTypes:'国民年金など、該当する種類をすべて選びます。',
  ideco:'給与天引き以外に本人が対象掛金を支払ったか選びます。', idecoType:'掛金の種類を証明書で確認して選びます。',
  idecoAmount:'給与天引き以外に本人が支払った掛金を円で入力します。', parentChildIncome:'給与収入ではなく子の合計所得金額を入力します。',
  housing:'住宅ローン控除を受ける予定があるか選びます。', housingFirst:'住宅ローン控除の初年度か、2年目以降か選びます。',
  housingDocs:'年末調整用の申告書・控除証明書を入手したか選びます。', housingBalance:'年末残高情報または残高証明書の取得状況を選びます。',
  special:'該当する事情をすべて選びます。なければ「どれもない」を選びます。'
};

const specificSource = {
  target:'勤務先の年末調整案内', form:'提出済みの扶養控除等申告書・勤務先の案内', priorSlip:'前職の源泉徴収票',
  spouse:'戸籍・婚姻の事実', spouseAge:'配偶者の生年月日', dependentAge:'家族の生年月日',
  disabilitySelf:'障害者手帳・自治体の認定書類', disabilityFamily:'家族の障害者手帳・認定書類',
  disabilityPerson:'その方の障害者手帳・認定書類', disabilityCohabit:'その方の居住状況',
  parentStatus:'年末時点の婚姻状況', deFactoPartner:'住民票等の関係資料',
  student:'在学証明書・学生証', studentSchool:'在学先の学校・課程の案内',
  lifeType:'生命保険料控除証明書の区分', lifeAmount:'生命保険料控除証明書の申告額',
  earthquakeType:'地震保険料控除証明書の区分', earthquakeAmount:'地震保険料控除証明書の支払額',
  housingFirst:'初年度の確定申告書・住宅ローン控除の申告書'
};

export function questionGuide(routeId) {
  const page=WIZARD_PAGES.find(x=>x.id===pageForQuestion(routeId));
  const key=baseQuestionId(routeId);
  const textEntry=QUESTIONS[key]?.input==='text';
  return { source:specificSource[key]||(textEntry?'控除証明書・保険契約の内容が分かる書類':page.source), input:specificInput[key]||(textEntry?`${QUESTIONS[key].text}証明書や契約内容の表記を使います。`:'該当する事実を選びます。分からない場合は担当者確認として残します。'), destination:textEntry?`保険料控除申告書「${QUESTIONS[key].entryLabel}」／この契約の記入行`:page.destination };
}

export function pageProgress(trace) {
  const pendingIndex=trace.pending===null?WIZARD_PAGES.length:WIZARD_PAGES.findIndex(p=>p.id===pageForQuestion(trace.pending));
  return WIZARD_PAGES.map((page,index)=>({id:page.id,status:index<pendingIndex?'done':index===pendingIndex?'current':'locked'}));
}
