// Offline stand-in for Claude, used when FAIRDEAL_MOCK_AI=1: for UI testing
// without an API key, and as a demo backup if the network fails. Every result
// is marked mock: true and the app labels it as sample data.

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });

export async function mockAdvisorRun({ deal, analysis, profile, lang }, emit, signal) {
  const car = deal.vehicle || "this vehicle";
  const es = lang === "es";
  const searches = [
    `${car} NHTSA recalls`,
    `${car} common problems`,
    `auto loan rates credit union ${profile.zip || "Georgia"}`,
    `used ${car} for sale near ${profile.zip || "Atlanta GA"}`,
  ];
  const sources = [
    { url: "https://www.nhtsa.gov/recalls", title: "NHTSA Recalls Lookup" },
    { url: "https://www.consumerreports.org/cars/", title: "Consumer Reports Cars" },
    { url: "https://www.mycreditunion.gov/", title: "MyCreditUnion.gov" },
    { url: "https://www.kbb.com/cars-for-sale/", title: "Kelley Blue Book Cars for Sale" },
  ];
  for (let i = 0; i < searches.length; i++) {
    await wait(700, signal);
    emit("search", { query: searches[i] });
    await wait(500, signal);
    emit("source", sources[i]);
  }
  await wait(600, signal);

  const pay = deal.monthly_payment || 0;
  const income = Number(profile.monthly_income) || 0;
  const share = income ? pay / income : 0;
  const verdict = !income ? "unknown" : share <= 0.1 ? "comfortable" : share <= 0.15 ? "stretch" : "risky";
  const t = (en, sp) => (es ? sp : en);

  return {
    mock: true,
    summary: t(
      `Sample research for ${car}. This deal scored ${analysis.score}/100; the biggest savings come from the rate and the add-ons.`,
      `Investigación de ejemplo para ${car}. Este trato obtuvo ${analysis.score}/100; el mayor ahorro está en la tasa y los extras.`,
    ),
    affordability: {
      verdict,
      explanation: income
        ? t(
            `The $${Math.round(pay)} payment is ${Math.round(share * 100)}% of your take-home pay. Aim for 10-15% or less, before insurance.`,
            `El pago de $${Math.round(pay)} es ${Math.round(share * 100)}% de tu ingreso neto. Lo ideal es 10-15% o menos, sin contar el seguro.`,
          )
        : t("Add your take-home pay to see whether this payment fits.", "Agrega tu ingreso neto para ver si este pago te conviene."),
    },
    plan: [
      { step: t("Get a pre-approval from a credit union today.", "Pide una preaprobación en una cooperativa de crédito hoy."), why: t("It gives you a real rate to make the dealer beat.", "Te da una tasa real para que el concesionario la mejore.") },
      { step: t("Ask for the add-ons to be removed before talking payment.", "Pide que quiten los extras antes de hablar del pago."), why: t("They're optional and add interest for the whole loan.", "Son opcionales y suman intereses durante todo el préstamo.") },
      { step: t("Negotiate the out-the-door price, not the monthly payment.", "Negocia el precio final, no el pago mensual."), why: t("A low payment can hide a long, expensive loan.", "Un pago bajo puede esconder un préstamo largo y caro.") },
    ],
    say_this: [
      t("I'm pre-approved elsewhere. Can you beat that rate?", "Tengo una preaprobación en otro lugar. ¿Pueden mejorar esa tasa?"),
      t("Please take the optional products off. I'll decide on those later.", "Por favor quiten los productos opcionales. Lo decidiré después."),
    ],
    walk_away_if: [
      t("They say the add-ons are required to get the loan.", "Te dicen que los extras son obligatorios para el préstamo."),
      t("They won't show you the out-the-door price in writing.", "No quieren darte el precio final por escrito."),
    ],
    recalls: [{ title: t("Check open recalls by VIN", "Revisa retiros abiertos por VIN"), detail: t("Sample data: enter the VIN on NHTSA's site before you sign.", "Datos de ejemplo: ingresa el VIN en el sitio de NHTSA antes de firmar."), source_url: sources[0].url }],
    known_issues: [{ title: t("Ask for service records", "Pide el historial de servicio"), detail: t("Sample data: have an independent mechanic inspect the car.", "Datos de ejemplo: que un mecánico independiente revise el auto."), source_url: sources[1].url }],
    rates: [{ lender: t("Example Credit Union (sample)", "Cooperativa de ejemplo (muestra)"), apr: "6.9%", detail: t("Sample rate for illustration only.", "Tasa de ejemplo solo como ilustración."), source_url: sources[2].url }],
    comparables: [{ title: t(`Similar ${car} (sample)`, `${car} similar (muestra)`), price: `$${Math.round((deal.vehicle_price || 20000) * 0.93).toLocaleString("en-US")}`, detail: t("Sample listing for illustration only.", "Anuncio de ejemplo solo como ilustración."), source_url: sources[3].url }],
    sources,
  };
}
