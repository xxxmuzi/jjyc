const axios = require('axios')

/**
 * 获取基金实时估值
 * @param {string} code 基金代码
 * @returns {Promise<object>} 基金估值数据
 */
async function getFundEstimate(code) {
  const url = `http://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`
  
  const response = await axios.get(url, {
    headers: {
      'Referer': 'http://fund.eastmoney.com/'
    },
    responseType: 'text'
  })
  
  // 解析 JSONP 响应: jsonpgz({...})
  const jsonStr = response.data.replace(/^jsonpgz\(/, '').replace(/\);?$/, '')
  const data = JSON.parse(jsonStr)
  
  // 修正日期格式(天天基金可能返回错误的年份)
  let estimateTime = data.gztime || ''
  let netWorthDate = data.jzrq || ''
  
  // 如果年份是 2026 或其他未来年份,修正为当前年份
  const currentYear = new Date().getFullYear()
  estimateTime = estimateTime.replace(/^202[6-9]/, currentYear.toString())
  netWorthDate = netWorthDate.replace(/^202[6-9]/, currentYear.toString())
  
  return {
    code: data.fundcode,       // 基金代码
    name: data.name,           // 基金名称
    netWorth: data.dwjz,       // 单位净值
    netWorthDate: netWorthDate, // 净值日期
    estimate: data.gsz,        // 估算值
    estimateGrowth: data.gszzl, // 估算涨跌幅(%)
    estimateTime: estimateTime  // 估值时间
  }
}

/**
 * 获取基金持仓信息
 * @param {string} code 基金代码
 * @returns {Promise<Array>} 基金持仓数据
 */
async function getFundHoldings(code) {
  try {
    const url = 'http://fundf10.eastmoney.com/FundArchivesDatas.aspx'
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    
    // 确定最近的季度
    let quarters = []
    if (currentMonth >= 10) {
      quarters = [
        { year: currentYear, month: '9' },
        { year: currentYear, month: '6' },
        { year: currentYear, month: '3' }
      ]
    } else if (currentMonth >= 7) {
      quarters = [
        { year: currentYear, month: '6' },
        { year: currentYear, month: '3' },
        { year: currentYear - 1, month: '12' }
      ]
    } else if (currentMonth >= 4) {
      quarters = [
        { year: currentYear, month: '3' },
        { year: currentYear - 1, month: '12' },
        { year: currentYear - 1, month: '9' }
      ]
    } else {
      quarters = [
        { year: currentYear - 1, month: '12' },
        { year: currentYear - 1, month: '9' },
        { year: currentYear - 1, month: '6' }
      ]
    }
    
    for (const quarter of quarters) {
      try {
        const response = await axios.get(url, {
          params: {
            type: 'jjcc',
            code: code,
            topline: 10,
            year: quarter.year,
            month: quarter.month
          },
          headers: {
            'Referer': `http://fundf10.eastmoney.com/ccmx_${code}.html`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 8000
        })
        
        const html = response.data
        
        // 检查是否有数据
        if (!html || html.includes('暂无数据') || html.length < 100) {
          continue
        }
        
        // 解析 HTML 获取持仓数据 - 使用更精确的正则
        const holdings = []
        
        // 匹配表格行: <tr>...</tr>
        const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
        const matches = html.match(trRegex)
        
        if (matches && matches.length > 0) {
          for (const tr of matches) {
            // 跳过表头
            if (tr.includes('<th') || tr.includes('序号')) continue
            
            // 提取股票代码
            const codeMatch = tr.match(/<a[^>]*>(\d{6})<\/a>/)
            if (!codeMatch) continue
            const stockCode = codeMatch[1]
            
            // 提取股票名称
            const nameMatch = tr.match(/<a[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*>\d{6}<\/a>/)
            if (!nameMatch) continue
            const stockName = nameMatch[1]
            
            // 提取持仓占比 (占净值比例)
            const tdMatches = tr.match(/<td[^>]*>([^<]+)<\/td>/g)
            if (!tdMatches || tdMatches.length < 7) continue
            
            // 第7个td是占净值比例
            const ratioTd = tdMatches[6]
            const ratioMatch = ratioTd.match(/>([0-9.]+)%?</)
            if (!ratioMatch) continue
            
            const holdingRatio = parseFloat(ratioMatch[1])
            
            holdings.push({
              stock_code: stockCode,
              stock_name: stockName,
              holding_ratio: holdingRatio
            })
            
            // 只取前10个
            if (holdings.length >= 10) break
          }
        }
        
        // 如果获取到数据就返回
        if (holdings.length > 0) {
          console.log(`成功获取基金 ${code} 的 ${holdings.length} 条持仓数据`)
          return holdings
        }
      } catch (err) {
        console.error(`获取基金 ${code} 第 ${quarter.year}-${quarter.month} 季度持仓失败:`, err.message)
        continue
      }
    }
    
    console.warn(`基金 ${code} 未找到持仓数据`)
    return []
  } catch (error) {
    console.error(`获取基金 ${code} 持仓失败:`, error.message)
    return []
  }
}

/**
 * 批量获取基金估值
 * @param {string[]} codes 基金代码数组
 * @returns {Promise<object[]>} 基金估值数据数组
 */
async function getBatchFundEstimate(codes) {
  const results = await Promise.allSettled(
    codes.map(code => getFundEstimate(code))
  )
  
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
}

module.exports = {
  getFundEstimate,
  getFundHoldings,
  getBatchFundEstimate
}
