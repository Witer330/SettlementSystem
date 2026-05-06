<template>
  <el-header class="dashboard-header">
    <div class="header-left">
      <el-button
        :icon="isCollapsed ? Expand : Fold"
        class="collapse-btn"
        @click="$emit('toggle-sidebar')"
      />
      <h2 class="page-title">{{ currentPageTitle }}</h2>
    </div>

    <div class="header-right">
      <div class="user-info">
        <span class="text-body">{{ userName }}</span>
        <el-button link type="primary" :icon="Lock" @click="showPasswordDialog = true">
          修改密码
        </el-button>
      </div>
      <el-button type="primary" class="logout-btn" @click="handleLogout"> 退出 </el-button>
    </div>
  </el-header>

  <!-- 修改密码对话框 -->
  <el-dialog
    v-model="showPasswordDialog"
    title="修改密码"
    width="500px"
    :close-on-click-modal="false"
  >
    <el-form
      ref="passwordFormRef"
      :model="passwordForm"
      :rules="passwordRules"
      label-width="100px"
    >
      <el-form-item label="旧密码" prop="oldPassword">
        <el-input
          v-model="passwordForm.oldPassword"
          type="password"
          placeholder="请输入旧密码"
          show-password
        />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="passwordForm.newPassword"
          type="password"
          placeholder="请输入新密码"
          show-password
        />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input
          v-model="passwordForm.confirmPassword"
          type="password"
          placeholder="请再次输入新密码"
          show-password
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showPasswordDialog = false">取消</el-button>
      <el-button type="primary" :loading="passwordLoading" @click="handleChangePassword">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { Fold, Expand, Lock } from '@element-plus/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { authApi, tokenManager } from '../../api/auth'

defineProps<{
  isCollapsed: boolean
}>()

defineEmits<{
  'toggle-sidebar': []
}>()

const router = useRouter()
const route = useRoute()

const userName = computed(() => tokenManager.getUser()?.name || '管理员')

const showPasswordDialog = ref(false)
const passwordFormRef = ref<FormInstance>()
const passwordLoading = ref(false)

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const currentPageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/dashboard': '首页',
    '/dashboard/salary/salary-calculation': '工资计算',
    '/dashboard/salary/daily-records': '计件录入',
    '/dashboard/inventory/suppliers': '供应商管理',
    '/dashboard/inventory/customers': '客户管理',
    '/dashboard/inventory/materials': '物料管理',
    '/dashboard/inventory/purchase-orders': '采购管理',
    '/dashboard/inventory/sales-orders': '销售管理',
    '/dashboard/inventory/inventory-query': '库存查询',
    '/dashboard/basic-info/products': '产品管理',
    '/dashboard/basic-info/specs': '产品规格',
    '/dashboard/system/users': '用户管理',
    '/dashboard/system/job-types': '工种管理',
    '/dashboard/system/employees': '员工管理',
    '/dashboard/system/departments': '部门管理',
    '/dashboard/system/settings': '系统设置'
  }
  return titles[route.path] || '首页'
})

const handleChangePassword = async () => {
  if (!passwordFormRef.value) return

  try {
    await passwordFormRef.value.validate()
    passwordLoading.value = true

    await authApi.changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })

    ElMessage.success('密码修改成功')
    showPasswordDialog.value = false

    Object.assign(passwordForm, {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
  } catch (error: any) {
    if (error !== false) {
      ElMessage.error(error.message || '修改密码失败')
    }
  } finally {
    passwordLoading.value = false
  }
}

const handleLogout = async () => {
  try {
    await authApi.logout()
    tokenManager.clear()
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch (error: any) {
    console.error('登出失败', error)
    tokenManager.clear()
    router.push('/login')
  }
}
</script>

<style scoped>
.dashboard-header {
  height: var(--header-height);
  background-color: var(--color-white);
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.collapse-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-circle);
}

.page-title {
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-450);
  letter-spacing: var(--letter-body);
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background-color: var(--glass-dark);
  border-radius: var(--radius-pill);
}

.logout-btn {
  border-radius: var(--radius-pill);
}
</style>
