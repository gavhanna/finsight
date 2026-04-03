function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null
  try {
    return (await navigator.serviceWorker.getRegistration("/")) ?? null
  } catch {
    return null
  }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  const reg = await getServiceWorkerRegistration()
  if (!reg) return null
  try {
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription> {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers not supported")
  if (!("PushManager" in window)) throw new Error("Push notifications not supported")

  const reg = await navigator.serviceWorker.ready
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
  })
  return subscription
}

export function serializeSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  }
}
