/**
 * React access shim.
 *
 * The client bundle receives React through the module table at factory time,
 * so components resolve hooks through this module instead of importing React.
 */

let R = null
let RD = null

export function setReact(instance) {
  R = instance
}

export function setReactDOM(instance) {
  RD = instance
}

export function createPortal(children, container) {
  return RD === null ? null : RD.createPortal(children, container)
}

export function getReact() {
  if (R === null) throw new Error('AimRule: React was not injected')
  return R
}

export function h(type, props, ...children) {
  return getReact().createElement(type, props, ...children)
}

export function useState(initial) {
  return getReact().useState(initial)
}

export function useEffect(effect, deps) {
  return getReact().useEffect(effect, deps)
}

export function useLayoutEffect(effect, deps) {
  return getReact().useLayoutEffect(effect, deps)
}

export function useRef(initial) {
  return getReact().useRef(initial)
}

export function useMemo(factory, deps) {
  return getReact().useMemo(factory, deps)
}

export function useCallback(fn, deps) {
  return getReact().useCallback(fn, deps)
}
