import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import setupCron from "./server/plugins/cron"

setupCron()

export default createStartHandler(defaultStreamHandler)
