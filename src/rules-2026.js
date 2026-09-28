// 令和8年分（2026年）の所得税・年末調整ルール。
// 以下は国税庁の令和8年分一次資料で確認した範囲のみを定義しています。
// 令和8年分の改正値は原則2026-12-01施行のため、同日以後に行う年末調整が対象です。
export const TAX_RULES_2026 = Object.freeze({
  year: 2026,
  effectiveFrom: '2026-12-01',
  verification: 'verified-from-nta-2026-primary-sources',
  thresholds: Object.freeze({
    salaryLimitForYearEndAdjustment: 20_000_000,
    salaryForIncomeAdjustmentQuestion: 8_500_000,
    basicDeduction: Object.freeze([4_890_000, 6_550_000, 23_500_000, 24_000_000, 24_500_000, 25_000_000]),
    spouseIncome: 620_000,
    spouseSpecialIncomeMax: 1_330_000,
    taxpayerSpouseDeductionMax: 10_000_000,
    taxpayerIncomeBands: Object.freeze([9_000_000, 9_500_000, 10_000_000]),
    dependentIncome: 620_000,
    specialRelativeIncomeMax: 1_230_000,
    specialRelativeFullDeductionMax: 850_000
  }),
  salary: Object.freeze({
    deductionBands: Object.freeze([
      Object.freeze({ maxGross: 2_200_000, fixedDeduction: 740_000 }),
      Object.freeze({ minGross: 2_200_001, maxGross: 3_600_000, rate: 0.30, fixedDeduction: 80_000 }),
      Object.freeze({ minGross: 3_600_001, maxGross: 6_600_000, rate: 0.20, fixedDeduction: 440_000 }),
      Object.freeze({ minGross: 6_600_001, maxGross: 8_500_000, rate: 0.10, fixedDeduction: 1_100_000 }),
      Object.freeze({ minGross: 8_500_001, fixedDeduction: 1_950_000 })
    ]),
    // 国税庁「給与所得控除後の給与等の金額の表」および「給与所得者と税」の計算区分。
    table: Object.freeze({
      zeroIncomeBelow: 741_000,
      linearGrossStart: 741_000,
      linearGrossEndExclusive: 2_191_000,
      steppedBands: Object.freeze([
        Object.freeze({ start: 2_191_000, endExclusive: 2_193_000, income: 1_451_000 }),
        Object.freeze({ start: 2_193_000, endExclusive: 2_196_000, income: 1_453_000 }),
        Object.freeze({ start: 2_196_000, endExclusive: 2_200_000, income: 1_456_000 })
      ]),
      formulaBands: Object.freeze([
        Object.freeze({ start: 2_200_000, endExclusive: 3_600_000, divisor: 4_000, incomePerStep: 2_800, baseGross: 2_200_000, baseIncome: 1_460_000 }),
        Object.freeze({ start: 3_600_000, endExclusive: 6_600_000, divisor: 4_000, incomePerStep: 3_200, baseGross: 3_600_000, baseIncome: 2_440_000 })
      ]),
      proportionalBands: Object.freeze([
        Object.freeze({ start: 6_600_000, endExclusive: 8_500_000, rate: 0.90, deduction: 1_100_000 }),
        Object.freeze({ start: 8_500_000, rate: 1, deduction: 1_950_000 })
      ])
    })
  }),
  basicDeduction: Object.freeze([
    Object.freeze({ maxIncome: 4_890_000, amount: 1_040_000 }),
    Object.freeze({ maxIncome: 6_550_000, amount: 670_000 }),
    Object.freeze({ maxIncome: 23_500_000, amount: 620_000 }),
    Object.freeze({ maxIncome: 24_000_000, amount: 480_000 }),
    Object.freeze({ maxIncome: 24_500_000, amount: 320_000 }),
    Object.freeze({ maxIncome: 25_000_000, amount: 160_000 }),
    Object.freeze({ maxIncome: Infinity, amount: 0 })
  ]),
  spouseDeduction: Object.freeze({
    incomeBands: Object.freeze([
      Object.freeze({ maxIncome: 620_000, standard: [380_000, 260_000, 130_000], elderly: [480_000, 320_000, 160_000] }),
      Object.freeze({ maxIncome: 950_000, standard: [380_000, 260_000, 130_000] }),
      Object.freeze({ maxIncome: 1_000_000, standard: [360_000, 240_000, 120_000] }),
      Object.freeze({ maxIncome: 1_050_000, standard: [310_000, 210_000, 110_000] }),
      Object.freeze({ maxIncome: 1_100_000, standard: [260_000, 180_000, 90_000] }),
      Object.freeze({ maxIncome: 1_150_000, standard: [210_000, 140_000, 70_000] }),
      Object.freeze({ maxIncome: 1_200_000, standard: [160_000, 110_000, 60_000] }),
      Object.freeze({ maxIncome: 1_250_000, standard: [110_000, 80_000, 40_000] }),
      Object.freeze({ maxIncome: 1_300_000, standard: [60_000, 40_000, 20_000] }),
      Object.freeze({ maxIncome: 1_330_000, standard: [30_000, 20_000, 10_000] })
    ]),
    elderlySpouseAge: 70
  }),
  // 令和8年分扶養控除等申告書記載例 305.pdf：A欄・B欄の所得要件。
  withholdingForm: Object.freeze({ taxpayerSpouseIncomeMax:9_000_000, spouseIncomeMax:950_000, specificRelativeIncomeMax:1_000_000 }),
  dependentDeduction: Object.freeze({
    incomeLimit: 620_000,
    ageThresholds: Object.freeze({ minor: 16, specific: 19, adult: 23, elderly: 70 }),
    amounts: Object.freeze({ general: 380_000, specific: 630_000, elderly: 480_000, cohabitingElderlyParent: 580_000 })
  }),
  specificRelativeDeduction: Object.freeze({
    minAge: 19,
    maxAgeExclusive: 23,
    maxIncome: 1_230_000,
    amountBands: Object.freeze([
      Object.freeze({ maxIncome: 850_000, amount: 630_000 }),
      Object.freeze({ maxIncome: 900_000, amount: 610_000 }),
      Object.freeze({ maxIncome: 950_000, amount: 510_000 }),
      Object.freeze({ maxIncome: 1_000_000, amount: 410_000 }),
      Object.freeze({ maxIncome: 1_050_000, amount: 310_000 }),
      Object.freeze({ maxIncome: 1_100_000, amount: 210_000 }),
      Object.freeze({ maxIncome: 1_150_000, amount: 110_000 }),
      Object.freeze({ maxIncome: 1_200_000, amount: 60_000 }),
      Object.freeze({ maxIncome: 1_230_000, amount: 30_000 })
    ])
  }),
  incomeAdjustment: Object.freeze({
    salaryThreshold: 8_500_000,
    salaryCap: 10_000_000,
    rate: 0.10,
    maxAmount: 150_000,
    round: 'ceil-yen'
  }),
  // 国税庁 No.1140。新旧各控除式と新旧併用区分の上限。
  lifeInsurance: Object.freeze({
    categories: Object.freeze({ newLife: '新生命保険料', oldLife: '旧生命保険料', careMedical: '介護医療保険料', newPension: '新個人年金保険料', oldPension: '旧個人年金保険料' }),
    newFormula: Object.freeze([{max:20000,rate:1,offset:0},{max:40000,rate:0.5,offset:10000},{max:80000,rate:0.25,offset:20000},{max:Infinity,rate:0,offset:40000}]),
    newLifeSpecialFormula: Object.freeze([{max:30000,rate:1,offset:0},{max:60000,rate:0.5,offset:15000},{max:120000,rate:0.25,offset:30000},{max:Infinity,rate:0,offset:60000}]),
    oldFormula: Object.freeze([{max:25000,rate:1,offset:0},{max:50000,rate:0.5,offset:12500},{max:100000,rate:0.25,offset:25000},{max:Infinity,rate:0,offset:50000}]),
    combinedOldPremiumThreshold: 60000,
    caps: Object.freeze({newCategory:40000,oldCategory:50000,mixedCategory:40000,under23NewLife:60000,total:120000})
  }),
  // 国税庁 No.1145。個別契約の選択は質問で記録し、同一契約の二重計上を防ぐ。
  earthquakeInsurance: Object.freeze({earthquakeCap:50000,oldLongTermFullLimit:10000,oldLongTermHalfLimit:20000,oldLongTermHalfRate:0.5,oldLongTermOffset:5000,oldLongTermCap:15000,totalCap:50000}),
  socialInsurance: Object.freeze({ deduction: 'actual-paid-in-year', payrollDeductionIncludedSeparately: true }),
  smallBusinessMutualAid: Object.freeze({ deduction: 'actual-paid-in-year', eligible: Object.freeze(['小規模企業共済掛金','企業型年金加入者掛金','個人型年金加入者掛金（iDeCo）','心身障害者扶養共済掛金','複数種']) }),
  disabilityDeduction: Object.freeze({general:270000,special:400000,cohabitingSpecial:750000}),
  singleParentDeduction: Object.freeze({amount:350000,incomeMax:5000000,childIncomeMax:620000}),
  widowDeduction: Object.freeze({amount:270000,incomeMax:5000000}),
  workingStudentDeduction: Object.freeze({amount:270000,incomeMax:890000,nonWorkIncomeMax:100000}),
  sourceReferences: Object.freeze([
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2662.htm',
    'https://www.nta.go.jp/publication/pamph/koho/kurashi/html/02_1.htm',
    'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/01.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1140.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1145.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1130.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1135.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1170.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1171.htm',
    'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1175.htm'
  ])
});
