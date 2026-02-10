// 用户分组管理（列表/创建/修改/删除）
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  // 通过 query 参数区分操作
  const action = req.query.action
  const method = req.method

  // GET: 获取分组列表
  if (method === 'GET') {
    const { data } = await supabase
      .from('fund_groups')
      .select('group_name')
      .eq('user_id', userId)
      .order('group_name')

    const groups = (data || []).map((r) => r.group_name)
    return res.json({ success: true, data: groups })
  }

  // POST: 创建分组
  if (method === 'POST' && action === 'create') {
    const { groupName } = req.body || {}
    if (!groupName || !groupName.trim()) {
      return res.json({ success: false, message: '分组名称不能为空' })
    }

    const { error } = await supabase
      .from('fund_groups')
      .insert({ user_id: userId, group_name: groupName.trim() })

    if (error) {
      if (error.code === '23505') {
        return res.json({ success: false, message: '分组已存在' })
      }
      return res.json({ success: false, message: '创建分组失败' })
    }
    return res.json({ success: true, message: '分组创建成功' })
  }

  // PUT: 修改分组名称
  if (method === 'PUT') {
    const { groupName, newGroupName } = req.body || {}
    if (!groupName || !newGroupName || !newGroupName.trim()) {
      return res.json({ success: false, message: '参数错误' })
    }

    const { error } = await supabase
      .from('fund_groups')
      .update({ group_name: newGroupName.trim() })
      .eq('user_id', userId)
      .eq('group_name', groupName)

    if (error) {
      if (error.code === '23505') {
        return res.json({ success: false, message: '分组名称已存在' })
      }
      return res.json({ success: false, message: '修改分组失败' })
    }

    // 同步更新基金表中的分组名称
    await supabase
      .from('funds')
      .update({ group_name: newGroupName.trim() })
      .eq('user_id', userId)
      .eq('group_name', groupName)

    return res.json({ success: true, message: '分组修改成功' })
  }

  // DELETE: 删除分组
  if (method === 'DELETE') {
    const groupName = req.query.groupName
    if (!groupName) {
      return res.json({ success: false, message: '缺少分组名称' })
    }

    // 将该分组下的基金重置为空
    await supabase
      .from('funds')
      .update({ group_name: null })
      .eq('user_id', userId)
      .eq('group_name', groupName)

    await supabase
      .from('fund_groups')
      .delete()
      .eq('user_id', userId)
      .eq('group_name', groupName)

    return res.json({ success: true })
  }

  res.json({ success: false, message: '不支持的操作' })
}
