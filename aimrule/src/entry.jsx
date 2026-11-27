import { setReact, setReactDOM } from './react.js'
import { createPlugin } from './app.jsx'

window.__ModuleLoader__.load({
  id: '@local/aimrule',
  factory(require) {
    const React = require('react')
    setReact(React)
    setReactDOM(require('react-dom'))
    return createPlugin()
  },
})
