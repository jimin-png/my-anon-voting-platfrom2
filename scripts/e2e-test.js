/**
 * E2E 테스트 스크립트 (20회 연속)
 * 
 * 6주차 요구사항: e2e 20회 무중단
 * 
 * 사용법: npm run test:e2e
 */

require('dotenv').config({ path: '.env' })
const axios = require('axios')

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api'
const NUM_ITERATIONS = 20

// 테스트 결과 추적
const results = {
  passed: 0,
  failed: 0,
  errors: []
}

function logIteration(iteration, passed, message) {
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} 반복 ${iteration}/${NUM_ITERATIONS}: ${passed ? 'PASS' : 'FAIL'}`)
  if (message) console.log(`   ${message}`)
  
  if (passed) {
    results.passed++
  } else {
    results.failed++
    results.errors.push({ iteration, message })
  }
}

async function runE2ETest(iteration) {
  try {
    // 1. Health Check
    const healthRes = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 })
    if (healthRes.status !== 200) {
      throw new Error(`Health check failed: ${healthRes.status}`)
    }

    // 2. 투표 생성
    const pollRes = await axios.post(`${API_BASE_URL}/polls`, {
      creatorWallet: `0x${iteration.toString().padStart(40, '0')}`,
      title: `E2E Test Poll ${iteration}`,
      description: `E2E Test Description ${iteration}`,
      candidates: [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' }
      ],
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString()
    }, { timeout: 10000 })

    if (pollRes.status !== 201 || !pollRes.data.success) {
      throw new Error(`Poll creation failed: ${pollRes.status}`)
    }

    const pollId = pollRes.data.data.pollId

    // 3. 공개 정보 조회
    const publicRes = await axios.get(`${API_BASE_URL}/polls/${pollId}/public`, { timeout: 5000 })
    if (publicRes.status !== 200 || !publicRes.data.success) {
      throw new Error(`Public info fetch failed: ${publicRes.status}`)
    }

    // 4. 사용자 등록
    const registerRes = await axios.post(`${API_BASE_URL}/user/register`, {
      name: `E2E User ${iteration}`,
      walletAddress: `0x${(iteration + 1000).toString().padStart(40, '0')}`,
      studentId: `2024${String(iteration).padStart(4, '0')}`
    }, { timeout: 10000 })

    if (registerRes.status !== 201 || !registerRes.data.success) {
      throw new Error(`User registration failed: ${registerRes.status}`)
    }

    const voterId = registerRes.data.data._id

    // 5. 투표 생성
    const voteRes = await axios.post(`${API_BASE_URL}/vote/create`, {
      walletAddress: `0x${(iteration + 1000).toString().padStart(40, '0')}`,
      candidate: 'Option 1',
      pollId,
      nullifierHash: `e2e-nullifier-${iteration}`
    }, { timeout: 10000 })

    if (voteRes.status !== 200 && voteRes.status !== 201) {
      throw new Error(`Vote creation failed: ${voteRes.status}`)
    }

    // 6. 결과 조회
    const resultsRes = await axios.get(`${API_BASE_URL}/polls/${pollId}/results`, { timeout: 10000 })
    if (resultsRes.status !== 200 || !resultsRes.data.success) {
      throw new Error(`Results fetch failed: ${resultsRes.status}`)
    }

    // 7. Metrics 확인
    const metricsRes = await axios.get(`${API_BASE_URL}/metrics`, { timeout: 5000 })
    if (metricsRes.status !== 200) {
      throw new Error(`Metrics fetch failed: ${metricsRes.status}`)
    }

    return true
  } catch (error) {
    // 상세한 에러 메시지
    let message = error.message
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      message = `서버에 연결할 수 없습니다.\n   해결 방법: 다른 터미널에서 "npm run dev" 실행 후 다시 시도하세요.\n   API URL: ${API_BASE_URL}`
    } else if (error.response) {
      message = `HTTP ${error.response.status}: ${error.response.data?.message || error.message}`
    }
    throw new Error(message)
  }
}

async function runAllTests() {
  console.log('🚀 E2E 테스트 시작 (20회 연속)')
  console.log(`API Base URL: ${API_BASE_URL}`)
  console.log(`\n💡 중요: 테스트 전에 서버가 실행 중이어야 합니다!`)
  console.log(`   다른 터미널에서 "npm run dev" 실행 후 이 테스트를 실행하세요.\n`)

  for (let i = 1; i <= NUM_ITERATIONS; i++) {
    try {
      const passed = await runE2ETest(i)
      logIteration(i, passed, passed ? '모든 단계 통과' : '')
      
      // 짧은 대기 (서버 부하 방지)
      if (i < NUM_ITERATIONS) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      logIteration(i, false, error.message)
    }
  }

  // 결과 요약
  console.log('\n' + '='.repeat(50))
  console.log('📊 E2E 테스트 결과 요약')
  console.log('='.repeat(50))
  console.log(`✅ 통과: ${results.passed}회`)
  console.log(`❌ 실패: ${results.failed}회`)
  console.log(`📈 성공률: ${((results.passed / NUM_ITERATIONS) * 100).toFixed(1)}%`)

  if (results.errors.length > 0) {
    console.log('\n❌ 실패한 반복:')
    results.errors.forEach(({ iteration, message }) => {
      console.log(`   반복 ${iteration}: ${message}`)
    })
  }

  if (results.failed === 0) {
    console.log('\n🎉 모든 테스트 통과! (20회 연속 무중단)')
    process.exit(0)
  } else {
    console.log(`\n⚠️ ${results.failed}회 실패 (연속 통과 실패)`)
    process.exit(1)
  }
}

runAllTests().catch(error => {
  console.error('❌ 테스트 실행 오류:', error)
  process.exit(1)
})

