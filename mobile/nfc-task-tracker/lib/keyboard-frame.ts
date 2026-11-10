/** Cap the available viewport once; never subtract the keyboard from an already resized parent. */
export function keyboardViewportLimit(
  screenHeight: number,
  keyboardHeight: number,
  navigationInset: number,
  viewTop: number,
) {
  if (
    ![screenHeight, keyboardHeight, navigationInset, viewTop].every(
      Number.isFinite,
    ) ||
    keyboardHeight <= 0
  )
    return undefined;
  return Math.max(0, screenHeight - keyboardHeight - navigationInset - viewTop);
}
