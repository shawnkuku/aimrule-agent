/* AimRule | Copyright (c) 2025-2026 AimRule contributors | AGPL-3.0-or-later */
import { setReact, setReactDOM } from './react.js'
import { CSS } from './styles.js'
import { createPlugin } from './app.jsx'

window.__ModuleLoader__.load({
  id: '@aimrule/dsh-plugin-flow',
  factory(require) {
    const React = require('react')
    setReact(React)
    setReactDOM(require('react-dom'))
    if (typeof document !== 'undefined') {
      let style = document.querySelector('style[data-plugin="aimrule"]')
      if (!style) {
        style = document.createElement('style')
        style.dataset.plugin = 'aimrule'
        document.head.appendChild(style)
      }
      style.textContent = CSS
    }
    return createPlugin()
  },
})
