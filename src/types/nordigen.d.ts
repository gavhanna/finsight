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
        institution_id: string
        max_historical_days?: number
        access_valid_for_days?: number
        access_scope?: string[]
      }): Promise<{ id: string }>
    }
    requisition: {
      createRequisition(opts: {
        redirect: string
        institution_id: string
        agreement?: string
        user_language?: string
        reference?: string
      }): Promise<any>
      getRequisitionById(id: string): Promise<any>
    }
    account(id: string): AccountAPI
  }

  export default NordigenClient
}
