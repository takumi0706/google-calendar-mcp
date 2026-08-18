/**
 * unknown を人が読める文字列に変換する。
 *
 * catch 節が渡してくる値は unknown なので、テンプレートリテラルに
 * 直接埋め込むと "[object Object]" になったり、型検査で弾かれたりする。
 * 変換をここに集約しておく。
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error === null || error === undefined) {
    return String(error);
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized !== undefined) {
      return serialized;
    }
  } catch {
    // 循環参照などで JSON 化できない場合は下のフォールバックへ
  }

  return Object.prototype.toString.call(error);
}
