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

const streamWords = async (text, emit, signal) => {
  for (const word of text.split(/(\s+)/)) {
    await wait(25, signal);
    emit("delta", { text: word });
  }
};

export async function mockChat({ mode, analysis, messages, lang }, emit, signal) {
  const es = lang === "es";
  const turns = (messages ?? []).filter((m) => m.role === "user").length;
  if (mode === "feedback") {
    await wait(800, signal);
    emit("feedback", {
      mock: true,
      score: Math.min(9, 5 + turns),
      summary: es ? "Práctica de ejemplo: te mantuviste firme en varios puntos." : "Sample feedback: you held firm on several points.",
      went_well: [es ? "Pediste quitar los extras opcionales." : "You asked for the optional add-ons to be removed."],
      improve: [es ? "Menciona tu preaprobación antes de hablar del pago." : "Mention your pre-approval before talking about the payment."],
      try_saying: [es ? "Prefiero hablar del precio final, no del pago mensual." : "I'd rather talk about the out-the-door price, not the monthly payment."],
    });
    return;
  }
  await wait(400, signal);
  if (mode === "practice") {
    const first = analysis.flags.find((f) => !["apr", "price", "term", "doc_fee", "dealer_prep"].includes(f.id.replace(/_\d+$/, "")))?.line?.label ?? "GAP Waiver";
    const lines = es
      ? [
          `¡Felicidades por tu auto! Antes de firmar, la mayoría de nuestros clientes agregan ${first}. Son solo unos dólares más al mes.`,
          "Entiendo. Pero el banco realmente prefiere ver esa protección en el préstamo. ¿Lo dejamos?",
          "Está bien, lo quito. Esta tasa solo es buena hoy, así que firmemos ahora.",
        ]
      : [
          `Congratulations on the car! Before we sign, most of our customers add the ${first}. It's only a few dollars a month.`,
          "I hear you. But the bank really likes to see that protection on the loan. Should we keep it?",
          "Okay, I'll take it off. This rate is only good today, though, so let's get you signed.",
        ];
    return streamWords(lines[Math.min(turns, lines.length - 1)], emit, signal);
  }
  emit("search", { query: es ? "¿Es obligatorio el seguro GAP para un préstamo de auto?" : "is GAP insurance required for an auto loan" });
  await wait(700, signal);
  return streamWords(
    es
      ? "Respuesta de ejemplo (modo demo): no, GAP es opcional casi siempre. Puedes decir: \"Prefiero comprar GAP con mi aseguradora; por favor quítenlo del contrato.\""
      : 'Sample answer (demo mode): no, GAP is almost always optional. You can say: "I\'ll get GAP through my insurer. Please take it off the contract."',
    emit,
    signal,
  );
}

// Fine print quotes copied from the sample contracts. The retail installment
// contracts (04, 07, 10) carry the Holder notice; the buyer's orders carry the rest.
export async function mockFinePrint(fileName = "") {
  await wait(1200);
  if (/risc/i.test(fileName)) {
    return [
      {
        type: "holder_notice",
        quote: "Any holder of this consumer credit contract is subject to all claims and defenses which the debtor could assert against the seller.",
      },
    ];
  }
  return [
    {
      type: "optional_products_notice",
      quote: "Optional products are not required to purchase the vehicle or obtain financing, and Purchaser may decline them.",
    },
    {
      type: "conditional_delivery",
      quote: "This order is not binding until accepted by Dealer and, if financed, approved by the lender named above.",
    },
    { type: "as_is", quote: "Purchaser acknowledges the vehicle is sold AS IS unless a written warranty is provided." },
  ];
}
