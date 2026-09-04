import { prisma } from '../../libs/db';
import type { TagModelType, UpdateTagModelType } from './model';

export const getTags = async () => {
    return await prisma.tag.findMany({
        select: {
            id: true,
            name: true,
            slug: true
        }
    });
};

export const createTag = async (data: TagModelType) => {
    return await prisma.tag.create({ data });
};

export const updateTag = async (id: string, data: UpdateTagModelType) => {
    return await prisma.tag.update({
        where: { id },
        data
    });
};

export const deleteTag = async (id: string) => {
    return await prisma.tag.delete({
        where: { id }
    });
};