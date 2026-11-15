import { Decimal, DECIMAL_SCALE, DecimalValue, toDecimal } from './core.js';

export interface AmortizationInstallment {
  month: number;
  payment: string;
  principalPaid: string;
  interestPaid: string;
  extraPayment: string;
  remainingBalance: string;
}

export interface LoanSimulationResult {
  monthlyScheduledPayment: string;
  totalInterestBaseline: string;
  totalInterestWithExtra: string;
  interestSaved: string;
  monthsSaved: number;
  payoffMonths: number;
  schedule: AmortizationInstallment[];
}

/**
 * Calculates loan amortization schedule and extra-repayment payoff simulation using Decimal.
 */
export function calculateLoanAmortization(params: {
  principal: DecimalValue;
  annualInterestRatePercent: DecimalValue;
  termMonths: number;
  extraMonthlyPayment?: DecimalValue;
}): LoanSimulationResult {
  const principalDec = toDecimal(params.principal);
  const annualRate = toDecimal(params.annualInterestRatePercent).dividedBy(100);
  const monthlyRate = annualRate.dividedBy(12);
  const n = params.termMonths;
  const extraDec = params.extraMonthlyPayment ? toDecimal(params.extraMonthlyPayment) : new Decimal(0);

  if (principalDec.lessThanOrEqualTo(0) || n <= 0) {
    return {
      monthlyScheduledPayment: '0.0000',
      totalInterestBaseline: '0.0000',
      totalInterestWithExtra: '0.0000',
      interestSaved: '0.0000',
      monthsSaved: 0,
      payoffMonths: 0,
      schedule: [],
    };
  }

  let scheduledPayment: Decimal;
  if (monthlyRate.isZero()) {
    scheduledPayment = principalDec.dividedBy(n);
  } else {
    const onePlusRPowerN = monthlyRate.plus(1).pow(n);
    scheduledPayment = principalDec
      .times(monthlyRate.times(onePlusRPowerN))
      .dividedBy(onePlusRPowerN.minus(1));
  }
  scheduledPayment = new Decimal(scheduledPayment.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN));

  let baselineBalance = principalDec;
  let baselineTotalInterest = new Decimal(0);
  for (let m = 1; m <= n && baselineBalance.greaterThan(0); m++) {
    const interest = new Decimal(
      baselineBalance.times(monthlyRate).toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN)
    );
    baselineTotalInterest = baselineTotalInterest.plus(interest);
    const principalPortion = Decimal.min(baselineBalance, scheduledPayment.minus(interest));
    baselineBalance = baselineBalance.minus(principalPortion);
  }

  const schedule: AmortizationInstallment[] = [];
  let balance = principalDec;
  let totalInterestWithExtra = new Decimal(0);
  let month = 0;

  while (balance.greaterThan(new Decimal('0.0001')) && month < n * 2) {
    month++;
    const interest = new Decimal(
      balance.times(monthlyRate).toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN)
    );
    let payment = scheduledPayment;
    let principalPortion = payment.minus(interest);
    let appliedExtra = extraDec;

    if (principalPortion.plus(appliedExtra).greaterThanOrEqualTo(balance)) {
      principalPortion = balance;
      appliedExtra = new Decimal(0);
      payment = principalPortion.plus(interest);
    }

    const totalPrincipalReduction = principalPortion.plus(appliedExtra);
    balance = Decimal.max(new Decimal(0), balance.minus(totalPrincipalReduction));
    totalInterestWithExtra = totalInterestWithExtra.plus(interest);

    schedule.push({
      month,
      payment: payment.plus(appliedExtra).toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
      principalPaid: totalPrincipalReduction.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
      interestPaid: interest.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
      extraPayment: appliedExtra.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
      remainingBalance: balance.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    });
  }

  const interestSaved = Decimal.max(
    new Decimal(0),
    baselineTotalInterest.minus(totalInterestWithExtra)
  );

  return {
    monthlyScheduledPayment: scheduledPayment.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    totalInterestBaseline: baselineTotalInterest.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    totalInterestWithExtra: totalInterestWithExtra.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    interestSaved: interestSaved.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    monthsSaved: Math.max(0, n - month),
    payoffMonths: month,
    schedule,
  };
}
