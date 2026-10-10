"""Generate FairDeal test contracts 05-10 and append them to the answer key.

Each contract is a fictional Georgia deal rendered as a PDF in one of three
layouts (buyer's order, cash buyer's order, retail installment contract).
All totals are computed here so the documents and answer key always agree.

Usage (from the repo root):
    python3 tools/make_samples.py
Then render images with tools/make_images.py.
"""

import json
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

OUT = Path(__file__).resolve().parent.parent / "sample-contracts"
W, H = letter
TAVT_RATE = 0.07
TITLE_FEE = 18.0
TAG_FEE = 20.0


def money(n):
    n = round(n, 2) + 0.0  # avoid "-0.00"
    return f"(${-n:,.2f})" if n < 0 else f"${n:,.2f}"


def payment(principal, apr, months):
    if months <= 0 or principal <= 0:
        return 0.0
    r = apr / 100 / 12
    if r == 0:
        return round(principal / months, 2)
    return round(principal * r / (1 - (1 + r) ** -months), 2)


def compute(d):
    """Fill in taxes, amount financed, payment and total of payments."""
    taxable = d["vehicle_price"] - d["trade_in_allowance"]
    d["taxes_and_government_fees"] = {
        "tavt": round(taxable * TAVT_RATE, 2),
        "title": TITLE_FEE,
        "tag": TAG_FEE,
    }
    items = sum(i["amount"] for i in d["fees"] + d["add_ons"])
    taxes = sum(d["taxes_and_government_fees"].values())
    total_price = round(d["vehicle_price"] + items + taxes, 2)
    d["_total_price"] = total_price
    balance = round(total_price - d["down_payment"] - d["trade_in_allowance"] + d["trade_in_payoff"], 2)
    d["_balance"] = balance
    if d["term_months"]:
        d["amount_financed"] = balance
        d["monthly_payment"] = payment(balance, d["apr"], d["term_months"])
        d["total_of_payments"] = round(d["monthly_payment"] * d["term_months"], 2)
    else:  # cash deal: nothing financed
        d["amount_financed"] = 0.0
        d["monthly_payment"] = 0.0
        d["total_of_payments"] = 0.0
    return d


# ---------------------------------------------------------------- drawing ---

class Form:
    def __init__(self, path, dealer, doc_title, deal_no, salesperson):
        self.c = canvas.Canvas(str(path), pagesize=letter)
        self.c.setTitle(f"{dealer['name']} {doc_title}")
        self.c.setAuthor("FairDeal test sample")
        c = self.c
        c.setFont("Helvetica-Bold", 18)
        c.drawString(40, H - 52, dealer["name"])
        c.setFont("Helvetica", 8.5)
        c.drawString(40, H - 66, dealer["address"])
        c.drawString(40, H - 77, dealer["phone"])
        c.setFont("Helvetica-Bold", 14)
        c.drawRightString(W - 40, H - 54, doc_title)
        c.setFont("Helvetica", 8.5)
        c.drawRightString(W - 40, H - 67, f"Deal No. {deal_no}    Date 10/09/2026")
        c.drawRightString(W - 40, H - 78, f"Salesperson {salesperson}")
        c.setLineWidth(1.6)
        c.line(40, H - 86, W - 40, H - 86)

    def box(self, x, y_top, w, h, title):
        c = self.c
        c.setLineWidth(1)
        c.rect(x, y_top - h, w, h)
        c.setFillGray(0.88)
        c.rect(x, y_top - 15, w, 15, fill=1, stroke=1)
        c.setFillGray(0)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(x + 5, y_top - 11, title)

    def field(self, x, y, label, value, size=9):
        c = self.c
        c.setFont("Helvetica", 6.5)
        c.setFillGray(0.35)
        c.drawString(x, y, label)
        c.setFillGray(0)
        c.setFont("Courier-Bold", size)
        c.drawString(x, y - 11, value)

    def row(self, x, w, y, label, amount, bold=False, shade=False):
        c = self.c
        if shade:
            c.setFillGray(0.9)
            c.rect(x + 2, y - 4, w - 4, 13, fill=1, stroke=0)
            c.setFillGray(0)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 8.5)
        c.drawString(x + 6, y, label)
        c.setFont("Courier-Bold", 9)
        c.drawRightString(x + w - 6, y, amount)
        c.setStrokeGray(0.8)
        c.setLineWidth(0.4)
        c.line(x + 4, y - 4, x + w - 4, y - 4)
        c.setStrokeGray(0)

    def purchaser_vehicle(self, d, y_top):
        self.box(40, y_top, 250, 62, "PURCHASER")
        self.field(46, y_top - 26, "NAME", "JORDAN A. SAMPLE")
        self.field(46, y_top - 48, "ADDRESS", "123 Test St, Atlanta, GA 30303", 8)
        v = d["_vehicle"]
        self.box(300, y_top, W - 340, 62, "VEHICLE")
        self.field(306, y_top - 26, "NEW/USED", v["new_used"])
        self.field(352, y_top - 26, "YEAR", v["year"])
        self.field(392, y_top - 26, "MAKE", v["make"])
        self.field(460, y_top - 26, "MODEL", v["model"], 8)
        self.field(306, y_top - 48, "VIN", v["vin"], 8)
        self.field(432, y_top - 48, "ODOMETER", f"{d['mileage']:,}")
        self.field(500, y_top - 48, "COLOR", v["color"], 8)

    def footer(self):
        c = self.c
        y = 120
        for x, label in [(40, "PURCHASER SIGNATURE      DATE"), (225, "CO-PURCHASER SIGNATURE      DATE"), (410, "DEALER / AUTHORIZED REP      DATE")]:
            c.setLineWidth(0.8)
            c.line(x, y, x + 162, y)
            c.setFont("Helvetica", 6.5)
            c.drawString(x, y - 9, label)
        c.setFont("Helvetica-Oblique", 6.5)
        c.setFillGray(0.4)
        c.drawCentredString(W / 2, 30, "FairDeal test sample. Fictional dealer, buyer, lender and VIN. Not a real contract.")
        c.setFillGray(0)
        c.save()

    def fine_print(self, text, y):
        c = self.c
        c.setFont("Helvetica", 6.2)
        words, line = text.split(), ""
        for word in words:
            if c.stringWidth(line + " " + word, "Helvetica", 6.2) > W - 80:
                c.drawString(40, y, line)
                y -= 8
                line = word
            else:
                line = (line + " " + word).strip()
        c.drawString(40, y, line)


TERMS = (
    "1. This order is not binding until accepted by Dealer and, if financed, approved by the lender named above. "
    "2. Purchaser acknowledges the vehicle is sold AS IS unless a written warranty is provided. The Buyers Guide window form is part of this contract. "
    "3. The Documentary Service Fee is charged by Dealer for preparation of documents and is not a government fee. "
    "4. Optional products are not required to purchase the vehicle or obtain financing, and Purchaser may decline them. "
    "5. Purchaser certifies the trade-in information above is accurate. 6. Purchaser has read both sides of this agreement and received a completed copy."
)


def price_column(f, d, x, y_top, w, cash=False):
    rows = [("Cash Price of Vehicle", d["vehicle_price"])]
    rows += [(i["name"], i["amount"]) for i in d["fees"] + d["add_ons"]]
    subtotal = d["vehicle_price"] + sum(i["amount"] for i in d["fees"] + d["add_ons"])
    t = d["taxes_and_government_fees"]
    n = len(rows) + 10
    h = 24 + n * 16
    f.box(x, y_top, w, h, "PRICE AND PAYMENT")
    y = y_top - 32
    for label, amt in rows:
        f.row(x, w, y, label, money(amt))
        y -= 16
    f.row(x, w, y, "SUBTOTAL", money(subtotal), bold=True); y -= 16
    f.row(x, w, y, "GA Title Ad Valorem Tax (TAVT) 7.0%", money(t["tavt"])); y -= 16
    f.row(x, w, y, "Title Fee", money(t["title"])); y -= 16
    f.row(x, w, y, "Tag / Registration Fee", money(t["tag"])); y -= 16
    f.row(x, w, y, "TOTAL CASH PRICE (incl. taxes & fees)", money(d["_total_price"]), bold=True); y -= 16
    f.row(x, w, y, "Less: Cash Down Payment" if not cash else "Less: Deposit Paid", money(-d["down_payment"])); y -= 16
    f.row(x, w, y, "Less: Trade-In Allowance", money(-d["trade_in_allowance"])); y -= 16
    f.row(x, w, y, "Plus: Payoff on Trade-In", money(d["trade_in_payoff"])); y -= 16
    label = "BALANCE DUE AT DELIVERY (CASH)" if cash else "UNPAID BALANCE / AMOUNT TO FINANCE"
    f.row(x, w, y, label, money(d["_balance"]), bold=True, shade=True)
    return y_top - h


def buyers_order(path, d, cash=False):
    f = Form(path, d["_dealer"], "VEHICLE BUYER'S ORDER", d["_deal_no"], d["_sales"])
    f.purchaser_vehicle(d, H - 96)
    top = H - 170
    lw = 240
    # Trade-in
    f.box(40, top, lw, 66, "TRADE-IN")
    tr = d.get("_trade")
    f.field(46, top - 26, "YEAR / MAKE / MODEL", tr["desc"] if tr else "NONE", 8)
    f.field(46, top - 50, "ALLOWANCE", money(d["trade_in_allowance"]))
    f.field(160, top - 50, "LIENHOLDER PAYOFF", money(d["trade_in_payoff"]))
    # Finance terms
    ft = top - 76
    f.box(40, ft, lw, 124, "FINANCE TERMS (SUBJECT TO LENDER APPROVAL)")
    if cash:
        f.field(46, ft - 26, "LENDER", "N/A - CASH / OUTSIDE FINANCING", 8)
        f.field(46, ft - 52, "ANNUAL PERCENTAGE RATE", "N/A")
        f.field(160, ft - 52, "TERM (MONTHS)", "N/A")
        f.field(46, ft - 78, "MONTHLY PAYMENT", "N/A")
        f.field(160, ft - 78, "AMOUNT FINANCED", "N/A")
    else:
        f.field(46, ft - 26, "LENDER", d["_lender"], 8)
        f.field(46, ft - 52, "ANNUAL PERCENTAGE RATE", f"{d['apr']:.2f}%")
        f.field(160, ft - 52, "TERM (MONTHS)", str(d["term_months"]))
        f.field(46, ft - 78, "MONTHLY PAYMENT", money(d["monthly_payment"]))
        f.field(160, ft - 78, "FIRST PAYMENT DUE", "11/23/2026")
        f.field(46, ft - 100, "AMOUNT FINANCED", money(d["amount_financed"]))
        f.field(160, ft - 100, "TOTAL OF PAYMENTS", money(d["total_of_payments"]))
    # Optional products
    op = ft - 134
    names = [i["name"] for i in d["add_ons"]] or ["None selected"]
    f.box(40, op, lw, 22 + 13 * len(names), "OPTIONAL PRODUCTS (INITIAL)")
    f.c.setFont("Helvetica", 8)
    for k, name in enumerate(names):
        f.c.drawString(48, op - 28 - 13 * k, f"_____  {name}")
    bottom = price_column(f, d, 290, top, W - 330, cash=cash)
    f.fine_print(TERMS, min(bottom, op - 22 - 13 * len(names)) - 18)
    f.footer()


def risc(path, d):
    f = Form(path, d["_dealer"], "RETAIL INSTALLMENT SALE CONTRACT", d["_deal_no"], d["_sales"])
    f.c.setFont("Helvetica-Bold", 7)
    f.c.drawString(40, H - 98, f"SIMPLE INTEREST. Seller-Creditor: {d['_dealer']['name']}. Buyer may prepay at any time without penalty.")
    f.purchaser_vehicle(d, H - 106)
    # TILA box
    top = H - 180
    cols = [
        ("ANNUAL PERCENTAGE\nRATE", "The cost of your credit as a yearly rate.", f"{d['apr']:.2f} %"),
        ("FINANCE CHARGE", "The dollar amount the credit will cost you.", money(d["total_of_payments"] - d["amount_financed"])),
        ("Amount Financed", "The amount of credit provided to you.", money(d["amount_financed"])),
        ("Total of Payments", "What you will have paid after all payments.", money(d["total_of_payments"])),
        ("Total Sale Price", f"Including down payment of {money(d['down_payment'])}.", money(d["total_of_payments"] + d["down_payment"])),
    ]
    cw = (W - 80) / 5
    f.c.setLineWidth(1.4)
    f.c.rect(40, top - 74, W - 80, 74)
    for k, (head, sub, val) in enumerate(cols):
        x = 40 + k * cw
        if k:
            f.c.line(x, top, x, top - 74)
        f.c.setFont("Helvetica-Bold", 7)
        for n, part in enumerate(head.split("\n")):
            f.c.drawString(x + 5, top - 11 - 8 * n, part)
        f.c.setFont("Helvetica", 5.8)
        line, yy = "", top - 30
        for word in sub.split():
            if f.c.stringWidth(f"{line} {word}".strip(), "Helvetica", 5.8) > cw - 10:
                f.c.drawString(x + 5, yy, line)
                line, yy = word, yy - 7
            else:
                line = f"{line} {word}".strip()
        f.c.drawString(x + 5, yy, line)
        f.c.setFont("Courier-Bold", 11)
        f.c.drawString(x + 5, top - 58, val)
    f.c.setFont("Helvetica", 8)
    f.c.drawString(40, top - 90, f"Number of Payments: {d['term_months']}      Amount of Payments: {money(d['monthly_payment'])}      When Due: Monthly beginning 11/23/2026")
    # Itemization
    it = top - 104
    rows = [("1. Cash Price of Vehicle", d["vehicle_price"])]
    rows += [(f"    {i['name']}", i["amount"]) for i in d["fees"]]
    rows += [(f"    {i['name']} (optional)", i["amount"]) for i in d["add_ons"]]
    t = d["taxes_and_government_fees"]
    rows += [
        ("    Total Cash Price", d["vehicle_price"] + sum(i["amount"] for i in d["fees"] + d["add_ons"])),
        ("2. Paid to Public Officials: GA TAVT 7.0%", t["tavt"]),
        ("    Title Fee", t["title"]),
        ("    Registration / Tag Fee", t["tag"]),
        ("3. Total Price (1 + 2)", d["_total_price"]),
        ("4. Cash Down Payment", -d["down_payment"]),
        ("5. Net Trade-In", -(d["trade_in_allowance"] - d["trade_in_payoff"])),
        ("6. AMOUNT FINANCED (3 - 4 - 5)", d["amount_financed"]),
    ]
    iw = 360
    f.box(40, it, iw, 24 + 16 * len(rows), "ITEMIZATION OF AMOUNT FINANCED")
    y = it - 32
    for label, amt in rows:
        f.row(40, iw, y, label, money(amt), bold=label.startswith(("3.", "6.")), shade=label.startswith("6."))
        y -= 16
    f.box(410, it, W - 450, 24 + 16 * len(rows), "OPTIONAL PRODUCTS / NOTICES")
    notes = d.get("_notices", [])
    f.c.setFont("Helvetica", 7)
    ny = it - 30
    for line in notes:
        f.c.drawString(416, ny, line)
        ny -= 10
    f.fine_print(
        "NOTICE TO BUYER: Do not sign this contract before you read it or if it contains any blank spaces. You are entitled to an exact copy of the contract you sign. "
        "Security: You are giving a security interest in the vehicle being purchased. Repossession: If you default, Seller-Creditor may take the vehicle as permitted by law. "
        "Any holder of this consumer credit contract is subject to all claims and defenses which the debtor could assert against the seller.",
        y - 14,
    )
    f.footer()


# ---------------------------------------------------------------- deals -----

def deal(**kw):
    base = dict(trade_in_allowance=0.0, trade_in_payoff=0.0, fees=[], add_ons=[], down_payment=0.0)
    base.update(kw)
    return base


def item(name, amount):
    return {"name": name, "amount": float(amount)}


DEALS = [
    dict(
        file="05_negative_equity_trade.pdf", layout="order",
        scenario="Trade-in with negative equity rolled into a 75-month loan (should land in 'Negotiate')",
        document_type="Buyer's order", credit_tier="Fair", kbb=21500,
        expected_flags=[
            "APR 14.99% above typical for Fair credit",
            "75-month term (caution, not scored)",
            "Price ~$495 above market (KBB $21,500)",
            "GAP somewhat high",
            "Tire & wheel protection overpriced",
        ],
        notes="Trade-in owes $3,800 more than it's worth; that negative equity is added to the loan. Tests extracting trade-in allowance and payoff separately.",
        d=deal(
            vehicle="2020 Honda Civic EX 4D SEDAN", mileage=52140, vehicle_price=21995.0, apr=14.99, term_months=75,
            down_payment=500.0, trade_in_allowance=4000.0, trade_in_payoff=7800.0,
            fees=[item("Documentary Service Fee", 599)],
            add_ons=[item("GAP Waiver", 795), item("Tire & Wheel Protection", 699)],
            _vehicle=dict(new_used="USED", year="2020", make="HONDA", model="CIVIC EX 4D SEDAN", vin="TESTVIN0000000005", color="SONIC GRAY"),
            _trade=dict(desc="2014 CHEVROLET CRUZE LT"),
            _dealer=dict(name="PEACH STATE AUTO PLAZA", address="2410 Fictional Pkwy, Morrow, GA 30260", phone="(678) 555-0142 | GA Dealer Lic. #D-001377"),
            _deal_no="PSA-20931", _sales="K. Owens", _lender="Southern Crescent Credit (fictional)",
        ),
    ),
    dict(
        file="06_new_car_promo_rate.pdf", layout="order",
        scenario="New car with a 1.9% promotional rate (should score high)",
        document_type="Buyer's order", credit_tier="Excellent", kbb=23700,
        expected_flags=[],
        notes="New vehicle, low promo APR, price below KBB, one modest doc fee. Tests that a low APR and a new car don't trigger flags.",
        d=deal(
            vehicle="2026 Toyota Corolla LE 4D SEDAN", mileage=12, vehicle_price=23450.0, apr=1.9, term_months=60,
            down_payment=3000.0,
            fees=[item("Documentary Service Fee", 499)],
            _vehicle=dict(new_used="NEW", year="2026", make="TOYOTA", model="COROLLA LE 4D SEDAN", vin="TESTVIN0000000006", color="CELESTITE"),
            _dealer=dict(name="NORTHSIDE TOYOTA (FICTIONAL)", address="11 Fictional Rd, Marietta, GA 30060", phone="(770) 555-0123 | GA Dealer Lic. #D-000455"),
            _deal_no="NST-77210", _sales="R. Patel", _lender="Toyota Promo Financing (fictional)",
        ),
    ),
    dict(
        file="07_risc_high_mileage.pdf", layout="risc",
        scenario="Retail installment contract on a high-mileage SUV, stacked add-ons (should score very low)",
        document_type="Retail installment sale contract", credit_tier="Poor", kbb=9800,
        expected_flags=[
            "APR 26.99% far above typical for Poor credit",
            "Price ~$3,195 above market (KBB $9,800)",
            "GPS locator device charged to buyer",
            "Tire & wheel protection overpriced",
            "Key replacement plan overpriced",
            "Doc fee on the high end",
            "Service agreement financed at 26.99% (caution, not scored)",
        ],
        notes="TILA-box layout like 04 but a different dealer and line names ('Vehicle Service Agreement', 'GPS Locator Device').",
        d=deal(
            vehicle="2016 Nissan Rogue S AWD 4D SUV", mileage=118450, vehicle_price=12995.0, apr=26.99, term_months=60,
            down_payment=1000.0,
            fees=[item("Documentary Fee", 899)],
            add_ons=[item("Vehicle Service Agreement", 2495), item("GPS Locator Device", 499), item("Tire & Wheel Protection", 899), item("Key Replacement Plan", 399)],
            _vehicle=dict(new_used="USED", year="2016", make="NISSAN", model="ROGUE S AWD 4D SUV", vin="TESTVIN0000000007", color="BLACK"),
            _dealer=dict(name="SECOND CHANCE MOTORS", address="77 Fictional Ave, Riverdale, GA 30274", phone="(770) 555-0161 | GA Dealer Lic. #D-001588"),
            _deal_no="SCM-4410", _sales="L. Grant",
            _notices=["Service agreement, tire & wheel, key", "replacement and GPS device are NOT", "required to obtain credit.", "", "GPS DISCLOSURE: Vehicle may be located", "and disabled if a payment is late.", "", "Buyer initials: ______"],
        ),
    ),
    dict(
        file="08_cash_deal_no_financing.pdf", layout="cash",
        scenario="Cash / outside-financing deal with no loan terms on the document (should land in 'Negotiate')",
        document_type="Buyer's order", credit_tier="Good", kbb=31000,
        expected_flags=[
            "Price ~$1,495 above market (KBB $31,000)",
            "Ceramic paint coating overpriced",
            "Nitrogen fill is a junk add-on",
        ],
        notes="Finance terms read N/A. APR, term, monthly payment, amount financed and total of payments should all extract as 0. Tests that missing loan terms don't break extraction or the rules.",
        d=deal(
            vehicle="2022 Ford F-150 XLT SUPERCREW 4X4", mileage=38900, vehicle_price=32495.0, apr=0.0, term_months=0,
            down_payment=2000.0,
            fees=[item("Documentary Service Fee", 699)],
            add_ons=[item("Nitrogen Tire Fill", 149), item("Ceramic Paint Coating", 899)],
            _vehicle=dict(new_used="USED", year="2022", make="FORD", model="F-150 XLT SUPERCREW", vin="TESTVIN0000000008", color="AGATE BLACK"),
            _dealer=dict(name="BIG PEACH TRUCK CENTER", address="5300 Fictional Hwy, Lithonia, GA 30038", phone="(678) 555-0188 | GA Dealer Lic. #D-000731"),
            _deal_no="BPT-11876", _sales="M. Diaz",
        ),
    ),
    dict(
        file="09_payment_packing_84mo.pdf", layout="order",
        scenario="84-month payment-packed deal with reconditioning fee and stacked plans (should score very low)",
        document_type="Buyer's order", credit_tier="Good", kbb=26000,
        expected_flags=[
            "APR 12.49% above typical for Good credit",
            "84-month term (payment packing)",
            "Price ~$1,990 above market (KBB $26,000)",
            "Reconditioning fee (cost of doing business)",
            "Tire & wheel protection overpriced",
            "Key replacement plan overpriced",
            "Doc fee on the high end",
            "Extended warranty financed at 12.49% (caution, not scored)",
        ],
        notes="Zero down, everything rolled into an 84-month loan.",
        d=deal(
            vehicle="2021 Jeep Grand Cherokee Laredo 4X4", mileage=61200, vehicle_price=27990.0, apr=12.49, term_months=84,
            fees=[item("Documentary Service Fee", 799), item("Reconditioning Fee", 1495)],
            add_ons=[item("Tire & Wheel Protection", 1199), item("Key Replacement Plan", 499), item("Extended Warranty 60mo/75k", 2995)],
            _vehicle=dict(new_used="USED", year="2021", make="JEEP", model="GRAND CHEROKEE LAREDO", vin="TESTVIN0000000009", color="DIAMOND BLACK"),
            _dealer=dict(name="METRO VALUE MOTORS", address="8800 Fictional Blvd, Jonesboro, GA 30236", phone="(770) 555-0199 | GA Dealer Lic. #D-000982"),
            _deal_no="MVM-55340", _sales="D. Ruiz", _lender="Velocity Auto Finance (fictional)",
        ),
    ),
    dict(
        file="10_close_call.pdf", layout="risc",
        scenario="Mostly reasonable deal with a few small markups (should land in 'Negotiate', near the line)",
        document_type="Retail installment sale contract", credit_tier="Excellent", kbb=30800,
        expected_flags=[
            "APR 7.49% slightly above typical for Excellent credit",
            "Price ~$900 above market (KBB $30,800)",
            "VIN etching",
            "GAP slightly high",
        ],
        notes="Near the Fair/Negotiate boundary. Tests small flags adding up correctly.",
        d=deal(
            vehicle="2023 Subaru Outback Premium AWD", mileage=21300, vehicle_price=31700.0, apr=7.49, term_months=66,
            down_payment=4000.0,
            fees=[item("Documentary Fee", 599)],
            add_ons=[item("GAP Waiver", 650), item("VIN Etching", 199)],
            _vehicle=dict(new_used="USED", year="2023", make="SUBARU", model="OUTBACK PREMIUM AWD", vin="TESTVIN0000000010", color="AUTUMN GREEN"),
            _dealer=dict(name="CHATTAHOOCHEE SUBARU (FICTIONAL)", address="90 Fictional Way, Roswell, GA 30076", phone="(470) 555-0109 | GA Dealer Lic. #D-001902"),
            _deal_no="CSU-30188", _sales="A. Kim",
            _notices=["GAP waiver and VIN etching are NOT", "required to obtain credit.", "", "Buyer initials: ______"],
        ),
    ),
]

KEY_FIELDS = [
    "vehicle", "mileage", "vehicle_price", "apr", "term_months", "down_payment", "trade_in_allowance",
    "trade_in_payoff", "monthly_payment", "amount_financed", "total_of_payments", "fees", "add_ons",
    "taxes_and_government_fees",
]


def main():
    key_path = OUT / "answer_key.json"
    key = [e for e in json.loads(key_path.read_text()) if e["file"][:2] < "05"]
    for spec in DEALS:
        d = compute(spec["d"])
        path = OUT / spec["file"]
        {"order": buyers_order, "cash": lambda p, x: buyers_order(p, x, cash=True), "risc": risc}[spec["layout"]](path, d)
        key.append({
            "file": spec["file"],
            "scenario": spec["scenario"],
            "document_type": spec["document_type"],
            "test_inputs": {"credit_tier": spec["credit_tier"], "kbb_value_to_enter": spec["kbb"]},
            "expected_extraction": {k: d[k] for k in KEY_FIELDS},
            "expected_flags": spec["expected_flags"],
            "notes": spec["notes"],
        })
        print(f"wrote {path.name}: financed {money(d['amount_financed'])}, {money(d['monthly_payment'])}/mo")
    key_path.write_text(json.dumps(key, indent=2) + "\n")
    print(f"answer key: {len(key)} contracts")


if __name__ == "__main__":
    main()
