// 基金数据抓取服务
const axios = require('axios')

/**
 * 获取基金实时估值
 * @param {string} code 基金代码
 * @returns {Promise<object>} 基金估值数据
 */
async function getFundEstimate(code) {
  const url = `http://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`

  const response = await axios.get(url, {
    headers: { Referer: 'http://fund.eastmoney.com/' },
    responseType: 'text',
    timeout: 10000
  })

  // 解析 JSONP 响应
  const jsonStr = response.data.replace(/^jsonpgz\(/, '').replace(/\);?$/, '')
  const data = JSON.parse(jsonStr)

  const currentYear = new Date().getFullYear()
  let estimateTime = (data.gztime || '').replace(/^202[6-9]/, currentYear.toString())
  let netWorthDate = (data.jzrq || '').replace(/^202[6-9]/, currentYear.toString())

  return {
    code: data.fundcode,
    name: data.name,
    netWorth: data.dwjz,
    netWorthDate,
    estimate: data.gsz,
    estimateGrowth: data.gszzl,
    estimateTime
  }
}

/**
 * 批量获取基金估值
 */
async function getBatchFundEstimate(codes) {
  const results = await Promise.allSettled(
    codes.map((code) => getFundEstimate(code))
  )
  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
}

module.exports = { getFundEstimate, getBatchFundEstimate }
