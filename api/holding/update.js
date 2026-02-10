// 直接更新持仓
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const { fundCode, shares, cost } = req.body || {}
  if (!fundCode || shares === undefined || cost === undefined) {
    return res.json({ success: false, message: '请填写完整信息' })
  }

  await supabase
    .from('holdings')
    .upsert(
      {
        user_id: userId,
        fund_code: fundCode,
        shares: parseFloat(shares),
        cost: parseFloat(cost),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,fund_code' }
    )

  res.json({ success: true })
}
