import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
  getMerchantSpendDetail,
  getMerchantSpendList,
} from "../services/merchants.server"

const MerchantFilters = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
})

export const getMerchantList = createServerFn()
  .inputValidator(MerchantFilters)
  .handler(async ({ data: filters }) => {
    return getMerchantSpendList(filters)
  })

export const getMerchantDetail = createServerFn()
  .inputValidator(MerchantFilters.extend({ merchantName: z.string() }))
  .handler(async ({ data: { merchantName, ...filters } }) => {
    return getMerchantSpendDetail(merchantName, filters)
  })
