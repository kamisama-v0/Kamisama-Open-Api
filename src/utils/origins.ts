// Origin tambahan via env (comma-separated) tanpa ubah kode.
// Kegunaan utama: URL sementara https://<service>.onrender.com untuk
// verifikasi sebelum DNS custom domain pindah ke Render.
// Contoh: EXTRA_ORIGINS=https://kamisama-xxx.onrender.com,https://foo.com
export const extraOrigins: string[] = (process.env.EXTRA_ORIGINS ?? '')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean)
