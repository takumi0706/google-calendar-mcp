// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'scripts/**', 'jest.config.js', 'eslint.config.js'],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // tsconfig.json はビルド対象（テストを除外）なので、テストを含む
        // tsconfig.test.json も併せて指定する。
        project: ['./tsconfig.json', './tsconfig.test.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // プロジェクト規約: any と型アサーションを使わない。
      // 以前は .eslintrc.json で no-explicit-any が "off" にされており、
      // 規約が機械的に強制されていなかった。
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],

      // 型情報を使う検査。await 漏れは従来まったく検出されていなかった。
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // 非nullアサーションも実質的な型アサーションなので禁止する
      '@typescript-eslint/no-non-null-assertion': 'error',

      // 現時点で await していなくても Promise を返す契約にしておきたい
      // 公開メソッドがあるため無効化する（呼び出し側の互換性を保つため）。
      '@typescript-eslint/require-await': 'off',
    },
  },

  {
    // テストコードでは、意図的に不正な型を渡す・private を差し替えるといった
    // 本番コードでは書かない操作が必要になる。規約の対象は出荷されるコードなので、
    // ここだけ緩める。
    files: ['src/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // jest.spyOn はオーバーロードの最後（戻り値 void）を拾うため、
      // Promise を返すモック実装が誤検知になる。
      '@typescript-eslint/no-misused-promises': 'off',
    },
  }
);
