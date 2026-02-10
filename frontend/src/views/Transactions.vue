<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { fundApi, holdingApi } from '../api'

const router = useRouter()
const transactions = ref([])
const fundList = ref([])
const loading = ref(false)
const currentFundCode = ref('')
const filterVisible = ref(false)

// 获取基金列表
const fetchFunds = async () => {
  const res = await fundApi.getList()
  if (res.data.success) {
    fundList.value = res.data.data
  }
}

// 获取交易记录
const fetchTransactions = async () => {
  loading.value = true
  const res = currentFundCode.value
    ? await holdingApi.getTransactions(currentFundCode.value)
    : await holdingApi.getAllTransactions()
  if (res.data.success) {
    transactions.value = res.data.data
  }
  loading.value = false
}

// 选择基金
const selectFund = (code) => {
  currentFundCode.value = code
  filterVisible.value = false
  fetchTransactions()
}

// 获取当前基金名称
const getCurrentFundName = () => {
  if (!currentFundCode.value) return '全部基金'
  const fund = fundList.value.find(f => f.code === currentFundCode.value)
  return fund ? `${fund.code} - ${fund.name}` : '全部基金'
}

// 删除交易记录
const deleteTransaction = async (id) => {
  try {
    await showConfirmDialog({
      title: '提示',
      message: '删除后将回滚持仓数据，确定删除吗？'
    })
    const res = await holdingApi.deleteTransaction(id)
    if (res.data.success) {
      showToast('删除成功')
      fetchTransactions()
    }
  } catch {
    // 用户取消
  }
}

// 类型标签
const getTypeTag = (type) => {
  const map = {
    buy: '加仓',
    sell: '减仓',
    bonus: '分红',
    transfer_out: '转出',
    transfer_in: '转入'
  }
  return map[type] || type
}

onMounted(() => {
  fetchFunds()
  fetchTransactions()
})
</script>

<template>
  <div class="transactions-page">
    <!-- 基金筛选 -->
    <div style="padding: 12px">
      <van-field readonly clickable label="筛选基金" :model-value="getCurrentFundName()" @click="filterVisible = true" />
    </div>

    <!-- 筛选弹窗 -->
    <van-action-sheet v-model:show="filterVisible" title="选择基金">
      <van-cell clickable @click="selectFund('')">
        <template #title>
          <span :style="{ color: currentFundCode === '' ? '#1989fa' : '#303133' }">全部基金</span>
        </template>
      </van-cell>
      <van-cell v-for="fund in fundList" :key="fund.code" clickable @click="selectFund(fund.code)">
        <template #title>
          <span :style="{ color: currentFundCode === fund.code ? '#1989fa' : '#303133' }">
            {{ fund.code }} - {{ fund.name }}
          </span>
        </template>
      </van-cell>
    </van-action-sheet>

    <!-- 交易记录列表 -->
    <div style="padding: 12px">
      <van-cell v-for="tx in transactions" :key="tx.id" :border="false">
        <template #title>
          <div class="tx-item">
            <div class="tx-left">
              <van-tag :type="tx.type === 'buy' ? 'danger' : 'success'" size="small">
                {{ getTypeTag(tx.type) }}
              </van-tag>
              <span style="margin-left: 8px">{{ tx.fund_code }}</span>
            </div>
            <div class="tx-info">
              <div class="tx-name">{{ tx.fund_name }}</div>
              <div class="tx-date">{{ tx.op_date }}</div>
            </div>
          </div>
        </template>
        <template #value>
          <div class="tx-right">
            <div>{{ tx.type === 'sell' ? '-' : '' }}¥{{ tx.amount }}</div>
            <div style="font-size: 12px; color: #909399">{{ tx.shares }}份 @ {{ tx.price }}</div>
          </div>
        </template>
        <template #right-icon>
          <van-icon name="delete-o" @click="deleteTransaction(tx.id)" style="color: #f56c6c" />
        </template>
      </van-cell>
      <van-empty v-if="transactions.length === 0" description="暂无交易记录" />
    </div>
  </div>
</template>

<style scoped>
.transactions-page {
  padding-bottom: 12px;
}

.tx-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.tx-left {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.tx-info {
  flex: 1;
}

.tx-name {
  font-size: 14px;
  color: #303133;
}

.tx-date {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.tx-right {
  text-align: right;
}
</style>
