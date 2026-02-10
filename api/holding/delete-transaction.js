// 删除交易记录（同时回滚持仓）
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const id = req.query.id
  if (!id) {
    return res.json({ success: false, message: '缺少记录 ID' })
  }

  // 获取交易记录
  const { data: tx } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!tx) {
    return res.json({ success: false, message: '记录不存在' })
  }

  // 回滚持仓
  const { data: holding } = await supabase
    .from('holdings')
    .select('shares, cost')
    .eq('user_id', userId)
    .eq('fund_code', tx.fund_code)
    .single()

  if (holding) {
    const currentShares = parseFloat(holding.shares)
    const currentCost = parseFloat(holding.cost)

    if (tx.type === 'buy') {
      await supabase
        .from('holdings')
        .update({
          shares: currentShares - parseFloat(tx.shares),
          cost: currentCost - parseFloat(tx.amount),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('fund_code', tx.fund_code)
    } else if (tx.type === 'sell') {
      const costRestore = parseFloat(tx.shares) * parseFloat(tx.price)
      await supabase
        .from('holdings')
        .update({
          shares: currentShares + parseFloat(tx.shares),
          cost: currentCost + costRestore,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('fund_code', tx.fund_code)
    }
  }

  // 删除记录
  await supabase.from('transactions').delete().eq('id', id)

  res.json({ success: true })
}
