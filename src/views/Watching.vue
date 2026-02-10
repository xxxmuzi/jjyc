<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { fundApi, holdingApi } from '../api'

const router = useRouter()
const fundList = ref([])
const loading = ref(false)
const addDialogVisible = ref(false)
const editDialogVisible = ref(false)
const groupDialogVisible = ref(false)
const editGroupDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const newFundCode = ref('')
const newFundAmount = ref('')
const newGroupName = ref('')
const editGroupName = ref('')
const editGroupOldName = ref('')
const editForm = ref({ fundCode: '', fundName: '', netWorth: 0, cost: 0 })
const fundDetail = ref(null)
const selectedGroup = ref('全部')
const groups = ref(['默认分组'])
const activeEditGroup = ref(null)
const activeFundCode = ref(null)
const sortType = ref('default')
const updateTime = ref('') // 估值时间

// 获取基金列表
const fetchData = async (groupName) => {
  loading.value = true
  const res = await fundApi.getList(groupName)
  if (res.data.success) {
    fundList.value = res.data.data
    // 获取估值时间(取第一个基金的估值时间)
    if (res.data.data.length > 0) {
      const firstFund = res.data.data[0]
      if (firstFund.estimateTime) {
        updateTime.value = firstFund.estimateTime
      } else if (firstFund.netWorthDate) {
        updateTime.value = firstFund.netWorthDate
      }
    }
    updateGroups()
  }
  loading.value = false
}

// 刷新数据
const handleRefresh = async () => {
  showToast('刷新中...')
  await fetchData(selectedGroup.value === '全部' ? undefined : selectedGroup.value)
  showToast('刷新完成')
}

// 监听分组变化，重新获取数据
watch(selectedGroup, (newGroup) => {
  fetchData(newGroup === '全部' ? undefined : newGroup)
})

// 排序后的基金列表
const sortedFundList = computed(() => {
  const list = [...fundList.value]
  
  switch (sortType.value) {
    case 'profitRate':
      // 按收益率排序（降序）
      return list.sort((a, b) => parseFloat(b.profitRate || 0) - parseFloat(a.profitRate || 0))
    case 'profit':
      // 按收益排序（降序）
      return list.sort((a, b) => parseFloat(b.profit || 0) - parseFloat(a.profit || 0))
    case 'growth':
      // 按涨幅排序（降序）
      return list.sort((a, b) => parseFloat(b.estimateGrowth || 0) - parseFloat(a.estimateGrowth || 0))
    default:
      // 默认排序
      return list
  }
})

// 更新分组列表
const updateGroups = async () => {
  const groupSet = new Set(['默认分组'])
  fundList.value.forEach((f) => {
    if (f.group_name) groupSet.add(f.group_name)
  })
  
  // 从后端获取用户的所有分组
  const res = await fundApi.getUserGroups()
  if (res.data.success) {
    res.data.data.forEach((g) => {
      if (g !== '全部') groupSet.add(g)
    })
  }
  
  groups.value = Array.from(groupSet)
}
const addFund = async () => {
  if (!newFundCode.value.trim()) {
    showToast('请输入基金代码')
    return
  }

  // 确定要添加到的分组
  const targetGroup = selectedGroup.value === '全部' ? '默认分组' : selectedGroup.value

  // 获取金额(可选)
  const amount = newFundAmount.value ? parseFloat(newFundAmount.value) : undefined

  const res = await fundApi.add(newFundCode.value.trim(), targetGroup, amount)
  if (res.data.success) {
    showToast(`添加成功：${res.data.data.name}`)
    addDialogVisible.value = false
    newFundCode.value = ''
    newFundAmount.value = ''
    // 如果当前在"全部"分组,刷新全部数据;否则保持当前分组
    fetchData(selectedGroup.value === '全部' ? undefined : selectedGroup.value)
  } else {
    showToast(res.data.message)
  }
}

// 添加分组
const addGroup = async () => {
  if (!newGroupName.value.trim()) {
    showToast('请输入分组名称')
    return
  }

  if (groups.value.includes(newGroupName.value)) {
    showToast('分组已存在')
    return
  }

  // 调用后端接口创建分组
  const res = await fundApi.createGroup(newGroupName.value.trim())
  if (res.data.success) {
    groups.value.push(newGroupName.value.trim())
    showToast('分组添加成功')
    groupDialogVisible.value = false
    newGroupName.value = ''
  } else {
    showToast(res.data.message || '分组添加失败')
  }
}

// 打开编辑分组弹窗
const openEditGroupDialog = (groupName) => {
  editGroupOldName.value = groupName
  editGroupName.value = groupName
  editGroupDialogVisible.value = true
}

// 保存修改分组
const saveEditGroup = async () => {
  if (!editGroupName.value.trim()) {
    showToast('分组名称不能为空')
    return
  }

  if (editGroupName.value === editGroupOldName.value) {
    editGroupDialogVisible.value = false
    return
  }

  if (groups.value.includes(editGroupName.value)) {
    showToast('分组名称已存在')
    return
  }

  const res = await fundApi.updateGroupName(editGroupOldName.value, editGroupName.value.trim())
  if (res.data.success) {
    showToast('分组修改成功')
    editGroupDialogVisible.value = false
    // 更新分组列表
    const index = groups.value.indexOf(editGroupOldName.value)
    if (index > -1) {
      groups.value[index] = editGroupName.value.trim()
    }
    // 如果当前选中的分组被修改了，更新选中分组
    if (selectedGroup.value === editGroupOldName.value) {
      selectedGroup.value = editGroupName.value.trim()
    }
  } else {
    showToast(res.data.message || '修改分组失败')
  }
}

// 删除分组
const deleteGroup = async (groupName) => {
  try {
    await showConfirmDialog({
      title: '提示',
      message: `确定删除分组「${groupName}」吗？该分组下的基金将不再绑定分组`
    })
    const res = await fundApi.deleteGroup(groupName)
    if (res.data.success) {
      showToast('分组删除成功')
      // 从分组列表中移除
      const index = groups.value.indexOf(groupName)
      if (index > -1) {
        groups.value.splice(index, 1)
      }
      // 如果删除的是当前选中的分组，切换到全部
      if (selectedGroup.value === groupName) {
        selectedGroup.value = '全部'
      }
    }
  } catch {
    // 用户取消
  }
}

// 切换分组编辑状态
const toggleGroupEdit = (group) => {
  if (group === '全部') return
  activeEditGroup.value = activeEditGroup.value === group ? null : group
}

// 切换基金操作显示
const toggleFundActions = (code) => {
  activeFundCode.value = activeFundCode.value === code ? null : code
}

// 打开基金详情
const openFundDetail = async (code) => {
  const res = await fundApi.getDetail(code)
  if (res.data.success) {
    fundDetail.value = res.data.data
    detailDialogVisible.value = true
  }
}

// 长按分组标签
const handleGroupMouseDown = (group, event) => {
  if (group === '全部') return
  
  longPressTimer.value = setTimeout(() => {
    longPressGroup.value = group
    showGroupMenu.value = true
    menuPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  }, 500)
}

// 鼠标抬起时取消长按
const handleGroupMouseUp = () => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

// 编辑分组（从菜单）
const editGroupFromMenu = () => {
  if (longPressGroup.value) {
    openEditGroupDialog(longPressGroup.value)
  }
  showGroupMenu.value = false
}

// 删除分组（从菜单）
const deleteGroupFromMenu = () => {
  if (longPressGroup.value) {
    deleteGroup(longPressGroup.value)
  }
  showGroupMenu.value = false
}

// 关闭菜单
const closeGroupMenu = () => {
  showGroupMenu.value = false
}
const openEditDialog = (fund) => {
  editForm.value = {
    fundCode: fund.code,
    fundName: fund.name,
    netWorth: parseFloat(fund.netWorth),
    cost: parseFloat(fund.cost) || 0
  }
  editDialogVisible.value = true
}

// 保存持仓
const saveHolding = async () => {
  const cost = parseFloat(editForm.value.cost)
  const netWorth = parseFloat(editForm.value.netWorth)
  const shares = cost > 0 ? (cost / netWorth).toFixed(4) : 0

  const res = await holdingApi.updateHolding({
    fundCode: editForm.value.fundCode,
    shares,
    cost
  })

  if (res.data.success) {
    showToast('保存成功')
    editDialogVisible.value = false
    fetchData(selectedGroup.value === '全部' ? undefined : selectedGroup.value)
  }
}

// 删除基金
const removeFund = async (code, name) => {
  try {
    await showConfirmDialog({
      title: '提示',
      message: `确定删除「${name}」吗？`
    })
    const res = await fundApi.remove(code)
    if (res.data.success) {
      showToast('删除成功')
      fetchData(selectedGroup.value === '全部' ? undefined : selectedGroup.value)
    }
  } catch {
    // 用户取消
  }
}

// 移动到分组
const moveToGroup = async (fund, group) => {
  const res = await fundApi.updateFundGroup(fund.code, group)
  if (res.data.success) {
    showToast('移动成功')
    // selectedGroup.value = group
    handleRefresh()
  }
}

// 涨跌颜色
const getProfitClass = (val) => {
  const num = parseFloat(val)
  if (num > 0) return 'text-up'
  if (num < 0) return 'text-down'
  return 'text-flat'
}

const formatPercent = (val) => {
  const num = parseFloat(val)
  if (num > 0) return '+' + num.toFixed(2) + '%'
  return num.toFixed(2) + '%'
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="watching-page">
    <!-- 分组标签 -->
    <div class="group-tabs">
      <div
        v-for="group in ['全部', ...groups]"
        :key="group"
        class="group-tab"
        :class="{ active: selectedGroup === group }"
        @click="selectedGroup = group; toggleGroupEdit(group)"
      >
        <span>{{ group }}</span>
        <span
          v-if="group !== '全部' && activeEditGroup === group"
          class="group-actions"
        >
          <span
            class="group-action-btn edit-btn"
            @click.stop="openEditGroupDialog(group)"
          >
            ✎
          </span>
          <span
            class="group-action-btn delete-btn"
            @click.stop="deleteGroup(group)"
          >
            ✕
          </span>
        </span>
      </div>
    </div>

    <!-- 估值时间和刷新 -->
    <div v-if="updateTime" class="update-time-bar">
      <span class="update-time-text">更新时间: {{ updateTime }}</span>
      <button
        @click="handleRefresh"
        class="refresh-btn"
        title="刷新"
      >
        ↻
      </button>
    </div>

    <!-- 操作栏 -->
    <div style="padding: 12px; display: flex; gap: 8px; align-items: center">
      <van-dropdown-menu style="flex: 1">
        <van-dropdown-item
          v-model="sortType"
          :options="[
            { text: '默认排序', value: 'default' },
            { text: '收益率', value: 'profitRate' },
            { text: '收益', value: 'profit' },
            { text: '涨幅', value: 'growth' }
          ]"
        />
      </van-dropdown-menu>
      <van-button round type="primary" @click="addDialogVisible = true">
        + 添加基金
      </van-button>
      <van-button round type="primary" @click="groupDialogVisible = true">
        + 新建分组
      </van-button>
    </div>

    <!-- 基金列表 -->
    <div style="padding: 0 12px">
      <div v-for="fund in sortedFundList" :key="fund.code" class="fund-item">
        <div class="fund-card" @click="toggleFundActions(fund.code)">
          <div class="fund-left">
            <div class="fund-name">{{ fund.name }}</div>
            <div class="fund-code">{{ fund.code }} {{ fund.estimateTime }}</div>
          </div>
          <div class="fund-right">
            <div class="fund-estimate">{{ fund.estimate }}</div>
            <div class="fund-growth" :class="getProfitClass(fund.estimateGrowth)">
              {{ formatPercent(fund.estimateGrowth) }}
            </div>
          </div>
        </div>
        <div v-if="activeFundCode === fund.code" class="fund-actions">
          <van-button round size="small" type="default" icon="eye-o" @click="openFundDetail(fund.code)">
            查看
          </van-button>
          <van-button round size="small" type="primary" icon="edit" @click="openEditDialog(fund)">
            编辑
          </van-button>
          <van-dropdown-menu>
            <van-dropdown-item
              title="移动"
              :options="groups.map((g) => ({ text: g, value: g }))"
              @change="(val) => moveToGroup(fund, val)"
            />
          </van-dropdown-menu>
          <van-button round size="small" type="danger" icon="delete-o" @click="removeFund(fund.code, fund.name)">
            删除
          </van-button>
        </div>
      </div>
      <van-empty v-if="fundList.length === 0" description="暂无基金" />
    </div>

    <!-- 添加基金弹窗 -->
    <van-dialog
      v-model:show="addDialogVisible"
      title="添加基金"
      show-cancel-button
      @confirm="addFund"
    >
      <van-field
        v-model="newFundCode"
        label="基金代码"
        placeholder="如 000001"
      />
      <van-field
        v-model="newFundAmount"
        label="持仓金额"
        type="number"
        placeholder="选填,可稍后编辑"
      />
    </van-dialog>

    <!-- 编辑持仓弹窗 -->
    <van-dialog
      v-model:show="editDialogVisible"
      title="编辑持仓"
      show-cancel-button
      @confirm="saveHolding"
    >
      <div class="edit-info">
        <div class="edit-name">{{ editForm.fundName }}</div>
        <div class="edit-price">当前净值：{{ editForm.netWorth }}</div>
      </div>
      <van-field
        v-model.number="editForm.cost"
        label="持仓金额"
        type="number"
        placeholder="输入持仓成本"
      />
      <div class="calc-shares">
        计算份额：{{ editForm.cost > 0 ? (editForm.cost / editForm.netWorth).toFixed(4) : '0.0000' }} 份
      </div>
    </van-dialog>

    <!-- 新建分组弹窗 -->
    <van-dialog
      v-model:show="groupDialogVisible"
      title="新建分组"
      show-cancel-button
      @confirm="addGroup"
    >
      <van-field
        v-model="newGroupName"
        label="分组名称"
        placeholder="输入分组名称"
        @keyup.enter="addGroup"
      />
    </van-dialog>

    <!-- 编辑分组弹窗 -->
    <van-dialog
      v-model:show="editGroupDialogVisible"
      title="编辑分组"
      show-cancel-button
      @confirm="saveEditGroup"
    >
      <van-field
        v-model="editGroupName"
        label="分组名称"
        placeholder="输入新的分组名称"
        @keyup.enter="saveEditGroup"
      />
    </van-dialog>

    <!-- 基金详情弹窗 -->
    <van-popup
      v-model:show="detailDialogVisible"
      position="right"
      :style="{ width: '100%', height: '100%' }"
    >
      <div v-if="fundDetail" class="detail-popup">
        <div class="detail-header">
          <van-icon name="arrow-left" size="20" @click="detailDialogVisible = false" />
          <span class="detail-title">基金详情</span>
          <div style="width: 20px"></div>
        </div>

        <div class="detail-content">
          <div class="detail-card">
            <div class="detail-fund-name">{{ fundDetail.name }}</div>
            <div class="detail-fund-code">{{ fundDetail.code }}</div>
          </div>

          <div class="detail-card">
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
            <div class="detail-row">
              <span class="detail-label">更新时间</span>
              <span class="detail-value">{{ fundDetail.estimateTime }}</span>
            </div>
          </div>

          <div v-if="fundDetail.shares > 0" class="detail-card">
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
              <span class="detail-label">平均成本</span>
              <span class="detail-value">{{ fundDetail.avgCost }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">当前市值</span>
              <span class="detail-value">¥{{ fundDetail.currentValue }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">累计收益</span>
              <span class="detail-value" :class="getProfitClass(fundDetail.profit)">
                ¥{{ fundDetail.profit }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">收益率</span>
              <span class="detail-value" :class="getProfitClass(fundDetail.profitRate)">
                {{ formatPercent(fundDetail.profitRate) }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">今日收益</span>
              <span class="detail-value" :class="getProfitClass(fundDetail.todayProfit)">
                ¥{{ fundDetail.todayProfit }}
              </span>
            </div>
          </div>

          <div v-if="fundDetail.holdings && fundDetail.holdings.length > 0" class="detail-card">
            <div class="detail-section-title">重仓股票</div>
            <div v-for="stock in fundDetail.holdings" :key="stock.stock_code" class="stock-item">
              <div class="stock-info">
                <span class="stock-name">{{ stock.stock_name }}</span>
                <span class="stock-code">{{ stock.stock_code }}</span>
              </div>
              <span class="stock-ratio">{{ stock.holding_ratio }}%</span>
            </div>
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.watching-page {
  padding-bottom: 12px;
}

.update-time-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  font-size: 12px;
  color: #909399;
}

.update-time-text {
  flex: 1;
}

.refresh-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 20px;
  padding: 0;
  color: #1989fa;
  transition: transform 0.3s;
}

.refresh-btn:active {
  transform: rotate(180deg);
}

.group-tabs {
  display: flex;
  gap: 8px;
  padding: 12px;
  overflow-x: auto;
  white-space: nowrap;
}

.group-tab {
  padding: 6px 14px;
  background: white;
  border-radius: 16px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-tab.active {
  background: #1989fa;
  color: white;
}

.group-actions {
  display: flex;
  gap: 6px;
  margin-left: 4px;
}

.group-action-btn {
  font-size: 12px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.group-action-btn:hover {
  opacity: 1;
}

.edit-btn {
  color: inherit;
}

.delete-btn {
  color: #f56c6c;
}

.group-menu {
  position: fixed;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 100px;
  overflow: hidden;
}

.menu-item {
  padding: 12px 16px;
  font-size: 14px;
  color: #303133;
  cursor: pointer;
  transition: background 0.2s;
}

.menu-item:hover {
  background: #f5f7fa;
}

.menu-item-danger {
  color: #f56c6c;
}

.fund-item {
  margin-bottom: 6px;
}

.fund-card {
  background: white;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.2s;
}

.fund-card:active {
  background: #f5f7fa;
}

.fund-left {
  flex: 1;
  min-width: 0;
  margin-right: 12px;
}

.fund-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fund-code {
  font-size: 11px;
  color: #909399;
}

.fund-right {
  text-align: right;
  flex-shrink: 0;
}

.fund-estimate {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.fund-growth {
  font-size: 12px;
  font-weight: 500;
}

.fund-actions {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 0 0 8px 8px;
  margin-top: -6px;
}

.edit-info {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.edit-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.edit-price {
  font-size: 12px;
  color: #909399;
}

.calc-shares {
  font-size: 12px;
  color: #1989fa;
  margin-top: 12px;
  padding: 8px;
  background: #f0f2f5;
  border-radius: 4px;
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
  background: #f5f7fa;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.detail-title {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.detail-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.detail-fund-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.detail-fund-code {
  font-size: 14px;
  color: #909399;
}

.detail-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f7fa;
}

.detail-row:last-child {
  border-bottom: none;
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

.stock-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f7fa;
}

.stock-item:last-child {
  border-bottom: none;
}

.stock-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stock-name {
  font-size: 14px;
  color: #303133;
}

.stock-code {
  font-size: 12px;
  color: #909399;
}

.stock-ratio {
  font-size: 14px;
  font-weight: 500;
  color: #1989fa;
}
</style>
