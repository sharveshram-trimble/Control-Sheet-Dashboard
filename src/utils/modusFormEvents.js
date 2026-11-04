/** Read string value from Modus 2.x inputChange (detail is InputEvent). */
export function readInputString(e) {
  const t = e?.detail?.target;
  return t?.value ?? '';
}
