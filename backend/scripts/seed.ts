import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌱 开始初始化数据库...');

    // 检查是否已存在管理员
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'admin' }
    });

    if (existingAdmin) {
      console.log('✓ 管理员账户已存在');
      console.log(`  用户名: ${existingAdmin.username}`);
      console.log(`  姓名: ${existingAdmin.name}`);
      return;
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 创建管理员
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: '系统管理员',
        role: 'admin',
        status: 'active'
      }
    });

    console.log('✓ 管理员账户创建成功');
    console.log(`  用户名: ${admin.username}`);
    console.log(`  密码: admin123`);
    console.log(`  姓名: ${admin.name}`);
    console.log(`\n⚠️  请尽快修改默认密码！`);

    // 创建示例部门
    const dept1 = await prisma.department.upsert({
      where: { code: 'CNC' },
      update: {},
      create: {
        name: 'CNC加工车间',
        code: 'CNC',
        status: 'active'
      }
    });

    const dept2 = await prisma.department.upsert({
      where: { code: 'ASSEMBLY' },
      update: {},
      create: {
        name: '装配车间',
        code: 'ASSEMBLY',
        status: 'active'
      }
    });

    console.log('✓ 示例部门创建成功');

    // 创建示例工序
    const process1 = await prisma.process.upsert({
      where: { code: 'P001' },
      update: {},
      create: {
        name: 'CNC加工',
        code: 'P001',
        defaultPrice: 5.0,
        unit: 'piece',
        status: 'active'
      }
    });

    const process2 = await prisma.process.upsert({
      where: { code: 'P002' },
      update: {},
      create: {
        name: '装配',
        code: 'P002',
        defaultPrice: 3.0,
        unit: 'piece',
        status: 'active'
      }
    });

    console.log('✓ 示例工序创建成功');

    console.log('\n✅ 数据库初始化完成');
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
