<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { fundApi, holdingApi } from '../api'

const route = useRoute()
const fundCode = route.params.code

const fund = ref(null)
const transactions = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const tradeForm = ref({
  type: 'buy',
  amount: '',
  opDate: '',
  opTime: 'before',
  note: ''
})

// 获取基金详情
const fetchFund = async () => {
  loading.value = true
  const res = await fundApi.getDetail(fundCode)
  if (res.data.success) {
    fund.value = res.data.data
  }
  loading.value = false
}

// 获取交易记录
const fetchTransactions = async () => {
  const res = await holdingApi.getTransactions(fundCode)
  if (res.data.success) {
    transactions.value = res.data.data
  }
}

// 打开交易弹窗
const openTradeDialog = (type) => {
  const now = new Date()
  tradeForm.value = {
    type,
    amount: '',
    opDate: now.toISOString().split('T')[0],
    opTime: now.getHours() < 15 ? 'before' : 'after',
    note: ''
  }
  dialogVisible.value = true
}

// 提交交易
const submitTrade = async () => {
  if (!tradeForm.value.amount) {
    showToast('请输入金额')
    return
  }

  const res = await holdingApi.trade({
    fundCode,
    ...tradeForm.value
  })

  if (res.data.success) {
    showToast(`${tradeForm.value.type === 'buy' ? '加仓' : '减仓'}成功`)
    dialogVisible.value = false
    fetchFund()
    fetchTransactions()
  } else {
    showToast(res.data.message)
  }
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
      fetchFund()
      fetchTransactions()
    }
  } catch (err) {
    // 用户取消或其他错误
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

// 涨跌颜色
const getProfitClass = (val) => {
  const num = parseFloat(val)
  if (num > 0) return 'text-up'
  if (num < 0) return 'text-down'
  return 'text-flat'
}

const formatProfit = (val) => {
  const num = parseFloat(val)
  if (num > 0) return '+' + num.toFixed(2)
  return num.toFixed(2)
}

const formatPercent = (val) => {
  const num = parseFloat(val)
  if (num > 0) return '+' + num.toFixed(2) + '%'
  return num.toFixed(2) + '%'
}

onMounted(() => {
  fetchFund()
  fetchTransactions()
})
</script>

<template>
  <div class="detail-page">
    <!-- 基金信息卡片 -->
    <van-cell-group v-if="fund" inset>
      <van-cell>
        <template #title>
          <div>
            <div class="fund-name">{{ fund.name }}</div>
            <div class="fund-code">{{ fund.code }}</div>
          </div>
        </template>
        <template #value>
          <div class="fund-estimate">
            <div class="estimate-value">{{ fund.estimate }}</div>
            <div :class="getProfitClass(fund.estimateGrowth)">
              {{ formatPercent(fund.estimateGrowth) }}
            </div>
          </div>
        </template>
      </van-cell>
    </van-cell-group>

    <!-- 持仓信息 -->
    <div v-if="fund" class="holding-info-card">
      <div class="info-row">
        <div class="info-label">持有份额</div>
        <div class="info-value">{{ (fund.shares ? parseFloat(fund.shares).toFixed(2) : '0.00') }} 份</div>
      </div>
      <div class="info-row">
        <div class="info-label">持仓市值</div>
        <div class="info-value">¥{{ fund.currentValue || '0.00' }}</div>
      </div>
      <div class="info-row">
        <div class="info-label">持仓成本</div>
        <div class="info-value">¥{{ (fund.cost ? parseFloat(fund.cost).toFixed(2) : '0.00') }}</div>
      </div>
      <div class="info-row">
        <div class="info-label">成本价</div>
        <div class="info-value">¥{{ fund.avgCost || '0.0000' }}</div>
      </div>
      <div class="info-row">
        <div class="info-label">今日收益</div>
        <div class="info-value" :class="getProfitClass(fund.todayProfit)">
          {{ formatProfit(fund.todayProfit) }} 元
        </div>
      </div>
      <div class="info-row">
        <div class="info-label">持有收益</div>
        <div class="info-value" :class="getProfitClass(fund.profit)">
          {{ formatProfit(fund.profit) }} 元
        </div>
      </div>
      <div class="info-row">
        <div class="info-label">收益率</div>
        <div class="info-value" :class="getProfitClass(fund.profitRate)">
          {{ formatPercent(fund.profitRate) }}
        </div>
      </div>
    </div>

    <!-- 前10重仓股 -->
    <div v-if="fund && fund.holdings && Array.isArray(fund.holdings) && fund.holdings.length > 0" style="padding: 12px">
      <div style="font-size: 14px; font-weight: 500; margin-bottom: 12px">前10重仓股</div>
      <van-cell-group inset>
        <van-cell v-for="holding in fund.holdings" :key="holding.stock_code" :border="false">
          <template #title>
            <div style="font-size: 13px">
              <div style="color: #303133; font-weight: 500">{{ holding.stock_name }}</div>
              <div style="color: #909399; margin-top: 2px">{{ holding.stock_code }}</div>
            </div>
          </template>
          <template #value>
            <div style="font-size: 13px; font-weight: 600; color: #f56c6c">
              {{ parseFloat(holding.holding_ratio) > 0 ? '+' : '' }}{{ parseFloat(holding.holding_ratio).toFixed(2) }}%
            </div>
          </template>
        </van-cell>
      </van-cell-group>
    </div>

    <!-- 操作按钮 -->
    <div style="padding: 12px; display: flex; gap: 12px">
      <van-button round block type="danger" @click="openTradeDialog('buy')">加仓</van-button>
      <van-button round block type="success" @click="openTradeDialog('sell')">减仓</van-button>
    </div>

    <!-- 交易记录 -->
    <div style="padding: 12px">
      <div style="font-size: 14px; font-weight: 500; margin-bottom: 12px">交易记录</div>
      <van-cell v-for="tx in transactions" :key="tx.id" :border="false">
        <template #title>
          <div class="tx-item">
            <div>
              <van-tag :type="tx.type === 'buy' ? 'danger' : 'success'" size="small">
                {{ getTypeTag(tx.type) }}
              </van-tag>
              <span style="margin-left: 8px; font-size: 12px; color: #909399">{{ tx.op_date }}</span>
            </div>
            <div style="margin-top: 4px; font-size: 12px; color: #606266">
              {{ tx.type === 'sell' ? '-' : '' }}¥{{ tx.amount }} / {{ tx.shares }}份
            </div>
          </div>
        </template>
        <template #right-icon>
          <van-icon name="delete-o" @click="deleteTransaction(tx.id)" style="color: #f56c6c" />
        </template>
      </van-cell>
      <van-empty v-if="transactions.length === 0" description="暂无交易记录" />
    </div>

    <!-- 交易弹窗 -->
    <van-dialog
      v-model:show="dialogVisible"
      :title="tradeForm.type === 'buy' ? '加仓' : '减仓'"
      show-cancel-button
      @confirm="submitTrade"
    >
      <div class="trade-info" v-if="fund">
        <div class="trade-name">{{ fund.name }}</div>
        <div class="trade-price">最新净值 {{ fund.netWorth }}</div>
      </div>
      <van-field
        v-model.number="tradeForm.amount"
        label="金额（元）"
        type="number"
        placeholder="请输入金额"
      />
      <van-field
        v-model="tradeForm.opDate"
        label="操作日期"
        type="date"
        placeholder="选择日期"
      />
      <van-field label="操作时间">
        <template #input>
          <van-radio-group v-model="tradeForm.opTime" direction="horizontal">
            <van-radio name="before">15:00 前</van-radio>
            <van-radio name="after">15:00 后</van-radio>
          </van-radio-group>
        </template>
      </van-field>
      <van-field
        v-model="tradeForm.note"
        label="备注"
        placeholder="可选"
      />
    </van-dialog>
  </div>
</template>

<style scoped>
.detail-page {
  padding-bottom: 12px;
}

.fund-name {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.fund-code {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.fund-estimate {
  text-align: right;
}

.estimate-value {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.holding-info-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.info-value {
  font-size: 14px;
  color: #303133;
  font-weight: 600;
  text-align: right;
}

.holding-card {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}

.holding-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.holding-code {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.holding-ratio {
  font-size: 14px;
  font-weight: 600;
}

.tx-item {
  width: 100%;
}

.trade-info {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.trade-name {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
}

.trade-price {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.text-up {
  color: #f56c6c;
}

.text-down {
  color: #67c23a;
}

.text-flat {
  color: #909399;
}
</style>
