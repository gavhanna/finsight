import NordigenClient from "nordigen-node"

let client: InstanceType<typeof NordigenClient> | null = null
let tokenExpiresAt = 0
let institutionsCache: Record<string, GoCardlessInstitution[]> = {}

export interface GoCardlessInstitution {
  id: string
  name: string
  bic: string
  logo: string
  countries: string[]
}

export interface GoCardlessTransaction {
  transactionId?: string
  entryReference?: string
  bookingDate: string
  valueDate?: string
  transactionAmount: { amount: string; currency: string }
  creditorName?: string
  debtorName?: string
  remittanceInformationUnstructured?: string
  remittanceInformationStructured?: string
  merchantCategoryCode?: string
}

export interface GoCardlessRequisition {
  id: string
  status: string
  agreement: string
  accounts: string[]
  link: string
  institution_id: string
}

function getClient(secretId: string, secretKey: string) {
  if (!client) {
    client = new NordigenClient({ secretId, secretKey })
  }
  return client
}

export async function getInstitutions(
  secretId: string,
  secretKey: string,
  country: string,
): Promise<GoCardlessInstitution[]> {
  const cacheKey = `${country}`
  if (institutionsCache[cacheKey]) return institutionsCache[cacheKey]

  const nordigen = getClient(secretId, secretKey)
  await ensureToken(nordigen)

  const result = await nordigen.institution.getInstitutions({ country })
  institutionsCache[cacheKey] = result as GoCardlessInstitution[]
  return institutionsCache[cacheKey]
}

export async function createRequisition(
  secretId: string,
  secretKey: string,
  institutionId: string,
  redirectUrl: string,
): Promise<GoCardlessRequisition> {
  const nordigen = getClient(secretId, secretKey)
  await ensureToken(nordigen)

  console.log("[GoCardless] createAgreement", { institutionId, redirectUrl })
  let agreement: any
  try {
    agreement = await nordigen.agreement.createAgreement({
      institutionId,
      maxHistoricalDays: 90,
      accessValidForDays: 90,
      accessScope: ["details", "balances", "transactions"],
    })
    console.log("[GoCardless] agreement created", agreement)
  } catch (err: any) {
    console.error("[GoCardless] createAgreement failed", err?.response?.data ?? err?.message ?? err)
    throw err
  }

  console.log("[GoCardless] createRequisition", { redirectUrl, institutionId, agreement: agreement.id })
  let requisition: any
  try {
    requisition = await nordigen.requisition.createRequisition({
      redirectUrl,
      institutionId,
      agreement: agreement.id as string,
      userLanguage: "EN",
    })
    console.log("[GoCardless] requisition created", requisition)
  } catch (err: any) {
    console.error("[GoCardless] createRequisition failed", err?.response?.data ?? err?.message ?? err)
    throw err
  }

  return requisition as unknown as GoCardlessRequisition
}

export async function getRequisition(
  secretId: string,
  secretKey: string,
  requisitionId: string,
): Promise<GoCardlessRequisition> {
  const nordigen = getClient(secretId, secretKey)
  await ensureToken(nordigen)
  const req = await nordigen.requisition.getRequisitionById(requisitionId)
  return req as unknown as GoCardlessRequisition
}

export async function getAccountDetails(
  secretId: string,
  secretKey: string,
  accountId: string,
): Promise<{
  id: string
  iban?: string
  currency?: string
  ownerName?: string
  name?: string
}> {
  const nordigen = getClient(secretId, secretKey)
  await ensureToken(nordigen)
  const account = nordigen.account(accountId)
  const details = await account.getDetails()
  return { id: accountId, ...(details?.account ?? {}) }
}

export async function getAccountTransactions(
  secretId: string,
  secretKey: string,
  accountId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<{
  booked: GoCardlessTransaction[]
  pending: GoCardlessTransaction[]
}> {
  const nordigen = getClient(secretId, secretKey)
  await ensureToken(nordigen)
  const account = nordigen.account(accountId)
  const params: Record<string, string> = {}
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  const result = await account.getTransactions(params)
  return {
    booked: (result?.transactions?.booked ?? []) as GoCardlessTransaction[],
    pending: (result?.transactions?.pending ?? []) as GoCardlessTransaction[],
  }
}

async function ensureToken(nordigen: InstanceType<typeof NordigenClient>) {
  const now = Date.now()
  if (now < tokenExpiresAt - 30_000) return
  const tokenData = await nordigen.generateToken()
  // access token expires in 24h by default
  tokenExpiresAt = now + (tokenData.access_expires ?? 86400) * 1000
}
