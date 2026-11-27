import { setReact, setReactDOM } from '../src/react.js'
import AimRulePage, { AimRuleLauncher } from '../src/app.jsx'

/** Bind the browser React instance and return the page component. */
export function mount(React) {
  setReact(React)
  return AimRulePage
}

/** Bind React and ReactDOM, then return the composer launcher. */
export function mountLauncher(React, ReactDOM) {
  setReact(React)
  setReactDOM(ReactDOM)
  return AimRuleLauncher
}
