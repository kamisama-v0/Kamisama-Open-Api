import {
	WATCH_GROUPS_COLLECTION,
	WATCH_HISTORY_COLLECTION,
	watchDb
} from '../../libs/firebase'
import { WatchModel } from './model'

/**
 * Daftar provider statis (tanpa read Firestore).
 * Urutan = prioritas pencocokan.
 */
const PROVIDERS: WatchModel.Provider[] & { pattern: RegExp }[] = [
	{ id: 'netflix', name: 'Netflix', icon: '🎬', pattern: /netflix\.com\/watch\//i },
	{ id: 'youtube', name: 'YouTube', icon: '▶️', pattern: /youtube\.com\/watch\?v=|youtu\.be\//i },
	{ id: 'viu', name: 'Viu', icon: '📺', pattern: /viu\.com\/watch\//i },
	{ id: 'bstation', name: 'Bstation', icon: '🟦', pattern: /bilibili\.com\/bangumi\/play\/|bilibili\.tv\//i },
	{ id: 'prime', name: 'Amazon Prime', icon: '📦', pattern: /primevideo\.com\/detail\//i },
	{ id: 'disney', name: 'Disney+', icon: '✨', pattern: /disneyplus\.com\/video\//i },
	{ id: 'hbomax', name: 'HBO Max', icon: '🔴', pattern: /hbomax\.com\/watch\/|max\.com\/watch\//i },
	{ id: 'appletv', name: 'Apple TV+', icon: '🍎', pattern: /tv\.apple\.com\//i }
]

const CUSTOM_PROVIDER = { id: 'custom', name: 'Custom URL', icon: '🌐' }

export function detectProvider(url: string): WatchModel.Provider {
	const found = PROVIDERS.find((p) => p.pattern.test(url))
	if (!found) return CUSTOM_PROVIDER
	const { pattern: _omit, ...provider } = found
	return provider
}

export function listProviders(): WatchModel.Provider[] {
	return [...PROVIDERS.map(({ pattern: _omit, ...p }) => p), CUSTOM_PROVIDER]
}

function toGroup(id: string, data: FirebaseFirestore.DocumentData): WatchModel.Group {
	return {
		id,
		name: data.name,
		provider: data.provider,
		avatarUrl: data.avatarUrl ?? null,
		description: data.description ?? null,
		createdAt: data.createdAt,
		updatedAt: data.updatedAt
	}
}

function toHistory(id: string, data: FirebaseFirestore.DocumentData): WatchModel.History {
	return {
		id,
		title: data.title,
		episode: data.episode,
		timestamp: data.timestamp,
		provider: data.provider,
		url: data.url,
		notes: data.notes ?? null,
		duration: data.duration ?? 0,
		watchedAt: data.watchedAt,
		previousLog: data.previousLog ?? null
	}
}

export abstract class WatchService {
	// --- GROUPS ---

	static async getGroups(userId: string): Promise<WatchModel.Group[]> {
		const snap = await watchDb()
			.collection(WATCH_GROUPS_COLLECTION)
			.where('userId', '==', userId)
			.orderBy('createdAt', 'desc')
			.get()
		return snap.docs.map((doc) => toGroup(doc.id, doc.data()))
	}

	static async createGroup(
		userId: string,
		data: WatchModel.CreateGroup
	): Promise<WatchModel.Group> {
		const now = new Date().toISOString()
		const ref = await watchDb().collection(WATCH_GROUPS_COLLECTION).add({
			userId,
			name: data.name,
			provider: data.provider,
			avatarUrl: data.avatarUrl ?? null,
			description: data.description ?? null,
			createdAt: now,
			updatedAt: now
		})
		const doc = await ref.get()
		return toGroup(ref.id, doc.data()!)
	}

	static async updateGroup(
		userId: string,
		id: string,
		data: WatchModel.UpdateGroup
	): Promise<WatchModel.Group> {
		const ref = watchDb().collection(WATCH_GROUPS_COLLECTION).doc(id)
		const doc = await ref.get()
		if (!doc.exists || doc.data()?.userId !== userId) {
			throw new Error('Watch group not found')
		}
		await ref.update({
			...data,
			avatarUrl: data.avatarUrl ?? null,
			description: data.description ?? null,
			updatedAt: new Date().toISOString()
		})
		const updated = await ref.get()
		return toGroup(id, updated.data()!)
	}

	static async deleteGroup(userId: string, id: string): Promise<void> {
		const ref = watchDb().collection(WATCH_GROUPS_COLLECTION).doc(id)
		const doc = await ref.get()
		if (!doc.exists || doc.data()?.userId !== userId) {
			throw new Error('Watch group not found')
		}
		// Hapus riwayat dalam grup yang sama (batch)
		const history = await watchDb()
			.collection(WATCH_HISTORY_COLLECTION)
			.where('userId', '==', userId)
			.where('groupId', '==', id)
			.get()
		const batch = watchDb().batch()
		history.docs.forEach((d) => batch.delete(d.ref))
		batch.delete(ref)
		await batch.commit()
	}

	// --- HISTORY ---

	static async getHistory(
		userId: string,
		query: WatchModel.HistoryQuery
	): Promise<{ items: WatchModel.History[]; nextPageToken: string | null }> {
		const limit = query.limit ?? 20
		let q: FirebaseFirestore.Query = watchDb()
			.collection(WATCH_HISTORY_COLLECTION)
			.where('userId', '==', userId)
			.orderBy('watchedAt', 'desc')

		if (query.groupId) {
			q = watchDb()
				.collection(WATCH_HISTORY_COLLECTION)
				.where('userId', '==', userId)
				.where('groupId', '==', query.groupId)
				.orderBy('watchedAt', 'desc')
		}

		if (query.pageToken) {
			const cursor = await watchDb()
				.collection(WATCH_HISTORY_COLLECTION)
				.doc(query.pageToken)
				.get()
			if (!cursor.exists) throw new Error('Invalid pageToken')
			q = q.startAfter(cursor)
		}

		const snap = await q.limit(limit + 1).get()
		const hasMore = snap.docs.length > limit
		const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs
		return {
			items: docs.map((doc) => toHistory(doc.id, doc.data())),
			nextPageToken: hasMore ? docs[docs.length - 1].id : null
		}
	}

	static async createHistory(
		userId: string,
		data: WatchModel.CreateHistory
	): Promise<WatchModel.History> {
		// Pastikan grup milik user
		const group = await watchDb()
			.collection(WATCH_GROUPS_COLLECTION)
			.doc(data.groupId)
			.get()
		if (!group.exists || group.data()?.userId !== userId) {
			throw new Error('Watch group not found')
		}

		const provider = detectProvider(data.url)

		// Cari log terakhir untuk judul yang sama di grup ini
		const prev = await watchDb()
			.collection(WATCH_HISTORY_COLLECTION)
			.where('userId', '==', userId)
			.where('groupId', '==', data.groupId)
			.where('title', '==', data.title)
			.orderBy('watchedAt', 'desc')
			.limit(1)
			.get()

		const previousLog = prev.empty
			? null
			: {
					episode: prev.docs[0].data().episode,
					timestamp: prev.docs[0].data().timestamp,
					watchedAt: prev.docs[0].data().watchedAt
				}

		const ref = await watchDb().collection(WATCH_HISTORY_COLLECTION).add({
			userId,
			groupId: data.groupId,
			title: data.title,
			episode: data.episode,
			timestamp: data.timestamp,
			provider: provider.name,
			url: data.url,
			notes: data.notes ?? null,
			duration: data.duration ?? 0,
			watchedAt: new Date().toISOString(),
			previousLog
		})
		const doc = await ref.get()
		return toHistory(ref.id, doc.data()!)
	}

	static async updateHistory(
		userId: string,
		id: string,
		data: WatchModel.UpdateHistory
	): Promise<WatchModel.History> {
		const ref = watchDb().collection(WATCH_HISTORY_COLLECTION).doc(id)
		const doc = await ref.get()
		if (!doc.exists || doc.data()?.userId !== userId) {
			throw new Error('Watch history not found')
		}
		const payload: Record<string, unknown> = { ...data }
		if (data.url !== undefined) {
			payload.provider = detectProvider(data.url).name
		}
		await ref.update(payload)
		const updated = await ref.get()
		return toHistory(id, updated.data()!)
	}

	static async deleteHistory(userId: string, id: string): Promise<void> {
		const ref = watchDb().collection(WATCH_HISTORY_COLLECTION).doc(id)
		const doc = await ref.get()
		if (!doc.exists || doc.data()?.userId !== userId) {
			throw new Error('Watch history not found')
		}
		await ref.delete()
	}
}
