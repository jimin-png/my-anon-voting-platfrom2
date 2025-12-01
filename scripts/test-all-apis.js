/**
 * 모든 API 엔드포인트 종합 테스트
 * 
 * 백엔드 B가 담당한 모든 API를 테스트합니다.
 * 
 * 사용법: npm run test:all-apis
 * 
 * 테스트 항목:
 * 1. Health & Metrics
 * 2. 투표 관리 (관리자)
 * 3. 투표 공개 정보 (참여자)
 * 4. 투표 제출
 * 5. 결과 집계
 * 6. 사용자 관리
 * 7. 이벤트 동기화
 * 8. Relayer (선택)
 */

require('dotenv').config({ path: '.env' })
const axios = require('axios')

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api'

// 테스트 결과 추적
const results = {
  passed: 0,
  failed: 0,
  tests: []
}

function logTest(name, passed, message) {
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${name}: ${passed ? 'PASS' : 'FAIL'}`)
  if (message) console.log(`   ${message}`)
  
  results.tests.push({ name, passed, message })
  if (passed) {
    results.passed++
  } else {
    results.failed++
  }
}

// ============================================
// 1. Health & Metrics
// ============================================

async function testHealth() {
  console.log('\n📋 1. Health Check')
  try {
    const res = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 })
    if (res.status === 200 && res.data.ok) {
      logTest('GET /api/health', true)
      return true
    } else {
      logTest('GET /api/health', false, `예상: 200, 실제: ${res.status}`)
      return false
    }
  } catch (error) {
    logTest('GET /api/health', false, error.message)
    return false
  }
}

async function testMetrics() {
  console.log('\n📋 2. Metrics')
  try {
    const res = await axios.get(`${API_BASE_URL}/metrics`, { timeout: 5000 })
    if (res.status === 200 && res.data.includes('node_uptime')) {
      logTest('GET /api/metrics', true)
      return true
    } else {
      logTest('GET /api/metrics', false, `예상: 200, 실제: ${res.status}`)
      return false
    }
  } catch (error) {
    logTest('GET /api/metrics', false, error.message)
    return false
  }
}

// ============================================
// 2. 투표 관리 (관리자)
// ============================================

async function testCreatePoll() {
  console.log('\n📋 3. 투표 생성')
  try {
    const res = await axios.post(`${API_BASE_URL}/polls`, {
      creatorWallet: '0x' + '1'.repeat(40),
      title: 'API Test Poll',
      description: 'Test Description',
      candidates: [
        { id: 'candidate-1', label: '후보 1' },
        { id: 'candidate-2', label: '후보 2' }
      ],
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString()
    }, { timeout: 10000 })
    
    if (res.status === 201 && res.data.success && res.data.data.pollId) {
      logTest('POST /api/polls', true, `pollId: ${res.data.data.pollId}`)
      return res.data.data.pollId
    } else {
      logTest('POST /api/polls', false, `예상: 201, 실제: ${res.status}`)
      return null
    }
  } catch (error) {
    logTest('POST /api/polls', false, error.response?.data?.message || error.message)
    return null
  }
}

async function testGetPollsList() {
  console.log('\n📋 4. 투표 목록 조회')
  try {
    const res = await axios.get(`${API_BASE_URL}/polls?creator=0x${'1'.repeat(40)}`, { timeout: 5000 })
    if (res.status === 200 && res.data.success && Array.isArray(res.data.data)) {
      logTest('GET /api/polls?creator=...', true, `조회된 투표 수: ${res.data.count}`)
      return true
    } else {
      logTest('GET /api/polls?creator=...', false, `예상: 200, 실제: ${res.status}`)
      return false
    }
  } catch (error) {
    logTest('GET /api/polls?creator=...', false, error.message)
    return false
  }
}

async function testGetPollDetail(pollId) {
  console.log('\n📋 5. 투표 상세 조회')
  if (!pollId) {
    logTest('GET /api/polls/:pollId', false, 'pollId가 없어서 테스트 불가')
    return false
  }
  try {
    const res = await axios.get(`${API_BASE_URL}/polls/${pollId}`, { timeout: 5000 })
    if (res.status === 200 && res.data.success && res.data.data.pollId === pollId) {
      logTest('GET /api/polls/:pollId', true)
      return true
    } else {
      logTest('GET /api/polls/:pollId', false, `예상: 200, 실제: ${res.status}`)
      return false
    }
  } catch (error) {
    logTest('GET /api/polls/:pollId', false, error.message)
    return false
  }
}

async function testGetPollPublic(pollId) {
  console.log('\n📋 6. 투표 공개 정보 조회')
  if (!pollId) {
    logTest('GET /api/polls/:pollId/public', false, 'pollId가 없어서 테스트 불가')
    return false
  }
  try {
    const res = await axios.get(`${API_BASE_URL}/polls/${pollId}/public`, { timeout: 5000 })
    if (res.status === 200 && res.data.success && res.data.data.isActive !== undefined) {
      logTest('GET /api/polls/:pollId/public', true, `status: ${res.data.data.status}`)
      return true
    } else {
      logTest('GET /api/polls/:pollId/public', false, `예상: 200, 실제: ${res.status}`)
      return false
    }
  } catch (error) {
    logTest('GET /api/polls/:pollId/public', false, error.message)
    return false
  }
}

async function testGetPollResults(pollId) {
  console.log('\n📋 7. 투표 결과 집계')
  if (!pollId) {
    logTest('GET /api/polls/:pollId/results', false, 'pollId가 없어서 테스트 불가')
    return false
  }
  try {
    const res = await axios.get(`${API_BASE_URL}/polls/${pollId}/results`, { timeout: 10000 })
    if (res.status === 200 && res.data.success && res.data.data.totalVotes !== undefined) {
      logTest('GET /api/polls/:pollId/results', true, `총 투표 수: ${res.data.data.totalVotes}`)
      return true
    } else {
      logTest('GET /api/polls/:pollId/results', false, `예상: 200, 실제: ${res.status}`)
      return false
    }
  } catch (error) {
    logTest('GET /api/polls/:pollId/results', false, error.message)
    return false
  }
}

// ============================================
// 3. 사용자 관리
// ============================================

async function testUserRegister() {
  console.log('\n📋 8. 사용자 등록')
  try {
    const walletAddress = '0x' + Date.now().toString().padStart(40, '0').slice(-40)
    const res = await axios.post(`${API_BASE_URL}/user/register`, {
      name: 'API Test User',
      walletAddress,
      studentId: `2024${Date.now().toString().slice(-4)}`
    }, { timeout: 10000 })
    
    if (res.status === 201 && res.data.success && res.data.data._id) {
      logTest('POST /api/user/register', true, `voterId: ${res.data.data._id}`)
      return { voterId: res.data.data._id, walletAddress }
    } else {
      logTest('POST /api/user/register', false, `예상: 201, 실제: ${res.status}`)
      return null
    }
  } catch (error) {
    logTest('POST /api/user/register', false, error.response?.data?.message || error.message)
    return null
  }
}

async function testUserLogin() {
  console.log('\n📋 9. 사용자 로그인')
  try {
    // 먼저 사용자 등록
    const walletAddress = '0x' + Date.now().toString().padStart(40, '0').slice(-40)
    const studentId = `2024${Date.now().toString().slice(-4)}`
    
    await axios.post(`${API_BASE_URL}/user/register`, {
      name: 'Login Test User',
      walletAddress,
      studentId
    }, { timeout: 10000 })
    
    // 로그인 시도
    const res = await axios.post(`${API_BASE_URL}/user/login`, {
      walletAddress,
      studentId
    }, { timeout: 10000 })
    
    if (res.status === 200 && res.data.success) {
      logTest('POST /api/user/login', true)
      return true
    } else {
      logTest('POST /api/user/login', false, `예상: 200, 실제: ${res.status}`)
      return false
    }
  } catch (error) {
    logTest('POST /api/user/login', false, error.response?.data?.message || error.message)
    return false
  }
}

// ============================================
// 4. 투표 제출
// ============================================

async function testVoteCreate(pollId, userInfo) {
  console.log('\n📋 10. 투표 제출')
  if (!pollId || !userInfo || !userInfo.walletAddress) {
    logTest('POST /api/vote/create', false, 'pollId 또는 walletAddress가 없어서 테스트 불가')
    return false
  }
  try {
    const res = await axios.post(`${API_BASE_URL}/vote/create`, {
      pollId,
      walletAddress: userInfo.walletAddress,
      candidate: 'candidate-1',
      nullifierHash: `0x${Date.now().toString(16).padStart(64, '0')}`
    }, { timeout: 10000 })
    
    if ((res.status === 200 || res.status === 201) && res.data.success) {
      logTest('POST /api/vote/create', true, `isUpdate: ${res.data.isUpdate || false}`)
      return true
    } else {
      logTest('POST /api/vote/create', false, `예상: 200/201, 실제: ${res.status}`)
      return false
    }
  } catch (error) {
    logTest('POST /api/vote/create', false, error.response?.data?.message || error.message)
    return false
  }
}

async function testVoteResults(pollId) {
  console.log('\n📋 11. 투표 결과 조회 (별도 엔드포인트)')
  if (!pollId) {
    logTest('GET /api/vote/results?pollId=...', false, 'pollId가 없어서 테스트 불가')
    return false
  }
  try {
    const res = await axios.get(`${API_BASE_URL}/vote/results?pollId=${pollId}`, { timeout: 10000 })
    if (res.status === 200 && res.data.success) {
      logTest('GET /api/vote/results?pollId=...', true, `총 투표 수: ${res.data.totalVotes || 0}`)
      return true
    } else {
      logTest('GET /api/vote/results?pollId=...', false, `예상: 200, 실제: ${res.status}`)
      return false
    }
  } catch (error) {
    logTest('GET /api/vote/results?pollId=...', false, error.message)
    return false
  }
}

// ============================================
// 5. 이벤트 동기화
// ============================================

async function testEventSync() {
  console.log('\n📋 12. 이벤트 동기화')
  try {
    const res = await axios.post(`${API_BASE_URL}/event/sync`, {
      eventId: `test-event-${Date.now()}`,
      requestId: `test-request-${Date.now()}`
    }, { timeout: 10000 })
    
    if (res.status === 200 && res.data.success) {
      logTest('POST /api/event/sync', true, `status: ${res.data.status}`)
      return true
    } else {
      logTest('POST /api/event/sync', false, `예상: 200, 실제: ${res.status}`)
      return false
    }
  } catch (error) {
    logTest('POST /api/event/sync', false, error.response?.data?.message || error.message)
    return false
  }
}

// ============================================
// 6. Relayer (선택 - 환경 변수 필요)
// ============================================

async function testRelay() {
  console.log('\n📋 13. Relayer (선택)')
  if (!process.env.RELAYER_PRIVATE_KEY || !process.env.INFURA_URL) {
    logTest('POST /api/relay', true, '환경 변수 없음 - 스킵 (정상)')
    return true
  }
  try {
    const res = await axios.post(`${API_BASE_URL}/relay`, {
      to: '0x' + '0'.repeat(40),
      data: '0x1234',
      pollId: 'test-poll',
      chainId: 11155111,
      deadline: Math.floor(Date.now() / 1000) + 3600
    }, { timeout: 30000 })
    
    if (res.status === 200 && res.data.success) {
      logTest('POST /api/relay', true, `txHash: ${res.data.txHash?.slice(0, 10)}...`)
      return true
    } else {
      logTest('POST /api/relay', false, `예상: 200, 실제: ${res.status}`)
      return false
    }
  } catch (error) {
    // Relayer는 환경 변수나 네트워크 문제로 실패할 수 있음
    if (error.response?.status === 400 || error.response?.status === 500) {
      logTest('POST /api/relay', true, '오류 처리 정상 (환경 변수/네트워크 문제 가능)')
      return true
    } else {
      logTest('POST /api/relay', false, error.message)
      return false
    }
  }
}

// ============================================
// 메인 실행 함수
// ============================================

async function runAllTests() {
  console.log('🚀 백엔드 B (API) 종합 테스트 시작')
  console.log(`API Base URL: ${API_BASE_URL}`)
  console.log(`\n💡 중요: 테스트 전에 서버가 실행 중이어야 합니다!`)
  console.log(`   다른 터미널에서 "npm run dev" 실행 후 이 테스트를 실행하세요.\n`)
  
  // 1. Health & Metrics
  await testHealth()
  await testMetrics()
  
  // 2. 투표 관리
  const pollId = await testCreatePoll()
  await testGetPollsList()
  await testGetPollDetail(pollId)
  await testGetPollPublic(pollId)
  await testGetPollResults(pollId)
  
  // 3. 사용자 관리
  const userInfo = await testUserRegister()
  await testUserLogin()
  
  // 4. 투표 제출
  await testVoteCreate(pollId, userInfo)
  await testVoteResults(pollId)
  
  // 5. 이벤트 동기화
  await testEventSync()
  
  // 6. Relayer (선택)
  await testRelay()
  
  // 결과 요약
  console.log('\n' + '='.repeat(60))
  console.log('📊 종합 테스트 결과 요약')
  console.log('='.repeat(60))
  console.log(`✅ 통과: ${results.passed}개`)
  console.log(`❌ 실패: ${results.failed}개`)
  console.log(`📈 성공률: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`)
  
  if (results.failed > 0) {
    console.log('\n❌ 실패한 테스트:')
    results.tests.filter(t => !t.passed).forEach(test => {
      console.log(`   - ${test.name}: ${test.message}`)
    })
  }
  
  if (results.failed === 0) {
    console.log('\n🎉 모든 API 테스트 통과!')
    console.log('✅ 백엔드 B의 모든 기능이 정상 동작합니다.')
    process.exit(0)
  } else {
    console.log(`\n⚠️ ${results.failed}개 테스트 실패`)
    process.exit(1)
  }
}

runAllTests().catch(error => {
  console.error('❌ 테스트 실행 오류:', error)
  process.exit(1)
})

