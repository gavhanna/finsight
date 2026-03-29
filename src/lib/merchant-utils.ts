/**
 * Normalises a raw merchant/payee name from bank data.
 *
 * BOI (Bank of Ireland) encodes card transactions as:
 *   "POS09OCT MERCHANT NAME"   (chip/swipe)
 *   "POSC07FEB MERCHANT NAME"  (contactless)
 *   "B365 MERCHANT NAME IP"    (365 Online instant payment)
 *   "365 ONLINE MERCHANT NAME" (365 Online transfer)
 *
 * SEPA direct debits often append " SEPA DD" or have suffixes like " SO", " IP", " DD".
 * Store IDs like "ALDI 872-08" or "LIDL IRELAN 15" also vary per visit.
 */
export function normalizeMerchantName(raw: string): string {
  let name = raw.trim()

  // Strip leading BOI card-transaction date codes: "POS09OCT " / "POSC30JAN "
  name = name.replace(/^POSC?\d{2}[A-Z]{3}\s+/i, "")

  // Strip leading BOI 365 Online prefixes: "B365 " / "365 ONLINE "
  name = name.replace(/^B365\s+/i, "")
  name = name.replace(/^365 ONLINE\s+/i, "")

  // Strip trailing payment-type suffixes: " SEPA DD", " SO", " IP", " DD"
  name = name.replace(/\s+(SEPA\s+DD|SEPA|SO|IP|DD)\s*$/i, "")

  // Strip trailing number/code sequences: " 872-08", " 15 872", " 15 872-08", " 4521"
  // Matches one or more groups of (whitespace + digits + optional dashes/digits)
  name = name.replace(/(\s+\d[\d-]*)+\s*$/, "")

  // Collapse whitespace and uppercase for consistent grouping
  name = name.replace(/\s+/g, " ").trim().toUpperCase()

  return name || raw.toUpperCase()
}
