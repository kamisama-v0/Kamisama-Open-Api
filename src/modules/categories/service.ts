import { prisma } from '../../libs/db';
import type { CategoryModelType, UpdateCategoryModelType } from './model';

export const getCategories = async () => {
    return await prisma.category.findMany({
        select: {
            id: true,
            name: true,
            slug: true
        }
    });
};

export const createCategory = async (data: CategoryModelType) => {
    return await prisma.category.create({ data });
};

export const updateCategory = async (id: string, data: UpdateCategoryModelType) => {
    return await prisma.category.update({
        where: { id },
        data
    });
};

export const deleteCategory = async (id: string) => {
    return await prisma.category.delete({
        where: { id }
    });
};