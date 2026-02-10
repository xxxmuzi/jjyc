// 基金统一入口：/api/fund?action=list|add|batchAdd|sort|group|groups|remove|detail|userGroups
const { supabase } = require('./_lib/supabase')
const { getUserId } = require('./_lib/auth')
const { getFundEstimate, getBatchFundEstimate } = require('./_lib/fundService')
const { cors } = require('./_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ success: false, message: '未授权' })

  const action = req.query.action || req.body?.action

  // 获取自选基金列表（含实时估值和持仓）
  if (action === 'list') {
    const groupName = req.query.groupName
    let query = supabase
      .from('funds')
      .select('code, name, sort_order, group_name')
      .eq('user_id', userId)
    if (groupName && groupName !== '全部') {
      query = query.eq('group_name', groupName)
    }
    const { data: funds } = await query.order('sort_order').order('created_at', { ascending: false })
    if (!funds || funds.length === 0) {
      return res.json({ success: true, data: [] })
    }
    const codes = funds.map((f) => f.code)
    const estimates = await getBatchFundEstimate(codes)
    const { data: holdings } = await supabase
      .from('holdings')
      .select('fund_code, shares, cost')
      .eq('user_id', userId)
    const holdingsMap = {}
    if (holdings) {
      holdings.forEach((h) => {
        holdingsMap[h.fund_code] = { shares: parseFloat(h.shares) || 0, cost: parseFloat(h.cost) || 0 }
      })
    }
    const result = estimates.map((e) => {
      const holding = holdingsMap[e.code] || { shares: 0, cost: 0 }
      const fund = funds.find((f) => f.code === e.code)
      const currentPrice = parseFloat(e.estimate || e.netWorth)
      const currentGrowth = parseFloat(e.estimateGrowth || 0)
      const currentValue = holding.shares * currentPrice
      const profit = currentValue - holding.cost
      const profitRate = holding.cost > 0 ? (profit / holding.cost) * 100 : 0
      const growth = currentGrowth / 100
      let todayProfit = 0
      if (growth !== 0 && holding.shares > 0) {
        todayProfit = (holding.shares * currentPrice * growth) / (1 + growth)
      }
      return {
        ...e,
        group_name: fund ? fund.group_name : '默认分组',
        estimate: currentPrice.toString(),
        estimateGrowth: currentGrowth.toString(),
        shares: holding.shares,
        cost: holding.cost,
        currentValue: currentValue.toFixed(2),
        profit: profit.toFixed(2),
        profitRate: profitRate.toFixed(2),
        todayProfit: todayProfit.toFixed(2)
      }
    })
    return res.json({ success: true, data: result })
  }

  // 添加自选基金
  if (action === 'add') {
    const { code, groupName, amount } = req.body || {}
    if (!code) return res.json({ success: false, message: '请输入基金代码' })
    const fundInfo = await getFundEstimate(code).catch(() => null)
    if (!fundInfo) return res.json({ success: false, message: '基金代码无效' })
    await supabase
      .from('funds')
      .upsert({ user_id: userId, code, name: fundInfo.name, group_name: groupName || '默认分组' }, { onConflict: 'user_id,code' })
    if (amount && parseFloat(amount) > 0) {
      const cost = parseFloat(amount)
      const shares = (cost / parseFloat(fundInfo.netWorth)).toFixed(4)
      await supabase
        .from('holdings')
        .upsert({ user_id: userId, fund_code: code, shares, cost }, { onConflict: 'user_id,fund_code' })
    }
    return res.json({ success: true, data: fundInfo })
  }

  // 批量添加
  if (action === 'batchAdd') {
    const { codes } = req.body || {}
    if (!codes || !Array.isArray(codes)) return res.json({ success: false, message: '请输入基金代码' })
    const results = { success: [], failed: [] }
    for (const code of codes) {
      const c = code.trim()
      if (!c) continue
      const info = await getFundEstimate(c).catch(() => null)
      if (info) {
        await supabase.from('funds').upsert({ user_id: userId, code: c, name: info.name }, { onConflict: 'user_id,code' })
        results.success.push({ code: c, name: info.name })
      } else {
        results.failed.push(c)
      }
    }
    return res.json({ success: true, data: results })
  }

  // 更新排序
  if (action === 'sort') {
    const { orders } = req.body || {}
    if (!orders || !Array.isArray(orders)) return res.json({ success: false, message: '参数错误' })
    for (const item of orders) {
      await supabase.from('funds').update({ sort_order: item.sortOrder }).eq('user_id', userId).eq('code', item.code)
    }
    return res.json({ success: true })
  }

  // 更新基金分组
  if (action === 'group') {
    const { code, groupName } = req.body || {}
    if (!code || !groupName) return res.json({ success: false, message: '参数错误' })
    await supabase.from('funds').update({ group_name: groupName }).eq('user_id', userId).eq('code', code)
    return res.json({ success: true })
  }

  // 获取分组列表（从基金表去重）
  if (action === 'groups') {
    const { data } = await supabase.from('funds').select('group_name').eq('user_id', userId)
    const groups = [...new Set((data || []).map((r) => r.group_name).filter(Boolean))].sort()
    return res.json({ success: true, data: groups })
  }

  // 删除基金
  if (action === 'remove') {
    const code = req.query.code
    if (!code) return res.json({ success: false, message: '缺少基金代码' })
    await supabase.from('transactions').delete().eq('user_id', userId).eq('fund_code', code)
    await supabase.from('holdings').delete().eq('user_id', userId).eq('fund_code', code)
    await supabase.from('funds').delete().eq('user_id', userId).eq('code', code)
    return res.json({ success: true })
  }

  // 基金详情
  if (action === 'detail') {
    const code = req.query.code
    if (!code) return res.json({ success: false, message: '缺少基金代码' })
    const fundInfo = await getFundEstimate(code).catch(() => null)
    if (!fundInfo) return res.json({ success: false, message: '获取基金信息失败' })
    const { data: holding } = await supabase
      .from('holdings').select('shares, cost').eq('user_id', userId).eq('fund_code', code).single()
    const shares = parseFloat(holding?.shares) || 0
    const cost = parseFloat(holding?.cost) || 0
    const estimate = parseFloat(fundInfo.estimate || fundInfo.netWorth)
    const currentValue = shares * estimate
    const profit = currentValue - cost
    const profitRate = cost > 0 ? (profit / cost) * 100 : 0
    const avgCost = shares > 0 ? cost / shares : 0
    const growth = parseFloat(fundInfo.estimateGrowth || 0) / 100
    let todayProfit = 0
    if (growth !== 0 && shares > 0) {
      todayProfit = (shares * estimate * growth) / (1 + growth)
    }
    return res.json({
      success: true,
      data: {
        ...fundInfo, shares, cost,
        avgCost: avgCost.toFixed(4),
        currentValue: currentValue.toFixed(2),
        profit: profit.toFixed(2),
        profitRate: profitRate.toFixed(2),
        todayProfit: todayProfit.toFixed(2),
        holdings: []
      }
    })
  }

  // 用户分组管理
  if (action === 'userGroups') {
    const method = req.method
    const subAction = req.query.subAction

    if (method === 'GET') {
      const { data } = await supabase.from('fund_groups').select('group_name').eq('user_id', userId).order('group_name')
      return res.json({ success: true, data: (data || []).map((r) => r.group_name) })
    }
    if (method === 'POST' && subAction === 'create') {
      const { groupName } = req.body || {}
      if (!groupName?.trim()) return res.json({ success: false, message: '分组名称不能为空' })
      const { error } = await supabase.from('fund_groups').insert({ user_id: userId, group_name: groupName.trim() })
      if (error) return res.json({ success: false, message: error.code === '23505' ? '分组已存在' : '创建失败' })
      return res.json({ success: true, message: '分组创建成功' })
    }
    if (method === 'PUT') {
      const { groupName, newGroupName } = req.body || {}
      if (!groupName || !newGroupName?.trim()) return res.json({ success: false, message: '参数错误' })
      const { error } = await supabase.from('fund_groups').update({ group_name: newGroupName.trim() }).eq('user_id', userId).eq('group_name', groupName)
      if (error) return res.json({ success: false, message: error.code === '23505' ? '分组名称已存在' : '修改失败' })
      await supabase.from('funds').update({ group_name: newGroupName.trim() }).eq('user_id', userId).eq('group_name', groupName)
      return res.json({ success: true, message: '分组修改成功' })
    }
    if (method === 'DELETE') {
      const groupName = req.query.groupName
      if (!groupName) return res.json({ success: false, message: '缺少分组名称' })
      await supabase.from('funds').update({ group_name: null }).eq('user_id', userId).eq('group_name', groupName)
      await supabase.from('fund_groups').delete().eq('user_id', userId).eq('group_name', groupName)
      return res.json({ success: true })
    }
  }

  res.json({ success: false, message: '未知操作' })
}
