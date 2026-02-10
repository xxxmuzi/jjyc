<script setup>
import { ref, onMounted, onActivated, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fundApi, holdingApi } from '../api'

const router = useRouter()
const fundList = ref([])
const loading = ref(false)
const sortType = ref('default')
const groupMap = ref({})
const detailDialogVisible = ref(false)
const fundDetail = ref(null)
const tradeDialogVisible = ref(false)
const editHoldingDialogVisible = ref(false)
const tradeType = ref('buy')
const tradeShares = ref('')
const tradeInputType = ref('amount') // shares 或 amount
const editCost = ref('')

// 从 localStorage 读取分组
const loadGroups = () => {
  try {
    const saved = localStorage.getItem('fundGroups')
    if (saved) {
      groupMap.value = JSON.parse(saved)
    }
  } catch (e) {
    console.warn('读取分组失败:', e)
  }
}

// 保存分组到 localStorage
const saveGroups = () => {
  try {
    localStorage.setItem('fundGroups', JSON.stringify(groupMap.value))
  } catch (e) {
    console.warn('保存分组失败:', e)
  }
}

// 获取基金列表
const fetchData = async () => {
  loading.value = true
  const res = await fundApi.getList()
  if (res.data.success) {
    fundList.value = res.data.data
    console.log('首页获取到的基金列表:', fundList.value)
    console.log('有持仓的基金数量:', fundList.value.filter(f => parseFloat(f.shares || 0) > 0).length)
  }
  loading.value = false
}

const handleRefresh = async () => {
  showToast('刷新中...')
  await fetchData()
  showToast('刷新完成')
}

// 持仓基金（只显示有持仓的）
const holdingFunds = computed(() => {
  return fundList.value.filter((f) => parseFloat(f.shares || 0) > 0)
})

// 排序后的基金列表
const sortedFunds = computed(() => {
  const funds = [...holdingFunds.value]

  switch (sortType.value) {
    case 'profitRate':
      // 收益率排序（从高到低）
      return funds.sort((a, b) => parseFloat(b.profitRate || 0) - parseFloat(a.profitRate || 0))
    case 'profit':
      // 收益排序（从高到低）
      return funds.sort((a, b) => parseFloat(b.profit || 0) - parseFloat(a.profit || 0))
    case 'growth':
      // 涨跌排序（从高到低）
      return funds.sort((a, b) => parseFloat(b.estimateGrowth || 0) - parseFloat(a.estimateGrowth || 0))
    case 'value':
      // 持有金额排序（从高到低）
      return funds.sort((a, b) => parseFloat(b.currentValue || 0) - parseFloat(a.currentValue || 0))
    default:
      // 默认排序（按添加时间）
      return funds
  }
})

// 排序操作
const moveUp = async (index) => {
  if (index === 0) return
  
  const newList = [...sortedFunds.value]
  const temp = newList[index]
  newList[index] = newList[index - 1]
  newList[index - 1] = temp

  const orders = newList.map((fund, idx) => ({
    code: fund.code,
    sortOrder: idx
  }))

  const res = await fundApi.updateSort(orders)
  if (res.data.success) {
    await fetchData()
  }
}

const moveDown = async (index) => {
  if (index === sortedFunds.value.length - 1) return
  
  const newList = [...sortedFunds.value]
  const temp = newList[index]
  newList[index] = newList[index + 1]
  newList[index + 1] = temp

  const orders = newList.map((fund, idx) => ({
    code: fund.code,
    sortOrder: idx
  }))

  const res = await fundApi.updateSort(orders)
  if (res.data.success) {
    await fetchData()
  }
}

const moveToTop = async (index) => {
  if (index === 0) return
  
  const newList = [...sortedFunds.value]
  const [removed] = newList.splice(index, 1)
  newList.unshift(removed)

  const orders = newList.map((fund, idx) => ({
    code: fund.code,
    sortOrder: idx
  }))

  const res = await fundApi.updateSort(orders)
  if (res.data.success) {
    showToast('已置顶')
    await fetchData()
  }
}

// 收益统计
const totalStats = computed(() => {
  let todayProfit = 0
  let totalProfit = 0
  let totalValue = 0
  let upCount = 0
  let downCount = 0

  holdingFunds.value.forEach((f) => {
    todayProfit += parseFloat(f.todayProfit || 0)
    totalProfit += parseFloat(f.profit || 0)
    totalValue += parseFloat(f.currentValue || 0)

    const growth = parseFloat(f.estimateGrowth || 0)
    if (growth > 0) upCount++
    else if (growth < 0) downCount++
  })

  return {
    todayProfit: todayProfit.toFixed(2),
    totalProfit: totalProfit.toFixed(2),
    totalValue: totalValue.toFixed(2),
    upCount,
    downCount
  }
})

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

// 打开基金详情
const openFundDetail = async (code) => {
  const res = await fundApi.getDetail(code)
  if (res.data.success) {
    fundDetail.value = res.data.data
    detailDialogVisible.value = true
  }
}

// 打开交易弹窗
const openTradeDialog = (type) => {
  tradeType.value = type
  tradeShares.value = ''
  tradeInputType.value = 'amount'
  tradeDialogVisible.value = true
}

// 打开编辑持仓弹窗
const openEditHolding = () => {
  editCost.value = fundDetail.value.cost
  editHoldingDialogVisible.value = true
}

// 计算交易金额或份额
const tradeAmount = computed(() => {
  if (!tradeShares.value || !fundDetail.value) return '0.00'
  const input = parseFloat(tradeShares.value)
  const netWorth = parseFloat(fundDetail.value.estimate || fundDetail.value.netWorth)
  
  if (tradeInputType.value === 'shares') {
    // 输入份额，计算金额
    return (input * netWorth).toFixed(2)
  } else {
    // 输入金额，计算份额
    return (input / netWorth).toFixed(4)
  }
})

// 执行交易
const executeTrade = async () => {
  if (!tradeShares.value || parseFloat(tradeShares.value) <= 0) {
    showToast(tradeInputType.value === 'shares' ? '请输入有效份额' : '请输入有效金额')
    return
  }

  const input = parseFloat(tradeShares.value)
  const netWorth = parseFloat(fundDetail.value.estimate || fundDetail.value.netWorth)
  
  let shares, amount
  if (tradeInputType.value === 'shares') {
    shares = input
    amount = input * netWorth
  } else {
    amount = input
    shares = input / netWorth
  }

  const res = await holdingApi.trade({
    fundCode: fundDetail.value.code,
    type: tradeType.value === 'buy' ? 'buy' : 'sell',
    shares: shares.toFixed(4),
    price: netWorth,
    amount: amount.toFixed(2)
  })

  if (res.data.success) {
    showToast(tradeType.value === 'buy' ? '加仓成功' : '减仓成功')
    tradeDialogVisible.value = false
    detailDialogVisible.value = false
    await fetchData()
  }
}

// 保存编辑持仓
const saveEditHolding = async () => {
  if (!editCost.value || parseFloat(editCost.value) < 0) {
    showToast('请输入有效金额')
    return
  }

  const cost = parseFloat(editCost.value)
  const netWorth = parseFloat(fundDetail.value.estimate || fundDetail.value.netWorth)
  const shares = cost > 0 ? (cost / netWorth).toFixed(4) : 0

  const res = await holdingApi.updateHolding({
    fundCode: fundDetail.value.code,
    shares,
    cost: cost.toFixed(2)
  })

  if (res.data.success) {
    showToast('保存成功')
    editHoldingDialogVisible.value = false
    detailDialogVisible.value = false
    await fetchData()
  }
}

onMounted(() => {
  loadGroups()
  fetchData()
})

// 页面激活时刷新数据(从其他页面返回时)
onActivated(() => {
  fetchData()
})
</script>

<template>
  <div class="home-page">
    <!-- 资产总览卡片 -->
    <div class="asset-card">
      <div class="asset-header">
        <div style="display: flex; justify-content: space-between; align-items: flex-start">
          <div>
            <div class="asset-label">总资产（元）<div class="asset-value">{{ totalStats.totalValue }}</div></div>
          </div>
          <button
            @click="handleRefresh"
            style="background: none; border: none; cursor: pointer; font-size: 30px; padding: 0"
            title="刷新"
          >
            ↻
          </button>
        </div>
        
      </div>

      <div class="asset-footer">
        <div class="asset-item">
          <div class="item-label">当日收益</div>
          <div class="item-value" :class="getProfitClass(totalStats.todayProfit)">
            {{ formatProfit(totalStats.todayProfit) }}
          </div>
        </div>
        <div class="asset-item">
          <div class="item-label">涨跌</div>
          <div class="item-value">
            <span class="text-up">{{ totalStats.upCount }}↑</span>
            <span class="text-down">{{ totalStats.downCount }}↓</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 排序按钮 -->
    <div class="sort-buttons">
      <button
        v-for="sort in [
          { value: 'default', label: '默认' },
          { value: 'value', label: '持有金额' },
          { value: 'profitRate', label: '收益率' },
          { value: 'profit', label: '收益' },
          { value: 'growth', label: '涨跌' },
        ]"
        :key="sort.value"
        :class="['sort-btn', { active: sortType === sort.value }]"
        @click="sortType = sort.value"
      >
        {{ sort.label }}
      </button>
    </div>

    <!-- 持仓基金列表 -->
    <div v-if="sortedFunds.length > 0" class="funds-section">
      <div class="section-title">持仓基金</div>
      <div class="funds-list">
        <div
          v-for="(fund, index) in sortedFunds"
          :key="fund.code"
          class="fund-item-wrapper"
        >
          <div class="fund-item" @click="openFundDetail(fund.code)">
            <div v-if="sortType === 'default'" class="sort-actions" @click.stop>
              <van-icon
                name="upgrade"
                size="16"
                :color="index === 0 ? '#ddd' : '#ff9800'"
                @click="moveToTop(index)"
              />
              <van-icon
                name="arrow-up"
                size="16"
                :color="index === 0 ? '#ddd' : '#1989fa'"
                @click="moveUp(index)"
              />
              <van-icon
                name="arrow-down"
                size="16"
                :color="index === sortedFunds.length - 1 ? '#ddd' : '#1989fa'"
                @click="moveDown(index)"
              />
            </div>
            
            <div class="fund-left">
              <div class="fund-name">{{ fund.name }}</div>
              <div class="fund-code">{{ fund.code }} {{ fund.estimateTime }}</div>
            </div>

            <div class="fund-middle">
              <div class="fund-value">¥{{ fund.currentValue }}</div>
            </div>

            <div class="fund-right">
              <div class="fund-growth" :class="getProfitClass(fund.estimateGrowth)">
                {{ formatPercent(fund.estimateGrowth) }}
              </div>
              <div class="fund-today" :class="getProfitClass(fund.todayProfit)">
                {{ formatProfit(fund.todayProfit) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <van-empty v-else description="暂无持仓基金" />

    <!-- 基金详情弹窗 -->
    <van-popup
      v-model:show="detailDialogVisible"
      position="bottom"
      :style="{ height: '85%', borderRadius: '16px 16px 0 0' }"
    >
      <div v-if="fundDetail" class="detail-popup">
        <div class="detail-header">
          <div class="detail-fund-name">{{ fundDetail.name }}</div>
          <van-icon name="cross" size="20" @click="detailDialogVisible = false" />
        </div>

        <div class="detail-content">
          <div class="detail-card">
            <div class="detail-row">
              <span class="detail-label">基金代码</span>
              <span class="detail-value">{{ fundDetail.code }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">当前净值</span>
              <span class="detail-value">{{ fundDetail.netWorth }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">估算净值</span>
              <span class="detail-value" :class="getProfitClass(fundDetail.estimateGrowth)">
                {{ fundDetail.estimate }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">估算涨幅</span>
              <span class="detail-value" :class="getProfitClass(fundDetail.estimateGrowth)">
                {{ formatPercent(fundDetail.estimateGrowth) }}
              </span>
            </div>
          </div>

          <div class="detail-card">
            <div class="detail-section-title">持仓信息</div>
            <div class="detail-row">
              <span class="detail-label">持有份额</span>
              <span class="detail-value">{{ fundDetail.shares }} 份</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">持仓成本</span>
              <span class="detail-value">¥{{ fundDetail.cost }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">今日收益</span>
              <span class="detail-value" :class="getProfitClass(fundDetail.todayProfit)">
                ¥{{ fundDetail.todayProfit }}
              </span>
            </div>
          </div>

          <div v-if="fundDetail.holdings && fundDetail.holdings.length > 0" class="detail-card">
            <div class="holdings-header">
              <div class="holdings-title">
                <span class="title-icon">📊</span>
                <span>基金重仓股</span>
              </div>
            </div>
            <div class="holdings-table">
              <div class="holdings-table-header">
                <div class="col-name">股票名称</div>
                <div class="col-ratio">持仓占比</div>
              </div>
              <div class="holdings-table-body">
                <div
                  v-for="(stock, index) in fundDetail.holdings"
                  :key="stock.stock_code"
                  class="holdings-row"
                >
                  <div class="col-name">
                    <div class="stock-name">{{ stock.stock_name }}</div>
                    <div class="stock-code">{{ stock.stock_code }}</div>
                  </div>
                  <div class="col-ratio">
                    <span class="ratio-value">{{ stock.holding_ratio }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-actions">
          <van-button round type="default" size="large" @click="openEditHolding">
            编辑持仓
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 交易弹窗 -->
    <van-dialog
      v-model:show="tradeDialogVisible"
      :title="tradeType === 'buy' ? '加仓' : '减仓'"
      show-cancel-button
      @confirm="executeTrade"
    >
      <div style="padding: 16px">
        <div style="display: flex; gap: 8px; margin-bottom: 12px">
          <van-button
            size="small"
            :type="tradeInputType === 'amount' ? 'primary' : 'default'"
            @click="tradeInputType = 'amount'; tradeShares = ''"
          >
            按金额
          </van-button>
          <van-button
            size="small"
            :type="tradeInputType === 'shares' ? 'primary' : 'default'"
            @click="tradeInputType = 'shares'; tradeShares = ''"
          >
            按份额
          </van-button>
        </div>
        <van-field
          v-model="tradeShares"
          :label="tradeInputType === 'shares' ? '份额' : '金额'"
          type="number"
          :placeholder="tradeInputType === 'shares' ? '请输入份额' : '请输入金额'"
        />
        <div style="margin-top: 12px; padding: 12px; background: #f5f7fa; border-radius: 8px">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px">
            <span style="color: #606266; font-size: 14px">当前净值</span>
            <span style="color: #303133; font-size: 14px; font-weight: 500">
              {{ fundDetail?.estimate || fundDetail?.netWorth }}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between">
            <span style="color: #606266; font-size: 14px">
              {{ tradeInputType === 'shares' ? '交易金额' : '交易份额' }}
            </span>
            <span style="color: #1989fa; font-size: 16px; font-weight: 600">
              {{ tradeInputType === 'shares' ? '¥' + tradeAmount : tradeAmount + ' 份' }}
            </span>
          </div>
        </div>
      </div>
    </van-dialog>

    <!-- 编辑持仓弹窗 -->
    <van-dialog
      v-model:show="editHoldingDialogVisible"
      title="编辑持仓"
      show-cancel-button
      @confirm="saveEditHolding"
    >
      <div style="padding: 16px">
        <van-field
          v-model="editCost"
          label="持仓金额"
          type="number"
          placeholder="请输入持仓总金额"
        />
        <div style="margin-top: 12px; padding: 12px; background: #f5f7fa; border-radius: 8px">
          <div style="display: flex; justify-content: space-between">
            <span style="color: #606266; font-size: 14px">计算份额</span>
            <span style="color: #1989fa; font-size: 14px; font-weight: 500">
              {{ editCost && fundDetail ? (parseFloat(editCost) / parseFloat(fundDetail.estimate || fundDetail.netWorth)).toFixed(4) : '0.0000' }} 份
            </span>
          </div>
        </div>
      </div>
    </van-dialog>
  </div>
</template>

<style scoped>
.home-page {
  padding: 12px;
  padding-bottom: 20px;
}

.asset-card {
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.asset-header {
  margin-bottom: 16px;
}

.asset-label {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.asset-value {
  font-size: 20px;
  font-weight: 600;
}

.asset-footer {
  display: flex;
  justify-content: space-around;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.asset-item {
  text-align: center;
}

.item-label {
  opacity: 0.8;
  margin-bottom: 4px;
}

.item-value {
  font-weight: 600;
}

.sort-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
}

.sort-btn {
  padding: 6px 14px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 16px;
  font-size: 12px;
  color: #606266;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
  flex-shrink: 0;
}

.sort-btn.active {
  background: #1989fa;
  color: white;
  border-color: #1989fa;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.funds-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fund-item-wrapper {
  position: relative;
}

.fund-item {
  background: white;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 0.2s;
}

.fund-item:active {
  transform: scale(0.98);
}

.sort-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-right: 12px;
  flex-shrink: 0;
}

.fund-left {
  flex: 1;
}

.fund-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.fund-code {
  font-size: 12px;
  color: #909399;
}

.fund-middle {
  text-align: right;
  margin: 0 12px;
}

.fund-value {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
  margin-bottom: 4px;
}

.fund-profit {
  font-size: 12px;
}

.fund-right {
  text-align: right;
  min-width: 50px;
}

.fund-growth {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.fund-today {
  font-size: 12px;
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

.detail-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.detail-fund-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
}

.detail-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.detail-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}

.detail-label {
  font-size: 14px;
  color: #606266;
}

.detail-value {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.detail-actions {
  display: flex;
  gap: 12px;
  padding-top: 16px;
}

.detail-actions .van-button {
  flex: 1;
}

.holdings-header {
  margin-bottom: 16px;
}

.holdings-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.title-icon {
  font-size: 18px;
}

.holdings-table {
  background: white;
}

.holdings-table-header {
  display: flex;
  padding: 12px 0;
  border-bottom: 2px solid #f0f0f0;
  font-size: 13px;
  color: #909399;
  font-weight: 500;
}

.holdings-table-body {
  display: flex;
  flex-direction: column;
}

.holdings-row {
  display: flex;
  padding: 14px 0;
  border-bottom: 1px solid #f5f7fa;
  transition: background 0.2s;
}

.holdings-row:last-child {
  border-bottom: none;
}

.holdings-row:active {
  background: #f5f7fa;
}

.col-name {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.col-ratio {
  width: 80px;
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.stock-name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.stock-code {
  font-size: 12px;
  color: #909399;
}

.ratio-value {
  font-size: 15px;
  font-weight: 600;
  color: #1989fa;
}
</style>
