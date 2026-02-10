// 添加自选基金
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { getFundEstimate } = require('../_lib/fundService')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const { code, groupName, amount } = req.body || {}
  if (!code) {
    return res.json({ success: false, message: '请输入基金代码' })
  }

  // 验证基金代码
  const fundInfo = await getFundEstimate(code).catch(() => null)
  if (!fundInfo) {
    return res.json({ success: false, message: '基金代码无效' })
  }

  // 保存到自选
  await supabase
    .from('funds')
    .upsert(
      { user_id: userId, code, name: fundInfo.name, group_name: groupName || '默认分组' },
      { onConflict: 'user_id,code' }
    )

  // 如果提供了金额，创建初始持仓
  if (amount && parseFloat(amount) > 0) {
    const cost = parseFloat(amount)
    const netWorth = parseFloat(fundInfo.netWorth)
    const shares = (cost / netWorth).toFixed(4)

    await supabase
      .from('holdings')
      .upsert(
        { user_id: userId, fund_code: code, shares, cost },
        { onConflict: 'user_id,fund_code' }
      )
  }

  res.json({ success: true, data: fundInfo })
}
