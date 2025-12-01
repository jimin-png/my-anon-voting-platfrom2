/**
 * 혼합 100건 집계 테스트 스크립트
 *
 * 사용법:
 * 1. .env 파일에 DB_URI 설정
 * 2. npm run test:100 또는 node test-100-votes.js
 *
 * 테스트 내용:
 * - 100건 투표 생성 (일부 재투표 포함)
 * - 재투표가 제외되어 50건만 집계되는지 확인
 */

require('dotenv').config({ path: '.env' })
const mongoose = require('mongoose')

// ============================================
// 환경 변수 확인
// ============================================
const DB_URI = process.env.DB_URI
if (!DB_URI) {
  console.error('❌ 오류: DB_URI 환경 변수가 설정되지 않았습니다.')
  console.error('💡 해결 방법:')
  console.error('   1. .env 파일을 생성하세요')
  console.error('   2. DB_URI=mongodb+srv://... 형식으로 추가하세요')
  console.error('   3. 또는 env.example 파일을 참고하세요')
  process.exit(1)
}

// ============================================
// Vote 스키마 정의 (테스트용)
// ============================================
const VoteSchema = new mongoose.Schema({
  pollId: { type: String, required: true },
  voter: { type: mongoose.Schema.Types.ObjectId, required: true },
  candidate: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  nullifierHash: { type: String },
})

const Vote = mongoose.models.Vote || mongoose.model('Vote', VoteSchema)

async function test100Votes() {
  try {
    // ============================================
    // DB 연결
    // ============================================
    console.log('🔌 DB 연결 중...')
    await mongoose.connect(DB_URI)
    console.log('✅ DB 연결 성공')

    const pollId = 'test-poll-100'

    // 기존 테스트 데이터 삭제
    await Vote.deleteMany({ pollId })
    console.log('🧹 기존 테스트 데이터 삭제')

    // ============================================
    // 100건 투표 생성 (일부 재투표 포함)
    // ============================================
    // 테스트 시나리오:
    // - 50명의 고유 투표자 (nullifierHash: hash-0 ~ hash-49)
    // - 각 투표자가 2번씩 투표 (재투표 시뮬레이션)
    // - 총 100건의 투표 기록 생성
    // - 집계 시 재투표가 제외되어 50건만 집계되어야 함
    console.log('📝 100건 투표 생성 중...')
    console.log('   테스트 시나리오: 50명이 각각 2번씩 투표 (재투표 포함)')

    const votes = []
    const NUM_VOTERS = 50 // 고유 투표자 수
    const VOTES_PER_VOTER = 2 // 각 투표자당 투표 횟수

    for (let i = 0; i < NUM_VOTERS * VOTES_PER_VOTER; i++) {
      const voterIndex = Math.floor(i / VOTES_PER_VOTER) // 0~49
      const nullifierHash = `hash-${voterIndex}` // 같은 투표자는 같은 nullifierHash 사용
      const candidate = voterIndex % 2 === 0 ? 'Candidate A' : 'Candidate B'

      votes.push({
        pollId,
        candidate,
        nullifierHash,
        voter: new mongoose.Types.ObjectId(),
        timestamp: new Date(Date.now() + i), // 시간 순서 보장 (나중에 투표한 것이 최신)
      })
    }

    console.log(`   - 고유 투표자 수: ${NUM_VOTERS}명`)
    console.log(`   - 각 투표자당 투표 횟수: ${VOTES_PER_VOTER}회`)
    console.log(`   - 총 투표 기록 수: ${votes.length}건`)

    await Vote.insertMany(votes)
    console.log(`✅ ${votes.length}건 투표 생성 완료`)

    // ============================================
    // 실제 DB 저장 확인
    // ============================================
    const actualCount = await Vote.countDocuments({ pollId })
    console.log(`\n🔍 DB 저장 확인:`)
    console.log(`   - 생성한 투표 수: ${votes.length}건`)
    console.log(`   - 실제 DB 저장 수: ${actualCount}건`)

    if (actualCount !== votes.length) {
      console.error(`   ❌ 경고: 생성한 수와 저장된 수가 다릅니다!`)
    } else {
      console.log(`   ✅ 모든 투표가 정상적으로 저장되었습니다.`)
    }

    // ============================================
    // 재투표 상세 분석
    // ============================================
    console.log(`\n📋 재투표 분석:`)
    const nullifierGroups = await Vote.aggregate([
      { $match: { pollId } },
      {
        $group: {
          _id: '$nullifierHash',
          count: { $sum: 1 },
          candidates: { $push: '$candidate' },
          timestamps: { $push: '$timestamp' },
        },
      },
      { $sort: { count: -1 } },
    ])

    const uniqueVoters = nullifierGroups.length
    const totalVotesIncludingRevotes = nullifierGroups.reduce(
      (sum, g) => sum + g.count,
      0
    )
    const revoteCount = nullifierGroups.filter((g) => g.count > 1).length

    console.log(`   - 고유 투표자 수 (nullifierHash 기준): ${uniqueVoters}명`)
    console.log(
      `   - 총 투표 기록 수 (재투표 포함): ${totalVotesIncludingRevotes}건`
    )
    console.log(`   - 재투표한 사람 수: ${revoteCount}명`)

    if (revoteCount > 0) {
      console.log(`\n   재투표 상세:`)
      nullifierGroups
        .filter((g) => g.count > 1)
        .slice(0, 5) // 최대 5개만 표시
        .forEach((g, idx) => {
          console.log(`   ${idx + 1}. nullifierHash: ${g._id}`)
          console.log(`      - 투표 횟수: ${g.count}회`)
          console.log(
            `      - 후보 변경: ${g.candidates[0]} → ${
              g.candidates[g.candidates.length - 1]
            }`
          )
        })
    }

    // ============================================
    // 집계 테스트
    // ============================================
    console.log('\n📊 집계 테스트 시작...')

    const aggregationPipeline = [
      { $match: { pollId } },
      {
        $group: {
          _id: {
            $cond: [
              { $ifNull: ['$nullifierHash', false] },
              '$nullifierHash',
              { $toString: '$voter' },
            ],
          },
          candidate: { $last: '$candidate' },
        },
      },
      {
        $group: {
          _id: '$candidate',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          candidate: '$_id',
          count: 1,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]

    const results = await Vote.aggregate(aggregationPipeline)
    const totalVotes = results.reduce((sum, r) => sum + r.count, 0)

    console.log('\n📈 집계 결과:')
    console.log(JSON.stringify(results, null, 2))

    // ============================================
    // 결과 검증
    // ============================================
    console.log(`\n🔍 검증:`)
    console.log(`   - 실제 DB 저장 수: ${actualCount}건`)
    console.log(`   - 집계된 고유 투표 수: ${totalVotes}건`)
    console.log(`   - 예상 고유 투표 수: ${uniqueVoters}건 (재투표 제외)`)
    console.log(`   - 재투표 제외된 수: ${actualCount - totalVotes}건`)

    // ============================================
    // 테스트 성공/실패 판정
    // ============================================
    console.log(`\n✅ 테스트 결과:`)

    const checks = {
      'DB 저장 확인': actualCount === votes.length,
      '집계 정확성': totalVotes === uniqueVoters,
      '재투표 제외': actualCount > totalVotes,
    }

    let allPassed = true
    for (const [checkName, passed] of Object.entries(checks)) {
      const icon = passed ? '✅' : '❌'
      console.log(`   ${icon} ${checkName}: ${passed ? '통과' : '실패'}`)
      if (!passed) allPassed = false
    }

    if (allPassed) {
      console.log(`\n🎉 모든 테스트 통과!`)
      console.log(`   - 100건 투표가 정상적으로 저장되었습니다.`)
      console.log(
        `   - 재투표가 올바르게 제외되어 ${totalVotes}건만 집계되었습니다.`
      )
    } else {
      console.log(`\n⚠️ 일부 테스트 실패`)
      console.log(`   - 상세 정보를 확인해주세요.`)
    }

    // 정리
    await Vote.deleteMany({ pollId })
    console.log('\n🧹 테스트 데이터 정리 완료')

    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('❌ 오류:', error)
    process.exit(1)
  }
}

test100Votes()
