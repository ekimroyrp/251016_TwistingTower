import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GUI } from 'lil-gui'

const easeFns = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeOutCubic: (t) => {
    const inv = t - 1
    return inv * inv * inv + 1
  },
}

const ROTATION_CURVE_LIMITS = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
const SIZE_CURVE_LIMITS = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
const OFFSET_CURVE_LIMITS = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
const VISUALIZATION_CURVE_LIMITS = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }

const LIGHTING_SCHEMES = {
  Studio: [
    {
      type: 'HemisphereLight',
      args: [0xbdd2ff, 0x080820, 0.6],
    },
    {
      type: 'DirectionalLight',
      args: [0xffffff, 1.0],
      position: [60, 100, 40],
      castShadow: true,
      shadowMapSize: 2048,
    },
  ],
  Sunset: [
    {
      type: 'HemisphereLight',
      args: [0xffd2a8, 0x402a3a, 0.5],
    },
    {
      type: 'DirectionalLight',
      args: [0xff8c42, 0.8],
      position: [-80, 60, -20],
      castShadow: true,
      shadowMapSize: 2048,
      shadowBias: -0.0015,
    },
    {
      type: 'AmbientLight',
      args: [0x332244, 0.35],
    },
  ],
  Midnight: [
    {
      type: 'HemisphereLight',
      args: [0x183059, 0x04040a, 0.35],
    },
    {
      type: 'DirectionalLight',
      args: [0x9ec9ff, 0.4],
      position: [30, 80, -50],
      castShadow: true,
      shadowMapSize: 1024,
    },
    {
      type: 'PointLight',
      args: [0x4cc9f0, 0.6, 200],
      position: [0, 30, 0],
    },
  ],
  HighKey: [
    {
      type: 'AmbientLight',
      args: [0xf0f4ff, 0.6],
    },
    {
      type: 'DirectionalLight',
      args: [0xffffff, 0.9],
      position: [70, 130, 40],
      castShadow: true,
      shadowMapSize: 2048,
    },
    {
      type: 'DirectionalLight',
      args: [0xffffff, 0.6],
      position: [-50, 80, -30],
    },
  ],
  RimLight: [
    {
      type: 'AmbientLight',
      args: [0x1a1b25, 0.2],
    },
    {
      type: 'DirectionalLight',
      args: [0x4cc9f0, 0.9],
      position: [-100, 60, 100],
      target: [0, 25, 0],
      castShadow: true,
      shadowMapSize: 2048,
      shadowBias: -0.001,
    },
    {
      type: 'DirectionalLight',
      args: [0xf72585, 0.7],
      position: [100, 40, -100],
      target: [0, 25, 0],
    },
  ],
}

const clampCurveHandles = (params, prefix, limits) => {
  params[`${prefix}P1X`] = THREE.MathUtils.clamp(
    params[`${prefix}P1X`],
    limits.xMin,
    limits.xMax,
  )
  params[`${prefix}P1Y`] = THREE.MathUtils.clamp(
    params[`${prefix}P1Y`],
    limits.yMin,
    limits.yMax,
  )
  params[`${prefix}P2X`] = THREE.MathUtils.clamp(
    params[`${prefix}P2X`],
    limits.xMin,
    limits.xMax,
  )
  params[`${prefix}P2Y`] = THREE.MathUtils.clamp(
    params[`${prefix}P2Y`],
    limits.yMin,
    limits.yMax,
  )
}

const clampRotationCurve = (params) =>
  clampCurveHandles(params, 'rotationCurve', ROTATION_CURVE_LIMITS)
const clampSizeCurve = (params) =>
  clampCurveHandles(params, 'sizeCurve', SIZE_CURVE_LIMITS)
const clampOffsetCurve = (params) =>
  clampCurveHandles(params, 'offsetCurve', OFFSET_CURVE_LIMITS)
const clampVisualizationCurve = (params) =>
  clampCurveHandles(params, 'visualizationCurve', VISUALIZATION_CURVE_LIMITS)

const evaluateCurveValue = (enabled, limits, p1x, p1y, p2x, p2y, t) => {
  if (!enabled) return null
  const clampedT = THREE.MathUtils.clamp(t, 0, 1)
  const u = 1 - clampedT
  const value =
    u * u * u * 0 +
    3 * u * u * clampedT * p1y +
    3 * u * clampedT * clampedT * p2y +
    clampedT * clampedT * clampedT * 1
  return THREE.MathUtils.clamp(value, limits.yMin, limits.yMax)
}

class CurveEditor {
  constructor(params, config) {
    const {
      prefix,
      limits,
      clamp,
      controllers,
      title,
      startLabel,
      endLabel,
      onChange,
      onClose,
      handleColor = '#ff5669',
    } = config

    this.params = params
    this.prefix = prefix
    this.limits = limits
    this.clamp = clamp
    this.controllers = controllers
    this.onChange = onChange
    this.onClose = onClose
    this.handleColor = handleColor

    this.draggingHandle = null
    this.draggingWindow = false
    this.pointerId = null
    this.windowPointerId = null
    this.windowOffset = { x: 0, y: 0 }

    this.overlay = document.createElement('div')
    this.overlay.className = 'curve-editor-overlay'
    this.overlay.style.display = 'none'

    this.header = document.createElement('div')
    this.header.className = 'curve-editor-header'

    const titleNode = document.createElement('div')
    titleNode.className = 'curve-editor-title'
    titleNode.textContent = title || 'Curve Editor'

    this.closeBtn = document.createElement('button')
    this.closeBtn.className = 'curve-editor-close'
    this.closeBtn.type = 'button'
    this.closeBtn.textContent = '✕'
    this.closeBtn.addEventListener('click', () => this.handleClose())

    this.header.append(titleNode, this.closeBtn)
    this.overlay.appendChild(this.header)

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'curve-editor-canvas'
    this.overlay.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')

    const footer = document.createElement('div')
    footer.className = 'curve-editor-footer'
    const left = document.createElement('span')
    left.textContent = startLabel || 'Start'
    const right = document.createElement('span')
    right.textContent = endLabel || 'End'
    footer.append(left, right)
    this.overlay.appendChild(footer)

    document.body.appendChild(this.overlay)

    this.pointerDownHandler = (event) => this.handleCanvasPointerDown(event)
    this.pointerMoveHandler = (event) => this.handlePointerMove(event)
    this.pointerUpHandler = (event) => this.handlePointerUp(event)
    this.windowPointerDownHandler = (event) => this.handleWindowPointerDown(event)
    this.resizeHandler = () => {
      this.resize()
      this.draw()
    }

    this.canvas.addEventListener('pointerdown', this.pointerDownHandler)
    window.addEventListener('pointermove', this.pointerMoveHandler)
    window.addEventListener('pointerup', this.pointerUpHandler)
    window.addEventListener('pointercancel', this.pointerUpHandler)
    window.addEventListener('resize', this.resizeHandler)
    this.header.addEventListener('pointerdown', this.windowPointerDownHandler)
    this.resize()
    this.draw()
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.pointerDownHandler)
    window.removeEventListener('pointermove', this.pointerMoveHandler)
    window.removeEventListener('pointerup', this.pointerUpHandler)
    window.removeEventListener('pointercancel', this.pointerUpHandler)
    window.removeEventListener('resize', this.resizeHandler)
    this.header.removeEventListener('pointerdown', this.windowPointerDownHandler)
    this.overlay.remove()
  }

  show() {
    this.overlay.style.display = 'block'
    this.center()
    this.resize()
    this.draw()
  }

  hide() {
    this.overlay.style.display = 'none'
    this.draggingHandle = null
    this.draggingWindow = false
    this.header.classList.remove('dragging')
  }

  handleClose() {
    this.hide()
    if (typeof this.onClose === 'function') {
      this.onClose()
    }
  }

  center() {
    const rect = this.overlay.getBoundingClientRect()
    const left = (window.innerWidth - rect.width) / 2
    const top = (window.innerHeight - rect.height) / 2
    this.overlay.style.left = `${Math.max(left, 16)}px`
    this.overlay.style.top = `${Math.max(top, 16)}px`
  }

  resize() {
    const ratio = window.devicePixelRatio || 1
    const displayWidth = this.canvas.clientWidth || 320
    const displayHeight = this.canvas.clientHeight || 260
    this.canvas.width = displayWidth * ratio
    this.canvas.height = displayHeight * ratio
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    this.padding = 24
    this.innerWidth = displayWidth - this.padding * 2
    this.innerHeight = displayHeight - this.padding * 2
  }

  handleWindowPointerDown(event) {
    if (event.button !== 0 || event.target === this.closeBtn) return
    event.preventDefault()

    const overlayRect = this.overlay.getBoundingClientRect()
    this.windowOffset.x = event.clientX - overlayRect.left
    this.windowOffset.y = event.clientY - overlayRect.top

    this.draggingWindow = true
    this.windowPointerId = event.pointerId
    this.header.classList.add('dragging')
  }

  handleCanvasPointerDown(event) {
    const bounds = this.canvas.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const p1 = this.getHandlePosition('P1')
    const p2 = this.getHandlePosition('P2')
    const hitRadius = 14

    const dist = (p, px, py) => Math.hypot(p.x - px, p.y - py)

    if (dist(p1, x, y) <= hitRadius) {
      this.draggingHandle = 'P1'
    } else if (dist(p2, x, y) <= hitRadius) {
      this.draggingHandle = 'P2'
    } else {
      this.draggingHandle = null
      return
    }

    this.pointerId = event.pointerId
    event.preventDefault()
  }

  handlePointerMove(event) {
    if (this.draggingWindow && event.pointerId === this.windowPointerId) {
      event.preventDefault()
      const left = event.clientX - this.windowOffset.x
      const top = event.clientY - this.windowOffset.y
      const rect = this.overlay.getBoundingClientRect()
      const maxLeft = window.innerWidth - rect.width - 16
      const maxTop = window.innerHeight - rect.height - 16
      this.overlay.style.left = `${THREE.MathUtils.clamp(left, 16, maxLeft)}px`
      this.overlay.style.top = `${THREE.MathUtils.clamp(top, 16, maxTop)}px`
      return
    }

    if (!this.draggingHandle || event.pointerId !== this.pointerId) return

    const bounds = this.canvas.getBoundingClientRect()
    const canvasX = event.clientX - bounds.left
    const canvasY = event.clientY - bounds.top
    const normalizedX = THREE.MathUtils.clamp(
      (canvasX - this.padding) / this.innerWidth,
      0,
      1,
    )
    const normalizedY = THREE.MathUtils.clamp(
      1 - (canvasY - this.padding) / this.innerHeight,
      0,
      1,
    )

    const pxKey = `${this.prefix}${this.draggingHandle}X`
    const pyKey = `${this.prefix}${this.draggingHandle}Y`
    this.params[pxKey] = normalizedX
    this.params[pyKey] = normalizedY
    if (this.clamp) this.clamp(this.params)
    this.syncControllers()
    if (typeof this.onChange === 'function') this.onChange()
    this.draw()
  }

  handlePointerUp(event) {
    if (this.draggingWindow && event.pointerId === this.windowPointerId) {
      this.draggingWindow = false
      this.header.classList.remove('dragging')
      this.windowPointerId = null
    }

    if (event.pointerId === this.pointerId) {
      this.draggingHandle = null
      this.pointerId = null
    }
  }

  getHandlePosition(label) {
    const px = this.params[`${this.prefix}${label}X`]
    const py = this.params[`${this.prefix}${label}Y`]
    return {
      x: this.padding + px * this.innerWidth,
      y: this.padding + (1 - py) * this.innerHeight,
    }
  }

  draw() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
    ctx.lineWidth = 1
    ctx.strokeRect(this.padding, this.padding, this.innerWidth, this.innerHeight)

    const p0 = {
      x: this.padding,
      y: this.padding + this.innerHeight,
    }
    const p1 = this.getHandlePosition('P1')
    const p2 = this.getHandlePosition('P2')
    const p3 = {
      x: this.padding + this.innerWidth,
      y: this.padding,
    }

    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.lineTo(p1.x, p1.y)
    ctx.moveTo(p2.x, p2.y)
    ctx.lineTo(p3.x, p3.y)
    ctx.strokeStyle = 'rgba(255, 86, 105, 0.7)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    const p1x = this.params[`${this.prefix}P1X`]
    const p1y = this.params[`${this.prefix}P1Y`]
    const p2x = this.params[`${this.prefix}P2X`]
    const p2y = this.params[`${this.prefix}P2Y`]

    ctx.beginPath()
    const steps = 60
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      const bx = this.bezierComponent(p1x, p2x, t)
      const by = this.bezierComponent(p1y, p2y, t)
      const x = this.padding + bx * this.innerWidth
      const y = this.padding + (1 - by) * this.innerHeight
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()

    this.drawHandle(ctx, p0, '#ffffff', true)
    this.drawHandle(ctx, p3, '#ffffff', true)
    this.drawHandle(ctx, p1, this.handleColor, false)
    this.drawHandle(ctx, p2, this.handleColor, false)
  }

  getBezierPoint(component, t) {
    const p1 = this.params[`${this.prefix}P1${component}`]
    const p2 = this.params[`${this.prefix}P2${component}`]
    const u = 1 - t
    return (
      u * u * u * 0 +
      3 * u * u * t * p1 +
      3 * u * t * t * p2 +
      t * t * t * 1
    )
  }

  drawHandle(ctx, point, color, locked) {
    ctx.beginPath()
    ctx.arc(point.x, point.y, locked ? 6 : 8, 0, Math.PI * 2)
    if (locked) {
      ctx.fillStyle = color
      ctx.fill()
    } else {
      ctx.fillStyle = '#0b0c10'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = color
      ctx.stroke()
    }
  }

  syncControllers() {
    this.controllers?.p1x?.updateDisplay()
    this.controllers?.p1y?.updateDisplay()
    this.controllers?.p2x?.updateDisplay()
    this.controllers?.p2y?.updateDisplay()
  }

  syncFromParams() {
    if (this.clamp) this.clamp(this.params)
    this.draw()
  }

  bezierComponent(p1, p2, t) {
    const u = 1 - t
    return (
      u * u * u * 0 +
      3 * u * u * t * p1 +
      3 * u * t * t * p2 +
      t * t * t * 1
    )
  }
}

class TowerGenerator {
  constructor(scene) {
    this.scene = scene
    this.mesh = null
    this.geometry = null
    this.material = null
    this.baseGeometry = null
    this.currentSegments = null
  }

  rebuild(params) {
    const needsNewMesh =
      !this.mesh || this.currentSegments !== params.radialSegments

    if (needsNewMesh) {
      this.dispose()
      this.currentSegments = params.radialSegments
      this.baseGeometry = new THREE.CylinderGeometry(
        1,
        1,
        1,
        params.radialSegments,
      )
      this.baseGeometry.rotateY(Math.PI / 4)
      this.material = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        vertexColors: true,
      })
      this.geometry = new THREE.BufferGeometry()
      this.mesh = new THREE.Mesh(this.geometry, this.material)
      this.mesh.castShadow = params.shadowsEnabled
      this.mesh.receiveShadow = params.shadowsEnabled
      this.scene.add(this.mesh)
    } else if (!this.baseGeometry) {
      this.baseGeometry = new THREE.CylinderGeometry(
        1,
        1,
        1,
        params.radialSegments,
      )
      this.baseGeometry.rotateY(Math.PI / 4)
    }

    this.updateInstances(params)
  }

  updateInstances(params) {
    if (!this.mesh) return

    this.mesh.castShadow = params.shadowsEnabled
    this.mesh.receiveShadow = params.shadowsEnabled

    clampRotationCurve(params)
    clampSizeCurve(params)
    clampOffsetCurve(params)
    clampVisualizationCurve(params)

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const fromColor = new THREE.Color(params.baseColor)
    const toColor = new THREE.Color(params.topColor)
    const offsetVector = new THREE.Vector3()
    const twistAxis = new THREE.Vector3(0, 1, 0)

    if (!this.baseGeometry || this.currentSegments !== params.radialSegments) {
      if (this.baseGeometry) {
        this.baseGeometry.dispose()
      }
      this.baseGeometry = new THREE.CylinderGeometry(
        1,
        1,
        1,
        params.radialSegments,
      )
      this.currentSegments = params.radialSegments
      this.baseGeometry.rotateY(Math.PI / 4)
    }

    const effectiveHeight = Math.max(
      params.totalHeight - params.floorThickness,
      0,
    )
    const spacing =
      params.levels > 1 ? effectiveHeight / (params.levels - 1) : 0
    const baseCenterY = params.floorThickness / 2

    const sizeEase = easeFns[params.scaleEase] || easeFns.linear
    const rotationEase = easeFns[params.twistEase] || easeFns.linear
    const offsetEase = easeFns[params.offsetEase] || easeFns.linear
    const visualizationEase =
      easeFns[params.visualizationGradientEase] || easeFns.linear

    const geometries = []
    let minY = Infinity
    let maxY = -Infinity

    for (let i = 0; i < params.levels; i += 1) {
      const t = params.levels === 1 ? 0 : i / (params.levels - 1)

      let scaleT = THREE.MathUtils.clamp(sizeEase(t), 0, 1)
      const sizeCurveValue = evaluateCurveValue(
        params.sizeCurveEnabled,
        SIZE_CURVE_LIMITS,
        params.sizeCurveP1X,
        params.sizeCurveP1Y,
        params.sizeCurveP2X,
        params.sizeCurveP2Y,
        t,
      )
      if (sizeCurveValue !== null) scaleT = sizeCurveValue

      let twistT = THREE.MathUtils.clamp(rotationEase(t), 0, 1)
      const rotationCurveValue = evaluateCurveValue(
        params.rotationCurveEnabled,
        ROTATION_CURVE_LIMITS,
        params.rotationCurveP1X,
        params.rotationCurveP1Y,
        params.rotationCurveP2X,
        params.rotationCurveP2Y,
        t,
      )
      if (rotationCurveValue !== null) twistT = rotationCurveValue

      let offsetT = THREE.MathUtils.clamp(offsetEase(t), 0, 1)
      const offsetCurveValue = evaluateCurveValue(
        params.offsetCurveEnabled,
        OFFSET_CURVE_LIMITS,
        params.offsetCurveP1X,
        params.offsetCurveP1Y,
        params.offsetCurveP2X,
        params.offsetCurveP2Y,
        t,
      )
      if (offsetCurveValue !== null) offsetT = offsetCurveValue

      const radius = THREE.MathUtils.lerp(
        params.baseRadius,
        params.topRadius,
        scaleT,
      )
      const offset = THREE.MathUtils.lerp(
        params.baseDistance,
        params.topDistance,
        offsetT,
      )
      const rotationDegrees = THREE.MathUtils.lerp(
        params.baseDegrees,
        params.topDegrees,
        twistT,
      )
      const twistRadians = THREE.MathUtils.degToRad(rotationDegrees)

      quaternion.setFromAxisAngle(twistAxis, twistRadians)
      offsetVector.set(offset, 0, 0).applyQuaternion(quaternion)

      position.set(offsetVector.x, baseCenterY + i * spacing, offsetVector.z)
      scale.set(radius, params.floorThickness, radius)

      matrix.compose(position, quaternion, scale)
      const instanceGeometry = this.baseGeometry.clone()
      instanceGeometry.applyMatrix4(matrix)
      geometries.push(instanceGeometry)

      const positionAttribute = instanceGeometry.getAttribute('position')
      for (let j = 0; j < positionAttribute.count; j += 1) {
        const y = positionAttribute.getY(j)
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }

    if (geometries.length === 0) {
      if (this.geometry) {
        this.geometry.dispose()
      }
      this.geometry = new THREE.BufferGeometry()
      this.mesh.geometry = this.geometry
      return
    }

    const range = Math.max(maxY - minY, Number.EPSILON)
    const gradientColor = new THREE.Color()

    for (const geometry of geometries) {
      const positionAttribute = geometry.getAttribute('position')
      const colorArray = new Float32Array(positionAttribute.count * 3)

      for (let j = 0; j < positionAttribute.count; j += 1) {
        const y = positionAttribute.getY(j)
        const gradientT = THREE.MathUtils.clamp((y - minY) / range, 0, 1)
        let adjustedGradientT = THREE.MathUtils.clamp(
          visualizationEase(gradientT),
          0,
          1,
        )
        const visualizationCurveValue = evaluateCurveValue(
          params.visualizationCurveEnabled,
          VISUALIZATION_CURVE_LIMITS,
          params.visualizationCurveP1X,
          params.visualizationCurveP1Y,
          params.visualizationCurveP2X,
          params.visualizationCurveP2Y,
          gradientT,
        )
        if (visualizationCurveValue !== null)
          adjustedGradientT = visualizationCurveValue
        adjustedGradientT = THREE.MathUtils.clamp(adjustedGradientT, 0, 1)
        gradientColor.copy(fromColor).lerp(toColor, adjustedGradientT)
        const index = j * 3
        colorArray[index] = gradientColor.r
        colorArray[index + 1] = gradientColor.g
        colorArray[index + 2] = gradientColor.b
      }

      geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(colorArray, 3),
      )
    }

    const mergedGeometry = mergeGeometries(geometries, false)
    const totalRotationRadians = THREE.MathUtils.degToRad(
      params.totalRotation || 0,
    )
    if (totalRotationRadians !== 0) {
      const totalRotationMatrix = new THREE.Matrix4().makeRotationY(
        totalRotationRadians,
      )
      mergedGeometry.applyMatrix4(totalRotationMatrix)
    }
    mergedGeometry.computeBoundingBox()
    mergedGeometry.computeBoundingSphere()

    for (const geometry of geometries) {
      geometry.dispose()
    }

    if (this.geometry) {
      this.geometry.dispose()
    }

    this.geometry = mergedGeometry
    this.mesh.geometry = mergedGeometry
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh)
      if (this.mesh.geometry) {
        this.mesh.geometry.dispose()
      }
      this.mesh.material.dispose()
      this.mesh = null
    }
    if (this.baseGeometry) {
      this.baseGeometry.dispose()
      this.baseGeometry = null
    }
    this.geometry = null
    this.material = null
    this.currentSegments = null
  }
}

const app = document.querySelector('#app')
app.innerHTML = ''

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0f1016)

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(60, 60, 60)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
app.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.target.set(0, 20, 0)

const gridHelper = new THREE.GridHelper(2000, 400, 0x3a506b, 0x1b263b)
const gridMaterials = Array.isArray(gridHelper.material)
  ? gridHelper.material
  : [gridHelper.material]
gridMaterials.forEach((material) => {
  material.transparent = true
  material.opacity = 0.2
  material.depthWrite = false
  material.depthTest = true
})
gridHelper.renderOrder = -1
gridHelper.position.y = 0
scene.add(gridHelper)

const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.ShadowMaterial({ opacity: 0.35 }),
)
shadowPlane.rotation.x = -Math.PI / 2
shadowPlane.position.y = 0.01
shadowPlane.receiveShadow = true
scene.add(shadowPlane)

const params = {
  levels: 50,
  totalHeight: 100,
  totalRotation: 0,
  floorThickness: 1,
  baseRadius: 6,
  topRadius: 6,
  baseDegrees: 0,
  topDegrees: 0,
  radialSegments: 4,
  scaleEase: 'linear',
  twistEase: 'linear',
  baseDistance: 0,
  topDistance: 0,
  offsetEase: 'linear',
  offsetCurveEnabled: false,
  offsetCurveP1X: 0.25,
  offsetCurveP1Y: 0.0,
  offsetCurveP2X: 0.75,
  offsetCurveP2Y: 1.0,
  sizeCurveEnabled: false,
  sizeCurveP1X: 0.25,
  sizeCurveP1Y: 0.0,
  sizeCurveP2X: 0.75,
  sizeCurveP2Y: 1.0,
  rotationCurveEnabled: false,
  rotationCurveP1X: 0.25,
  rotationCurveP1Y: 0.0,
  rotationCurveP2X: 0.75,
  rotationCurveP2Y: 1.0,
  baseColor: '#00fffb',
  topColor: '#ff8400',
  visualizationGradientEase: 'linear',
  visualizationCurveEnabled: false,
  visualizationCurveP1X: 0.25,
  visualizationCurveP1Y: 0.0,
  visualizationCurveP2X: 0.75,
  visualizationCurveP2Y: 1.0,
  backgroundColor: '#0f1016',
  gridDisplay: true,
  shadowsEnabled: true,
  lightingScheme: 'Studio',
}

let activeLights = []

const disposeActiveLights = () => {
  for (const light of activeLights) {
    scene.remove(light)
    if (
      light.target &&
      (light.isDirectionalLight || light.isSpotLight || light.isRectAreaLight)
    ) {
      scene.remove(light.target)
    }
    if (typeof light.dispose === 'function') light.dispose()
  }
  activeLights = []
}

const applyShadowSettings = () => {
  renderer.shadowMap.enabled = params.shadowsEnabled
  if (params.shadowsEnabled) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
  }
  shadowPlane.visible = params.shadowsEnabled
  if (typeof tower !== 'undefined' && tower.mesh) {
    tower.mesh.castShadow = params.shadowsEnabled
    tower.mesh.receiveShadow = params.shadowsEnabled
  }

  for (const light of activeLights) {
    if ('castShadow' in light) {
      const canCast = Boolean(light.userData?.canCastShadow)
      light.castShadow = params.shadowsEnabled && canCast
      if (light.castShadow && light.shadow) {
        const size = light.userData?.shadowMapSize || 1024
        light.shadow.mapSize.set(size, size)
        if (typeof light.userData?.shadowBias === 'number') {
          light.shadow.bias = light.userData.shadowBias
        }
        if (typeof light.userData?.shadowNormalBias === 'number') {
          light.shadow.normalBias = light.userData.shadowNormalBias
        }
      }
    }
  }
}

const applyLightingScheme = (schemeName = params.lightingScheme) => {
  const scheme = LIGHTING_SCHEMES[schemeName] || LIGHTING_SCHEMES.Studio
  disposeActiveLights()

  for (const config of scheme) {
    const LightConstructor = THREE[config.type]
    if (typeof LightConstructor !== 'function') continue
    const args = Array.isArray(config.args) ? config.args : []
    const light = new LightConstructor(...args)
    if (config.position) {
      light.position.set(...config.position)
    }
    if (
      config.target &&
      (light.isDirectionalLight || light.isSpotLight || light.isRectAreaLight)
    ) {
      light.target.position.set(...config.target)
      scene.add(light.target)
    }
    light.userData.canCastShadow = Boolean(config.castShadow)
    if (config.shadowMapSize) {
      light.userData.shadowMapSize = config.shadowMapSize
    }
    if (typeof config.shadowBias === 'number') {
      light.userData.shadowBias = config.shadowBias
    }
    if (typeof config.shadowNormalBias === 'number') {
      light.userData.shadowNormalBias = config.shadowNormalBias
    }
    if (config.castShadow && light.shadow && light.shadow.camera) {
      const cam = light.shadow.camera
      if ('near' in cam) cam.near = 1
      if ('far' in cam) cam.far = 400
      if ('left' in cam) cam.left = -120
      if ('right' in cam) cam.right = 120
      if ('top' in cam) cam.top = 120
      if ('bottom' in cam) cam.bottom = -120
    }
    scene.add(light)
    activeLights.push(light)
  }

  params.lightingScheme = schemeName
  applyShadowSettings()
}

const applyBackgroundColor = () => {
  if (!scene.background) {
    scene.background = new THREE.Color(params.backgroundColor)
  } else {
    scene.background.set(params.backgroundColor)
  }
}

const tower = new TowerGenerator(scene)
tower.rebuild(params)
applyBackgroundColor()
gridHelper.visible = params.gridDisplay
applyLightingScheme()

let rotationCurveEditor
let sizeCurveEditor
let offsetCurveEditor
let visualizationCurveEditor

const rotationCurveControllers = {}
const sizeCurveControllers = {}
const offsetCurveControllers = {}
const visualizationCurveControllers = {}

const ensureRotationCurveEditor = () => {
  if (!rotationCurveEditor) {
    rotationCurveEditor = new CurveEditor(params, {
      prefix: 'rotationCurve',
      limits: ROTATION_CURVE_LIMITS,
      clamp: clampRotationCurve,
      controllers: rotationCurveControllers,
      title: 'Rotation Curve',
      startLabel: 'Base',
      endLabel: 'Top',
      handleColor: '#4cc9f0',
      onChange: () => tower.updateInstances(params),
      onClose: () => {
        params.rotationCurveEnabled = false
        rotationCurveControllers.enabled?.updateDisplay()
        tower.updateInstances(params)
      },
    })
  }
  return rotationCurveEditor
}

const ensureSizeCurveEditor = () => {
  if (!sizeCurveEditor) {
    sizeCurveEditor = new CurveEditor(params, {
      prefix: 'sizeCurve',
      limits: SIZE_CURVE_LIMITS,
      clamp: clampSizeCurve,
      controllers: sizeCurveControllers,
      title: 'Size Curve',
      startLabel: 'Base',
      endLabel: 'Top',
      handleColor: '#4cc9f0',
      onChange: () => tower.updateInstances(params),
      onClose: () => {
        params.sizeCurveEnabled = false
        sizeCurveControllers.enabled?.updateDisplay()
        tower.updateInstances(params)
      },
    })
  }
  return sizeCurveEditor
}

const ensureOffsetCurveEditor = () => {
  if (!offsetCurveEditor) {
    offsetCurveEditor = new CurveEditor(params, {
      prefix: 'offsetCurve',
      limits: OFFSET_CURVE_LIMITS,
      clamp: clampOffsetCurve,
      controllers: offsetCurveControllers,
      title: 'Offset Curve',
      startLabel: 'Base',
      endLabel: 'Top',
      handleColor: '#4cc9f0',
      onChange: () => tower.updateInstances(params),
      onClose: () => {
        params.offsetCurveEnabled = false
        offsetCurveControllers.enabled?.updateDisplay()
        tower.updateInstances(params)
      },
    })
  }
  return offsetCurveEditor
}

const ensureVisualizationCurveEditor = () => {
  if (!visualizationCurveEditor) {
    visualizationCurveEditor = new CurveEditor(params, {
      prefix: 'visualizationCurve',
      limits: VISUALIZATION_CURVE_LIMITS,
      clamp: clampVisualizationCurve,
      controllers: visualizationCurveControllers,
      title: 'Color Curve',
      startLabel: 'Base',
      endLabel: 'Top',
      handleColor: '#4cc9f0',
      onChange: () => tower.updateInstances(params),
      onClose: () => {
        params.visualizationCurveEnabled = false
        visualizationCurveControllers.enabled?.updateDisplay()
        tower.updateInstances(params)
      },
    })
  }
  return visualizationCurveEditor
}

const gui = new GUI()
gui.title('Controls')

const floorsFolder = gui.addFolder('Floors')
floorsFolder
  .add(params, 'totalHeight', 30, 400, 1)
  .name('Total Height')
  .onChange(() => tower.rebuild(params))
floorsFolder
  .add(params, 'totalRotation', -720, 720, 1)
  .name('Total Rotation')
  .onChange(() => tower.updateInstances(params))
floorsFolder
  .add(params, 'levels', 3, 200, 1)
  .name('Floor Amount')
  .onChange(() => tower.rebuild(params))
floorsFolder
  .add(params, 'radialSegments', 3, 64, 1)
  .name('Floor Segments')
  .onChange(() => tower.rebuild(params))
floorsFolder
  .add(params, 'floorThickness', 0.2, 5, 0.1)
  .name('Floor Thickness')
  .onChange(() => tower.updateInstances(params))

const sizeFolder = gui.addFolder('Size')
sizeFolder
  .add(params, 'topRadius', 1, 30, 0.1)
  .name('Top Radius')
  .onChange(() => tower.updateInstances(params))
sizeFolder
  .add(params, 'baseRadius', 1, 30, 0.1)
  .name('Base Radius')
  .onChange(() => tower.updateInstances(params))
sizeFolder
  .add(params, 'scaleEase', Object.keys(easeFns))
  .name('Size Gradient')
  .onChange(() => tower.updateInstances(params))

const sizeCurveFolder = sizeFolder.addFolder('Size Curve')
sizeCurveControllers.enabled = sizeCurveFolder
  .add(params, 'sizeCurveEnabled')
  .name('Enable Curve')
  .onChange((value) => {
    clampSizeCurve(params)
    if (value) {
      ensureSizeCurveEditor().show()
      sizeCurveEditor.syncFromParams()
    } else if (sizeCurveEditor) {
      sizeCurveEditor.hide()
    }
    tower.updateInstances(params)
  })
sizeCurveControllers.p1x = sizeCurveFolder
  .add(params, 'sizeCurveP1X', SIZE_CURVE_LIMITS.xMin, SIZE_CURVE_LIMITS.xMax, 0.01)
  .name('Handle 1 X')
  .onChange(() => {
    clampSizeCurve(params)
    sizeCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
sizeCurveControllers.p1y = sizeCurveFolder
  .add(params, 'sizeCurveP1Y', SIZE_CURVE_LIMITS.yMin, SIZE_CURVE_LIMITS.yMax, 0.01)
  .name('Handle 1 Y')
  .onChange(() => {
    clampSizeCurve(params)
    sizeCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
sizeCurveControllers.p2x = sizeCurveFolder
  .add(params, 'sizeCurveP2X', SIZE_CURVE_LIMITS.xMin, SIZE_CURVE_LIMITS.xMax, 0.01)
  .name('Handle 2 X')
  .onChange(() => {
    clampSizeCurve(params)
    sizeCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
sizeCurveControllers.p2y = sizeCurveFolder
  .add(params, 'sizeCurveP2Y', SIZE_CURVE_LIMITS.yMin, SIZE_CURVE_LIMITS.yMax, 0.01)
  .name('Handle 2 Y')
  .onChange(() => {
    clampSizeCurve(params)
    sizeCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })

const offsetFolder = gui.addFolder('Offset')
offsetFolder
  .add(params, 'topDistance', -60, 60, 0.1)
  .name('Top Distance')
  .onChange(() => tower.updateInstances(params))
offsetFolder
  .add(params, 'baseDistance', -60, 60, 0.1)
  .name('Base Distance')
  .onChange(() => tower.updateInstances(params))
offsetFolder
  .add(params, 'offsetEase', Object.keys(easeFns))
  .name('Offset Gradient')
  .onChange(() => tower.updateInstances(params))

const offsetCurveFolder = offsetFolder.addFolder('Offset Curve')
offsetCurveControllers.enabled = offsetCurveFolder
  .add(params, 'offsetCurveEnabled')
  .name('Enable Curve')
  .onChange((value) => {
    clampOffsetCurve(params)
    if (value) {
      ensureOffsetCurveEditor().show()
      offsetCurveEditor.syncFromParams()
    } else if (offsetCurveEditor) {
      offsetCurveEditor.hide()
    }
    tower.updateInstances(params)
  })
offsetCurveControllers.p1x = offsetCurveFolder
  .add(params, 'offsetCurveP1X', OFFSET_CURVE_LIMITS.xMin, OFFSET_CURVE_LIMITS.xMax, 0.01)
  .name('Handle 1 X')
  .onChange(() => {
    clampOffsetCurve(params)
    offsetCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
offsetCurveControllers.p1y = offsetCurveFolder
  .add(params, 'offsetCurveP1Y', OFFSET_CURVE_LIMITS.yMin, OFFSET_CURVE_LIMITS.yMax, 0.01)
  .name('Handle 1 Y')
  .onChange(() => {
    clampOffsetCurve(params)
    offsetCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
offsetCurveControllers.p2x = offsetCurveFolder
  .add(params, 'offsetCurveP2X', OFFSET_CURVE_LIMITS.xMin, OFFSET_CURVE_LIMITS.xMax, 0.01)
  .name('Handle 2 X')
  .onChange(() => {
    clampOffsetCurve(params)
    offsetCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
offsetCurveControllers.p2y = offsetCurveFolder
  .add(params, 'offsetCurveP2Y', OFFSET_CURVE_LIMITS.yMin, OFFSET_CURVE_LIMITS.yMax, 0.01)
  .name('Handle 2 Y')
  .onChange(() => {
    clampOffsetCurve(params)
    offsetCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })

const rotationFolder = gui.addFolder('Rotation')
rotationFolder
  .add(params, 'topDegrees', -720, 720, 1)
  .name('Top Degrees')
  .onChange(() => tower.updateInstances(params))
rotationFolder
  .add(params, 'baseDegrees', -720, 720, 1)
  .name('Base Degrees')
  .onChange(() => tower.updateInstances(params))
rotationFolder
  .add(params, 'twistEase', Object.keys(easeFns))
  .name('Rotation Gradient')
  .onChange(() => tower.updateInstances(params))

const rotationCurveFolder = rotationFolder.addFolder('Rotation Curve')
rotationCurveControllers.enabled = rotationCurveFolder
  .add(params, 'rotationCurveEnabled')
  .name('Enable Curve')
  .onChange((value) => {
    clampRotationCurve(params)
    if (value) {
      ensureRotationCurveEditor().show()
      rotationCurveEditor.syncFromParams()
    } else if (rotationCurveEditor) {
      rotationCurveEditor.hide()
    }
    tower.updateInstances(params)
  })
rotationCurveControllers.p1x = rotationCurveFolder
  .add(params, 'rotationCurveP1X', ROTATION_CURVE_LIMITS.xMin, ROTATION_CURVE_LIMITS.xMax, 0.01)
  .name('Handle 1 X')
  .onChange(() => {
    clampRotationCurve(params)
    rotationCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
rotationCurveControllers.p1y = rotationCurveFolder
  .add(params, 'rotationCurveP1Y', ROTATION_CURVE_LIMITS.yMin, ROTATION_CURVE_LIMITS.yMax, 0.01)
  .name('Handle 1 Y')
  .onChange(() => {
    clampRotationCurve(params)
    rotationCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
rotationCurveControllers.p2x = rotationCurveFolder
  .add(params, 'rotationCurveP2X', ROTATION_CURVE_LIMITS.xMin, ROTATION_CURVE_LIMITS.xMax, 0.01)
  .name('Handle 2 X')
  .onChange(() => {
    clampRotationCurve(params)
    rotationCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
rotationCurveControllers.p2y = rotationCurveFolder
  .add(params, 'rotationCurveP2Y', ROTATION_CURVE_LIMITS.yMin, ROTATION_CURVE_LIMITS.yMax, 0.01)
  .name('Handle 2 Y')
  .onChange(() => {
    clampRotationCurve(params)
    rotationCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })

const colorFolder = gui.addFolder('Color')
colorFolder
  .addColor(params, 'topColor')
  .name('Top Color')
  .onChange(() => tower.updateInstances(params))
colorFolder
  .addColor(params, 'baseColor')
  .name('Base Color')
  .onChange(() => tower.updateInstances(params))
colorFolder
  .add(params, 'visualizationGradientEase', Object.keys(easeFns))
  .name('Color Gradient')
  .onChange(() => tower.updateInstances(params))
const visualizationCurveFolder = colorFolder.addFolder('Color Curve')
visualizationCurveControllers.enabled = visualizationCurveFolder
  .add(params, 'visualizationCurveEnabled')
  .name('Enable Curve')
  .onChange((value) => {
    clampVisualizationCurve(params)
    if (value) {
      ensureVisualizationCurveEditor().show()
      visualizationCurveEditor.syncFromParams()
    } else if (visualizationCurveEditor) {
      visualizationCurveEditor.hide()
    }
    tower.updateInstances(params)
  })
visualizationCurveControllers.p1x = visualizationCurveFolder
  .add(
    params,
    'visualizationCurveP1X',
    VISUALIZATION_CURVE_LIMITS.xMin,
    VISUALIZATION_CURVE_LIMITS.xMax,
    0.01,
  )
  .name('Handle 1 X')
  .onChange(() => {
    clampVisualizationCurve(params)
    visualizationCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
visualizationCurveControllers.p1y = visualizationCurveFolder
  .add(
    params,
    'visualizationCurveP1Y',
    VISUALIZATION_CURVE_LIMITS.yMin,
    VISUALIZATION_CURVE_LIMITS.yMax,
    0.01,
  )
  .name('Handle 1 Y')
  .onChange(() => {
    clampVisualizationCurve(params)
    visualizationCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
visualizationCurveControllers.p2x = visualizationCurveFolder
  .add(
    params,
    'visualizationCurveP2X',
    VISUALIZATION_CURVE_LIMITS.xMin,
    VISUALIZATION_CURVE_LIMITS.xMax,
    0.01,
  )
  .name('Handle 2 X')
  .onChange(() => {
    clampVisualizationCurve(params)
    visualizationCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })
visualizationCurveControllers.p2y = visualizationCurveFolder
  .add(
    params,
    'visualizationCurveP2Y',
    VISUALIZATION_CURVE_LIMITS.yMin,
    VISUALIZATION_CURVE_LIMITS.yMax,
    0.01,
  )
  .name('Handle 2 Y')
  .onChange(() => {
    clampVisualizationCurve(params)
    visualizationCurveEditor?.syncFromParams()
    tower.updateInstances(params)
  })

const sceneFolder = gui.addFolder('Scene')
sceneFolder
  .add(params, 'gridDisplay')
  .name('Grid')
  .onChange((value) => {
    gridHelper.visible = value
  })
sceneFolder
  .add(params, 'shadowsEnabled')
  .name('Shadows')
  .onChange(() => applyShadowSettings())
sceneFolder
  .add(params, 'lightingScheme', Object.keys(LIGHTING_SCHEMES))
  .name('Lighting')
  .onChange((value) => applyLightingScheme(value))
sceneFolder
  .addColor(params, 'backgroundColor')
  .name('Background')
  .onChange(applyBackgroundColor)

floorsFolder.open()
sizeFolder.open()
sizeCurveFolder.open()
offsetFolder.open()
offsetCurveFolder.open()
rotationFolder.open()

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

window.addEventListener('resize', onWindowResize)

renderer.setAnimationLoop(() => {
  controls.update()
  renderer.render(scene, camera)
})
