import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { prisma } from '../lib/prisma'

export const authService = {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  },

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  },

  generateToken(payload: { userId: number; username: string; role: string }): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    } as any)
  },

  async findUserByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } })
  },

  async findUserById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        status: true,
        createdAt: true
      }
    })
  },

  async findUserByIdFull(id: number) {
    return prisma.user.findUnique({ where: { id } })
  },

  async findExistingAdmin() {
    return prisma.user.findFirst({ where: { role: 'admin' } })
  },

  async findExistingUsername(username: string, excludeId?: number) {
    const where: any = { username }
    if (excludeId) {
      where.NOT = { id: excludeId }
    }
    return prisma.user.findFirst({ where })
  },

  async createUser(data: {
    username: string
    password: string
    name: string
    role: string
    status?: string
  }) {
    const hashedPassword = await this.hashPassword(data.password)
    return prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        name: data.name,
        role: data.role,
        status: data.status || 'active'
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })
  },

  async updateUser(
    id: number,
    data: { username?: string; password?: string; name?: string; role?: string; status?: string }
  ) {
    const updateData: any = {}
    if (data.name) updateData.name = data.name
    if (data.role) updateData.role = data.role
    if (data.status) updateData.status = data.status
    if (data.username) updateData.username = data.username
    if (data.password) {
      updateData.password = await this.hashPassword(data.password)
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })
  },

  async deleteUser(id: number) {
    return prisma.user.delete({ where: { id } })
  },

  async getUsers(query: {
    page?: number
    pageSize?: number
    keyword?: string
    role?: string
    status?: string
  }) {
    const { page = 1, pageSize = 10, keyword, role, status } = query

    const where: any = {}
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { username: { contains: keyword } }
      ]
    }
    if (role) where.role = role
    if (status) where.status = status

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.user.count({ where })
    ])

    return {
      list: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  }
}
