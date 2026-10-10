// Vetted explanations for the fine-print clauses Claude looks for. Claude only
// finds and quotes a clause on the buyer's paperwork; this text explains it.
// Federal rules only: no state law claims.
//
// A source's url stays empty until someone has opened the page and confirmed
// it supports the text. The app then shows the source name without a link.

// Display order: things to watch out for first, then protections.
export const CLAUSE_TYPES = ["conditional_delivery", "as_is", "optional_products_notice", "holder_notice"];

const en = {
  types: {
    conditional_delivery: {
      tone: "warning",
      title: "The deal isn't final until a lender approves it",
      explain:
        "Your paperwork says the sale depends on a lender approving your financing. If you drive off before that, the dealer may call you back and ask you to sign a new contract, sometimes at a higher rate. This is called spot delivery or a \"yo-yo\" sale.",
      action:
        "Before you take the car, ask the dealer to confirm in writing that your financing is approved and final. If it isn't, you can wait to take the car until it is.",
      source: { name: "CFPB, Can the dealer increase the interest rate after I drive the vehicle home?", url: "" },
    },
    as_is: {
      tone: "warning",
      title: "Sold \"as is\": no dealer warranty",
      explain:
        "\"As is\" means the dealer isn't promising to fix problems after the sale, so repairs would be up to you. On a used car, the Buyers Guide on the window is part of your contract, and if it promises a warranty, that wins over the contract.",
      action:
        "Have an independent mechanic inspect the car before you sign, and keep a copy of the Buyers Guide. If the salesperson promised any repairs, get them in writing.",
      source: { name: "FTC Used Car Rule (16 CFR Part 455) and its Buyers Guide", url: "" },
    },
    optional_products_notice: {
      tone: "protects",
      title: "Add-ons are optional, and your paperwork says so",
      explain:
        "This line says optional products aren't required to buy the car or get financing. You can turn down extras like GAP, a service contract or paint protection. Saying no shouldn't change whether you get the car or the loan.",
      action:
        "If anyone says an add-on is required, show them this line. Initial only the products you actually want, and check that the contract lists only those.",
      source: { name: "FTC, Understanding Car Add-ons", url: "" },
    },
    holder_notice: {
      tone: "protects",
      title: "Your rights follow the loan",
      explain:
        "This federal notice means that if the dealer sells your loan to a bank or finance company, you keep the same claims and defenses you have against the dealer. What you could get back from the lender this way is capped at what you've paid on the loan.",
      action:
        "Keep your copy of the contract. If the car or the dealer's promises turn out to be wrong, this notice lets you raise it with whoever holds your loan, not just the dealer.",
      source: { name: "FTC Holder Rule (16 CFR Part 433)", url: "" },
    },
  },

  // Shown whenever the fine print was read, whatever was found.
  general: [
    {
      type: "no_cooling_off",
      tone: "info",
      title: "No 3-day cooling-off period",
      explain:
        "Federal law doesn't give you 3 days to cancel a car you buy at a dealership; the FTC's Cooling-Off Rule doesn't cover it. Once you sign, plan on the sale being final unless the dealer gives you a return policy in writing.",
      action: "Take your time and read every page before you sign. If the dealer offers a return policy, get it in writing.",
      source: { name: "FTC Cooling-Off Rule (16 CFR Part 429); FTC, Buying a Used Car From a Dealer", url: "" },
    },
  ],

  // Shown only when the paperwork says the deal depends on lender approval.
  checklist: [
    "Get it in writing that your financing is approved and final.",
    "Don't hand over your trade-in's title or keys until the financing is final.",
    "Keep receipts for your down payment and copies of everything you sign.",
    "If they call you back to sign a new contract at a higher rate, you don't have to sign it. Ask for your down payment and trade-in back.",
  ],
};

const es = {
  types: {
    conditional_delivery: {
      tone: "warning",
      title: "El trato no es final hasta que un prestamista lo apruebe",
      explain:
        "Tus documentos dicen que la venta depende de que un prestamista apruebe tu financiamiento. Si te llevas el auto antes, el concesionario podría llamarte para que firmes un contrato nuevo, a veces con una tasa más alta. A esto se le llama entrega condicional o venta \"yo-yo\".",
      action:
        "Antes de llevarte el auto, pide que el concesionario confirme por escrito que tu financiamiento está aprobado y es final. Si no lo es, puedes esperar a llevarte el auto hasta que lo sea.",
      source: { name: "CFPB, Can the dealer increase the interest rate after I drive the vehicle home? (en inglés)", url: "" },
    },
    as_is: {
      tone: "warning",
      title: "Se vende \"tal como está\": sin garantía del concesionario",
      explain:
        "\"Tal como está\" (as is) significa que el concesionario no promete arreglar problemas después de la venta, así que las reparaciones te tocarían a ti. En un auto usado, la Guía del Comprador (Buyers Guide) de la ventana es parte de tu contrato, y si promete una garantía, eso vale más que el contrato.",
      action:
        "Pide que un mecánico independiente revise el auto antes de firmar y guarda una copia de la Guía del Comprador. Si el vendedor te prometió alguna reparación, pide que la pongan por escrito.",
      source: { name: "Regla de la FTC sobre autos usados (16 CFR parte 455) y su Guía del Comprador", url: "" },
    },
    optional_products_notice: {
      tone: "protects",
      title: "Los extras son opcionales, y tus documentos lo dicen",
      explain:
        "Esta línea dice que los productos opcionales no son obligatorios para comprar el auto ni para obtener financiamiento. Puedes rechazar extras como GAP, un contrato de servicio o la protección de pintura. Decir que no no debería cambiar si obtienes el auto o el préstamo.",
      action:
        "Si alguien te dice que un extra es obligatorio, muéstrale esta línea. Pon tus iniciales solo en los productos que de verdad quieres y revisa que el contrato incluya solo esos.",
      source: { name: "FTC, Understanding Car Add-ons (en inglés)", url: "" },
    },
    holder_notice: {
      tone: "protects",
      title: "Tus derechos siguen al préstamo",
      explain:
        "Este aviso federal significa que si el concesionario vende tu préstamo a un banco o una financiera, mantienes los mismos reclamos y defensas que tienes contra el concesionario. Lo que podrías recuperar del prestamista de esta forma tiene como límite lo que ya pagaste del préstamo.",
      action:
        "Guarda tu copia del contrato. Si el auto o las promesas del concesionario resultan no ser ciertos, este aviso te permite reclamarle a quien tenga tu préstamo, no solo al concesionario.",
      source: { name: "Regla de la FTC sobre el tenedor del contrato (Holder Rule, 16 CFR parte 433)", url: "" },
    },
  },

  general: [
    {
      type: "no_cooling_off",
      tone: "info",
      title: "No hay 3 días para arrepentirte",
      explain:
        "La ley federal no te da 3 días para cancelar la compra de un auto en un concesionario; la Regla de Enfriamiento (Cooling-Off Rule) de la FTC no aplica. Cuando firmes, cuenta con que la venta es final, a menos que el concesionario te dé una política de devolución por escrito.",
      action: "Tómate tu tiempo y lee cada página antes de firmar. Si el concesionario ofrece una política de devolución, pídela por escrito.",
      source: { name: "Regla de Enfriamiento de la FTC (16 CFR parte 429); FTC, Buying a Used Car From a Dealer (en inglés)", url: "" },
    },
  ],

  checklist: [
    "Pide por escrito la confirmación de que tu financiamiento está aprobado y es final.",
    "No entregues el título ni las llaves de tu auto a cambio hasta que el financiamiento sea final.",
    "Guarda los recibos de tu pago inicial y copias de todo lo que firmes.",
    "Si te llaman para firmar un contrato nuevo con una tasa más alta, no tienes que firmarlo. Pide que te devuelvan tu pago inicial y tu auto a cambio.",
  ],
};

export const CLAUSES = { en, es };
