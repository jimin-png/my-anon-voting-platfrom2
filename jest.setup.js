/**
 * Jest 테스트 환경 설정
 * 
 * 모든 테스트 실행 전에 실행되는 파일입니다.
 * 환경 변수나 전역 설정을 여기에 추가할 수 있습니다.
 */

// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// ============================================
// 테스트 환경 변수 설정
// ============================================
// Relay 테스트를 위한 환경 변수 설정
// 주의: nonce.service.ts는 모듈 로드 시점에 실행되므로
// 여기서 설정해야 합니다.
process.env.RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || 
  '0x1234567890123456789012345678901234567890123456789012345678901234'
process.env.INFURA_URL = process.env.INFURA_URL || 
  'https://sepolia.infura.io/v3/test'

