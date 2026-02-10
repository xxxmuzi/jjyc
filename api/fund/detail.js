// 获取单个基金详情
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { getFundEstimate } = require('../_lib/fundService')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const code = req.query.code
  if (!code) {
    return res.json({ success: false, message: '缺少基金代码' })
  }

  // 获取实时估值
  const fundInfo = await getFundEstimate(code).catch(() => null)
  if (!fundInfo) {
    return res.json({ success: false, message: '获取基金信息失败' })
  }

  // 获取持仓信息
  const { data: holding } = await supabase
    .from('holdings')
    .select('shares, cost')
    .eq('user_id', userId)
    .eq('fund_code', code)
    .single()

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
      holdings: []
    }
  })
}
