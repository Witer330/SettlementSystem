<template>
  <el-dialog
    :model-value="modelValue"
    title="工资单明细"
    width="900px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-if="bill">
      <el-descriptions :column="2" border class="bill-info">
        <el-descriptions-item label="员工">{{ bill.employee?.name }}</el-descriptions-item>
        <el-descriptions-item label="工号">{{ bill.employee?.code }}</el-descriptions-item>
        <el-descriptions-item label="结算周期">{{ bill.period }}</el-descriptions-item>
        <el-descriptions-item label="总工时">{{ bill.hourlyHours }}小时</el-descriptions-item>
        <el-descriptions-item label="总件数">{{ bill.pieceCount }}件</el-descriptions-item>
        <el-descriptions-item label="时薪金额"><span class="clickable-amount" @click="toggleItemReveal(bill.id, 'hourly')">{{ maskAmount(bill.hourlyAmount, { visible: docReveal.revealed.value || itemRevealed[`${bill.id}-hourly`] }) }}</span></el-descriptions-item>
        <el-descriptions-item label="计件金额"><span class="clickable-amount" @click="toggleItemReveal(bill.id, 'piece')">{{ maskAmount(bill.pieceAmount, { visible: docReveal.revealed.value || itemRevealed[`${bill.id}-piece`] }) }}</span></el-descriptions-item>
        <el-descriptions-item label="其他工资" v-if="(bill.otherAmount ?? 0) > 0">{{ bill.otherCount }}项 / <span class="clickable-amount" @click="toggleItemReveal(bill.id, 'other')">{{ maskAmount(bill.otherAmount ?? 0, { visible: docReveal.revealed.value || itemRevealed[`${bill.id}-other`] }) }}</span></el-descriptions-item>
        <el-descriptions-item label="总金额" :span="2">
          <span class="total-amount clickable-amount" @click="toggleItemReveal(bill.id, 'total')">{{ maskAmount(bill.totalAmount, { visible: docReveal.revealed.value || itemRevealed[`${bill.id}-total`] }) }}</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="bill.status === 'issued'" label="发放时间" :span="2">
          {{ bill.issuedAt ? new Date(bill.issuedAt).toLocaleString('zh-CN') : '-' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="bill.dataHash" label="数据哈希" :span="2">
          <div class="hash-row">
            <span class="hash-value">{{ bill.dataHash }}</span>
            <el-button link type="primary" size="small" :loading="verifying" @click="handleVerify">
              校验完整性
            </el-button>
          </div>
          <el-tag
            v-if="verifyResult !== null"
            :type="verifyResult ? 'success' : 'danger'"
            size="small"
            style="margin-top:4px"
          >
            {{ verifyResult ? '数据完整，未被篡改' : '数据已被篡改！' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <h3 class="detail-title">明细记录</h3>
      <el-table :data="bill.details" stripe max-height="300">
        <el-table-column prop="date" label="日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.date) }}
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.type)" size="small">
              {{ typeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="产品" width="180">
          <template #default="{ row }">
            <span v-if="row.type === 'piece'">
              {{ row.product?.name || '-' }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="100">
          <template #default="{ row }">
            {{ row.quantity }}{{ row.type === 'hourly' ? '小时' : row.type === 'other' ? '项' : '件' }}
          </template>
        </el-table-column>
        <el-table-column prop="unitPrice" label="单价" width="100">
          <template #default="{ row }"> <span class="clickable-amount" @click="toggleItemReveal(row.id, 'unitPrice')">{{ maskAmount(row.unitPrice, { visible: docReveal.revealed.value || itemRevealed[`${row.id}-unitPrice`] }) }}</span> </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="{ row }">
            <span class="amount clickable-amount" @click="toggleItemReveal(row.id, 'amount')">{{ maskAmount(row.amount, { visible: docReveal.revealed.value || itemRevealed[`${row.id}-amount`] }) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" show-overflow-tooltip />
      </el-table>
    </div>
    <template #footer>
      <el-button
        :icon="docReveal.revealed.value ? View : Hide"
        @click="docReveal.toggle()"
      >
        {{ docReveal.revealed.value ? '隐藏金额' : '显示金额' }}
      </el-button>
      <el-button @click="$emit('update:modelValue', false)">关闭</el-button>
      <el-button
        v-if="bill?.status === 'pending'"
        type="primary"
        @click="$emit('approve', bill)"
      >
        审核通过
      </el-button>
      <el-button
        v-if="bill?.status === 'approved'"
        type="warning"
        @click="$emit('revoke', bill)"
      >
        反审
      </el-button>
      <el-button
        v-if="bill?.status === 'approved'"
        type="success"
        @click="$emit('issue', bill)"
      >
        发放
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { View, Hide } from '@element-plus/icons-vue'
import { salaryApi, type SalaryBill } from '../../api/salary'
import { useAmountPrivacy, useReveal } from '@/composables/useAmountPrivacy'

const props = defineProps<{
  modelValue: boolean
  bill: SalaryBill | null
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
  approve: [bill: SalaryBill]
  revoke: [bill: SalaryBill]
  issue: [bill: SalaryBill]
}>()

const { maskAmount } = useAmountPrivacy()
const docReveal = useReveal()

const verifying = ref(false)
const verifyResult = ref<boolean | null>(null)

// 明细级揭示（key = `${detailId}-${field}`）
const itemRevealed = reactive<Record<string, boolean>>({})
const toggleItemReveal = (id: number, field: string) => {
  const key = `${id}-${field}`
  itemRevealed[key] = !itemRevealed[key]
}

const typeLabel = (t: string) => ({ hourly: '时薪', piece: '计件', other: '其他' } as Record<string, string>)[t] || t
const typeTagType = (t: string) => ({ hourly: 'warning', piece: 'success', other: 'primary' } as Record<string, string>)[t] || 'info'

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleVerify = async () => {
  if (!props.bill) return
  try {
    verifying.value = true
    verifyResult.value = null
    const result = await salaryApi.verifySalaryBill(props.bill.id)
    verifyResult.value = result.verified
  } catch (error: any) {
    ElMessage.error(error.message || '校验失败')
  } finally {
    verifying.value = false
  }
}
</script>

<style scoped>
.bill-info {
  margin-bottom: var(--space-4);
}

.detail-title {
  margin-bottom: var(--space-3);
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-450);
}

.amount,
.total-amount {
  font-weight: var(--font-weight-550);
  color: var(--color-success);
}

.total-amount {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-700);
}

.hash-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hash-value {
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 11px;
  color: var(--color-text-secondary);
  word-break: break-all;
}

.clickable-amount {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  transition: background-color 0.15s;
  display: inline-block;
}
.clickable-amount:hover {
  background-color: var(--el-fill-color-light);
}
</style>
