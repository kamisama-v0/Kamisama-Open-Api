import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../libs/db'
import type { CreateArticleStatusModelType, UpdateArticleStatusModelType } from './model'

interface GetArticleStatusesOptions {
	page?: number
	limit?: number
	search?: string
	sortBy?: 'createdAt' | 'name'
	orderBy?: 'asc' | 'desc'
}

export const findArticleStatuses = async (options: GetArticleStatusesOptions) => {
	const {
		page = 1,
		limit = 10,
		search,
		sortBy = 'name',
		orderBy = 'asc'
	} = options

	const skip = (page - 1) * limit

	const where: Prisma.ArticleStatusWhereInput = {}

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } },
			{ slug: { contains: search, mode: 'insensitive' } }
		]
	}

	const orderByClause: Prisma.ArticleStatusOrderByWithRelationInput = {
		[sortBy]: orderBy
	}

	const [articleStatuses, total] = await prisma.$transaction([
		prisma.articleStatus.findMany({
			where,
			skip,
			take: limit,
			orderBy: orderByClause
		}),
		prisma.articleStatus.count({ where })
	])

	return { articleStatuses, total }
}

export const getArticleStatusById = async (id: string) => {
	return await prisma.articleStatus.findUnique({
		where: {
			id
		}
	})
}

export const getArticleStatusBySlug = async (slug: string) => {
	return await prisma.articleStatus.findUnique({
		where: {
			slug
		}
	})
}

export const createArticleStatus = async (data: CreateArticleStatusModelType) => {
	return await prisma.articleStatus.create({
		data
	})
}

export const updateArticleStatus = async (id: string, data: UpdateArticleStatusModelType) => {
	return await prisma.articleStatus.update({
		where: {
			id
		},
		data
	})
}

export const deleteArticleStatus = async (id: string) => {
	return await prisma.articleStatus.delete({
		where: {
			id
		}
	})
}