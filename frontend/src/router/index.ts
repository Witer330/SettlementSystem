import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { tokenManager } from '../api/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    children: [
      {
        path: '',
        name: 'DashboardHome',
        component: () => import('@/views/DashboardHome.vue')
      },
      {
        path: 'salary',
        name: 'Salary',
        redirect: '/dashboard/salary/salary-calculation',
        children: [
          {
            path: 'salary-calculation',
            name: 'SalaryCalculation',
            component: () => import('@/views/salary/SalaryCalculation.vue')
          },
          {
            path: 'daily-records',
            name: 'DailyPieceRecord',
            component: () => import('@/views/spec/DailyPieceRecord.vue')
          }
        ]
      },
      {
        path: 'basic-info',
        name: 'BasicInfo',
        redirect: '/dashboard/basic-info/products',
        children: [
          {
            path: 'products',
            name: 'ProductList',
            component: () => import('@/views/salary/ProductList.vue')
          },
          {
            path: 'specs',
            name: 'ProductSpecList',
            component: () => import('@/views/spec/ProductSpecList.vue')
          }
        ]
      },
      {
        path: 'inventory',
        name: 'Inventory',
        redirect: '/dashboard/inventory/suppliers',
        children: [
          {
            path: 'suppliers',
            name: 'SupplierList',
            component: () => import('@/views/inventory/SupplierList.vue')
          },
          {
            path: 'customers',
            name: 'CustomerList',
            component: () => import('@/views/inventory/CustomerList.vue')
          },
          {
            path: 'materials',
            name: 'MaterialList',
            component: () => import('@/views/inventory/MaterialList.vue')
          },
          {
            path: 'purchase-orders',
            name: 'PurchaseOrder',
            component: () => import('@/views/inventory/PurchaseOrder.vue')
          },
          {
            path: 'sales-orders',
            name: 'SalesOrder',
            component: () => import('@/views/inventory/SalesOrder.vue')
          },
          {
            path: 'inventory-query',
            name: 'InventoryQuery',
            component: () => import('@/views/inventory/InventoryQuery.vue')
          }
        ]
      },
      {
        path: 'system',
        name: 'System',
        redirect: '/dashboard/system/users',
        children: [
          {
            path: 'users',
            name: 'UserManagement',
            component: () => import('@/views/system/UserManagement.vue')
          },
          {
            path: 'job-types',
            name: 'JobTypeList',
            component: () => import('@/views/system/JobTypeList.vue')
          },
          {
            path: 'employees',
            name: 'EmployeeList',
            component: () => import('@/views/salary/EmployeeList.vue')
          },
          {
            path: 'departments',
            name: 'DepartmentList',
            component: () => import('@/views/system/DepartmentList.vue')
          },
          {
            path: 'settings',
            name: 'SystemSettings',
            component: () => import('@/views/system/SystemSettings.vue')
          }
        ]
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach((to, _from, next) => {
  const token = tokenManager.getToken()
  const requiresAuth = to.path !== '/login'

  if (requiresAuth && !token) {
    // 需要认证但没有 token，跳转到登录页
    next('/login')
  } else if (to.path === '/login' && token) {
    // 已登录用户访问登录页，跳转到首页
    next('/dashboard')
  } else {
    next()
  }
})

export default router
