// 添加交易（加仓/减仓）
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { getFundEstimate } = require('../_lib/fundService')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const { fundCode, type, amount, opDate, opTime, note } = req.body || {}
  if (!fundCode || !type || !amount || !opDate) {
    return res.json({ success: false, message: '请填写完整信息' })
  }

  // 获取当前基金净值
  const fundInfo = await getFundEstimate(fundCode).catch(() => null)
  if (!fundInfo) {
    return res.json({ success: false, message: '获取基金净值失败' })
  }

  const price = parseFloat(fundInfo.netWorth)
  const amountNum = parseFloat(amount)
  const shares = (amountNum / price).toFixed(4)

  // 插入交易记录
  await supabase.from('transactions').insert({
    user_id: userId,
    fund_code: fundCode,
    type,
    amount: amountNum,
    shares: parseFloat(shares),
    price,
    op_date: opDate,
    op_time: opTime || 'before',
    note: note || ''
  })

  // 更新持仓汇总
  if (type === 'buy') {
    // 查询现有持仓
    const { data: existing } = await supabase
      .from('holdings')
      .select('shares, cost')
      .eq('user_id', userId)
      .eq('fund_code', fundCode)
      .single()

    if (existing) {
      await supabase
        .from('holdings')
        .update({
          shares: parseFloat(existing.shares) + parseFloat(shares),
          cost: parseFloat(existing.cost) + amountNum,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('fund_code', fundCode)
    } else {
      await supabase.from('holdings').insert({
        user_id: userId,
        fund_code: fundCode,
        shares: parseFloat(shares),
        cost: amountNum
      })
    }
  } else if (type === 'sell') {
    const { data: existing } = await supabase
      .from('holdings')
      .select('shares, cost')
      .eq('user_id', userId)
      .eq('fund_code', fundCode)
      .single()

    if (existing) {
      const currentShares = parseFloat(existing.shares)
      const currentCost = parseFloat(existing.cost)
      const sellShares = parseFloat(shares)

      if (sellShares > currentShares) {
        return res.json({ success: false, message: '减仓份额超过持有份额' })
      }

      const costReduce = (sellShares / currentShares) * currentCost

      await supabase
        .from('holdings')
        .update({
          shares: currentShares - sellShares,
          cost: currentCost - costReduce,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('fund_code', fundCode)
    }
  }

  // 确保基金在自选列表中
  await supabase
    .from('funds')
    .upsert(
      { user_id: userId, code: fundCode, name: fundInfo.name },
      { onConflict: 'user_id,code' }
    )

  res.json({
    success: true,
    data: { shares, price, name: fundInfo.name }
  })
}
