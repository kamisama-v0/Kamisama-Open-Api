import type { User } from '../src/generated/prisma/client'
import { prisma } from '../src/libs/db'
import { auth } from '../src/libs/auth'
// SEED PROD — idempoten, aman dijalankan tiap deploy CI/CD.
// - TANPA cleanDb (JANGAN pernah hapus — file ini untuk production).
// - Semua kredensial dari env (fail-fast bila kosong, tanpa default password).
// - Semua write pakai upsert / P2002-skip → aman diulang.
const req = (k: string): string => {
	const v = process.env[k]
	if (!v) throw new Error(`[seed.prod] env ${k} kosong — isi dulu`)
	return v
}

const seedKamisama = async () => {
	console.log('Seeding kamisama user...')
	const kamisamaEmail = req('SEED_KAMISAMA_EMAIL')
	const kamisamaPassword = req('SEED_KAMISAMA_PASSWORD')
	try {
		const user = await auth.api.createUser({
			body: {
				name: 'kamisama',
				email: kamisamaEmail,
				password: kamisamaPassword,
				role: 'kamisama',
				data: {
					username: 'kamisama'
				}
			}
		})
		console.log('Successfully created user:', user.user.name)
		await prisma.profile.upsert({
			where: { userId: user.user.id },
			update: {
				bio: 'The supreme being, creator of all.',
				avatar: 'https://example.com/kamisama-avatar.jpg',
				socials: [
					{
						media: 'twitter',
						url: '@kamisama_official'
					}
				]
			},
			create: {
				userId: user.user.id,
				bio: 'The supreme being, creator of all.',
				avatar: 'https://example.com/kamisama-avatar.jpg',
				socials: [
					{
						media: 'twitter',
						url: '@kamisama_official'
					}
				]
			}
		})
		console.log('Kamisama profile ensured.')
		return user.user
	} catch (error: any) {
		if (error.code === 'P2002') {
			console.log(
				'User with this email already exists. Fetching existing user...'
			)
			const existingUser = await prisma.user.findUnique({
				where: { email: kamisamaEmail }
			})
			if (!existingUser) {
				throw new Error(
					`User with email ${kamisamaEmail} should exist but was not found.`
				)
			}
			console.log('Found existing user:', existingUser.name)
			return existingUser
		} else {
			console.error('Error creating or fetching user:', error)
			throw error
		}
	}
}

const seedCategories = async () => {
	console.log('Seeding categories...')
	const categoriesData = [
		{ name: 'Technology', slug: 'technology' },
		{ name: 'Programming', slug: 'programming' },
		{ name: 'Lifestyle', slug: 'lifestyle' }
	]

	const createdCategories = []
	for (const cat of categoriesData) {
		const category = await prisma.category.upsert({
			where: { slug: cat.slug },
			update: {},
			create: cat
		})
		createdCategories.push(category)
	}
	console.log('Seeded categories.')
	return createdCategories
}

const seedTags = async () => {
	console.log('Seeding tags...')
	const tagsData = [
		{ name: 'JavaScript', slug: 'javascript' },
		{ name: 'TypeScript', slug: 'typescript' },
		{ name: 'Node.js', slug: 'nodejs' },
		{ name: 'Productivity', slug: 'productivity' }
	]

	const createdTags = []
	for (const tag of tagsData) {
		const newTag = await prisma.tag.upsert({
			where: { slug: tag.slug },
			update: {},
			create: tag
		})
		createdTags.push(newTag)
	}
	console.log('Seeded tags.')
	return createdTags
}

const seedArticleStatuses = async () => {
	console.log('Seeding article statuses...')
	const statusesData = [
		{ name: 'Draft', slug: 'draft' },
		{ name: 'Published', slug: 'published' },
		{ name: 'Archived', slug: 'archived' }
	]

	const createdStatuses = []
	for (const status of statusesData) {
		const newStatus = await prisma.articleStatus.upsert({
			where: { slug: status.slug },
			update: {},
			create: status
		})
		createdStatuses.push(newStatus)
	}
	console.log('Seeded article statuses.')
	return createdStatuses
}

const seedLanguages = async () => {
	console.log('Seeding languages...')
	const languagesData = [
		{ name: 'Indonesian', slug: 'id' },
		{ name: 'English', slug: 'en' }
	]

	const createdLanguages = []
	for (const lang of languagesData) {
		const newLang = await prisma.language.upsert({
			where: { slug: lang.slug },
			update: {},
			create: lang
		})
		createdLanguages.push(newLang)
	}
	console.log('Seeded languages.')
	return createdLanguages
}

const seedArticles = async (
	authorId: string,
	categories: any[],
	tags: any[],
	articleStatuses: any[],
	languages: any[]
) => {
	console.log('Seeding articles...')
	const articlesData = [
		{
			title: 'The Ultimate Guide to TypeScript',
			slug: 'ultimate-guide-to-typescript',
			content:
				'This is a deep dive into the world of TypeScript, exploring its features, benefits, and best practices.',
			excerpt:
				'Learn everything you need to know about TypeScript in this comprehensive guide.',
			statusId: articleStatuses.find((s) => s.slug === 'published').id,
			langId: languages.find((l) => l.slug === 'en').id,
			publishedAt: new Date(),
			categoryId: categories.find((c) => c.slug === 'programming').id,
			tagIds: [
				tags.find((t) => t.slug === 'typescript').id,
				tags.find((t) => t.slug === 'javascript').id
			]
		},
		{
			title: 'Boosting Productivity for Developers',
			slug: 'boosting-productivity-for-developers',
			content:
				'{"time":1752590904716,"blocks":[{"id":"jG8inKY-Y9","type":"header","data":{"text":"H1","level":1},"tunes":{"textAlignment":{"alignment":"left"}}},{"id":"B9tHogUIiw","type":"header","data":{"text":"H2","level":2},"tunes":{"textAlignment":{"alignment":"left"}}},{"id":"2VYHtY60VO","type":"header","data":{"text":"H3","level":3},"tunes":{"textAlignment":{"alignment":"left"}}},{"id":"FGtMdExiyd","type":"header","data":{"text":"H4","level":4},"tunes":{"textAlignment":{"alignment":"left"}}},{"id":"f8qYRCBMbg","type":"header","data":{"text":"H5","level":5},"tunes":{"textAlignment":{"alignment":"left"}}},{"id":"sCukKicuxU","type":"header","data":{"text":"H6 KANAN","level":6},"tunes":{"textAlignment":{"alignment":"right"}}},{"id":"TmoECk2TJk","type":"paragraph","data":{"text":"<b><i><mark class=\\"cdx-marker\\">TEXT fullset with marker</mark></i></b>"},"tunes":{"textAlignment":{"alignment":"left"}}},{"id":"tUdgXtJEyE","type":"paragraph","data":{"text":"TEXT LINK TENGAH"},"tunes":{"textAlignment":{"alignment":"center"}}},{"id":"dSh8oMmNkU","type":"paragraph","data":{"text":"LIST GAK KE SORT HEHEHE HAHAHA HIHIHI"},"tunes":{"textAlignment":{"alignment":"left"}}},{"id":"WakvrUJum9","type":"list","data":{"style":"ordered","meta":{"counterType":"numeric"},"items":[{"content":"LIST KE ORDER","meta":{},"items":[]},{"content":"2","meta":{},"items":[]},{"content":"3","meta":{},"items":[]},{"content":"4","meta":{},"items":[]}]}},{"id":"HuiMw86Fnu","type":"list","data":{"style":"checklist","meta":{},"items":[{"content":"CHEKIDOT","meta":{"checked":true},"items":[]},{"content":"CHEKINOT","meta":{"checked":false},"items":[]}]}},{"id":"doOZDGpxiw","type":"quote","data":{"text":"QATA QATA QWUOTE","caption":"CAPTION GAK TAU GUNANYA APA","alignment":"left"}},{"id":"4hPt6ABz8q","type":"code","data":{"code":"YA BUAT KODE LAHH HIHIHI"}},{"id":"mo44BZtDqQ","type":"table","data":{"withHeadings":false,"stretched":false,"content":[["TABEL KEREN&nbsp;","GAK PAKE HEADER"]]}},{"id":"kfKyFLdewW","type":"table","data":{"withHeadings":true,"stretched":true,"content":[["PAKE HEADING INI BOS","HEHEHE DAN LEBAR HAHAHA (FULL SIZE)"]]}},{"id":"T6qzRXyG7M","type":"delimiter","data":{}},{"id":"T0PpHoOaf3","type":"warning","data":{"title":"wArNing","message":"hehe"}},{"id":"Zdy2beEIpW","type":"image","data":{"caption":"","withBorder":false,"withBackground":false,"stretched":false,"file":{"url":"http://localhost:8000/uploads/images/image-1752590553.png"}}},{"id":"0_1_bN8J90","type":"paragraph","data":{"text":"image st"},"tunes":{"textAlignment":{"alignment":"left"}}},{"id":"Aw8-ja_tC5","type":"image","data":{"caption":"","withBorder":true,"withBackground":true,"stretched":true,"file":{"url":"http://localhost:8000/uploads/images/image-1752590588.png"}}},{"id":"LRfhD0w0-Q","type":"alert","data":{"type":"primary","align":"left","message":"primer"}},{"id":"OSBGJgU51x","type":"alert","data":{"type":"primary","align":"left","message":"info"}},{"id":"l_KJ0cmbm4","type":"alert","data":{"type":"secondary","align":"left","message":"sec"}},{"id":"ipYNEMyyx0","type":"alert","data":{"type":"success","align":"left","message":"<code class=\\"inline-code\\"><i>sucess code</i></code>"}},{"id":"RjbMm2qBBg","type":"alert","data":{"type":"danger","align":"left","message":"<i><b>danger</b></i>"}},{"id":"jFBoEIY_Zy","type":"alert","data":{"type":"warning","align":"left","message":"<a href=\\"http://www.google.com\\">warn</a>"}},{"id":"KudbqBHmWH","type":"alert","data":{"type":"light","align":"left","message":"putih"}},{"id":"xi18bTpRRg","type":"alert","data":{"type":"dark","align":"left","message":"<b>item</b>"}},{&#34;id&#34;:&#34;YMSldHrCF-&#34;,&#34;type&#34;:&#34;embed&#34;,&#34;data&#34;:{&#34;service&#34;:&#34;youtube&#34;,&#34;source&#34;:&#34;https://www.youtube.com/watch?v=Qe9BEZmSPDA&#34;,&#34;embed&#34;:&#34;https://www.youtube.com/embed/Qe9BEZmSPDA&#34;,&#34;width&#34;:580,&#34;height&#34;:320,&#34;caption&#34;:&#34;you and i&#34;}}],"version":"2.31.0-rc.7"}',
			excerpt:
				'Stop wasting time and start coding more efficiently with these productivity hacks.',
			statusId: articleStatuses.find((s) => s.slug === 'published').id,
			langId: languages.find((l) => l.slug === 'en').id,
			publishedAt: new Date(),
			categoryId: categories.find((c) => c.slug === 'lifestyle').id,
			tagIds: [tags.find((t) => t.slug === 'productivity').id]
		},
		{
			title: 'Getting Started with Node.js',
			slug: 'getting-started-with-nodejs',
			content:
				'A beginner-friendly introduction to Node.js. We will build a simple web server from scratch.',
			excerpt: 'Your first steps into backend development with Node.js.',
			statusId: articleStatuses.find((s) => s.slug === 'draft').id,
			langId: languages.find((l) => l.slug === 'en').id,
			categoryId: categories.find((c) => c.slug === 'programming').id,
			tagIds: [
				tags.find((t) => t.slug === 'nodejs').id,
				tags.find((t) => t.slug === 'javascript').id
			]
		}
	]

	for (const article of articlesData) {
		const { tagIds, ...rest } = article as typeof article & {
			tagIds: string[]
		}
		await prisma.article.upsert({
			where: { slug: article.slug },
			update: {},
			create: {
				...rest,
				authorId: authorId,
				tags: {
					create: tagIds.map((id: string) => ({
						tag: { connect: { id } }
					}))
				}
			}
		})
	}
	console.log('Seeded articles successfully.')
}

const seedUsers = async () => {
	console.log('Seeding additional users...')
	const usersData = [
		{
			name: 'user',
			email: req('SEED_USER_EMAIL'),
			password: req('SEED_USER_PASSWORD'),
			role: 'user',
			username: 'user'
		},
		{
			name: 'admin',
			email: req('SEED_ADMIN_EMAIL'),
			password: req('SEED_ADMIN_PASSWORD'),
			role: 'admin',
			username: 'admin'
		},
		{
			name: 'superAdmin',
			email: req('SEED_SUPERADMIN_EMAIL'),
			password: req('SEED_SUPERADMIN_PASSWORD'),
			role: 'superAdmin',
			username: 'superadmin'
		}
	]

	for (const userData of usersData) {
		try {
			const user = await auth.api.createUser({
				body: {
					name: userData.name,
					email: userData.email,
					password: userData.password,
					role: userData.role as any,
					data: {
						username: userData.username
					}
				}
			})
			console.log('Successfully created user:', user.user.name)
		} catch (error: any) {
			if (error.code === 'P2002') {
				console.log(`User with email ${userData.email} already exists.`)
			} else {
				console.error('Error creating user:', error)
			}
		}
	}
}

async function main() {
	// SENGAJA tanpa cleanDb — prod seed hanya upsert, tidak pernah hapus.
	const kamisama = await seedKamisama()
	await seedUsers()
	const categories = await seedCategories()
	const tags = await seedTags()
	const articleStatuses = await seedArticleStatuses()
	const languages = await seedLanguages()
	await seedArticles(kamisama.id, categories, tags, articleStatuses, languages)

	console.log('\nSeeding finished successfully! 🌱')
}

main()
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
