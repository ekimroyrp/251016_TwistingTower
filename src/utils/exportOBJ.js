import * as THREE from 'three'

export const exportMeshToOBJ = (mesh) => {
  if (!mesh || !mesh.geometry) {
    throw new Error('Mesh with geometry is required for OBJ export.')
  }

  mesh.updateMatrixWorld(true)

  const sourceGeometry = mesh.geometry
  const geometry = sourceGeometry.index
    ? sourceGeometry.toNonIndexed()
    : sourceGeometry.clone()

  geometry.applyMatrix4(mesh.matrixWorld)
  geometry.computeVertexNormals()

  const positionAttribute = geometry.getAttribute('position')
  const normalAttribute = geometry.getAttribute('normal')
  const colorAttribute = geometry.getAttribute('color')

  let objContent = '# Tower mesh export\n'
  objContent += '# Vertices\n'

  for (let i = 0; i < positionAttribute.count; i += 1) {
    const x = positionAttribute.getX(i)
    const y = positionAttribute.getY(i)
    const z = positionAttribute.getZ(i)

    if (colorAttribute) {
      const r = THREE.MathUtils.clamp(colorAttribute.getX(i), 0, 1)
      const g = THREE.MathUtils.clamp(colorAttribute.getY(i), 0, 1)
      const b = THREE.MathUtils.clamp(colorAttribute.getZ(i), 0, 1)
      objContent += `v ${x} ${y} ${z} ${r} ${g} ${b}\n`
    } else {
      objContent += `v ${x} ${y} ${z}\n`
    }
  }

  if (normalAttribute) {
    objContent += '\n# Vertex normals\n'
    for (let i = 0; i < normalAttribute.count; i += 1) {
      const nx = normalAttribute.getX(i)
      const ny = normalAttribute.getY(i)
      const nz = normalAttribute.getZ(i)
      objContent += `vn ${nx} ${ny} ${nz}\n`
    }
  }

  objContent += '\n# Faces\n'
  for (let i = 0; i < positionAttribute.count; i += 3) {
    const a = i + 1
    const b = i + 2
    const c = i + 3
    if (normalAttribute) {
      objContent += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`
    } else {
      objContent += `f ${a} ${b} ${c}\n`
    }
  }

  geometry.dispose()
  return objContent
}
