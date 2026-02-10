const express = require('express')
const router = express.Router()
const { pool } = require('../db/database')

// JWT 密钥（生产环境应该从环境变量读取）
const JWT_SECRET = process.env.JWT_SECRET || 'fund-tracker-secret-key'

// 认证中间件
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ success: false, message: '未授权' })
  }
  
  try {
    // 简单的 token 验证（生产环境应使用 jsonwebtoken 库）
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE id = ? AND token = ?',
      [parseInt(token.split('-')[0]), token]
    )
    
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: '令牌无效' })
    }
    
    req.userId = users[0].id
    next()
  } catch (error) {
    res.status(401).json({ success: false, message: '认证失败' })
  }
}

// 登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body
  
  if (!username || !password) {
    return res.json({ success: false, message: '用户名和密码不能为空' })
  }
  
  const [users] = await pool.execute(
    'SELECT id, username, nickname FROM users WHERE username = ? AND password = ?',
    [username, password]
  )
  
  if (users.length === 0) {
    return res.json({ success: false, message: '用户名或密码错误' })
  }
  
  const user = users[0]
  // 生成简单的 token
  const token = `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // 保存 token 到数据库
  await pool.execute(
    'UPDATE users SET token = ? WHERE id = ?',
    [token, user.id]
  )
  
  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname
      }
    }
  })
})

// 注册
router.post('/register', async (req, res) => {
  const { username, password, nickname } = req.body
  
  if (!username || !password) {
    return res.json({ success: false, message: '用户名和密码不能为空' })
  }
  
  try {
    await pool.execute(
      'INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)',
      [username, password, nickname || username]
    )
    
    res.json({ success: true, message: '注册成功' })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.json({ success: false, message: '用户名已存在' })
    } else {
      res.json({ success: false, message: '注册失败' })
    }
  }
})

// 登出
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (token) {
    const userId = parseInt(token.split('-')[0])
    await pool.execute('UPDATE users SET token = NULL WHERE id = ?', [userId])
  }
  
  res.json({ success: true, message: '登出成功' })
})

// 获取当前用户信息
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ success: false, message: '未授权' })
  }
  
  try {
    const [users] = await pool.execute(
      'SELECT id, username, nickname FROM users WHERE id = ? AND token = ?',
      [parseInt(token.split('-')[0]), token]
    )
    
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: '令牌无效' })
    }
    
    res.json({ success: true, data: users[0] })
  } catch (error) {
    res.status(401).json({ success: false, message: '认证失败' })
  }
})

module.exports = { router, authMiddleware }
