import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

let _db: ReturnType<typeof getFirestore> | null = null

export function getAdminDb() {
  if (_db) return _db
  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) })
  _db = getFirestore(app)
  try { _db.settings({ ignoreUndefinedProperties: true }) } catch { /* already set on hot-reload */ }
  return _db
}
