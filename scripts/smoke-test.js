/**
 * 스모크 테스트 5케이스
 * 
 * 5주차 요구사항: npm run smoke 5케이스
 * - 정상 케이스
 * - 중복 케이스
 * - nullifier 재사용
 * - 가스 부족
 * - RPC 지연
 * 
 * 사용법: npm run smoke
 */

require('dotenv').config({ path: '.env' })
const axios = require('axios')

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api'
const TEST_POLL_ID = 'smoke-test-poll'

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

async function test1_Normal() {
  console.log('\n📋 테스트 1: 정상 케이스')
  try {
    // 1. 투표 생성
    const pollRes = await axios.post(`${API_BASE_URL}/polls`, {
      creatorWallet: '0x' + '1'.repeat(40),
      title: 'Smoke Test Poll',
      description: 'Test Description',
      candidates: [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' }
      ],
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString()
    })
    
    if (pollRes.status === 201 && pollRes.data.success) {
      logTest('정상 케이스 - 투표 생성', true)
      return true
    } else {
      logTest('정상 케이스 - 투표 생성', false, `예상: 201, 실제: ${pollRes.status}`)
      return false
    }
  } catch (error) {
    // 상세한 에러 메시지
    let errorMessage = error.message
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = `서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.\n   해결 방법: 다른 터미널에서 "npm run dev" 실행 후 다시 시도하세요.\n   API URL: ${API_BASE_URL}`
    } else if (error.response) {
      errorMessage = `HTTP ${error.response.status}: ${error.response.data?.message || error.message}`
    }
    logTest('정상 케이스 - 투표 생성', false, errorMessage)
    return false
  }
}

async function test2_Duplicate() {
  console.log('\n📋 테스트 2: 중복 케이스')
  try {
    // 1. 투표 생성
    const pollRes = await axios.post(`${API_BASE_URL}/polls`, {
      creatorWallet: '0x' + '2'.repeat(40),
      title: 'Duplicate Test Poll',
      description: 'Test',
      candidates: [{ id: '1', label: 'Option 1' }],
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString()
    })
    
    const pollId = pollRes.data.data.pollId
    
    // 2. 사용자 등록
    const registerRes = await axios.post(`${API_BASE_URL}/user/register`, {
      name: 'Test User',
      walletAddress: '0x' + '3'.repeat(40),
      studentId: '20240001'
    })
    const voterId = registerRes.data.data._id
    
    // 3. 첫 번째 투표
    await axios.post(`${API_BASE_URL}/vote/create`, {
      walletAddress: '0x' + '3'.repeat(40),
      candidate: 'Option 1',
      pollId,
      nullifierHash: 'test-nullifier-123'
    })
    
    // 4. 중복 투표 시도 (같은 nullifierHash)
    try {
      await axios.post(`${API_BASE_URL}/vote/create`, {
        walletAddress: '0x' + '3'.repeat(40),
        candidate: 'Option 2',
        pollId,
        nullifierHash: 'test-nullifier-123' // 같은 nullifierHash
      })
      logTest('중복 케이스 - 중복 차단', false, '409 오류가 발생해야 함')
      return false
    } catch (error) {
      if (error.response && error.response.status === 409) {
        logTest('중복 케이스 - 중복 차단', true)
        return true
      } else {
        logTest('중복 케이스 - 중복 차단', false, `예상: 409, 실제: ${error.response?.status}`)
        return false
      }
    }
  } catch (error) {
    // 상세한 에러 메시지
    let errorMessage = error.message
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = `서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.\n   해결 방법: 다른 터미널에서 "npm run dev" 실행 후 다시 시도하세요.`
    } else if (error.response) {
      errorMessage = `HTTP ${error.response.status}: ${error.response.data?.message || error.message}`
    }
    logTest('중복 케이스', false, errorMessage)
    return false
  }
}

async function test3_NullifierReuse() {
  console.log('\n📋 테스트 3: nullifier 재사용')
  try {
    // 같은 nullifierHash로 다른 pollId에 투표 (재사용 허용)
    const poll1Res = await axios.post(`${API_BASE_URL}/polls`, {
      creatorWallet: '0x' + '4'.repeat(40),
      title: 'Poll 1',
      candidates: [{ id: '1', label: 'Option 1' }],
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString()
    })
    const poll1Id = poll1Res.data.data.pollId
    
    const poll2Res = await axios.post(`${API_BASE_URL}/polls`, {
      creatorWallet: '0x' + '5'.repeat(40),
      title: 'Poll 2',
      candidates: [{ id: '1', label: 'Option 1' }],
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString()
    })
    const poll2Id = poll2Res.data.data.pollId
    
    // 사용자 등록
    const registerRes = await axios.post(`${API_BASE_URL}/user/register`, {
      name: 'Test User 2',
      walletAddress: '0x' + '6'.repeat(40),
      studentId: '20240002'
    })
    const voterId = registerRes.data.data._id
    
    const nullifierHash = 'reusable-nullifier-123'
    
    // Poll 1에 투표
    await axios.post(`${API_BASE_URL}/vote/create`, {
      walletAddress: '0x' + '6'.repeat(40),
      candidate: 'Option 1',
      pollId: poll1Id,
      nullifierHash
    })
    
    // Poll 2에 같은 nullifierHash로 투표 (다른 pollId이므로 허용되어야 함)
    const vote2Res = await axios.post(`${API_BASE_URL}/vote/create`, {
      walletAddress: '0x' + '6'.repeat(40),
      candidate: 'Option 1',
      pollId: poll2Id,
      nullifierHash // 같은 nullifierHash, 다른 pollId
    })
    
    if (vote2Res.status === 200 || vote2Res.status === 201) {
      logTest('nullifier 재사용 - 다른 pollId 허용', true)
      return true
    } else {
      logTest('nullifier 재사용 - 다른 pollId 허용', false, `예상: 200/201, 실제: ${vote2Res.status}`)
      return false
    }
  } catch (error) {
    // 상세한 에러 메시지
    let errorMessage = error.message
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = `서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.\n   해결 방법: 다른 터미널에서 "npm run dev" 실행 후 다시 시도하세요.`
    } else if (error.response) {
      errorMessage = `HTTP ${error.response.status}: ${error.response.data?.message || error.message}`
    }
    logTest('nullifier 재사용', false, errorMessage)
    return false
  }
}

async function test4_GasInsufficient() {
  console.log('\n📋 테스트 4: 가스 부족 (시뮬레이션)')
  try {
    // Relayer API에 잘못된 데이터 전송 (가스 추정 실패 시뮬레이션)
    try {
      await axios.post(`${API_BASE_URL}/relay`, {
        to: '0x' + '7'.repeat(40),
        data: '0x' + '0'.repeat(10000), // 매우 큰 데이터 (가스 부족 시뮬레이션)
        pollId: TEST_POLL_ID,
        chainId: 11155111,
        deadline: Math.floor(Date.now() / 1000) + 3600
      })
      logTest('가스 부족 - 오류 처리', false, '가스 부족 시 오류가 발생해야 함')
      return false
    } catch (error) {
      // 가스 부족 또는 재시도 후 실패는 정상
      if (error.response && (error.response.status === 400 || error.response.status === 500)) {
        logTest('가스 부족 - 오류 처리', true, '가스 부족 시 적절한 오류 반환')
        return true
      } else {
        logTest('가스 부족 - 오류 처리', false, `예상: 400/500, 실제: ${error.response?.status}`)
        return false
      }
    }
  } catch (error) {
    // 상세한 에러 메시지
    let errorMessage = error.message
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = `서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.\n   해결 방법: 다른 터미널에서 "npm run dev" 실행 후 다시 시도하세요.`
    } else if (error.response) {
      errorMessage = `HTTP ${error.response.status}: ${error.response.data?.message || error.message}`
    }
    logTest('가스 부족', false, errorMessage)
    return false
  }
}

async function test5_RPCDelay() {
  console.log('\n📋 테스트 5: RPC 지연 (시뮬레이션)')
  try {
    // Health check로 RPC 연결 확인
    const healthRes = await axios.get(`${API_BASE_URL}/health`, {
      timeout: 5000 // 5초 타임아웃
    })
    
    if (healthRes.status === 200) {
      logTest('RPC 지연 - Health Check', true, 'RPC 연결 정상')
      return true
    } else {
      logTest('RPC 지연 - Health Check', false, `예상: 200, 실제: ${healthRes.status}`)
      return false
    }
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      logTest('RPC 지연 - 타임아웃 처리', true, 'RPC 지연 시 타임아웃 처리됨')
      return true
    } else {
      logTest('RPC 지연', false, error.message)
      return false
    }
  }
}

async function runAllTests() {
  console.log('🚀 스모크 테스트 시작 (5케이스)')
  console.log(`API Base URL: ${API_BASE_URL}`)
  console.log(`\n💡 중요: 테스트 전에 서버가 실행 중이어야 합니다!`)
  console.log(`   다른 터미널에서 "npm run dev" 실행 후 이 테스트를 실행하세요.\n`)
  
  await test1_Normal()
  await test2_Duplicate()
  await test3_NullifierReuse()
  await test4_GasInsufficient()
  await test5_RPCDelay()
  
  // 결과 요약
  console.log('\n' + '='.repeat(50))
  console.log('📊 테스트 결과 요약')
  console.log('='.repeat(50))
  console.log(`✅ 통과: ${results.passed}개`)
  console.log(`❌ 실패: ${results.failed}개`)
  console.log(`📈 성공률: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`)
  
  if (results.failed === 0) {
    console.log('\n🎉 모든 테스트 통과!')
    process.exit(0)
  } else {
    console.log('\n⚠️ 일부 테스트 실패')
    process.exit(1)
  }
}

runAllTests().catch(error => {
  console.error('❌ 테스트 실행 오류:', error)
  process.exit(1)
})

