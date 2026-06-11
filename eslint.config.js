import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * engine/ 내부에서 금지되는 Math 초월함수 목록.
 *
 * ECMA-262는 이들 함수의 정밀도를 구현 정의(implementation-defined)로 두므로
 * 브라우저/엔진마다 결과가 미세하게 다를 수 있다. 게임플레이를 결정하는 값이
 * 여기서 파생되면 "같은 시드 = 같은 우주" 보장이 깨진다.
 * IEEE-754가 비트 동일을 보장하는 +, -, *, /, Math.sqrt, Math.fround만 허용.
 */
const TRANSCENDENTAL_MATH_PROPERTIES = [
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'exp', 'expm1', 'log', 'log2', 'log10', 'log1p',
  'pow', 'cbrt', 'hypot',
]

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'node_modules/'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      boundaries,
    },
    settings: {
      'boundaries/include': ['src/**/*'],
      // 테스트 파일은 vitest 등 테스트 도구를 임포트해야 하므로 레이어 검사 제외
      'boundaries/ignore': ['**/*.test.*'],
      'boundaries/elements': [
        { type: 'engine', pattern: 'src/engine' },
        { type: 'data', pattern: 'src/data' },
        { type: 'assets', pattern: 'src/assets' },
        { type: 'store', pattern: 'src/store' },
        { type: 'persistence', pattern: 'src/persistence' },
        { type: 'scenes', pattern: 'src/scenes' },
        { type: 'quality', pattern: 'src/quality' },
        { type: 'ui', pattern: 'src/ui' },
        { type: 'styles', pattern: 'src/styles' },
        { type: 'app', pattern: 'src/*', mode: 'file' },
      ],
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // 결정론 보호: 절차 생성은 rngFor, UI 엔트로피는 crypto.getRandomValues
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            '결정론 위반: 절차 생성은 engine/rng의 rngFor를, UI 엔트로피는 crypto.getRandomValues를 사용하세요.',
        },
      ],

      // engine/은 순수 결정론 코어 — 앱 레이어 역참조 금지 + 외부 패키지 전면 금지
      // (의존성 업데이트 = 우주 전체 파괴이므로 PRNG/노이즈는 벤더링이 원칙)
      'boundaries/dependencies': [
        'error',
        {
          checkAllOrigins: true,
          default: 'allow',
          rules: [
            {
              from: { type: 'engine' },
              disallow: [
                {
                  to: {
                    type: ['store', 'persistence', 'scenes', 'quality', 'ui', 'assets', 'styles', 'app'],
                  },
                },
                { to: { origin: 'external' } },
              ],
              message:
                'engine/은 순수 결정론 코어입니다 — 앱 레이어/외부 패키지를 임포트할 수 없습니다.',
            },
          ],
        },
      ],
    },
  },

  // 빌드/생성 스크립트 — Node 환경
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // engine/ 전용 순수성 규칙: 브라우저 API · 시간 · 초월함수 금지
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'sessionStorage',
          'indexedDB', 'fetch', 'requestAnimationFrame', 'performance', 'crypto']
          .map((name) => ({
            name,
            message: `engine/은 순수 결정론 코어입니다 — ${name} 사용 금지. 외부 입력은 함수 인자로 받으세요.`,
          })),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: '결정론 위반: rngFor(seed, namespace, ...key)를 사용하세요.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'engine/은 시간에 의존할 수 없습니다 — 타임스탬프는 호출자가 인자로 전달하세요.',
        },
        ...TRANSCENDENTAL_MATH_PROPERTIES.map((property) => ({
          object: 'Math',
          property,
          message:
            `Math.${property}는 정밀도가 구현 정의라 크로스 엔진 결정론을 깨뜨립니다 — ` +
            '정수 결정 경로(해시·PRNG·사칙연산·sqrt)만 사용하세요. 시각 연출은 scenes/에서.',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'engine/은 시간에 의존할 수 없습니다 — 타임스탬프는 호출자가 인자로 전달하세요.',
        },
        {
          selector: "BinaryExpression[operator='**']",
          message:
            '** 연산자는 Math.pow와 동일하게 정밀도가 구현 정의입니다 — x*x 같은 곱셈으로 풀어 쓰세요.',
        },
        {
          selector: "AssignmentExpression[operator='**=']",
          message:
            '**= 연산자는 Math.pow와 동일하게 정밀도가 구현 정의입니다 — 곱셈으로 풀어 쓰세요.',
        },
      ],
    },
  },
)
