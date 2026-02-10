// 持仓/交易统一入口：/api/holding?action=trade|update|transactions|deleteTransaction
const { supabase } = require('./_lib/supabase')
const { getUserId } = require('./_lib/auth')
const { getFundEstimate } = require('./_lib/fundService')
const { cors } = require('./_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ success: false, message: '未授权' })

  const action = req.query.action || req.body?.action

  // 添加交易
  if (action === 'trade') {
    const { fundCode, type, amount, opDate, opTime, note } = req.body || {}
    if (!fundCode || !type || !amount || !opDate) {
      return res.json({ success: false, message: '请填写完整信息' })
    }
    const fundInfo = await getFundEstimate(fundCode).catch(() => null)
    if (!fundInfo) return res.json({ success: false, message: '获取基金净值失败' })

    const price = parseFloat(fundInfo.netWorth)
    const amountNum = parseFloat(amount)
    const shares = (amountNum / price).toFixed(4)

    await supabase.from('transactions').insert({
      user_id: userId, fund_code: fundCode, type,
      amount: amountNum, shares: parseFloat(shares), price,
      op_date: opDate, op_time: opTime || 'before', note: note || ''
    })

    const { data: existing } = await supabase
      .from('holdings').select('shares, cost')
      .eq('user_id', userId).eq('fund_code', fundCode).single()

    if (type === 'buy') {
      if (existing) {
        await supabase.from('holdings').update({
          shares: parseFloat(existing.shares) + parseFloat(shares),
          cost: parseFloat(existing.cost) + amountNum,
          updated_at: new Date().toISOString()
        }).eq('user_id', userId).eq('fund_code', fundCode)
      } else {
        await supabase.from('holdings').insert({
          user_id: userId, fund_code: fundCode,
          shares: parseFloat(shares), cost: amountNum
        })
      }
    } else if (type === 'sell' && existing) {
      const curShares = parseFloat(existing.shares)
      const curCost = parseFloat(existing.cost)
      const sellShares = parseFloat(shares)
      if (sellShares > curShares) {
        return res.json({ success: false, message: '减仓份额超过持有份额' })
      }
      const costReduce = (sellShares / curShares) * curCost
      await supabase.from('holdings').update({
        shares: curShares - sellShares,
        cost: curCost - costReduce,
        updated_at: new Date().toISOString()
      }).eq('user_id', userId).eq('fund_code', fundCode)
    }

    await supabase.from('funds').upsert(
      { user_id: userId, code: fundCode, name: fundInfo.name },
      { onConflict: 'user_id,code' }
    )

    return res.json({ success: true, data: { shares, price, name: fundInfo.name } })
  }

  // 直接更新持仓
  if (action === 'update') {
    const { fundCode, shares, cost } = req.body || {}
    if (!fundCode || shares === undefined || cost === undefined) {
      return res.json({ success: false, message: '请填写完整信息' })
    }
    await supabase.from('holdings').upsert({
      user_id: userId, fund_code: fundCode,
      shares: parseFloat(shares), cost: parseFloat(cost),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,fund_code' })
    return res.json({ success: true })
  }

  // 获取交易记录
  if (action === 'transactions') {
    const fundCode = req.query.fundCode
    let query = supabase.from('transactions').select('*')
      .eq('user_id', userId)
      .order('op_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (fundCode) query = query.eq('fund_code', fundCode)
    const { data } = await query

    if (data && data.length > 0) {
      const codes = [...new Set(data.map((t) => t.fund_code))]
      const { data: funds } = await supabase
        .from('funds').select('code, name')
        .eq('user_id', userId).in('code', codes)
      const nameMap = {}
      if (funds) funds.forEach((f) => { nameMap[f.code] = f.name })
      data.forEach((t) => { t.fund_name = nameMap[t.fund_code] || '' })
    }
    return res.json({ success: true, data: data || [] })
  }

  // 删除交易记录
  if (action === 'deleteTransaction') {
    const id = req.query.id
    if (!id) return res.json({ success: false, message: '缺少记录 ID' })

    const { data: tx } = await supabase
      .from('transactions').select('*')
      .eq('id', id).eq('user_id', userId).single()
    if (!tx) return res.json({ success: false, message: '记录不存在' })

    const { data: holding } = await supabase
      .from('holdings').select('shares, cost')
      .eq('user_id', userId).eq('fund_code', tx.fund_code).single()

    if (holding) {
      const curShares = parseFloat(holding.shares)
      const curCost = parseFloat(holding.cost)
      if (tx.type === 'buy') {
        await supabase.from('holdings').update({
          shares: curShares - parseFloat(tx.shares),
          cost: curCost - parseFloat(tx.amount),
          updated_at: new Date().toISOString()
        }).eq('user_id', userId).eq('fund_code', tx.fund_code)
      } else if (tx.type === 'sell') {
        const costRestore = parseFloat(tx.shares) * parseFloat(tx.price)
        await supabase.from('holdings').update({
          shares: curShares + parseFloat(tx.shares),
          cost: curCost + costRestore,
          updated_at: new Date().toISOString()
        }).eq('user_id', userId).eq('fund_code', tx.fund_code)
      }
    }

    await supabase.from('transactions').delete().eq('id', id)
    return res.json({ success: true })
  }

  res.json({ success: false, message: '未知操作' })
}
