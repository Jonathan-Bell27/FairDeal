// Every user-facing string the rules engine produces, in English and Spanish.
// Dollar amounts stay in US format ($1,234) in both languages.

export const LANGS = ["en", "es"];

const usd = (n) => "$" + Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

const en = {
  tier: { Excellent: "Excellent", Good: "Good", Fair: "Fair", Poor: "Poor" },
  disclaimer: "AI-assisted analysis for informational purposes. Not financial advice. Verify terms before signing.",
  verdict: {
    fair: "Fair deal",
    negotiate: "Negotiate before signing",
    walk: "Walk away or get outside financing",
  },
  category: {
    apr: "APR vs. credit tier",
    addOns: "Add-ons and fees",
    term: "Payment packing",
    price: "Price vs. market",
  },

  apr: ({ apr, gap, tier, typical, experianTier, extra, months }) => ({
    title: `APR ${apr}% is ${gap} points above typical for ${tier} credit`,
    detail: `Buyers with ${tier.toLowerCase()} credit (${experianTier}) typically get about ${typical}% on a used car. At that rate you'd pay about ${usd(extra)} less in interest over ${months} months. Get pre-approved at a credit union or bank and ask the dealer to match it.`,
    ask: `Lower the APR to ${typical}% (typical for my credit tier), or I'll use outside financing.`,
    note: `avg for ${tier} credit: ${typical}%`,
  }),
  aprSource: "Experian, State of the Automotive Finance Market, Q2 2026 (average used-vehicle APR by credit tier)",

  financed: ({ name, amount, interest, apr, months, why }) => ({
    title: `${name}: ${usd(amount)}, plus about ${usd(interest)} in interest`,
    detail: `${why} Rolled into this loan at ${apr}% for ${months} months, it would cost about ${usd(interest)} in interest. You can pay for it separately or buy coverage later.`,
    ask: `Take the ${name} (${usd(amount)}) off the loan. I can buy coverage separately if I want it.`,
    note: `+${usd(interest)} interest. Optional`,
  }),
  addOnTitleRemove: (name, amount) => `${name}: ${usd(amount)} you shouldn't pay`,
  addOnTitleCompare: (name, amount, fair) => `${name}: ${usd(amount)} vs. about ${usd(fair)} typical`,
  askDocFee: (name, impact, fair) =>
    `Take ${usd(impact)} off the vehicle price to offset the ${name}, which is above the ${usd(fair)} state average.`,
  askRemove: (name, amount) => `Remove the ${name} (${usd(amount)}).`,
  askLower: (name, amount, fair) => `Lower the ${name} from ${usd(amount)} to ${usd(fair)}, or remove it.`,
  noteRemove: "shouldn't be charged",
  noteDocFee: (fair) => `GA avg ${usd(fair)}`,
  noteElsewhere: (fair) => `about ${usd(fair)} elsewhere`,

  term: ({ total, price, overPrice, extra, at60, monthly, miles, highMiles, packing, months }) => ({
    title: packing
      ? `${months}-month loan stretches the payment to hide the cost`
      : `${months}-month loan${highMiles ? " on a high-mileage car" : ""}`,
    detail:
      `You'd pay ${usd(total)} in total for a car priced at ${usd(price)}, ${usd(overPrice)} more than the price. ` +
      `A 60-month term at the same rate would cost about ${usd(extra)} less in interest ` +
      `(${usd(at60)}/mo instead of ${usd(monthly)}/mo).` +
      (highMiles ? ` With ${miles.toLocaleString("en-US")} miles, the car may need major repairs before it's paid off.` : "") +
      (packing ? "" : " Not counted in your score: a shorter term means a higher monthly payment."),
    ask: "Show me the numbers on a 60-month term.",
    label: "Loan term",
    charged: `${months} months`,
    note: `60 months saves ${usd(extra)}`,
  }),
  termSource: "Loan math from the contract's APR and amount financed",

  price: ({ over, price, kbb }) => ({
    title: `Price is ${usd(over)} above market value`,
    detail: `The vehicle price is ${usd(price)}; Kelley Blue Book values it at ${usd(kbb)}.`,
    ask: `Bring the vehicle price down to the KBB value of ${usd(kbb)}.`,
    label: "Vehicle price",
    note: `KBB value ${usd(kbb)}`,
  }),
  priceSource: "Kelley Blue Book value entered by the buyer",

  theCar: "the car",
  counterClean: (car) =>
    `Hi, thanks for the numbers on ${car}. Everything looks in line with the market, and I'm ready to move forward. Please send the final paperwork.`,
  counterIntro: (car) => `Hi, I'm interested in ${car}, but I need a few changes before I can sign:`,
  counterOutro: "If you can make these changes, I'm ready to move forward today. Please send an updated buyer's order.",
};

const es = {
  tier: { Excellent: "Excelente", Good: "Bueno", Fair: "Regular", Poor: "Malo" },
  disclaimer:
    "Análisis asistido por IA con fines informativos. No es asesoría financiera. Verifica los términos antes de firmar.",
  verdict: {
    fair: "Trato justo",
    negotiate: "Negocia antes de firmar",
    walk: "No firmes o busca otro financiamiento",
  },
  category: {
    apr: "Tasa (APR) según tu crédito",
    addOns: "Extras y cargos",
    term: "Plazo inflado",
    price: "Precio vs. mercado",
  },

  apr: ({ apr, gap, tier, typical, experianTier, extra, months }) => ({
    title: `La tasa de ${apr}% está ${gap} puntos por encima de lo normal para crédito ${tier.toLowerCase()}`,
    detail: `Con crédito ${tier.toLowerCase()} (${experianTier}) lo normal es una tasa de alrededor de ${typical}% en un auto usado. Con esa tasa pagarías unos ${usd(extra)} menos en intereses en ${months} meses. Pide una preaprobación en una cooperativa de crédito o un banco y pídele al concesionario que la iguale.`,
    ask: `Bajar la tasa (APR) a ${typical}%, lo normal para mi nivel de crédito, o usaré financiamiento externo.`,
    note: `promedio para crédito ${tier.toLowerCase()}: ${typical}%`,
  }),
  aprSource:
    "Experian, State of the Automotive Finance Market, 2.º trimestre de 2026 (tasa promedio de autos usados por nivel de crédito)",

  financed: ({ name, amount, interest, apr, months, why }) => ({
    title: `${name}: ${usd(amount)}, más unos ${usd(interest)} en intereses`,
    detail: `${why} Incluido en este préstamo al ${apr}% por ${months} meses, te costaría unos ${usd(interest)} en intereses. Puedes pagarlo aparte o comprar la cobertura más adelante.`,
    ask: `Quitar el cargo "${name}" (${usd(amount)}) del préstamo. Si lo quiero, puedo comprar la cobertura por separado.`,
    note: `+${usd(interest)} de intereses. Opcional`,
  }),
  addOnTitleRemove: (name, amount) => `${name}: ${usd(amount)} que no deberías pagar`,
  addOnTitleCompare: (name, amount, fair) => `${name}: ${usd(amount)} vs. unos ${usd(fair)} normalmente`,
  askDocFee: (name, impact, fair) =>
    `Rebajar ${usd(impact)} del precio del vehículo para compensar el cargo "${name}", que supera el promedio estatal de ${usd(fair)}.`,
  askRemove: (name, amount) => `Quitar el cargo "${name}" (${usd(amount)}).`,
  askLower: (name, amount, fair) => `Bajar "${name}" de ${usd(amount)} a ${usd(fair)}, o quitarlo.`,
  noteRemove: "no deberían cobrarlo",
  noteDocFee: (fair) => `promedio en GA: ${usd(fair)}`,
  noteElsewhere: (fair) => `unos ${usd(fair)} en otro lugar`,

  term: ({ total, price, overPrice, extra, at60, monthly, miles, highMiles, packing, months }) => ({
    title: packing
      ? `Un préstamo a ${months} meses alarga los pagos para esconder el costo`
      : `Préstamo a ${months} meses${highMiles ? " en un auto con mucho millaje" : ""}`,
    detail:
      `Pagarías ${usd(total)} en total por un auto con precio de ${usd(price)}, ${usd(overPrice)} más que el precio. ` +
      `A 60 meses con la misma tasa pagarías unos ${usd(extra)} menos en intereses ` +
      `(${usd(at60)}/mes en lugar de ${usd(monthly)}/mes).` +
      (highMiles
        ? ` Con ${miles.toLocaleString("en-US")} millas, el auto podría necesitar reparaciones grandes antes de terminar de pagarlo.`
        : "") +
      (packing ? "" : " No cuenta en tu puntaje: un plazo más corto significa un pago mensual más alto."),
    ask: "Mostrarme los números a 60 meses.",
    label: "Plazo del préstamo",
    charged: `${months} meses`,
    note: `a 60 meses ahorras ${usd(extra)}`,
  }),
  termSource: "Cálculo del préstamo con la tasa y el monto financiado del contrato",

  price: ({ over, price, kbb }) => ({
    title: `El precio está ${usd(over)} por encima del valor de mercado`,
    detail: `El precio del vehículo es ${usd(price)}; Kelley Blue Book lo valora en ${usd(kbb)}.`,
    ask: `Bajar el precio del vehículo al valor de KBB de ${usd(kbb)}.`,
    label: "Precio del vehículo",
    note: `valor KBB ${usd(kbb)}`,
  }),
  priceSource: "Valor de Kelley Blue Book ingresado por el comprador",

  theCar: "el auto",
  counterClean: (car) =>
    `Hola, gracias por los números del ${car}. Todo se ve de acuerdo con el mercado y quiero seguir adelante. Por favor, envíenme los documentos finales.`,
  counterIntro: (car) => `Hola, me interesa el ${car}, pero necesito algunos cambios antes de firmar:`,
  counterOutro:
    "Si pueden hacer estos cambios, puedo cerrar el trato hoy. Por favor, envíenme una orden de compra actualizada.",
};

export function messages(lang) {
  return lang === "es" ? es : en;
}
