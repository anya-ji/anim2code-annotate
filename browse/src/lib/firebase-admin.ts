import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

function getFirebaseApp(): App {
  if (getApps().length > 0) return getApp()
  const key = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!key) throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set")
  return initializeApp({ credential: cert(JSON.parse(key)) })
}

export function getDb() {
  getFirebaseApp()
  return getFirestore()
}
