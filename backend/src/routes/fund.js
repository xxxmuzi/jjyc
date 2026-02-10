const express = require('express')
const router = express.Router()
const { pool } = require('../db/database')
const { getFundEstimate, getBatchFundEstimate, getFundHoldings } = require('../services/fundService')
const { authMiddleware } = require('./auth')

// 应用认证中间件到所有路由
router.use(authMiddleware)

// 获取所有自选基金（含实时估值和持仓信息）
router.get('/list', async (req, res) => {
  const userId = req.userId
  const groupName = req.query.groupName // 可选的分组过滤
  
  let query = 'SELECT code, name, sort_order, group_name FROM funds WHERE user_id = ?'
  const params = [userId]
  
  if (groupName && groupName !== '全部') {
    query += ' AND group_name = ?'
    params.push(groupName)
  }
  
  query += ' ORDER BY sort_order ASC, created_at DESC'
  
  const [funds] = await pool.execute(query, params)
  
  if (funds.length === 0) {
    return res.json({ success: true, data: [] })
  }
  
  // 获取实时估值
  const codes = funds.map(f => f.code)
  const estimates = await getBatchFundEstimate(codes)
  
  // 获取持仓信息
  const [holdings] = await pool.execute(
    'SELECT fund_code, shares, cost FROM holdings WHERE user_id = ?',
    [userId]
  )
  const holdingsMap = {}
  holdings.forEach(h => {
    holdingsMap[h.fund_code] = {
      shares: parseFloat(h.shares) || 0,
      cost: parseFloat(h.cost) || 0
    }
  })
  
  // 合并数据
  const result = estimates.map(e => {
    const holding = holdingsMap[e.code] || { shares: 0, cost: 0 }
    
    // 判断是否使用最新净值还是估值
    const today = new Date().toISOString().split('T')[0] // 格式: 2024-02-04
    const netWorthDate = (e.netWorthDate || '').split(' ')[0] // 去掉可能的时间部分
    const useNetWorth = netWorthDate === today
    
    // 选择使用净值还是估值
    const currentPrice = useNetWorth ? parseFloat(e.netWorth) : parseFloat(e.estimate || e.netWorth)
    
    // 计算实际涨幅
    let currentGrowth = parseFloat(e.estimateGrowth || 0)
    if (useNetWorth) {
      // 使用净值时,计算实际涨幅 = (今日净值 - 昨日净值) / 昨日净值 * 100
      // 这里简化处理,使用估算涨幅(因为没有昨日净值数据)
      // 实际应该从历史数据中获取昨日净值
      currentGrowth = parseFloat(e.estimateGrowth || 0)
    }
    
    const currentValue = holding.shares * currentPrice
    const profit = currentValue - holding.cost
    const profitRate = holding.cost > 0 ? (profit / holding.cost * 100) : 0
    
    // 计算今日收益
    const growth = currentGrowth / 100
    let todayProfit = 0
    if (growth !== 0 && holding.shares > 0) {
      todayProfit = (holding.shares * currentPrice * growth) / (1 + growth)
    }
    
    return {
      ...e,
      estimate: currentPrice.toString(), // 统一使用当前价格
      estimateGrowth: currentGrowth.toString(), // 统一使用当前涨幅
      shares: holding.shares,
      cost: holding.cost,
      currentValue: currentValue.toFixed(2),
      profit: profit.toFixed(2),
      profitRate: profitRate.toFixed(2),
      todayProfit: todayProfit.toFixed(2),
      isNetWorth: useNetWorth // 标记是否使用净值
    }
  })
  
  res.json({ success: true, data: result })
})

// 添加自选基金
router.post('/add', async (req, res) => {
  const userId = req.userId
  const { code, groupName, amount } = req.body
  
  console.log('添加基金请求:', { userId, code, groupName, amount })
  
  if (!code) {
    return res.json({ success: false, message: '请输入基金代码' })
  }
  
  // 获取基金信息验证代码是否有效
  const fundInfo = await getFundEstimate(code).catch(() => null)
  if (!fundInfo) {
    return res.json({ success: false, message: '基金代码无效' })
  }
  
  console.log('获取到基金信息:', fundInfo)
  
  // 保存到数据库
  await pool.execute(
    'INSERT IGNORE INTO funds (user_id, code, name, group_name) VALUES (?, ?, ?, ?)',
    [userId, code, fundInfo.name, groupName || '默认分组']
  )
  
  // 如果提供了金额,创建初始持仓
  if (amount && parseFloat(amount) > 0) {
    const cost = parseFloat(amount)
    const netWorth = parseFloat(fundInfo.netWorth)
    const shares = (cost / netWorth).toFixed(4)
    
    console.log('创建持仓:', { userId, code, shares, cost, netWorth })
    
    await pool.execute(
      'INSERT INTO holdings (user_id, fund_code, shares, cost) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE shares = ?, cost = ?',
      [userId, code, shares, cost, shares, cost]
    )
    
    console.log('持仓创建成功')
  }
  
  res.json({ success: true, data: fundInfo })
})

// 批量添加基金
router.post('/batch-add', async (req, res) => {
  const userId = req.userId
  const { codes } = req.body
  
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return res.json({ success: false, message: '请输入基金代码' })
  }
  
  const results = { success: [], failed: [] }
  
  for (const code of codes) {
    const trimCode = code.trim()
    if (!trimCode) continue
    
    const fundInfo = await getFundEstimate(trimCode).catch(() => null)
    if (fundInfo) {
      await pool.execute(
        'INSERT IGNORE INTO funds (user_id, code, name) VALUES (?, ?, ?)',
        [userId, trimCode, fundInfo.name]
      )
      results.success.push({ code: trimCode, name: fundInfo.name })
    } else {
      results.failed.push(trimCode)
    }
  }
  
  res.json({ success: true, data: results })
})

// 更新基金排序
router.put('/sort', async (req, res) => {
  const userId = req.userId
  const { orders } = req.body // [{ code: '000001', sortOrder: 1 }, ...]
  
  if (!orders || !Array.isArray(orders)) {
    return res.json({ success: false, message: '参数错误' })
  }
  
  for (const item of orders) {
    await pool.execute(
      'UPDATE funds SET sort_order = ? WHERE user_id = ? AND code = ?',
      [item.sortOrder, userId, item.code]
    )
  }
  
  res.json({ success: true })
})

// 更新基金分组
router.put('/group', async (req, res) => {
  const userId = req.userId
  const { code, groupName } = req.body
  
  if (!code || !groupName) {
    return res.json({ success: false, message: '参数错误' })
  }
  
  await pool.execute(
    'UPDATE funds SET group_name = ? WHERE user_id = ? AND code = ?',
    [groupName, userId, code]
  )
  
  res.json({ success: true })
})

// 获取所有分组
router.get('/groups', async (req, res) => {
  const userId = req.userId
  const [rows] = await pool.execute(
    'SELECT DISTINCT group_name FROM funds WHERE user_id = ? ORDER BY group_name',
    [userId]
  )
  const groups = rows.map(r => r.group_name)
  res.json({ success: true, data: groups })
})

// 删除自选基金
router.delete('/:code', async (req, res) => {
  const userId = req.userId
  const { code } = req.params
  
  await pool.execute('DELETE FROM transactions WHERE user_id = ? AND fund_code = ?', [userId, code])
  await pool.execute('DELETE FROM holdings WHERE user_id = ? AND fund_code = ?', [userId, code])
  await pool.execute('DELETE FROM funds WHERE user_id = ? AND code = ?', [userId, code])
  
  res.json({ success: true })
})

// 获取单个基金详情（含估值和持仓）
router.get('/detail/:code', async (req, res) => {
  const userId = req.userId
  const { code } = req.params
  
  // 获取实时估值
  const fundInfo = await getFundEstimate(code).catch(() => null)
  if (!fundInfo) {
    return res.json({ success: false, message: '获取基金信息失败' })
  }
  
  // 获取持仓信息
  const [holdings] = await pool.execute(
    'SELECT shares, cost FROM holdings WHERE user_id = ? AND fund_code = ?',
    [userId, code]
  )
  const holding = holdings[0] || { shares: 0, cost: 0 }
  
  // 获取基金持股信息
  const [fundHoldings] = await pool.execute(
    'SELECT stock_code, stock_name, holding_ratio FROM fund_holdings WHERE fund_code = ? ORDER BY holding_ratio DESC LIMIT 10',
    [code]
  )
  
  const estimate = parseFloat(fundInfo.estimate || fundInfo.netWorth)
  const shares = parseFloat(holding.shares) || 0
  const cost = parseFloat(holding.cost) || 0
  const currentValue = shares * estimate
  const profit = currentValue - cost
  const profitRate = cost > 0 ? (profit / cost * 100) : 0
  const avgCost = shares > 0 ? (cost / shares) : 0
  
  // 今日收益
  const growth = parseFloat(fundInfo.estimateGrowth || 0) / 100
  let todayProfit = 0
  if (growth !== 0 && shares > 0) {
    todayProfit = (shares * estimate * growth) / (1 + growth)
  }
  
  res.json({
    success: true,
    data: {
      ...fundInfo,
      shares,
      cost,
      avgCost: avgCost.toFixed(4),
      currentValue: currentValue.toFixed(2),
      profit: profit.toFixed(2),
      profitRate: profitRate.toFixed(2),
      todayProfit: todayProfit.toFixed(2),
      holdings: fundHoldings
    }
  })
})

// 搜索基金（模糊搜索）
router.get('/search/:keyword', async (req, res) => {
  const { keyword } = req.params
  
  if (!keyword || keyword.length < 1) {
    return res.json({ success: true, data: [] })
  }
  
  // 从天天基金获取搜索结果（这里简化处理，实际应该调用外部API）
  // 为了演示，返回空数组，前端可以集成真实的基金搜索API
  res.json({ success: true, data: [] })
})

// 获取用户的所有分组
router.get('/user-groups/list', async (req, res) => {
  const userId = req.userId
  const [rows] = await pool.execute(
    'SELECT group_name FROM fund_groups WHERE user_id = ? ORDER BY group_name',
    [userId]
  )
  const groups = rows.map(r => r.group_name)
  res.json({ success: true, data: groups })
})

// 创建新分组
router.post('/user-groups/create', async (req, res) => {
  const userId = req.userId
  const { groupName } = req.body
  
  if (!groupName || !groupName.trim()) {
    return res.json({ success: false, message: '分组名称不能为空' })
  }
  
  try {
    await pool.execute(
      'INSERT INTO fund_groups (user_id, group_name) VALUES (?, ?)',
      [userId, groupName.trim()]
    )
    res.json({ success: true, message: '分组创建成功' })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.json({ success: false, message: '分组已存在' })
    } else {
      res.json({ success: false, message: '创建分组失败' })
    }
  }
})

// 修改分组名称
router.put('/user-groups/:groupName', async (req, res) => {
  const userId = req.userId
  const { groupName } = req.params
  const { newGroupName } = req.body
  
  if (!newGroupName || !newGroupName.trim()) {
    return res.json({ success: false, message: '新分组名称不能为空' })
  }
  
  try {
    // 更新分组表
    await pool.execute(
      'UPDATE fund_groups SET group_name = ? WHERE user_id = ? AND group_name = ?',
      [newGroupName.trim(), userId, groupName]
    )
    
    // 更新基金表中的分组名称
    await pool.execute(
      'UPDATE funds SET group_name = ? WHERE user_id = ? AND group_name = ?',
      [newGroupName.trim(), userId, groupName]
    )
    
    res.json({ success: true, message: '分组修改成功' })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.json({ success: false, message: '分组名称已存在' })
    } else {
      res.json({ success: false, message: '修改分组失败' })
    }
  }
})

// 删除分组
router.delete('/user-groups/:groupName', async (req, res) => {
  const userId = req.userId
  const { groupName } = req.params
  
  // 将该分组下的基金的 group_name 重置为 NULL（不绑定任何分组）
  await pool.execute(
    'UPDATE funds SET group_name = NULL WHERE user_id = ? AND group_name = ?',
    [userId, groupName]
  )
  
  // 删除分组
  await pool.execute(
    'DELETE FROM fund_groups WHERE user_id = ? AND group_name = ?',
    [userId, groupName]
  )
  
  res.json({ success: true })
})

module.exports = router
