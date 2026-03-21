declare module "nordigen-node" {
  interface NordigenClientOptions {
    secretId: string
    secretKey: string
  }

  interface TokenData {
    access?: string
    refresh?: string
    access_expires?: number
    refresh_expires?: number
  }

  interface AccountAPI {
    getDetails(): Promise<any>
    getBalances(params?: Record<string, string>): Promise<any>
    getTransactions(params?: Record<string, string>): Promise<any>
  }

  class NordigenClient {
    constructor(options: NordigenClientOptions)
    generateToken(): Promise<TokenData>
    exchangeToken(opts: { refresh: string }): Promise<TokenData>
    institution: {
      getInstitutions(params: Record<string, string>): Promise<any[]>
      getInstitutionById(id: string): Promise<any>
    }
    agreement: {
      createAgreement(opts: {
        institutionId: string
        maxHistoricalDays?: number
        accessValidForDays?: number
        accessScope?: string[]
      }): Promise<{ id: string }>
    }
    requisition: {
      createRequisition(opts: {
        redirectUrl: string
        institutionId: string
        agreement?: string
        userLanguage?: string
        reference?: string
      }): Promise<any>
      getRequisitionById(id: string): Promise<any>
    }
    account(id: string): AccountAPI
  }

  export default NordigenClient
}
