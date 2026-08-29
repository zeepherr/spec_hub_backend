import { prisma } from "../lib/prisma.js";

export const addCategory = async (name) => {
  return await prisma.category.create({
    data: {
      name: name.trim(),
    },
  });
};

export const findCategoryBy = async (column, value) => {
  return await prisma.category.findUnique({
    where: {
      [column]: value,
    },
  });
};

export const findAllcategories = async (where = {}) => {
  return await prisma.category.findMany({
    where,
    include: {
      _count: {
        select: {
          conditionQuestions: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const setCategory = async (catId, data) => {
  return await prisma.category.update({
    where: { id: catId },
    data,
  });
};
