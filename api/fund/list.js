// 获取自选基金列表（含实时估值和持仓信息）
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { getBatchFundEstimate } = require('../_lib/fundService')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const groupName = req.query.groupName

  // 查询自选基金
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

  // 批量获取实时估值
  const codes = funds.map((f) => f.code)
  const estimates = await getBatchFundEstimate(codes)

  // 查询持仓信息
  const { data: holdings } = await supabase
    .from('holdings')
    .select('fund_code, shares, cost')
    .eq('user_id', userId)

  const holdingsMap = {}
  if (holdings) {
    holdings.forEach((h) => {
      holdingsMap[h.fund_code] = {
        shares: parseFloat(h.shares) || 0,
        cost: parseFloat(h.cost) || 0
      }
    })
  }

  // 合并数据
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

  res.json({ success: true, data: result })
}
