// 批量添加基金
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { getFundEstimate } = require('../_lib/fundService')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const { codes } = req.body || {}
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return res.json({ success: false, message: '请输入基金代码' })
  }

  const results = { success: [], failed: [] }

  for (const code of codes) {
    const trimCode = code.trim()
    if (!trimCode) continue

    const fundInfo = await getFundEstimate(trimCode).catch(() => null)
    if (fundInfo) {
      await supabase
        .from('funds')
        .upsert(
          { user_id: userId, code: trimCode, name: fundInfo.name },
          { onConflict: 'user_id,code' }
        )
      results.success.push({ code: trimCode, name: fundInfo.name })
    } else {
      results.failed.push(trimCode)
    }
  }

  res.json({ success: true, data: results })
}
