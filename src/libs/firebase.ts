import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Singleton Firebase Admin (khusus data WatchTracker).
 * Kredensial via env agar aman di-deploy (tanpa service-account.json).
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY (ganti literal \n menjadi newline)
 */
function initFirebaseAdmin() {
	if (getApps().length > 0) return getApps()[0]!

	// Toleran terhadap value yang kepaste beserta kutipnya ("...") dari dashboard/secret.
	// Docker env_file tidak selalu strip kutip, jadi bersihkan di sini.
	const unquote = (v: string | undefined): string | undefined =>
		v?.trim().replace(/^["'](.*)["']$/, '$1')

	const projectId = unquote(process.env.FIREBASE_PROJECT_ID)
	const clientEmail = unquote(process.env.FIREBASE_CLIENT_EMAIL)
	const privateKey = unquote(process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n')

	if (!projectId || !clientEmail || !privateKey) {
		throw new Error(
			'Firebase Admin belum dikonfigurasi. Isi FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, dan FIREBASE_PRIVATE_KEY di .env'
		)
	}

	return initializeApp({
		credential: cert({ projectId, clientEmail, privateKey })
	})
}

/**
 * Firestore khusus WatchTracker. Koleksi:
 * - watch_groups
 * - watch_history
 */
export const watchDb = () => getFirestore(initFirebaseAdmin())

export const WATCH_GROUPS_COLLECTION = 'watch_groups'
export const WATCH_HISTORY_COLLECTION = 'watch_history'
