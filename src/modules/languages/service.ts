import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../libs/db'
import type { CreateLanguageModelType, UpdateLanguageModelType } from './model'

interface GetLanguagesOptions {
	page?: number
	limit?: number
	search?: string
	sortBy?: 'createdAt' | 'name'
	orderBy?: 'asc' | 'desc'
}

export const findLanguages = async (options: GetLanguagesOptions) => {
	const {
		page = 1,
		limit = 10,
		search,
		sortBy = 'name',
		orderBy = 'asc'
	} = options

	const skip = (page - 1) * limit

	const where: Prisma.LanguageWhereInput = {}

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } },
			{ slug: { contains: search, mode: 'insensitive' } }
		]
	}

	const orderByClause: Prisma.LanguageOrderByWithRelationInput = {
		[sortBy]: orderBy
	}

	const [languages, total] = await prisma.$transaction([
		prisma.language.findMany({
			where,
			skip,
			take: limit,
			orderBy: orderByClause
		}),
		prisma.language.count({ where })
	])

	return { languages, total }
}

export const getLanguageById = async (id: string) => {
	return await prisma.language.findUnique({
		where: {
			id
		}
	})
}

export const getLanguageBySlug = async (slug: string) => {
	return await prisma.language.findUnique({
		where: {
			slug
		}
	})
}

export const createLanguage = async (data: CreateLanguageModelType) => {
	return await prisma.language.create({
		data
	})
}

export const updateLanguage = async (id: string, data: UpdateLanguageModelType) => {
	return await prisma.language.update({
		where: {
			id
		},
		data
	})
}

export const deleteLanguage = async (id: string) => {
	return await prisma.language.delete({
		where: {
			id
		}
	})
}