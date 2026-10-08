const BASE = 'https://nftoken.zone.id'

async function generateSingleToken() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  try {
    const res = await fetch(`${BASE}/api/auto-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Referer': `${BASE}/`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({}),
      signal: controller.signal
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HTTP ${res.status}: ${text}`)
    }

    const data = await res.json()

    if (!data.success || !data.token) {
      throw new Error(data.error || 'Server returned invalid response')
    }

    const encodedToken = encodeURIComponent(data.token)

    return {
      success: true,
      token: data.token,
      expiry: data.expiry || '—',
      type: data.type || 'cookie',
      country: data.profile?.country || '—',
      plan: data.profile?.plan || 'Premium',
      links: {
        pc: `https://netflix.com/?nftoken=${encodedToken}`,
         android: `https://netflix.com/unsupported?nftoken=${encodedToken}`,
         tv: `https://netflix.com/tv2?nftoken=${encodedToken}`,
         tv8: `https://netflix.com/tv8?nftoken=${encodedToken}`
      }
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function generateTokenWithRetry(maxRetries = 3) {
  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateSingleToken()

      if (result.success) {
        return result
      }

      lastError = result.error
    } catch (error) {
      lastError = error.message
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return {
    success: false,
    error: lastError || 'Failed after 3 attempts'
  }
}

async function generateTokens(count = 1) {
  const total = Math.min(
    Math.max(parseInt(count) || 1, 1),
    5
  )

  const results = []

  for (let i = 0; i < total; i++) {
    const result = await generateTokenWithRetry(3)

    if (result.success) {
      results.push(result)
    }

    if (i < total - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  if (results.length === 0) {
    return {
      creator: 'Henkaramazov',
      status: false,
      msg: 'Failed to generate any tokens'
    }
  }

  return {
    creator: 'Henkaramazov',
    status: true,
    data: results
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  )
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      msg: 'Method Not Allowed'
    })
  }

  try {
    let count = 1

    if (req.method === 'GET') {
      count = req.query.count || 1
    }

    if (req.method === 'POST') {
      count = req.body?.count || 1
    }

    const result = await generateTokens(count)

    return res.status(result.status ? 200 : 500).json(result)

  } catch (error) {
    return res.status(500).json({
      creator: 'Henkaramazov',
      status: false,
      msg: error.message || 'Internal Server Error'
    })
  }
    }
