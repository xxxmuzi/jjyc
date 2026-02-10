require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { initDatabase } = require('./db/database')
const { router: authRoutes } = require('./routes/auth')
const fundRoutes = require('./routes/fund')
const holdingRoutes = require('./routes/holding')

const app = express()
const PORT = process.env.PORT || 3001

// 中间件
app.use(cors({
  origin: true,
  credentials: true
}))
app.use(express.json())

// 路由
app.use('/api/auth', authRoutes)
app.use('/api/fund', fundRoutes)
app.use('/api/holding', holdingRoutes)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// 启动服务
async function start() {
  await initDatabase()
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`服务已启动: http://0.0.0.0:${PORT}`)
    console.log(`本地访问: http://localhost:${PORT}`)
  })
}

start().catch(console.error)
